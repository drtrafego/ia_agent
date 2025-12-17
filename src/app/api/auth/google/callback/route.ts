/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE OAUTH2 CALLBACK - Receber código e trocar por tokens
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { integrations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/api/auth/google/callback`
    : 'http://localhost:3000/api/auth/google/callback';

// Base URL for redirects
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// TODO: Obter do contexto de auth real
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';

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
