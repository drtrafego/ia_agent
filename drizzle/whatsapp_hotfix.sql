CREATE TABLE IF NOT EXISTS "whatsapp_sessions" (
    "instance_id" uuid NOT NULL,
    "key" varchar(255) NOT NULL,
    "value" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "whatsapp_sessions_pk" PRIMARY KEY("instance_id","key")
);

DO $$ BEGIN
 ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_instance_id_whatsapp_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."whatsapp_instances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
