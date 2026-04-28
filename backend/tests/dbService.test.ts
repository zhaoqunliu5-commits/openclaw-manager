import { describe, it, expect, beforeEach } from 'vitest';
import { DbService } from '../src/services/dbService.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('DbService', () => {
  let db: DbService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-test-'));
    db = new DbService();
  });

  describe('Command History', () => {
    it('should add and retrieve command history', () => {
      const id = db.addCommandHistory('openclaw status', undefined, 'running', 'success', 150);
      expect(id).toBeGreaterThan(0);

      const history = db.getCommandHistory(10);
      expect(history.length).toBeGreaterThan(0);

      const entry = history.find(h => h.command === 'openclaw status');
      expect(entry).toBeDefined();
      expect(entry!.status).toBe('success');
      expect(entry!.execution_time_ms).toBe(150);
    });

    it('should clear command history', () => {
      db.addCommandHistory('openclaw gateway start');
      const count = db.clearCommandHistory();
      expect(count).toBeGreaterThanOrEqual(1);

      const history = db.getCommandHistory(10);
      expect(history.length).toBe(0);
    });

    it('should limit command history results', () => {
      for (let i = 0; i < 10; i++) {
        db.addCommandHistory(`cmd-${i}`);
      }
      const history = db.getCommandHistory(5);
      expect(history.length).toBe(5);
    });
  });

  describe('Command Favorites', () => {
    it('should add and retrieve favorites', () => {
      const uniqueCmd = `test-cmd-${Date.now()}`;
      const result = db.addCommandFavorite(uniqueCmd, '测试命令');
      expect(result).toBe(true);

      const favs = db.getCommandFavorites();
      const found = favs.find(f => f.command === uniqueCmd);
      expect(found).toBeDefined();
      expect(found!.alias).toBe('测试命令');
    });

    it('should not add duplicate favorites', () => {
      const uniqueCmd = `dup-cmd-${Date.now()}`;
      db.addCommandFavorite(uniqueCmd);
      const result = db.addCommandFavorite(uniqueCmd);
      expect(result).toBe(false);
    });

    it('should remove favorites', () => {
      const uniqueCmd = `rm-cmd-${Date.now()}`;
      db.addCommandFavorite(uniqueCmd);
      const result = db.removeCommandFavorite(uniqueCmd);
      expect(result).toBe(true);

      const favs = db.getCommandFavorites();
      expect(favs.find(f => f.command === uniqueCmd)).toBeUndefined();
    });
  });

  describe('Notifications', () => {
    it('should save and retrieve notifications', () => {
      db.saveNotification({
        id: 'test-1',
        type: 'service_status',
        title: '服务启动',
        message: 'Gateway 已启动',
        timestamp: new Date().toISOString(),
        read: 0,
        service: 'gateway',
      });

      const notifications = db.getNotifications(10);
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].id).toBe('test-1');
      expect(notifications[0].read).toBe(0);
    });

    it('should mark notification as read', () => {
      db.saveNotification({
        id: 'test-2',
        type: 'info',
        title: '测试',
        message: '测试通知',
        timestamp: new Date().toISOString(),
        read: 0,
      });

      const result = db.markNotificationRead('test-2');
      expect(result).toBe(true);

      const notifications = db.getNotifications(10);
      const n = notifications.find(n => n.id === 'test-2');
      expect(n!.read).toBe(1);
    });

    it('should count unread notifications', () => {
      db.saveNotification({ id: 'u1', type: 'info', title: 'T1', message: 'M1', timestamp: new Date().toISOString(), read: 0 });
      db.saveNotification({ id: 'u2', type: 'info', title: 'T2', message: 'M2', timestamp: new Date().toISOString(), read: 0 });
      db.saveNotification({ id: 'u3', type: 'info', title: 'T3', message: 'M3', timestamp: new Date().toISOString(), read: 1 });

      const count = db.getUnreadNotificationCount();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should clear all notifications', () => {
      db.saveNotification({ id: 'c1', type: 'info', title: 'T', message: 'M', timestamp: new Date().toISOString(), read: 0 });
      db.clearNotifications();

      const count = db.getUnreadNotificationCount();
      expect(count).toBe(0);
    });
  });

  describe('Operation Logs', () => {
    it('should log and retrieve operations', () => {
      const id = db.logOperation({
        operationType: 'start',
        serviceName: 'gateway',
        status: 'success',
        message: 'Gateway started',
      });
      expect(id).toBeGreaterThan(0);

      const ops = db.getOperations(10);
      expect(ops.length).toBeGreaterThan(0);
    });
  });
});
