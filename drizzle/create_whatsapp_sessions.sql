-- Create whatsapp_sessions table for Baileys authentication persistence
-- Run this on Neon database

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(instance_id, key)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_instance ON whatsapp_sessions(instance_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_key ON whatsapp_sessions(instance_id, key);

-- Add comment
COMMENT ON TABLE whatsapp_sessions IS 'Stores Baileys authentication state for WhatsApp instances';
