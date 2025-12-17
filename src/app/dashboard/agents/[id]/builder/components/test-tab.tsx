'use client';

import { useBuilderStore } from '@/stores/builder-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Loader2, RotateCcw, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VariableInspector } from '@/components/agent-builder';

type Message = {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
};

export function TestTab() {
    const { agent } = useBuilderStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [threadId, setThreadId] = useState<string | null>(null);
    const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Estado para variáveis e estágios
    const [threadState, setThreadState] = useState<{
        currentStageId: string | null;
        variables: Record<string, unknown>;
        stages: any[];
    }>({ currentStageId: null, variables: {}, stages: [] });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Load previous session from localStorage if exists
    useEffect(() => {
        if (agent?.id) {
            const savedSession = localStorage.getItem(`test_session_${agent.id}`);
            if (savedSession) {
                try {
                    const session = JSON.parse(savedSession);
                    if (session.messages && session.threadId) {
                        setMessages(session.messages);
                        setThreadId(session.threadId);
                        setSessionStartTime(new Date(session.startTime));
                    }
                } catch (e) {
                    console.error('Erro ao carregar sessão anterior:', e);
                }
            }
        }
    }, [agent?.id]);

    // Save session when messages change
    useEffect(() => {
        if (agent?.id && threadId && messages.length > 0) {
            const session = {
                messages,
                threadId,
                startTime: sessionStartTime || new Date(),
            };
            localStorage.setItem(`test_session_${agent.id}`, JSON.stringify(session));
        }
    }, [messages, threadId, agent?.id, sessionStartTime]);

    async function handleSend() {
        if (!input.trim() || !agent) return;

        const userMsg = input.trim();
        setInput('');
        const newUserMessage: Message = { role: 'user', content: userMsg, timestamp: new Date() };
        setMessages(prev => [...prev, newUserMessage]);
        setIsLoading(true);

        if (!sessionStartTime) {
            setSessionStartTime(new Date());
        }

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg,
                    agentId: agent.id,
                    threadId
                })
            });

            const data = await res.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.threadId) {
                setThreadId(data.threadId);
            }

            const assistantMessage: Message = { role: 'assistant', content: data.response, timestamp: new Date() };
            setMessages(prev => [...prev, assistantMessage]);

            // Buscar estado atualizado da thread
            if (data.threadId) {
                fetchThreadState(data.threadId);
            }
        } catch (error) {
            const errorMessage: Message = { role: 'assistant', content: `❌ Erro: ${String(error)}`, timestamp: new Date() };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }

    // Buscar estado da thread (estágio atual + variáveis)
    async function fetchThreadState(tid: string) {
        try {
            const res = await fetch(`/api/threads/${tid}/state`);
            const data = await res.json();

            if (!data.error) {
                setThreadState({
                    currentStageId: data.currentStageId,
                    variables: data.variables || {},
                    stages: data.stages || [],
                });
            }
        } catch (error) {
            console.error('Erro ao buscar estado:', error);
        }
    }

    // Atualizar estado quando threadId mudar
    useEffect(() => {
        if (threadId) {
            fetchThreadState(threadId);
        }
    }, [threadId]);

    function handleReset() {
        setMessages([]);
        setThreadId(null);
        setSessionStartTime(null);
        if (agent?.id) {
            localStorage.removeItem(`test_session_${agent.id}`);
        }
    }

    return (
        <div className="flex h-full gap-6 max-w-6xl mx-auto">
            {/* Chat Area */}
            <Card className="flex-1 flex flex-col h-[600px]">
                <CardHeader className="border-b py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        Preview: {agent?.name}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={handleReset} title="Reiniciar conversa">
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                </CardHeader>

                <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
                    <div className="space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center text-muted-foreground text-sm py-10">
                                Envie uma mensagem para testar o fluxo do seu agente.
                            </div>
                        )}

                        {messages.map((m, i) => (
                            <div key={i} className={cn(
                                "flex gap-3 max-w-[80%]",
                                m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                            )}>
                                <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                                    m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
                                )}>
                                    {m.role === 'user' ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                </div>
                                <div className={cn(
                                    "p-3 rounded-lg text-sm",
                                    m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted"
                                )}>
                                    {m.content}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex gap-3 mr-auto max-w-[80%]">
                                <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-muted">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                                <div className="bg-muted p-3 rounded-lg text-xs text-muted-foreground italic">
                                    Digitando...
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <CardFooter className="p-3 border-t">
                    <form
                        className="flex w-full gap-2"
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    >
                        <Input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Digite uma mensagem..."
                            disabled={isLoading}
                        />
                        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </CardFooter>
            </Card>

            {/* Debug Info Sidebar with VariableInspector */}
            <Card className="w-80 h-[600px] hidden md:flex flex-col">
                <CardHeader className="border-b py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">Debug Sessão</CardTitle>
                    {threadId && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchThreadState(threadId)}
                            title="Atualizar estado"
                        >
                            <RefreshCw className="h-3 w-3" />
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="p-4 space-y-4 overflow-auto flex-1">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Thread ID</label>
                        <div className="text-xs font-mono bg-muted p-2 rounded flex items-center justify-between gap-2">
                            <span className="truncate">{threadId || 'Nenhuma thread ativa'}</span>
                            {threadId && (
                                <a
                                    href={`/dashboard/threads/${threadId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Mensagens</label>
                        <div className="text-xs font-mono bg-muted p-2 rounded">
                            {messages.length} mensagem(ns)
                        </div>
                    </div>

                    {sessionStartTime && (
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase">Sessão Iniciada</label>
                            <div className="text-xs font-mono bg-muted p-2 rounded">
                                {sessionStartTime.toLocaleTimeString('pt-BR')}
                            </div>
                        </div>
                    )}

                    {/* Integração do VariableInspector */}
                    {threadId && threadState.stages.length > 0 && (
                        <div className="border-t pt-4 mt-4">
                            <VariableInspector
                                stages={threadState.stages}
                                currentStageId={threadState.currentStageId || ''}
                                variables={threadState.variables}
                            />
                        </div>
                    )}

                    <div className="border-t pt-4 mt-4">
                        <p className="text-xs text-muted-foreground">
                            💡 As conversas de teste são salvas localmente e persistem entre recarregamentos.
                        </p>
                        {threadId && (
                            <p className="text-xs text-muted-foreground mt-2">
                                Clique no ícone ao lado do Thread ID para ver a conversa completa na seção de Threads.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
