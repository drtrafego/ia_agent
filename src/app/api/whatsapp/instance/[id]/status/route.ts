/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHATSAPP STATUS API - Status e desconexão de instância
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * GET /api/whatsapp/instance/[id]/status - Obter status
 * DELETE /api/whatsapp/instance/[id]/status - Desconectar instância
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getInstanceStatus,
    disconnectInstance,
    deleteInstance,
} from '@/server/services/whatsapp-manager';
import { auth } from '@/auth';

/**
 * GET - Obter status da instância
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { id: instanceId } = await params;

        const instance = await getInstanceStatus(instanceId);

        if (!instance) {
            return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            instance,
        });
    } catch (error) {
        console.error('[API WhatsApp Status] Erro:', error);
        return NextResponse.json({
            error: 'Erro interno do servidor'
        }, { status: 500 });
    }
}

/**
 * POST - Desconectar instância (mantém configuração)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { id: instanceId } = await params;

        const result = await disconnectInstance(instanceId);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Instância desconectada',
        });
    } catch (error) {
        console.error('[API WhatsApp Status] Erro ao desconectar:', error);
        return NextResponse.json({
            error: 'Erro interno do servidor'
        }, { status: 500 });
    }
}

/**
 * DELETE - Deletar instância completamente
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { id: instanceId } = await params;

        const result = await deleteInstance(instanceId);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Instância deletada',
        });
    } catch (error) {
        console.error('[API WhatsApp Status] Erro ao deletar:', error);
        return NextResponse.json({
            error: 'Erro interno do servidor'
        }, { status: 500 });
    }
}
