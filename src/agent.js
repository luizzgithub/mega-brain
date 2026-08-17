const { randomUUID } = require('crypto');
const proxyHubClient = require('./services/proxyHubClient');
const { db } = require('./db');
const logger = require('./logger');

const SYSTEM_PROMPT = `Você é um assistente que analisa transcrições de áudio de empresários. Extraia entidades: pessoas (nomes), empresas (nomes), tópicos (assuntos) e action_items (tarefas/lembretes). Retorne JSON: {entities:[{type,value,context}], reminders:[{title,description,due_date?}]}`;

function parseJsonResponse(content) {
  try {
    return JSON.parse(content);
  } catch (err) {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    throw err;
  }
}

async function processTranscription(transcriptionId, userId, text) {
  try {
    if (!text || !text.trim()) {
      logger.info({ transcriptionId, userId }, 'Texto vazio; nenhuma entidade extraída');
      return { entities: 0, reminders: 0 };
    }

    const response = await proxyHubClient.chatCompletion({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Resposta vazia do LLM');
    }

    const parsed = parseJsonResponse(content);
    const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
    const reminders = Array.isArray(parsed.reminders) ? parsed.reminders : [];

    const insertEntity = db.prepare(`
      INSERT INTO entities (id, transcription_id, user_id, type, value, context)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertReminder = db.prepare(`
      INSERT INTO reminders (id, user_id, title, description, due_date, source_transcription_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let entityCount = 0;
    for (const entity of entities) {
      const type = entity.type;
      if (!['person', 'company', 'topic', 'action_item'].includes(type)) {
        logger.warn({ transcriptionId, type }, 'Tipo de entidade ignorado');
        continue;
      }
      insertEntity.run(
        randomUUID(),
        transcriptionId,
        userId,
        type,
        String(entity.value || ''),
        entity.context || null
      );
      entityCount++;
    }

    let reminderCount = 0;
    for (const reminder of reminders) {
      const dueDate = reminder.due_date && String(reminder.due_date).trim()
        ? String(reminder.due_date).trim()
        : null;
      insertReminder.run(
        randomUUID(),
        userId,
        String(reminder.title || ''),
        reminder.description || null,
        dueDate,
        transcriptionId
      );
      reminderCount++;
    }

    logger.info({ transcriptionId, userId, entities: entityCount, reminders: reminderCount }, 'Agente processou transcrição');
    return { entities: entityCount, reminders: reminderCount };
  } catch (err) {
    logger.error({ transcriptionId, userId, err: err.message }, 'Erro no agente de extração');
    return { entities: 0, reminders: 0, error: err.message };
  }
}

const SUGGESTIONS_SYSTEM_PROMPT = `Você é um assistente proativo. Analise a transcrição e sugira 1-3 ações concretas para o empresário. Retorne JSON: {suggestions:[{type, title, description, priority}]} onde type pode ser follow_up, meeting_prep, reminder_suggestion, insight, contact_recommendation e priority pode ser low, medium, high.`;

async function generateSuggestions(transcriptionId, userId, text) {
  try {
    if (!text || !text.trim()) {
      logger.info({ transcriptionId, userId }, 'Texto vazio; nenhuma sugestão gerada');
      return { suggestions: 0 };
    }

    const response = await proxyHubClient.chatCompletion({
      messages: [
        { role: 'system', content: SUGGESTIONS_SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Resposta vazia do LLM');
    }

    const parsed = parseJsonResponse(content);
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    const validTypes = ['follow_up', 'meeting_prep', 'reminder_suggestion', 'insight', 'contact_recommendation'];
    const validPriorities = ['low', 'medium', 'high'];

    const insertSuggestion = db.prepare(`
      INSERT INTO suggestions (id, user_id, transcription_id, type, title, description, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    for (const suggestion of suggestions.slice(0, 3)) {
      const type = suggestion.type;
      const priority = suggestion.priority;

      if (!validTypes.includes(type)) {
        logger.warn({ transcriptionId, type }, 'Tipo de sugestão ignorado');
        continue;
      }
      if (!validPriorities.includes(priority)) {
        logger.warn({ transcriptionId, priority }, 'Prioridade de sugestão ignorada');
        continue;
      }

      insertSuggestion.run(
        randomUUID(),
        userId,
        transcriptionId,
        type,
        String(suggestion.title || ''),
        suggestion.description || null,
        priority
      );
      count++;
    }

    logger.info({ transcriptionId, userId, suggestions: count }, 'Agente gerou sugestões');
    return { suggestions: count };
  } catch (err) {
    logger.error({ transcriptionId, userId, err: err.message }, 'Erro ao gerar sugestões');
    return { suggestions: 0 };
  }
}

const BRIEFING_SYSTEM_PROMPT = `Você é um assistente executivo proativo. Com base nas transcrições, lembretes, entidades e sugestões do usuário fornecidas abaixo, gere um briefing diário em português. Retorne JSON: {title, summary, highlights:[], actionItems:[], followUps:[]} onde actionItems e followUps são objetos com {title, description?, priority?}.`;

async function generateDailyBriefing(userId, data) {
  try {
    const response = await proxyHubClient.chatCompletion({
      messages: [
        { role: 'system', content: BRIEFING_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ userId, ...data }) }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Resposta vazia do LLM');
    }

    const parsed = parseJsonResponse(content);
    return {
      title: parsed.title || 'Briefing Diário',
      summary: parsed.summary || '',
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      followUps: Array.isArray(parsed.followUps) ? parsed.followUps : []
    };
  } catch (err) {
    logger.error({ userId, err: err.message }, 'Erro ao gerar briefing diário');
    return {
      title: 'Briefing Diário',
      summary: 'Não foi possível gerar o briefing automático no momento.',
      highlights: [],
      actionItems: [],
      followUps: []
    };
  }
}

module.exports = { processTranscription, generateSuggestions, generateDailyBriefing };
