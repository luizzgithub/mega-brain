const express = require('express');
const { randomUUID } = require('crypto');
const proxyHubClient = require('../services/proxyHubClient');
const { db } = require('../db');
const config = require('../config');
const { buildContextString } = require('../assistantContext');
const logger = require('../logger');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();



router.post('/', authMiddleware, async (req, res) => {
  try {
    const { message, conversation_id } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Mensagem inválida' });
    }

    let conversationId = conversation_id;
    const title = message.trim().slice(0, 50);

    if (!conversationId) {
      conversationId = randomUUID();
      db.prepare(`
        INSERT INTO conversations (id, user_id, title)
        VALUES (?, ?, ?)
      `).run(conversationId, userId, title);
    } else {
      const conversation = db.prepare(`
        SELECT id, user_id FROM conversations WHERE id = ?
      `).get(conversationId);
      if (!conversation || conversation.user_id !== userId) {
        return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
      }
    }

    const messageId = randomUUID();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES (?, ?, ?, ?)
    `).run(messageId, conversationId, 'user', message.trim());

    const contextString = buildContextString(userId);

    const recentMessages = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(conversationId);
    recentMessages.reverse();

    const llmMessages = [
      {
        role: 'system',
        content: config.assistant.systemPrompt + '\n\nContexto do usuário:\n' + contextString
      },
      ...recentMessages,
      { role: 'user', content: message.trim() }
    ];

    const completion = await proxyHubClient.chatCompletion({
      messages: llmMessages,
      temperature: 0.7
    });

    const answer = completion.choices[0].message.content;

    const assistantMessageId = randomUUID();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES (?, ?, ?, ?)
    `).run(assistantMessageId, conversationId, 'assistant', answer);

    db.prepare(`
      UPDATE conversations SET updated_at = datetime('now') WHERE id = ?
    `).run(conversationId);

    return res.json({
      success: true,
      data: {
        conversation_id: conversationId,
        answer,
        message_id: assistantMessageId
      }
    });
  } catch (err) {
    logger.error('Erro no chat', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/conversations', authMiddleware, (req, res) => {
  try {
    const conversations = db.prepare(`
      SELECT id, title, created_at, updated_at
      FROM conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `).all(req.user.id);

    return res.json({ success: true, data: conversations });
  } catch (err) {
    logger.error('Erro ao listar conversas', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/conversations/:id', authMiddleware, (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;

    const conversation = db.prepare(`
      SELECT id, user_id FROM conversations WHERE id = ?
    `).get(conversationId);

    if (!conversation || conversation.user_id !== userId) {
      return res.status(404).json({ success: false, error: 'Conversa não encontrada' });
    }

    const messages = db.prepare(`
      SELECT role, content, created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId);

    return res.json({ success: true, data: messages });
  } catch (err) {
    logger.error('Erro ao buscar conversa', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
