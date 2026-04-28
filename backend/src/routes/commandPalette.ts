import { Router } from 'express';
import { CommandPaletteService } from '../services/commandPaletteService.js';

const router = Router();

router.get('/commands', async (_req, res) => {
  try {
    const commands = await CommandPaletteService.getAvailableCommands();
    res.json(commands);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get commands', message: error.message });
  }
});

router.get('/builtin', async (_req, res) => {
  try {
    const commands = CommandPaletteService.getBuiltinCommands();
    res.json(commands);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get builtin commands', message: error.message });
  }
});

router.post('/execute', async (req, res) => {
  try {
    const { command, timeout } = req.body;
    if (!command) {
      res.status(400).json({ error: 'command is required' });
      return;
    }
    const result = await CommandPaletteService.executeCommand(command, timeout || 30000);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to execute command', message: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await CommandPaletteService.getHistory(limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get history', message: error.message });
  }
});

router.delete('/history', async (_req, res) => {
  try {
    const result = await CommandPaletteService.clearHistory();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to clear history', message: error.message });
  }
});

router.get('/favorites', async (_req, res) => {
  try {
    const favorites = await CommandPaletteService.getFavorites();
    res.json(favorites);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get favorites', message: error.message });
  }
});

router.post('/favorites', async (req, res) => {
  try {
    const entry = req.body;
    if (!entry || !entry.id) {
      res.status(400).json({ error: 'entry with id is required' });
      return;
    }
    const favorites = await CommandPaletteService.addFavorite(entry);
    res.json(favorites);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add favorite', message: error.message });
  }
});

router.delete('/favorites/:id', async (req, res) => {
  try {
    const favorites = await CommandPaletteService.removeFavorite(req.params.id);
    res.json(favorites);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to remove favorite', message: error.message });
  }
});

export default router;
