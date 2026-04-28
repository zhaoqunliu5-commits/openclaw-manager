import { WslService } from './wslService.js';
import { dbService } from './dbService.js';
import { notificationManager } from './notificationService.js';
import { getErrorMessage } from '../middleware/errorHandler.js';

export interface AutomationRule {
  id: number;
  name: string;
  enabled: boolean;
  triggerType: 'cron' | 'event' | 'webhook';
  triggerConfig: string;
  actionType: 'command' | 'notify' | 'switch_agent' | 'restart_service';
  actionConfig: string;
  lastTriggered: string | null;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLog {
  id: number;
  ruleId: number;
  ruleName: string;
  triggerType: string;
  actionType: string;
  status: 'running' | 'success' | 'failed';
  result: string | null;
  startedAt: string;
  completedAt: string | null;
}

class AutomationService {
  private timers: Map<number, ReturnType<typeof setInterval>> = new Map();
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    this.loadAndScheduleAll();
  }

  stop() {
    for (const [id, timer] of this.timers) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.started = false;
  }

  private loadAndScheduleAll() {
    const rules = this.getRules().filter(r => r.enabled);
    for (const rule of rules) {
      if (rule.triggerType === 'cron') {
        this.scheduleCron(rule);
      }
    }
  }

  private scheduleCron(rule: AutomationRule) {
    const intervalMs = this.parseCronToMs(rule.triggerConfig);
    if (intervalMs <= 0) return;

    const timer = setInterval(() => {
      this.executeRule(rule.id);
    }, intervalMs);

    this.timers.set(rule.id, timer);
  }

  private parseCronToMs(config: string): number {
    try {
      const parsed = JSON.parse(config);
      const minutes = parsed.intervalMinutes;
      if (minutes && minutes > 0) return minutes * 60 * 1000;
      const seconds = parsed.intervalSeconds;
      if (seconds && seconds > 0) return seconds * 1000;
    } catch {}
    return 0;
  }

  async executeRule(ruleId: number): Promise<{ success: boolean; result: string }> {
    const rule = this.getRuleById(ruleId);
    if (!rule || !rule.enabled) {
      return { success: false, result: '规则不存在或已禁用' };
    }

    const logId = this.createLog(rule);

    try {
      let result: string;

      switch (rule.actionType) {
        case 'command':
          result = await this.executeCommand(rule.actionConfig);
          break;
        case 'notify':
          result = await this.executeNotify(rule.actionConfig);
          break;
        case 'switch_agent':
          result = await this.executeSwitchAgent(rule.actionConfig);
          break;
        case 'restart_service':
          result = await this.executeRestartService(rule.actionConfig);
          break;
        default:
          result = `未知动作类型: ${rule.actionType}`;
      }

      this.updateLog(logId, 'success', result);
      this.updateRuleTrigger(ruleId);
      return { success: true, result };
    } catch (error: unknown) {
      const errMsg = getErrorMessage(error);
      this.updateLog(logId, 'failed', errMsg);
      return { success: false, result: errMsg };
    }
  }

  private async executeCommand(config: string): Promise<string> {
    const parsed = JSON.parse(config);
    const output = await WslService.execCommand(parsed.command, parsed.timeout || 30000);
    return output.substring(0, 500);
  }

  private async executeNotify(config: string): Promise<string> {
    const parsed = JSON.parse(config);
    notificationManager.addManualNotification({
      type: parsed.type || 'info',
      title: parsed.title || '自动化通知',
      message: parsed.message || '',
    });
    return '通知已发送';
  }

  private async executeSwitchAgent(config: string): Promise<string> {
    const parsed = JSON.parse(config);
    const { appConfig } = await import('../config.js');
    const output = await WslService.execCommand(
      `python3 -c "import json; f=open('${appConfig.configJson}','r'); c=json.load(f); f.close(); c.setdefault('agents',{})['default']='${parsed.agent}'; f=open('${appConfig.configJson}','w'); json.dump(c,f,indent=2); f.close(); print('ok')"`,
      10000
    );
    if (output.trim() === 'ok') return `已切换到 Agent: ${parsed.agent}`;
    return output.trim();
  }

  private async executeRestartService(config: string): Promise<string> {
    const parsed = JSON.parse(config);
    const output = await WslService.execCommand(
      `systemctl --user restart ${parsed.service} 2>&1`,
      15000
    );
    return output.trim() || `${parsed.service} 已重启`;
  }

  getRules(): AutomationRule[] {
    const rows = dbService.getDb().prepare(
      `SELECT * FROM automation_rules ORDER BY created_at DESC`
    ).all() as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled === 1,
      triggerType: r.trigger_type,
      triggerConfig: r.trigger_config,
      actionType: r.action_type,
      actionConfig: r.action_config,
      lastTriggered: r.last_triggered,
      triggerCount: r.trigger_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  getRuleById(id: number): AutomationRule | null {
    const row = dbService.getDb().prepare(
      `SELECT * FROM automation_rules WHERE id = ?`
    ).get(id) as any;
    if (!row) return null;
    return {
      id: row.id, name: row.name, enabled: row.enabled === 1,
      triggerType: row.trigger_type, triggerConfig: row.trigger_config,
      actionType: row.action_type, actionConfig: row.action_config,
      lastTriggered: row.last_triggered, triggerCount: row.trigger_count,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  createRule(rule: Omit<AutomationRule, 'id' | 'lastTriggered' | 'triggerCount' | 'createdAt' | 'updatedAt'>): AutomationRule {
    const result = dbService.getDb().prepare(
      `INSERT INTO automation_rules (name, enabled, trigger_type, trigger_config, action_type, action_config) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(rule.name, rule.enabled ? 1 : 0, rule.triggerType, rule.triggerConfig, rule.actionType, rule.actionConfig);

    const id = Number(result.lastInsertRowid);
    const newRule = this.getRuleById(id)!;

    if (rule.enabled && rule.triggerType === 'cron') {
      this.scheduleCron(newRule);
    }

    return newRule;
  }

  updateRule(id: number, updates: Partial<Pick<AutomationRule, 'name' | 'enabled' | 'triggerConfig' | 'actionConfig'>>): AutomationRule | null {
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.enabled !== undefined) { sets.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
    if (updates.triggerConfig !== undefined) { sets.push('trigger_config = ?'); values.push(updates.triggerConfig); }
    if (updates.actionConfig !== undefined) { sets.push('action_config = ?'); values.push(updates.actionConfig); }

    if (sets.length === 0) return this.getRuleById(id);

    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    dbService.getDb().prepare(
      `UPDATE automation_rules SET ${sets.join(', ')} WHERE id = ?`
    ).run(...values);

    if (this.timers.has(id)) {
      clearInterval(this.timers.get(id)!);
      this.timers.delete(id);
    }

    const updated = this.getRuleById(id);
    if (updated && updated.enabled && updated.triggerType === 'cron') {
      this.scheduleCron(updated);
    }

    return updated;
  }

  deleteRule(id: number): boolean {
    if (this.timers.has(id)) {
      clearInterval(this.timers.get(id)!);
      this.timers.delete(id);
    }
    dbService.getDb().prepare(`DELETE FROM automation_logs WHERE rule_id = ?`).run(id);
    const result = dbService.getDb().prepare(`DELETE FROM automation_rules WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  getStats() {
    const rules = this.getRules();
    const logs = this.getLogs(undefined, 1000);
    const totalRules = rules.length;
    const activeRules = rules.filter(r => r.enabled).length;
    const totalExecutions = logs.length;
    const successCount = logs.filter(l => l.status === 'success').length;
    const failedCount = logs.filter(l => l.status === 'failed').length;
    const runningCount = logs.filter(l => l.status === 'running').length;
    const triggerTypes: Record<string, number> = {};
    const actionTypes: Record<string, number> = {};
    for (const r of rules) {
      triggerTypes[r.triggerType] = (triggerTypes[r.triggerType] || 0) + 1;
      actionTypes[r.actionType] = (actionTypes[r.actionType] || 0) + 1;
    }
    return {
      total: totalRules,
      active: activeRules,
      inactive: totalRules - activeRules,
      totalExecutions,
      successCount,
      failedCount,
      runningCount,
      successRate: totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0,
      triggerTypes,
      actionTypes,
      recentLogs: logs.slice(0, 10),
    };
  }

  getLogs(ruleId?: number, limit: number = 50): AutomationLog[] {
    const query = ruleId
      ? `SELECT * FROM automation_logs WHERE rule_id = ? ORDER BY started_at DESC LIMIT ?`
      : `SELECT * FROM automation_logs ORDER BY started_at DESC LIMIT ?`;
    const params = ruleId ? [ruleId, limit] : [limit];
    const rows = dbService.getDb().prepare(query).all(...params) as any[];
    return rows.map(r => ({
      id: r.id, ruleId: r.rule_id, ruleName: r.rule_name,
      triggerType: r.trigger_type, actionType: r.action_type,
      status: r.status, result: r.result,
      startedAt: r.started_at, completedAt: r.completed_at,
    }));
  }

  private createLog(rule: AutomationRule): number {
    const result = dbService.getDb().prepare(
      `INSERT INTO automation_logs (rule_id, rule_name, trigger_type, action_type, status) VALUES (?, ?, ?, ?, 'running')`
    ).run(rule.id, rule.name, rule.triggerType, rule.actionType);
    return Number(result.lastInsertRowid);
  }

  private updateLog(logId: number, status: 'success' | 'failed', result: string): void {
    dbService.getDb().prepare(
      `UPDATE automation_logs SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(status, result, logId);
  }

  private updateRuleTrigger(ruleId: number): void {
    dbService.getDb().prepare(
      `UPDATE automation_rules SET last_triggered = CURRENT_TIMESTAMP, trigger_count = trigger_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(ruleId);
  }

  triggerEvent(eventType: string, eventData?: any): void {
    const rules = this.getRules().filter(
      r => r.enabled && r.triggerType === 'event'
    );

    for (const rule of rules) {
      try {
        const config = JSON.parse(rule.triggerConfig);
        if (config.event === eventType) {
          this.executeRule(rule.id);
        }
      } catch {}
    }
  }
}

export const automationService = new AutomationService();
