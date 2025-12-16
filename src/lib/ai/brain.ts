import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { db } from '@/lib/db';
import { knowledgeBase } from '@/db/schema';
import { cosineDistance, desc, gt, sql, eq, and } from 'drizzle-orm';

export class BrainService {

    /**
     * Gera embedding para um texto usando OpenAI text-embedding-3-small
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const { embedding } = await embed({
            model: openai.embedding('text-embedding-3-small'),
            value: text,
        });
        return embedding;
    }

    /**
     * Busca contextos relevantes na base de conhecimento (RAG)
     */
    async retrieveContext(agentId: string, query: string, limit: number = 3): Promise<string[]> {
        // 1. Gerar embedding da pergunta
        const queryEmbedding = await this.generateEmbedding(query);

        // 2. Buscar vetores similares no banco
        // Usa o operador <=> (cosine distance)
        // Requer extensão vector habilitada no Postgres
        const similarity = sql<number>`1 - (${knowledgeBase.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`;

        const results = await db
            .select({
                content: knowledgeBase.content,
                similarity: similarity,
            })
            .from(knowledgeBase)
            .where(and(
                eq(knowledgeBase.agentId, agentId),
                eq(knowledgeBase.isActive, true),
                gt(similarity, 0.7) // Threshold mínimo de relevância
            ))
            .orderBy(desc(similarity))
            .limit(limit);

        // 3. Retornar apenas o conteúdo
        return results.map(r => r.content);
    }

    /**
     * Adiciona novo conhecimento com embedding
     */
    async addKnowledge(agentId: string, item: {
        topic: string;
        content: string;
        contentType?: 'text' | 'faq' | 'file';
        metadata?: any;
    }) {
        const embedding = await this.generateEmbedding(item.content);

        await db.insert(knowledgeBase).values({
            agentId,
            topic: item.topic,
            content: item.content,
            contentType: item.contentType || 'text',
            embedding,
            metadata: item.metadata || {},
        });
    }
}
