# 🧠 Mega Cerebro — Whisper Serve

API Node.js + interface web para transcrição de áudio usando **whisper.cpp** rodando localmente. Resolve o problema de o `whisper-server.exe` aceitar apenas uma requisição por vez: as chamadas entram em uma fila e são processadas na ordem de chegada.

```
Navegador / Cliente HTTP
        ↓
POST /api/transcribe
        ↓
   Fila (p-queue)
        ↓
 whisper-server.exe
        ↓
  texto transcrito
```

A interface web (`/public`) tem visualizador de onda sonora em tempo real, animação de transcrição e acumula o texto a cada gravação.

---

## Pré-requisitos

| Ferramenta | Versão mínima | Link |
|------------|--------------|------|
| Node.js | v18+ | https://nodejs.org |
| whisper-server.exe | qualquer build recente | ver abaixo |
| FFmpeg | qualquer versão estável | ver abaixo |

---

## 1. Baixar o whisper.cpp

Acesse a página de releases do projeto:

> **https://github.com/ggerganov/whisper.cpp/releases**

Baixe o pacote para Windows (ex: `whisper-bin-x64.zip`) e extraia. O arquivo que você precisa é o **`whisper-server.exe`**.

Coloque-o neste caminho:

```
C:\Tools\whisper\whisper-server.exe
```

> Não tem esse caminho? Crie as pastas: `C:\Tools\whisper\` e dentro dela `models\`.

---

## 2. Baixar o FFmpeg

O FFmpeg é necessário para converter os formatos de áudio enviados para WAV antes de passar ao whisper.

**Opção A — via winget (mais fácil):**
```powershell
winget install ffmpeg
```

**Opção B — manual:**
Baixe em https://ffmpeg.org/download.html, extraia e adicione a pasta `bin\` ao PATH do sistema.

Confirme que funcionou:
```powershell
ffmpeg -version
```

---

## 3. Estrutura de pastas esperada

```
C:\Tools\whisper\
├── whisper-server.exe
└── models\
    └── ggml-medium.bin    ← baixado no passo 5
```

---

## 4. Instalar dependências

```bash
npm install
```

---

## 5. Configurar

Copie o arquivo de exemplo de configuração:

```powershell
copy .env.example .env
```

Abra o `.env` e ajuste se necessário. Os padrões já apontam para `C:\Tools\whisper\` e funcionam sem alteração se você seguiu a estrutura acima.

---

## 6. Baixar o modelo de IA

```bash
npm run download-model        # ggml-medium  (~1.5 GB) — melhor qualidade
npm run download-small-model  # ggml-small   (~500 MB) — equilibrado
npm run download-base-model   # ggml-base    (~150 MB) — mais rápido
```

O modelo é salvo automaticamente em `C:\Tools\whisper\models\`.

> Para trocar o modelo depois, edite `WHISPER_MODEL_PATH` no `.env`.

---

## 7. Rodar

```bash
npm start        # modo produção
npm run dev      # modo desenvolvimento (reinicia ao salvar arquivos)
```

Abra o navegador em:

> **http://localhost:4144**

---

## Interface web

Clique no botão central para iniciar a gravação. O gráfico de onda mostra o áudio sendo capturado em tempo real. Ao parar, o áudio é enviado ao servidor e o texto transcrito vai sendo acumulado na área de texto.

---

## API

Referência completa em [API.md](./API.md).

Exemplo rápido com curl:

```bash
# transcrever um arquivo
curl -X POST http://localhost:4144/api/transcribe \
  -F "file=@audio.wav" \
  -F "language=pt"

# verificar status da fila e do servidor whisper
curl http://localhost:4144/api/status
```

Resposta:

```json
{
  "success": true,
  "duration_ms": 1420,
  "result": {
    "text": "Olá, este é um exemplo de transcrição."
  }
}
```

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `4144` | Porta da API |
| `WHISPER_SERVER_PATH` | `C:\Tools\whisper\whisper-server.exe` | Caminho do executável |
| `WHISPER_MODEL_PATH` | `C:\Tools\whisper\models\ggml-medium.bin` | Caminho do modelo |
| `WHISPER_LANGUAGE` | `pt` | Idioma padrão (`pt`, `en`, `es`, `auto`…) |
| `WHISPER_THREADS` | `4` | Threads de CPU para o whisper |
| `WHISPER_PORT` | `8080` | Porta interna do whisper-server |
| `QUEUE_CONCURRENCY` | `1` | Jobs simultâneos na fila |
| `MAX_FILE_SIZE_MB` | `50` | Limite de tamanho de upload |

---

## Licença

MIT
