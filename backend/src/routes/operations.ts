import { Router } from 'express';
import { DbService } from '../services/dbService.js';

const router = Router();
const db = new DbService();

// 获取操作历史
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const operations = db.getOperations(limit);
    res.json(operations);
  } catch (error: any) {
    console.error('Failed to get operations:', error);
    res.status(500).json({ error: 'Failed to get operations', message: error.message });
  }
});

// 获取单条操作记录
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const operation = db.getOperationById(id);
    
    if (!operation) {
      return res.status(404).json({ error: 'Operation not found' });
    }
    
    res.json(operation);
  } catch (error: any) {
    console.error('Failed to get operation:', error);
    res.status(500).json({ error: 'Failed to get operation', message: error.message });
  }
});

export default router;