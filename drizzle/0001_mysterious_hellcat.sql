CREATE TYPE "public"."whatsapp_connection_type" AS ENUM('api_oficial', 'qr_code');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_instance_status" AS ENUM('disconnected', 'connecting', 'connected', 'error');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"connection_type" "whatsapp_connection_type" NOT NULL,
	"status" "whatsapp_instance_status" DEFAULT 'disconnected' NOT NULL,
	"phone_number" varchar(30),
	"profile_name" varchar(255),
	"credentials" text,
	"last_qr_code" text,
	"qr_generated_at" timestamp,
	"last_connected_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_instances_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_instances" ADD CONSTRAINT "whatsapp_instances_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_instances_agent_id_idx" ON "whatsapp_instances" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_instances_status_idx" ON "whatsapp_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_instances_phone_idx" ON "whatsapp_instances" USING btree ("phone_number");