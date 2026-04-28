import { Router } from 'express';
import { healthCheckManager } from '../services/healthCheckService.js';
import { dbService } from '../services/dbService.js';

const router = Router();

router.get('/config', (_req, res) => {
  try {
    const config = healthCheckManager.getConfig();
    res.json(config);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.put('/config', (req, res) => {
  try {
    const config = healthCheckManager.updateConfig(req.body);
    res.json(config);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.get('/status', (_req, res) => {
  try {
    const results = healthCheckManager.getResults();
    res.json(results);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/check', async (_req, res) => {
  try {
    const results = await healthCheckManager.runCheck();
    res.json(results);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.post('/reset/:serviceName', (req, res) => {
  try {
    healthCheckManager.resetRecoveryAttempts(req.params.serviceName);
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

router.get('/history', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const rows = dbService.getDb().prepare(
      'SELECT * FROM health_check_history ORDER BY checked_at DESC LIMIT ?'
    ).all(limit);
    res.json(rows);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;
