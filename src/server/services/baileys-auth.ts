
import { db } from '@/lib/db';
import { whatsappSessions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
    AuthenticationCreds,
    AuthenticationState,
    SignalDataTypeMap,
    initAuthCreds,
    BufferJSON,
    proto
} from '@whiskeysockets/baileys';

/**
 * Adaptador de autenticação Baileys para PostgreSQL.
 * Substitui o useMultiFileAuthState para funcionar em ambientes serverless (Vercel).
 */
export const usePostgresAuthState = async (instanceId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {

    // Função helper para salvar dados
    const writeData = async (data: any, key: string) => {
        try {
            const value = JSON.stringify(data, BufferJSON.replacer);

            // Tenta atualizar primeiro
            const existing = await db.query.whatsappSessions.findFirst({
                where: and(
                    eq(whatsappSessions.instanceId, instanceId),
                    eq(whatsappSessions.key, key)
                )
            });

            if (existing) {
                await db.update(whatsappSessions)
                    .set({ value, updatedAt: new Date() })
                    .where(and(
                        eq(whatsappSessions.instanceId, instanceId),
                        eq(whatsappSessions.key, key)
                    ));
            } else {
                await db.insert(whatsappSessions).values({
                    instanceId,
                    key,
                    value
                });
            }
        } catch (error) {
            console.error(`[PostgresAuth] Erro ao salvar chave ${key}:`, error);
        }
    };

    // Função helper para ler dados
    const readData = async (key: string) => {
        try {
            const result = await db.query.whatsappSessions.findFirst({
                where: and(
                    eq(whatsappSessions.instanceId, instanceId),
                    eq(whatsappSessions.key, key)
                )
            });

            if (result) {
                return JSON.parse(result.value, BufferJSON.reviver);
            }
        } catch (error) {
            console.error(`[PostgresAuth] Erro ao ler chave ${key}:`, error);
        }
        return null;
    };

    // Função helper para deletar dados
    const removeData = async (key: string) => {
        try {
            await db.delete(whatsappSessions)
                .where(and(
                    eq(whatsappSessions.instanceId, instanceId),
                    eq(whatsappSessions.key, key)
                ));
        } catch (error) {
            console.error(`[PostgresAuth] Erro ao remover chave ${key}:`, error);
        }
    };

    // Carregar credenciais iniciais
    const creds: AuthenticationCreds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};

                    // Buscar todas as chaves solicitadas
                    // Otimização: Poderíamos usar inArray no SQL, mas as chaves são compostas (type + id)
                    // Baileys armazena como `${type}-${id}`

                    await Promise.all(ids.map(async (id) => {
                        const key = `${type}-${id}`;
                        const value = await readData(key);
                        if (type === 'app-state-sync-key' && value) {
                            data[id] = proto.Message.AppStateSyncKeyData.fromObject(value) as any;
                        } else if (value) {
                            data[id] = value;
                        }
                    }));

                    return data;
                },
                set: async (data) => {
                    // Salvar cada item
                    const tasks: Promise<void>[] = [];

                    const dataAny = data as any; // Cast para evitar erro de indexação

                    for (const category in dataAny) {
                        for (const id in dataAny[category]) {
                            const value = dataAny[category][id];
                            const key = `${category}-${id}`;

                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }

                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData(creds, 'creds');
        }
    };
};
