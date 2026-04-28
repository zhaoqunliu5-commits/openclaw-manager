import { Router } from 'express';
import { OpenclawService } from '../services/openclawService.js';
import { DbService } from '../services/dbService.js';

const router = Router();
const db = new DbService();

// 获取所有服务状态
router.get('/', async (req, res) => {
  try {
    const services = await OpenclawService.getServicesStatus();
    res.json(services);
  } catch (error: any) {
    console.error('Failed to get services:', error);
    res.status(500).json({ error: 'Failed to get services', message: error.message });
  }
});

// 启动服务
router.post('/:name/start', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await OpenclawService.startService(name);
    
    // 记录操作日志
    db.logOperation({
      operationType: 'start',
      serviceName: name,
      status: result.success ? 'success' : 'failure',
      message: result.message
    });

    res.json(result);
  } catch (error: any) {
    console.error('Failed to start service:', error);
    
    db.logOperation({
      operationType: 'start',
      serviceName: name,
      status: 'failure',
      message: error.message
    });

    res.status(500).json({ success: false, message: error.message });
  }
});

// 停止服务
router.post('/:name/stop', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await OpenclawService.stopService(name);
    
    // 记录操作日志
    db.logOperation({
      operationType: 'stop',
      serviceName: name,
      status: result.success ? 'success' : 'failure',
      message: result.message
    });

    res.json(result);
  } catch (error: any) {
    console.error('Failed to stop service:', error);
    
    db.logOperation({
      operationType: 'stop',
      serviceName: name,
      status: 'failure',
      message: error.message
    });

    res.status(500).json({ success: false, message: error.message });
  }
});

// 重启服务
router.post('/:name/restart', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await OpenclawService.restartService(name);
    
    // 记录操作日志
    db.logOperation({
      operationType: 'restart',
      serviceName: name,
      status: result.success ? 'success' : 'failure',
      message: result.message
    });

    res.json(result);
  } catch (error: any) {
    console.error('Failed to restart service:', error);
    
    db.logOperation({
      operationType: 'restart',
      serviceName: name,
      status: 'failure',
      message: error.message
    });

    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;