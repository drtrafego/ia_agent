/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHATSAPP SEND MESSAGE API
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * POST /api/whatsapp/send - Enviar mensagem via instância WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendMessage } from '@/server/services/whatsapp-manager';
import { auth } from '@/auth';

/**
 * POST - Enviar mensagem
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { instanceId, to, message } = body;

        if (!instanceId) {
            return NextResponse.json({ error: 'instanceId é obrigatório' }, { status: 400 });
        }

        if (!to) {
            return NextResponse.json({ error: 'to (número de destino) é obrigatório' }, { status: 400 });
        }

        if (!message) {
            return NextResponse.json({ error: 'message é obrigatório' }, { status: 400 });
        }

        const result = await sendMessage(instanceId, to, message);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            messageId: result.messageId,
        });
    } catch (error) {
        console.error('[API WhatsApp Send] Erro:', error);
        return NextResponse.json({
            error: 'Erro interno do servidor'
        }, { status: 500 });
    }
}
