import { Router } from 'express';
import { workflowService } from '../services/workflowService.js';

const router = Router();

router.get('/workflows', (_req, res) => {
  res.json(workflowService.getWorkflows());
});

router.post('/workflows', (req, res) => {
  try {
    const wf = workflowService.createWorkflow(req.body);
    res.json(wf);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/workflows/:id', (req, res) => {
  res.json({ success: workflowService.deleteWorkflow(Number(req.params.id)) });
});

router.get('/workflows/active', (_req, res) => {
  const wf = workflowService.getActiveWorkflow();
  res.json(wf || { status: 'none' });
});

router.post('/workflows/:id/pause', (req, res) => {
  res.json({ success: workflowService.pauseWorkflow(Number(req.params.id)) });
});

router.post('/workflows/:id/resume', (req, res) => {
  res.json({ success: workflowService.resumeWorkflow(Number(req.params.id)) });
});

router.post('/workflows/:id/execute', async (req, res) => {
  try {
    const task = workflowService.enqueueTask({
      name: 'workflow_execute',
      workflowId: Number(req.params.id),
      priority: 100,
    });
    res.json({ success: true, taskId: task.id, message: 'Workflow queued for execution' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/tasks', (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json(workflowService.getTasks(limit));
});

router.post('/tasks', (req, res) => {
  try {
    const task = workflowService.enqueueTask(req.body);
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;