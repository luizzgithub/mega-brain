const express = require('express');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const logger = require('../logger');
const config = require('../config');
const { authMiddleware } = require('../middleware/auth');
const { exportTranscription } = require('../services/mergeSpeakers');

const router = express.Router();
router.use(authMiddleware);

function parseJsonField(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getTranscriptionRow(id, userId) {
  return db.prepare(`
    SELECT id, text, audio_filename, duration_ms, created_at,
           source_type, segments_json, speakers_json, media_filename, diarized
    FROM transcriptions
    WHERE id = ? AND user_id = ?
  `).get(id, userId);
}

function resolveMediaPath(userId, mediaFilename) {
  if (!mediaFilename) return null;
  const fullPath = path.join(config.mediaDir, userId, mediaFilename);
  if (!fullPath.startsWith(path.resolve(config.mediaDir))) return null;
  return fullPath;
}

// GET / — lista transcrições do usuário
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const rows = db.prepare(`
      SELECT id, SUBSTR(text, 1, 200) as text_preview, created_at, duration_ms,
             source_type, diarized, audio_filename
      FROM transcriptions
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao listar transcrições');
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /:id/export — exportar TXT/JSON/SRT
router.get('/:id/export', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const format = (req.query.format || 'txt').toLowerCase();

    if (!['txt', 'json', 'srt'].includes(format)) {
      return res.status(400).json({ success: false, error: 'Formato inválido. Use txt, json ou srt.' });
    }

    const transcription = getTranscriptionRow(id, userId);
    if (!transcription) {
      return res.status(404).json({ success: false, error: 'Transcrição não encontrada' });
    }

    const segments = parseJsonField(transcription.segments_json) || [];
    const speakers = parseJsonField(transcription.speakers_json);
    const content = exportTranscription(segments, format, speakers);
    const baseName = path.basename(transcription.audio_filename || id, path.extname(transcription.audio_filename || ''));
    const suffix = speakers?.length ? '-speakers' : '';
    const ext = format === 'json' ? 'json' : format;

    res.setHeader('Content-Type', format === 'json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}${suffix}.${ext}"`);
    res.send(content);
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao exportar transcrição');
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /:id/media — stream do arquivo de mídia original
router.get('/:id/media', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const transcription = getTranscriptionRow(id, userId);
    if (!transcription) {
      return res.status(404).json({ success: false, error: 'Transcrição não encontrada' });
    }

    const mediaPath = resolveMediaPath(userId, transcription.media_filename);
    if (!mediaPath || !fs.existsSync(mediaPath)) {
      return res.status(404).json({ success: false, error: 'Arquivo de mídia não encontrado' });
    }

    res.sendFile(mediaPath);
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao servir mídia');
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /:id — detalhe completo com entidades relacionadas
router.get('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const transcription = getTranscriptionRow(id, userId);
    if (!transcription) {
      return res.status(404).json({ success: false, error: 'Transcrição não encontrada' });
    }

    const entities = db.prepare(`
      SELECT id, type, value, context, created_at
      FROM entities
      WHERE transcription_id = ? AND user_id = ?
      ORDER BY created_at ASC
    `).all(id, userId);

    const reminders = db.prepare(`
      SELECT id, title, description, due_date, status, created_at
      FROM reminders
      WHERE source_transcription_id = ? AND user_id = ?
      ORDER BY COALESCE(due_date, '9999-12-31'), created_at DESC
    `).all(id, userId);

    res.json({
      success: true,
      data: {
        ...transcription,
        segments: parseJsonField(transcription.segments_json) || [],
        speakers: parseJsonField(transcription.speakers_json),
        has_media: Boolean(transcription.media_filename),
        entities,
        reminders,
      },
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Erro ao buscar transcrição');
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
