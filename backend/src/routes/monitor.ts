import { Router } from 'express';
import { MonitorService } from '../services/monitorService.js';

const router = Router();

router.get('/resources', async (_req, res) => {
  try {
    const resources = await MonitorService.getSystemResources();
    res.json(resources);
  } catch (error: any) {
    console.error('Failed to get system resources:', error);
    res.status(500).json({ error: 'Failed to get system resources', message: error.message });
  }
});

router.get('/agent-activities', async (_req, res) => {
  try {
    const activities = await MonitorService.getAgentActivities();
    res.json(activities);
  } catch (error: any) {
    console.error('Failed to get agent activities:', error);
    res.status(500).json({ error: 'Failed to get agent activities', message: error.message });
  }
});

router.get('/sessions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const sessions = await MonitorService.getRecentSessions(limit);
    res.json(sessions);
  } catch (error: any) {
    console.error('Failed to get sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions', message: error.message });
  }
});

router.get('/gateway', async (_req, res) => {
  try {
    const metrics = await MonitorService.getProcessMetrics('openclaw-gateway');
    res.json(metrics);
  } catch (error: any) {
    console.error('Failed to get gateway metrics:', error);
    res.status(500).json({ error: 'Failed to get gateway metrics', message: error.message });
  }
});

export default router;
