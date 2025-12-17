/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DATABASE SCHEMA - CRM Casal do Tráfego
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Este arquivo define o schema completo do banco de dados usando Drizzle ORM.
 * 
 * TABELAS:
 * - users: Usuários do sistema (administradores)
 * - agents: Configurações dos agentes de IA
 * - knowledge_base: Base de conhecimento dos agentes
 * - integrations: Credenciais de integrações (Google, Meta)
 * - threads: Conversas individuais (por telefone)
 * - messages: Mensagens das conversas
 * - tool_calls: Registro de chamadas de ferramentas pela IA
 * 
 * @version 1.0.0
 * @author CRM Casal do Tráfego
 */

import {
    pgTable,
    uuid,
    text,
    varchar,
    boolean,
    timestamp,
    jsonb,
    integer,
    pgEnum,
    index,
    uniqueIndex,
    vector,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';


// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roles possíveis para mensagens em uma conversa
 */
export const messageRoleEnum = pgEnum('message_role', [
    'user',      // Mensagem do cliente (WhatsApp)
    'assistant', // Resposta do agente IA
    'system',    // Mensagem de sistema (contexto)
]);

/**
 * Status de uma thread (conversa)
 */
export const threadStatusEnum = pgEnum('thread_status', [
    'active',    // Conversa ativa
    'pending',   // Aguardando resposta do usuário
    'qualified', // Lead qualificado
    'booked',    // Reunião agendada
    'archived',  // Arquivada por inatividade
]);

/**
 * Provedores de integração suportados
 */
export const integrationProviderEnum = pgEnum('integration_provider', [
    'google',    // Google Calendar + Sheets
    'meta',      // WhatsApp Business API
    'whatsapp',  // WhatsApp (alternative naming)
    'openai',    // Modelos de IA adicionais
]);

/**
 * Status de uma chamada de ferramenta
 */
export const toolCallStatusEnum = pgEnum('tool_call_status', [
    'pending',   // Aguardando execução
    'success',   // Executada com sucesso
    'failed',    // Falhou na execução
]);

/**
 * Tipos de estágio no workflow do agente (Zaia-Style)
 */
export const stageTypeEnum = pgEnum('stage_type', [
    'identify',   // Identificar o lead
    'diagnosis',  // Diagnosticar necessidade
    'schedule',   // Agendar reunião
    'handoff',    // Transferir para humano
    'custom',     // Estágio personalizado
]);

/**
 * Status de uma sessão de conversa
 */
export const sessionStatusEnum = pgEnum('session_status', [
    'active',     // Sessão ativa
    'completed',  // Fluxo completado
    'abandoned',  // Abandonada pelo usuário
]);

// ─────────────────────────────────────────────────────────────────────────────
// USERS TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tabela de usuários administradores do sistema.
 * Estes são os donos das contas que configuram agentes e visualizam conversas.
 */
export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Informações básicas
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: timestamp('email_verified', { mode: 'date' }),
    image: text('image'),

    // Autenticação
    passwordHash: text('password_hash'), // null se usar OAuth

    // Metadados
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
}));

// ─────────────────────────────────────────────────────────────────────────────
// AGENTS TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tabela de agentes de IA.
 * Cada agente representa uma persona/configuração diferente de assistente virtual.
 */
export const agents = pgTable('agents', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Relacionamento com usuário (dono do agente)
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    // Identificação
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'), // Descrição interna (não usada no prompt)

    // Configuração do Prompt
    systemPrompt: text('system_prompt').notNull(),

    // Configuração do Modelo (JSON)
    // Estrutura: { model: string, temperature: number, maxTokens: number }
    modelConfig: jsonb('model_config').notNull().$type<{
        model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo';
        temperature: number;
        maxTokens: number;
    }>().default({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1024,
    }),

    // Ferramentas habilitadas (array de strings)
    enabledTools: jsonb('enabled_tools').$type<string[]>().default([]),

    // ─────────────────────────────────────────────────────────────────────────
    // ZAIA-STYLE: Stage-Based Workflow Configuration
    // ─────────────────────────────────────────────────────────────────────────

    // Perfil da empresa (contexto global injetado em todos os estágios)
    companyProfile: text('company_profile'),

    // Configuração do workflow de estágios (JSON)
    // Array de StageConfig que define o fluxo do agente
    workflowConfig: jsonb('workflow_config').$type<StageConfig[]>().default([]),

    // ─────────────────────────────────────────────────────────────────────────
    // ZAIA-STYLE: Personality & Branding
    // ─────────────────────────────────────────────────────────────────────────

    // Nome público do agente (exibido no chat)
    displayName: varchar('display_name', { length: 100 }),

    // Personalidade do agente
    personality: text('personality'), // Ex: "Amigável e profissional"
    tone: varchar('tone', { length: 50 }).default('friendly'), // formal, informal, friendly, professional
    useEmojis: boolean('use_emojis').default(true),
    language: varchar('language', { length: 10 }).default('pt-BR'),

    // Visual do avatar
    avatarUrl: text('avatar_url'),

    // Configuração do widget de chat
    widgetConfig: jsonb('widget_config').$type<WidgetConfig>().default({
        primaryColor: '#6366f1',
        position: 'right',
        welcomeMessage: 'Olá! Como posso ajudar?',
    }),

    // ─────────────────────────────────────────────────────────────────────────
    // ZAIA-STYLE: Working Hours
    // ─────────────────────────────────────────────────────────────────────────

    workingHours: jsonb('working_hours').$type<WorkingHoursConfig>().default({
        enabled: false,
        timezone: 'America/Sao_Paulo',
        days: [1, 2, 3, 4, 5], // Segunda a Sexta
        start: '09:00',
        end: '18:00',
        outsideMessage: 'Estamos fora do horário de atendimento. Retornaremos em breve!',
    }),

    // Status
    isActive: boolean('is_active').default(false).notNull(),
    isDefault: boolean('is_default').default(false).notNull(), // Agente padrão do usuário

    // Metadados
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index('agents_user_id_idx').on(table.userId),
    activeIdx: index('agents_active_idx').on(table.isActive),
}));

// ─────────────────────────────────────────────────────────────────────────────
// AGENT_STAGES TABLE (State Machine Workflow)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enum para tipos de ações automáticas
 */
export const actionTypeEnum = pgEnum('action_type', [
    'google_calendar_list',    // Listar horários disponíveis
    'google_calendar_create',  // Criar evento no calendar
    'google_sheets_append',    // Adicionar linha na planilha
    'transfer_human',          // Transferir para humano
    'send_whatsapp_template',  // Enviar template do WhatsApp
    'webhook',                 // Chamar webhook externo
]);

/**
 * Tabela de estágios do agente.
 * Define o fluxo de atendimento em formato State Machine.
 * Exemplo: Identificar → Diagnosticar → Agendar → Concluir
 */
export const agentStages = pgTable('agent_stages', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Relacionamento com agente
    agentId: uuid('agent_id')
        .notNull()
        .references(() => agents.id, { onDelete: 'cascade' }),

    // Identificação do estágio
    name: varchar('name', { length: 255 }).notNull(),
    type: stageTypeEnum('type').default('custom').notNull(),
    order: integer('order').notNull(), // Ordem no fluxo (1, 2, 3...)

    // Lógica de transição
    entryCondition: text('entry_condition'), // Condição para entrar neste estágio
    instructions: text('instructions').notNull(), // Prompt específico do estágio

    // Variáveis obrigatórias para avançar
    requiredVariables: jsonb('required_variables').$type<string[]>().default([]),

    // Navegação
    nextStageId: uuid('next_stage_id'), // Próximo estágio (null = fim do fluxo)

    // Status
    isActive: boolean('is_active').default(true).notNull(),

    // Metadados
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    agentIdIdx: index('stages_agent_id_idx').on(table.agentId),
    orderIdx: index('stages_order_idx').on(table.agentId, table.order),
}));

// ─────────────────────────────────────────────────────────────────────────────
// AGENT_ACTIONS TABLE (Actions executed at each stage)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuração de uma ação automática
 */
export type ActionConfig = {
    duration?: number;
    searchWindowDays?: number;
    timeRangeStart?: string;
    timeRangeEnd?: string;
    excludeWeekends?: boolean;
    eventTitleTemplate?: string;
    spreadsheetId?: string;
    sheetName?: string;
    columnMapping?: Record<string, string>;
    webhookUrl?: string;
    webhookMethod?: 'GET' | 'POST';
    webhookHeaders?: Record<string, string>;
    [key: string]: unknown;
};

/**
 * Tabela de ações automáticas.
 * Define o que acontece quando um estágio é ativado.
 */
export const agentActions = pgTable('agent_actions', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Relacionamento com estágio
    stageId: uuid('stage_id')
        .notNull()
        .references(() => agentStages.id, { onDelete: 'cascade' }),

    // Configuração da ação
    type: actionTypeEnum('type').notNull(),
    config: jsonb('config').$type<ActionConfig>().notNull(),

    // Ordem de execução
    order: integer('order').default(0).notNull(),

    // Status
    isActive: boolean('is_active').default(true).notNull(),

    // Metadados
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    stageIdIdx: index('actions_stage_id_idx').on(table.stageId),
    typeIdx: index('actions_type_idx').on(table.type),
}));

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE_BASE TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tabela de base de conhecimento (Cérebro do Agente).
 * Armazena informações para RAG com busca semântica via pgvector.
 */
export const knowledgeBase = pgTable('knowledge_base', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Relacionamento com agente
    agentId: uuid('agent_id')
        .notNull()
        .references(() => agents.id, { onDelete: 'cascade' }),

    // Tipo de conteúdo
    contentType: varchar('content_type', { length: 20 }).default('text').notNull(), // 'text', 'faq', 'file'

    // Conteúdo
    topic: varchar('topic', { length: 255 }).notNull(), // Ex: "Preços", "Metodologia", "FAQ"
    content: text('content').notNull(), // Conteúdo em texto livre ou markdown

    // Embedding para busca semântica (RAG)
    // 1536 dimensões = compatível com text-embedding-3-small da OpenAI
    embedding: vector('embedding', { dimensions: 1536 }),

    // Metadados do arquivo (para conteúdo tipo 'file')
    metadata: jsonb('metadata').$type<{
        fileName?: string;
        fileType?: string;
        fileSize?: number;
        pageNumber?: number;
        chunkIndex?: number;
        source?: string;
    }>().default({}),

    // Metadados para matching tradicional
    keywords: jsonb('keywords').$type<string[]>().default([]),
    priority: integer('priority').default(0).notNull(),

    // Status
    isActive: boolean('is_active').default(true).notNull(),

    // Metadados
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    agentIdIdx: index('knowledge_agent_id_idx').on(table.agentId),
    agentTopicIdx: index('knowledge_agent_topic_idx').on(table.agentId, table.topic),
    contentTypeIdx: index('knowledge_content_type_idx').on(table.agentId, table.contentType),
}));


// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATIONS TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tabela de integrações com serviços externos.
 * Armazena credenciais criptografadas para Google, Meta, etc.
 */
export const integrations = pgTable('integrations', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Relacionamento com usuário
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    // Identificação da integração
    provider: integrationProviderEnum('provider').notNull(),

    // Credenciais (JSON criptografado)
    // Para Google: { accessToken, refreshToken, tokenExpiry, email }
    // Para Meta: { pageId, accessToken }
    credentials: text('credentials').notNull(), // Criptografado com AES-256-GCM

    // Configurações adicionais
    // Para Google Sheets: { spreadsheetId, leadsSheetName }
    // Para Google Calendar: { calendarId }
    config: jsonb('config').$type<Record<string, string>>().default({}),

    // Status
    isActive: boolean('is_active').default(true).notNull(),
    lastUsedAt: timestamp('last_used_at', { mode: 'date' }),

    // Metadados
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    userProviderIdx: uniqueIndex('integrations_user_provider_idx')
        .on(table.userId, table.provider),
}));

// ─────────────────────────────────────────────────────────────────────────────
// THREADS TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tabela de threads (conversas).
 * Cada thread representa uma conversa com um contato único (identificado por telefone).
 */
export const threads = pgTable('threads', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Relacionamento com usuário (dono da conversa)
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    // Relacionamento com agente que responde
    agentId: uuid('agent_id')
        .references(() => agents.id, { onDelete: 'set null' }),

    // Identificador externo (telefone do cliente)
    externalId: varchar('external_id', { length: 50 }).notNull(),

    // Informações do contato (preenchidas ao longo da conversa)
    contactName: varchar('contact_name', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactMetadata: jsonb('contact_metadata').$type<Record<string, string>>().default({}),

    // Status e métricas
    status: threadStatusEnum('status').default('active').notNull(),
    messageCount: integer('message_count').default(0).notNull(),

    // ─────────────────────────────────────────────────────────────────────────
    // ZAIA-STYLE: Human Takeover
    // ─────────────────────────────────────────────────────────────────────────

    // Indica se um humano assumiu a conversa (agente pausado)
    isHumanTakeover: boolean('is_human_takeover').default(false).notNull(),
    takeoverAt: timestamp('takeover_at', { mode: 'date' }),
    takeoverBy: uuid('takeover_by').references(() => users.id),
    takeoverReason: varchar('takeover_reason', { length: 255 }),

    // Timestamps
    firstInteractionAt: timestamp('first_interaction_at', { mode: 'date' }).defaultNow().notNull(),
    lastInteractionAt: timestamp('last_interaction_at', { mode: 'date' }).defaultNow().notNull(),

    // Metadados
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    externalIdIdx: uniqueIndex('threads_external_id_idx')
        .on(table.userId, table.externalId),
    userIdIdx: index('threads_user_id_idx').on(table.userId),
    statusIdx: index('threads_status_idx').on(table.status),
    lastInteractionIdx: index('threads_last_interaction_idx').on(table.lastInteractionAt),
    takeoverIdx: index('threads_takeover_idx').on(table.isHumanTakeover),
}));

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tabela de mensagens.
 * Armazena todas as mensagens trocadas em cada thread.
 */
export const messages = pgTable('messages', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Relacionamento com thread
    threadId: uuid('thread_id')
        .notNull()
        .references(() => threads.id, { onDelete: 'cascade' }),

    // Conteúdo da mensagem
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),

    // Metadados da mensagem
    // Para user: { waMessageId, timestamp }
    // Para assistant: { model, tokensUsed, latencyMs }
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    // Flags
    isFromWebhook: boolean('is_from_webhook').default(false).notNull(),
    wasEdited: boolean('was_edited').default(false).notNull(),

    // Timestamp
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    threadIdIdx: index('messages_thread_id_idx').on(table.threadId),
    threadTimeIdx: index('messages_thread_time_idx')
        .on(table.threadId, table.createdAt),
}));

// ─────────────────────────────────────────────────────────────────────────────
// TOOL_CALLS TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tabela de chamadas de ferramentas.
 * Registra cada vez que a IA utiliza uma ferramenta (schedule_meeting, save_lead, etc).
 */
export const toolCalls = pgTable('tool_calls', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Relacionamento com mensagem (a resposta do assistant que chamou a tool)
    messageId: uuid('message_id')
        .notNull()
        .references(() => messages.id, { onDelete: 'cascade' }),

    // Identificação da ferramenta
    toolName: varchar('tool_name', { length: 100 }).notNull(),

    // Parâmetros enviados para a ferramenta (JSON)
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),

    // Resultado da execução (JSON)
    output: jsonb('output').$type<Record<string, unknown>>(),

    // Status e erro
    status: toolCallStatusEnum('status').default('pending').notNull(),
    error: text('error'), // Mensagem de erro se status = 'failed'

    // Métricas
    executionTimeMs: integer('execution_time_ms'),

    // Timestamp
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    messageIdIdx: index('tool_calls_message_id_idx').on(table.messageId),
    toolNameIdx: index('tool_calls_tool_name_idx').on(table.toolName),
}));

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS TABLE (Zaia-Style State Machine)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tabela de sessões de conversa.
 * Armazena o estado do workflow para cada thread (estágio atual, variáveis coletadas).
 */
export const sessions = pgTable('sessions', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Relacionamento com thread
    threadId: uuid('thread_id')
        .notNull()
        .references(() => threads.id, { onDelete: 'cascade' }),

    // Estado do Workflow
    currentStageId: varchar('current_stage_id', { length: 100 }), // ID do estágio atual
    previousStageId: varchar('previous_stage_id', { length: 100 }), // Estágio anterior

    // Variáveis coletadas durante a conversa (JSON)
    // Ex: { "data.nome": "João", "data.email": "joao@email.com", "data.interesse": "Curso" }
    variables: jsonb('variables').$type<Record<string, unknown>>().default({}),

    // Histórico de estágios visitados
    stageHistory: jsonb('stage_history').$type<string[]>().default([]),

    // Última ferramenta chamada (para debug)
    lastToolCalled: varchar('last_tool_called', { length: 100 }),
    lastToolResult: jsonb('last_tool_result').$type<Record<string, unknown>>(),

    // Status da sessão
    status: sessionStatusEnum('status').default('active').notNull(),

    // Metadados
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
    threadIdIdx: uniqueIndex('sessions_thread_id_idx').on(table.threadId),
    statusIdx: index('sessions_status_idx').on(table.status),
}));

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS (Drizzle Relations)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Relações do usuário
 */
export const usersRelations = relations(users, ({ many }) => ({
    agents: many(agents),
    integrations: many(integrations),
    threads: many(threads),
}));

/**
 * Relações do agente
 */
export const agentsRelations = relations(agents, ({ one, many }) => ({
    user: one(users, {
        fields: [agents.userId],
        references: [users.id],
    }),
    stages: many(agentStages),
    knowledgeBase: many(knowledgeBase),
    threads: many(threads),
}));


/**
 * Relações da base de conhecimento
 */
export const knowledgeBaseRelations = relations(knowledgeBase, ({ one }) => ({
    agent: one(agents, {
        fields: [knowledgeBase.agentId],
        references: [agents.id],
    }),
}));

/**
 * Relações das integrações
 */
export const integrationsRelations = relations(integrations, ({ one }) => ({
    user: one(users, {
        fields: [integrations.userId],
        references: [users.id],
    }),
}));

/**
 * Relações da thread
 */
export const threadsRelations = relations(threads, ({ one, many }) => ({
    user: one(users, {
        fields: [threads.userId],
        references: [users.id],
    }),
    agent: one(agents, {
        fields: [threads.agentId],
        references: [agents.id],
    }),
    messages: many(messages),
    session: one(sessions, {
        fields: [threads.id],
        references: [sessions.threadId],
    }),
}));

/**
 * Relações das mensagens
 */
export const messagesRelations = relations(messages, ({ one, many }) => ({
    thread: one(threads, {
        fields: [messages.threadId],
        references: [threads.id],
    }),
    toolCalls: many(toolCalls),
}));

/**
 * Relações das chamadas de ferramentas
 */
export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
    message: one(messages, {
        fields: [toolCalls.messageId],
        references: [messages.id],
    }),
}));

/**
 * Relações das sessões
 */
export const sessionsRelations = relations(sessions, ({ one }) => ({
    thread: one(threads, {
        fields: [sessions.threadId],
        references: [threads.id],
    }),
}));

/**
 * Relações dos estágios
 */
export const agentStagesRelations = relations(agentStages, ({ one, many }) => ({
    agent: one(agents, {
        fields: [agentStages.agentId],
        references: [agents.id],
    }),
    actions: many(agentActions),
}));

/**
 * Relações das ações
 */
export const agentActionsRelations = relations(agentActions, ({ one }) => ({
    stage: one(agentStages, {
        fields: [agentActions.stageId],
        references: [agentStages.id],
    }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// TYPES (Inferidos do Schema)
// ─────────────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type AgentStage = typeof agentStages.$inferSelect;
export type NewAgentStage = typeof agentStages.$inferInsert;

export type AgentAction = typeof agentActions.$inferSelect;
export type NewAgentAction = typeof agentActions.$inferInsert;

export type KnowledgeBaseItem = typeof knowledgeBase.$inferSelect;
export type NewKnowledgeBaseItem = typeof knowledgeBase.$inferInsert;

export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;

export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// ENUM TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';
export type ThreadStatus = 'active' | 'pending' | 'qualified' | 'booked' | 'archived';
export type IntegrationProvider = 'google' | 'meta' | 'whatsapp' | 'openai';
export type ToolCallStatus = 'pending' | 'success' | 'failed';
export type StageType = 'identify' | 'diagnosis' | 'schedule' | 'handoff' | 'custom';
export type SessionStatus = 'active' | 'completed' | 'abandoned';

// ─────────────────────────────────────────────────────────────────────────────
// WIDGET CONFIG TYPE (Zaia-Style)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuração visual do widget de chat
 */
export type WidgetConfig = {
    /** Cor principal do widget */
    primaryColor: string;

    /** Posição na tela */
    position: 'left' | 'right';

    /** Mensagem de boas-vindas */
    welcomeMessage: string;

    /** Cor de fundo (opcional) */
    backgroundColor?: string;

    /** Cor do texto (opcional) */
    textColor?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKING HOURS CONFIG TYPE (Zaia-Style)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuração de horário de funcionamento do agente
 */
export type WorkingHoursConfig = {
    /** Se o horário de funcionamento está ativo */
    enabled: boolean;

    /** Timezone do horário (ex: America/Sao_Paulo) */
    timezone: string;

    /** Dias ativos (0 = Domingo, 6 = Sábado) */
    days: number[];

    /** Horário de início (HH:MM) */
    start: string;

    /** Horário de término (HH:MM) */
    end: string;

    /** Mensagem exibida fora do horário */
    outsideMessage: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// STAGE CONFIG TYPE (Zaia-Style Workflow)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuração de um estágio no workflow do agente.
 * Define o fluxo de atendimento: Identificar -> Diagnosticar -> Agendar
 */
export type StageConfig = {
    /** ID único do estágio */
    id: string;

    /** Tipo do estágio */
    type: StageType;

    /** Nome exibido na UI */
    name: string;

    /** Descrição do estágio */
    description?: string;

    /** Condições para entrar neste estágio (texto livre para a IA) */
    conditions: string;

    /** Variáveis obrigatórias para avançar (ex: ["data.nome", "data.email"]) */
    requiredVariables: string[];

    /** Prompt específico deste estágio (complementa o system prompt) */
    prompt: string;

    /** Configuração de ação automática (Calendar, Sheets, etc) */
    actionConfig?: {
        /** Provedor da ação */
        provider: 'google_calendar' | 'google_sheets' | 'whatsapp';

        /** Tipo de ação */
        action: 'list_slots' | 'create_event' | 'append_row' | 'send_template';

        /** Configurações específicas da ação */
        settings: {
            /** Para Calendar: duração em minutos */
            duration?: number;

            /** Para Calendar: janela de busca em dias */
            searchWindowDays?: number;

            /** Para Calendar: horário inicial (HH:MM) */
            timeRangeStart?: string;

            /** Para Calendar: horário final (HH:MM) */
            timeRangeEnd?: string;

            /** Para Calendar: excluir fins de semana */
            excludeWeekends?: boolean;

            /** Para Calendar: ajuste de prompt (ex: "prefira manhãs") */
            promptAdjustment?: string;

            /** Para Calendar: template do título do evento */
            eventTitleTemplate?: string;

            /** Para Sheets: ID da planilha */
            spreadsheetId?: string;

            /** Para Sheets: nome da aba */
            sheetName?: string;

            /** Configurações adicionais */
            [key: string]: unknown;
        };
    };

    /** ID do próximo estágio (null = fim do fluxo) */
    nextStageId?: string | null;

    /** Ordem de exibição na UI */
    order: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera um ID único para um novo estágio
 */
export function generateStageId(): string {
    return `stage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
