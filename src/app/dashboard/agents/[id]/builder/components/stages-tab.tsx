'use client';

import { useBuilderStore } from '@/stores/builder-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus, GripVertical, Loader2 } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { SortableStage } from './sortable-stage';
import { StageEditor } from './stage-editor';
import { useState } from 'react';
import { createStageAction, reorderStagesAction, deleteStageAction } from '@/server/actions/stages';
import { AgentStage } from '@/db/schema';

export function StagesTab() {
    const { agent, stages, setStages, addStage, removeStage } = useBuilderStore();
    const [editingStage, setEditingStage] = useState<AgentStage | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (!agent) return null;

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = stages.findIndex((s) => s.id === active.id);
            const newIndex = stages.findIndex((s) => s.id === over.id);

            const newStages = arrayMove(stages, oldIndex, newIndex).map((stage, index) => ({
                ...stage,
                order: index
            }));

            // Optimistic update
            setStages(newStages);

            // Server update
            await reorderStagesAction(agent!.id, newStages.map(s => ({ id: s.id, order: s.order })));
        }
    }

    async function handleCreate() {
        setIsCreating(true);
        const order = stages.length;
        const { success, stage } = await createStageAction(agent!.id, order);

        if (success && stage) {
            addStage(stage);
        }
        setIsCreating(false);
    }

    async function handleDelete(id: string) {
        if (confirm('Tem certeza? Ações configuradas neste estágio serão perdidas.')) {
            removeStage(id); // Optimistic
            await deleteStageAction(id, agent!.id);
        }
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Fluxo de Conversa</CardTitle>
                        <CardDescription>Defina a ordem dos estágios da conversa.</CardDescription>
                    </div>
                    <Button onClick={handleCreate} disabled={isCreating}>
                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Novo Estágio
                    </Button>
                </CardHeader>
                <CardContent>
                    {stages.length === 0 ? (
                        <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground">
                            Nenhum estágio definido. Crie o primeiro para começar.
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={stages.map(s => s.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {stages.map((stage) => (
                                    <SortableStage
                                        key={stage.id}
                                        stage={stage}
                                        onEdit={setEditingStage}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </CardContent>
            </Card>

            <StageEditor
                isOpen={!!editingStage}
                onClose={() => setEditingStage(null)}
                stage={editingStage}
            />
        </div>
    );
}
