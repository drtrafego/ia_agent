/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE OAUTH2 CALLBACK - Receber código e trocar por tokens
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { integrations, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/api/auth/google/callback`
    : 'http://localhost:3000/api/auth/google/callback';

// Base URL for redirects
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// User ID for Google integrations - use a REAL UUID, not the demo pattern
// This ID should be a legitimate user or a dedicated "system" user
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

/**
 * Ensures the default user exists in the database
 * This prevents FK violation when creating integrations
 */
async function ensureDefaultUserExists(userId: string, email?: string): Promise<void> {
    try {
        // Check if user already exists by ID
        const existingUser = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });

        if (!existingUser) {
            // Use unique email based on userId to avoid conflicts
            const uniqueEmail = email || `system-${userId.substring(0, 8)}@sistema.local`;

            await db.insert(users).values({
                id: userId,
                name: 'Sistema',
                email: uniqueEmail,
            }).onConflictDoNothing(); // Ignore if already exists

            console.log('[OAuth2] Created/verified user:', userId);
        }
    } catch (error: any) {
        // If still conflicts, just log and continue - user might already exist
        console.log('[OAuth2] User already exists or conflict, continuing:', userId);
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=access_denied`);
    }

    if (!code) {
        return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=no_code`);
    }

    try {
        // Trocar código por tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('[OAuth2] Token exchange failed:', errorData);
            return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=token_exchange`);
        }

        const tokens = await tokenResponse.json();

        // Buscar info do usuário Google
        const userInfoResponse = await fetch(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
            }
        );
        const userInfo = userInfoResponse.ok ? await userInfoResponse.json() : {};

        // Criptografar tokens (em produção, use AES-256-GCM)
        const encryptedCredentials = JSON.stringify({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
            email: userInfo.email,
        });

        // Garantir que o usuário existe antes de criar integração (previne FK violation)
        await ensureDefaultUserExists(DEFAULT_USER_ID, userInfo.email);

        // Salvar ou atualizar integração
        const existingIntegration = await db.query.integrations.findFirst({
            where: and(
                eq(integrations.userId, DEFAULT_USER_ID),
                eq(integrations.provider, 'google')
            ),
        });

        if (existingIntegration) {
            await db.update(integrations)
                .set({
                    credentials: encryptedCredentials,
                    isActive: true,
                    updatedAt: new Date(),
                })
                .where(eq(integrations.id, existingIntegration.id));
        } else {
            await db.insert(integrations).values({
                userId: DEFAULT_USER_ID,
                provider: 'google',
                credentials: encryptedCredentials,
                isActive: true,
                config: {
                    email: userInfo.email,
                    calendarId: 'primary',
                },
            });
        }

        return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?success=google_connected`);
    } catch (error) {
        console.error('[OAuth2] Exception:', error);
        return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=exception`);
    }
}
