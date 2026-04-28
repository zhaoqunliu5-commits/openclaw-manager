import { getErrorMessage } from '../middleware/errorHandler.js';
import { Router } from 'express';
import { CommandPaletteService } from '../services/commandPaletteService.js';

const router = Router();

router.get('/commands', async (_req, res) => {
  try {
    const commands = await CommandPaletteService.getAvailableCommands();
    res.json(commands);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get commands', message: getErrorMessage(error) });
  }
});

router.get('/builtin', async (_req, res) => {
  try {
    const commands = CommandPaletteService.getBuiltinCommands();
    res.json(commands);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get builtin commands', message: getErrorMessage(error) });
  }
});

router.post('/execute', async (req, res) => {
  try {
    const { command, timeout } = req.body;
    if (!command || typeof command !== 'string') {
      res.status(400).json({ error: 'command is required and must be a string' });
      return;
    }
    if (command.length > 1000) {
      res.status(400).json({ error: 'command too long (max 1000 characters)' });
      return;
    }
    const validTimeout = typeof timeout === 'number' && timeout > 0 && timeout <= 120000 ? timeout : 30000;
    const result = await CommandPaletteService.executeCommand(command, validTimeout);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to execute command', message: getErrorMessage(error) });
  }
});

router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await CommandPaletteService.getHistory(limit);
    res.json(history);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get history', message: getErrorMessage(error) });
  }
});

router.delete('/history', async (_req, res) => {
  try {
    const result = await CommandPaletteService.clearHistory();
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to clear history', message: getErrorMessage(error) });
  }
});

router.get('/favorites', async (_req, res) => {
  try {
    const favorites = await CommandPaletteService.getFavorites();
    res.json(favorites);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get favorites', message: getErrorMessage(error) });
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
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to add favorite', message: getErrorMessage(error) });
  }
});

router.delete('/favorites/:id', async (req, res) => {
  try {
    const favorites = await CommandPaletteService.removeFavorite(req.params.id);
    res.json(favorites);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to remove favorite', message: getErrorMessage(error) });
  }
});

export default router;
