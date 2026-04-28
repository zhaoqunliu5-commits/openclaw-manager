import { dbService } from './dbService.js';
import { WslService } from './wslService.js';
import { appConfig } from '../config.js';

export interface WorkflowStep {
  id: number;
  name: string;
  type: 'command' | 'switch_agent' | 'wait' | 'condition';
  config: {
    command?: string;
    agent?: string;
    seconds?: number;
    condition?: string;
    expected_result?: string;
  };
  timeout?: number;
  retry?: number;
}

export interface AgentWorkflow {
  id: number;
  name: string;
  description: string | null;
  steps: WorkflowStep[];
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  agentId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TaskItem {
  id: number;
  workflowId: number | null;
  name: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputData: any;
  result: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface DbWorkflow {
  id: number;
  name: string;
  description: string | null;
  steps: string;
  current_step: number;
  status: string;
  agent_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface DbTask {
  id: number;
  workflow_id: number | null;
  name: string;
  priority: number;
  status: string;
  input_data: string | null;
  result: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const mapWorkflow = (row: DbWorkflow): AgentWorkflow => ({
  id: row.id, name: row.name, description: row.description,
  steps: JSON.parse(row.steps), currentStep: row.current_step,
  status: row.status as any, agentId: row.agent_id,
  createdAt: row.created_at, startedAt: row.started_at, completedAt: row.completed_at,
});

const mapTask = (row: DbTask): TaskItem => ({
  id: row.id, workflowId: row.workflow_id, name: row.name,
  priority: row.priority, status: row.status as any,
  inputData: row.input_data ? JSON.parse(row.input_data) : null,
  result: row.result, createdAt: row.created_at,
  startedAt: row.started_at, completedAt: row.completed_at,
});

class WorkflowService {
  private running = false;
  private processing = false;

  start() {
    if (this.running) return;
    this.running = true;
    this.processLoop();
  }

  stop() { this.running = false; }

  private async processLoop() {
    while (this.running) {
      if (!this.processing) {
        await this.processNextTask();
      }
      await this.sleep(2000);
    }
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async processNextTask() {
    this.processing = true;
    try {
      const task = this.getPendingTask();
      if (!task) { this.processing = false; return; }

      this.updateTask(task.id, { status: 'running', startedAt: new Date().toISOString() });

      try {
        let result = '';
        if (task.workflowId) {
          result = await this.executeWorkflow(task.workflowId, task.inputData);
        } else {
          result = await this.executeDirectTask(task.name, task.inputData);
        }
        this.updateTask(task.id, { status: 'completed', result, completedAt: new Date().toISOString() });
      } catch (err: any) {
        this.updateTask(task.id, { status: 'failed', result: err.message, completedAt: new Date().toISOString() });
      }
    } finally {
      this.processing = false;
    }
  }

  private getPendingTask(): TaskItem | null {
    const row = dbService.getDb().prepare(
      `SELECT * FROM task_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1`
    ).get() as DbTask | undefined;
    return row ? mapTask(row) : null;
  }

  private updateTask(id: number, updates: Partial<Pick<TaskItem, 'status' | 'result' | 'startedAt' | 'completedAt'>>) {
    const sets: string[] = [];
    const vals: any[] = [];
    if (updates.status) { sets.push('status = ?'); vals.push(updates.status); }
    if (updates.result !== undefined) { sets.push('result = ?'); vals.push(updates.result); }
    if (updates.startedAt) { sets.push('started_at = ?'); vals.push(updates.startedAt); }
    if (updates.completedAt) { sets.push('completed_at = ?'); vals.push(updates.completedAt); }
    if (!sets.length) return;
    vals.push(id);
    dbService.getDb().prepare(`UPDATE task_queue SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  private async executeWorkflow(workflowId: number, inputData?: any): Promise<string> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    dbService.getDb().prepare(
      `UPDATE agent_workflows SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(workflowId);

    let stepResults: Record<string, any> = { input: inputData };

    for (let i = workflow.currentStep; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      try {
        const result = await this.executeStep(step);
        stepResults[`step_${step.id}`] = result;
        this.updateWorkflowStep(workflowId, i + 1);
      } catch (err: any) {
        dbService.getDb().prepare(`UPDATE agent_workflows SET status = 'failed' WHERE id = ?`).run(workflowId);
        throw err;
      }
    }

    dbService.getDb().prepare(
      `UPDATE agent_workflows SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(workflowId);

    return JSON.stringify(stepResults);
  }

  private async executeStep(step: WorkflowStep): Promise<string> {
    const timeout = step.timeout || 30000;
    const retryCount = step.retry || 0;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        switch (step.type) {
          case 'command':
            if (!step.config.command) throw new Error('No command configured');
            return await WslService.execCommand(step.config.command, timeout);
          case 'switch_agent':
            if (!step.config.agent) throw new Error('No agent specified');
            await WslService.execCommand(`openclaw agent switch ${step.config.agent}`, timeout);
            return `Switched to ${step.config.agent}`;
          case 'wait':
            await this.sleep((step.config.seconds || 1) * 1000);
            return `Waited ${step.config.seconds}s`;
          case 'condition':
            if (step.config.command) {
              const result = await WslService.execCommand(step.config.command, timeout);
              if (step.config.expected_result && !result.includes(step.config.expected_result)) {
                throw new Error(`Condition failed: expected "${step.config.expected_result}", got "${result}"`);
              }
              return `Condition passed: ${result}`;
            }
            return 'Condition checked';
          default:
            return `Unknown step type: ${step.type}`;
        }
      } catch (err) {
        if (attempt === retryCount) throw err;
        await this.sleep(1000);
      }
    }
    return '';
  }

  private async executeDirectTask(name: string, inputData?: any): Promise<string> {
    if (name === 'agent_health_check') {
      const output = await WslService.execCommand('openclaw status 2>&1', 15000);
      return output.trim();
    }
    if (name === 'memory_cleanup') {
      const output = await WslService.execCommand(`rm -rf ${appConfig.openclawPath}/agents/*/memory/tmp 2>&1`, 10000);
      return output.trim() || 'Cleanup completed';
    }
    return `Task ${name} completed`;
  }

  private getWorkflow(id: number): AgentWorkflow | null {
    const row = dbService.getDb().prepare(`SELECT * FROM agent_workflows WHERE id = ?`).get(id) as DbWorkflow | undefined;
    return row ? mapWorkflow(row) : null;
  }

  private updateWorkflowStep(workflowId: number, step: number) {
    dbService.getDb().prepare(`UPDATE agent_workflows SET current_step = ? WHERE id = ?`).run(step, workflowId);
  }

  getWorkflows(): AgentWorkflow[] {
    const rows = dbService.getDb().prepare(`SELECT * FROM agent_workflows ORDER BY created_at DESC`).all() as DbWorkflow[];
    return rows.map(mapWorkflow);
  }

  createWorkflow(workflow: Omit<AgentWorkflow, 'id' | 'currentStep' | 'status' | 'createdAt' | 'startedAt' | 'completedAt'>): AgentWorkflow {
    const result = dbService.getDb().prepare(
      `INSERT INTO agent_workflows (name, description, steps, agent_id) VALUES (?, ?, ?, ?)`
    ).run(workflow.name, workflow.description || null, JSON.stringify(workflow.steps), workflow.agentId);
    return this.getWorkflow(Number(result.lastInsertRowid))!;
  }

  deleteWorkflow(id: number): boolean {
    const r = dbService.getDb().prepare(`DELETE FROM agent_workflows WHERE id = ?`).run(id);
    return r.changes > 0;
  }

  enqueueTask(task: { name: string; priority?: number; workflowId?: number; inputData?: any }): TaskItem {
    const result = dbService.getDb().prepare(
      `INSERT INTO task_queue (workflow_id, name, priority, input_data) VALUES (?, ?, ?, ?)`
    ).run(task.workflowId || null, task.name, task.priority || 0, task.inputData ? JSON.stringify(task.inputData) : null);
    const row = dbService.getDb().prepare(`SELECT * FROM task_queue WHERE id = ?`).get(Number(result.lastInsertRowid)) as DbTask;
    return mapTask(row);
  }

  getTasks(limit = 50): TaskItem[] {
    const rows = dbService.getDb().prepare(`SELECT * FROM task_queue ORDER BY priority DESC, created_at DESC LIMIT ?`).all(limit) as DbTask[];
    return rows.map(mapTask);
  }

  getActiveWorkflow(): AgentWorkflow | null {
    const row = dbService.getDb().prepare(`SELECT * FROM agent_workflows WHERE status = 'running' ORDER BY started_at DESC LIMIT 1`).get() as DbWorkflow | undefined;
    return row ? mapWorkflow(row) : null;
  }

  pauseWorkflow(id: number): boolean {
    const r = dbService.getDb().prepare(`UPDATE agent_workflows SET status = 'paused' WHERE id = ? AND status = 'running'`).run(id);
    return r.changes > 0;
  }

  resumeWorkflow(id: number): boolean {
    const r = dbService.getDb().prepare(`UPDATE agent_workflows SET status = 'running' WHERE id = ? AND status = 'paused'`).run(id);
    return r.changes > 0;
  }
}

export const workflowService = new WorkflowService();