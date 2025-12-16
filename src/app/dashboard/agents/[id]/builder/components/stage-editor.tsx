'use client';

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgentStage } from '@/db/schema';
import { useState, useEffect } from 'react';
import { updateStageAction } from '@/server/actions/stages';
import { Loader2 } from 'lucide-react';
import { useBuilderStore } from '@/stores/builder-store';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    stage: AgentStage | null;
}

export function StageEditor({ isOpen, onClose, stage }: Props) {
    const { agent, updateStage } = useBuilderStore();
    const [name, setName] = useState('');
    const [type, setType] = useState('custom');
    const [instructions, setInstructions] = useState('');
    const [entryCondition, setEntryCondition] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (stage) {
            setName(stage.name);
            setType(stage.type);
            setInstructions(stage.instructions);
            setEntryCondition(stage.entryCondition || '');
        }
    }, [stage]);

    async function handleSave() {
        if (!stage || !agent) return;
        setIsSaving(true);

        await updateStageAction(stage.id, agent.id, {
            name,
            type: type as any,
            instructions,
            entryCondition
        });

        // Optimistic update
        updateStage(stage.id, { name, type: type as any, instructions, entryCondition });

        setIsSaving(false);
        onClose();
    }

    if (!stage) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Editar Estágio</SheetTitle>
                    <SheetDescription>
                        Configure como este estágio deve se comportar.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 py-6">
                    <div className="space-y-2">
                        <Label>Nome do Estágio</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="identify">Identificação (Coletar Dados)</SelectItem>
                                <SelectItem value="diagnosis">Diagnóstico (Entender Problema)</SelectItem>
                                <SelectItem value="schedule">Agendamento (Calendar)</SelectItem>
                                <SelectItem value="handoff">Transbordo Humano</SelectItem>
                                <SelectItem value="custom">Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Condição de Entrada</Label>
                        <Input
                            value={entryCondition}
                            onChange={e => setEntryCondition(e.target.value)}
                            placeholder="Ex: Usuário quer agendar uma reunião..."
                        />
                        <p className="text-xs text-muted-foreground">
                            O agente só entrará neste estágio se a conversa atender a esta condição.
                            Deixe em branco para fluxo sequencial forçado.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Instruções do Agente (Prompt)</Label>
                        <Textarea
                            className="min-h-[200px]"
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                            placeholder="Instrua o agente sobre o que fazer e perguntar neste estágio."
                        />
                    </div>
                </div>

                <SheetFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Alterações
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
