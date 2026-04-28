import { WslService } from './wslService.js';
import { appConfig } from '../config.js';
import { DataCache } from './dataCache.js';
import { ServiceStatus, OverviewData, ConfigData, LogEntry, OpenClawConfig, AgentInfo, SkillInfo, WorkspaceInfo } from '../types/index.js';

const OPENCLAW_PATH = appConfig.openclawPath;
const OPENCLAW_WORKSPACES_PATH = appConfig.workspacesPath;

const SERVICES = [
  { name: 'openclaw-gateway', processPattern: 'openclaw.*gateway', systemdService: 'openclaw-gateway.service', port: 18789 },
  { name: 'canvas', processPattern: 'canvas/srv.js', systemdService: 'openclaw-canvas.service', port: 18796 }
];

export class OpenclawService {
  static async getServicesStatus(): Promise<ServiceStatus[]> {
    return DataCache.getOrFetch('services', async () => {
      const services: ServiceStatus[] = [];
      for (const service of SERVICES) {
        const status = await WslService.isProcessRunning(service.processPattern);
        services.push({
          name: service.name,
          isRunning: status.isRunning,
          pid: status.pid,
          memory: status.memory,
          uptime: status.uptime,
          url: `http://127.0.0.1:${service.port}`,
        });
      }
      return services;
    }, 120000);
  }

  static async startService(serviceName: string): Promise<{ success: boolean; message: string }> {
    DataCache.invalidate('services');
    DataCache.invalidate('overview');
    DataCache.invalidate('monitor-');
    try {
      const service = SERVICES.find(s => s.name === serviceName);
      if (!service) {
        return { success: false, message: `Unknown service: ${serviceName}` };
      }

      if (serviceName === 'openclaw-gateway') {
        await WslService.execCommand(`systemctl --user start ${service.systemdService}`);
      } else if (serviceName === 'canvas') {
        try {
          await WslService.execCommand(`systemctl --user start ${service.systemdService}`);
        } catch {
          try {
            await WslService.execDaemon(`node ${OPENCLAW_PATH}/canvas/srv.js`);
          } catch { /* ignore */ }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      const status = await WslService.isProcessRunning(service.processPattern);
      if (status.isRunning) {
        return { success: true, message: `${serviceName} started successfully` };
      } else {
        return { success: false, message: `${serviceName} failed to start �?process not detected after 3s` };
      }
    } catch (error: any) {
      return { success: false, message: `Failed to start ${serviceName}: ${error.message}` };
    }
  }

  static async stopService(serviceName: string): Promise<{ success: boolean; message: string }> {
    DataCache.invalidate('services');
    DataCache.invalidate('overview');
    DataCache.invalidate('monitor-');
    try {
      const service = SERVICES.find(s => s.name === serviceName);
      if (!service) {
        return { success: false, message: `Unknown service: ${serviceName}` };
      }

      if (serviceName === 'openclaw-gateway') {
        await WslService.execCommand(`systemctl --user stop ${service.systemdService}`);
      } else if (serviceName === 'canvas') {
        try {
          await WslService.execCommand(`systemctl --user stop ${service.systemdService}`);
        } catch {
          await WslService.killProcess(service.processPattern);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const status = await WslService.isProcessRunning(service.processPattern);
      if (!status.isRunning) {
        return { success: true, message: `${serviceName} stopped successfully` };
      } else {
        return { success: false, message: `${serviceName} failed to stop �?process still running` };
      }
    } catch (error: any) {
      return { success: false, message: `Failed to stop ${serviceName}: ${error.message}` };
    }
  }

  static async restartService(serviceName: string): Promise<{ success: boolean; message: string }> {
    await this.stopService(serviceName);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.startService(serviceName);
  }

  static async getOverview(): Promise<OverviewData> {
    return DataCache.getOrFetch('overview', async () => {
      const agentsList = await WslService.listDirectory(`${OPENCLAW_PATH}/agents`);
      const agentCount = agentsList.filter(name => !name.startsWith('.')).length;

      const skillsList = await WslService.listDirectory(`${OPENCLAW_PATH}/skills`);
      const skillCount = skillsList.filter(name => !name.startsWith('.') && !name.endsWith('.html')).length;

      const workspacesList = await WslService.listDirectory(OPENCLAW_WORKSPACES_PATH);
      const workspaceCount = workspacesList.filter(name => !name.startsWith('.')).length;

      const services = await this.getServicesStatus();
      const runningServiceCount = services.filter(s => s.isRunning).length;

      return { agentCount, skillCount, workspaceCount, runningServiceCount };
    }, 120000);
  }

  static async getConfig(): Promise<ConfigData> {
    return DataCache.getOrFetch('config', async () => {
      const configContent = await WslService.readFile(`${OPENCLAW_PATH}/openclaw.json`);
      if (!configContent.trim()) {
        return { gatewayPort: 0, gatewayMode: '', authMode: '', enabledPlugins: [], enabledChannels: [] };
      }

      const config: OpenClawConfig = JSON.parse(configContent);

      const enabledPlugins: string[] = [];
      if (config.plugins?.entries) {
        for (const [name, pluginConfig] of Object.entries(config.plugins.entries)) {
          if (pluginConfig.enabled) {
            enabledPlugins.push(name);
          }
        }
      }

      const enabledChannels: string[] = [];
      if (config.channels) {
        for (const [name, channelConfig] of Object.entries(config.channels)) {
          if (channelConfig.enabled) {
            enabledChannels.push(name);
          }
        }
      }

      return {
        gatewayPort: config.gateway?.port || 0,
        gatewayMode: config.gateway?.mode || '',
        authMode: config.gateway?.auth?.mode || '',
        enabledPlugins,
        enabledChannels
      };
    }, 120000);
  }

  static async getLogs(): Promise<LogEntry[]> {
    return [];
  }

  static async getAgents(): Promise<AgentInfo[]> {
    return DataCache.getOrFetch('agents', async () => {
      try {
      const agents: AgentInfo[] = [];
      const agentDirs = await WslService.listDirectory(`${OPENCLAW_PATH}/agents`);

      let defaultAgent = 'main';
      try {
        const configJson = await WslService.readFile(`${OPENCLAW_PATH}/openclaw.json`);
        const config = JSON.parse(configJson);
        const agentList = config?.agents?.list;
        if (Array.isArray(agentList)) {
          const explicit = agentList.find((a: any) => a.default === true);
          if (explicit) {
            defaultAgent = explicit.id;
          } else {
            defaultAgent = agentList[0]?.id || 'main';
          }
        }
      } catch { /* ignore */ }

      const agentData: Record<string, { name: string; emoji: string; model: string; isDefault: boolean }> = {};
      try {
        const listOutput = await WslService.execCommand('openclaw agents list --json 2>/dev/null', 30000);
        const listData = JSON.parse(listOutput);
        if (Array.isArray(listData)) {
          for (const a of listData) {
            agentData[a.id] = {
              name: a.identityName || a.name || '',
              emoji: a.identityEmoji || '',
              model: a.model || '',
              isDefault: a.isDefault === true,
            };
          }
        }
      } catch { /* ignore */ }

      for (const dir of agentDirs) {
        if (dir.startsWith('.')) continue;

        const isDefault = agentData[dir]?.isDefault || dir === defaultAgent;
        const identity = agentData[dir]?.name || '';
        const emoji = agentData[dir]?.emoji || '';
        const model = agentData[dir]?.model || '';

        agents.push({
          id: dir,
          name: agentData[dir]?.name || dir,
          isDefault,
          model,
          workspace: `${OPENCLAW_PATH}/agents/${dir}`,
          identity,
          sessionCount: 0,
          heartbeatEnabled: false,
          emoji,
        });
      }

      return agents;
    } catch {
      return [];
    }
    }, 120000);
  }

  static async getSkills(): Promise<SkillInfo[]> {
    return DataCache.getOrFetch('skills', async () => {
      try {
      const skills: SkillInfo[] = [];
      const skillDirs = await WslService.listDirectory(`${OPENCLAW_PATH}/skills`);

      for (const dir of skillDirs) {
        if (dir.startsWith('.') || dir.endsWith('.html')) continue;
        let description = '';
        let emoji = '';
        let status: 'ready' | 'needs-setup' | 'disabled' = 'ready';
        let primaryEnv = '';
        let source = 'local';

        try {
          const skillMd = await WslService.readFile(`${OPENCLAW_PATH}/skills/${dir}/SKILL.md`);
          const descMatch = skillMd.match(/description:\s*["'](.+?)["']/);
          if (descMatch) description = descMatch[1];
          const emojiMatch = skillMd.match(/"emoji":\s*["'](.+?)["']/);
          if (emojiMatch) emoji = emojiMatch[1];
          const envMatch = skillMd.match(/primaryEnv:\s*["'](.+?)["']/);
          if (envMatch) primaryEnv = envMatch[1];
          if (skillMd.includes('needs-setup') || skillMd.includes('needs_setup')) {
            status = 'needs-setup';
          }
        } catch { /* ignore */ }

        try {
          const configJson = await WslService.readFile(`${OPENCLAW_PATH}/skills/${dir}/skill.json`);
          const config = JSON.parse(configJson);
          if (config.description) description = config.description;
          if (config.emoji) emoji = config.emoji;
          if (config.status) status = config.status;
          if (config.source) source = config.source;
          if (config.primaryEnv) primaryEnv = config.primaryEnv;
        } catch { /* ignore */ }

        skills.push({
          id: dir,
          name: dir,
          description: description || dir,
          emoji: emoji || undefined,
          status,
          primaryEnv: primaryEnv || undefined,
          source,
        });
      }

      return skills;
    } catch {
      return [];
    }
    }, 120000);
  }

  static async getWorkspaces(): Promise<WorkspaceInfo[]> {
    return DataCache.getOrFetch('workspaces', async () => {
      try {
      const workspaces: WorkspaceInfo[] = [];
      const dirs = await WslService.listDirectory(OPENCLAW_WORKSPACES_PATH);

      let defaultAgent = 'main';
      try {
        const configJson = await WslService.readFile(`${OPENCLAW_PATH}/openclaw.json`);
        const config = JSON.parse(configJson);
        defaultAgent = config?.gateway?.defaultAgent || 'main';
      } catch { /* ignore */ }

      for (const dir of dirs) {
        if (dir.startsWith('.')) continue;
        let lastModified = '';
        let agentId: string | undefined;

        try {
          const statOutput = await WslService.execCommand(`stat -c '%Y' "${OPENCLAW_WORKSPACES_PATH}/${dir}" 2>/dev/null`);
          if (statOutput.trim()) {
            lastModified = new Date(parseInt(statOutput.trim()) * 1000).toISOString();
          }
        } catch { /* ignore */ }

        const agentDirs = await WslService.listDirectory(`${OPENCLAW_PATH}/agents`);
        for (const agentDir of agentDirs) {
          try {
            const modelsJson = await WslService.readFile(`${OPENCLAW_PATH}/agents/${agentDir}/agent/models.json`);
            if (modelsJson.includes(dir)) {
              agentId = agentDir;
              break;
            }
          } catch { /* ignore */ }
        }

        workspaces.push({
          id: dir,
          name: dir,
          path: `${OPENCLAW_WORKSPACES_PATH}/${dir}`,
          agentId,
          lastModified,
        });
      }

      return workspaces;
    } catch {
      return [];
    }
    }, 120000);
  }

  static async switchAgent(agentId: string): Promise<{ success: boolean; message: string }> {
    DataCache.invalidate('agents');
    DataCache.invalidate('overview');
    try {
      const scriptPath = '/mnt/d/AI/github氛围编程/my-first-project/hot_switch.py';
      const output = await WslService.execCommand(
        `python3 ${scriptPath} ${agentId} 2>&1`,
        60000
      );

      if (output.includes('not found in config')) {
        return { success: false, message: `Agent '${agentId}' not found` };
      }

      return { success: true, message: output.trim() || `Switched to agent: ${agentId}` };
    } catch (error: any) {
      return { success: false, message: `Failed to switch agent: ${error.message}` };
    }
  }

  static async getActiveAgent(): Promise<string> {
    try {
      const configJson = await WslService.readFile(`${OPENCLAW_PATH}/openclaw.json`);
      const config = JSON.parse(configJson);
      const agentList = config?.agents?.list;
      if (Array.isArray(agentList)) {
        const explicit = agentList.find((a: any) => a.default === true);
        if (explicit) return explicit.id;
        return agentList[0]?.id || 'main';
      }
      return 'main';
    } catch {
      return 'main';
    }
  }

  static async waitForGatewayReady(maxWaitMs: number = 60000): Promise<{ ready: boolean; message: string }> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        const output = await WslService.execCommand(
          'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/ 2>/dev/null',
          5000
        );
        if (output.trim() === '200') {
          return { ready: true, message: `Gateway ready after ${((Date.now() - start) / 1000).toFixed(1)}s` };
        }
      } catch { /* ignore */ }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return { ready: false, message: 'Gateway did not become ready in time' };
  }
}
