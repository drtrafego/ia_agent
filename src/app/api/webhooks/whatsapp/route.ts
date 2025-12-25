/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHATSAPP WEBHOOK - Endpoint principal para receber mensagens
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Rota: /api/webhooks/whatsapp
 * 
 * Este webhook recebe mensagens da Meta API e processa com o agente de IA.
 * 
 * Fluxo:
 * 1. Validação do Webhook (assinatura)
 * 2. Identificação/Criação da Thread
 * 3. Carregamento de Contexto (últimas mensagens)
 * 4. RAG - Injeção de Knowledge Base
 * 5. Processamento com IA (generateText + tools)
 * 6. Persistência da resposta
 * 7. Envio para WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    verifyWebhookSignature,
    extractMessagesFromPayload,
    sendWhatsAppMessage,
    markMessageAsRead,
    isWebhookVerification,
    handleWebhookVerification,
    type WhatsAppWebhookPayload,
} from '@/server/services/meta-whatsapp.service';
import { getOrCreateThreadAction } from '@/server/actions/thread.actions';
import { getDefaultAgent } from '@/server/queries/agent.queries';
import { StageMachine } from '@/server/engine/stage-machine';
import { FALLBACK_RESPONSE } from '@/lib/ai';

// ID do usuário padrão (em produção, seria dinâmico baseado no número de telefone)
// TODO: Implementar multi-tenancy
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000000';

// Instância do StageMachine (mesma usada pelo frontend)
const stageMachine = new StageMachine();

/**
 * GET - Verificação do Webhook (Challenge)
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    if (isWebhookVerification(searchParams)) {
        const result = handleWebhookVerification(searchParams);

        if (result.verified) {
            console.log('[Webhook] Verificação bem-sucedida');
            return new NextResponse(result.challenge, { status: 200 });
        }

        console.error('[Webhook] Verificação falhou');
        return new NextResponse('Forbidden', { status: 403 });
    }

    return new NextResponse('OK', { status: 200 });
}

/**
 * POST - Receber mensagens
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // 1. Ler e validar payload
        const rawBody = await request.text();
        const signature = request.headers.get('x-hub-signature-256');

        // Validar assinatura (desabilitar em desenvolvimento se necessário)
        if (process.env.NODE_ENV === 'production' && signature) {
            if (!verifyWebhookSignature(rawBody, signature)) {
                console.error('[Webhook] Assinatura inválida');
                return new NextResponse('Unauthorized', { status: 401 });
            }
        }

        const payload: WhatsAppWebhookPayload = JSON.parse(rawBody);

        // 2. Extrair mensagens de texto
        const incomingMessages = extractMessagesFromPayload(payload);

        if (incomingMessages.length === 0) {
            // Pode ser um status update ou outro tipo de evento
            return new NextResponse('OK', { status: 200 });
        }

        // Processar cada mensagem (normalmente só uma por request)
        for (const incoming of incomingMessages) {
            await processIncomingMessage(incoming);
        }

        console.log(`[Webhook] Processado em ${Date.now() - startTime}ms`);
        return new NextResponse('OK', { status: 200 });

    } catch (error) {
        console.error('[Webhook] Erro:', error);
        // Retornar 200 para evitar retry infinito da Meta
        return new NextResponse('OK', { status: 200 });
    }
}

/**
 * Processa uma mensagem individual
 */
async function processIncomingMessage(message: {
    from: string;
    fromName: string;
    messageId: string;
    timestamp: Date;
    text: string;
}) {
    const { from, fromName, messageId, text } = message;

    console.log(`[Webhook] Mensagem de ${from}: ${text.substring(0, 50)}...`);

    try {
        // 1. Buscar agente padrão
        const agent = await getDefaultAgent(DEFAULT_USER_ID);

        if (!agent) {
            console.error('[Webhook] Nenhum agente configurado');
            await sendWhatsAppMessage({
                to: from,
                message: 'Desculpe, nosso assistente está temporariamente indisponível. Tente novamente mais tarde.',
            });
            return;
        }

        // 2. Criar/buscar thread
        const threadResult = await getOrCreateThreadAction(
            DEFAULT_USER_ID,
            agent.id,
            from,
            fromName
        );

        if (!threadResult.success || !threadResult.thread) {
            console.error('[Webhook] Erro ao criar thread');
            return;
        }

        const thread = threadResult.thread;

        // 3. Marcar como lida
        await markMessageAsRead(messageId);

        // ═══════════════════════════════════════════════════════════════════
        // IMPORTANTE: Usar StageMachine para processar a mensagem
        // Isso garante mesma lógica do frontend:
        // - Extração de variáveis (nome, email, data, hora)
        // - Cérebro/RAG
        // - Agendamento estruturado
        // - Persistência automática de mensagens
        // ═══════════════════════════════════════════════════════════════════

        console.log(`[Webhook] Usando StageMachine para processar mensagem`);

        const responseText = await stageMachine.processMessage(
            DEFAULT_USER_ID,
            agent.id,
            thread.id,
            text
        );

        // 4. Enviar resposta para WhatsApp
        const sendResult = await sendWhatsAppMessage({
            to: from,
            message: responseText,
        });

        if (!sendResult.success) {
            console.error('[Webhook] Erro ao enviar resposta:', sendResult.error);
        }

    } catch (error) {
        console.error('[Webhook] Erro no processamento:', error);

        // Tentar enviar mensagem de fallback
        await sendWhatsAppMessage({
            to: from,
            message: FALLBACK_RESPONSE,
        });
    }
}
