import { getErrorMessage } from '../middleware/errorHandler.js';
import { Router } from 'express';
import { OpenclawService } from '../services/openclawService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const config = await OpenclawService.getConfig();
    res.json(config);
  } catch (error: unknown) {
    console.error('Failed to get config:', error);
    res.status(500).json({ error: 'Failed to get config', message: getErrorMessage(error) });
  }
});

export default router;