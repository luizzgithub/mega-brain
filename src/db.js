const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const DB_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'app.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  logger.info(`Created data directory: ${DB_DIR}`);
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema initialization ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transcriptions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    text            TEXT NOT NULL,
    audio_filename  TEXT,
    duration_ms     INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS entities (
    id               TEXT PRIMARY KEY,
    transcription_id TEXT NOT NULL,
    user_id          TEXT NOT NULL,
    type             TEXT NOT NULL CHECK(type IN ('person','company','topic','action_item')),
    value            TEXT NOT NULL,
    context          TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL,
    title                   TEXT NOT NULL,
    description             TEXT,
    due_date                TEXT,
    status                  TEXT NOT NULL DEFAULT 'pending',
    source_transcription_id TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_transcription_id) REFERENCES transcriptions(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS knowledge_base (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('company','employee','website','note')),
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    metadata    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS suggestions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    transcription_id TEXT NOT NULL,
    type            TEXT NOT NULL CHECK(type IN ('follow_up','meeting_prep','reminder_suggestion','insight','contact_recommendation')),
    title           TEXT NOT NULL,
    description     TEXT,
    priority        TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','dismissed')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (transcription_id) REFERENCES transcriptions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role            TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
    content         TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','done')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id                      TEXT PRIMARY KEY,
    project_id              TEXT,
    user_id                 TEXT NOT NULL,
    title                   TEXT NOT NULL,
    description             TEXT,
    status                  TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done','blocked')),
    priority                TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
    due_date                TEXT,
    source_transcription_id TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_transcription_id) REFERENCES transcriptions(id) ON DELETE SET NULL
  );
`);

// --- Migrations for existing databases ---
function columnExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

function migrateTranscriptionsTable() {
  const migrations = [
    { column: 'source_type', sql: "ALTER TABLE transcriptions ADD COLUMN source_type TEXT NOT NULL DEFAULT 'audio'" },
    { column: 'segments_json', sql: 'ALTER TABLE transcriptions ADD COLUMN segments_json TEXT' },
    { column: 'speakers_json', sql: 'ALTER TABLE transcriptions ADD COLUMN speakers_json TEXT' },
    { column: 'media_filename', sql: 'ALTER TABLE transcriptions ADD COLUMN media_filename TEXT' },
    { column: 'diarized', sql: 'ALTER TABLE transcriptions ADD COLUMN diarized INTEGER NOT NULL DEFAULT 0' },
  ];

  for (const { column, sql } of migrations) {
    if (!columnExists('transcriptions', column)) {
      db.exec(sql);
      logger.info(`Migration applied: transcriptions.${column}`);
    }
  }
}

migrateTranscriptionsTable();

logger.info(`SQLite database initialized at ${DB_PATH}`);

/**
 * Return the shared better-sqlite3 database instance.
 * @returns {import('better-sqlite3').Database}
 */
function getDb() {
  return db;
}

module.exports = { db, getDb };
