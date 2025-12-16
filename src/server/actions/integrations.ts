'use server';

import { db } from '@/lib/db';
import { integrations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth'; // Assuming auth helper exists or using getServerSession logic
import { cookies } from 'next/headers'; // Fallback if auth helper is complex

// Note: For now assuming we pass userId, but ideally should come from session
export async function getIntegrationsStatusAction(userId: string) {
    try {
        const googleIntegration = await db.query.integrations.findFirst({
            where: and(
                eq(integrations.userId, userId),
                eq(integrations.provider, 'google')
            )
        });

        const whatsappIntegration = await db.query.integrations.findFirst({
            where: and(
                eq(integrations.userId, userId),
                eq(integrations.provider, 'whatsapp')
            )
        });

        return {
            google: !!googleIntegration,
            whatsapp: !!whatsappIntegration
        };
    } catch (error) {
        console.error('Failed to get integrations status:', error);
        return { google: false, whatsapp: false };
    }
}
