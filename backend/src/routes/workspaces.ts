import { Router } from 'express';
import { OpenclawService } from '../services/openclawService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const workspaces = await OpenclawService.getWorkspaces();
    res.json(workspaces);
  } catch (error: any) {
    console.error('Failed to get workspaces:', error);
    res.status(500).json({ error: 'Failed to get workspaces', message: error.message });
  }
});

export default router;
