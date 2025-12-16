import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);
const SONIC_AI_AGENT_ID = '2932a457-b806-4974-8da1-90cc9c2cf8ca';

async function testInsert() {
    console.log('🧪 Testando inserção simples...\n');

    try {
        // Test 1: Most basic insert
        console.log('1️⃣ Inserção básica (sem embedding, sem keywords)...');
        await sql`
            INSERT INTO knowledge_base (agent_id, topic, content)
            VALUES (${SONIC_AI_AGENT_ID}::uuid, 'test_topic', 'Test content')
        `;
        console.log('✅ Sucesso!\n');

        // Verify
        const count = await sql`SELECT COUNT(*) as total FROM knowledge_base WHERE agent_id = ${SONIC_AI_AGENT_ID}::uuid`;
        console.log(`📊 Total de itens no SonicAi: ${count[0].total}`);

        // Delete test entry
        await sql`DELETE FROM knowledge_base WHERE topic = 'test_topic'`;
        console.log('🗑️ Registro de teste removido');

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Detalhes:', error);
    }
}

testInsert();
