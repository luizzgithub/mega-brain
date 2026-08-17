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
    const { project_id } = req.query;

    let sql = `
      SELECT t.*, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.user_id = ?
    `;
    const params = [userId];

    if (project_id) {
      sql += ' AND t.project_id = ?';
      params.push(project_id);
    }

    sql += " ORDER BY CASE t.status WHEN 'done' THEN 1 ELSE 0 END ASC, t.priority DESC, t.due_date ASC, t.created_at DESC";

    const rows = db.prepare(sql).all(...params);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao listar tasks');
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const userId = req.user.id;
    const {
      project_id,
      title,
      description,
      status = 'todo',
      priority = 'medium',
      due_date,
      source_transcription_id,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Título da task é obrigatório' });
    }

    if (project_id) {
      const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(project_id, userId);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Projeto não encontrado' });
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tasks (id, project_id, user_id, title, description, status, priority, due_date, source_transcription_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      project_id || null,
      userId,
      title.trim(),
      description || null,
      status,
      priority,
      due_date || null,
      source_transcription_id || null,
      now,
      now,
    );

    const row = db.prepare('SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = ?').get(id);
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao criar task');
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      project_id,
      title,
      description,
      status,
      priority,
      due_date,
    } = req.body;

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Task não encontrada' });
    }

    if (project_id !== undefined) {
      const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(project_id, userId);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Projeto não encontrado' });
      }
    }

    const fields = [];
    const values = [];
    if (project_id !== undefined) { fields.push('project_id = ?'); values.push(project_id || null); }
    if (title !== undefined) { fields.push('title = ?'); values.push(title.trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description || null); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
    if (due_date !== undefined) { fields.push('due_date = ?'); values.push(due_date || null); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    values.push(userId);

    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    const row = db.prepare('SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = ?').get(id);
    res.json({ success: true, data: row });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao atualizar task');
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Task não encontrada' });
    }

    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
    res.json({ success: true, message: 'Task removida' });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao remover task');
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
