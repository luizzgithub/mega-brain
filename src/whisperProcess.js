const { spawn } = require('child_process');
const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

class WhisperProcessManager {
  constructor() {
    this.process = null;
    this.isStopping = false;
  }

  async start() {
    if (this.process) {
      logger.info('Whisper process is already running.');
      return;
    }

    const args = [
      '--model', config.whisper.model,
      '--host', config.whisper.host,
      '--port', config.whisper.port.toString(),
      '--threads', config.whisper.threads.toString(),
      '--language', config.whisper.language,
      '--convert',
      '--best-of', '1',
      '--beam-size', '1',
    ];

    logger.info(`Starting whisper-server.exe with args: ${args.join(' ')}`);

    this.process = spawn(config.whisper.path, args, {
      cwd: require('path').dirname(config.whisper.path),
      stdio: ['inherit', 'pipe', 'pipe']
    });

    this.process.stdout.on('data', (data) => {
      logger.info(`[Whisper STDOUT]: ${data.toString().trim()}`);
    });

    this.process.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg.toLowerCase().includes('error')) {
        logger.error(`[Whisper STDERR]: ${msg}`);
      } else {
        logger.info(`[Whisper STDERR]: ${msg}`);
      }
    });

    this.process.on('close', (code) => {
      logger.info(`Whisper process exited with code ${code}`);
      this.process = null;
      if (!this.isStopping) {
        logger.warn('Whisper process crashed. Restarting in 5 seconds...');
        setTimeout(() => this.start(), 5000);
      }
    });

    // Wait for the server to be ready
    await this.waitForReady();
  }

  async stop() {
    this.isStopping = true;
    if (this.process) {
      logger.info('Stopping Whisper process...');
      this.process.kill();
      this.process = null;
    }
  }

  async isRunning() {
    try {
      const url = `http://${config.whisper.host}:${config.whisper.port}/inference`;
      // We check if it responds at all (even if it's a 405 or 400 because it's a GET)
      await axios.get(url, { timeout: 1000, validateStatus: () => true });
      return true;
    } catch (error) {
      return false;
    }
  }

  async waitForReady(retries = 30) {
    for (let i = 0; i < retries; i++) {
      if (await this.isRunning()) {
        logger.info('Whisper server is ready.');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Whisper server failed to start within timeout.');
  }
}

module.exports = new WhisperProcessManager();
