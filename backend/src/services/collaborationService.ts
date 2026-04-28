import { WslService } from './wslService.js';
import { appConfig } from '../config.js';
import { DataCache } from './dataCache.js';
import { getErrorMessage } from '../middleware/errorHandler.js';

export interface AgentBinding {
  agent: string;
  channel: string;
  accountId?: string;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: string;
  channel?: string;
  sessionId?: string;
}

export interface AgentTask {
  id: string;
  fromAgent: string;
  toAgent: string;
  message: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  status: 'idle' | 'running' | 'completed' | 'failed';
  currentStep: number;
  createdAt: string;
}

export interface WorkflowStep {
  agent: string;
  message: string;
  waitForReply: boolean;
  deliverTo?: string;
  deliverChannel?: string;
}

class CollaborationService {
  async getBindings(): Promise<AgentBinding[]> {
    return DataCache.getOrFetch('collab-bindings', async () => {
      try {
      const output = await WslService.execCommand('openclaw agents bindings --json 2>/dev/null', 10000);
      try {
        const data = JSON.parse(output.trim());
        if (Array.isArray(data)) return data;
      } catch { }
      return this.parseBindingsText(output);
    } catch {
      return [];
    }
    }, 120000);
  }

  private parseBindingsText(text: string): AgentBinding[] {
    const bindings: AgentBinding[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.match(/(\S+)\s+→\s+(\S+)(?::(\S+))?/);
      if (match) {
        bindings.push({ agent: match[1], channel: match[2], accountId: match[3] });
      }
    }
    return bindings;
  }

  async addBinding(agent: string, binding: string): Promise<{ success: boolean; message: string }> {
    try {
      const output = await WslService.execCommand(
        `openclaw agents bind --agent ${agent} --bind ${binding} --json 2>&1`,
        15000
      );
      return { success: true, message: output.trim() };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error) };
    }
  }

  async removeBinding(agent: string, binding: string): Promise<{ success: boolean; message: string }> {
    try {
      const output = await WslService.execCommand(
        `openclaw agents unbind --agent ${agent} --bind ${binding} --json 2>&1`,
        15000
      );
      return { success: true, message: output.trim() };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error) };
    }
  }

  async sendAgentMessage(
    fromAgent: string,
    toAgent: string,
    message: string,
    options?: { channel?: string; deliver?: boolean; sessionId?: string }
  ): Promise<{ success: boolean; message: string; result?: any }> {
    try {
      let cmd = `openclaw agent --agent ${toAgent} --message ${JSON.stringify(message)} --json`;
      if (options?.sessionId) cmd += ` --session-id ${options.sessionId}`;
      if (options?.deliver) cmd += ' --deliver';
      if (options?.channel) cmd += ` --reply-channel ${options.channel}`;
      const output = await WslService.execCommand(cmd, 120000);
      try {
        const result = JSON.parse(output.trim());
        return { success: true, message: '消息已发送', result };
      } catch {
        return { success: true, message: output.trim() };
      }
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error) };
    }
  }

  async broadcastMessage(
    message: string,
    targets: string[],
    channel?: string
  ): Promise<{ success: boolean; message: string; results?: any[] }> {
    try {
      const targetArgs = targets.map(t => `--target ${t}`).join(' ');
      let cmd = `openclaw message broadcast ${targetArgs} --message ${JSON.stringify(message)} --json`;
      if (channel) cmd += ` --channel ${channel}`;
      const output = await WslService.execCommand(cmd, 60000);
      try {
        const results = JSON.parse(output.trim());
        return { success: true, message: '广播已发送', results: Array.isArray(results) ? results : [results] };
      } catch {
        return { success: true, message: output.trim() };
      }
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error) };
    }
  }

  async getRecentMessages(agent: string, limit: number = 20): Promise<AgentMessage[]> {
    try {
      const sessionsDir = appConfig.getAgentSessionsDir(agent);
      const output = await WslService.execCommand(
        `ls -t ${sessionsDir}/ 2>/dev/null | head -5`,
        5000
      );
      const sessionDirs = output.trim().split('\n').filter(Boolean);
      const messages: AgentMessage[] = [];

      for (const dir of sessionDirs.slice(0, 3)) {
        try {
          const logOutput = await WslService.execCommand(
            `cat ${sessionsDir}/${dir}/transcript.jsonl 2>/dev/null | tail -${limit}`,
            10000
          );
          const lines = logOutput.trim().split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (entry.role === 'user' || entry.role === 'assistant') {
                messages.push({
                  id: `${dir}_${messages.length}`,
                  from: entry.role === 'user' ? 'user' : agent,
                  to: entry.role === 'user' ? agent : 'user',
                  message: (entry.content || '').substring(0, 200),
                  timestamp: entry.timestamp || dir,
                  sessionId: dir,
                });
              }
            } catch { }
          }
        } catch { }
      }
      return messages.slice(0, limit);
    } catch {
      return [];
    }
  }

  async executeWorkflow(workflow: Omit<AgentWorkflow, 'id' | 'status' | 'currentStep' | 'createdAt'>): Promise<AgentWorkflow> {
    const wf: AgentWorkflow = {
      ...workflow,
      id: `wf_${Date.now()}`,
      status: 'running',
      currentStep: 0,
      createdAt: new Date().toISOString(),
    };

    for (let i = 0; i < wf.steps.length; i++) {
      wf.currentStep = i;
      const step = wf.steps[i];
      const result = await this.sendAgentMessage(
        i === 0 ? 'orchestrator' : wf.steps[i - 1].agent,
        step.agent,
        step.message,
        { deliver: !!step.deliverTo, channel: step.deliverChannel }
      );

      if (!result.success) {
        wf.status = 'failed';
        return wf;
      }

      if (step.deliverTo && step.waitForReply) {
        // In a real implementation, we'd wait for the reply
      }
    }

    wf.status = 'completed';
    wf.currentStep = wf.steps.length;
    return wf;
  }

  async getAgentList(): Promise<string[]> {
    return DataCache.getOrFetch('collab-agents', async () => {
      try {
        const output = await WslService.execCommand('openclaw agents list --json 2>/dev/null', 10000);
        try {
          const data = JSON.parse(output.trim());
          if (Array.isArray(data) && data.length > 0) {
            return data.map((a: any) => a.id || a.name || a);
          }
        } catch { }
        const textLines = output.trim().split('\n').filter(l => l.trim() && !l.includes('🦞'));
        if (textLines.length > 0) return textLines;
      } catch { }

      try {
        const configJson = await WslService.readFile(appConfig.configJson);
        const config = JSON.parse(configJson);
        const agentList = config?.agents?.list;
        if (Array.isArray(agentList) && agentList.length > 0) {
          return agentList.map((a: any) => a.id || a.name || a);
        }
      } catch { }

      try {
        const dirs = await WslService.listDirectory(appConfig.agentsDir);
        const agentDirs = dirs.filter(d => !d.startsWith('.'));
        if (agentDirs.length > 0) return agentDirs;
      } catch { }

      return [];
    }, 120000);
  }
}

export const collaborationService = new CollaborationService();
