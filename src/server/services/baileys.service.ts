/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BAILEYS SERVICE - Conexão WhatsApp via QR Code
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Gerencia conexões individuais usando a biblioteca Baileys.
 * Cada instância representa uma conexão WhatsApp Web ativa.
 * 
 * Funcionalidades:
 * - Geração de QR Code para autenticação
 * - Persistência de sessão no banco de dados
 * - Envio e recebimento de mensagens
 * - Eventos em tempo real via EventEmitter
 */

import makeWASocket, {
    DisconnectReason,
    WASocket,
    makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { EventEmitter } from 'events';
import pino from 'pino';
import { usePostgresAuthState } from './baileys-auth';

// Tipos de eventos emitidos pelo serviço
export interface BaileysServiceEvents {
    'qr': (qr: string) => void;
    'connected': (info: { phoneNumber: string; profileName: string }) => void;
    'disconnected': (reason: string) => void;
    'message': (message: {
        from: string;
        fromName: string;
        text: string;
        messageId: string;
        timestamp: Date;
    }) => void;
    'error': (error: Error) => void;
}

export class BaileysService extends EventEmitter {
    private socket: WASocket | null = null;
    private instanceId: string;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private isConnecting = false;
    private logger: pino.Logger;

    constructor(instanceId: string) {
        super();
        this.instanceId = instanceId;
        // Logger silencioso para produção
        this.logger = pino({ level: process.env.NODE_ENV === 'development' ? 'debug' : 'silent' });
    }

    /**
     * Inicia a conexão WhatsApp
     */
    async connect(): Promise<void> {
        if (this.isConnecting) {
            console.log(`[Baileys ${this.instanceId}] Já está conectando...`);
            return;
        }

        this.isConnecting = true;

        try {
            // Carregar estado de autenticação do Banco de Dados (Hotfix Vercel)
            const { state, saveCreds } = await usePostgresAuthState(this.instanceId);

            // Criar socket
            this.socket = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, this.logger),
                },
                printQRInTerminal: process.env.NODE_ENV === 'development',
                logger: this.logger,
                browser: ['IA Agent', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: true,
            });

            // Configurar event handlers
            this.setupEventHandlers(saveCreds);

            console.log(`[Baileys ${this.instanceId}] Conexão iniciada`);
        } catch (error) {
            this.isConnecting = false;
            console.error(`[Baileys ${this.instanceId}] Erro ao conectar:`, error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Configura os handlers de eventos do socket
     */
    private setupEventHandlers(saveCreds: () => Promise<void>) {
        if (!this.socket) return;

        // Evento: Credenciais atualizadas
        this.socket.ev.on('creds.update', saveCreds);

        // Evento: Atualização de conexão
        this.socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // QR Code gerado
            if (qr) {
                console.log(`[Baileys ${this.instanceId}] QR Code gerado`);
                this.emit('qr', qr);
            }

            // Conexão estabelecida
            if (connection === 'open') {
                this.isConnecting = false;
                this.reconnectAttempts = 0;

                // Extrair informações do perfil
                const phoneNumber = this.socket?.user?.id?.split(':')[0] || '';
                const profileName = this.socket?.user?.name || 'WhatsApp User';

                console.log(`[Baileys ${this.instanceId}] Conectado: ${phoneNumber} (${profileName})`);
                this.emit('connected', { phoneNumber, profileName });
            }

            // Conexão fechada
            if (connection === 'close') {
                this.isConnecting = false;
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                const reason = (lastDisconnect?.error as Boom)?.output?.payload?.message || 'Unknown reason';

                console.log(`[Baileys ${this.instanceId}] Desconectado: ${reason}`);

                if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`[Baileys ${this.instanceId}] Tentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

                    // Espera exponencial antes de reconectar
                    await new Promise(resolve => setTimeout(resolve, 2000 * this.reconnectAttempts));
                    this.connect();
                } else {
                    this.emit('disconnected', reason);

                    // Se foi logout, limpar sessão
                    if ((lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.loggedOut) {
                        await this.clearSession();
                    }
                }
            }
        });

        // Evento: Mensagem recebida
        this.socket.ev.on('messages.upsert', async (event) => {
            for (const message of event.messages) {
                // Ignorar mensagens de broadcast e do próprio bot
                if (message.key.remoteJid?.endsWith('@broadcast') || message.key.fromMe) {
                    continue;
                }

                // Extrair texto da mensagem
                const text = message.message?.conversation ||
                    message.message?.extendedTextMessage?.text ||
                    '';

                if (!text) continue;

                // Extrair informações
                const from = message.key.remoteJid?.replace('@s.whatsapp.net', '') || '';
                const fromName = message.pushName || 'Desconhecido';
                const messageId = message.key.id || '';
                const timestamp = new Date((message.messageTimestamp as number) * 1000);

                console.log(`[Baileys ${this.instanceId}] Mensagem de ${from}: ${text.substring(0, 50)}...`);

                this.emit('message', {
                    from,
                    fromName,
                    text,
                    messageId,
                    timestamp,
                });
            }
        });
    }

    /**
     * Envia uma mensagem de texto
     */
    async sendMessage(to: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
        if (!this.socket) {
            return { success: false, error: 'Socket não conectado' };
        }

        try {
            // Formatar número para JID do WhatsApp
            const safeTo = to ?? '';
            const jid = `${safeTo.replace(/\D/g, '')}@s.whatsapp.net`;

            const result = await this.socket.sendMessage(jid, { text });

            return {
                success: true,
                messageId: result?.key?.id,
            };
        } catch (error) {
            console.error(`[Baileys ${this.instanceId}] Erro ao enviar mensagem:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido',
            };
        }
    }

    /**
     * Marca mensagem como lida
     */
    async markAsRead(messageId: string, from: string): Promise<void> {
        if (!this.socket) return;

        try {
            const jid = `${from.replace(/\D/g, '')}@s.whatsapp.net`;
            await this.socket.readMessages([{ remoteJid: jid, id: messageId }]);
        } catch (error) {
            console.error(`[Baileys ${this.instanceId}] Erro ao marcar como lida:`, error);
        }
    }

    /**
     * Desconecta o socket
     */
    async disconnect(): Promise<void> {
        if (this.socket) {
            await this.socket.logout();
            this.socket = null;
        }
        this.emit('disconnected', 'Manual disconnect');
    }

    /**
     * Limpa a sessão (remove dados do banco)
     */
    async clearSession(): Promise<void> {
        try {
            // Import dinâmico ou mover lógica para helper, 
            // mas como já temos db configurado no projeto:
            const { db } = await import('@/lib/db');
            const { whatsappSessions } = await import('@/db/schema');
            const { eq } = await import('drizzle-orm');

            await db.delete(whatsappSessions)
                .where(eq(whatsappSessions.instanceId, this.instanceId));

            console.log(`[Baileys ${this.instanceId}] Sessão limpa do banco de dados`);
        } catch (error) {
            console.error(`[Baileys ${this.instanceId}] Erro ao limpar sessão:`, error);
        }
    }

    /**
     * Retorna status atual da conexão
     */
    getStatus(): 'disconnected' | 'connecting' | 'connected' {
        if (this.isConnecting) return 'connecting';
        if (this.socket?.user) return 'connected';
        return 'disconnected';
    }

    /**
     * Retorna informações do perfil conectado
     */
    getProfile(): { phoneNumber: string; profileName: string } | null {
        if (!this.socket?.user) return null;

        return {
            phoneNumber: this.socket.user.id?.split(':')[0] || '',
            profileName: this.socket.user.name || 'WhatsApp User',
        };
    }
}
