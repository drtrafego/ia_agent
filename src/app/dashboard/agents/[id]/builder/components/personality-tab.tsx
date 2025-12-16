'use client';

import { useBuilderStore } from '@/stores/builder-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { updateAgentAction } from '@/server/actions/agents';
import { useState } from 'react';
import { Loader2, Save, CheckCircle2, Cpu } from 'lucide-react';

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
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Mais inteligente)' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Rápido)' },
            { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
        ],
        envVar: 'GOOGLE_GENERATIVE_AI_API_KEY'
    },
    anthropic: {
        name: 'Anthropic Claude',
        icon: '🧠',
        models: [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Recomendado)' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Mais poderoso)' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Mais rápido)' },
        ],
        envVar: 'ANTHROPIC_API_KEY'
    }
};

export function PersonalityTab() {
    const { agent, updateAgent } = useBuilderStore();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

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
                            value={agent.personality || 'atendimento'}
                            onValueChange={(v) => updateAgent({ personality: v })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Escolha o foco do agente" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="atendimento">🎧 Atendimento ao Cliente</SelectItem>
                                <SelectItem value="vendas">💼 Vendas e Prospecção</SelectItem>
                                <SelectItem value="suporte">🛠️ Suporte Técnico</SelectItem>
                                <SelectItem value="agendamento">📅 Agendamento</SelectItem>
                                <SelectItem value="informativo">📚 Informativo (FAQ)</SelectItem>
                                <SelectItem value="custom">⚙️ Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
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
        </div>
    );
}
