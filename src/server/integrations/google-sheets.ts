import { google } from 'googleapis';
import { db } from '@/lib/db';
import { integrations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { decryptCredential } from '@/lib/security';

export class GoogleSheetsService {
    private oauth2Client;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`
        );
    }

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

        const credentials = JSON.parse(decryptCredential(integration.credentials));
        this.oauth2Client.setCredentials({
            access_token: credentials.accessToken,
            refresh_token: credentials.refreshToken,
            expiry_date: credentials.expiryDate,
        });

        return this.oauth2Client;
    }

    /**
     * Adiciona uma linha na planilha (para captura de leads)
     */
    async appendRow(userId: string, data: Record<string, string>, config: {
        spreadsheetId: string;
        sheetName: string;
        columnMapping?: Record<string, string>; // Ex: { "A": "name", "B": "email" }
    }) {
        const auth = await this.authenticate(userId);
        const sheets = google.sheets({ version: 'v4', auth });

        // Se tiver mapeamento, ordenar os dados pelas colunas
        // Se não, joga os valores na ordem que vierem
        let values: string[] = [];

        if (config.columnMapping) {
            const sortedCols = Object.keys(config.columnMapping).sort();
            values = sortedCols.map(col => {
                const key = config.columnMapping![col];
                return data[key] || '';
            });
        } else {
            values = Object.values(data);
        }

        await sheets.spreadsheets.values.append({
            spreadsheetId: config.spreadsheetId,
            range: `${config.sheetName}!A1`, // Append vai achar a próxima linha vazia automaticamente
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [values],
            },
        });
    }
}
