'use client';

import { useBuilderStore } from '@/stores/builder-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { updateAgentAction } from '@/server/actions/agents';
import { useState, useEffect } from 'react';
import { Loader2, Save, CheckCircle2, Cpu, AlertTriangle } from 'lucide-react';
import { AGENT_TYPES, getAgentPromptTemplate, type AgentType } from '@/lib/agent-prompts';

// LLM Provider and Model configurations
const LLM_PROVIDERS = {
    openai: {
        name: 'OpenAI',
        icon: '🤖',
        models: [
            { id: 'gpt-4o', name: 'GPT-4o (Mais inteligente)' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Rápido e econômico)' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (Contexto longo)' },
        ],
        envVar: 'OPENAI_API_KEY'
    },
    google: {
        name: 'Google Gemini',
        icon: '✨',
        models: [
            { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro (Mais recente)' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Rápido)' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Estável)' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Econômico)' },
        ],
        envVar: 'GOOGLE_GENERATIVE_AI_API_KEY'
    },
    anthropic: {
        name: 'Anthropic Claude',
        icon: '🧠',
        models: [
            { id: 'claude-sonnet-4-20250514', name: 'Claude 4.5 Sonnet (Mais recente)' },
            { id: 'claude-opus-4-20250514', name: 'Claude 4.5 Opus (Mais poderoso)' },
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Estável)' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Mais rápido)' },
        ],
        envVar: 'ANTHROPIC_API_KEY'
    }
};

export function PersonalityTab() {
    const { agent, updateAgent } = useBuilderStore();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // State for agent type change confirmation
    const [hasInitialType, setHasInitialType] = useState(false);
    const [showTypeChangeDialog, setShowTypeChangeDialog] = useState(false);
    const [pendingTypeChange, setPendingTypeChange] = useState<AgentType | null>(null);

    // Track if agent already had a type selected
    useEffect(() => {
        if (agent?.personality && agent.personality !== 'custom') {
            setHasInitialType(true);
        }
    }, [agent?.id]);

    if (!agent) return null;

    // Extract provider and model from modelConfig
    const currentProvider = (agent.modelConfig as any)?.provider || 'openai';
    const currentModel = (agent.modelConfig as any)?.model || 'gpt-4o-mini';

    function handleProviderChange(provider: string) {
        const providerConfig = LLM_PROVIDERS[provider as keyof typeof LLM_PROVIDERS];
        const defaultModel = providerConfig.models[0].id;
        updateAgent({
            modelConfig: {
                ...agent.modelConfig,
                provider,
                model: defaultModel,
            }
        });
    }

    function handleModelChange(model: string) {
        updateAgent({
            modelConfig: {
                ...agent.modelConfig,
                model,
            }
        });
    }

    // Handle agent type change with confirmation
    function handleAgentTypeChange(newType: string) {
        const agentType = newType as AgentType;

        // If already has a type and trying to change, show confirmation
        if (hasInitialType && agent.personality !== 'custom' && newType !== agent.personality) {
            setPendingTypeChange(agentType);
            setShowTypeChangeDialog(true);
            return;
        }

        applyAgentTypeChange(agentType);
    }

    function applyAgentTypeChange(agentType: AgentType) {
        const promptTemplate = getAgentPromptTemplate(agentType);

        updateAgent({
            personality: agentType,
            // Only update prompt if template exists and prompt is empty or user confirms
            ...(promptTemplate && (!agent.systemPrompt || agent.systemPrompt.length < 100) ? {
                systemPrompt: promptTemplate
            } : {})
        });

        setHasInitialType(true);
        setShowTypeChangeDialog(false);
        setPendingTypeChange(null);
    }

    function confirmTypeChangeWithPrompt() {
        if (pendingTypeChange) {
            const promptTemplate = getAgentPromptTemplate(pendingTypeChange);
            updateAgent({
                personality: pendingTypeChange,
                systemPrompt: promptTemplate
            });
            setShowTypeChangeDialog(false);
            setPendingTypeChange(null);
        }
    }

    async function handleSave() {
        setIsSaving(true);
        setSaveSuccess(false);
        const result = await updateAgentAction(agent!.id, {
            name: agent!.name,
            description: agent!.description,
            systemPrompt: agent!.systemPrompt,
            tone: agent!.tone,
            personality: agent!.personality,
            companyProfile: agent!.companyProfile,
            displayName: agent!.displayName,
            useEmojis: agent!.useEmojis,
            language: agent!.language,
            modelConfig: agent!.modelConfig,
            isActive: agent!.isActive
        });
        setIsSaving(false);
        if (result.success) {
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        }
    }

    const selectedProvider = LLM_PROVIDERS[currentProvider as keyof typeof LLM_PROVIDERS] || LLM_PROVIDERS.openai;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Success Banner */}
            {saveSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Alterações salvas com sucesso!</span>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Identidade do Agente</CardTitle>
                    <CardDescription>Defina como seu agente se apresenta para os usuários.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nome Interno</Label>
                            <Input
                                value={agent.name}
                                onChange={(e) => updateAgent({ name: e.target.value })}
                                placeholder="Nome para identificação interna"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Nome de Exibição (Chat)</Label>
                            <Input
                                value={agent.displayName || ''}
                                onChange={(e) => updateAgent({ displayName: e.target.value })}
                                placeholder="Como o agente se apresenta no chat"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Tipo de Atendimento</Label>
                        <Select
                            value={agent.personality || 'custom'}
                            onValueChange={handleAgentTypeChange}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Escolha o tipo do agente" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="vendas">
                                    <div className="flex flex-col">
                                        <span>💼 Agente de Vendas (Closer)</span>
                                        <span className="text-xs text-muted-foreground">Vendedor consultivo de alta performance</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="sdr">
                                    <div className="flex flex-col">
                                        <span>🎯 SDR Qualificador de Leads</span>
                                        <span className="text-xs text-muted-foreground">Qualificação estratégica para alto ticket</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="low_ticket">
                                    <div className="flex flex-col">
                                        <span>⚡ Vendas Low Ticket</span>
                                        <span className="text-xs text-muted-foreground">Vendas rápidas e diretas</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="secretaria">
                                    <div className="flex flex-col">
                                        <span>📅 Secretária + Agendamento</span>
                                        <span className="text-xs text-muted-foreground">SDR + Secretária com demonstração</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="custom">
                                    <div className="flex flex-col">
                                        <span>⚙️ Personalizado</span>
                                        <span className="text-xs text-muted-foreground">Crie seu próprio prompt</span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {agent.personality && agent.personality !== 'custom' && (
                            <p className="text-xs text-muted-foreground">
                                💡 O prompt pré-configurado foi carregado. Personalize os campos marcados com [PREENCHER].
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tom de Voz</Label>
                            <Select
                                value={agent.tone || 'friendly'}
                                onValueChange={(v) => updateAgent({ tone: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="friendly">Amigável 😊</SelectItem>
                                    <SelectItem value="professional">Profissional 👔</SelectItem>
                                    <SelectItem value="enthusiastic">Entusiasta 🤩</SelectItem>
                                    <SelectItem value="serious">Sério 😐</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Idioma</Label>
                            <Select
                                value={agent.language || 'pt-BR'}
                                onValueChange={(v) => updateAgent({ language: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pt-BR">🇧🇷 Português (Brasil)</SelectItem>
                                    <SelectItem value="en-US">🇺🇸 English (US)</SelectItem>
                                    <SelectItem value="es-ES">🇪🇸 Español</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border p-4 rounded-lg">
                        <div className="space-y-0.5">
                            <Label>Usar Emojis</Label>
                            <p className="text-sm text-muted-foreground">Permite o uso de emojis nas respostas.</p>
                        </div>
                        <Switch
                            checked={agent.useEmojis ?? true}
                            onCheckedChange={(c) => updateAgent({ useEmojis: c })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Descrição Interna</Label>
                        <Textarea
                            value={agent.description || ''}
                            onChange={(e) => updateAgent({ description: e.target.value })}
                            placeholder="Para que serve este agente? (não aparece no chat)"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* LLM Selection Card */}
            <Card className="border-2 border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Cpu className="h-5 w-5" />
                        Modelo de IA (LLM)
                    </CardTitle>
                    <CardDescription>
                        Escolha o provedor e modelo de IA que o agente utilizará para gerar respostas.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Provedor</Label>
                            <Select value={currentProvider} onValueChange={handleProviderChange}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="openai">🤖 OpenAI</SelectItem>
                                    <SelectItem value="google">✨ Google Gemini</SelectItem>
                                    <SelectItem value="anthropic">🧠 Anthropic Claude</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Modelo</Label>
                            <Select value={currentModel} onValueChange={handleModelChange}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectedProvider.models.map((model) => (
                                        <SelectItem key={model.id} value={model.id}>
                                            {model.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg text-sm">
                        <p className="text-muted-foreground">
                            <strong>Variável de ambiente:</strong>{' '}
                            <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">
                                {selectedProvider.envVar}
                            </code>
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Contexto da Empresa</CardTitle>
                    <CardDescription>Informações sobre sua empresa que o agente utilizará.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Perfil da Empresa</Label>
                        <Textarea
                            className="min-h-[120px]"
                            value={agent.companyProfile || ''}
                            onChange={(e) => updateAgent({ companyProfile: e.target.value })}
                            placeholder="Descreva sua empresa, produtos/serviços, diferenciais, etc."
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Comportamento (Prompt)</CardTitle>
                    <CardDescription>Instruções globais que o agente deve seguir sempre.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>System Prompt Global</Label>
                        <Textarea
                            className="min-h-[200px] font-mono text-sm"
                            value={agent.systemPrompt}
                            onChange={(e) => updateAgent({ systemPrompt: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                            Este prompt será combinado com as instruções específicas de cada estágio.
                        </p>
                    </div>

                    <div className="flex items-center justify-between border p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
                        <div className="space-y-0.5">
                            <Label>Agente Ativo</Label>
                            <p className="text-sm text-muted-foreground">Desative para impedir novas interações.</p>
                        </div>
                        <Switch
                            checked={agent.isActive}
                            onCheckedChange={(c) => updateAgent({ isActive: c })}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving} size="lg">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Alterações
                </Button>
            </div>

            {/* Dialog de confirmação para mudança de tipo */}
            <Dialog open={showTypeChangeDialog} onOpenChange={setShowTypeChangeDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Confirmar Alteração de Tipo
                        </DialogTitle>
                        <DialogDescription>
                            Você já tem um tipo de agente configurado. Ao mudar para
                            <strong> {pendingTypeChange && AGENT_TYPES[pendingTypeChange]?.label}</strong>,
                            o System Prompt atual será substituído pelo template pré-configurado.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800">
                        <p><strong>⚠️ Atenção:</strong> Esta ação irá sobrescrever seu prompt atual.</p>
                        <p className="mt-1">Você pode optar por manter seu prompt e apenas mudar o tipo.</p>
                    </div>
                    <DialogFooter className="flex gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (pendingTypeChange) {
                                    updateAgent({ personality: pendingTypeChange });
                                }
                                setShowTypeChangeDialog(false);
                                setPendingTypeChange(null);
                            }}
                        >
                            Manter Meu Prompt
                        </Button>
                        <Button onClick={confirmTypeChangeWithPrompt}>
                            Usar Novo Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
