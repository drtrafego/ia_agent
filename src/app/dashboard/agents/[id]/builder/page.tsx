import { db } from '@/lib/db';
import { agents, agentStages, knowledgeBase } from '@/db/schema';
import { eq, asc, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ClientBuilderWrapper } from './client-wrapper';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function BuilderPage({ params }: Props) {
    try {
        const { id } = await params;

        // 1. Fetch Agent
        const agent = await db.query.agents.findFirst({
            where: eq(agents.id, id),
        });

        if (!agent) {
            notFound();
        }

        // 2. Fetch Stages with Actions (with try-catch for new table)
        let stages: Awaited<ReturnType<typeof db.query.agentStages.findMany>> = [];
        try {
            stages = await db.query.agentStages.findMany({
                where: eq(agentStages.agentId, id),
                orderBy: asc(agentStages.order),
                with: {
                    actions: {
                        orderBy: (actions: any, { asc }: any) => [asc(actions.order)],
                    },
                },
            });
        } catch (stagesError) {
            console.error('[Builder] Error fetching stages:', stagesError);
            // Continue with empty stages if table doesn't exist yet
        }

        // 3. Fetch Knowledge Base
        let kbItems: Awaited<ReturnType<typeof db.query.knowledgeBase.findMany>> = [];
        try {
            kbItems = await db.query.knowledgeBase.findMany({
                where: eq(knowledgeBase.agentId, id),
                orderBy: desc(knowledgeBase.createdAt),
            });
        } catch (kbError) {
            console.error('[Builder] Error fetching knowledge base:', kbError);
            // Continue with empty kb if fails
        }

        return <ClientBuilderWrapper agent={agent} stages={stages} knowledgeBase={kbItems} />;
    } catch (error) {
        console.error('[Builder] Critical error:', error);
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-600">Erro ao carregar o Builder</h1>
                <p className="text-gray-600 mt-2">Por favor, verifique os logs do servidor.</p>
                <pre className="mt-4 p-4 bg-red-50 text-red-800 text-left text-sm rounded max-w-2xl mx-auto overflow-auto">
                    {error instanceof Error ? error.message : 'Erro desconhecido'}
                </pre>
            </div>
        );
    }
}
