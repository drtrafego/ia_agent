/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHATSAPP QR CODE API - Server-Sent Events para QR Code
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * GET /api/whatsapp/instance/[id]/qr - Stream SSE de QR Codes
 * 
 * Retorna eventos:
 * - qr: { qr: "base64..." } - Novo QR Code gerado
 * - connected: { phoneNumber: "...", profileName: "..." } - Conexão estabelecida
 * - disconnected: { reason: "..." } - Desconexão
 * - error: { message: "..." } - Erro
 */

import { NextRequest } from 'next/server';
import {
    getInstanceStatus,
    startQRConnection,
    instanceEvents,
} from '@/server/services/whatsapp-manager';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

/**
 * GET - Stream SSE de QR Codes e eventos de conexão
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: instanceId } = await params;

    // Verificar autenticação
    const session = await auth();
    if (!session?.user?.id) {
        return new Response('Não autorizado', { status: 401 });
    }

    // Verificar se instância existe
    const instance = await getInstanceStatus(instanceId);
    if (!instance) {
        return new Response('Instância não encontrada', { status: 404 });
    }

    if (instance.connectionType !== 'qr_code') {
        return new Response('Instância não é do tipo QR Code', { status: 400 });
    }

    // Criar stream SSE
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            // Função helper para enviar eventos
            const sendEvent = (event: string, data: unknown) => {
                try {
                    controller.enqueue(
                        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                    );
                } catch (e) {
                    // Stream pode ter sido fechado
                }
            };

            // Se já está conectado, enviar status
            if (instance.status === 'connected') {
                sendEvent('connected', {
                    phoneNumber: instance.phoneNumber,
                    profileName: instance.profileName,
                });
                controller.close();
                return;
            }

            // Se já tem QR Code salvo, enviar
            if (instance.lastQrCode) {
                sendEvent('qr', { qr: instance.lastQrCode });
            }

            // Se não está conectando, iniciar conexão
            if (instance.status === 'disconnected') {
                const result = await startQRConnection(instanceId);
                if (!result.success) {
                    sendEvent('error', { message: result.error });
                    controller.close();
                    return;
                }
            }

            // Listeners para eventos da instância
            const onQR = (qr: string) => sendEvent('qr', { qr });
            const onConnected = (info: { phoneNumber: string; profileName: string }) => {
                sendEvent('connected', info);
                cleanup();
                controller.close();
            };
            const onDisconnected = (reason: string) => {
                sendEvent('disconnected', { reason });
                cleanup();
                controller.close();
            };
            const onError = (error: Error) => {
                sendEvent('error', { message: error.message });
            };

            // Registrar listeners
            instanceEvents.on(`qr:${instanceId}`, onQR);
            instanceEvents.on(`connected:${instanceId}`, onConnected);
            instanceEvents.on(`disconnected:${instanceId}`, onDisconnected);
            instanceEvents.on(`error:${instanceId}`, onError);

            // Cleanup function
            const cleanup = () => {
                instanceEvents.off(`qr:${instanceId}`, onQR);
                instanceEvents.off(`connected:${instanceId}`, onConnected);
                instanceEvents.off(`disconnected:${instanceId}`, onDisconnected);
                instanceEvents.off(`error:${instanceId}`, onError);
            };

            // Timeout de 3 minutos
            setTimeout(() => {
                sendEvent('timeout', { message: 'QR Code expirou. Tente novamente.' });
                cleanup();
                controller.close();
            }, 180000);

            // Heartbeat a cada 30s para manter conexão viva
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch (e) {
                    clearInterval(heartbeat);
                    cleanup();
                }
            }, 30000);

            // Cleanup on abort
            request.signal.addEventListener('abort', () => {
                clearInterval(heartbeat);
                cleanup();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
