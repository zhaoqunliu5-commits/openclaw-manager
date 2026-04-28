import { Router } from 'express';
import { OpenclawService } from '../services/openclawService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const overview = await OpenclawService.getOverview();
    res.json(overview);
  } catch (error: any) {
    console.error('Failed to get overview:', error);
    res.status(500).json({ error: 'Failed to get overview', message: error.message });
  }
});

export default router;