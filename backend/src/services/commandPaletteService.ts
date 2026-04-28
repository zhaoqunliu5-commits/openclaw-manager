import { WslService } from './wslService.js';
import { dbService } from './dbService.js';
import { appConfig } from '../config.js';
import { DataCache } from './dataCache.js';
import { getErrorMessage } from '../middleware/errorHandler.js';
import type { CommandEntry, CommandHistoryEntry, CommandResult } from '../types/index.js';

const HISTORY_FILE = appConfig.commandHistoryFile;
const FAVORITES_FILE = appConfig.commandFavoritesFile;

const BUILTIN_COMMANDS: CommandEntry[] = [
  { id: 'gateway-start', command: 'openclaw gateway start', description: '启动 Gateway 服务', category: '服务管理', isFavorite: false },
  { id: 'gateway-stop', command: 'openclaw gateway stop', description: '停止 Gateway 服务', category: '服务管理', isFavorite: false },
  { id: 'gateway-restart', command: 'openclaw gateway restart', description: '重启 Gateway 服务', category: '服务管理', isFavorite: false },
  { id: 'gateway-status', command: 'openclaw gateway status', description: '查看 Gateway 状态', category: '服务管理', isFavorite: false },
  { id: 'gateway-health', command: 'openclaw health', description: '健康检查', category: '服务管理', isFavorite: false },
  { id: 'gateway-logs', command: 'openclaw logs', description: '查看 Gateway 日志', category: '服务管理', isFavorite: false },
  { id: 'agents-list', command: 'openclaw agents list', description: '列出所有 Agent', category: 'Agent 管理', isFavorite: false },
  { id: 'agents-switch', command: 'openclaw agents switch', description: '切换当前 Agent', category: 'Agent 管理', isFavorite: false },
  { id: 'models-list', command: 'openclaw models list', description: '列出可用模型', category: '模型管理', isFavorite: false },
  { id: 'models-scan', command: 'openclaw models scan', description: '扫描可用模型', category: '模型管理', isFavorite: false },
  { id: 'skills-list', command: 'openclaw skills list', description: '列出可用技能', category: '技能管理', isFavorite: false },
  { id: 'skills-install', command: 'openclaw skills install', description: '安装技能', category: '技能管理', isFavorite: false },
  { id: 'config-get', command: 'openclaw config get', description: '获取配置项', category: '配置管理', isFavorite: false },
  { id: 'config-set', command: 'openclaw config set', description: '设置配置项', category: '配置管理', isFavorite: false },
  { id: 'config-validate', command: 'openclaw config validate', description: '验证配置', category: '配置管理', isFavorite: false },
  { id: 'memory-search', command: 'openclaw memory search', description: '搜索记忆', category: '记忆管理', isFavorite: false },
  { id: 'memory-reindex', command: 'openclaw memory reindex', description: '重建记忆索引', category: '记忆管理', isFavorite: false },
  { id: 'sessions-list', command: 'openclaw sessions list', description: '列出会话', category: '会话管理', isFavorite: false },
  { id: 'doctor', command: 'openclaw doctor', description: '诊断检查', category: '系统工具', isFavorite: false },
  { id: 'status', command: 'openclaw status', description: '查看系统状态', category: '系统工具', isFavorite: false },
  { id: 'dashboard', command: 'openclaw dashboard', description: '打开控制面板', category: '系统工具', isFavorite: false },
  { id: 'backup-create', command: 'openclaw backup create', description: '创建备份', category: '备份管理', isFavorite: false },
  { id: 'mcp-list', command: 'openclaw mcp list', description: '列出 MCP 服务器', category: 'MCP 管理', isFavorite: false },
  { id: 'plugins-list', command: 'openclaw plugins list', description: '列出插件', category: '插件管理', isFavorite: false },
  { id: 'update-check', command: 'openclaw update check', description: '检查更新', category: '系统工具', isFavorite: false },
];

async function runPythonScript(script: string, timeout: number = 15000): Promise<string> {
  const tmpFile = `/tmp/oc_cmd_${Date.now()}.py`;
  const b64 = Buffer.from(script).toString('base64');
  try {
    await WslService.execCommand(`printf '%s' '${b64}' | base64 -d > ${tmpFile}`, 5000);
    const output = await WslService.execCommand(`python3 ${tmpFile}`, timeout);
    return output;
  } finally {
    await WslService.execCommand(`rm -f ${tmpFile}`, 3000);
  }
}

export class CommandPaletteService {
  static getBuiltinCommands(): CommandEntry[] {
    return BUILTIN_COMMANDS;
  }

  static async getAvailableCommands(): Promise<CommandEntry[]> {
    return DataCache.getOrFetch('command-palette-commands', async () => {
      try {
        const script = `
import json, subprocess, re

result = subprocess.run(["openclaw", "--help"], capture_output=True, text=True, timeout=10)
text = result.stdout + result.stderr

commands = []
in_commands = False
current_category = "General"

for line in text.split("\\n"):
    stripped = line.strip()
    if stripped == "Commands:":
        in_commands = True
        continue
    if not in_commands:
        continue
    if stripped.startswith("Examples:") or stripped.startswith("Docs:"):
        break
    if not stripped:
        continue
    if stripped.endswith(":") and not stripped.startswith("-") and not stripped.startswith(" "):
        current_category = stripped.rstrip(":")
        continue
    match = re.match(r"^(\\w[\\w-]*)\\*?\\s+(.+)$", stripped)
    if match:
        cmd_name = match.group(1).strip()
        desc = match.group(2).strip()
        if cmd_name and not cmd_name.startswith("-") and len(cmd_name) > 1:
            commands.append({
                "id": cmd_name,
                "command": "openclaw " + cmd_name,
                "description": desc,
                "category": current_category,
                "isFavorite": False
            })

print(json.dumps(commands, ensure_ascii=False))
`;
      const output = await runPythonScript(script);
        const parsed = JSON.parse(output.trim());
        const builtinIds = new Set(BUILTIN_COMMANDS.map(c => c.id));
        const extra = parsed.filter((c: CommandEntry) => !builtinIds.has(c.id));
        return [...BUILTIN_COMMANDS, ...extra];
      } catch {
        return BUILTIN_COMMANDS;
      }
    }, 300000);
  }

  static async executeCommand(command: string, timeout: number = 30000): Promise<CommandResult> {
    const start = Date.now();
    try {
      const output = await WslService.execCommand(command, timeout);
      const duration = Date.now() - start;
      this.persistHistory(command, output, 'success', duration);
      return { success: true, output, exitCode: 0, duration };
    } catch (error: unknown) {
      const duration = Date.now() - start;
      const errMsg = getErrorMessage(error);
      const exitCode = (error as { code?: number })?.code || 1;
      this.persistHistory(command, errMsg, 'error', duration);
      return { success: false, output: errMsg, exitCode, duration };
    }
  }

  private static persistHistory(command: string, output: string, status: string, duration: number): void {
    try {
      dbService.addCommandHistory(command, undefined, output.substring(0, 500), status, duration);
    } catch {}
  }

  static async getHistory(limit: number = 50): Promise<CommandHistoryEntry[]> {
    try {
      const rows = dbService.getCommandHistory(limit);
      if (rows.length > 0) {
        return rows.map(r => ({
          id: String(r.id),
          command: r.command,
          timestamp: r.executed_at,
          output: r.result_summary || '',
          exitCode: r.status === 'success' ? 0 : 1,
          duration: r.execution_time_ms || 0,
        }));
      }
      const script = `
import json, os

path = "${HISTORY_FILE}"
if not os.path.exists(path):
    print(json.dumps([]))
    exit()

with open(path) as f:
    data = json.load(f)

print(json.dumps(data[-${limit}:], ensure_ascii=False))
`;
      const output = await runPythonScript(script, 10000);
      return JSON.parse(output.trim());
    } catch {
      return [];
    }
  }

  static async clearHistory(): Promise<{ success: boolean }> {
    try {
      dbService.clearCommandHistory();
      await WslService.execCommand(`rm -f ${HISTORY_FILE}`, 5000);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  static async getFavorites(): Promise<CommandEntry[]> {
    try {
      const rows = dbService.getCommandFavorites();
      if (rows.length > 0) {
        return rows.map(r => ({
          id: r.command.replace(/\s+/g, '-'),
          command: r.command,
          description: r.alias || '',
          category: '收藏',
          isFavorite: true,
        }));
      }
      const script = `
import json, os

path = "${FAVORITES_FILE}"
if not os.path.exists(path):
    print(json.dumps([]))
    exit()

with open(path) as f:
    data = json.load(f)

print(json.dumps(data, ensure_ascii=False))
`;
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return [];
    }
  }

  static async addFavorite(entry: CommandEntry): Promise<CommandEntry[]> {
    try {
      dbService.addCommandFavorite(entry.command, entry.description);
    } catch {}
    const entryB64 = Buffer.from(JSON.stringify(entry)).toString('base64');
    const script = `
import json, os, base64

path = "${FAVORITES_FILE}"
data = []
if os.path.exists(path):
    with open(path) as f:
        data = json.load(f)

new_entry = json.loads(base64.b64decode("${entryB64}").decode("utf-8"))
ids = [e.get("id") for e in data]
if new_entry.get("id") not in ids:
    new_entry["isFavorite"] = True
    data.append(new_entry)

os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(json.dumps(data, ensure_ascii=False))
`;
    const output = await runPythonScript(script);
    return JSON.parse(output.trim());
  }

  static async removeFavorite(commandId: string): Promise<CommandEntry[]> {
    try {
      const favs = dbService.getCommandFavorites();
      const target = favs.find(f => f.command.replace(/\s+/g, '-') === commandId);
      if (target) dbService.removeCommandFavorite(target.command);
    } catch {}
    const script = `
import json, os

path = "${FAVORITES_FILE}"
if not os.path.exists(path):
    print(json.dumps([]))
    exit()

with open(path) as f:
    data = json.load(f)

data = [e for e in data if e.get("id") != "${commandId}"]

with open(path, "w") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(json.dumps(data, ensure_ascii=False))
`;
    const output = await runPythonScript(script);
    return JSON.parse(output.trim());
  }

}
