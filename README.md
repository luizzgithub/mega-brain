# 🧠 Mega Cérebro

Assistente conversacional local com transcrição de áudio/vídeo via **whisper.cpp**, dashboard web multi-página, chat com IA, briefing diário, gestão de projetos e kanban de tasks.

```
Navegador
    ↓
/login.html  →  JWT  →  Dashboard (menu lateral)
    ↓                        ↓
Express API (porta 4144)   Chat · Recorder · Briefing · Projetos · Kanban
    ↓
Fila (p-queue) → whisper-server.exe → texto transcrito
    ↓
SQLite (data/app.db)
```

---

## Pré-requisitos

| Ferramenta | Versão mínima | Observação |
|------------|--------------|------------|
| Node.js | v18+ | https://nodejs.org |
| whisper-server.exe | build recente | whisper.cpp releases |
| FFmpeg | estável | conversão de áudio/vídeo |
| Python | 3.x | opcional, para diarização |

---

## Instalação rápida

### 1. Clonar e instalar

```bash
git clone https://github.com/luizzgithub/mega-brain.git
cd mega-brain
npm install
```

### 2. Whisper + FFmpeg

Baixe o [whisper.cpp release](https://github.com/ggerganov/whisper.cpp/releases) (Windows: `whisper-bin-x64.zip`) e coloque em:

```
C:\Tools\whisper\
├── whisper-server.exe
└── models\
    └── ggml-medium.bin
```

FFmpeg via winget:

```powershell
winget install ffmpeg
ffmpeg -version
```

### 3. Configurar ambiente

```powershell
copy .env.example .env
```

Ajuste paths no `.env` se necessário. Padrões apontam para `C:\Tools\whisper\`.

### 4. Baixar modelo

```bash
npm run download-model          # medium (~1.5 GB) — recomendado
npm run download-small-model    # small (~500 MB)
npm run download-base-model     # base (~150 MB)
npm run download-large-v3-model # large-v3 (~3 GB)
```

### 5. Criar usuário admin

```bash
node scripts/seed-admin.js
```

Credenciais padrão: **`admin@teste.com`** / **`admin123`**

### 6. Iniciar

```bash
npm start     # produção
npm run dev   # desenvolvimento (hot-reload)
```

Abra: **http://localhost:4144/login.html**

---

## Interface web

Dashboard com menu lateral fixo. Login dedicado em `/login.html`.

| Página | URL | Função |
|--------|-----|--------|
| Login | `/login.html` | Entrar ou cadastrar |
| Chat | `/chat.html` | Assistente conversacional |
| Recorder | `/recorder.html` | Gravar/upload de áudio e transcrições |
| Briefing | `/briefing.html` | Resumo do dia, lembretes e sugestões |
| Projetos | `/projects.html` | CRUD de projetos |
| Kanban | `/kanban.html` | Tasks em colunas com drag-and-drop |

### Navegação e auth

- **`/`** — redireciona para login (sem token) ou chat (com token)
- Páginas protegidas redirecionam para `/login.html?returnTo=...` se não autenticado
- Após login, volta para a página solicitada ou `/chat.html`
- **Sair** no menu lateral limpa a sessão e vai para `/login.html`

Token JWT fica em `localStorage` (`mc_token`).

---

## API

Referência detalhada em [API.md](./API.md).

### Endpoints principais

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/login` | — | Login (email, password) |
| POST | `/api/auth/register` | — | Cadastro |
| GET | `/api/auth/me` | ✓ | Dados do usuário logado |
| POST | `/api/transcribe` | ✓ | Upload e transcrição de áudio/vídeo |
| GET | `/api/status` | — | Status da fila e whisper-server |
| GET | `/api/health` | — | Health check |
| POST | `/api/chat` | ✓ | Enviar mensagem ao assistente |
| GET | `/api/briefing` | ✓ | Briefing do dia |
| GET/POST | `/api/projects` | ✓ | Listar/criar projetos |
| GET/POST | `/api/tasks` | ✓ | Listar/criar tasks |
| GET | `/api/transcriptions` | ✓ | Histórico de transcrições |

### Exemplo — transcrever áudio

```bash
# 1. Obter token
curl -X POST http://localhost:4144/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@teste.com","password":"admin123"}'

# 2. Transcrever (substitua TOKEN)
curl -X POST http://localhost:4144/api/transcribe \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@audio.wav" \
  -F "language=pt"
```

---

## Estrutura do projeto

```
mega-brain/
├── public/              # Frontend estático
│   ├── login.html       # Página de login
│   ├── chat.html        # Páginas do dashboard
│   ├── js/              # Módulos ES (main, shell, auth, chat, …)
│   └── css/app.css      # Estilos globais + shell + kanban
├── src/
│   ├── server.js        # Entry point
│   ├── app.js           # Express + rotas
│   ├── db.js            # Schema SQLite
│   ├── queue.js         # Fila de transcrição
│   ├── whisperProcess.js
│   └── routes/          # Rotas API por domínio
├── data/
│   ├── app.db           # Banco SQLite
│   └── media/           # Arquivos de mídia persistidos
├── uploads/             # Temporários de upload
├── logs/                # combined.log, error.log
└── scripts/             # seed-admin, download-model, check-tools
```

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `4144` | Porta da API/web |
| `WHISPER_SERVER_PATH` | `C:\Tools\whisper\whisper-server.exe` | Executável whisper |
| `WHISPER_MODEL_PATH` | `...\ggml-medium.bin` | Modelo GGML |
| `WHISPER_LANGUAGE` | `pt` | Idioma padrão |
| `WHISPER_THREADS` | `4` | Threads CPU |
| `WHISPER_PORT` | `8080` | Porta interna whisper-server |
| `QUEUE_CONCURRENCY` | `1` | Jobs simultâneos na fila |
| `MAX_FILE_SIZE_MB` | `500` | Limite de upload |
| `JWT_SECRET` | `mega-brain-dev-secret` | Segredo JWT (altere em produção) |
| `ASSISTANT_BRIEFING_MODEL` | `gpt-4o-mini` | Modelo do briefing |
| `PROXY_HUB_URL` | — | LLM alternativo (opcional) |
| `SEARXNG_BASE_URL` | `http://localhost:4000` | Buscador web (opcional) |

Ver `.env.example` para lista completa (ProxyHub, SearXNG, Scraper, diarização, etc.).

---

## Scripts úteis

```bash
npm run check-tools    # diagnóstico de ffmpeg, python, whisper
node scripts/seed-admin.js   # recriar admin se necessário
```

---

## Licença

MIT
