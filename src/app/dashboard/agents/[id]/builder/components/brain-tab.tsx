'use client';

import { useBuilderStore } from '@/stores/builder-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { addKnowledgeAction, removeKnowledgeAction } from '@/server/actions/knowledge';
import { useState } from 'react';
import { Loader2, Plus, Trash2, FileText } from 'lucide-react';

export function BrainTab() {
    const { agent, knowledgeBase, removeKnowledgeItem } = useBuilderStore();
    const [topic, setTopic] = useState('');
    const [content, setContent] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    if (!agent) return null;

    async function handleAdd() {
        if (!topic || !content) return;

        setIsAdding(true);
        await addKnowledgeAction(agent!.id, {
            topic,
            content,
            contentType: 'text'
        });
        // Note: We rely on revalidatePath to update server data, 
        // but ideally we should also update local store for instant feedback.
        // For now we just reset form and let Next.js refresh handle it or manual refresh.
        // To make it instant, we would need the created item returned from server action.
        setTopic('');
        setContent('');
        setIsAdding(false);
    }

    async function handleRemove(id: string) {
        removeKnowledgeItem(id); // Optimistic update
        await removeKnowledgeAction(id, agent!.id);
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Adicionar Conhecimento</CardTitle>
                    <CardDescription>Ensine seu agente sobre sua empresa, produtos ou políticas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Tópico / Assunto</Label>
                        <Input
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Ex: Política de Reembolso"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Conteúdo</Label>
                        <Textarea
                            className="min-h-[100px]"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Descreva detalhadamente o conhecimento..."
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleAdd} disabled={isAdding || !topic || !content}>
                            {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Adicionar ao Cérebro
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Base de Conhecimento ({knowledgeBase.length})</h3>

                {knowledgeBase.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                        Nenhum conhecimento adicionado ainda.
                    </div>
                )}

                <div className="grid gap-4">
                    {knowledgeBase.map((item) => (
                        <Card key={item.id} className="overflow-hidden">
                            <div className="flex items-center justify-between p-4 bg-muted/20 border-b">
                                <div className="flex items-center gap-2 font-medium">
                                    <FileText className="h-4 w-4 text-primary" />
                                    {item.topic}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 h-8 w-8"
                                    onClick={() => handleRemove(item.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="p-4 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3 hover:line-clamp-none transition-all">
                                {item.content}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
