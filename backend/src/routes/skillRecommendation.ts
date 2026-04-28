import { getErrorMessage } from '../middleware/errorHandler.js';
import { Router } from 'express';
import { SkillRecommendationService } from '../services/skillRecommendationService.js';

const router = Router();

router.get('/recommendations', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 6, 12);
    const recommendations = await SkillRecommendationService.getRecommendations(count);
    res.json(recommendations);
  } catch (error: unknown) {
    console.error('Failed to get skill recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations', message: getErrorMessage(error) });
  }
});

router.get('/trending', async (_req, res) => {
  try {
    const trending = await SkillRecommendationService.getTrending();
    res.json(trending);
  } catch (error: unknown) {
    console.error('Failed to get trending skills:', error);
    res.status(500).json({ error: 'Failed to get trending', message: getErrorMessage(error) });
  }
});

router.get('/context', async (_req, res) => {
  try {
    const context = await SkillRecommendationService.getUserContext();
    res.json(context);
  } catch (error: unknown) {
    console.error('Failed to get user context:', error);
    res.status(500).json({ error: 'Failed to get context', message: getErrorMessage(error) });
  }
});

router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query || query.trim().length === 0) {
      res.json([]);
      return;
    }
    const results = await SkillRecommendationService.searchUserSkills(query.trim());
    res.json(results);
  } catch (error: unknown) {
    console.error('Failed to search skills:', error);
    res.status(500).json({ error: 'Failed to search skills', message: getErrorMessage(error) });
  }
});

export default router;
