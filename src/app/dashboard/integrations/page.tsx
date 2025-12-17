'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header, PageWrapper, PageSection } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import {
    Chrome,
    MessageCircle,
    Check,
    X,
    ExternalLink,
    RefreshCw,
    Settings,
    AlertCircle,
    CheckCircle,
} from 'lucide-react';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * INTEGRATIONS PAGE - Conectar Google Calendar + WhatsApp
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface Integration {
    id: string;
    name: string;
    description: string;
    icon: typeof Chrome;
    color: string;
    connected: boolean;
    email?: string;
    phone?: string;
    features: { name: string; enabled: boolean }[];
    connectUrl?: string;
}

function IntegrationsContent() {
    const searchParams = useSearchParams();
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Verificar parâmetros de retorno do OAuth
    useEffect(() => {
        const success = searchParams.get('success');
        const error = searchParams.get('error');

        if (success === 'google_connected') {
            setNotification({ type: 'success', message: 'Google Calendar conectado com sucesso!' });
        } else if (error === 'access_denied') {
            setNotification({ type: 'error', message: 'Acesso negado. Tente novamente.' });
        } else if (error) {
            setNotification({ type: 'error', message: 'Erro ao conectar. Tente novamente.' });
        }

        // Limpar notificação após 5 segundos
        if (success || error) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }

        return undefined;
    }, [searchParams]);

    const integrations: Integration[] = [
        {
            id: 'google',
            name: 'Google',
            description: 'Calendar e Sheets',
            icon: Chrome,
            color: 'from-red-500 to-yellow-500',
            connected: false, // TODO: Buscar do banco
            email: undefined,
            features: [
                { name: 'Google Calendar', enabled: true },
                { name: 'Google Sheets', enabled: true },
            ],
            connectUrl: '/api/auth/google',
        },
        {
            id: 'meta',
            name: 'WhatsApp Business',
            description: 'Meta API',
            icon: MessageCircle,
            color: 'from-green-500 to-emerald-500',
            connected: false,
            phone: undefined,
            features: [
                { name: 'Enviar Mensagens', enabled: true },
                { name: 'Receber Mensagens', enabled: true },
                { name: 'Templates', enabled: false },
            ],
        },
    ];

    const handleConnect = async (integration: Integration) => {
        if (integration.connectUrl) {
            try {
                const response = await fetch(integration.connectUrl);
                const data = await response.json();

                if (data.authUrl) {
                    window.location.href = data.authUrl;
                } else if (data.error) {
                    setNotification({ type: 'error', message: data.error });
                }
            } catch (error) {
                setNotification({ type: 'error', message: 'Erro ao conectar integração' });
            }
        }
    };

    return (
        <PageWrapper>
            {/* Notification */}
            {notification && (
                <div
                    className={`mb-6 flex items-center gap-3 rounded-xl p-4 ${notification.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-red-50 text-red-800'
                        }`}
                >
                    {notification.type === 'success' ? (
                        <CheckCircle className="h-5 w-5" />
                    ) : (
                        <AlertCircle className="h-5 w-5" />
                    )}
                    <p className="text-sm font-medium">{notification.message}</p>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                {integrations.map((integration) => (
                    <Card key={integration.id}>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div
                                        className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${integration.color}`}
                                    >
                                        <integration.icon className="h-7 w-7 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle>{integration.name}</CardTitle>
                                        <p className="text-sm text-slate-500">
                                            {integration.description}
                                        </p>
                                    </div>
                                </div>
                                <Badge
                                    variant={integration.connected ? 'success' : 'secondary'}
                                >
                                    {integration.connected ? 'Conectado' : 'Desconectado'}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Connection Info */}
                            {integration.connected && (
                                <div className="mb-4 rounded-xl bg-slate-50 p-4">
                                    <p className="text-sm text-slate-600">
                                        {integration.email && (
                                            <>
                                                <span className="font-medium">Conta:</span>{' '}
                                                {integration.email}
                                            </>
                                        )}
                                        {integration.phone && (
                                            <>
                                                <span className="font-medium">Número:</span>{' '}
                                                {integration.phone}
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* Features */}
                            <div className="mb-4 space-y-2">
                                {integration.features.map((feature) => (
                                    <div
                                        key={feature.name}
                                        className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                                    >
                                        <span className="text-sm text-slate-700">
                                            {feature.name}
                                        </span>
                                        {feature.enabled ? (
                                            <Check className="h-4 w-4 text-emerald-500" />
                                        ) : (
                                            <X className="h-4 w-4 text-slate-300" />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                {integration.connected ? (
                                    <>
                                        <Button variant="outline" size="sm" className="flex-1">
                                            <Settings className="h-4 w-4" />
                                            Configurar
                                        </Button>
                                        <Button variant="outline" size="sm">
                                            <RefreshCw className="h-4 w-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => handleConnect(integration)}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Conectar {integration.name}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Help Section */}
            <PageSection className="mt-8">
                <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-slate-900 mb-2">
                            Como configurar as integrações?
                        </h3>
                        <div className="text-sm text-slate-600 space-y-2 mb-4">
                            <p><strong>Google Calendar:</strong> Clique em "Conectar" e autorize o acesso. O agente poderá listar horários e criar eventos.</p>
                            <p><strong>WhatsApp:</strong> Configure suas credenciais Meta no arquivo .env (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID).</p>
                        </div>
                        <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4" />
                            Ver Documentação
                        </Button>
                    </CardContent>
                </Card>
            </PageSection>
        </PageWrapper>
    );
}

export default function IntegrationsPage() {
    return (
        <>
            <Header
                title="Integrações"
                description="Conecte seus serviços externos"
            />
            <Suspense fallback={<div className="p-6">Carregando integrações...</div>}>
                <IntegrationsContent />
            </Suspense>
        </>
    );
}
