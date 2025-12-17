/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MIGRATION: Add 'whatsapp' to integration_provider enum
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Este script adiciona o valor 'whatsapp' ao enum integration_provider de forma segura.
 * Usado para corrigir o erro: invalid input value for enum integration_provider: "whatsapp"
 */

-- Adicionar 'whatsapp' ao enum integration_provider
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'whatsapp';

-- Verificar os valores atuais do enum
SELECT enum_range(NULL::integration_provider);
