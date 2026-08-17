const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

/**
 * Scraper API client for batch scraping.
 * @module services/scraperApiClient
 */

/**
 * Scrape multiple URLs in batches, returning a Map of url to text content.
 * URLs are processed in chunks of up to 10.
 * @param {string} baseUrl - Scraper API base URL (overrides config)
 * @param {string[]} urls - Array of URLs to scrape
 * @param {number} [timeoutMs] - request timeout in ms (overrides config)
 * @returns {Promise<Map<string, string>>} Map where key is URL and value is scraped text (empty string on failure)
 */
async function scrapeBatch(baseUrl, urls, timeoutMs) {
  const { baseUrl: cfgBaseUrl, timeoutMs: cfgTimeoutMs } = config.scraperApi;
  const resolvedBaseUrl = baseUrl || cfgBaseUrl;
  const resolvedTimeout = timeoutMs || cfgTimeoutMs;
  const CHUNK_SIZE = 10;
  const results = new Map();

  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(urls.length / CHUNK_SIZE);
    logger.info(`[scraperApi] scraping chunk ${chunkNum}/${totalChunks} (${chunk.length} urls)`);

    try {
      const response = await axios.post(
        `${resolvedBaseUrl.replace(/\/+$/, '')}/scrape/batch`,
        { urls: chunk },
        { timeout: resolvedTimeout }
      );
      const data = response.data || {};
      for (const url of chunk) {
        const text = data[url];
        results.set(url, text || '');
      }
      logger.info(`[scraperApi] chunk ${chunkNum}/${totalChunks} done`);
    } catch (err) {
      logger.error(`[scraperApi] chunk ${chunkNum}/${totalChunks} error: ${err.message || err}`);
      for (const url of chunk) {
        results.set(url, '');
      }
    }
  }

  return results;
}

module.exports = { scrapeBatch };
