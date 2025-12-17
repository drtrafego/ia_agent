/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE OAUTH2 - Iniciar fluxo de autenticação
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const REDIRECT_URI = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/api/auth/google/callback`
    : 'http://localhost:3000/api/auth/google/callback';

const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
].join(' ');

export async function GET() {
    if (!GOOGLE_CLIENT_ID) {
        return NextResponse.json(
            { error: 'GOOGLE_CLIENT_ID não configurado' },
            { status: 500 }
        );
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    // Retornar a URL como JSON para o frontend fazer o redirect
    return NextResponse.json({ authUrl: authUrl.toString() });
}
