const app = require('./app');
const config = require('./config');
const logger = require('./logger');
const whisperProcess = require('./whisperProcess');
const fs = require('fs');
const path = require('path');

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
    logger.info('Starting Whisper-Serve API...');
    
    const modelExists = await checkModel();
    if (modelExists) {
        // Start whisper-server.exe
        await whisperProcess.start();
    } else {
        logger.error('CRITICAL: Cannot start whisper-server without a model. API will remain online but transcription will fail.');
    }

    app.listen(config.port, () => {
      logger.info(`Whisper-Serve API listening on http://localhost:${config.port}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down...');
  await whisperProcess.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down...');
  await whisperProcess.stop();
  process.exit(0);
});

startServer();
