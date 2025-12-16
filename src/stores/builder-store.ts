import { create } from 'zustand';
import { Agent, AgentStage, AgentAction, KnowledgeBaseItem } from '@/db/schema';

type BuilderState = {
    agent: Agent | null;
    stages: (AgentStage & { actions?: AgentAction[] })[];
    knowledgeBase: KnowledgeBaseItem[];
    activeTab: 'personality' | 'brain' | 'stages' | 'integrations' | 'test';
    isLoading: boolean;

    // Actions
    setAgent: (agent: Agent) => void;
    updateAgent: (data: Partial<Agent>) => void;

    setStages: (stages: (AgentStage & { actions?: AgentAction[] })[]) => void;
    addStage: (stage: AgentStage & { actions?: AgentAction[] }) => void;
    updateStage: (id: string, data: Partial<AgentStage>) => void;
    removeStage: (id: string) => void;

    setKnowledgeBase: (items: KnowledgeBaseItem[]) => void;
    addKnowledgeItem: (item: KnowledgeBaseItem) => void;
    removeKnowledgeItem: (id: string) => void;

    setActiveTab: (tab: BuilderState['activeTab']) => void;
    setIsLoading: (loading: boolean) => void;
};

export const useBuilderStore = create<BuilderState>((set) => ({
    agent: null,
    stages: [],
    knowledgeBase: [],
    activeTab: 'personality',
    isLoading: false,

    setAgent: (agent) => set({ agent }),
    updateAgent: (data) => set((state) => ({
        agent: state.agent ? { ...state.agent, ...data } : null
    })),

    setStages: (stages) => set({ stages }),
    addStage: (stage) => set((state) => ({
        stages: [...state.stages, stage]
    })),
    updateStage: (id, data) => set((state) => ({
        stages: state.stages.map((s) => s.id === id ? { ...s, ...data } : s)
    })),
    removeStage: (id) => set((state) => ({
        stages: state.stages.filter((s) => s.id !== id)
    })),

    setKnowledgeBase: (items) => set({ knowledgeBase: items }),
    addKnowledgeItem: (item) => set((state) => ({
        knowledgeBase: [item, ...state.knowledgeBase]
    })),
    removeKnowledgeItem: (id) => set((state) => ({
        knowledgeBase: state.knowledgeBase.filter(i => i.id !== id)
    })),

    setActiveTab: (tab) => set({ activeTab: tab }),
    setIsLoading: (loading) => set({ isLoading: loading }),
}));
