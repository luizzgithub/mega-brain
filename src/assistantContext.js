const { db } = require('./db');
const logger = require('./logger');

function buildContextString(userId) {
  try {
    const parts = [];

    const transcriptions = db.prepare(`
      SELECT id, text, created_at
      FROM transcriptions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(userId);

    if (transcriptions.length > 0) {
      parts.push('## Transcrições recentes');
      for (const t of transcriptions) {
        const text = t.text || '';
        const snippet = text.slice(0, 300).replace(/\n/g, ' ');
        parts.push(`- [${t.created_at}] ${snippet}${text.length > 300 ? '...' : ''}`);
      }
    }

    const reminders = db.prepare(`
      SELECT id, title, due_date, status, priority
      FROM reminders
      WHERE user_id = ? AND status != 'done'
      ORDER BY
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        due_date ASC
      LIMIT 10
    `).all(userId);

    if (reminders.length > 0) {
      parts.push('## Lembretes pendentes');
      for (const r of reminders) {
        parts.push(`- [${r.priority}] ${r.title} (vencimento: ${r.due_date || 'não definido'}, status: ${r.status})`);
      }
    }

    const knowledge = db.prepare(`
      SELECT id, title, content, category, created_at
      FROM knowledge_base
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(userId);

    if (knowledge.length > 0) {
      parts.push('## Base de conhecimento');
      for (const k of knowledge) {
        const content = k.content || '';
        const snippet = content.slice(0, 250).replace(/\n/g, ' ');
        parts.push(`- ${k.title}${k.category ? ` [${k.category}]` : ''}: ${snippet}${content.length > 250 ? '...' : ''}`);
      }
    }

    const entities = db.prepare(`
      SELECT id, name, type, metadata, created_at
      FROM entities
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(userId);

    if (entities.length > 0) {
      parts.push('## Entidades recentes');
      for (const e of entities) {
        const meta = e.metadata ? JSON.stringify(e.metadata).slice(0, 100) : '';
        parts.push(`- ${e.name} (${e.type})${meta ? ` - ${meta}` : ''}`);
      }
    }

    if (parts.length === 0) {
      return 'Nenhum contexto disponível ainda.';
    }

    return parts.join('\n\n');
  } catch (err) {
    logger.error('Erro ao construir contexto do assistente', { error: err.message, userId });
    return 'Contexto indisponível no momento.';
  }
}

module.exports = { buildContextString };
