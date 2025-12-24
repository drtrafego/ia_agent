'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header, PageWrapper } from '@/components/layout';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Avatar, AvatarFallback } from '@/components/ui';
import { TakeoverControl, TakeoverBadge } from '@/components/takeover';
import {
    ArrowLeft,
    Send,
    Phone,
    Mail,
    Calendar,
    User,
    MessageSquare,
    CheckCircle,
    Loader2,
} from 'lucide-react';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THREAD DETAIL PAGE - Conversa individual com controle Takeover
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface ThreadMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: string;
}

interface ThreadData {
    id: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string | null;
    status: 'active' | 'pending' | 'qualified' | 'booked' | 'archived';
    isHumanTakeover: boolean;
    takeoverReason: string | null;
    messageCount: number;
    currentStage: string;
    firstInteractionAt: string;
    lastInteractionAt: string;
    variables: Record<string, string>;
    messages: ThreadMessage[];
}

const statusConfig: Record<string, { label: string; variant: 'active' | 'pending' | 'qualified' | 'booked' | 'archived' }> = {
    active: { label: 'Ativo', variant: 'active' },
    pending: { label: 'Aguardando', variant: 'pending' },
    qualified: { label: 'Qualificado', variant: 'qualified' },
    booked: { label: 'Agendado', variant: 'booked' },
    archived: { label: 'Arquivado', variant: 'archived' },
};

export default function ThreadDetailPage() {
    const params = useParams();
    const threadId = params.threadId as string;

    const [thread, setThread] = useState<ThreadData | null>(null);
    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isHumanTakeover, setIsHumanTakeover] = useState(false);
    const [newMessage, setNewMessage] = useState('');

    // Carregar thread ao montar
    useEffect(() => {
        async function loadThread() {
            if (!threadId) return;

            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/threads/${threadId}`);

                if (!response.ok) {
                    if (response.status === 404) {
                        setError('Conversa não encontrada');
                    } else {
                        setError('Erro ao carregar conversa');
                    }
                    return;
                }

                const data = await response.json();
                setThread(data);
                setMessages(data.messages || []);
                setIsHumanTakeover(data.isHumanTakeover || false);
            } catch (err) {
                console.error('Erro ao carregar thread:', err);
                setError('Erro ao carregar conversa');
            } finally {
                setIsLoading(false);
            }
        }

        loadThread();
    }, [threadId]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !thread) return;

        // Adicionar mensagem localmente
        const tempMessage: ThreadMessage = {
            id: `temp-${Date.now()}`,
            role: 'assistant',
            content: newMessage,
            createdAt: new Date().toISOString(),
        };

        setMessages(prev => [...prev, tempMessage]);
        setNewMessage('');

        // TODO: Enviar para API de mensagem humana
    };

    // Loading state
    if (isLoading) {
        return (
            <>
                <Header title="Conversa" description="Carregando...">
                    <Link href="/dashboard/threads">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4" />
                            Voltar
                        </Button>
                    </Link>
                </Header>
                <PageWrapper>
                    <div className="flex items-center justify-center h-96">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                </PageWrapper>
            </>
        );
    }

    // Error state
    if (error || !thread) {
        return (
            <>
                <Header title="Conversa" description="Erro">
                    <Link href="/dashboard/threads">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4" />
                            Voltar
                        </Button>
                    </Link>
                </Header>
                <PageWrapper>
                    <div className="flex flex-col items-center justify-center h-96 text-center">
                        <MessageSquare className="h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900">{error || 'Conversa não encontrada'}</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            A conversa pode ter sido arquivada ou não existe.
                        </p>
                        <Link href="/dashboard/threads" className="mt-4">
                            <Button variant="outline">Ver todas as conversas</Button>
                        </Link>
                    </div>
                </PageWrapper>
            </>
        );
    }

    const initials = thread.contactName
        .split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    return (
        <>
            <Header title="Conversa" description={thread.contactName}>
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/threads">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4" />
                            Voltar
                        </Button>
                    </Link>
                    <Badge variant={statusConfig[thread.status]?.variant || 'default'}>
                        {statusConfig[thread.status]?.label || thread.status}
                    </Badge>
                    <TakeoverBadge isHumanTakeover={isHumanTakeover} />
                </div>
            </Header>

            <PageWrapper>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
                    {/* Coluna 1: Chat */}
                    <div className="lg:col-span-2 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        {/* Messages */}
                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                                    <MessageSquare className="h-8 w-8 mb-2" />
                                    <p>Nenhuma mensagem ainda</p>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-slate-100 text-slate-900'
                                                }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                            <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                                                {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input */}
                        <div className="border-t border-slate-200 p-4">
                            {isHumanTakeover ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Digite sua mensagem (você está no controle)..."
                                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    />
                                    <Button variant="primary" onClick={handleSendMessage}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center py-2 text-sm text-slate-500 bg-slate-50 rounded-xl">
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    O agente está respondendo automaticamente
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Coluna 2: Info do Lead + Takeover */}
                    <div className="space-y-4">
                        {/* Takeover Control */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Controle da Conversa</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <TakeoverControl
                                    threadId={threadId}
                                    userId="default-user"
                                    isHumanTakeover={isHumanTakeover}
                                    onStatusChange={setIsHumanTakeover}
                                />
                            </CardContent>
                        </Card>

                        {/* Lead Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Informações do Lead</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-12 w-12">
                                        <AvatarFallback>{initials}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium text-slate-900">{thread.contactName}</p>
                                        <p className="text-sm text-slate-500">{thread.currentStage}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {thread.contactPhone && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Phone className="h-4 w-4 text-slate-400" />
                                            {thread.contactPhone}
                                        </div>
                                    )}
                                    {thread.contactEmail && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Mail className="h-4 w-4 text-slate-400" />
                                            {thread.contactEmail}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <MessageSquare className="h-4 w-4 text-slate-400" />
                                        {thread.messageCount} mensagens
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Variables */}
                        {thread.variables && Object.keys(thread.variables).length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Variáveis Coletadas</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {Object.entries(thread.variables).map(([key, value]) => (
                                            <div key={key} className="flex items-center justify-between text-sm">
                                                <span className="text-slate-500">{key}</span>
                                                <span className="font-medium text-slate-900 flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                                    {value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Ações Rápidas</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button variant="outline" size="sm" className="w-full justify-start">
                                    <Calendar className="h-4 w-4" />
                                    Agendar Reunião
                                </Button>
                                <Button variant="outline" size="sm" className="w-full justify-start">
                                    <User className="h-4 w-4" />
                                    Criar Lead no CRM
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </PageWrapper>
        </>
    );
}
