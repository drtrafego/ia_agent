'use client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHATSAPP QR CODE COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Exibe QR Code para conexão WhatsApp via Baileys.
 * Se conecta via SSE para receber QR codes em tempo real.
 */

import { useEffect, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, CheckCircle, XCircle, RefreshCw, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsAppQRCodeProps {
    instanceId: string;
    onConnected?: (info: { phoneNumber: string; profileName: string }) => void;
    onDisconnected?: (reason: string) => void;
    onError?: (error: string) => void;
}

type ConnectionStatus = 'idle' | 'connecting' | 'waiting_scan' | 'connected' | 'disconnected' | 'error' | 'timeout';

export function WhatsAppQRCode({
    instanceId,
    onConnected,
    onDisconnected,
    onError
}: WhatsAppQRCodeProps) {
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [profileInfo, setProfileInfo] = useState<{ phoneNumber: string; profileName: string } | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [eventSource, setEventSource] = useState<EventSource | null>(null);

    // Conectar ao stream SSE
    const startConnection = useCallback(() => {
        if (eventSource) {
            eventSource.close();
        }

        setStatus('connecting');
        setQrCode(null);
        setErrorMessage(null);

        const sse = new EventSource(`/api/whatsapp/instance/${instanceId}/qr`);
        setEventSource(sse);

        sse.onopen = () => {
            console.log('[WhatsApp QR] SSE conectado');
        };

        sse.addEventListener('qr', (event) => {
            const data = JSON.parse((event as MessageEvent).data);
            setQrCode(data.qr);
            setStatus('waiting_scan');
        });

        sse.addEventListener('connected', (event) => {
            const data = JSON.parse((event as MessageEvent).data);
            setStatus('connected');
            setProfileInfo(data);
            onConnected?.(data);
            sse.close();
        });

        sse.addEventListener('disconnected', (event) => {
            const data = JSON.parse((event as MessageEvent).data);
            setStatus('disconnected');
            setErrorMessage(data.reason);
            onDisconnected?.(data.reason);
            sse.close();
        });

        sse.addEventListener('error', (event) => {
            try {
                const messageEvent = event as MessageEvent;
                if (messageEvent.data) {
                    const data = JSON.parse(messageEvent.data);
                    setStatus('error');
                    setErrorMessage(data.message);
                    onError?.(data.message);
                } else {
                    setStatus('error');
                    setErrorMessage('Erro de conexão com o servidor');
                }
            } catch {
                // SSE error event (not custom error)
                setStatus('error');
                setErrorMessage('Erro de conexão com o servidor');
            }
            sse.close();
        });

        sse.addEventListener('timeout', (event) => {
            const data = JSON.parse((event as MessageEvent).data);
            setStatus('timeout');
            setErrorMessage(data.message);
            sse.close();
        });

        sse.onerror = () => {
            if (sse.readyState === EventSource.CLOSED) {
                return;
            }
            setStatus('error');
            setErrorMessage('Erro de conexão com o servidor');
            sse.close();
        };
    }, [instanceId, onConnected, onDisconnected, onError, eventSource]);

    // Cleanup ao desmontar
    useEffect(() => {
        return () => {
            eventSource?.close();
        };
    }, [eventSource]);

    // Iniciar automaticamente
    useEffect(() => {
        startConnection();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instanceId]);

    return (
        <div className="flex flex-col items-center justify-center p-6 space-y-4">
            {/* Status: Connecting */}
            {status === 'connecting' && (
                <div className="flex flex-col items-center space-y-3">
                    <Loader2 className="h-12 w-12 animate-spin text-green-500" />
                    <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                </div>
            )}

            {/* Status: Waiting for scan */}
            {status === 'waiting_scan' && qrCode && (
                <div className="flex flex-col items-center space-y-4">
                    <div className="relative p-4 bg-white rounded-xl shadow-lg">
                        <QRCodeSVG
                            value={qrCode}
                            size={256}
                            level="M"
                            includeMargin={true}
                        />
                        <div className="absolute -top-2 -right-2">
                            <Smartphone className="h-6 w-6 text-green-500" />
                        </div>
                    </div>

                    <div className="text-center space-y-2">
                        <p className="text-sm font-medium">Escaneie o QR Code</p>
                        <p className="text-xs text-muted-foreground max-w-xs">
                            Abra o WhatsApp no seu celular, vá em <strong>Dispositivos Vinculados</strong> e escaneie este código.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                        <RefreshCw className="h-3 w-3" />
                        <span>O código atualiza automaticamente</span>
                    </div>
                </div>
            )}

            {/* Status: Connected */}
            {status === 'connected' && profileInfo && (
                <div className="flex flex-col items-center space-y-4">
                    <div className="flex items-center justify-center h-20 w-20 rounded-full bg-green-100">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>

                    <div className="text-center space-y-1">
                        <p className="text-lg font-semibold text-green-700">Conectado!</p>
                        <p className="text-sm text-muted-foreground">
                            {profileInfo.profileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            +{profileInfo.phoneNumber}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                        <Wifi className="h-3 w-3" />
                        <span>WhatsApp conectado e pronto</span>
                    </div>
                </div>
            )}

            {/* Status: Disconnected / Error / Timeout */}
            {(status === 'disconnected' || status === 'error' || status === 'timeout') && (
                <div className="flex flex-col items-center space-y-4">
                    <div className="flex items-center justify-center h-20 w-20 rounded-full bg-red-100">
                        {status === 'timeout' ? (
                            <WifiOff className="h-10 w-10 text-amber-600" />
                        ) : (
                            <XCircle className="h-10 w-10 text-red-600" />
                        )}
                    </div>

                    <div className="text-center space-y-1">
                        <p className="text-lg font-semibold text-red-700">
                            {status === 'timeout' ? 'QR Code Expirado' : 'Desconectado'}
                        </p>
                        {errorMessage && (
                            <p className="text-sm text-muted-foreground max-w-xs">
                                {errorMessage}
                            </p>
                        )}
                    </div>

                    <Button onClick={startConnection} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Tentar Novamente
                    </Button>
                </div>
            )}

            {/* Status: Idle */}
            {status === 'idle' && (
                <div className="flex flex-col items-center space-y-4">
                    <div className="flex items-center justify-center h-20 w-20 rounded-full bg-slate-100">
                        <Smartphone className="h-10 w-10 text-slate-400" />
                    </div>

                    <Button onClick={startConnection} size="sm">
                        Conectar WhatsApp
                    </Button>
                </div>
            )}
        </div>
    );
}
