import { Router } from 'express';
import { DbService } from '../services/dbService.js';
import { WslService } from '../services/wslService.js';

const router = Router();
const db = new DbService();

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const operations = db.getOperations(limit);
    res.json(operations);
  } catch (error: any) {
    console.error('Failed to get logs:', error);
    res.status(500).json({ error: 'Failed to get logs', message: error.message });
  }
});

router.get('/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const interval = setInterval(async () => {
    try {
      const recentLogs = db.getOperations(5);
      const lastLog = recentLogs[0];
      if (lastLog) {
        res.write(`data: ${JSON.stringify({ type: 'log', data: lastLog })}\n\n`);
      }
    } catch {}
  }, 3000);

  const cmdInterval = setInterval(async () => {
    try {
      const output = await WslService.execCommand('tail -n 1 /tmp/openclaw-activity.log 2>/dev/null || echo ""', 5000);
      const line = output.trim();
      if (line) {
        res.write(`data: ${JSON.stringify({ type: 'activity', data: line, timestamp: new Date().toISOString() })}\n\n`);
      }
    } catch {}
  }, 5000);

  req.on('close', () => {
    clearInterval(interval);
    clearInterval(cmdInterval);
  });
});

router.get('/wsl-tail', async (req, res) => {
  try {
    const lines = parseInt(req.query.lines as string) || 50;
    const output = await WslService.execCommand(
      `tail -n ${lines} /tmp/openclaw-activity.log 2>/dev/null || echo "No activity log found"`,
      10000
    );
    res.json({ lines: output.split('\n').filter(Boolean) });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to read WSL logs', message: error.message });
  }
});

export default router;