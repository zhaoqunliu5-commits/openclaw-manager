import { WslService } from './wslService.js';
import { appConfig } from '../config.js';
import { getErrorMessage } from '../middleware/errorHandler.js';
import fs from 'fs';
import path from 'path';

export interface AppSettings {
  theme: 'dark' | 'light';
  defaultAgent: string;
  autoStartServices: boolean;
  notificationPreferences: {
    serviceStatus: boolean;
    agentSwitch: boolean;
    errors: boolean;
    warnings: boolean;
    info: boolean;
  };
  refreshInterval: number;
  language: string;
}

const SETTINGS_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultAgent: 'main',
  autoStartServices: false,
  notificationPreferences: {
    serviceStatus: true,
    agentSwitch: true,
    errors: true,
    warnings: true,
    info: false,
  },
  refreshInterval: 15000,
  language: 'zh-CN',
};

class SettingsService {
  private settings: AppSettings;

  constructor() {
    this.settings = this.load();
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch { }
    return { ...DEFAULT_SETTINGS };
  }

  private save(): void {
    try {
      if (!fs.existsSync(SETTINGS_DIR)) {
        fs.mkdirSync(SETTINGS_DIR, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  get(): AppSettings {
    return { ...this.settings };
  }

  update(partial: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...partial };
    if (partial.notificationPreferences) {
      this.settings.notificationPreferences = {
        ...DEFAULT_SETTINGS.notificationPreferences,
        ...partial.notificationPreferences,
      };
    }
    this.save();
    return this.get();
  }

  async setDefaultAgent(agent: string): Promise<{ success: boolean; message: string }> {
    try {
      const configJson = appConfig.configJson;
      const output = await WslService.execCommand(
        `python3 -c "
import json
with open('${configJson}','r') as f: c=json.load(f)
if 'agents' not in c: c['agents']={}
c['agents']['default'] = '${agent}'
with open('${configJson}','w') as f: json.dump(c,f,indent=2)
print('ok')
"`,
        10000
      );
      if (output.trim() === 'ok') {
        this.settings.defaultAgent = agent;
        this.save();
        return { success: true, message: `默认 Agent 已设置为 ${agent}` };
      }
      return { success: false, message: output.trim() };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error) };
    }
  }

  async getAvailableAgents(): Promise<string[]> {
    try {
      const output = await WslService.execCommand(`ls ${appConfig.agentsDir}/ 2>/dev/null`, 5000);
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  async setAutoStart(enabled: boolean): Promise<{ success: boolean; message: string }> {
    try {
      if (enabled) {
        await WslService.execCommand(
          'systemctl --user enable openclaw-gateway 2>/dev/null; systemctl --user enable canvas 2>/dev/null',
          10000
        );
      } else {
        await WslService.execCommand(
          'systemctl --user disable openclaw-gateway 2>/dev/null; systemctl --user disable canvas 2>/dev/null',
          10000
        );
      }
      this.settings.autoStartServices = enabled;
      this.save();
      return { success: true, message: enabled ? '已启用自动启动' : '已禁用自动启动' };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error) };
    }
  }
}

export const settingsService = new SettingsService();
