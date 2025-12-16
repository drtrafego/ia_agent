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
import { Loader2, Save } from 'lucide-react';

export function PersonalityTab() {
    const { agent, updateAgent } = useBuilderStore();
    const [isSaving, setIsSaving] = useState(false);

    if (!agent) return null;

    async function handleSave() {
        setIsSaving(true);
        await updateAgentAction(agent!.id, {
            name: agent!.name,
            description: agent!.description,
            systemPrompt: agent!.systemPrompt,
            tone: agent!.tone,
            modelConfig: agent!.modelConfig,
            isActive: agent!.isActive
        });
        setIsSaving(false);
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Identidade do Agente</CardTitle>
                    <CardDescription>Defina como seu agente se apresenta para os usuários.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nome</Label>
                            <Input
                                value={agent.name}
                                onChange={(e) => updateAgent({ name: e.target.value })}
                            />
                        </div>
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
                    </div>

                    <div className="space-y-2">
                        <Label>Descrição (Interna)</Label>
                        <Textarea
                            value={agent.description || ''}
                            onChange={(e) => updateAgent({ description: e.target.value })}
                            placeholder="Para que serve este agente?"
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
