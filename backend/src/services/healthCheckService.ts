import { EventEmitter } from 'events';
import { OpenclawService } from './openclawService.js';
import { notificationManager } from './notificationService.js';
import { DataCache } from './dataCache.js';
import { dbService } from './dbService.js';
import type { ServiceStatus } from '../types/index.js';

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  autoRecover: boolean;
  maxRestartAttempts: number;
  restartCooldownMs: number;
  services: {
    name: string;
    enabled: boolean;
  }[];
}

export interface HealthCheckResult {
  serviceName: string;
  healthy: boolean;
  lastCheck: string;
  consecutiveFailures: number;
  lastFailure: string | null;
  lastRecovery: string | null;
  recoveryAttempts: number;
  status: 'healthy' | 'degraded' | 'down' | 'recovering' | 'disabled';
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  enabled: true,
  intervalMs: 30000,
  autoRecover: true,
  maxRestartAttempts: 3,
  restartCooldownMs: 300000,
  services: [
    { name: 'openclaw-gateway', enabled: true },
    { name: 'canvas', enabled: true },
  ],
};

class HealthCheckManager extends EventEmitter {
  private config: HealthCheckConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private results: Map<string, HealthCheckResult> = new Map();
  private restartTimestamps: Map<string, number> = new Map();
  private isChecking = false;

  constructor() {
    super();
    this.config = { ...DEFAULT_CONFIG };
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const row = dbService.getDb().prepare('SELECT config_json FROM health_check_config WHERE id = 1').get() as { config_json: string } | undefined;
      if (row?.config_json) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(row.config_json) };
      }
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  private saveConfig() {
    try {
      dbService.getDb().prepare(
        'INSERT OR REPLACE INTO health_check_config (id, config_json, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)'
      ).run(JSON.stringify(this.config));
    } catch {}
  }

  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<HealthCheckConfig>): HealthCheckConfig {
    if (partial.intervalMs !== undefined) {
      this.config.intervalMs = Math.max(10000, partial.intervalMs);
    }
    if (partial.enabled !== undefined) {
      this.config.enabled = partial.enabled;
    }
    if (partial.autoRecover !== undefined) {
      this.config.autoRecover = partial.autoRecover;
    }
    if (partial.maxRestartAttempts !== undefined) {
      this.config.maxRestartAttempts = Math.max(1, Math.min(10, partial.maxRestartAttempts));
    }
    if (partial.restartCooldownMs !== undefined) {
      this.config.restartCooldownMs = Math.max(60000, partial.restartCooldownMs);
    }
    if (partial.services !== undefined) {
      this.config.services = partial.services;
    }
    this.saveConfig();
    if (this.intervalId) {
      this.stop();
      this.start();
    }
    return this.getConfig();
  }

  start() {
    if (this.intervalId) return;
    if (!this.config.enabled) {
      console.log('[HealthCheck] 健康检查已禁用');
      return;
    }
    console.log(`[HealthCheck] 启动健康检查，间隔 ${this.config.intervalMs / 1000}s，自动恢复: ${this.config.autoRecover ? '开启' : '关闭'}`);
    this.runCheck();
    this.intervalId = setInterval(() => this.runCheck(), this.config.intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[HealthCheck] 健康检查已停止');
  }

  async runCheck(): Promise<HealthCheckResult[]> {
    if (this.isChecking) return [];
    this.isChecking = true;

    try {
      const services = await OpenclawService.getServicesStatus();
      const results: HealthCheckResult[] = [];

      for (const service of services) {
        const svcConfig = this.config.services.find(s => s.name === service.name);
        if (!svcConfig || !svcConfig.enabled) {
          const existing = this.results.get(service.name);
          results.push(existing || {
            serviceName: service.name,
            healthy: true,
            lastCheck: new Date().toISOString(),
            consecutiveFailures: 0,
            lastFailure: null,
            lastRecovery: null,
            recoveryAttempts: 0,
            status: 'disabled',
          });
          continue;
        }

        const result = await this.checkService(service);
        this.results.set(service.name, result);
        results.push(result);

        if (!result.healthy && this.config.autoRecover) {
          await this.attemptRecovery(service, result);
        }
      }

      DataCache.invalidate('services');
      DataCache.invalidate('overview');
      this.emit('check-complete', results);
      return results;
    } finally {
      this.isChecking = false;
    }
  }

  private async checkService(service: ServiceStatus): Promise<HealthCheckResult> {
    const prev = this.results.get(service.name);
    const now = new Date().toISOString();
    const wasHealthy = prev?.healthy ?? true;

    if (service.isRunning) {
      const result: HealthCheckResult = {
        serviceName: service.name,
        healthy: true,
        lastCheck: now,
        consecutiveFailures: 0,
        lastFailure: prev?.lastFailure ?? null,
        lastRecovery: prev?.lastRecovery ?? null,
        recoveryAttempts: 0,
        status: 'healthy',
      };

      if (!wasHealthy && prev) {
        result.lastRecovery = now;
        notificationManager.addManualNotification({
          type: 'service_status',
          title: '服务已恢复',
          message: `${service.name} 已自动恢复正常运行`,
          service: service.name,
        });
        console.log(`[HealthCheck] ✅ ${service.name} 已恢复`);
      }

      return result;
    }

    const consecutiveFailures = (prev?.consecutiveFailures ?? 0) + 1;
    const result: HealthCheckResult = {
      serviceName: service.name,
      healthy: false,
      lastCheck: now,
      consecutiveFailures,
      lastFailure: now,
      lastRecovery: prev?.lastRecovery ?? null,
      recoveryAttempts: prev?.recoveryAttempts ?? 0,
      status: consecutiveFailures >= 3 ? 'down' : 'degraded',
    };

    if (wasHealthy) {
      notificationManager.addManualNotification({
        type: 'error',
        title: '服务异常停止',
        message: `${service.name} 已停止运行${this.config.autoRecover ? '，正在尝试自动恢复...' : ''}`,
        service: service.name,
      });
      console.log(`[HealthCheck] ❌ ${service.name} 已停止 (连续失败 ${consecutiveFailures} 次)`);
    }

    return result;
  }

  private async attemptRecovery(service: ServiceStatus, result: HealthCheckResult): Promise<void> {
    const now = Date.now();
    const lastRestart = this.restartTimestamps.get(service.name) ?? 0;
    if (now - lastRestart < this.config.restartCooldownMs) {
      console.log(`[HealthCheck] ${service.name} 在冷却期内，跳过自动恢复`);
      return;
    }

    if (result.recoveryAttempts >= this.config.maxRestartAttempts) {
      if (result.recoveryAttempts === this.config.maxRestartAttempts) {
        notificationManager.addManualNotification({
          type: 'error',
          title: '自动恢复失败',
          message: `${service.name} 已达最大重试次数 (${this.config.maxRestartAttempts})，请手动处理`,
          service: service.name,
        });
        console.log(`[HealthCheck] ⛔ ${service.name} 已达最大重试次数`);
      }
      return;
    }

    result.recoveryAttempts++;
    result.status = 'recovering';
    this.restartTimestamps.set(service.name, now);

    console.log(`[HealthCheck] 🔄 尝试自动恢复 ${service.name} (第 ${result.recoveryAttempts} 次)...`);
    notificationManager.addManualNotification({
      type: 'warning',
      title: '正在自动恢复',
      message: `${service.name} 尝试自动重启 (第 ${result.recoveryAttempts}/${this.config.maxRestartAttempts} 次)`,
      service: service.name,
    });

    try {
      const restartResult = await OpenclawService.startService(service.name);
      if (restartResult.success) {
        console.log(`[HealthCheck] ✅ ${service.name} 自动恢复成功`);
      } else {
        console.log(`[HealthCheck] ❌ ${service.name} 自动恢复失败: ${restartResult.message}`);
      }
    } catch (err) {
      console.error(`[HealthCheck] ❌ ${service.name} 自动恢复异常:`, err);
    }
  }

  getResults(): HealthCheckResult[] {
    return Array.from(this.results.values());
  }

  getResult(serviceName: string): HealthCheckResult | undefined {
    return this.results.get(serviceName);
  }

  resetRecoveryAttempts(serviceName: string) {
    const result = this.results.get(serviceName);
    if (result) {
      result.recoveryAttempts = 0;
      result.status = result.healthy ? 'healthy' : 'down';
    }
    this.restartTimestamps.delete(serviceName);
  }
}

export const healthCheckManager = new HealthCheckManager();
