'use client';

import { useBuilderStore } from '@/stores/builder-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

type Message = {
    role: 'user' | 'assistant';
    content: string;
};

export function TestTab() {
    const { agent } = useBuilderStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [threadId, setThreadId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    async function handleSend() {
        if (!input.trim() || !agent) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

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

            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${String(error)}` }]);
        } finally {
            setIsLoading(false);
        }
    }

    function handleReset() {
        setMessages([]);
        setThreadId(null);
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

            {/* Debug Info Sidebar */}
            <Card className="w-80 h-[600px] hidden md:flex flex-col">
                <CardHeader className="border-b py-3">
                    <CardTitle className="text-sm font-medium">Debug Sessão</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4 overflow-auto">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase">Thread ID</label>
                        <div className="text-xs font-mono bg-muted p-1 rounded truncate">{threadId || '-'}</div>
                    </div>
                    {/* Aqui poderíamos mostrar o estágio atual puxando da API tbm se quiséssemos */}
                    <div className="text-xs text-muted-foreground">
                        O painel de debug mostrará variáveis coletadas e estágio atual em uma atualização futura.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
