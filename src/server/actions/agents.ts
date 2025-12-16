'use server';

import { db } from '@/lib/db';
import { agents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateAgentAction(id: string, data: Partial<typeof agents.$inferInsert>) {
    try {
        await db.update(agents)
            .set(data)
            .where(eq(agents.id, id));

        revalidatePath(`/dashboard/agents/${id}/builder`);
        return { success: true };
    } catch (error) {
        console.error('Failed to update agent:', error);
        return { success: false, error: 'Failed to update agent' };
    }
}
