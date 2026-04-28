import { Router } from 'express';
import { OpenclawService } from '../services/openclawService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const skills = await OpenclawService.getSkills();
    res.json(skills);
  } catch (error: any) {
    console.error('Failed to get skills:', error);
    res.status(500).json({ error: 'Failed to get skills', message: error.message });
  }
});

export default router;
