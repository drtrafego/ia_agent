'use client';

import { useEffect } from 'react';
import { useBuilderStore } from '@/stores/builder-store';
import { Agent, AgentStage, AgentAction, KnowledgeBaseItem } from '@/db/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PersonalityTab } from './components/personality-tab';
import { BrainTab } from './components/brain-tab';
import { StagesTab } from './components/stages-tab';
import { IntegrationsTab } from './components/integrations-tab';
import { TestTab } from './components/test-tab';
import { Loader2 } from 'lucide-react';

interface Props {
    agent: Agent;
    stages: (AgentStage & { actions?: AgentAction[] })[];
    knowledgeBase: KnowledgeBaseItem[];
}

export function ClientBuilderWrapper({ agent, stages, knowledgeBase }: Props) {
    const {
        setAgent,
        setStages,
        setKnowledgeBase,
        activeTab,
        setActiveTab,
        isLoading
    } = useBuilderStore();

    // Hydrate store on mount
    useEffect(() => {
        setAgent(agent);
        setStages(stages);
        setKnowledgeBase(knowledgeBase);
    }, [agent, stages, knowledgeBase, setAgent, setStages, setKnowledgeBase]);

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* Header / Tabs Navigation */}
            <div className="border-b px-6 py-2 bg-background flex items-center justify-between">
                <h1 className="font-semibold text-lg">{agent.name} <span className="text-muted-foreground font-normal text-sm">/ Editor</span></h1>

                {isLoading && <Loader2 className="animate-spin h-5 w-5 text-primary" />}
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
                <div className="border-b px-6 bg-muted/30">
                    <TabsList className="bg-transparent h-12 p-0 gap-6">
                        <TabsTrigger value="personality" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 h-full">
                            🤖 Personalidade
                        </TabsTrigger>
                        <TabsTrigger value="brain" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 h-full">
                            🧠 Cérebro (RAG)
                        </TabsTrigger>
                        <TabsTrigger value="stages" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 h-full">
                            🔄 Fluxo (Estágios)
                        </TabsTrigger>
                        <TabsTrigger value="integrations" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 h-full">
                            🔌 Integrações
                        </TabsTrigger>
                        <TabsTrigger value="test" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 h-full ml-auto text-primary font-medium">
                            💬 Testar Agente
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6">
                    <TabsContent value="personality" className="h-full mt-0 border-0">
                        <PersonalityTab />
                    </TabsContent>
                    <TabsContent value="brain" className="h-full mt-0 border-0">
                        <BrainTab />
                    </TabsContent>
                    <TabsContent value="stages" className="h-full mt-0 border-0">
                        <StagesTab />
                    </TabsContent>
                    <TabsContent value="integrations" className="h-full mt-0 border-0">
                        <IntegrationsTab />
                    </TabsContent>
                    <TabsContent value="test" className="h-full mt-0 border-0">
                        <TestTab />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
