'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * useAgentChat - Hook para preview de chat com agente
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Este hook gerencia o estado de uma conversa de teste com o agente.
 * Usado no componente de preview para testar configurações do agente.
 * 
 * MELHORIAS:
 * - Debounce de 1.5s para acumular mensagens rápidas
 * - Suporte a threadId para persistência  
 */

import { useState, useCallback, useTransition, useRef, useEffect } from 'react';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    toolCalls?: Array<{
        name: string;
        input: Record<string, unknown>;
        result?: Record<string, unknown>;
    }>;
    isLoading?: boolean;
    error?: string;
}

interface UseAgentChatOptions {
    agentId: string;
    threadId?: string; // Opcional: para persistência de contexto
    onError?: (error: Error) => void;
    debounceMs?: number; // Tempo de debounce em ms (default: 1500)
}

interface UseAgentChatReturn {
    messages: ChatMessage[];
    isLoading: boolean;
    isTyping: boolean; // Indica que está esperando mais input
    error: string | null;
    sendMessage: (content: string) => void; // Retorna void, pois é debounced
    clearMessages: () => void;
    retryLastMessage: () => Promise<void>;
    threadId: string | null;
}

// Constantes
const DEFAULT_DEBOUNCE_MS = 1500;

/**
 * Hook para gerenciar chat com agente
 * 
 * @example
 * const { messages, sendMessage, isLoading, isTyping } = useAgentChat({ agentId: '123' });
 * 
 * sendMessage('Olá'); // Acumula mensagens por 1.5s
 * sendMessage('Meu nome é João'); // Concatena com a anterior
 */
export function useAgentChat(options: UseAgentChatOptions): UseAgentChatReturn {
    const { agentId, threadId: externalThreadId, onError, debounceMs = DEFAULT_DEBOUNCE_MS } = options;

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isPending] = useTransition();
    const [isLoading, setIsLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [threadId, setThreadId] = useState<string | null>(externalThreadId || null);

    // Refs para debounce
    const messageBufferRef = useRef<string[]>([]);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Gera um ID único para mensagens
     */
    const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    /**
     * Processa e envia as mensagens acumuladas
     */
    const processBufferedMessages = useCallback(async () => {
        const bufferedContent = messageBufferRef.current.join('\n').trim();
        messageBufferRef.current = [];
        setIsTyping(false);

        if (!bufferedContent) return;

        setError(null);

        // Adiciona mensagem do usuário (pode conter múltiplas linhas)
        const userMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: bufferedContent,
            timestamp: new Date(),
        };

        // Adiciona placeholder de loading para resposta
        const assistantPlaceholder: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isLoading: true,
        };

        setMessages(prev => [...prev, userMessage, assistantPlaceholder]);
        setIsLoading(true);

        try {
            // Chama API para processar mensagem
            const response = await fetch('/api/chat/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    agentId,
                    threadId, // Envia threadId se disponível
                    message: bufferedContent,
                    history: messages.map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status}`);
            }

            const data = await response.json();

            // Atualiza threadId se retornado
            if (data.threadId && !threadId) {
                setThreadId(data.threadId);
            }

            // Atualiza mensagem com resposta real
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === assistantPlaceholder.id
                        ? {
                            ...msg,
                            content: data.text,
                            toolCalls: data.toolCalls,
                            isLoading: false,
                        }
                        : msg
                )
            );
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';

            // Atualiza placeholder com erro
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === assistantPlaceholder.id
                        ? {
                            ...msg,
                            content: 'Desculpe, ocorreu um erro ao processar sua mensagem.',
                            isLoading: false,
                            error: errorMessage,
                        }
                        : msg
                )
            );

            setError(errorMessage);
            onError?.(err instanceof Error ? err : new Error(errorMessage));
        } finally {
            setIsLoading(false);
        }
    }, [agentId, messages, onError, threadId]);

    /**
     * Envia uma mensagem para o agente (com debounce)
     * Acumula mensagens rápidas em uma só
     */
    const sendMessage = useCallback((content: string) => {
        if (!content.trim()) return;

        // Adiciona ao buffer
        messageBufferRef.current.push(content.trim());
        setIsTyping(true);

        // Limpa timer anterior
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Configura novo timer
        debounceTimerRef.current = setTimeout(() => {
            processBufferedMessages();
        }, debounceMs);
    }, [debounceMs, processBufferedMessages]);

    /**
     * Limpa todas as mensagens
     */
    const clearMessages = useCallback(() => {
        setMessages([]);
        setError(null);
        setThreadId(null);
        messageBufferRef.current = [];
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        setIsTyping(false);
    }, []);

    /**
     * Tenta reenviar a última mensagem do usuário
     */
    const retryLastMessage = useCallback(async () => {
        // Encontra a última mensagem do usuário
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');

        if (lastUserMessage) {
            // Remove a última resposta com erro
            setMessages(prev => {
                // Encontra a última mensagem do assistente manualmente para compatibilidade
                let lastAssistantIndex = -1;
                for (let i = prev.length - 1; i >= 0; i--) {
                    if (prev[i]?.role === 'assistant') {
                        lastAssistantIndex = i;
                        break;
                    }
                }

                if (lastAssistantIndex > -1 && prev[lastAssistantIndex]?.error) {
                    return prev.slice(0, lastAssistantIndex);
                }
                return prev;
            });

            // Reenvia diretamente (sem debounce)
            messageBufferRef.current = [lastUserMessage.content];
            await processBufferedMessages();
        }
    }, [messages, processBufferedMessages]);

    // Cleanup no unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return {
        messages,
        isLoading: isLoading || isPending,
        isTyping,
        error,
        sendMessage,
        clearMessages,
        retryLastMessage,
        threadId,
    };
}

/**
 * Hook simplificado para status de conexão
 */
export function useAIStatus() {
    const [isConnected, setIsConnected] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    const checkConnection = useCallback(async () => {
        setIsChecking(true);
        try {
            const response = await fetch('/api/health/ai');
            setIsConnected(response.ok);
        } catch {
            setIsConnected(false);
        } finally {
            setIsChecking(false);
        }
    }, []);

    return {
        isConnected,
        isChecking,
        checkConnection,
    };
}
