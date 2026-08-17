const express = require('express');
const { db } = require('../db');
const logger = require('../logger');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET / — lista lembretes do usuário ordenados por due_date
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const rows = db.prepare(`
      SELECT id, title, description, due_date, status, source_transcription_id, created_at
      FROM reminders
      WHERE user_id = ?
      ORDER BY COALESCE(due_date, '9999-12-31'), created_at DESC
    `).all(userId);

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao listar lembretes');
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST / — cria lembrete
router.post('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, due_date, status = 'pending', source_transcription_id } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Título é obrigatório' });
    }

    const id = require('crypto').randomUUID();
    const result = db.prepare(`
      INSERT INTO reminders (id, user_id, title, description, due_date, status, source_transcription_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, title, description || null, due_date || null, status, source_transcription_id || null);

    const row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao criar lembrete');
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /:id — atualiza status
router.patch('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status é obrigatório' });
    }

    const existing = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Lembrete não encontrado' });
    }

    db.prepare('UPDATE reminders SET status = ? WHERE id = ? AND user_id = ?').run(status, id, userId);
    const row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    res.json({ success: true, data: row });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao atualizar lembrete');
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /:id — remove lembrete
router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Lembrete não encontrado' });
    }

    db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(id, userId);
    res.json({ success: true, message: 'Lembrete removido' });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao remover lembrete');
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
