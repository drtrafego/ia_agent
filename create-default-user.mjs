import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function createDefaultUser() {
    try {
        const result = await sql`
            INSERT INTO users (name, email, created_at, updated_at) 
            VALUES ('Admin', 'admin@ia-agent.com', NOW(), NOW())
            ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
            RETURNING id
        `;

        console.log('Usuário criado/encontrado!');
        console.log('');
        console.log('ADICIONE ESTA VARIAVEL NO VERCEL:');
        console.log(`DEFAULT_USER_ID=${result[0].id}`);
        console.log('');
        console.log('1. Acesse: https://vercel.com/seu-projeto/settings/environment-variables');
        console.log('2. Adicione a variavel acima');
        console.log('3. Redeploy o projeto');
    } catch (error) {
        console.error('Erro:', error);
    }
}

createDefaultUser();
