const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./logger');
const routes = require('./routes');
const chatRoutes = require('./routes/chat');
const briefingRoutes = require('./routes/briefing');
const suggestionRoutes = require('./routes/suggestions');
const authRoutes = require('./routes/auth');
const reminderRoutes = require('./routes/reminders');
const transcriptionRoutes = require('./routes/transcriptions');
const knowledgeRoutes = require('./routes/knowledge');
const searchRoutes = require('./routes/search');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const config = require('./config');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Log requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.use('/api', routes);
app.use('/api/chat', chatRoutes);
app.use('/api/briefing', briefingRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/transcriptions', transcriptionRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
