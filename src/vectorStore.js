const { randomUUID } = require('crypto');
const { QdrantClient } = require('@qdrant/qdrant-js');
const logger = require('./logger');
const proxyHubClient = require('./services/proxyHubClient');

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const VECTOR_SIZE = 1536;
const COLLECTION_PREFIX = 'mega_brain_';

let qdrantClient = null;

function getQdrantClient() {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({ url: QDRANT_URL });
  }
  return qdrantClient;
}

function collectionNameFor(userId) {
  return `${COLLECTION_PREFIX}${userId}`;
}

async function getEmbedding(text) {
  const response = await proxyHubClient.createEmbedding(text);
  return response.data[0].embedding;
}

async function ensureCollection(userId) {
  const collectionName = collectionNameFor(userId);
  const client = getQdrantClient();
  try {
    const existing = await client.getCollections();
    const hasCollection = existing.collections.some(c => c.name === collectionName);
    if (hasCollection) {
      return collectionName;
    }
    await client.createCollection(collectionName, {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine'
      }
    });
    logger.info({ userId, collectionName }, 'Coleção Qdrant criada');
    return collectionName;
  } catch (err) {
    logger.warn({ userId, err: err.message }, 'Erro ao garantir coleção Qdrant');
    throw err;
  }
}

async function upsert(userId, id, text, metadata = {}) {
  const collectionName = collectionNameFor(userId);
  const pointId = id || randomUUID();
  try {
    const vector = await getEmbedding(text);
    const client = getQdrantClient();
    await client.upsert(collectionName, {
      points: [
        {
          id: pointId,
          vector,
          payload: {
            user_id: userId,
            text,
            ...metadata
          }
        }
      ]
    });
    logger.info({ userId, pointId }, 'Ponto inserido no Qdrant');
    return pointId;
  } catch (err) {
    logger.warn({ userId, pointId, err: err.message }, 'Erro ao inserir no Qdrant');
    return null;
  }
}

async function search(userId, query, limit = 5) {
  const collectionName = collectionNameFor(userId);
  try {
    const vector = await getEmbedding(query);
    const client = getQdrantClient();
    const results = await client.search(collectionName, {
      vector,
      limit,
      filter: {
        must: [{ key: 'user_id', match: { value: userId } }]
      },
      with_payload: true
    });
    return results.map(r => ({
      id: r.id,
      score: r.score,
      text: r.payload?.text || '',
      metadata: r.payload || {}
    }));
  } catch (err) {
    logger.warn({ userId, err: err.message }, 'Erro ao buscar no Qdrant');
    return [];
  }
}

module.exports = { ensureCollection, upsert, search };
