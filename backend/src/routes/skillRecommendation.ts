import { Router } from 'express';
import { SkillRecommendationService } from '../services/skillRecommendationService.js';

const router = Router();

router.get('/recommendations', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 6, 12);
    const recommendations = await SkillRecommendationService.getRecommendations(count);
    res.json(recommendations);
  } catch (error: any) {
    console.error('Failed to get skill recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations', message: error.message });
  }
});

router.get('/trending', async (_req, res) => {
  try {
    const trending = await SkillRecommendationService.getTrending();
    res.json(trending);
  } catch (error: any) {
    console.error('Failed to get trending skills:', error);
    res.status(500).json({ error: 'Failed to get trending', message: error.message });
  }
});

router.get('/context', async (_req, res) => {
  try {
    const context = await SkillRecommendationService.getUserContext();
    res.json(context);
  } catch (error: any) {
    console.error('Failed to get user context:', error);
    res.status(500).json({ error: 'Failed to get context', message: error.message });
  }
});

export default router;
