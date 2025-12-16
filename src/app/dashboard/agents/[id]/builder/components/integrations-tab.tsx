'use client';

import { useBuilderStore } from '@/stores/builder-store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MessageCircle, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getIntegrationsStatusAction } from '@/server/actions/integrations';
import { Badge } from '@/components/ui/badge';

export function IntegrationsTab() {
    const { agent } = useBuilderStore();
    const [status, setStatus] = useState({ google: false, whatsapp: false });

    useEffect(() => {
        if (agent) {
            // Fetch real status
            getIntegrationsStatusAction(agent.userId).then(setStatus);
        }
    }, [agent]);

    function handleConnectGoogle() {
        window.location.href = '/api/integrations/google/connect'; // Backend endpoint for OAuth
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
                {/* Google Integration */}
                <Card className={status.google ? "border-green-500/50 bg-green-500/5" : ""}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Google Workspace
                            </CardTitle>
                            {status.google ? (
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Conectado</Badge>
                            ) : (
                                <Badge variant="outline" className="bg-slate-100 text-slate-700">Desconectado</Badge>
                            )}
                        </div>
                        <CardDescription>
                            Permite ao agente acessar Calendar e Sheets.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>Google Sheets (Salvar Leads)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>Google Calendar (Agendamento)</span>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        {status.google ? (
                            <Button variant="outline" className="w-full text-destructive hover:text-destructive">Desconectar</Button>
                        ) : (
                            <Button className="w-full" onClick={handleConnectGoogle}>Conectar Conta Google</Button>
                        )}
                    </CardFooter>
                </Card>

                {/* WhatsApp Integration */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <MessageCircle className="h-5 w-5" />
                                WhatsApp Business
                            </CardTitle>
                            <Badge variant="outline" className="bg-slate-100 text-slate-700">Em Breve</Badge>
                        </div>
                        <CardDescription>
                            Conecte via Meta Cloud API.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            A integração nativa com WhatsApp Business API estará disponível na Fase 4.
                            Por enquanto, utilize a API de Teste ou Webhooks manuais.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Button disabled className="w-full">Configurar (Em Breve)</Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
