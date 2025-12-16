'use server';

import { db } from '@/lib/db';
import { agentStages, agentActions } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function createStageAction(agentId: string, order: number) {
    try {
        const [newStage] = await db.insert(agentStages).values({
            agentId,
            name: 'Novo Estágio',
            type: 'custom',
            order,
            instructions: '',
        }).returning();

        revalidatePath(`/dashboard/agents/${agentId}/builder`);
        return { success: true, stage: newStage };
    } catch (error) {
        console.error('Failed to create stage:', error);
        return { success: false, error: 'Failed to create stage' };
    }
}

export async function updateStageAction(id: string, agentId: string, data: Partial<typeof agentStages.$inferInsert>) {
    try {
        await db.update(agentStages)
            .set(data)
            .where(eq(agentStages.id, id));

        revalidatePath(`/dashboard/agents/${agentId}/builder`);
        return { success: true };
    } catch (error) {
        console.error('Failed to update stage:', error);
        return { success: false, error: 'Failed to update stage' };
    }
}

export async function deleteStageAction(id: string, agentId: string) {
    try {
        await db.delete(agentStages).where(eq(agentStages.id, id));
        revalidatePath(`/dashboard/agents/${agentId}/builder`);
        return { success: true };
    } catch (error) {
        console.error('Failed to delete stage:', error);
        return { success: false, error: 'Failed to delete stage' };
    }
}

export async function reorderStagesAction(agentId: string, stages: { id: string; order: number }[]) {
    try {
        // Transaction to update orders
        await db.transaction(async (tx) => {
            for (const stage of stages) {
                await tx.update(agentStages)
                    .set({ order: stage.order })
                    .where(eq(agentStages.id, stage.id));
            }
        });

        revalidatePath(`/dashboard/agents/${agentId}/builder`);
        return { success: true };
    } catch (error) {
        console.error('Failed to reorder stages:', error);
        return { success: false, error: 'Failed to reorder stages' };
    }
}
