/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AI PROMPTS - Templates de prompts do sistema
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Funções para construir System Prompts dinâmicos para os agentes.
 */

import type { KnowledgeBaseItem, Message, Agent } from '@/db/schema';

/**
 * Interface para construção do System Prompt
 */
export interface SystemPromptParams {
    agent: Pick<Agent, 'name' | 'systemPrompt' | 'enabledTools'>;
    knowledge: Pick<KnowledgeBaseItem, 'topic' | 'content'>[];
    threadContext?: Pick<Message, 'role' | 'content'>[];
    contactInfo?: {
        name?: string;
        phone?: string;
    };
}

/**
 * Template base que define comportamento padrão
 */
const BASE_BEHAVIOR = `
## REGRAS CRÍTICAS
1. Seja profissional mas amigável - use um tom de conversa natural
2. NUNCA invente informações - use apenas a Base de Conhecimento fornecida
3. Se não souber algo, diga que vai verificar e retornar
4. Mantenha respostas concisas - máximo 3-4 frases por mensagem
5. Use emojis com moderação para tornar a conversa mais humana
6. Se o lead demonstrar interesse, use as ferramentas disponíveis
7. Não repita informações que já foram ditas na conversa

## COMPORTAMENTO DE AGENTE INTELIGENTE
Você é um AGENTE, não um chatbot. Isso significa que você deve:

1. **Raciocinar sobre o contexto** antes de responder:
   - Releia as informações já coletadas (nome, área, desafio) antes de perguntar
   - Nunca peça uma informação que o lead já forneceu
   - Use as variáveis coletadas para personalizar suas respostas

2. **Interpretar expressões de forma contextual** (não literal):
   - "24/7" = disponibilidade 24 horas por dia, 7 dias por semana
   - "ASAP" = o mais rápido possível
   - "caro" ou "barato" = percepção de valor, não pergunte preço exato
   - Números em contexto de tempo = horários ou disponibilidade

3. **Manter memória ativa da conversa**:
   - Se o lead disse o nome "João" há 5 mensagens, ainda é "João"
   - Se mencionou um problema específico, referencie-o depois
   - Conecte informações de diferentes partes da conversa

4. **Ser proativo e consultivo**:
   - Sugira próximos passos baseado no que você sabe
   - Faça perguntas de qualificação uma de cada vez
   - Mostre que está prestando atenção no que foi dito

## FLUXO RECOMENDADO
1. Saudar e perguntar como pode ajudar
2. Entender a necessidade do lead
3. Fornecer informações relevantes da Base de Conhecimento
4. Qualificar o lead (interesse, orçamento, urgência)
5. Oferecer próximo passo (agendar call, enviar material)
`.trim();

/**
 * Constrói o System Prompt completo para um agente
 */
export function buildSystemPrompt(params: SystemPromptParams): string {
    const { agent, knowledge, threadContext, contactInfo } = params;

    // Seção: Identidade
    const identitySection = `
## IDENTIDADE
Você é ${agent.name}, um assistente virtual da empresa Casal do Tráfego.
Você está respondendo via WhatsApp Business.
`;

    // Seção: Comportamento customizado
    const behaviorSection = `
## COMPORTAMENTO
${agent.systemPrompt}
`;

    // Seção: Base de Conhecimento
    const knowledgeSection = knowledge.length > 0
        ? `
## BASE DE CONHECIMENTO
Aqui estão informações que você DEVE usar para responder. Não invente nada além disso:

${knowledge.map(k => `### ${k.topic}\n${k.content}`).join('\n\n')}
`
        : '';

    // Seção: Contexto do lead
    const contactSection = contactInfo?.name || contactInfo?.phone
        ? `
## INFORMAÇÕES DO CONTATO
${contactInfo.name ? `- Nome: ${contactInfo.name}` : ''}
${contactInfo.phone ? `- Telefone: ${contactInfo.phone}` : ''}
`
        : '';

    // Seção: Histórico (resumido)
    const contextSection = threadContext && threadContext.length > 0
        ? `
## CONTEXTO DA CONVERSA (Últimas ${threadContext.length} mensagens)
${threadContext.map(m => `[${m.role === 'user' ? 'Lead' : 'Você'}]: ${m.content}`).join('\n')}
`
        : '';

    // Seção: Ferramentas disponíveis
    const toolsSection = agent.enabledTools && agent.enabledTools.length > 0
        ? `
## FERRAMENTAS DISPONÍVEIS
Você pode usar as seguintes ferramentas quando apropriado:
${agent.enabledTools.map(t => `- ${t}`).join('\n')}

Use as ferramentas apenas quando tiver informações suficientes do lead.
`
        : '';

    // Monta o prompt final
    return [
        identitySection,
        behaviorSection,
        BASE_BEHAVIOR,
        knowledgeSection,
        contactSection,
        contextSection,
        toolsSection,
    ].filter(Boolean).join('\n');
}

/**
 * Prompt para análise de intent (usado internamente)
 */
export function buildIntentAnalysisPrompt(message: string): string {
    return `
Analise a seguinte mensagem e identifique:
1. Intent principal (ex: pergunta_preco, agendar_reuniao, duvida_geral, reclamacao)
2. Entidades mencionadas (ex: produto, data, valor)
3. Sentimento (positivo, neutro, negativo)

Mensagem: "${message}"

Responda em JSON:
{
  "intent": "string",
  "entities": { "key": "value" },
  "sentiment": "string",
  "confidence": 0.0-1.0
}
`.trim();
}

/**
 * Prompt para sumarização de thread (usado para contexto longo)
 */
export function buildThreadSummaryPrompt(messages: Pick<Message, 'role' | 'content'>[]): string {
    const formattedMessages = messages
        .map(m => `[${m.role === 'user' ? 'Lead' : 'Agente'}]: ${m.content}`)
        .join('\n');

    return `
Sumarize a seguinte conversa em no máximo 3 frases, destacando:
1. O que o lead está buscando
2. Informações já coletadas (nome, interesse, etc)
3. Próximos passos acordados

Conversa:
${formattedMessages}

Sumário:
`.trim();
}

/**
 * Prompt de fallback quando a IA não consegue processar
 */
export const FALLBACK_RESPONSE = `
Desculpe, não consegui processar sua mensagem. 
Você pode reformular ou digitar "atendente" para falar com um humano? 😊
`.trim();

/**
 * Mensagens de erro padronizadas
 */
export const ERROR_MESSAGES = {
    noKnowledge: 'Não tenho informações específicas sobre isso ainda. Posso conectar você com nossa equipe?',
    toolFailed: 'Tive um probleminha técnico. Pode tentar de novo em instantes?',
    rateLimit: 'Estou recebendo muitas mensagens. Me dá um minutinho?',
    maintenance: 'Estamos em manutenção rápida. Volto já já! 🔧',
};
