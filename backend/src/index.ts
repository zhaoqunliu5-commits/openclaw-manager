import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import overviewRouter from './routes/overview.js';
import servicesRouter from './routes/services.js';
import configRouter from './routes/config.js';
import logsRouter from './routes/logs.js';
import operationsRouter from './routes/operations.js';
import agentsRouter from './routes/agents.js';
import skillsRouter from './routes/skills.js';
import workspacesRouter from './routes/workspaces.js';
import modelsRouter from './routes/models.js';
import monitorRouter from './routes/monitor.js';
import configManageRouter from './routes/configManage.js';
import commandPaletteRouter from './routes/commandPalette.js';
import skillEnhanceRouter from './routes/skillEnhance.js';
import memoryRouter from './routes/memory.js';
import notificationsRouter from './routes/notifications.js';
import collaborationRouter from './routes/collaboration.js';
import settingsRouter from './routes/settings.js';
import automationRouter from './routes/automation.js';
import workflowRouter from './routes/workflow.js';
import workspaceManageRouter from './routes/workspaceManage.js';
import skillEvaluationRouter from './routes/skillEvaluation.js';
import skillRecommendationRouter from './routes/skillRecommendation.js';
import { notificationManager } from './services/notificationService.js';
import { workflowService } from './services/workflowService.js';
import { automationService } from './services/automationService.js';
import { authMiddleware } from './middleware/auth.js';
import { requestLogger, notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(requestLogger);
app.use(authMiddleware);

app.use('/api/overview', overviewRouter);
app.use('/api/services', servicesRouter);
app.use('/api/config', configRouter);
app.use('/api/logs', logsRouter);
app.use('/api/operations', operationsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/models', modelsRouter);
app.use('/api/monitor', monitorRouter);
app.use('/api/config-manage', configManageRouter);
app.use('/api/command-palette', commandPaletteRouter);
app.use('/api/skill-enhance', skillEnhanceRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/collaboration', collaborationRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/automation', automationRouter);
app.use('/api/workflow', workflowRouter);
app.use('/api/workspace-manage', workspaceManageRouter);
app.use('/api/skill-evaluation', skillEvaluationRouter);
app.use('/api/skill-recommendation', skillRecommendationRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (isProduction) {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}

app.use(globalErrorHandler);
app.use(notFoundHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 OpenClaw Manager Backend`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health\n`);
  notificationManager.start();
  setTimeout(() => automationService.start(), 1000);
  setTimeout(() => workflowService.start(), 2000);
});

process.on('SIGTERM', () => {
  workflowService.stop();
  automationService.stop();
  notificationManager.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  workflowService.stop();
  automationService.stop();
  notificationManager.stop();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  notificationManager.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
