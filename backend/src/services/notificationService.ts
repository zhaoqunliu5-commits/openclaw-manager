import { EventEmitter } from 'events';
import { WslService } from './wslService.js';
import { dbService } from './dbService.js';
import { appConfig } from '../config.js';

export interface Notification {
  id: string;
  type: 'service_status' | 'agent_switch' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  agent?: string;
  service?: string;
}

const NOTIFICATION_MAX = 200;

class NotificationManager extends EventEmitter {
  private notifications: Notification[] = [];
  private previousServiceStatus: Map<string, boolean> = new Map();
  private previousActiveAgent: string = '';
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start() {
    this.checkForChanges();
    this.intervalId = setInterval(() => this.checkForChanges(), 15000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const entry: Notification = {
      ...notification,
      id: `n_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.notifications.unshift(entry);
    if (this.notifications.length > NOTIFICATION_MAX) {
      this.notifications = this.notifications.slice(0, NOTIFICATION_MAX);
    }
    try {
      dbService.saveNotification({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        message: entry.message,
        timestamp: entry.timestamp,
        read: 0,
        agent: entry.agent,
        service: entry.service,
      });
    } catch {}
    this.emit('notification', entry);
    return entry;
  }

  private async checkForChanges() {
    await this.checkServiceStatus();
    await this.checkActiveAgent();
  }

  private async checkServiceStatus() {
    try {
      const output = await WslService.execCommand(
        'systemctl --user is-active openclaw-gateway 2>/dev/null; systemctl --user is-active canvas 2>/dev/null',
        5000
      );
      const lines = output.trim().split('\n');
      const services = [
        { name: 'openclaw-gateway', status: lines[0]?.trim() === 'active' },
        { name: 'canvas', status: lines[1]?.trim() === 'active' },
      ];

      for (const svc of services) {
        const prev = this.previousServiceStatus.get(svc.name);
        if (prev !== undefined && prev !== svc.status) {
          this.addNotification({
            type: svc.status ? 'service_status' : 'error',
            title: svc.status ? '服务已启动' : '服务已停止',
            message: `${svc.name} 状态变更: ${svc.status ? '运行中' : '已停止'}`,
            service: svc.name,
          });
        }
        this.previousServiceStatus.set(svc.name, svc.status);
      }
    } catch { }
  }

  private async checkActiveAgent() {
    try {
      const output = await WslService.execCommand(
        `cat ${appConfig.configJson} 2>/dev/null | python3 -c "import sys,json; c=json.load(sys.stdin); print(c.get('agents',{}).get('default',''))"`,
        5000
      );
      const currentAgent = output.trim();
      if (currentAgent && this.previousActiveAgent && currentAgent !== this.previousActiveAgent) {
        this.addNotification({
          type: 'agent_switch',
          title: 'Agent 切换',
          message: `活跃 Agent 从 ${this.previousActiveAgent} 切换为 ${currentAgent}`,
          agent: currentAgent,
        });
      }
      if (currentAgent) {
        this.previousActiveAgent = currentAgent;
      }
    } catch { }
  }

  getNotifications(limit: number = 50): Notification[] {
    if (this.notifications.length > 0) {
      return this.notifications.slice(0, limit);
    }
    try {
      const rows = dbService.getNotifications(limit);
      this.notifications = rows.map(r => ({
        id: r.id,
        type: r.type as Notification['type'],
        title: r.title,
        message: r.message,
        timestamp: r.timestamp,
        read: r.read === 1,
        agent: r.agent || undefined,
        service: r.service || undefined,
      }));
      return this.notifications.slice(0, limit);
    } catch {
      return [];
    }
  }

  getUnreadCount(): number {
    try {
      return dbService.getUnreadNotificationCount();
    } catch {
      return this.notifications.filter(n => !n.read).length;
    }
  }

  markAsRead(id: string): boolean {
    const n = this.notifications.find(n => n.id === id);
    if (n) { n.read = true; }
    try { dbService.markNotificationRead(id); } catch {}
    return true;
  }

  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    try { dbService.markAllNotificationsRead(); } catch {}
  }

  clearAll(): void {
    this.notifications = [];
    try { dbService.clearNotifications(); } catch {}
  }

  addManualNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Notification {
    return this.addNotification(notification);
  }
}

export const notificationManager = new NotificationManager();
