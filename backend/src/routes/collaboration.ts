import { getErrorMessage } from '../middleware/errorHandler.js';
import { Router, type Request, type Response } from 'express';
import { collaborationService } from '../services/collaborationService.js';

const router = Router();

router.get('/bindings', async (_req: Request, res: Response) => {
  try {
    const bindings = await collaborationService.getBindings();
    res.json(bindings);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get bindings', message: getErrorMessage(error) });
  }
});

router.post('/bindings', async (req: Request, res: Response) => {
  try {
    const { agent, binding } = req.body;
    if (!agent || !binding) {
      res.status(400).json({ error: 'agent and binding are required' });
      return;
    }
    const result = await collaborationService.addBinding(agent, binding);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to add binding', message: getErrorMessage(error) });
  }
});

router.delete('/bindings', async (req: Request, res: Response) => {
  try {
    const { agent, binding } = req.body;
    if (!agent || !binding) {
      res.status(400).json({ error: 'agent and binding are required' });
      return;
    }
    const result = await collaborationService.removeBinding(agent, binding);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to remove binding', message: getErrorMessage(error) });
  }
});

router.get('/agents', async (_req: Request, res: Response) => {
  try {
    const agents = await collaborationService.getAgentList();
    res.json(agents);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get agent list', message: getErrorMessage(error) });
  }
});

router.post('/send', async (req: Request, res: Response) => {
  try {
    const { fromAgent, toAgent, message, channel, deliver, sessionId } = req.body;
    if (!toAgent || !message) {
      res.status(400).json({ error: 'toAgent and message are required' });
      return;
    }
    const result = await collaborationService.sendAgentMessage(
      fromAgent || 'main', toAgent, message, { channel, deliver, sessionId }
    );
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to send message', message: getErrorMessage(error) });
  }
});

router.post('/broadcast', async (req: Request, res: Response) => {
  try {
    const { message, targets, channel } = req.body;
    if (!message || !targets || !Array.isArray(targets)) {
      res.status(400).json({ error: 'message and targets (array) are required' });
      return;
    }
    const result = await collaborationService.broadcastMessage(message, targets, channel);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to broadcast', message: getErrorMessage(error) });
  }
});

router.get('/messages/:agent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const messages = await collaborationService.getRecentMessages(req.params.agent, limit);
    res.json(messages);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get messages', message: getErrorMessage(error) });
  }
});

router.post('/workflow', async (req: Request, res: Response) => {
  try {
    const { name, steps } = req.body;
    if (!name || !steps || !Array.isArray(steps)) {
      res.status(400).json({ error: 'name and steps (array) are required' });
      return;
    }
    const result = await collaborationService.executeWorkflow({ name, steps });
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to execute workflow', message: getErrorMessage(error) });
  }
});

export default router;
