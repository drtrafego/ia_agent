/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHATSAPP INSTANCE MANAGER - Gerenciador de Instâncias WhatsApp
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Gerencia múltiplas instâncias de conexão WhatsApp.
 * Suporta tanto API Oficial (Meta) quanto conexão via QR Code (Baileys).
 * 
 * Singleton pattern para manter conexões ativas entre requests.
 */

import { db } from '@/lib/db';
import { whatsappInstances, agents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { BaileysService } from './baileys.service';
import { sendWhatsAppMessage as sendMetaMessage } from './meta-whatsapp.service';
import { encryptCredential, decryptCredential } from '@/lib/security';
import { EventEmitter } from 'events';

// Tipos
export type ConnectionType = 'api_oficial' | 'qr_code';
export type InstanceStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface InstanceInfo {
    id: string;
    agentId: string;
    connectionType: ConnectionType;
    status: InstanceStatus;
    phoneNumber?: string;
    profileName?: string;
    lastQrCode?: string;
    errorMessage?: string;
}

// Cache de instâncias Baileys em memória
const baileysInstances = new Map<string, BaileysService>();

// Event emitter global para broadcasting de eventos
export const instanceEvents = new EventEmitter();

/**
 * Cria uma nova instância WhatsApp para um agente
 */
export async function createWhatsAppInstance(
    agentId: string,
    connectionType: ConnectionType
): Promise<{ success: boolean; instanceId?: string; error?: string }> {
    try {
        // Verificar se agente existe
        const agent = await db.query.agents.findFirst({
            where: eq(agents.id, agentId),
        });

        if (!agent) {
            return { success: false, error: 'Agente não encontrado' };
        }

        // Verificar se já existe instância para este agente
        const existing = await db.query.whatsappInstances.findFirst({
            where: eq(whatsappInstances.agentId, agentId),
        });

        if (existing) {
            // Atualizar tipo de conexão se diferente
            if (existing.connectionType !== connectionType) {
                await db.update(whatsappInstances)
                    .set({
                        connectionType,
                        status: 'disconnected',
                        updatedAt: new Date(),
                    })
                    .where(eq(whatsappInstances.id, existing.id));
            }
            return { success: true, instanceId: existing.id };
        }

        // Criar nova instância
        const [newInstance] = await db.insert(whatsappInstances)
            .values({
                agentId,
                connectionType,
                status: 'disconnected',
            })
            .returning();

        console.log(`[WhatsApp Manager] Instância criada: ${newInstance.id} para agente ${agentId}`);

        return { success: true, instanceId: newInstance.id };
    } catch (error) {
        console.error('[WhatsApp Manager] Erro ao criar instância:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
    }
}

/**
 * Inicia conexão via QR Code (Baileys)
 * Retorna um EventEmitter que emite eventos de QR e status
 */
export async function startQRConnection(instanceId: string): Promise<{
    success: boolean;
    events?: EventEmitter;
    error?: string;
}> {
    try {
        // Buscar instância
        const instance = await db.query.whatsappInstances.findFirst({
            where: eq(whatsappInstances.id, instanceId),
        });

        if (!instance) {
            return { success: false, error: 'Instância não encontrada' };
        }

        if (instance.connectionType !== 'qr_code') {
            return { success: false, error: 'Instância não é do tipo QR Code' };
        }

        // Verificar se já existe conexão ativa
        let baileys = baileysInstances.get(instanceId);

        if (baileys && baileys.getStatus() === 'connected') {
            return { success: false, error: 'Já conectado' };
        }

        // Criar nova instância Baileys
        baileys = new BaileysService(instanceId);
        baileysInstances.set(instanceId, baileys);

        // Event emitter para esta conexão específica
        const events = new EventEmitter();

        // Configurar handlers
        baileys.on('qr', async (qr) => {
            // Atualizar no banco
            await db.update(whatsappInstances)
                .set({
                    status: 'connecting',
                    lastQrCode: qr,
                    qrGeneratedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(whatsappInstances.id, instanceId));

            events.emit('qr', qr);
            instanceEvents.emit(`qr:${instanceId}`, qr);
        });

        baileys.on('connected', async (info) => {
            await db.update(whatsappInstances)
                .set({
                    status: 'connected',
                    phoneNumber: info.phoneNumber,
                    profileName: info.profileName,
                    lastConnectedAt: new Date(),
                    lastQrCode: null,
                    errorMessage: null,
                    updatedAt: new Date(),
                })
                .where(eq(whatsappInstances.id, instanceId));

            events.emit('connected', info);
            instanceEvents.emit(`connected:${instanceId}`, info);
        });

        baileys.on('disconnected', async (reason) => {
            await db.update(whatsappInstances)
                .set({
                    status: 'disconnected',
                    errorMessage: reason,
                    updatedAt: new Date(),
                })
                .where(eq(whatsappInstances.id, instanceId));

            events.emit('disconnected', reason);
            instanceEvents.emit(`disconnected:${instanceId}`, reason);

            baileysInstances.delete(instanceId);
        });

        baileys.on('error', async (error) => {
            await db.update(whatsappInstances)
                .set({
                    status: 'error',
                    errorMessage: error.message,
                    updatedAt: new Date(),
                })
                .where(eq(whatsappInstances.id, instanceId));

            events.emit('error', error);
            instanceEvents.emit(`error:${instanceId}`, error);
        });

        baileys.on('message', async (message) => {
            // Emitir evento de mensagem para processamento pelo webhook
            events.emit('message', message);
            instanceEvents.emit(`message:${instanceId}`, message);
        });

        // Iniciar conexão
        await baileys.connect();

        return { success: true, events };
    } catch (error) {
        console.error('[WhatsApp Manager] Erro ao iniciar QR:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
    }
}

/**
 * Configura credenciais da API Oficial
 */
export async function configureAPIOficial(
    instanceId: string,
    credentials: {
        token: string;
        phoneNumberId: string;
        businessAccountId?: string;
        appSecret?: string;
        verifyToken?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const instance = await db.query.whatsappInstances.findFirst({
            where: eq(whatsappInstances.id, instanceId),
        });

        if (!instance) {
            return { success: false, error: 'Instância não encontrada' };
        }

        if (instance.connectionType !== 'api_oficial') {
            return { success: false, error: 'Instância não é do tipo API Oficial' };
        }

        // Criptografar credenciais
        const encryptedCredentials = encryptCredential(JSON.stringify(credentials));

        await db.update(whatsappInstances)
            .set({
                credentials: encryptedCredentials,
                status: 'connected', // API Oficial está sempre "conectada" quando configurada
                updatedAt: new Date(),
            })
            .where(eq(whatsappInstances.id, instanceId));

        return { success: true };
    } catch (error) {
        console.error('[WhatsApp Manager] Erro ao configurar API Oficial:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
    }
}

/**
 * Envia mensagem via instância WhatsApp
 */
export async function sendMessage(
    instanceId: string,
    to: string,
    message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const instance = await db.query.whatsappInstances.findFirst({
            where: eq(whatsappInstances.id, instanceId),
        });

        if (!instance) {
            return { success: false, error: 'Instância não encontrada' };
        }

        if (instance.status !== 'connected') {
            return { success: false, error: 'Instância não está conectada' };
        }

        if (instance.connectionType === 'qr_code') {
            // Usar Baileys
            const baileys = baileysInstances.get(instanceId);
            if (!baileys) {
                return { success: false, error: 'Sessão Baileys não encontrada' };
            }
            return await baileys.sendMessage(to, message);
        } else {
            // Usar API Oficial
            if (!instance.credentials) {
                return { success: false, error: 'Credenciais não configuradas' };
            }

            const credentials = JSON.parse(decryptCredential(instance.credentials));

            // Usar a função existente de meta-whatsapp.service
            // Note: Precisamos adaptar para usar as credenciais da instância
            return await sendMetaMessage({ to, message });
        }
    } catch (error) {
        console.error('[WhatsApp Manager] Erro ao enviar mensagem:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
    }
}

/**
 * Desconecta uma instância
 */
export async function disconnectInstance(instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const instance = await db.query.whatsappInstances.findFirst({
            where: eq(whatsappInstances.id, instanceId),
        });

        if (!instance) {
            return { success: false, error: 'Instância não encontrada' };
        }

        if (instance.connectionType === 'qr_code') {
            const baileys = baileysInstances.get(instanceId);
            if (baileys) {
                await baileys.disconnect();
                baileysInstances.delete(instanceId);
            }
        }

        await db.update(whatsappInstances)
            .set({
                status: 'disconnected',
                lastQrCode: null,
                updatedAt: new Date(),
            })
            .where(eq(whatsappInstances.id, instanceId));

        return { success: true };
    } catch (error) {
        console.error('[WhatsApp Manager] Erro ao desconectar:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
    }
}

/**
 * Obtém status de uma instância
 */
export async function getInstanceStatus(instanceId: string): Promise<InstanceInfo | null> {
    try {
        const instance = await db.query.whatsappInstances.findFirst({
            where: eq(whatsappInstances.id, instanceId),
        });

        if (!instance) return null;

        // Para instâncias QR Code, verificar status em tempo real
        let status = instance.status as InstanceStatus;
        if (instance.connectionType === 'qr_code') {
            const baileys = baileysInstances.get(instanceId);
            if (baileys) {
                status = baileys.getStatus();
            }
        }

        return {
            id: instance.id,
            agentId: instance.agentId,
            connectionType: instance.connectionType as ConnectionType,
            status,
            phoneNumber: instance.phoneNumber || undefined,
            profileName: instance.profileName || undefined,
            lastQrCode: instance.lastQrCode || undefined,
            errorMessage: instance.errorMessage || undefined,
        };
    } catch (error) {
        console.error('[WhatsApp Manager] Erro ao buscar status:', error);
        return null;
    }
}

/**
 * Obtém instância por agentId
 */
export async function getInstanceByAgentId(agentId: string): Promise<InstanceInfo | null> {
    try {
        const instance = await db.query.whatsappInstances.findFirst({
            where: eq(whatsappInstances.agentId, agentId),
        });

        if (!instance) return null;

        return getInstanceStatus(instance.id);
    } catch (error) {
        console.error('[WhatsApp Manager] Erro ao buscar por agentId:', error);
        return null;
    }
}

/**
 * Deleta uma instância
 */
export async function deleteInstance(instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Desconectar primeiro
        await disconnectInstance(instanceId);

        // Deletar do banco
        await db.delete(whatsappInstances)
            .where(eq(whatsappInstances.id, instanceId));

        return { success: true };
    } catch (error) {
        console.error('[WhatsApp Manager] Erro ao deletar instância:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
    }
}
