import { getErrorMessage } from '../middleware/errorHandler.js';
import { Router } from 'express';
import { skillEvaluationService } from '../services/skillEvaluationService.js';

const router = Router();

router.get('/stats', async (_req, res) => {
  await skillEvaluationService.ensureInitialized();
  res.json(skillEvaluationService.getStats());
});

router.get('/scan', async (_req, res) => {
  try {
    const skills = await skillEvaluationService.scanSkills();
    res.json(skills);
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

router.post('/record', (req, res) => {
  try {
    const { skill, success, executionTimeMs } = req.body;
    if (!skill) { res.status(400).json({ error: 'skill is required' }); return; }
    skillEvaluationService.recordUsage(skill, success !== false, executionTimeMs);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

router.put('/rating/:skill', (req, res) => {
  try {
    const { rating } = req.body;
    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      res.status(400).json({ error: 'rating must be between 0 and 5' });
      return;
    }
    skillEvaluationService.updateRating(req.params.skill, rating);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

router.get('/recommendations', async (req, res) => {
  await skillEvaluationService.ensureInitialized();
  const count = Number(req.query.count) || 5;
  res.json(skillEvaluationService.getRecommendations(count));
});

router.get('/unpopular', (req, res) => {
  const limit = Number(req.query.limit) || 10;
  res.json(skillEvaluationService.getUnpopularSkills(limit));
});

router.get('/analyze/:skill', async (req, res) => {
  try {
    const analysis = await skillEvaluationService.analyzeSkillPerformance(req.params.skill);
    res.json(analysis);
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

router.post('/execute', async (req, res) => {
  try {
    const { skill, params } = req.body;
    if (!skill) { res.status(400).json({ error: 'skill is required' }); return; }
    const result = await skillEvaluationService.executeSkill(skill, params);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

export default router;