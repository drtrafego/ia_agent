'use server';

import { db } from '@/lib/db';
import { knowledgeBase } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { BrainService } from '@/lib/ai/brain';

const brain = new BrainService();

export async function addKnowledgeAction(agentId: string, data: {
    topic: string;
    content: string;
    contentType: 'text' | 'faq';
}) {
    try {
        await brain.addKnowledge(agentId, data);
        revalidatePath(`/dashboard/agents/${agentId}/builder`);
        return { success: true };
    } catch (error) {
        console.error('Failed to add knowledge:', error);
        return { success: false, error: 'Failed to add knowledge' };
    }
}

export async function removeKnowledgeAction(id: string, agentId: string) {
    try {
        await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
        revalidatePath(`/dashboard/agents/${agentId}/builder`);
        return { success: true };
    } catch (error) {
        console.error('Failed to remove knowledge:', error);
        return { success: false, error: 'Failed to remove knowledge' };
    }
}
