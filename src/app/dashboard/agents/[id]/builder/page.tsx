import { db } from '@/lib/db';
import { agents, agentStages, knowledgeBase } from '@/db/schema';
import { eq, asc, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ClientBuilderWrapper } from './client-wrapper';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function BuilderPage({ params }: Props) {
    const { id } = await params;

    // 1. Fetch Agent
    const agent = await db.query.agents.findFirst({
        where: eq(agents.id, id),
    });

    if (!agent) {
        notFound();
    }

    // 2. Fetch Stages with Actions
    const stages = await db.query.agentStages.findMany({
        where: eq(agentStages.agentId, id),
        orderBy: asc(agentStages.order),
        with: {
            actions: {
                orderBy: (actions, { asc }) => [asc(actions.order)],
            },
        },
    });

    // 3. Fetch Knowledge Base
    const kbItems = await db.query.knowledgeBase.findMany({
        where: eq(knowledgeBase.agentId, id),
        orderBy: desc(knowledgeBase.createdAt),
    });

    return <ClientBuilderWrapper agent={agent} stages={stages} knowledgeBase={kbItems} />;
}
