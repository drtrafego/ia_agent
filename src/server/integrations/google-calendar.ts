import { google } from 'googleapis';
import { db } from '@/lib/db';
import { integrations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { decryptCredential } from '@/lib/security';

export class GoogleCalendarService {
    private oauth2Client;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`
        );
    }

    /**
     * Autentica o cliente com as credenciais do usuário
     */
    private async authenticate(userId: string) {
        const integration = await db.query.integrations.findFirst({
            where: and(
                eq(integrations.userId, userId),
                eq(integrations.provider, 'google')
            ),
        });

        if (!integration) {
            throw new Error('Google Integration not found for user');
        }

        // Tentar parsear credenciais (podem ser encrypted ou plain JSON)
        let credentials;
        try {
            // Primeiro tenta como JSON puro (formato atual)
            credentials = JSON.parse(integration.credentials);
        } catch {
            // Se falhar, tenta decriptar (formato futuro seguro)
            try {
                credentials = JSON.parse(decryptCredential(integration.credentials));
            } catch (decryptError) {
                console.error('[GoogleCalendar] Erro ao decriptar credenciais:', decryptError);
                throw new Error('Falha ao processar credenciais do Google');
            }
        }

        this.oauth2Client.setCredentials({
            access_token: credentials.accessToken,
            refresh_token: credentials.refreshToken,
            expiry_date: credentials.expiryDate,
        });

        return this.oauth2Client;
    }

    /**
     * Lista horários disponíveis (Freebusy)
     */
    async listAvailableSlots(userId: string, config: {
        timeMin: Date;
        timeMax: Date;
        durationMinutes: number;
        workHoursStart?: number; // 9 = 09:00
        workHoursEnd?: number;   // 18 = 18:00
    }) {
        const auth = await this.authenticate(userId);
        const calendar = google.calendar({ version: 'v3', auth });

        // 1. Buscar FreeBusy
        const response = await calendar.freebusy.query({
            requestBody: {
                timeMin: config.timeMin.toISOString(),
                timeMax: config.timeMax.toISOString(),
                items: [{ id: 'primary' }],
            },
        });

        const busySlots = response.data.calendars?.['primary']?.busy || [];

        // 2. Calcular slots livres (Lógica simplificada)
        // Aqui você implementaria a lógica de subtrair busySlots do horário comercial
        // Para simplificar neste primeiro passo, retornamos o raw busy data 
        // A IA pode processar isso ou podemos adicionar a lógica matemática depois

        return {
            busy: busySlots,
            config
        };
    }

    /**
     * Cria um evento no calendário
     */
    async createEvent(userId: string, eventData: {
        summary: string;
        description?: string;
        start: Date;
        end: Date;
        attendeeEmail?: string;
    }) {
        const auth = await this.authenticate(userId);
        const calendar = google.calendar({ version: 'v3', auth });

        const event = {
            summary: eventData.summary,
            description: eventData.description,
            start: {
                dateTime: eventData.start.toISOString(),
                timeZone: 'America/Sao_Paulo', // Default
            },
            end: {
                dateTime: eventData.end.toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            attendees: eventData.attendeeEmail ? [{ email: eventData.attendeeEmail }] : [],
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
        });

        return {
            id: response.data.id,
            link: response.data.htmlLink,
        };
    }
}
