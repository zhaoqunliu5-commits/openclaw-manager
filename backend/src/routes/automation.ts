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
    const rule = automationService.createRule(req.body);
    res.json(rule);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
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
  automationService.triggerEvent(event, data);
  res.json({ success: true });
});

router.get('/logs', (req, res) => {
  const ruleId = req.query.ruleId ? Number(req.query.ruleId) : undefined;
  const limit = Number(req.query.limit) || 50;
  res.json(automationService.getLogs(ruleId, limit));
});

export default router;
