# AGENTS.md

Guia para agentes e desenvolvedores que trabalham neste repositório.

## Commands

```bash
npm install                   # instalar dependências
npm start                     # produção: node src/server.js
npm run dev                   # desenvolvimento: node --watch src/server.js
npm run download-model        # ggml-medium (~1.5GB)
npm run download-small-model  # ggml-small (~500MB)
npm run download-base-model   # ggml-base (~150MB)
npm run download-large-v3-model  # ggml-large-v3
npm run check-tools           # verificar ffmpeg, python, whisper, etc.
node scripts/seed-admin.js    # criar usuário admin no SQLite
```

Não há testes ou linter configurados.

Credenciais padrão do seed admin: `admin@teste.com` / `admin123`.

---

## Architecture

Node.js + Express 5 com UI web multi-página em `/public`. A API faz proxy do `whisper-server.exe` (whisper.cpp) via fila FIFO (`p-queue`, concurrency=1). Autenticação JWT + SQLite. Assistente conversacional via OpenAI/ProxyHub.

### Fluxo de transcrição

```
Client → POST /api/transcribe → multer (uploads/) → TranscriptionQueue
  → HTTP POST whisper-server:8080/inference → resposta JSON
```

### Fluxo de autenticação (frontend)

```
Página protegida sem token → /login.html?returnTo=...
Login OK → returnTo ou /chat.html
Logout → /login.html
/ ou /index.html com token → /chat.html
```

### Backend — módulos principais

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/server.js` | Entry point; Express + spawn whisper-server |
| `src/whisperProcess.js` | Lifecycle do whisper-server.exe |
| `src/queue.js` | Singleton TranscriptionQueue (p-queue) |
| `src/config.js` | Config via env vars |
| `src/app.js` | Express app, middleware, mount de rotas |
| `src/db.js` | Schema SQLite (users, transcriptions, projects, tasks, …) |
| `src/agent.js` | Assistente conversacional (OpenAI) |
| `src/middleware/auth.js` | JWT middleware |

### Backend — rotas API

| Prefixo | Arquivo | Descrição |
|---------|---------|-----------|
| `/api` | `src/routes.js` | `/transcribe`, `/status`, `/health` |
| `/api/auth` | `src/routes/auth.js` | login, register, me |
| `/api/chat` | `src/routes/chat.js` | conversas e mensagens |
| `/api/briefing` | `src/routes/briefing.js` | briefing diário |
| `/api/reminders` | `src/routes/reminders.js` | lembretes CRUD |
| `/api/suggestions` | `src/routes/suggestions.js` | sugestões CRUD |
| `/api/transcriptions` | `src/routes/transcriptions.js` | histórico, mídia, export |
| `/api/knowledge` | `src/routes/knowledge.js` | base de conhecimento |
| `/api/search` | `src/routes/search.js` | busca web |
| `/api/projects` | `src/routes/projects.js` | projetos CRUD |
| `/api/tasks` | `src/routes/tasks.js` | tasks CRUD |

Respostas JSON no formato `{ success: true/false, data: ... }` (exceto alguns endpoints legados em `/api`).

### Frontend — páginas HTML

| Arquivo | Rota | Módulo JS |
|---------|------|-----------|
| `public/login.html` | `/login.html` | `js/login.js` |
| `public/index.html` | `/` | `js/main.js` (redirect) |
| `public/chat.html` | `/chat.html` | `js/chat.js` |
| `public/recorder.html` | `/recorder.html` | `js/transcription.js` |
| `public/briefing.html` | `/briefing.html` | `js/briefing.js` |
| `public/projects.html` | `/projects.html` | `js/projects.js` |
| `public/kanban.html` | `/kanban.html` | `js/kanban.js` |

### Frontend — módulos JS

| Arquivo | Responsabilidade |
|---------|------------------|
| `js/main.js` | Bootstrap das páginas autenticadas; redirect se sem token |
| `js/login.js` | Bootstrap da página de login |
| `js/auth.js` | Login, logout, redirectToLogin, getReturnTo |
| `js/shell.js` | Menu lateral + header reutilizável |
| `js/state.js` | Estado global (token, user, conversationId, …) |
| `js/api.js` | Cliente HTTP com Bearer token |
| `js/utils.js` | Helpers (toast, escapeHtml, …) |
| `js/tasks.js` | Funções compartilhadas de tasks (API + UI) |
| `js/dashboard.js` | loadUserFromApi e helpers legados |

Cada página autenticada exporta `init*()` que renderiza conteúdo em `#appContent` (dentro do shell).

### Database

SQLite via better-sqlite3 em `data/app.db` (WAL mode). Tabelas principais:

- `users` — autenticação
- `transcriptions` — histórico de áudio/vídeo transcrito
- `conversations`, `messages` — chat
- `reminders`, `suggestions` — briefing
- `projects`, `tasks` — gestão de projetos/kanban

### Logging

Winston → `logs/combined.log` e `logs/error.log`; console fora de `production`.

---

## Conventions

- Configuração via variáveis de ambiente (`.env.example` → `.env`)
- Paths padrão Windows: `C:\Tools\whisper\` com `whisper-server.exe` e `models\`
- Temp files em `uploads/` sempre limpos em `finally`
- Queue concurrency padrão 1 — nunca chamar whisper-server em paralelo
- IDs com `crypto.randomUUID()`
- Rotas autenticadas usam `authMiddleware` e filtram por `user_id`
- Token JWT em `localStorage` (`mc_token`, `mc_user`)
- CSS em `public/css/app.css`; layout shell com `.app-shell`, `.app-sidebar`

---

## Do not

- Não executar whisper-server concorrentemente — usar sempre `TranscriptionQueue`
- Não assumir que o modelo existe no startup; servidor sobe sem ele, transcrição falha
- Não deletar `data/app.db*` sem entender implicações WAL
- Não hardcodar config — usar `src/config.js`
- Não pular cleanup de arquivos temporários na fila
- Não reintroduzir login embutido nas páginas do app — usar `/login.html`
- Não usar aspas duplas para literais string em ORDER BY SQLite (`"done"` vira coluna); usar `'done'` ou `CASE WHEN`
