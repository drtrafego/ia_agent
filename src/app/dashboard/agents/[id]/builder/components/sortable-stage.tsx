'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, Edit2, Trash2 } from 'lucide-react';
import { AgentStage, AgentAction } from '@/db/schema';
import { Badge } from '@/components/ui/badge';

interface Props {
    stage: AgentStage & { actions?: AgentAction[] };
    onEdit: (stage: AgentStage) => void;
    onDelete: (id: string) => void;
}

export function SortableStage({ stage, onEdit, onDelete }: Props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: stage.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-3">
            <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                    <div {...attributes} {...listeners} className="cursor-grab hover:text-primary">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">{stage.name}</span>
                            <Badge variant="outline" className="text-xs uppercase scale-90">{stage.type}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {stage.instructions || "Sem instruções definidas"}
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(stage)} className="h-8 w-8">
                            <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(stage.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
