/**
 * Mega Cerebro – Variáveis de ambiente por módulo.
 *
 * proxyHub   – Provedor LLM alternativo (compatível com OpenAI).
 * searxng    – Buscador web privado.
 * scraperApi – Serviço de scraping web.
 */
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const DEFAULT_MODELS_DIR = 'C:\\Tools\\whisper\\models';

function resolveModelName() {
  if (process.env.WHISPER_MODEL) {
    return process.env.WHISPER_MODEL;
  }
  const modelPath = process.env.WHISPER_MODEL_PATH || path.join(DEFAULT_MODELS_DIR, 'ggml-medium.bin');
  const base = path.basename(modelPath, path.extname(modelPath));
  if (base.startsWith('ggml-')) {
    return base.slice('ggml-'.length);
  }
  return 'medium';
}

const whisperModelName = resolveModelName();
const whisperModelsDir = process.env.WHISPER_MODELS_DIR || DEFAULT_MODELS_DIR;
const whisperModelPath = process.env.WHISPER_MODEL_PATH
  || path.join(whisperModelsDir, `ggml-${whisperModelName}.bin`);

module.exports = {
  port: process.env.PORT || 4144,
  whisper: {
    mode: (process.env.WHISPER_MODE || 'cli').toLowerCase(),
    cliPath: process.env.WHISPER_CLI_PATH || 'C:\\Tools\\whisper\\whisper-cli.exe',
    modelsDir: whisperModelsDir,
    modelName: whisperModelName,
    modelPath: whisperModelPath,
    path: process.env.WHISPER_SERVER_PATH || 'C:\\Tools\\whisper\\whisper-server.exe',
    model: whisperModelPath,
    host: process.env.WHISPER_HOST || '127.0.0.1',
    port: process.env.WHISPER_PORT || 8080,
    language: process.env.WHISPER_LANGUAGE || 'pt',
    threads: parseInt(process.env.WHISPER_THREADS || '4', 10),
  },
  queueConcurrency: parseInt(process.env.QUEUE_CONCURRENCY || '1', 10),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10),
  uploadDir: path.join(__dirname, '../uploads'),
  mediaDir: process.env.MEDIA_DIR || path.join(__dirname, '../data/media'),
  logDir: path.join(__dirname, '../logs'),
  ffmpeg: {
    path: process.env.FFMPEG_PATH || 'ffmpeg',
  },
  diarization: {
    pythonPath: process.env.PYTHON_PATH || 'python',
    hfToken: process.env.HF_TOKEN || '',
    minSpeakers: process.env.DIARIZE_MIN_SPEAKERS ? parseInt(process.env.DIARIZE_MIN_SPEAKERS, 10) : null,
    maxSpeakers: process.env.DIARIZE_MAX_SPEAKERS ? parseInt(process.env.DIARIZE_MAX_SPEAKERS, 10) : null,
  },
  jwtSecret: process.env.JWT_SECRET || 'mega-brain-dev-secret',
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  },
  proxyHub: {
    url: process.env.PROXY_HUB_URL,
    apiKey: process.env.PROXY_HUB_API_KEY,
    timeout: parseInt(process.env.PROXY_HUB_TIMEOUT || '30000', 10),
    queueDelay: parseInt(process.env.PROXY_HUB_QUEUE_DELAY || '200', 10),
    model: process.env.PROXY_HUB_MODEL_DEFAULT || 'llama-3.3-70b-instruct',
  },
  searxng: {
    baseUrl: process.env.SEARXNG_BASE_URL || 'http://localhost:4000',
    searchPath: process.env.SEARXNG_SEARCH_PATH || '/search',
    timeout: parseInt(process.env.SEARXNG_TIMEOUT || '15000', 10),
    scrapeTopN: parseInt(process.env.SEARXNG_SCRAPE_TOP_N || '5', 10),
    maxTextPerPage: parseInt(process.env.SEARXNG_MAX_TEXT_PER_PAGE || '8000', 10),
    contentPreviewChars: parseInt(process.env.SEARXNG_CONTENT_PREVIEW_CHARS || '500', 10),
    chunkSize: parseInt(process.env.SEARXNG_CHUNK_SIZE || '1024', 10),
    chunkTopN: parseInt(process.env.SEARXNG_CHUNK_TOP_N || '3', 10),
    cacheTtlMs: parseInt(process.env.SEARXNG_CACHE_TTL_MS || '60000', 10),
    memoryCacheMaxEntries: parseInt(process.env.SEARXNG_MEMORY_CACHE_MAX_ENTRIES || '1000', 10),
  },
  scraperApi: {
    baseUrl: process.env.SCRAPER_API_BASE_URL || 'http://localhost:3001',
    timeoutMs: parseInt(process.env.SCRAPER_API_TIMEOUT_MS || '30000', 10),
  },
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
  },
  assistant: {
    systemPrompt: process.env.ASSISTANT_SYSTEM_PROMPT || 'Você é o Mega Cerebro, assistente pessoal de um empresário. Você tem acesso às transcrições de áudio, lembretes, entidades extraídas e base de conhecimento do usuário. Seja proativo, objetivo e action-oriented. Sugira ações concretas quando relevante.',
    maxContextItems: parseInt(process.env.ASSISTANT_MAX_CONTEXT || '5', 10),
    briefingModel: process.env.ASSISTANT_BRIEFING_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
};
