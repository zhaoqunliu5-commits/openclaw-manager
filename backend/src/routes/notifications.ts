import { Router, type Request, type Response } from 'express';
import { notificationManager } from '../services/notificationService.js';

const router = Router();

const sseClients: Set<Response> = new Set();

notificationManager.on('notification', (notification) => {
  const data = `data: ${JSON.stringify(notification)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
});

router.get('/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
});

router.get('/', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const notifications = notificationManager.getNotifications(limit);
  res.json(notifications);
});

router.get('/unread-count', (_req: Request, res: Response) => {
  res.json({ count: notificationManager.getUnreadCount() });
});

router.put('/read/:id', (req: Request, res: Response) => {
  const ok = notificationManager.markAsRead(req.params.id);
  res.json({ success: ok });
});

router.put('/read-all', (_req: Request, res: Response) => {
  notificationManager.markAllAsRead();
  res.json({ success: true });
});

router.delete('/', (_req: Request, res: Response) => {
  notificationManager.clearAll();
  res.json({ success: true });
});

router.post('/', (req: Request, res: Response) => {
  const { type, title, message, agent, service } = req.body;
  if (!type || !title || !message) {
    res.status(400).json({ error: 'type, title, message are required' });
    return;
  }
  const notification = notificationManager.addManualNotification({ type, title, message, agent, service });
  res.json(notification);
});

export default router;
