const app = require('./app');
const config = require('./config');
const logger = require('./logger');
const whisperProcess = require('./whisperProcess');
const { checkWhisperCli } = require('./services/checkTools');
const fs = require('fs');

async function checkModel() {
  if (!fs.existsSync(config.whisper.model)) {
    logger.warn(`Model not found at ${config.whisper.model}`);
    logger.info('Please run "npm run download-model" to download the required GGML model.');
    return false;
  }
  return true;
}

async function startServer() {
  try {
    logger.info('Starting Mega Cerebro API...');

    [config.uploadDir, config.mediaDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    });

    if (config.whisper.mode === 'server') {
      const modelExists = await checkModel();
      if (modelExists) {
        await whisperProcess.start();
      } else {
        logger.error('CRITICAL: Cannot start whisper-server without a model. API will remain online but transcription will fail.');
      }
    } else {
      const whisperCheck = await checkWhisperCli();
      if (whisperCheck.ok) {
        logger.info(`Whisper mode: CLI (on-demand) — model ${config.whisper.modelName}`);
      } else {
        logger.warn(`Whisper CLI not ready: ${whisperCheck.hint}`);
        logger.warn('API will remain online but transcription will fail until configured.');
      }
    }

    app.listen(config.port, () => {
      logger.info(`Mega Cerebro API listening on http://localhost:${config.port}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down...');
  if (config.whisper.mode === 'server') {
    await whisperProcess.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down...');
  if (config.whisper.mode === 'server') {
    await whisperProcess.stop();
  }
  process.exit(0);
});

startServer();
