import { getErrorMessage } from '../middleware/errorHandler.js';
import { Router } from 'express';
import { automationService } from '../services/automationService.js';

const router = Router();

router.get('/rules', (_req, res) => {
  res.json(automationService.getRules());
});

router.get('/stats', (_req, res) => {
  res.json(automationService.getStats());
});

router.get('/rules/:id', (req, res) => {
  const rule = automationService.getRuleById(Number(req.params.id));
  if (!rule) { res.status(404).json({ error: 'Rule not found' }); return; }
  res.json(rule);
});

router.post('/rules', (req, res) => {
  try {
    const { name, triggerType, triggerConfig, actionType, actionConfig } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required and must be a string' });
      return;
    }
    const validTriggerTypes = ['cron', 'event', 'webhook'];
    if (!validTriggerTypes.includes(triggerType)) {
      res.status(400).json({ error: `triggerType must be one of: ${validTriggerTypes.join(', ')}` });
      return;
    }
    const validActionTypes = ['command', 'notify', 'switch_agent', 'restart_service'];
    if (!validActionTypes.includes(actionType)) {
      res.status(400).json({ error: `actionType must be one of: ${validActionTypes.join(', ')}` });
      return;
    }
    const rule = automationService.createRule(req.body);
    res.json(rule);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

router.put('/rules/:id', (req, res) => {
  const rule = automationService.updateRule(Number(req.params.id), req.body);
  if (!rule) { res.status(404).json({ error: 'Rule not found' }); return; }
  res.json(rule);
});

router.delete('/rules/:id', (req, res) => {
  const ok = automationService.deleteRule(Number(req.params.id));
  res.json({ success: ok });
});

router.post('/rules/:id/execute', async (req, res) => {
  const result = await automationService.executeRule(Number(req.params.id));
  res.json(result);
});

router.post('/event', (req, res) => {
  const { event, data } = req.body;
  if (!event || typeof event !== 'string') {
    res.status(400).json({ error: 'event is required and must be a string' });
    return;
  }
  automationService.triggerEvent(event, data);
  res.json({ success: true });
});

router.get('/logs', (req, res) => {
  const ruleId = req.query.ruleId ? Number(req.query.ruleId) : undefined;
  const limit = Number(req.query.limit) || 50;
  res.json(automationService.getLogs(ruleId, limit));
});

export default router;
