/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLE EXTRACTOR - Extração de variáveis via LLM
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Este módulo usa a IA para extrair variáveis estruturadas das mensagens.
 * Ex: "Meu nome é João e meu email é joao@test.com"
 * -> { "data.nome": "João", "data.email": "joao@test.com" }
 */

import { generateText } from 'ai';
import { openai } from '@/lib/ai/config';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractionResult {
    success: boolean;
    variables: Record<string, unknown>;
    confidence: number;
    error?: string;
}

export interface ExtractionContext {
    message: string;
    targetVariables: string[];
    existingVariables?: Record<string, unknown>;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIABLE PATTERNS (Regex fallback)
// ─────────────────────────────────────────────────────────────────────────────

const PATTERNS = {
    'data.nome': [
        /(?:me\s+chamo|meu\s+nome\s+[ée]|sou\s+o|sou\s+a|sou)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i,
        /([A-ZÀ-Ú][a-zà-ú]+)\s+(?:aqui|falando)/i,
    ],
    'data.email': [
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    ],
    'data.telefone': [
        /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-.\s]?\d{4}/,
    ],
    'data.interesse': [
        /(?:interessado\s+em|quero\s+saber\s+sobre|procurando|preciso\s+de)\s+(.+?)(?:\.|$)/i,
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrai variáveis usando LLM
 */
export async function extractVariablesWithLLM(
    context: ExtractionContext
): Promise<ExtractionResult> {
    const { message, targetVariables, existingVariables = {}, conversationHistory = [] } = context;

    const systemPrompt = `Você é um extrator de dados. Sua tarefa é identificar informações específicas na mensagem do usuário.

VARIÁVEIS A EXTRAIR:
${targetVariables.map(v => `- ${v}`).join('\n')}

VARIÁVEIS JÁ CONHECIDAS:
${Object.entries(existingVariables).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'Nenhuma'}

REGRAS:
1. Retorne APENAS um JSON válido
2. Inclua apenas variáveis que você conseguiu extrair da mensagem
3. Use exatamente os nomes das variáveis especificadas
4. Se não encontrar um dado, NÃO inclua no JSON
5. Para data.nome, extraia o nome completo se possível
6. Para data.email, valide o formato
7. Para data.telefone, inclua com DDD

FORMATO DE RESPOSTA (apenas JSON, nada mais):
{
    "data.nome": "valor ou null",
    "data.email": "valor ou null"
}`;

    const historyContext = conversationHistory.length > 0
        ? `\n\nCONTEXTO DA CONVERSA:\n${conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}`
        : '';

    try {
        const result = await generateText({
            model: openai('gpt-4o-mini'),
            system: systemPrompt,
            prompt: `Mensagem do usuário: "${message}"${historyContext}\n\nExtraia as variáveis em formato JSON:`,
            temperature: 0.1, // Baixa temperatura para consistência
            maxTokens: 500,
        });

        // Parse do JSON
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            return {
                success: false,
                variables: {},
                confidence: 0,
                error: 'Não foi possível extrair JSON da resposta',
            };
        }

        const extracted = JSON.parse(jsonMatch[0]);

        // Filtrar valores null/undefined
        const cleanedVariables: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(extracted)) {
            if (value !== null && value !== undefined && value !== '') {
                cleanedVariables[key] = value;
            }
        }

        return {
            success: true,
            variables: cleanedVariables,
            confidence: Object.keys(cleanedVariables).length / targetVariables.length,
        };
    } catch (error) {
        console.error('[VariableExtractor] Erro LLM:', error);

        // Fallback para regex
        return extractVariablesWithRegex(message, targetVariables);
    }
}

/**
 * Extrai variáveis usando regex (fallback)
 */
export function extractVariablesWithRegex(
    message: string,
    targetVariables: string[]
): ExtractionResult {
    const variables: Record<string, unknown> = {};

    for (const varName of targetVariables) {
        const patterns = PATTERNS[varName as keyof typeof PATTERNS];

        if (!patterns) continue;

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                variables[varName] = match[1].trim();
                break;
            }
        }
    }

    return {
        success: Object.keys(variables).length > 0,
        variables,
        confidence: Object.keys(variables).length / targetVariables.length,
    };
}

/**
 * Combina variáveis existentes com novas extraídas
 * IMPORTANTE: Não sobrescreve valores válidos existentes com valores vazios
 */
export function mergeVariables(
    existing: Record<string, unknown>,
    extracted: Record<string, unknown>
): Record<string, unknown> {
    const result = { ...existing };

    for (const [key, value] of Object.entries(extracted)) {
        const existingValue = existing[key];

        // Verifica se já existe um valor válido
        const hasExistingValue = existingValue !== undefined &&
            existingValue !== null &&
            existingValue !== '';

        // Verifica se o novo valor é válido
        const hasNewValue = value !== undefined && value !== null && value !== '';

        // Só atualiza se:
        // 1. Não existe valor anterior válido, OU
        // 2. O novo valor também é válido (não vazio)
        if (!hasExistingValue || hasNewValue) {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Valida se todas as variáveis obrigatórias estão preenchidas
 */
export function validateRequiredVariables(
    variables: Record<string, unknown>,
    required: string[]
): { isValid: boolean; missing: string[] } {
    const missing = required.filter(varName => {
        const value = variables[varName];
        return value === undefined || value === null || value === '';
    });

    return {
        isValid: missing.length === 0,
        missing,
    };
}

/**
 * Formata variáveis para exibição no chat
 */
export function formatVariablesForDisplay(
    variables: Record<string, unknown>
): string {
    return Object.entries(variables)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => {
            // Remove prefixo "data."
            const cleanKey = k.replace('data.', '');
            return `${cleanKey}: ${v}`;
        })
        .join('\n');
}

/**
 * Normaliza o nome de uma variável
 */
export function normalizeVariableName(name: string): string {
    // Garantir que começa com "data."
    if (!name.startsWith('data.')) {
        return `data.${name.toLowerCase().replace(/\s+/g, '_')}`;
    }
    return name.toLowerCase();
}
