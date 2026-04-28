import { getErrorMessage } from '../middleware/errorHandler.js';
import { Router } from 'express';
import { MemoryService } from '../services/memoryService.js';

const router = Router();

router.get('/diagnostic', async (_req, res) => {
  try {
    const diagnostic = await MemoryService.getDiagnostic();
    res.json(diagnostic);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to run diagnostic', message: getErrorMessage(error) });
  }
});

router.get('/status', async (_req, res) => {
  try {
    const status = await MemoryService.getMemoryStatus();
    res.json(status);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get memory status', message: getErrorMessage(error) });
  }
});

router.get('/entries/:agent', async (req, res) => {
  try {
    const entries = await MemoryService.getMemoryEntries(req.params.agent);
    res.json(entries);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get memory entries', message: getErrorMessage(error) });
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
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get memory file', message: getErrorMessage(error) });
  }
});

router.get('/recall/:agent', async (req, res) => {
  try {
    const entries = await MemoryService.getRecallEntries(req.params.agent);
    res.json(entries);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get recall entries', message: getErrorMessage(error) });
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
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to search memory', message: getErrorMessage(error) });
  }
});

router.get('/sessions/:agent', async (req, res) => {
  try {
    const sessions = await MemoryService.getSessions(req.params.agent);
    res.json(sessions);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get sessions', message: getErrorMessage(error) });
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
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to delete entry', message: getErrorMessage(error) });
  }
});

router.post('/clean/:agent', async (req, res) => {
  try {
    const maxAgeDays = parseInt(req.body.maxAgeDays as string) || 30;
    const result = await MemoryService.cleanOldMemories(req.params.agent, maxAgeDays);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to clean memories', message: getErrorMessage(error) });
  }
});

router.post('/reindex', async (req, res) => {
  try {
    const agent = req.body.agent as string | undefined;
    const result = await MemoryService.reindexMemory(agent);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to reindex', message: getErrorMessage(error) });
  }
});

export default router;
