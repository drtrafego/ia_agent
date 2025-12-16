import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function setupDatabase() {
    console.log(' Configurando banco de dados...');

    try {
        // 1. Habilitar extensao vector
        console.log('1. Habilitando extensao vector...');
        await sql`CREATE EXTENSION IF NOT EXISTS vector`;
        console.log(' Extensao vector habilitada!');

        console.log(' Setup concluido.');
    } catch (error) {
        console.error(' Erro no setup:', error);
    }
}

setupDatabase();
