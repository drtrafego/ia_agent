const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

// Estágios atualizados - focados em DOR, sutis, sem faturamento
const UPDATED_STAGES = [
    {
        name: 'Identificação',
        type: 'identify',
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
        entry_condition: 'Estágio inicial',
        required_variables: ['nome', 'area'],
    },
    {
        name: 'Entendimento',
        type: 'diagnosis',
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
        entry_condition: 'Lead identificado',
        required_variables: ['desafio'],
    },
    {
        name: 'Qualificação',
        type: 'custom',
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
        entry_condition: 'Dor identificada',
        required_variables: [],
    },
    {
        name: 'Apresentação',
        type: 'custom',
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
        entry_condition: 'Lead qualificado',
        required_variables: [],
    },
    {
        name: 'Agendamento',
        type: 'schedule',
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
        entry_condition: 'Lead interessado',
        required_variables: ['data_reuniao', 'horario_reuniao'],
    },
    {
        name: 'Confirmação',
        type: 'handoff',
        order: 5,
        instructions: `## OBJETIVO
Confirmar e encerrar com excelência.

## AÇÕES
1. Confirme os dados: data, hora
2. Peça email para enviar o convite
3. Agradeça e gere expectativa: "Vai ser uma conversa bem produtiva!"

## ENCERRAMENTO
Seja breve e caloroso.`,
        entry_condition: 'Reunião agendada',
        required_variables: ['email'],
    },
];

async function updateAllStages() {
    try {
        console.log('🔍 Buscando agentes...');

        const agents = await sql`SELECT id, name FROM agents`;
        console.log(`📋 Encontrados ${agents.length} agentes`);

        for (const agent of agents) {
            console.log(`\n🤖 Atualizando: ${agent.name}`);

            // Remove estágios existentes
            await sql`DELETE FROM agent_stages WHERE agent_id = ${agent.id}`;
            console.log(`  🗑️ Estágios antigos removidos`);

            // Insere novos estágios
            for (const stage of UPDATED_STAGES) {
                await sql`
                    INSERT INTO agent_stages (
                        agent_id, name, type, "order", instructions, 
                        entry_condition, required_variables, is_active
                    ) VALUES (
                        ${agent.id}, 
                        ${stage.name}, 
                        ${stage.type}, 
                        ${stage.order}, 
                        ${stage.instructions},
                        ${stage.entry_condition},
                        ${JSON.stringify(stage.required_variables)},
                        true
                    )
                `;
            }
            console.log(`  ✅ 6 novos estágios (focados em DOR) adicionados`);
        }

        console.log('\n🎉 Todos os agentes atualizados com os novos prompts!');
        console.log('\nMudanças principais:');
        console.log('- ❌ Removido: perguntas sobre faturamento/tamanho');
        console.log('- ✅ Adicionado: perguntas sutis sobre dor');
        console.log('- ✅ Se lead demonstrar interesse, pula para agendamento');

    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
    process.exit(0);
}

updateAllStages();
