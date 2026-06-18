# API Reference — mega-brain

Base URL: `http://localhost:4144`

---

## POST /api/transcribe

Transcreve um arquivo de áudio para texto.

**Request**

`Content-Type: multipart/form-data`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `file` | arquivo de áudio | sim | Qualquer formato suportado pelo ffmpeg (WAV, MP3, MP4, WebM, OGG, FLAC, etc.) |
| `language` | string | não | Código do idioma (ex: `pt`, `en`, `es`). Padrão: valor de `WHISPER_LANGUAGE` no `.env` |
| `temperature` | number | não | Temperatura de amostragem (0.0–1.0). Padrão: `0.0` |
| `response_format` | string | não | Formato da resposta: `json`, `text`, `vtt`, `srt`. Padrão: `json` |

**Exemplos**

```bash
# curl — arquivo WAV
curl -X POST http://localhost:4144/api/transcribe \
  -F "file=@audio.wav" \
  -F "language=pt"

# curl — com formato SRT (legendas)
curl -X POST http://localhost:4144/api/transcribe \
  -F "file=@audio.mp3" \
  -F "response_format=srt"
```

```js
// JavaScript / fetch
const form = new FormData()
form.append('file', audioBlob, 'audio.webm')
form.append('language', 'pt')

const res = await fetch('http://localhost:4144/api/transcribe', {
  method: 'POST',
  body: form
})
const data = await res.json()
console.log(data.result.text)
```

```python
# Python / requests
import requests

with open('audio.wav', 'rb') as f:
    res = requests.post(
        'http://localhost:4144/api/transcribe',
        files={'file': ('audio.wav', f, 'audio/wav')},
        data={'language': 'pt'}
    )
print(res.json()['result']['text'])
```

**Response 200**

```json
{
  "success": true,
  "duration_ms": 1842,
  "result": {
    "text": "Olá, este é um exemplo de transcrição."
  }
}
```

> Com `response_format=srt` ou `vtt`, o campo `result` retorna a string formatada diretamente em vez de um objeto.

**Response 400** — nenhum arquivo enviado

```json
{
  "success": false,
  "error": "No audio file provided."
}
```

**Response 500** — erro na transcrição

```json
{
  "success": false,
  "error": "mensagem de erro"
}
```

---

## GET /api/status

Retorna o estado atual do servidor whisper e da fila de transcrições.

**Request**

Sem parâmetros.

**Exemplo**

```bash
curl http://localhost:4144/api/status
```

**Response 200**

```json
{
  "whisper_server": "online",
  "queue": {
    "pending": 0,
    "size": 0,
    "concurrency": 1
  },
  "config": {
    "model": "ggml-small.bin",
    "language": "pt",
    "threads": 6
  }
}
```

| Campo | Valores | Descrição |
|-------|---------|-----------|
| `whisper_server` | `"online"` / `"offline"` | Se o whisper-server.exe está respondendo |
| `queue.pending` | number | Jobs em execução agora |
| `queue.size` | number | Jobs aguardando na fila |
| `queue.concurrency` | number | Máximo de jobs simultâneos (`QUEUE_CONCURRENCY`) |

---

## GET /api/health

Healthcheck simples. Retorna imediatamente sem verificar o whisper-server.

**Exemplo**

```bash
curl http://localhost:4144/api/health
```

**Response 200**

```json
{
  "status": "ok",
  "timestamp": "2026-06-17T21:00:00.000Z"
}
```

---

## Notas de integração

**Fila sequencial**
Por padrão (`QUEUE_CONCURRENCY=1`), as requisições são processadas uma por vez. Múltiplas chamadas simultâneas ficam enfileiradas e respondidas na ordem de chegada — não há necessidade de controle de concorrência no lado do cliente.

**Timeout**
A requisição ao `/api/transcribe` não tem timeout — ela aguarda a transcrição completa. Para arquivos longos (>5 min), configure o timeout do seu cliente HTTP para `0` (sem limite) ou para um valor alto (ex: 5 minutos).

**Tamanho máximo de arquivo**
Padrão: 50 MB (configurável via `MAX_FILE_SIZE_MB` no `.env`). Arquivos maiores retornam HTTP 413.

**CORS**
A API aceita requisições de qualquer origem (`*`), então pode ser chamada diretamente de um frontend em outra porta.
