import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

const sql = neon(process.env.DATABASE_URL);
const SONIC_AI_AGENT_ID = '2932a457-b806-4974-8da1-90cc9c2cf8ca';

// Knowledge items - simplified content
const knowledgeItems = [
    {
        topic: 'instrucao_base',
        content: `# SYSTEM PROMPT: AGENTE PROVA VIVA
Você é GAIA, a IA Sênior. Sua missão: Provar que IA é mais rápida e eficiente que humano.

## Ferramentas: 
Use @matriz_de_nichos, @protocolo_anti_ceticismo, @oferta_e_agendamento, @beneficios_comerciais, @diferencas_tecnologicas

## Regras:
1. NUNCA invente funcionalidades
2. NUNCA dê o preço final no chat
3. SEMPRE termine com uma pergunta`
    },
    {
        topic: 'beneficios_comerciais',
        content: `# Benefícios Comerciais de IA
1. Disponibilidade 24/7 - Empresas que respondem em até 5 minutos têm 9x mais chance de conversão
2. Escala Infinita - Atende 50, 500 ou 5.000 simultaneamente
3. Consistência de Marca - Mesmo padrão sempre
4. Redução de Custos - Absorve 80% das dúvidas repetitivas`
    },
    {
        topic: 'diferencas_tecnologicas',
        content: `# Chatbots Antigos vs IA Generativa
## Antigos: Trilho fixo, palavras-chave, menus rígidos
## IA: Entende intenção, compreende erros e gírias, mantém contexto longo`
    },
    {
        topic: 'matriz_de_nichos',
        content: `# Matriz de Nichos
## Saúde: No-show, triagem automática + agendamento 24h
## Imobiliárias: Lead frio, qualificação instantânea
## Advocacia: Perguntas repetidas, filtro automático
## Varejo: Carrinho abandonado, recuperação ativa`
    },
    {
        topic: 'oferta_e_agendamento',
        content: `# Oferta: Implementação de Agentes de IA Humanizados
## Entregáveis: WhatsApp config, Base de Conhecimento, CRM, Suporte mensal
## Agendamento: https://cal.com/sua-agencia/demo-estrategica - 30 min - Google Meet`
    },
    {
        topic: 'protocolo_anti_ceticismo',
        content: `# Protocolo Anti-Ceticismo
## "Robô é frio": IA Generativa não substitui calor humano, elimina espera
## "É caro?": Fração do CLT, preço depende do volume, definimos na reunião
## "Difícil implementar?": Zero trabalho, agência done-for-you
## "IA fala besteira?": Guard-rails instalados, só responde base aprovada`
    }
];

async function importWithEmbedding() {
    console.log('🧠 Importando conhecimento com embedding...\n');

    for (const item of knowledgeItems) {
        console.log(`📄 ${item.topic}...`);

        try {
            // Generate embedding
            const { embedding } = await embed({
                model: openai.embedding('text-embedding-3-small'),
                value: item.content,
            });
            console.log(`   Embedding: ${embedding.length} dims`);

            // Format as vector string
            const embeddingStr = `[${embedding.join(',')}]`;

            await sql`
                INSERT INTO knowledge_base (agent_id, topic, content, embedding)
                VALUES (
                    ${SONIC_AI_AGENT_ID}::uuid,
                    ${item.topic},
                    ${item.content},
                    ${embeddingStr}::vector
                )
            `;
            console.log(`   ✅ Salvo!\n`);
        } catch (error) {
            console.error(`   ❌ ${error.message}\n`);
        }
    }

    // Verify
    const count = await sql`SELECT COUNT(*) as total FROM knowledge_base WHERE agent_id = ${SONIC_AI_AGENT_ID}::uuid`;
    console.log(`\n🎉 Total no cérebro do SonicAi: ${count[0].total}`);
}

importWithEmbedding();
