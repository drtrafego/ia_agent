/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DEFAULT WORKFLOW TEMPLATES - Baseado no fluxo Zaia
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Estrutura de Atendimento (Overview Zaia):
 * 1. Identificação - Quem é você? Nome, área
 * 2. Entendimento - Qual sua dor/necessidade?
 * 3. Qualificação - É o perfil certo?
 * 4. Apresentação - Mostrar solução
 * 5. Agendamento - Marcar reunião
 * 6. Confirmação - Validar e encerrar
 */

import { type StageConfig, type StageType } from '@/db/schema';

// Simple ID generator
function generateId(): string {
    return `stage_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Template Zaia - Fluxo completo de atendimento
 */
export const ZAIA_WORKFLOW: StageConfig[] = [
    {
        id: generateId(),
        name: 'Identificação',
        type: 'identify' as StageType,
        order: 0,
        conditions: 'Estágio inicial - sempre começa aqui',
        prompt: `## OBJETIVO
Conhecer o lead e criar rapport inicial.

## AÇÕES
1. Cumprimente de forma calorosa e natural
2. Pergunte o NOME do lead
3. Pergunte qual é a área de atuação/nicho de mercado
4. Seja genuinamente interessado

## COMPORTAMENTO
- Seja amigável mas profissional
- Use o nome da pessoa após ela se apresentar
- Faça uma pergunta por vez

## TRANSIÇÃO
Avance para Entendimento quando souber nome e área do lead.`,
        requiredVariables: ['nome', 'area'],
    },
    {
        id: generateId(),
        name: 'Entendimento',
        type: 'diagnosis' as StageType,
        order: 1,
        conditions: 'Lead identificado com nome e área conhecidos',
        prompt: `## OBJETIVO
Entender profundamente a dor e necessidade do lead.

## AÇÕES
1. Pergunte qual o MAIOR DESAFIO ou problema atual
2. Entenda há quanto tempo enfrenta esse problema
3. Pergunte o que já tentou para resolver
4. Explore o impacto desse problema no negócio

## COMPORTAMENTO
- Faça perguntas de aprofundamento
- Demonstre empatia genuína
- NÃO AVANCE até realmente entender a dor
- Repita/parafraseie para confirmar entendimento

## TRANSIÇÃO
Avance para Qualificação quando tiver dor clara e específica identificada.`,
        requiredVariables: ['desafio', 'tempo_problema'],
    },
    {
        id: generateId(),
        name: 'Qualificação',
        type: 'custom' as StageType,
        order: 2,
        conditions: 'Dor identificada e compreendida',
        prompt: `## OBJETIVO
Verificar se o lead é perfil adequado para a solução.

## AÇÕES
1. Pergunte o faturamento aproximado ou tamanho da operação
2. Entenda a urgência em resolver o problema
3. Verifique se tem autonomia para decidir
4. Confirme interesse em conhecer uma solução

## COMPORTAMENTO
- Seja sutil nas perguntas de qualificação
- Não pareça um interrogatório
- Se não for perfil, seja educado e sugira alternativas

## TRANSIÇÃO
Se qualificado, avance para Apresentação. Se não, finalize educadamente.`,
        requiredVariables: ['faturamento', 'urgencia'],
    },
    {
        id: generateId(),
        name: 'Apresentação',
        type: 'custom' as StageType,
        order: 3,
        conditions: 'Lead qualificado e com perfil adequado',
        prompt: `## OBJETIVO
Apresentar a solução conectando com a dor do lead.

## AÇÕES
1. Conecte diretamente a dor com a solução
2. Apresente 2-3 benefícios mais relevantes para o caso
3. Use cases de sucesso similares se disponíveis
4. Gere curiosidade sobre como funciona na prática

## COMPORTAMENTO
- Personalize a apresentação com base no diagnóstico
- Não faça monólogos - mantenha interativo
- Responda dúvidas de forma objetiva
- Guie para o próximo passo naturalmente

## TRANSIÇÃO
Quando demonstrar interesse, avance para Agendamento.`,
        requiredVariables: [],
    },
    {
        id: generateId(),
        name: 'Agendamento',
        type: 'schedule' as StageType,
        order: 4,
        conditions: 'Lead interessado após apresentação',
        prompt: `## OBJETIVO
Agendar uma reunião de apresentação/diagnóstico aprofundado.

## AÇÕES
1. Proponha uma conversa rápida (15-30min) para mostrar na prática
2. Ofereça 2-3 HORÁRIOS ESPECÍFICOS próximos
3. Se houver objeção de tempo, reforce os mesmos horários
4. Use a tool schedule_meeting para confirmar

## COMPORTAMENTO CRÍTICO
- HORÁRIOS DEVEM SER CONSISTENTES
- NÃO mude os horários propostos se houver objeção
- Reforce o valor da reunião
- Seja flexível em dia, mas mantenha as opções claras

## TRANSIÇÃO
Após confirmação, avance para Confirmação.`,
        requiredVariables: ['data_reuniao', 'horario_reuniao'],
    },
    {
        id: generateId(),
        name: 'Confirmação',
        type: 'handoff' as StageType,
        order: 5,
        conditions: 'Reunião agendada com sucesso',
        prompt: `## OBJETIVO
Confirmar agendamento e encerrar com excelência.

## AÇÕES
1. Confirme data, hora e dados de contato
2. Informe que enviará um lembrete
3. Pergunte se há algo específico para preparar para a reunião
4. Agradeça e gere expectativa positiva

## COMPORTAMENTO
- Seja caloroso no encerramento
- Deixe claro os próximos passos
- Reforce o valor que será entregue na reunião

## ENCERRAMENTO
Este é o estágio final. A conversa pode ser arquivada após confirmação.`,
        requiredVariables: ['email', 'telefone'],
    },
];

/**
 * Gera um novo workflow com IDs únicos
 */
export function generateDefaultWorkflow(): StageConfig[] {
    return ZAIA_WORKFLOW.map(stage => ({
        ...stage,
        id: generateId(),
    }));
}

/**
 * Retorna template baseado no tipo de agente
 */
export function getWorkflowTemplate(agentType: string = 'default'): StageConfig[] {
    switch (agentType) {
        case 'vendas':
        case 'closer':
        case 'sdr':
        case 'zaia':
        default:
            return generateDefaultWorkflow();
    }
}
