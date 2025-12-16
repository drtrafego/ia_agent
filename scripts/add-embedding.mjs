import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function addEmbeddingColumn() {
    console.log('🔧 Adicionando coluna embedding...');

    try {
        // First ensure vector extension is enabled
        await sql`CREATE EXTENSION IF NOT EXISTS vector`;
        console.log('✅ Extensão vector habilitada');

        // Add embedding column
        await sql`
            ALTER TABLE "knowledge_base" 
            ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
        `;
        console.log('✅ Coluna embedding adicionada!');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

addEmbeddingColumn();
