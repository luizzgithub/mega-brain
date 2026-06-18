const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

module.exports = {
  port: process.env.PORT || 4144,
  whisper: {
    path: process.env.WHISPER_SERVER_PATH || 'C:\\Tools\\whisper\\whisper-server.exe',
    model: process.env.WHISPER_MODEL_PATH || 'C:\\Tools\\whisper\\models\\ggml-medium.bin',
    host: process.env.WHISPER_HOST || '127.0.0.1',
    port: process.env.WHISPER_PORT || 8080,
    language: process.env.WHISPER_LANGUAGE || 'pt',
    threads: process.env.WHISPER_THREADS || 4,
  },
  queueConcurrency: parseInt(process.env.QUEUE_CONCURRENCY || '1', 10),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
  uploadDir: path.join(__dirname, '../uploads'),
  logDir: path.join(__dirname, '../logs'),
};
