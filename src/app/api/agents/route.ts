import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agents, users, agentStages } from '@/db/schema';

// 6 Estágios padrão - Fluxo focado em DOR e natural
const DEFAULT_STAGES = [
    {
        name: 'Identificação',
        type: 'identify' as const,
        order: 0,
        instructions: `## OBJETIVO
Conhecer o lead e criar rapport inicial.

## AÇÕES
1. Cumprimente de forma calorosa e natural
2. Pergunte o NOME do lead
3. Pergunte com o que trabalha ou qual é o negócio dele

## IMPORTANTE
- Se o lead manifestar INTERESSE DIRETO no produto (ex: "quero contratar", "quero saber mais", "quero agendar"), pule para agendamento
- Seja BREVE e natural

## TRANSIÇÃO
Avance quando souber nome e área de atuação.`,
        entryCondition: 'Estágio inicial',
        requiredVariables: ['nome', 'area'],
    },
    {
        name: 'Entendimento',
        type: 'diagnosis' as const,
        order: 1,
        instructions: `## OBJETIVO
Entender a DOR real do lead de forma natural.

## PERGUNTAS SUTIS (uma por vez)
- "O que te fez buscar essa solução?"
- "Como está sendo lidar com [área mencionada] hoje?"
- "Qual seria o cenário ideal pra você?"

## NÃO PERGUNTE
- Faturamento
- Tamanho da operação
- Quantos funcionários

## SE ELE MENCIONAR VOLUME DE LEADS
Pergunte: "Quantos leads você recebe em média por dia?"

## SE ELE DEMONSTRAR INTERESSE DIRETO
Pule para oferecer agendamento: "Posso te mostrar como funciona na prática em uma chamada rápida?"

## TRANSIÇÃO
Avance quando entender a dor principal.`,
        entryCondition: 'Lead identificado',
        requiredVariables: ['desafio'],
    },
    {
        name: 'Qualificação',
        type: 'custom' as const,
        order: 2,
        instructions: `## OBJETIVO
Entender melhor o contexto para personalizar a solução.

## PERGUNTAS SUTIS (baseadas na dor que ele mencionou)
- Se falou de leads: "Quantos leads você recebe por dia?"
- Se falou de atendimento: "Quantas pessoas cuidam do atendimento hoje?"
- Se falou de tempo: "Quanto tempo você gasta com isso?"

## NÃO PERGUNTE
- Faturamento
- Tamanho da empresa
- CNPJ ou dados sensíveis

## TRANSIÇÃO
Avance quando tiver um dado quantitativo sobre a dor.`,
        entryCondition: 'Dor identificada',
        requiredVariables: [],
    },
    {
        name: 'Apresentação',
        type: 'custom' as const,
        order: 3,
        instructions: `## OBJETIVO
Conectar a dor com a solução de forma breve.

## AÇÕES
1. Mostre que entendeu a dor
2. Dê 1-2 benefícios específicos para o caso dele
3. Gere curiosidade: "Posso te mostrar como funciona na prática?"

## NÃO FAÇA
- Monólogos longos
- Listas de features
- Comparações com concorrentes

## TRANSIÇÃO
Avance quando ele demonstrar interesse.`,
        entryCondition: 'Lead qualificado',
        requiredVariables: [],
    },
    {
        name: 'Agendamento',
        type: 'schedule' as const,
        order: 4,
        instructions: `## OBJETIVO
Agendar uma chamada de demonstração.

## AÇÕES
1. Proponha uma chamada rápida de 15-20 min
2. Ofereça 2-3 horários específicos
3. Se aceitar, use a tool schedule_meeting

## SE ELE PEDIR PARA AGENDAR DIRETO
Aceite imediatamente! Não insista em mais perguntas.

## COMPORTAMENTO
- Horários CONSISTENTES - não mude se ele recusar uma vez
- Seja flexível com o dia
- Confirme para ter certeza: "Dia X às Y, pode ser?"

## TRANSIÇÃO
Após confirmação, avance para encerramento.`,
        entryCondition: 'Lead interessado',
        requiredVariables: ['data_reuniao', 'horario_reuniao'],
    },
    {
        name: 'Confirmação',
        type: 'handoff' as const,
        order: 5,
        instructions: `## OBJETIVO
Confirmar e encerrar com excelência.

## AÇÕES
1. Confirme os dados: data, hora
2. Peça email para enviar o convite
3. Agradeça e gere expectativa: "Vai ser uma conversa bem produtiva!"

## ENCERRAMENTO
Seja breve e caloroso.`,
        entryCondition: 'Reunião agendada',
        requiredVariables: ['email'],
    },
];

/**
 * GET /api/agents - Listar todos os agentes
 */
export async function GET() {
    try {
        const allAgents = await db.query.agents.findMany({
            orderBy: (agents, { desc }) => [desc(agents.createdAt)],
        });

        const formattedAgents = allAgents.map(agent => ({
            id: agent.id,
            name: agent.name,
            description: agent.description,
            isActive: agent.isActive,
            isDefault: agent.isDefault,
            modelConfig: agent.modelConfig,
            messagesCount: 0,
            threadsCount: 0,
        }));

        return NextResponse.json({ agents: formattedAgents });
    } catch (error) {
        console.error('[API] Erro ao listar agentes:', error);
        return NextResponse.json(
            { error: 'Erro ao carregar agentes' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents - Criar novo agente com estágios padrão
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();

        let userId = body.userId || process.env.DEFAULT_USER_ID;

        if (!userId) {
            const firstUser = await db.query.users.findFirst();
            if (firstUser) {
                userId = firstUser.id;
            } else {
                const result = await db.insert(users).values({
                    name: 'Admin',
                    email: 'admin@ia-agent.com',
                }).returning();

                const newUser = result?.[0];
                if (newUser) {
                    userId = newUser.id;
                } else {
                    throw new Error('Não foi possível definir usuário.');
                }
            }
        }

        if (!userId) {
            throw new Error('UserId inválido.');
        }

        // 1. Criar o agente
        const [newAgent] = await db.insert(agents).values({
            name: body.name,
            description: body.description || null,
            systemPrompt: body.systemPrompt || 'Você é um assistente prestativo.',
            modelConfig: body.modelConfig || { model: 'gpt-4o', provider: 'openai', temperature: 0.7 },
            isActive: body.isActive ?? false,
            isDefault: body.isDefault ?? false,
            userId: userId,
        }).returning();

        // 2. Inserir os estágios padrão
        if (newAgent) {
            try {
                await db.insert(agentStages).values(
                    DEFAULT_STAGES.map(stage => ({
                        agentId: newAgent.id,
                        name: stage.name,
                        type: stage.type,
                        order: stage.order,
                        instructions: stage.instructions,
                        entryCondition: stage.entryCondition,
                        requiredVariables: stage.requiredVariables,
                        isActive: true,
                    }))
                );
                console.log(`[API] ✅ Agente "${newAgent.name}" criado com 6 estágios`);
            } catch (stageError) {
                console.error('[API] Erro ao inserir estágios:', stageError);
            }
        }

        return NextResponse.json({ agent: newAgent }, { status: 201 });
    } catch (error) {
        console.error('[API] Erro ao criar agente:', error);
        return NextResponse.json(
            { error: 'Erro ao criar agente' },
            { status: 500 }
        );
    }
}
