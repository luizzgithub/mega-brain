const express = require('express');
const { db } = require('../db');
const vectorStore = require('../vectorStore');
const logger = require('../logger');
const { authMiddleware } = require('../middleware/auth');
const proxyHubClient = require('../services/proxyHubClient');
const config = require('../config');
const webSearchClient = require('../services/webSearchClient');
const scraperApiClient = require('../services/scraperApiClient');

const router = express.Router();
router.use(authMiddleware);

const SYSTEM_PROMPT = 'Você é o assistente pessoal de um empresário. Use o contexto das transcrições e base de conhecimento para responder perguntas sobre pessoas, empresas, tarefas e lembretes.';

// POST /search — busca semântica na base vetorial do usuário
router.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'query é obrigatória' });
    }

    const results = await vectorStore.search(req.user.id, query, 5);

    res.json({
      success: true,
      data: {
        results: results.map(r => ({
          text: r.text,
          score: r.score,
          metadata: r.metadata
        }))
      }
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro na busca semântica');
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /ask — pergunta ao agente combinando contexto vetorial + transcrições recentes
router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ success: false, error: 'question é obrigatória' });
    }

    const userId = req.user.id;

    // 1. Busca semântica na base de conhecimento do usuário
    const vectorResults = await vectorStore.search(userId, question, 5);

    // 2. Busca transcrições recentes do usuário no SQLite
    const transcriptions = db
      .prepare('SELECT text, created_at FROM transcriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10')
      .all(userId);

    // 3. Monta o contexto e consulta o LLM
    const knowledgeContext = vectorResults
      .map((r, i) => `[Conhecimento ${i + 1}] ${r.text}`)
      .join('\n\n');

    const transcriptionContext = transcriptions
      .map((t, i) => `[Transcrição ${i + 1} - ${t.created_at}] ${t.text}`)
      .join('\n\n');

    const contextParts = [];
    if (knowledgeContext) contextParts.push('=== Base de Conhecimento ===\n' + knowledgeContext);
    if (transcriptionContext) contextParts.push('=== Transcrições Recentes ===\n' + transcriptionContext);

    const fullContext = contextParts.join('\n\n') || 'Nenhum contexto disponível.';

    const completion = await proxyHubClient.chatCompletion({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${fullContext}\n\nPergunta: ${question}\n\nResponda de forma objetiva e baseada apenas no contexto fornecido.` }
      ],
      temperature: 0.3,
      max_tokens: 1024
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() ||
      'Não foi possível gerar uma resposta.';

    res.json({
      success: true,
      data: {
        answer,
        context_used: {
          knowledge_hits: vectorResults.length,
          transcriptions_count: transcriptions.length
        }
      }
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao consultar agente');
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/search/web — busca web via SearXNG com scraping opcional
router.post('/web', async (req, res) => {
  try {
    const { query, limit = 5, scrape = false } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'query é obrigatória' });
    }
    const results = await webSearchClient.search(query);
    const sliced = results.slice(0, limit);
    let scrapeEnabled = false;
    if (scrape && config.scraperApi && config.scraperApi.baseUrl) {
      const urls = sliced.map(r => r.url).filter(Boolean);
      const scrapedMap = await scraperApiClient.scrapeBatch(config.scraperApi.baseUrl, urls, config.scraperApi.timeoutMs);
      for (const r of sliced) {
        r.scraped_text = scrapedMap.get(r.url) || '';
      }
      scrapeEnabled = true;
    }
    const sources = ['searxng'];
    if (scrapeEnabled) sources.push('scraper_api');
    res.json({ success: true, data: { results: sliced, sources, scrape_enabled: scrapeEnabled } });
    logger.info(`Web search OK: query="${query}" results=${sliced.length} scrape=${scrapeEnabled}`);
  } catch (err) {
    logger.error(`Web search error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
