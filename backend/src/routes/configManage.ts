import { getErrorMessage } from '../middleware/errorHandler.js';
import { Router } from 'express';
import { ConfigManageService } from '../services/configManageService.js';
import { WslService } from '../services/wslService.js';

const router = Router();

router.post('/hot-reload', async (_req, res) => {
  try {
    const results: { service: string; success: boolean; message: string }[] = [];

    const reloadCmd = 'openclaw config reload 2>&1 || echo "FALLBACK"';
    const output = await WslService.execCommand(reloadCmd, 15000);

    if (output.includes('FALLBACK') || output.includes('error') || output.includes('Error')) {
      const gwOutput = await WslService.execCommand(
        'systemctl --user reload openclaw-gateway 2>&1 || echo "NO_SYSTEMD"',
        10000
      );
      results.push({
        service: 'openclaw-gateway',
        success: !gwOutput.includes('NO_SYSTEMD'),
        message: gwOutput.includes('NO_SYSTEMD') ? '非 systemd 管理，请手动重启' : '网关配置已热重载',
      });
    } else {
      results.push({
        service: 'openclaw',
        success: true,
        message: output.trim() || '配置已重载',
      });
    }

    res.json({ success: true, results, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Hot reload failed', message: getErrorMessage(error) });
  }
});

router.post('/hot-reload/service/:name', async (req, res) => {
  try {
    const serviceName = req.params.name;
    const output = await WslService.execCommand(
      `systemctl --user reload ${serviceName} 2>&1 || echo "NO_SYSTEMD"`,
      10000
    );

    if (output.includes('NO_SYSTEMD')) {
      const restartOutput = await WslService.execCommand(
        `pkill -HUP -f ${serviceName} 2>&1 || echo "NO_PROCESS"`,
        10000
      );
      res.json({
        success: !restartOutput.includes('NO_PROCESS'),
        message: restartOutput.includes('NO_PROCESS')
          ? '无法发送 HUP 信号，请手动重启服务'
          : `已向 ${serviceName} 发送 HUP 信号`,
      });
    } else {
      res.json({ success: true, message: `${serviceName} 配置已热重载` });
    }
  } catch (error: unknown) {
    res.status(500).json({ error: 'Hot reload failed', message: getErrorMessage(error) });
  }
});

router.get('/sections', async (_req, res) => {
  try {
    const sections = await ConfigManageService.getSections();
    res.json(sections);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get sections', message: getErrorMessage(error) });
  }
});

router.get('/json', async (req, res) => {
  try {
    const section = req.query.section as string | undefined;
    const config = await ConfigManageService.getConfigJson(section);
    res.json(config);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get config', message: getErrorMessage(error) });
  }
});

router.put('/section/:section', async (req, res) => {
  try {
    const result = await ConfigManageService.updateSection(req.params.section, req.body);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to update section', message: getErrorMessage(error) });
  }
});

router.get('/backups', async (_req, res) => {
  try {
    const backups = await ConfigManageService.listBackups();
    res.json(backups);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to list backups', message: getErrorMessage(error) });
  }
});

router.post('/backups', async (req, res) => {
  try {
    const label = (req.body?.label as string) || '';
    const backup = await ConfigManageService.createBackup(label);
    res.json(backup);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to create backup', message: getErrorMessage(error) });
  }
});

router.post('/backups/:id/restore', async (req, res) => {
  try {
    const result = await ConfigManageService.restoreBackup(req.params.id);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to restore backup', message: getErrorMessage(error) });
  }
});

router.delete('/backups/:id', async (req, res) => {
  try {
    const result = await ConfigManageService.deleteBackup(req.params.id);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to delete backup', message: getErrorMessage(error) });
  }
});

router.post('/diff', async (req, res) => {
  try {
    const { backupId1, backupId2 } = req.body;
    if (!backupId1 || !backupId2) {
      res.status(400).json({ error: 'backupId1 and backupId2 are required' });
      return;
    }
    const diffs = await ConfigManageService.diffBackups(backupId1, backupId2);
    res.json(diffs);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to diff backups', message: getErrorMessage(error) });
  }
});

router.get('/export', async (_req, res) => {
  try {
    const data = await ConfigManageService.exportConfig();
    res.setHeader('Content-Disposition', 'attachment; filename=openclaw-config.json');
    res.json(data);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to export config', message: getErrorMessage(error) });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { config, merge } = req.body;
    if (!config) {
      res.status(400).json({ error: 'config data is required' });
      return;
    }
    const result = await ConfigManageService.importConfig(config, merge === true);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to import config', message: getErrorMessage(error) });
  }
});

export default router;
