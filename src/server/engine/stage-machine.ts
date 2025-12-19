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
import { formatContextWithXml, KNOWLEDGE_GUARDRAILS } from '@/server/services/knowledge-service';

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
            let firstStage = await db.query.agentStages.findFirst({
                where: eq(agentStages.agentId, agentId),
                orderBy: asc(agentStages.order)
            });

            // Se não tem estágios, criar automaticamente
            if (!firstStage) {
                console.log(`[StageMachine] ⚠️ Agente ${agentId} sem estágios. Criando estágios padrão...`);

                const defaultStages = [
                    { name: 'Identificação', type: 'identify' as const, order: 0, instructions: 'Conhecer o lead. Pergunte nome e área de atuação. Se demonstrar interesse direto, pule para agendamento.', entryCondition: 'Início', requiredVariables: ['nome', 'area'] },
                    { name: 'Entendimento', type: 'diagnosis' as const, order: 1, instructions: 'Entender a dor. Pergunte o que fez ele buscar uma solução. Se demonstrar interesse, ofereça agendamento.', entryCondition: 'Lead identificado', requiredVariables: ['desafio'] },
                    { name: 'Qualificação', type: 'custom' as const, order: 2, instructions: 'Qualificar o lead. Pergunte UMA informação relevante sobre o contexto (volume de leads, equipe, etc).', entryCondition: 'Dor identificada', requiredVariables: [] },
                    { name: 'Apresentação', type: 'custom' as const, order: 3, instructions: 'Conectar dor com solução. Mostre 1-2 benefícios e ofereça uma demonstração prática.', entryCondition: 'Lead qualificado', requiredVariables: [] },
                    { name: 'Agendamento', type: 'schedule' as const, order: 4, instructions: 'Agendar reunião. Peça email e ofereça datas: dia DD/MM às HH:00. Nunca sábado ou domingo.', entryCondition: 'Lead interessado', requiredVariables: ['email', 'data_reuniao'] },
                    { name: 'Confirmação', type: 'handoff' as const, order: 5, instructions: 'Confirmar agendamento e encerrar. Agradeça pela conversa.', entryCondition: 'Reunião agendada', requiredVariables: [] },
                ];

                await db.insert(agentStages).values(
                    defaultStages.map(stage => ({
                        agentId,
                        name: stage.name,
                        type: stage.type,
                        order: stage.order,
                        instructions: stage.instructions,
                        entryCondition: stage.entryCondition,
                        requiredVariables: stage.requiredVariables,
                        isActive: true,
                    }))
                );

                // Buscar novamente o primeiro estágio
                firstStage = await db.query.agentStages.findFirst({
                    where: eq(agentStages.agentId, agentId),
                    orderBy: asc(agentStages.order)
                });

                console.log(`[StageMachine] ✅ Estágios criados para agente ${agentId}`);
            }

            if (!firstStage) throw new Error('Falha ao criar estágios padrão');

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

        // 5. PRÉ-VERIFICAÇÃO: Checar se estágio atual está completo ANTES de responder
        let activeStage = currentStage;
        const existingVars = session.variables as Record<string, any> || {};
        const requiredVars = (currentStage.requiredVariables as string[]) || [];

        // 5a. DETECÇÃO DE INTENÇÃO DIRETA: Pular para agendamento se lead demonstrar interesse
        const lowerMessage = userMessage.toLowerCase();
        const buyingIntentKeywords = [
            // Agendar/Marcar direto
            'quero agendar', 'quero marcar', 'só marcar', 'só agendar',
            'queria marcar', 'queria agendar', 'gostaria de marcar', 'gostaria de agendar',
            'posso agendar', 'posso marcar', 'podemos marcar', 'vamos marcar',
            'marcar uma reunião', 'marcar uma chamada', 'marcar uma call',
            'agendar uma reunião', 'agendar uma chamada', 'agendar uma call',
            'marcar apresentação', 'marcar uma apresentação',
            // Interesse direto
            'quero contratar', 'quero fazer', 'quero conhecer',
            'quero ver na prática', 'quero uma demonstração',
            'me interessou', 'tenho interesse', 'estou interessado',
            // Horários
            'quando podemos', 'qual horário', 'tem horário', 'horário disponível',
            // Preço/valores
            'quero saber mais sobre preço', 'quanto custa', 'qual o valor',
            // Urgência
            'preciso urgente', 'o mais rápido possível', 'próxima semana',
        ];

        const hasBuyingIntent = buyingIntentKeywords.some(kw => lowerMessage.includes(kw));

        // Flag para indicar que usuário quer agendar mas precisa de dados básicos
        let needsBasicInfo = false;
        const hasName = existingVars.nome && existingVars.nome.trim() !== '';

        if (hasBuyingIntent && currentStage.type !== 'schedule' && currentStage.type !== 'handoff') {
            // Se tem o nome, pula direto para agendamento
            if (hasName) {
                const scheduleStage = allStages.find(s => s.type === 'schedule');

                if (scheduleStage) {
                    console.log(`[StageMachine] 🎯 Intenção + Nome OK! Pulando para: ${scheduleStage.name}`);
                    activeStage = scheduleStage;

                    // Atualizar sessão direto para agendamento
                    await db.update(sessions)
                        .set({
                            currentStageId: scheduleStage.id,
                            previousStageId: currentStage.id,
                            stageHistory: [...(session.stageHistory as string[]), scheduleStage.id],
                            variables: { ...existingVars, buyingIntent: true }
                        })
                        .where(eq(sessions.id, session.id));
                }
            } else {
                // Não tem nome - marca flag para pedir antes de agendar
                console.log(`[StageMachine] 🎯 Intenção detectada, mas precisa do nome primeiro`);
                needsBasicInfo = true;
            }
        }

        // Extrair variáveis da mensagem atual de forma simples
        const extractedFromMessage: Record<string, any> = {};

        // Detectar área/nicho de atuação
        const areaPatterns = [
            /(?:clínica|clinica|consultório|loja|empresa|negócio|trabalho com|área|nicho|segmento|setor)[:\s]+(.+)/i,
            /(?:sou|tenho|trabalho em|atuo com|meu negócio é)[:\s]*(?:uma?\s+)?(.+)/i,
        ];
        for (const pattern of areaPatterns) {
            const match = userMessage.match(pattern);
            if (match && match[1]) {
                extractedFromMessage['area'] = match[1].trim();
                break;
            }
        }

        // Detectar nome simples (mensagem curta, provavelmente só o nome)
        if (userMessage.length < 30 && !userMessage.includes('?') && !lowerMessage.includes(' ')) {
            extractedFromMessage['nome'] = userMessage.trim();
        }

        // Detectar DATA diretamente da mensagem (ex: "22/12", "dia 22", "22 de dezembro")
        const datePatterns = [
            /(\d{1,2})\s*[\/\-]\s*(\d{1,2})/,  // 22/12 ou 22-12
            /dia\s+(\d{1,2})(?:\s+de\s+(\w+))?/i,  // dia 22, dia 22 de dezembro
            /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i,
        ];
        for (const pattern of datePatterns) {
            const match = userMessage.match(pattern);
            if (match) {
                // Converter para formato DD/MM se possível
                const day = match[1];
                let month = match[2];
                if (month && isNaN(parseInt(month))) {
                    // Converter nome do mês para número
                    const monthNames: Record<string, string> = {
                        'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
                        'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
                        'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
                    };
                    month = monthNames[month.toLowerCase()] || String(new Date().getMonth() + 1).padStart(2, '0');
                }
                extractedFromMessage['data_reuniao'] = `${day}/${month || String(new Date().getMonth() + 1).padStart(2, '0')}`;
                console.log(`[StageMachine] 📅 Data extraída diretamente: ${extractedFromMessage['data_reuniao']}`);
                break;
            }
        }

        // Detectar HORÁRIO diretamente da mensagem (ex: "10h", "às 10", "10:00", "10 da manhã")
        const timePatterns = [
            /(\d{1,2})(?:[:h](\d{2}))?\s*(?:h|horas?)?/i,  // 10h, 10:00, 10h30
            /às?\s+(\d{1,2})(?:[:h](\d{2}))?/i,  // às 10, as 10:30
            /(\d{1,2})\s+(?:da\s+)?(manhã|tarde|noite)/i,  // 10 da manhã
        ];
        for (const pattern of timePatterns) {
            const match = userMessage.match(pattern);
            if (match && match[1]) {
                let hours = parseInt(match[1]);
                const minutes = match[2] || '00';
                // Ajustar para período (manhã/tarde/noite)
                if (match[3]) {
                    if (match[3].toLowerCase() === 'tarde' && hours < 12) hours += 12;
                    if (match[3].toLowerCase() === 'noite' && hours < 18) hours += 12;
                }
                extractedFromMessage['horario_reuniao'] = `${hours}:${minutes}`;
                console.log(`[StageMachine] 🕐 Horário extraído diretamente: ${extractedFromMessage['horario_reuniao']}`);
                break;
            }
        }

        // Detectar EMAIL diretamente da mensagem
        const emailMatch = userMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
        if (emailMatch) {
            extractedFromMessage['email'] = emailMatch[0].toLowerCase();
            console.log(`[StageMachine] 📧 Email extraído diretamente: ${extractedFromMessage['email']}`);
        }

        // Combinar variáveis existentes + extraídas
        const allVars = { ...existingVars, ...extractedFromMessage };

        // Verificar se todas as variáveis obrigatórias do estágio atual estão completas
        const hasAllRequired = requiredVars.length === 0 ||
            requiredVars.every(v => allVars[v] !== undefined && allVars[v] !== '');

        // Se estágio atual está completo, avançar para o próximo ANTES de responder
        if (hasAllRequired && requiredVars.length > 0) {
            const currentIndex = allStages.findIndex(s => s.id === currentStage.id);
            const nextStage = currentIndex < allStages.length - 1 ? allStages[currentIndex + 1] : null;

            if (nextStage) {
                console.log(`[StageMachine] 🚀 Pré-transição: ${currentStage.name} → ${nextStage.name}`);
                activeStage = nextStage;

                // Atualizar sessão para o novo estágio
                await db.update(sessions)
                    .set({
                        currentStageId: nextStage.id,
                        previousStageId: currentStage.id,
                        stageHistory: [...(session.stageHistory as string[]), nextStage.id],
                        variables: allVars
                    })
                    .where(eq(sessions.id, session.id));
            }
        }

        // 6. Buscar contexto (RAG)
        const context = await brain.retrieveContext(agentId, userMessage);

        // 7. Obter modelo configurado
        const modelConfig = agent.modelConfig as any || { provider: 'openai', model: 'gpt-4o-mini' };
        const model = getModel(modelConfig.provider || 'openai', modelConfig.model || 'gpt-4o-mini');

        // 8. Construir prompt avançado para resposta (usando estágio ATIVO, não o antigo)
        const systemPrompt = this.buildAdvancedPrompt(agent, activeStage, allStages, session, context, needsBasicInfo);

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

        // 11. AGENDAMENTO AUTOMÁTICO: Se estamos no estágio de schedule e temos os dados
        // Consolidar TODAS as variáveis: sessão + extração direta + análise IA
        const finalVars: Record<string, any> = {
            ...(session?.variables as object || {}),
            ...extractedFromMessage,  // CRÍTICO: incluir extração direta
            ...analysisResult.extractedVars
        };

        // Mapear sinônimos de agendamento (caso IA tenha usado nomes diferentes)
        if (finalVars['data_agendamento'] && !finalVars['data_reuniao']) finalVars['data_reuniao'] = finalVars['data_agendamento'];
        if (finalVars['data'] && !finalVars['data_reuniao']) finalVars['data_reuniao'] = finalVars['data'];
        if (finalVars['hora_agendamento'] && !finalVars['horario_reuniao']) finalVars['horario_reuniao'] = finalVars['hora_agendamento'];
        if (finalVars['hora'] && !finalVars['horario_reuniao']) finalVars['horario_reuniao'] = finalVars['hora'];
        if (finalVars['horario'] && !finalVars['horario_reuniao']) finalVars['horario_reuniao'] = finalVars['horario'];

        if (activeStage.type === 'schedule' || currentStage.type === 'schedule') {
            const hasSchedulingData = finalVars.email && (finalVars.data_reuniao || finalVars.horario_reuniao);
            console.log(`[StageMachine] 📊 Verificando dados para agendamento: email=${finalVars.email}, data=${finalVars.data_reuniao}, hora=${finalVars.horario_reuniao}`);

            if (hasSchedulingData && !finalVars.meetingCreated) {
                try {
                    console.log('[StageMachine] 📅 Tentando agendar reunião...', finalVars);

                    // Buscar usuário com integração Google (primeiro tenta agent.userId, depois busca qualquer um REAL)
                    const { integrations } = await import('@/db/schema');
                    let calendarUserId = agent.userId;

                    // Verificar se o agent.userId tem integração Google
                    console.log(`[StageMachine] 🔍 Buscando integração para agent.userId: ${agent.userId}, provider: google`);
                    const agentIntegration = await db.query.integrations.findFirst({
                        where: and(eq(integrations.userId, agent.userId), eq(integrations.provider, 'google'))
                    });

                    if (!agentIntegration) {
                        // Buscar qualquer usuário REAL com integração Google (excluir demo user específico)
                        const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
                        const { ne } = await import('drizzle-orm');

                        const anyGoogleIntegration = await db.query.integrations.findFirst({
                            where: and(
                                eq(integrations.provider, 'google'),
                                ne(integrations.userId, DEMO_USER_ID) // Excluir demo user
                            )
                        });

                        if (anyGoogleIntegration) {
                            calendarUserId = anyGoogleIntegration.userId;
                            console.log(`[StageMachine] 📅 Usando integração Google de usuário real: ${calendarUserId}`);
                        } else {
                            console.error('[StageMachine] ❌ Nenhuma integração Google de usuário real encontrada');
                            // Throw specific error to be caught below
                            throw new Error('CONFIG_ERROR_NO_INTEGRATION');
                        }
                    }

                    // Parse date from Brazilian format (DD/MM) - handles "terça-feira, 23/12" format
                    const dataStr = String(finalVars.data_reuniao || '');
                    const horarioStr = String(finalVars.horario_reuniao || '10:00');
                    const nome = String(finalVars.nome || 'Lead');
                    const attendeeEmail = String(finalVars.email || '');

                    // Extract day and month - more robust regex to handle "terça-feira, 23/12" or just "23/12"
                    const dateMatch = dataStr.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})/);
                    if (dateMatch && attendeeEmail) {
                        const day = parseInt(dateMatch[1]);
                        const month = parseInt(dateMatch[2]) - 1; // JS months are 0-indexed
                        const year = new Date().getFullYear();

                        // Adjust year if month is before current month
                        const currentMonth = new Date().getMonth();
                        const adjustedYear = month < currentMonth ? year + 1 : year;

                        // Extract time
                        const timeMatch = horarioStr.match(/(\d{1,2})(?::(\d{2}))?/);
                        const hours = timeMatch ? parseInt(timeMatch[1]) : 10;
                        const minutes = timeMatch && timeMatch[2] ? parseInt(timeMatch[2]) : 0;

                        // Create Date objects
                        const startDate = new Date(adjustedYear, month, day, hours, minutes, 0);
                        const endDate = new Date(startDate.getTime() + 45 * 60 * 1000); // +45 min

                        // Create meeting
                        const meetingTitle = `IA Agent - ${agent.name} + ${nome}`;

                        const result = await calendar.createEvent(calendarUserId, {
                            summary: meetingTitle,
                            description: `Reunião agendada via chat.\nÁrea: ${finalVars.area || 'N/A'}\nDesafio: ${finalVars.desafio || 'N/A'}`,
                            start: startDate,
                            end: endDate,
                            attendeeEmail: attendeeEmail,
                        });

                        if (result.id) {
                            console.log('[StageMachine] ✅ Reunião criada com sucesso!', result.id);
                            // Salvar evento ID na sessão
                            await db.update(sessions)
                                .set({
                                    variables: { ...finalVars, meetingCreated: true, eventId: result.id, eventLink: result.link }
                                })
                                .where(eq(sessions.id, session!.id));
                        } else {
                            console.error('[StageMachine] ❌ Falha ao criar reunião - sem ID retornado');
                        }
                    }
                } catch (calError: any) {
                    console.error('[StageMachine] ❌ Erro no agendamento:', calError);

                    // Graceful fallback: Inform user about the error
                    if (calError.message === 'CONFIG_ERROR_NO_INTEGRATION') {
                        fullResponse += "\n\n(⚠️ Nota do Sistema: Não encontrei uma agenda Google conectada para realizar o agendamento. Por favor, verifique a página de integrações.)";
                    } else {
                        fullResponse += "\n\n(⚠️ Nota do Sistema: Tive um problema técnico ao tentar acessar a agenda. Podemos tentar novamente em instantes?)";
                    }
                }
            }
        }

        return fullResponse;
    }

    /**
     * Constrói prompt avançado para resposta de alta qualidade
     */
    private buildAdvancedPrompt(agent: any, currentStage: any, allStages: any[], session: any, context: string[], needsBasicInfo: boolean = false) {
        const vars = session?.variables || {};
        const stageFlow = allStages.map((s, i) => `${i}. ${s.name} (${s.type})`).join('\n');
        const currentIndex = allStages.findIndex(s => s.id === currentStage.id);
        const totalStages = allStages.length;

        // Determine if we're near scheduling stage (should explore more)
        const isNearScheduleStage = currentStage.type === 'diagnosis' ||
            (currentIndex < totalStages - 1 && allStages[currentIndex + 1]?.type === 'schedule');

        // Instrução especial quando precisa de dados básicos antes de agendar
        const basicInfoInstruction = needsBasicInfo ? `
## ⚠️ AÇÃO URGENTE
O usuário quer agendar, mas AINDA NÃO SABEMOS O NOME DELE.
ANTES de falar sobre agendamento, pergunte de forma natural:
"Ótimo! Antes de agendar, qual é o seu nome?"
Só depois de ter o nome, continue para o agendamento.
` : '';

        // Current date info for scheduling
        const now = new Date();
        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const diaSemanaAtual = diasSemana[now.getDay()];
        const dataAtual = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

        // Calculate next business days
        const proximosDias: string[] = [];
        for (let i = 1; i <= 7; i++) {
            const futureDate = new Date(now);
            futureDate.setDate(now.getDate() + i);
            const dayOfWeek = futureDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
                const formattedDate = `${futureDate.getDate().toString().padStart(2, '0')}/${(futureDate.getMonth() + 1).toString().padStart(2, '0')}`;
                const dayName = diasSemana[dayOfWeek];
                proximosDias.push(`${dayName} ${formattedDate}`);
                if (proximosDias.length >= 3) break;
            }
        }

        return `# IDENTIDADE
Você é ${agent.displayName || agent.name}, um agente de IA conversacional especializado.
${agent.companyProfile ? `\n## CONTEXTO DA EMPRESA\n${agent.companyProfile}` : ''}

# DATA E HORA ATUAL
- Hoje é: ${diaSemanaAtual}, ${dataAtual}
- Hora atual: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}
- Próximos dias úteis disponíveis: ${proximosDias.join(', ')}
- NUNCA ofereça sábado ou domingo para reuniões

${basicInfoInstruction}
# TOM DE VOZ
- Estilo: ${agent.tone || 'amigável'} e ${agent.personality || 'profissional'}
- Idioma: ${agent.language || 'pt-BR'}
- Emojis: ${agent.useEmojis ? 'Use quando apropriado' : 'Evite emojis'}

# FLUXO CONVERSACIONAL (GUIA, NÃO REGRA RÍGIDA)
Os estágios são apenas uma ORIENTAÇÃO, não uma sequência obrigatória:
${stageFlow}

## ESTÁGIO ATUAL: ${currentStage.name} (${currentStage.type}) [${currentIndex + 1}/${totalStages}]

### INSTRUÇÕES DO ESTÁGIO (adapte conforme necessário)
${currentStage.instructions}

# INFORMAÇÕES COLETADAS
${Object.keys(vars).length > 0 ? JSON.stringify(vars, null, 2) : 'Nenhuma informação coletada ainda.'}

# BASE DE CONHECIMENTO
${context.length > 0 ? formatContextWithXml(context) : 'Nenhum contexto adicional disponível.'}

${KNOWLEDGE_GUARDRAILS}

# REGRAS DE INTELIGÊNCIA E FLUIDEZ (PRIORIDADE MÁXIMA)
### DIRETRIZES CRÍTICAS DE COMPORTAMENTO (PARA EVITAR SER ROBÓTICO):
1.  **Priorize o Usuário:** O "Objetivo do Estágio Atual" é apenas um guia. Se o usuário mudar de assunto ou fizer uma pergunta direta que está no seu "Cérebro" (Knowledge Base), PAUSE o objetivo e responda o usuário primeiro.
2.  **Não Repita Perguntas:** Se o usuário já forneceu uma informação (ex: o nome dele no início da conversa), NUNCA pergunte novamente. Use a memória (Variáveis Coletadas).
3.  **Seja Humano e Direto:** Evite frases prontas de IA ("Entendo", "Compreendo"). Fale como uma pessoa prestativa no WhatsApp. Se o usuário for direto, seja direto.
4.  **Detecção de Atalho:** Se o usuário disser "Quero agendar agora" e você já tiver os dados necessários (Nome, Email), PULE qualquer script de qualificação e vá direto para a oferta de horários.
5.  **Adaptação:** Ajuste seu tone ao do usuário. Se ele é breve, seja breve.

# REGRAS DE OURO
1. Seja CONVERSACIONAL - não robótico. Responda como um humano real responderia.
2. Faça UMA pergunta por vez - nunca bombardeie o usuário.
3. Use o NOME do usuário assim que souber.
4. ESPELHE o tom do usuário - se ele for informal, seja informal.
5. Demonstre INTELIGÊNCIA - faça conexões, lembre-se do contexto.
6. Seja CONCISO - respostas curtas e diretas.
7. NUNCA diga "Como posso ajudar?" - vá direto ao ponto.
8. Se o usuário pedir para falar com humano, aceite imediatamente.

# QUANDO AGENDAR IMEDIATAMENTE
Se o lead disser qualquer um destes, VÁ DIRETO PARA AGENDAMENTO:
- "quero marcar", "quero agendar", "vamos agendar"
- "quero uma apresentação/demonstração"
- "quando podemos conversar", "tem horário disponível"
- "estou interessado", "quero contratar"
- Qualquer indicação clara de que quer avançar

Em vez de fazer mais perguntas, ofereça as datas: ${proximosDias.join(', ')}

# QUANDO EXPLORAR MAIS (APENAS SE NÃO HOUVER INTENÇÃO CLARA)
${isNearScheduleStage && !vars.buyingIntent ? `
Se o lead parecer indeciso ou com dúvidas:
- Pergunte: "O que te fez hesitar sobre isso?"
- Pergunte: "O que especificamente você precisa saber?"
` : ''}

Quando detectar objeções:
- "Está caro" → Reforce VALOR antes de preço
- "Vou pensar" → "O que especificamente você gostaria de pensar melhor?"
- "Não tenho tempo" → Mostre como a solução ECONOMIZA tempo

# RESPOSTA
Responda à mensagem do usuário de forma INTELIGENTE e HUMANA. 
Se ele quer agendar, ofereça as datas. Se precisa de mais informações, pergunte UMA coisa por vez.
SEU OBJETIVO: Ser útil e eficiente, não seguir um roteiro.`;
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
        const existingVars = session.variables || {};
        const requiredVars = currentStage.requiredVariables || [];

        try {
            // Construir lista dinâmica de variáveis a procurar
            const varsToExtract = [
                ...requiredVars,
                'nome', 'area', 'nicho', 'segmento', 'empresa', 'cargo',
                'desafio', 'dor', 'problema', 'tempo_problema',
                'faturamento', 'urgencia',
                'email', 'telefone', 'data_reuniao', 'horario_reuniao'
            ];

            const analysisPrompt = `Analise esta conversa e extraia informações:

MENSAGEM DO USUÁRIO: "${userMessage}"
RESPOSTA DO AGENTE: "${agentResponse}"
ESTÁGIO ATUAL: ${currentStage.name}
VARIÁVEIS JÁ COLETADAS: ${JSON.stringify(existingVars)}
VARIÁVEIS OBRIGATÓRIAS DO ESTÁGIO: ${JSON.stringify(requiredVars)}

IMPORTANTE: Extraia TODAS as informações que aparecem na mensagem do usuário.
Para área/nicho de atuação, use "area" como nome da variável.
Para desafios/problemas, use "desafio" como nome da variável.

Responda APENAS com JSON válido:
{
  "extracted": { "variavel": "valor" },
  "reason": "resumo do que foi coletado"
}`;

            const { text: analysisJson } = await generateText({
                model,
                prompt: analysisPrompt,
                temperature: 0.1,
            });

            // Parse JSON da resposta
            const jsonMatch = analysisJson.match(/\{[\s\S]*\}/);
            let extractedVars: Record<string, any> = {};

            if (jsonMatch) {
                try {
                    const analysis = JSON.parse(jsonMatch[0]);
                    extractedVars = analysis.extracted || {};
                } catch {
                    console.log('[StageMachine] Falha ao parsear JSON da análise');
                }
            }

            // Combinar variáveis existentes + novas
            const allVars = { ...existingVars, ...extractedVars };

            // Mapear sinônimos para variáveis obrigatórias
            if (allVars['nicho'] && !allVars['area']) allVars['area'] = allVars['nicho'];
            if (allVars['segmento'] && !allVars['area']) allVars['area'] = allVars['segmento'];
            if (allVars['dor'] && !allVars['desafio']) allVars['desafio'] = allVars['dor'];
            if (allVars['problema'] && !allVars['desafio']) allVars['desafio'] = allVars['problema'];
            // CRÍTICO: Mapear sinônimos de agendamento
            if (allVars['data_agendamento'] && !allVars['data_reuniao']) allVars['data_reuniao'] = allVars['data_agendamento'];
            if (allVars['data'] && !allVars['data_reuniao']) allVars['data_reuniao'] = allVars['data'];
            if (allVars['hora_agendamento'] && !allVars['horario_reuniao']) allVars['horario_reuniao'] = allVars['hora_agendamento'];
            if (allVars['hora'] && !allVars['horario_reuniao']) allVars['horario_reuniao'] = allVars['hora'];
            if (allVars['horario'] && !allVars['horario_reuniao']) allVars['horario_reuniao'] = allVars['horario'];

            // Verificar se todas as variáveis obrigatórias foram coletadas
            const hasAllRequired = requiredVars.length === 0 ||
                requiredVars.every((v: string) => allVars[v] !== undefined && allVars[v] !== '');

            // Decidir se avançar
            const shouldAdvance = hasAllRequired && nextStage !== null;

            if (shouldAdvance) {
                console.log(`[StageMachine] ✅ Avançando: ${currentStage.name} → ${nextStage?.name}. Vars: ${JSON.stringify(allVars)}`);
            }

            return {
                shouldAdvance,
                nextStageId: shouldAdvance && nextStage ? nextStage.id : null,
                extractedVars
            };
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
