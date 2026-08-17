const express = require('express');
const { db } = require('../db');
const vectorStore = require('../vectorStore');
const logger = require('../logger');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const VALID_SOURCE_TYPES = ['company', 'employee', 'website', 'note'];

function validateKnowledgeInput(body) {
  const { source_type, title, content } = body;
  if (!source_type || !VALID_SOURCE_TYPES.includes(source_type)) {
    return { valid: false, error: `source_type inválido. Use: ${VALID_SOURCE_TYPES.join(', ')}` };
  }
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return { valid: false, error: 'title é obrigatório' };
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return { valid: false, error: 'content é obrigatório' };
  }
  return { valid: true };
}

router.post('/', async (req, res) => {
  try {
    const validation = validateKnowledgeInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const { source_type, title, content, metadata } = req.body;
    const id = crypto.randomUUID();
    const userId = req.user.id;
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    const stmt = db.prepare(`
      INSERT INTO knowledge_base (id, user_id, source_type, title, content, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, source_type, title, content, metadataJson);

    await vectorStore.ensureCollection(userId);
    await vectorStore.upsert(userId, id, content, { source_type, title, ...(metadata || {}) });

    logger.info({ userId, knowledgeId: id, source_type }, 'Conhecimento salvo');
    res.status(201).json({ success: true, data: { id, source_type, title } });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao salvar conhecimento');
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const stmt = db.prepare(`
      SELECT id, source_type, title, content, metadata, created_at
      FROM knowledge_base
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(userId).map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao listar conhecimentos');
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/ingest-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ success: false, error: 'URL inválida' });
    }

    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
      return res.status(400).json({ success: false, error: `Falha ao buscar URL: ${response.status}` });
    }

    const html = await response.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const id = crypto.randomUUID();
    const userId = req.user.id;
    const title = `Website: ${new URL(url).hostname}`;
    const metadata = JSON.stringify({ url });

    const stmt = db.prepare(`
      INSERT INTO knowledge_base (id, user_id, source_type, title, content, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, 'website', title, text, metadata);

    await vectorStore.ensureCollection(userId);
    await vectorStore.upsert(userId, id, text, { source_type: 'website', title, url });

    logger.info({ userId, knowledgeId: id, url }, 'URL ingerida');
    res.status(201).json({ success: true, data: { id, source_type: 'website', title, url } });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao ingerir URL');
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const findStmt = db.prepare('SELECT id FROM knowledge_base WHERE id = ? AND user_id = ?');
    const existing = findStmt.get(id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Conhecimento não encontrado' });
    }

    const deleteStmt = db.prepare('DELETE FROM knowledge_base WHERE id = ? AND user_id = ?');
    deleteStmt.run(id, userId);

    logger.info({ userId, knowledgeId: id }, 'Conhecimento removido');
    res.json({ success: true, data: { id } });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao remover conhecimento');
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
