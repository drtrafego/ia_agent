'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * INTEGRATIONS TAB - Per-Agent Integration Management
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useBuilderStore } from '@/stores/builder-store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MessageCircle, FileSpreadsheet, Check, Link, Wifi, WifiOff, QrCode, Settings, Trash2, Loader2 } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { WhatsAppQRCode } from '@/components/integrations/WhatsAppQRCode';

interface IntegrationStatus {
    connected: boolean;
    email?: string;
    id?: string;
}

interface WhatsAppInstanceInfo {
    id: string;
    agentId: string;
    connectionType: 'api_oficial' | 'qr_code';
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    phoneNumber?: string;
    profileName?: string;
    errorMessage?: string;
}

export function IntegrationsTab() {
    const { agent, updateAgent } = useBuilderStore();
    const [mainGoogleStatus, setMainGoogleStatus] = useState<IntegrationStatus | null>(null);
    const [loading, setLoading] = useState(true);

    // WhatsApp state
    const [whatsappInstance, setWhatsappInstance] = useState<WhatsAppInstanceInfo | null>(null);
    const [whatsappLoading, setWhatsappLoading] = useState(true);
    const [whatsappConnectionType, setWhatsappConnectionType] = useState<'api_oficial' | 'qr_code'>('qr_code');
    const [showQRCode, setShowQRCode] = useState(false);
    const [apiCredentials, setApiCredentials] = useState({
        token: '',
        phoneNumberId: '',
    });

    // Buscar status da integração principal da conta
    useEffect(() => {
        async function fetchStatus() {
            try {
                const res = await fetch('/api/integrations/status');
                if (res.ok) {
                    const data = await res.json();
                    setMainGoogleStatus(data.google);
                } else {
                    setMainGoogleStatus({ connected: false });
                }
            } catch (error) {
                console.error('Erro ao buscar status:', error);
                setMainGoogleStatus({ connected: false });
            } finally {
                setLoading(false);
            }
        }
        fetchStatus();
    }, []);

    // Buscar instância WhatsApp do agente
    const fetchWhatsAppInstance = useCallback(async () => {
        if (!agent?.id) return;

        setWhatsappLoading(true);
        try {
            const res = await fetch(`/api/whatsapp/instance?agentId=${agent.id}`);
            if (res.ok) {
                const data = await res.json();
                setWhatsappInstance(data.instance);
            }
        } catch (error) {
            console.error('Erro ao buscar instância WhatsApp:', error);
        } finally {
            setWhatsappLoading(false);
        }
    }, [agent?.id]);

    useEffect(() => {
        fetchWhatsAppInstance();
    }, [fetchWhatsAppInstance]);

    const useMainIntegration = agent?.useMainGoogleIntegration ?? true;

    // Handler para mudar tipo de integração Google
    function handleIntegrationTypeChange(value: string) {
        if (!agent) return;

        const useMain = value === 'main';
        updateAgent({
            useMainGoogleIntegration: useMain,
            googleIntegrationId: useMain ? null : agent.googleIntegrationId,
        });
    }

    // Handler para conectar nova conta Google para este agente
    async function handleConnectAgentGoogle() {
        try {
            const response = await fetch(`/api/auth/google?agentId=${agent?.id}`);
            const data = await response.json();

            if (data.authUrl) {
                window.location.href = data.authUrl;
            } else if (data.error) {
                console.error('Erro ao conectar Google:', data.error);
                alert('Erro ao conectar com Google. Verifique a configuração.');
            }
        } catch (error) {
            console.error('Erro ao conectar Google:', error);
            alert('Erro ao conectar com Google.');
        }
    }

    // Handler para criar instância WhatsApp
    async function handleCreateWhatsAppInstance() {
        if (!agent?.id) return;

        try {
            setWhatsappLoading(true);

            const body: Record<string, unknown> = {
                agentId: agent.id,
                connectionType: whatsappConnectionType,
            };

            // Se for API Oficial, incluir credenciais
            if (whatsappConnectionType === 'api_oficial' && apiCredentials.token) {
                body.credentials = apiCredentials;
            }

            const res = await fetch('/api/whatsapp/instance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (data.success) {
                if (whatsappConnectionType === 'qr_code') {
                    setShowQRCode(true);
                }
                await fetchWhatsAppInstance();
            } else {
                alert(data.error || 'Erro ao criar instância');
            }
        } catch (error) {
            console.error('Erro ao criar instância WhatsApp:', error);
            alert('Erro ao criar instância WhatsApp');
        } finally {
            setWhatsappLoading(false);
        }
    }

    // Handler para desconectar WhatsApp
    async function handleDisconnectWhatsApp() {
        if (!whatsappInstance?.id) return;

        if (!confirm('Deseja realmente desconectar o WhatsApp?')) return;

        try {
            const res = await fetch(`/api/whatsapp/instance/${whatsappInstance.id}/status`, {
                method: 'POST',
            });

            if (res.ok) {
                setShowQRCode(false);
                await fetchWhatsAppInstance();
            } else {
                alert('Erro ao desconectar');
            }
        } catch (error) {
            console.error('Erro ao desconectar:', error);
        }
    }

    // Handler para deletar instância WhatsApp
    async function handleDeleteWhatsApp() {
        if (!whatsappInstance?.id) return;

        if (!confirm('Deseja realmente remover a integração WhatsApp?')) return;

        try {
            const res = await fetch(`/api/whatsapp/instance/${whatsappInstance.id}/status`, {
                method: 'DELETE',
            });

            if (res.ok) {
                setWhatsappInstance(null);
                setShowQRCode(false);
            } else {
                alert('Erro ao remover integração');
            }
        } catch (error) {
            console.error('Erro ao remover:', error);
        }
    }

    // Callback quando WhatsApp conecta
    function handleWhatsAppConnected(info: { phoneNumber: string; profileName: string }) {
        setShowQRCode(false);
        fetchWhatsAppInstance();
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Google Integration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Google Workspace
                        </CardTitle>
                        {useMainIntegration && mainGoogleStatus?.connected ? (
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                                Usando Principal
                            </Badge>
                        ) : agent?.googleIntegrationId ? (
                            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                                Conta Específica
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-700">
                                Não Configurado
                            </Badge>
                        )}
                    </div>
                    <CardDescription>
                        Permite ao agente acessar Calendar (agendamento) e Sheets (salvar leads).
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Funcionalidades disponíveis */}
                    <div className="flex gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            <span>Google Sheets</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Google Calendar</span>
                        </div>
                    </div>

                    {/* Opções de integração */}
                    <div className="border rounded-lg p-4 bg-slate-50">
                        <h4 className="font-medium mb-4">Configuração de Integração</h4>

                        <RadioGroup
                            value={useMainIntegration ? 'main' : 'specific'}
                            onValueChange={handleIntegrationTypeChange}
                            className="space-y-3"
                        >
                            {/* Opção 1: Usar integração principal */}
                            <div className="flex items-start space-x-3">
                                <RadioGroupItem value="main" id="main" className="mt-1" />
                                <div className="flex-1">
                                    <Label htmlFor="main" className="font-medium cursor-pointer">
                                        Usar integração principal da conta
                                    </Label>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Usa a mesma conta Google conectada em Integrações.
                                    </p>
                                    {mainGoogleStatus?.connected && (
                                        <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                                            <Check className="h-4 w-4" />
                                            <span>Conectado: {mainGoogleStatus.email}</span>
                                        </div>
                                    )}
                                    {!mainGoogleStatus?.connected && !loading && (
                                        <div className="mt-2 text-sm text-amber-600">
                                            ⚠️ Nenhuma integração principal conectada.{' '}
                                            <a href="/dashboard/integrations" className="underline hover:no-underline">
                                                Conectar agora
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Opção 2: Conectar conta específica */}
                            <div className="flex items-start space-x-3">
                                <RadioGroupItem value="specific" id="specific" className="mt-1" />
                                <div className="flex-1">
                                    <Label htmlFor="specific" className="font-medium cursor-pointer">
                                        Conectar conta Google específica para este agente
                                    </Label>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Usa uma conta diferente apenas para este agente.
                                    </p>
                                    {!useMainIntegration && (
                                        <div className="mt-3">
                                            {agent?.googleIntegrationId ? (
                                                <div className="flex items-center gap-2 text-sm text-green-600">
                                                    <Check className="h-4 w-4" />
                                                    <span>Conta específica conectada</span>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    onClick={handleConnectAgentGoogle}
                                                    className="mt-1"
                                                >
                                                    <Link className="h-4 w-4 mr-2" />
                                                    Conectar Conta Google
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </RadioGroup>
                    </div>
                </CardContent>
            </Card>

            {/* WhatsApp Integration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <MessageCircle className="h-5 w-5 text-green-600" />
                            WhatsApp Business
                        </CardTitle>
                        {whatsappLoading ? (
                            <Badge variant="outline" className="bg-slate-100 text-slate-700">
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                Carregando
                            </Badge>
                        ) : whatsappInstance?.status === 'connected' ? (
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                                <Wifi className="h-3 w-3 mr-1" />
                                Conectado
                            </Badge>
                        ) : whatsappInstance?.status === 'connecting' ? (
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                Conectando
                            </Badge>
                        ) : whatsappInstance ? (
                            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                                <WifiOff className="h-3 w-3 mr-1" />
                                Desconectado
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-700">
                                Não Configurado
                            </Badge>
                        )}
                    </div>
                    <CardDescription>
                        Conecte o WhatsApp para receber e enviar mensagens automaticamente.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Se já tem instância conectada */}
                    {whatsappInstance?.status === 'connected' && (
                        <div className="border rounded-lg p-4 bg-green-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-green-800">
                                        {whatsappInstance.profileName || 'WhatsApp Conectado'}
                                    </p>
                                    {whatsappInstance.phoneNumber && (
                                        <p className="text-sm text-green-600">
                                            +{whatsappInstance.phoneNumber}
                                        </p>
                                    )}
                                    <p className="text-xs text-green-600 mt-1">
                                        Tipo: {whatsappInstance.connectionType === 'qr_code' ? 'QR Code' : 'API Oficial'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleDisconnectWhatsApp}
                                    >
                                        Desconectar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Se está mostrando QR Code */}
                    {showQRCode && whatsappInstance && (
                        <div className="border rounded-lg p-4 bg-white">
                            <WhatsAppQRCode
                                instanceId={whatsappInstance.id}
                                onConnected={handleWhatsAppConnected}
                                onDisconnected={() => fetchWhatsAppInstance()}
                            />
                        </div>
                    )}

                    {/* Se não tem instância ou está desconectado */}
                    {(!whatsappInstance || whatsappInstance.status === 'disconnected') && !showQRCode && (
                        <div className="border rounded-lg p-4 bg-slate-50">
                            <h4 className="font-medium mb-4">Tipo de Conexão</h4>

                            <RadioGroup
                                value={whatsappConnectionType}
                                onValueChange={(v) => setWhatsappConnectionType(v as 'api_oficial' | 'qr_code')}
                                className="space-y-3"
                            >
                                {/* QR Code */}
                                <div className="flex items-start space-x-3">
                                    <RadioGroupItem value="qr_code" id="qr_code" className="mt-1" />
                                    <div className="flex-1">
                                        <Label htmlFor="qr_code" className="font-medium cursor-pointer flex items-center gap-2">
                                            <QrCode className="h-4 w-4" />
                                            Conexão via QR Code
                                        </Label>
                                        <p className="text-sm text-muted-foreground mt-0.5">
                                            Escaneie um QR Code com seu WhatsApp. Ideal para testes e volume baixo.
                                        </p>
                                        <p className="text-xs text-amber-600 mt-1">
                                            ⚠️ Conexão não-oficial. Use com moderação.
                                        </p>
                                    </div>
                                </div>

                                {/* API Oficial */}
                                <div className="flex items-start space-x-3">
                                    <RadioGroupItem value="api_oficial" id="api_oficial" className="mt-1" />
                                    <div className="flex-1">
                                        <Label htmlFor="api_oficial" className="font-medium cursor-pointer flex items-center gap-2">
                                            <Settings className="h-4 w-4" />
                                            API Oficial Meta
                                        </Label>
                                        <p className="text-sm text-muted-foreground mt-0.5">
                                            Use a WhatsApp Business Cloud API. Requer conta Business verificada.
                                        </p>
                                    </div>
                                </div>
                            </RadioGroup>

                            {/* Campos para API Oficial */}
                            {whatsappConnectionType === 'api_oficial' && (
                                <div className="mt-4 space-y-3 pt-4 border-t">
                                    <div>
                                        <Label htmlFor="token">Access Token</Label>
                                        <Input
                                            id="token"
                                            type="password"
                                            placeholder="EAAxxxx..."
                                            value={apiCredentials.token}
                                            onChange={(e) => setApiCredentials(prev => ({ ...prev, token: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                                        <Input
                                            id="phoneNumberId"
                                            placeholder="1234567890"
                                            value={apiCredentials.phoneNumberId}
                                            onChange={(e) => setApiCredentials(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex justify-between">
                    {(!whatsappInstance || whatsappInstance.status === 'disconnected') && !showQRCode && (
                        <Button
                            onClick={handleCreateWhatsAppInstance}
                            disabled={whatsappLoading || (whatsappConnectionType === 'api_oficial' && !apiCredentials.token)}
                            className="w-full"
                        >
                            {whatsappLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Conectando...
                                </>
                            ) : whatsappConnectionType === 'qr_code' ? (
                                <>
                                    <QrCode className="h-4 w-4 mr-2" />
                                    Gerar QR Code
                                </>
                            ) : (
                                <>
                                    <Settings className="h-4 w-4 mr-2" />
                                    Configurar API
                                </>
                            )}
                        </Button>
                    )}

                    {whatsappInstance && whatsappInstance.status !== 'connected' && showQRCode && (
                        <Button
                            variant="outline"
                            onClick={() => setShowQRCode(false)}
                            className="w-full"
                        >
                            Cancelar
                        </Button>
                    )}

                    {whatsappInstance && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDeleteWhatsApp}
                            className="text-red-600 hover:bg-red-50"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
