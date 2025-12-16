import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function checkTables() {
    console.log('🔍 Verificando tabelas no banco...');

    try {
        // Check agent_stages
        const stages = await sql`SELECT COUNT(*) as count FROM agent_stages`;
        console.log('✅ agent_stages existe, count:', stages[0].count);

        // Check agent_actions
        const actions = await sql`SELECT COUNT(*) as count FROM agent_actions`;
        console.log('✅ agent_actions existe, count:', actions[0].count);

        // Check knowledge_base columns
        const kb = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_base'`;
        console.log('✅ knowledge_base columns:', kb.map(c => c.column_name).join(', '));

        console.log('\n🎉 Todas as tabelas existem!');
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

checkTables();
