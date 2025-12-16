import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agents, users } from '@/db/schema';

/**
 * GET /api/agents - Listar todos os agentes
 */
export async function GET() {
    try {
        const allAgents = await db.query.agents.findMany({
            orderBy: (agents, { desc }) => [desc(agents.createdAt)],
        });

        // Formatar para a UI
        const formattedAgents = allAgents.map(agent => ({
            id: agent.id,
            name: agent.name,
            description: agent.description,
            isActive: agent.isActive,
            isDefault: agent.isDefault,
            modelConfig: agent.modelConfig,
            messagesCount: 0, // TODO: Query real de messages
            threadsCount: 0,  // TODO: Query real de threads
        }));

        return NextResponse.json({ agents: formattedAgents });
    } catch (error) {
        console.error('[API] Erro ao listar agentes:', error);
        return NextResponse.json(
            { error: 'Erro ao carregar agentes' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents - Criar novo agente
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();


        let userId = body.userId || process.env.DEFAULT_USER_ID;

        // Fallback: Se não tem userId, busca o primeiro usuário do banco
        if (!userId) {
            const firstUser = await db.query.users.findFirst();
            if (firstUser) {
                userId = firstUser.id;
            } else {
                // Último caso: cria um usuário padrão se não existir nenhum
                const [newUser] = await db.insert(users).values({
                    name: 'Admin',
                    email: 'admin@ia-agent.com',
                }).returning();
                userId = newUser.id;
            }
        }

        const newAgent = await db.insert(agents).values({
            name: body.name,
            description: body.description || null,
            systemPrompt: body.systemPrompt || 'Você é um assistente prestativo.',
            modelConfig: body.modelConfig || { model: 'gpt-4o-mini', temperature: 0.7 },
            isActive: body.isActive ?? false,
            isDefault: body.isDefault ?? false,
            userId: userId,
        }).returning();

        return NextResponse.json({ agent: newAgent[0] }, { status: 201 });
    } catch (error) {
        console.error('[API] Erro ao criar agente:', error);
        return NextResponse.json(
            { error: 'Erro ao criar agente' },
            { status: 500 }
        );
    }
}
