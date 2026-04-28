import { Router } from 'express';
import { workspaceService } from '../services/workspaceService.js';

const router = Router();

router.get('/stats', async (_req, res) => {
  await workspaceService.ensureInitialized();
  res.json(workspaceService.getStats());
});

router.get('/scan', async (_req, res) => {
  try {
    const workspaces = await workspaceService.scanWorkspaces();
    res.json(workspaces);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/access/:workspace', async (req, res) => {
  try {
    await workspaceService.recordAccess(req.params.workspace);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/backups', (_req, res) => {
  res.json(workspaceService.getBackups());
});

router.post('/backups', async (req, res) => {
  try {
    const { workspace } = req.body;
    if (!workspace) { res.status(400).json({ error: 'workspace is required' }); return; }
    const backup = await workspaceService.createBackup(workspace);
    res.json(backup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/backups/:id/restore', async (req, res) => {
  try {
    const result = await workspaceService.restoreBackup(Number(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/backups/:id', async (req, res) => {
  res.json({ success: await workspaceService.deleteBackup(Number(req.params.id)) });
});

router.post('/switch', async (req, res) => {
  try {
    const { workspace } = req.body;
    if (!workspace) { res.status(400).json({ error: 'workspace is required' }); return; }
    const result = await workspaceService.switchWorkspace(workspace);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/top', (_req, res) => {
  res.json(workspaceService.getTopWorkspaces());
});

export default router;