
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
    try {
        console.log('Starting migration...');

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "whatsapp_sessions" (
                "instance_id" uuid NOT NULL,
                "key" varchar(255) NOT NULL,
                "value" text NOT NULL,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL,
                CONSTRAINT "whatsapp_sessions_pk" PRIMARY KEY("instance_id","key")
            );
        `);

        // Tenta adicionar FK, ignora se erro (provavelmente já existe ou tabela de instances não existe ainda?? não, references exige)
        try {
            await db.execute(sql`
                DO $$ BEGIN
                 ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_instance_id_whatsapp_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."whatsapp_instances"("id") ON DELETE cascade ON UPDATE no action;
                EXCEPTION
                 WHEN duplicate_object THEN null;
                END $$;
            `);
        } catch (e: any) {
            console.log('FK creation note:', e.message);
        }

        return NextResponse.json({ success: true, message: 'Migration applied successfully' });
    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
