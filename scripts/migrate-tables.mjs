import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function migrateDatabase() {
    console.log('🔧 Criando tabelas que faltam...');

    try {
        // 1. Create action_type enum
        console.log('1. Criando enum action_type...');
        await sql`
            DO $$ BEGIN
                CREATE TYPE "public"."action_type" AS ENUM(
                    'google_calendar_list', 
                    'google_calendar_create', 
                    'google_sheets_append', 
                    'transfer_human', 
                    'send_whatsapp_template', 
                    'webhook'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `;
        console.log('✅ Enum criado!');

        // 2. Create agent_stages table
        console.log('2. Criando tabela agent_stages...');
        await sql`
            CREATE TABLE IF NOT EXISTS "agent_stages" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
                "name" varchar(255) NOT NULL,
                "type" varchar(50) DEFAULT 'custom' NOT NULL,
                "order" integer NOT NULL,
                "entry_condition" text,
                "instructions" text NOT NULL,
                "required_variables" jsonb DEFAULT '[]'::jsonb,
                "next_stage_id" uuid,
                "is_active" boolean DEFAULT true NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            );
        `;
        console.log('✅ Tabela agent_stages criada!');

        // 3. Create agent_actions table
        console.log('3. Criando tabela agent_actions...');
        await sql`
            CREATE TABLE IF NOT EXISTS "agent_actions" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "stage_id" uuid NOT NULL REFERENCES "agent_stages"("id") ON DELETE CASCADE,
                "type" varchar(50) NOT NULL,
                "config" jsonb NOT NULL,
                "order" integer DEFAULT 0 NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL
            );
        `;
        console.log('✅ Tabela agent_actions criada!');

        // 4. Add missing columns to knowledge_base
        console.log('4. Adicionando colunas ao knowledge_base...');
        await sql`
            ALTER TABLE "knowledge_base" 
            ADD COLUMN IF NOT EXISTS "content_type" varchar(20) DEFAULT 'text';
        `;
        await sql`
            ALTER TABLE "knowledge_base" 
            ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;
        `;
        console.log('✅ Colunas adicionadas!');

        // 5. Create indexes
        console.log('5. Criando índices...');
        await sql`CREATE INDEX IF NOT EXISTS "stages_agent_id_idx" ON "agent_stages" USING btree ("agent_id");`;
        await sql`CREATE INDEX IF NOT EXISTS "stages_order_idx" ON "agent_stages" USING btree ("agent_id", "order");`;
        await sql`CREATE INDEX IF NOT EXISTS "actions_stage_id_idx" ON "agent_actions" USING btree ("stage_id");`;
        console.log('✅ Índices criados!');

        console.log('\n🎉 Migração concluída com sucesso!');
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    }
}

migrateDatabase();
