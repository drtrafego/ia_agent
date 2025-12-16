# IA Agent

Plataforma de automação de atendimento via WhatsApp com agentes de IA configuráveis.

## 🚀 Stack Tecnológica

- **Framework:** Next.js 15 (App Router)
- **Linguagem:** TypeScript (Strict Mode)
- **AI Engine:** Vercel AI SDK Core + OpenAI
- **Database:** Neon (Serverless Postgres) + Drizzle ORM
- **Deployment:** Vercel
- **UI Library:** Shadcn UI
- **Styling:** Tailwind CSS 4
- **Icons:** Lucide React

## 📁 Estrutura do Projeto

```
/src
├── /app                    # Next.js App Router
│   ├── /dashboard          # Painel protegido
│   ├── /api                # API Routes
│   │   ├── /agents         # CRUD de agentes
│   │   ├── /threads        # Gerenciamento de conversas
│   │   └── /messages       # Mensagens e chat
│   └── page.tsx            # Landing page
├── /components
│   ├── /ui                 # Shadcn primitives
│   ├── /layout             # Sidebar, Header
│   └── /features           # Componentes por funcionalidade
├── /lib
│   ├── /ai                 # Vercel AI SDK config
│   ├── /db                 # Drizzle Client
│   └── utils.ts            # Helpers
├── /db
│   └── /schema             # Schemas do banco de dados
│       ├── chat.ts         # Threads, messages
│       ├── agents.ts       # Configuração de agentes
│       └── users.ts        # Usuários
└── drizzle.config.ts       # Configuração do Drizzle ORM
```

## 🛠️ Setup Local

### 1. Clonar repositório

```bash
git clone git@github.com:drtrafego/ia_agent.git
cd ia_agent
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Database (Obrigatório)
DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require

# OpenAI (Obrigatório)
OPENAI_API_KEY=sk-proj-...

# Google Calendar (Opcional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=

# Default User ID (Obrigatório - ver seção "Setup do Banco de Dados")
DEFAULT_USER_ID=uuid-do-usuario-padrao

# NextAuth
NEXTAUTH_URL=http://localhost:3000
```

> ⚠️ **IMPORTANTE**: Nunca commite o arquivo `.env.local`! Ele já está no `.gitignore`.

### 4. Setup do Banco de Dados

#### 4.1. Criar as tabelas

```bash
npx dotenv -e .env.local -- npx drizzle-kit push
```

#### 4.2. Criar usuário padrão

Acesse o [Neon Console](https://console.neon.tech) → SQL Editor e execute:

```sql
INSERT INTO users (name, email, created_at, updated_at) 
VALUES ('Admin', 'admin@ia-agent.com', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
RETURNING id;
```

Copie o `id` retornado e adicione ao `.env.local`:

```env
DEFAULT_USER_ID=<id-copiado>
```

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 🌐 Deploy no Vercel

### 1. Push para GitHub

```bash
git add .
git commit -m "sua mensagem"
git push origin main
```

### 2. Conectar no Vercel

1. Acesse: https://vercel.com/new
2. Selecione o repositório `ia_agent`
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (deixe em branco)
   - **Build Command**: `next build`

### 3. Adicionar Variáveis de Ambiente

Em **Environment Variables**, adicione:

| Name | Value | Onde obter |
|------|-------|------------|
| `DATABASE_URL` | `postgresql://...` | [Neon Console](https://console.neon.tech) |
| `OPENAI_API_KEY` | `sk-proj-...` | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `DEFAULT_USER_ID` | `uuid-...` | Execute SQL acima no Neon |
| `GOOGLE_CLIENT_ID` | *(opcional)* | [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | *(opcional)* | Google Cloud Console |

### 4. Deploy

Clique em **Deploy** e aguarde o build completar.

### 5. Criar Tabelas no Banco (Primeira vez)

Após o primeiro deploy, rode localmente:

```bash
npx dotenv -e .env.local -- npx drizzle-kit push
```

Ou execute os SQLs manualmente no Neon Console.

## 📊 Banco de Dados

### Estrutura das Tabelas

#### `agents`
Configuração dos agentes de IA
- `id`, `name`, `description`, `system_prompt`
- `model_config` (JSON: modelo, temperatura, etc)
- `user_id` (vinculado ao usuário criador)

#### `threads`
Conversas/Sessões de chat
- `id`, `agent_id`, `user_id`
- `created_at`, `updated_at`

#### `messages`
Mensagens das conversas
- `id`, `thread_id`, `role` (user/assistant)
- `content`, `created_at`

#### `users`
Usuários do sistema
- `id`, `name`, `email`

### Gerenciar Banco de Dados

```bash
# Ver dados (interface visual)
npm run db:studio

# Gerar novas migrações
npm run db:generate

# Aplicar migrações
npm run db:push
```

## 🔧 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Desenvolvimento (porta 3000) |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | Executar ESLint |
| `npm run db:generate` | Gerar migrações Drizzle |
| `npm run db:push` | Aplicar migrações no banco |
| `npm run db:studio` | Abrir Drizzle Studio (GUI) |

## 🐛 Troubleshooting

### Erro: `relation "agents" does not exist`
**Causa**: Tabelas não foram criadas no banco.  
**Solução**: Rode `npx drizzle-kit push` (ver seção "Setup do Banco de Dados")

### Erro: `user_id violates not-null constraint`
**Causa**: Variável `DEFAULT_USER_ID` não está configurada.  
**Solução**: Crie usuário padrão no banco e adicione o ID ao `.env.local` / Vercel

### Erro: `DATABASE_URL is not defined`
**Causa**: Arquivo `.env.local` não existe ou está mal configurado.  
**Solução**: Crie o arquivo com as variáveis necessárias (ver seção "Setup Local")

### Push para GitHub bloqueado (GH013)
**Causa**: GitHub detectou secrets (credenciais) no código.  
**Solução**:
- Nunca commite `.env.local` ou arquivos com credenciais reais
- Use `.env.example` apenas com placeholders
- Verifique se `.gitignore` inclui `.env.local`

## 🔐 Segurança

- ✅ Todas as credenciais em variáveis de ambiente
- ✅ `.env.local` no `.gitignore`
- ✅ Nunca fazer commit de secrets no código
- ✅ Use `.env.example` apenas com valores de exemplo

## 📝 License

Proprietary - Casal do Tráfego © 2024-2025
