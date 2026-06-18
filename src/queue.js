const { default: PQueue } = require('p-queue');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const config = require('./config');
const logger = require('./logger');

class TranscriptionQueue {
  constructor() {
    this.queue = new PQueue({ concurrency: config.queueConcurrency });
    this.queue.on('active', () => {
      logger.info(`Queue: Active jobs: ${this.queue.pending}. Remaining jobs: ${this.queue.size}`);
    });
    this.queue.on('idle', () => {
      logger.info('Queue is idle.');
    });
  }

  async addJob(filePath, options = {}) {
    return this.queue.add(async () => {
      try {
        const result = await this.whisperInference(filePath, options);
        return result;
      } finally {
        // Cleanup temp file if it's in the uploads directory
        if (filePath.startsWith(config.uploadDir)) {
          fs.unlink(filePath, (err) => {
            if (err) logger.error(`Failed to delete temp file ${filePath}: ${err}`);
          });
        }
      }
    });
  }

  async whisperInference(filePath, options = {}) {
    const url = `http://${config.whisper.host}:${config.whisper.port}/inference`;
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('temperature', options.temperature || '0.0');
    form.append('response_format', options.response_format || 'json');
    if (options.language) {
        form.append('language', options.language);
    }

    logger.info(`Sending job to Whisper server: ${filePath}`);
    const start = Date.now();
    
    const response = await axios.post(url, form, {
      headers: form.getHeaders(),
      timeout: 0 // No timeout for inference
    });

    const duration = Date.now() - start;
    logger.info(`Transcription completed in ${duration}ms`);

    return response.data;
  }

  getStats() {
    return {
      pending: this.queue.pending,
      size: this.queue.size,
      concurrency: config.queueConcurrency
    };
  }
}

module.exports = new TranscriptionQueue();
