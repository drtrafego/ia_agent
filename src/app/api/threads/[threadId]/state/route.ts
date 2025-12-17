import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { threads, sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/threads/[threadId]/state
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Retorna o estado completo de uma thread para exibição no debug:
 * - Estágio atual
 * - Variáveis coletadas
 * - Histórico de estágios
 * - Configuração dos estágios do agente
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: { threadId: string } }
) {
    try {
        const { threadId } = params;

        // Buscar thread
        const thread = await db.query.threads.findFirst({
            where: eq(threads.id, threadId),
            with: {
                agent: {
                    columns: {
                        id: true,
                        name: true,
                        workflowConfig: true,
                    },
                },
            },
        });

        if (!thread) {
            return NextResponse.json(
                { error: 'Thread não encontrada' },
                { status: 404 }
            );
        }

        // Buscar sessão/estado
        const session = await db.query.sessions.findFirst({
            where: eq(sessions.threadId, threadId),
        });

        // Retornar estado completo
        return NextResponse.json({
            threadId,
            currentStageId: session?.currentStageId || null,
            previousStageId: session?.previousStageId || null,
            variables: session?.variables || {},
            stageHistory: session?.stageHistory || [],
            stages: thread.agent?.workflowConfig || [],
            agentName: thread.agent?.name || 'N/A',
        });
    } catch (error) {
        console.error('[ThreadState] Error:', error);
        return NextResponse.json(
            { error: 'Erro ao buscar estado da thread' },
            { status: 500 }
        );
    }
}
