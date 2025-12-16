import { db } from '@/lib/db';
import {
    agentStages,
    agentActions,
    sessions,
    messages,
    agentStagesRelations
} from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { BrainService } from '@/lib/ai/brain';
import { GoogleCalendarService } from '@/server/integrations/google-calendar';
import { GoogleSheetsService } from '@/server/integrations/google-sheets';

const brain = new BrainService();
const calendar = new GoogleCalendarService();
const sheets = new GoogleSheetsService();

export class StageMachine {

    /**
     * Processa uma mensagem do usuário através da máquina de estados
     */
    async processMessage(userId: string, agentId: string, threadId: string, userMessage: string) {
        // 1. Carregar sessão ou criar nova
        let session = await db.query.sessions.findFirst({
            where: eq(sessions.threadId, threadId)
        });

        if (!session) {
            // Sessão nova: busca primeiro estágio
            const firstStage = await db.query.agentStages.findFirst({
                where: eq(agentStages.agentId, agentId),
                orderBy: asc(agentStages.order)
            });

            if (!firstStage) throw new Error('Agente sem estágios configurados');

            const [newSession] = await db.insert(sessions).values({
                threadId,
                currentStageId: firstStage.id,
                stageHistory: [firstStage.id],
            }).returning();
            session = newSession;
        }

        // 2. Carregar estágio atual e configuração do agente
        const currentStage = await db.query.agentStages.findFirst({
            where: eq(agentStages.id, session.currentStageId!),
            with: { actions: true }
        });

        if (!currentStage) throw new Error('Estágio atual inválido');

        // 3. Avaliar Transição de Estágio (Se houver próximo)
        if (currentStage.nextStageId) {
            const shouldAdvance = await this.evaluateTransition(userMessage, currentStage, session.variables as any);

            if (shouldAdvance) {
                // Avançar para próximo estágio
                await db.update(sessions)
                    .set({
                        currentStageId: currentStage.nextStageId,
                        previousStageId: currentStage.id,
                        stageHistory: [...(session.stageHistory as string[]), currentStage.nextStageId]
                    })
                    .where(eq(sessions.id, session.id));

                // Recarregar novo estágio para executar ações de entrada
                const nextStage = await db.query.agentStages.findFirst({
                    where: eq(agentStages.id, currentStage.nextStageId),
                    with: { actions: true }
                });

                if (nextStage) {
                    await this.executeStageActions(userId, nextStage, session.variables as any);
                    // Atualiza referência para prompt
                    Object.assign(currentStage, nextStage);
                }
            }
        }

        // 4. Buscar contexto (RAG)
        const context = await brain.retrieveContext(agentId, userMessage);

        // 5. Gerar Resposta da IA com Prompt do Estágio
        const systemPrompt = `
        VOCÊ ESTÁ NO ESTÁGIO: ${currentStage.name}
        
        INSTRUÇÕES DESTE ESTÁGIO:
        ${currentStage.instructions}
        
        VARIÁVEIS JÁ COLETADAS:
        ${JSON.stringify(session.variables)}

        CONTEXTO DO RAG:
        ${context.join('\n\n')}

        Seu objetivo é cumprir as instruções do estágio atual.
        Se faltar variaveis obrigatorias (${JSON.stringify(currentStage.requiredVariables)}), PERGUNTE ao usuario.
        `;

        const { text: responseText } = await generateText({
            model: openai('gpt-4o-mini'),
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
        });

        // 6. Extrair variáveis da resposta do usuário (simples)
        // Idealmente usaria function calling ou structured output aqui
        // Por enquanto, vamos supor que a IA extraiu e salvou no banco em step separado
        // ou implementamos extraction logic aqui. 

        return responseText;
    }

    /**
     * Avalia se deve avançar de estágio
     */
    private async evaluateTransition(message: string, stage: any, variables: any): Promise<boolean> {
        // Verifica se todas as variáveis obrigatórias estão presentes
        const missingVars = stage.requiredVariables?.filter((v: string) => !variables[v]);
        if (missingVars && missingVars.length > 0) return false;

        if (!stage.entryCondition) return true; // Sem condição extra, avança se tiver variáveis

        // Usa IA para avaliar condição lógica
        const { text } = await generateText({
            model: openai('gpt-4o-mini'),
            system: `Avalie se a mensagem do usuário atende à condição: "${stage.entryCondition}". Responda SIM ou NAO.`,
            prompt: message
        });

        return text.trim().toUpperCase().includes('SIM');
    }

    /**
     * Executa ações automáticas do estágio
     */
    private async executeStageActions(userId: string, stage: any, variables: any) {
        if (!stage.actions || stage.actions.length === 0) return;

        for (const action of stage.actions) {
            try {
                switch (action.type) {
                    case 'google_calendar_list':
                        // Exemplo: Listar slots e salvar no contexto/variáveis
                        // const slots = await calendar.listAvailableSlots(userId, ...);
                        break;
                    case 'google_sheets_append':
                        await sheets.appendRow(userId, variables, action.config as any);
                        break;
                }
            } catch (error) {
                console.error(`Erro na ação ${action.type}:`, error);
            }
        }
    }
}
