import { Router, type Request, type Response } from 'express';
import { settingsService } from '../services/settingsService.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(settingsService.get());
});

router.put('/', (req: Request, res: Response) => {
  const updated = settingsService.update(req.body);
  res.json(updated);
});

router.get('/agents', async (_req: Request, res: Response) => {
  try {
    const agents = await settingsService.getAvailableAgents();
    res.json(agents);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get agents', message: error.message });
  }
});

router.put('/default-agent', async (req: Request, res: Response) => {
  try {
    const { agent } = req.body;
    if (!agent) {
      res.status(400).json({ error: 'agent is required' });
      return;
    }
    const result = await settingsService.setDefaultAgent(agent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to set default agent', message: error.message });
  }
});

router.put('/auto-start', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled (boolean) is required' });
      return;
    }
    const result = await settingsService.setAutoStart(enabled);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to set auto start', message: error.message });
  }
});

export default router;
