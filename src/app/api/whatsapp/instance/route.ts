/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHATSAPP INSTANCE API - Criar/Listar instâncias
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * POST /api/whatsapp/instance - Criar nova instância
 * GET /api/whatsapp/instance - Listar instâncias do agente
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    createWhatsAppInstance,
    getInstanceByAgentId,
    startQRConnection,
    configureAPIOficial,
} from '@/server/services/whatsapp-manager';
import { auth } from '@/auth';

/**
 * POST - Criar ou atualizar instância WhatsApp para um agente
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { agentId, connectionType, credentials } = body;

        if (!agentId) {
            return NextResponse.json({ error: 'agentId é obrigatório' }, { status: 400 });
        }

        if (!connectionType || !['api_oficial', 'qr_code'].includes(connectionType)) {
            return NextResponse.json({
                error: 'connectionType deve ser "api_oficial" ou "qr_code"'
            }, { status: 400 });
        }

        // Criar instância
        const result = await createWhatsAppInstance(agentId, connectionType);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        // Se for API Oficial e tiver credenciais, configurar
        if (connectionType === 'api_oficial' && credentials) {
            const configResult = await configureAPIOficial(result.instanceId!, credentials);
            if (!configResult.success) {
                return NextResponse.json({ error: configResult.error }, { status: 400 });
            }
        }

        // Se for QR Code, iniciar conexão automaticamente
        if (connectionType === 'qr_code') {
            const qrResult = await startQRConnection(result.instanceId!);
            if (!qrResult.success) {
                return NextResponse.json({
                    error: qrResult.error,
                    instanceId: result.instanceId
                }, { status: 400 });
            }
        }

        return NextResponse.json({
            success: true,
            instanceId: result.instanceId,
        });
    } catch (error) {
        console.error('[API WhatsApp Instance] Erro:', error);
        return NextResponse.json({
            error: 'Erro interno do servidor'
        }, { status: 500 });
    }
}

/**
 * GET - Obter instância WhatsApp de um agente
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const agentId = searchParams.get('agentId');

        if (!agentId) {
            return NextResponse.json({ error: 'agentId é obrigatório' }, { status: 400 });
        }

        const instance = await getInstanceByAgentId(agentId);

        return NextResponse.json({
            success: true,
            instance,
        });
    } catch (error) {
        console.error('[API WhatsApp Instance] Erro:', error);
        return NextResponse.json({
            error: 'Erro interno do servidor'
        }, { status: 500 });
    }
}
