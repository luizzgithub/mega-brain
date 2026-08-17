const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const logger = require('../logger');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const rows = db.prepare(`
      SELECT id, name, description, status, created_at, updated_at
      FROM projects
      WHERE user_id = ?
      ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END ASC, updated_at DESC
    `).all(userId);

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao listar projetos');
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, status = 'active' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Nome do projeto é obrigatório' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO projects (id, user_id, name, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, name.trim(), description || null, status, now, now);

    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao criar projeto');
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, description, status } = req.body;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Projeto não encontrado' });
    }

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description || null); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    values.push(userId);

    db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json({ success: true, data: row });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao atualizar projeto');
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Projeto não encontrado' });
    }

    db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, userId);
    res.json({ success: true, message: 'Projeto removido' });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao remover projeto');
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
