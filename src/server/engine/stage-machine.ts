import { db } from '@/lib/db';
import {
    agentStages,
    agentActions,
    sessions,
    agents,
} from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { BrainService } from '@/lib/ai/brain';
import { GoogleCalendarService } from '@/server/integrations/google-calendar';
import { GoogleSheetsService } from '@/server/integrations/google-sheets';

const brain = new BrainService();
const calendar = new GoogleCalendarService();
const sheets = new GoogleSheetsService();

// LLM Provider factory
function getModel(provider: string, model: string) {
    switch (provider) {
        case 'google':
            return google(model);
        case 'anthropic':
            return anthropic(model);
        case 'openai':
        default:
            return openai(model);
    }
}

export class StageMachine {

    /**
     * Processa uma mensagem do usuário através da máquina de estados
     */
    async processMessage(userId: string, agentId: string, threadId: string, userMessage: string) {
        // 1. Carregar agente para pegar configurações
        const agent = await db.query.agents.findFirst({
            where: eq(agents.id, agentId)
        });

        if (!agent) throw new Error('Agente não encontrado');

        // 2. Carregar sessão ou criar nova
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
                variables: {}
            }).returning();
            session = newSession;
        }

        // 3. Carregar estágio atual
        const currentStage = await db.query.agentStages.findFirst({
            where: eq(agentStages.id, session.currentStageId!),
            with: { actions: true }
        });

        if (!currentStage) throw new Error('Estágio atual inválido');

        // 4. Carregar todos os estágios para transição inteligente
        const allStages = await db.query.agentStages.findMany({
            where: eq(agentStages.agentId, agentId),
            orderBy: asc(agentStages.order)
        });

        // 5. Buscar contexto (RAG)
        const context = await brain.retrieveContext(agentId, userMessage);

        // 6. Obter modelo configurado
        const modelConfig = agent.modelConfig as any || { provider: 'openai', model: 'gpt-4o-mini' };
        const model = getModel(modelConfig.provider || 'openai', modelConfig.model || 'gpt-4o-mini');

        // 7. Construir prompt avançado para resposta
        const systemPrompt = this.buildAdvancedPrompt(agent, currentStage, allStages, session, context);

        // 8. Gerar resposta + análise de transição em uma chamada
        const { text: fullResponse } = await generateText({
            model,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
            temperature: modelConfig.temperature || 0.7,
            maxTokens: modelConfig.maxTokens || 1024,
        });

        // 9. Extrair variáveis e avaliar transição
        const analysisResult = await this.analyzeResponseAndTransition(
            model, userMessage, fullResponse, currentStage, allStages, session
        );

        // 10. Atualizar sessão se necessário
        if (analysisResult.shouldAdvance && analysisResult.nextStageId) {
            await db.update(sessions)
                .set({
                    currentStageId: analysisResult.nextStageId,
                    previousStageId: currentStage.id,
                    stageHistory: [...(session.stageHistory as string[]), analysisResult.nextStageId],
                    variables: { ...(session.variables as object), ...analysisResult.extractedVars }
                })
                .where(eq(sessions.id, session.id));
        } else if (Object.keys(analysisResult.extractedVars).length > 0) {
            // Só atualizar variáveis
            await db.update(sessions)
                .set({
                    variables: { ...(session.variables as object), ...analysisResult.extractedVars }
                })
                .where(eq(sessions.id, session.id));
        }

        return fullResponse;
    }

    /**
     * Constrói prompt avançado para resposta de alta qualidade
     */
    private buildAdvancedPrompt(agent: any, currentStage: any, allStages: any[], session: any, context: string[]) {
        const vars = session.variables || {};
        const stageFlow = allStages.map((s, i) => `${i}. ${s.name} (${s.type})`).join('\n');

        return `# IDENTIDADE
Você é ${agent.displayName || agent.name}, um agente de IA conversacional especializado.
${agent.companyProfile ? `\n## CONTEXTO DA EMPRESA\n${agent.companyProfile}` : ''}

# TOM DE VOZ
- Estilo: ${agent.tone || 'amigável'} e ${agent.personality || 'profissional'}
- Idioma: ${agent.language || 'pt-BR'}
- Emojis: ${agent.useEmojis ? 'Use quando apropriado' : 'Evite emojis'}

# FLUXO CONVERSACIONAL
Você segue um fluxo de estágios automático:
${stageFlow}

## ESTÁGIO ATUAL: ${currentStage.name} (${currentStage.type})

### INSTRUÇÕES DO ESTÁGIO
${currentStage.instructions}

# INFORMAÇÕES COLETADAS
${Object.keys(vars).length > 0 ? JSON.stringify(vars, null, 2) : 'Nenhuma informação coletada ainda.'}

# BASE DE CONHECIMENTO (RAG)
${context.length > 0 ? context.join('\n\n---\n\n') : 'Use apenas as instruções do estágio.'}

# REGRAS DE OURO
1. Seja CONVERSACIONAL - não robótico. Responda como um humano real responderia.
2. Faça UMA pergunta por vez - nunca bombardeie o usuário.
3. Use o NOME do usuário assim que souber.
4. ESPELHE o tom do usuário - se ele for informal, seja informal.
5. Demonstre INTELIGÊNCIA - faça conexões, lembre-se do contexto.
6. Seja CONCISO - respostas curtas e diretas, a menos que precise explicar algo.
7. NUNCA diga "Como posso ajudar?" - você já está ajudando, vá direto ao ponto.
8. Se o usuário pedir para falar com humano, aceite imediatamente.

# RESPOSTA
Responda à mensagem do usuário seguindo as instruções do estágio atual.
Seu objetivo é avançar naturalmente para o próximo estágio quando apropriado.`;
    }

    /**
     * Analisa a conversa para extração de variáveis e decisão de transição
     */
    private async analyzeResponseAndTransition(
        model: any,
        userMessage: string,
        agentResponse: string,
        currentStage: any,
        allStages: any[],
        session: any
    ): Promise<{ shouldAdvance: boolean; nextStageId: string | null; extractedVars: Record<string, any> }> {

        const currentIndex = allStages.findIndex(s => s.id === currentStage.id);
        const nextStage = currentIndex < allStages.length - 1 ? allStages[currentIndex + 1] : null;

        // Procura por pedido de transbordo explícito
        const transferKeywords = ['falar com humano', 'atendente', 'pessoa real', 'transferir', 'suporte humano'];
        const wantsTransfer = transferKeywords.some(kw => userMessage.toLowerCase().includes(kw));

        if (wantsTransfer) {
            const transferStage = allStages.find(s => s.type === 'transfer');
            if (transferStage) {
                return {
                    shouldAdvance: true,
                    nextStageId: transferStage.id,
                    extractedVars: { motivo_transbordo: 'Solicitado pelo usuário' }
                };
            }
        }

        // Análise com IA para extração e transição
        try {
            const analysisPrompt = `Analise esta conversa e responda em JSON:

MENSAGEM DO USUÁRIO: "${userMessage}"
RESPOSTA DO AGENTE: "${agentResponse}"
ESTÁGIO ATUAL: ${currentStage.name} (${currentStage.type})
${nextStage ? `PRÓXIMO ESTÁGIO: ${nextStage.name} (${nextStage.type})` : 'Este é o último estágio.'}

Extraia variáveis e decida se deve avançar:

Para IDENTIFICAÇÃO, procure: nome, empresa, cargo, nicho/segmento
Para DIAGNÓSTICO, procure: dor_principal, volume_atendimento, ferramenta_atual
Para AGENDAMENTO, procure: horario_preferido, email, telefone

Responda APENAS com JSON válido:
{
  "extracted": { "variável": "valor" },
  "shouldAdvance": true/false,
  "reason": "motivo da decisão"
}`;

            const { text: analysisJson } = await generateText({
                model,
                prompt: analysisPrompt,
                temperature: 0.1,
            });

            // Parse JSON da resposta
            const jsonMatch = analysisJson.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                return {
                    shouldAdvance: analysis.shouldAdvance && nextStage !== null,
                    nextStageId: analysis.shouldAdvance && nextStage ? nextStage.id : null,
                    extractedVars: analysis.extracted || {}
                };
            }
        } catch (error) {
            console.error('Erro na análise de transição:', error);
        }

        return { shouldAdvance: false, nextStageId: null, extractedVars: {} };
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
