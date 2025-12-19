/**
 * GET /api/integrations/status - Retorna status das integrações
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { integrations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';

export async function GET() {
    try {
        // Buscar QUALQUER integração Google ativa (não apenas do DEFAULT_USER_ID)
        // Isso garante que se a integração foi salva com outro userId, ainda será encontrada
        const googleIntegration = await db.query.integrations.findFirst({
            where: and(
                eq(integrations.provider, 'google'),
                eq(integrations.isActive, true)
            )
        });

        let googleEmail: string | undefined;
        if (googleIntegration?.credentials) {
            try {
                const creds = JSON.parse(googleIntegration.credentials);
                googleEmail = creds.email;
            } catch {
                // Ignore parse errors
            }
        }

        // Buscar integração WhatsApp
        const whatsappIntegration = await db.query.integrations.findFirst({
            where: and(
                eq(integrations.userId, DEFAULT_USER_ID),
                eq(integrations.provider, 'whatsapp'),
                eq(integrations.isActive, true)
            )
        });

        return NextResponse.json({
            userId: DEFAULT_USER_ID,
            google: {
                connected: !!googleIntegration,
                email: googleEmail,
                id: googleIntegration?.id,
            },
            whatsapp: {
                connected: !!whatsappIntegration,
                id: whatsappIntegration?.id,
            },
        });
    } catch (error) {
        console.error('[API Integrations Status] Error:', error);
        return NextResponse.json({
            google: { connected: false },
            whatsapp: { connected: false },
        });
    }
}
