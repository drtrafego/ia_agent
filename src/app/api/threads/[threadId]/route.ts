import { NextRequest, NextResponse } from 'next/server';
import { getThreadWithMessages } from '@/server/queries/thread.queries';

/**
 * GET /api/threads/[threadId] - Buscar thread com mensagens
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ threadId: string }> }
) {
    try {
        const { threadId } = await params;

        if (!threadId) {
            return NextResponse.json(
                { error: 'Thread ID é obrigatório' },
                { status: 400 }
            );
        }

        const thread = await getThreadWithMessages(threadId);

        if (!thread) {
            return NextResponse.json(
                { error: 'Conversa não encontrada' },
                { status: 404 }
            );
        }

        // Formatar para a UI
        const formattedThread = {
            id: thread.id,
            contactName: thread.contactName || 'Desconhecido',
            contactPhone: thread.externalId || '',
            contactEmail: thread.contactEmail || null,
            status: thread.status || 'active',
            isHumanTakeover: thread.isHumanTakeover || false,
            takeoverReason: thread.takeoverReason || null,
            messageCount: thread.messageCount || thread.messages.length,
            currentStage: thread.currentStageId || 'Atendimento',
            firstInteractionAt: thread.firstInteractionAt?.toISOString() || new Date().toISOString(),
            lastInteractionAt: thread.lastInteractionAt?.toISOString() || new Date().toISOString(),
            variables: thread.variables || {},
            messages: thread.messages.map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                createdAt: msg.createdAt?.toISOString() || new Date().toISOString(),
            })),
        };

        return NextResponse.json(formattedThread);
    } catch (error) {
        console.error('[API] Erro ao buscar thread:', error);
        return NextResponse.json(
            { error: 'Erro ao carregar conversa' },
            { status: 500 }
        );
    }
}
