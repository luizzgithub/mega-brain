const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * SearXNG web search client.
 * @module services/webSearchClient
 */

/**
 * Execute a web search query via SearXNG.
 * @param {string} query - search terms
 * @param {Object} [options] - optional overrides
 * @param {string} [options.language] - language filter (e.g. 'en', 'pt')
 * @param {string} [options.categories] - SearXNG category (e.g. 'general', 'news')
 * @param {number} [options.timeout] - request timeout in ms (overrides config)
 * @returns {Promise<Array<{title: string, url: string, snippet: string, engine: string, score: number}>>}
 */
async function search(query, options = {}) {
  const { baseUrl, searchPath, timeout: cfgTimeout } = config.searxng;
  const timeout = options.timeout || cfgTimeout;
  const params = {
    q: query,
    format: 'json',
  };
  if (options.language) params.language = options.language;
  if (options.categories) params.categories = options.categories;

  const url = `${baseUrl.replace(/\/+$/, '')}${searchPath.startsWith('/') ? '' : '/'}${searchPath}`;

  try {
    logger.info(`[webSearch] searching: "${query}" via ${url}`);
    const response = await axios.get(url, { params, timeout });
    const results = response.data?.results || [];
    const normalized = results.map((r) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.content || '',
      engine: r.engine || 'unknown',
      score: r.score || 0,
    }));
    logger.info(`[webSearch] got ${normalized.length} results for "${query}"`);
    return normalized;
  } catch (err) {
    logger.error(`[webSearch] error for "${query}": ${err.message || err}`);
    throw err;
  }
}

module.exports = { search };
