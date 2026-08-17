const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db');

/**
 * GET /api/suggestions
 * Returns pending suggestions for the authenticated user.
 * Query params: status, type, limit, offset
 */
router.get('/', authMiddleware, (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, type, limit = 20, offset = 0 } = req.query;

    let sql = `SELECT * FROM suggestions WHERE user_id = ?`;
    const params = [userId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const suggestions = db.prepare(sql).all(...params);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/suggestions/:id
 * Updates a suggestion status (e.g., accepted, dismissed, pending).
 */
router.patch('/:id', authMiddleware, (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const result = db.prepare(
      `UPDATE suggestions SET status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
    ).run(status, id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Suggestion not found' });
    }

    res.json({ success: true, data: { id, status } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
