import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);
const SONIC_AI_AGENT_ID = '2932a457-b806-4974-8da1-90cc9c2cf8ca';

async function fixSchemaAndAddStage() {
    console.log('🔧 Corrigindo schema e adicionando estágio padrão...\n');

    try {
        // 1. Add missing is_active column to agent_actions
        console.log('1️⃣ Adicionando coluna is_active em agent_actions...');
        await sql`
            ALTER TABLE agent_actions 
            ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL
        `;
        console.log('   ✅ Coluna adicionada!\n');

        // 2. Create default stage for SonicAi
        console.log('2️⃣ Criando estágio padrão para SonicAi...');

        // Check if stage already exists
        const existingStages = await sql`
            SELECT id FROM agent_stages WHERE agent_id = ${SONIC_AI_AGENT_ID}::uuid
        `;

        if (existingStages.length > 0) {
            console.log('   ⚠️ Agente já tem estágios configurados\n');
        } else {
            await sql`
                INSERT INTO agent_stages (
                    agent_id, name, type, "order", instructions, is_active
                ) VALUES (
                    ${SONIC_AI_AGENT_ID}::uuid,
                    'Atendimento Inicial',
                    'greeting',
                    0,
                    'Você é GAIA, a IA Sênior. Use seu conhecimento em @instrucao_base para guiar a conversa. Identifique o nicho do cliente usando @matriz_de_nichos e adapte sua abordagem. Quebre objeções com @protocolo_anti_ceticismo e direcione para agendamento usando @oferta_e_agendamento.',
                    true
                )
            `;
            console.log('   ✅ Estágio "Atendimento Inicial" criado!\n');
        }

        // 3. Verify
        const stages = await sql`
            SELECT id, name, type FROM agent_stages WHERE agent_id = ${SONIC_AI_AGENT_ID}::uuid
        `;
        console.log('📊 Estágios do SonicAi:');
        for (const stage of stages) {
            console.log(`   - ${stage.name} (${stage.type})`);
        }

        console.log('\n🎉 Correções concluídas!');
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

fixSchemaAndAddStage();
