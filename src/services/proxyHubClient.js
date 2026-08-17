const { default: PQueue } = require('p-queue');
const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

// ──────────────────────────────────────────────
// Retry‑aware helper for network / 5xx errors
// ──────────────────────────────────────────────
function isRetryable(err) {
  if (!err) return false;
  // Network errors have no response
  if (!err.response) return true;
  // Server errors (5xx)
  return err.response.status >= 500;
}

async function requestWithRetry(options, retryCount = 1) {
  try {
    const response = await axios(options);
    return response.data;
  } catch (err) {
    if (retryCount > 0 && isRetryable(err)) {
      logger.warn(`ProxyHub request failed, retrying (${retryCount} left): ${err.message}`);
      await new Promise(r => setTimeout(r, 1000));
      return requestWithRetry(options, retryCount - 1);
    }
    throw err;
  }
}

// ──────────────────────────────────────────────
// Client with sequential queue
// ──────────────────────────────────────────────
class ProxyHubClient {
  constructor() {
    this.queue = new PQueue({
      concurrency: 1,
      interval: config.proxyHub.queueDelay,
    });
    this.baseURL = config.proxyHub.url?.replace(/\/+$/, '');
    this.apiKey  = config.proxyHub.apiKey;
    this.model   = config.proxyHub.model; // may be 'AUTO'
  }

  // ── Chat Completion ──────────────────────────
  async chatCompletion({ model, messages, temperature, response_format, tools } = {}) {
    const effectiveModel = model || this.model;
    logger.info('ProxyHub chatCompletion called', {
      model: effectiveModel,
      messageCount: messages?.length,
    });

    const payload = {
      model: effectiveModel,
      messages,
    };
    if (temperature !== undefined) payload.temperature = temperature;
    if (response_format) payload.response_format = response_format;
    if (tools && tools.length) payload.tools = tools;

    return this.queue.add(() =>
      requestWithRetry({
        method: 'POST',
        url: `${this.baseURL}/v1/chat/completions`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        data: payload,
        timeout: config.proxyHub.timeout,
      })
    );
  }

  // ── Embedding ────────────────────────────────
  async createEmbedding(text) {
    const effectiveModel = 'AUTO';
    logger.info('ProxyHub createEmbedding called', {
      model: effectiveModel,
      inputType: typeof text === 'string' ? 'string' : 'array',
      inputLength: Array.isArray(text) ? text.length : 1,
    });

    const payload = {
      model: effectiveModel,
      input: text,
    };

    return this.queue.add(() =>
      requestWithRetry({
        method: 'POST',
        url: `${this.baseURL}/v1/embeddings`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        data: payload,
        timeout: config.proxyHub.timeout,
      })
    );
  }
}

module.exports = new ProxyHubClient();
