import { Router } from 'express';
import { MemoryService } from '../services/memoryService.js';

const router = Router();

router.get('/status', async (_req, res) => {
  try {
    const status = await MemoryService.getMemoryStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get memory status', message: error.message });
  }
});

router.get('/entries/:agent', async (req, res) => {
  try {
    const entries = await MemoryService.getMemoryEntries(req.params.agent);
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get memory entries', message: error.message });
  }
});

router.get('/file/:agent', async (req, res) => {
  try {
    const path = req.query.path as string;
    if (!path) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const content = await MemoryService.getMemoryFile(req.params.agent, path);
    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get memory file', message: error.message });
  }
});

router.get('/recall/:agent', async (req, res) => {
  try {
    const entries = await MemoryService.getRecallEntries(req.params.agent);
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get recall entries', message: error.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const agent = req.query.agent as string | undefined;
    if (!query) {
      res.json([]);
      return;
    }
    const results = await MemoryService.searchMemory(query, agent);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to search memory', message: error.message });
  }
});

router.get('/sessions/:agent', async (req, res) => {
  try {
    const sessions = await MemoryService.getSessions(req.params.agent);
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get sessions', message: error.message });
  }
});

router.delete('/entry/:agent', async (req, res) => {
  try {
    const path = req.query.path as string;
    if (!path) {
      res.status(400).json({ error: 'path is required' });
      return;
    }
    const result = await MemoryService.deleteMemoryEntry(req.params.agent, path);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete entry', message: error.message });
  }
});

router.post('/clean/:agent', async (req, res) => {
  try {
    const maxAgeDays = parseInt(req.body.maxAgeDays as string) || 30;
    const result = await MemoryService.cleanOldMemories(req.params.agent, maxAgeDays);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to clean memories', message: error.message });
  }
});

router.post('/reindex', async (req, res) => {
  try {
    const agent = req.body.agent as string | undefined;
    const result = await MemoryService.reindexMemory(agent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reindex', message: error.message });
  }
});

export default router;
