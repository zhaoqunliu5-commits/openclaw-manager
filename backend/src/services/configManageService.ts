import { WslService } from './wslService.js';
import { appConfig } from '../config.js';
import { DataCache } from './dataCache.js';
import type { ConfigBackup, ConfigDiff, ConfigSection } from '../types/index.js';

const OPENCLAW_PATH = appConfig.openclawPath;
const BACKUPS_DIR = appConfig.getBackupDir();

async function runPythonScript(script: string, timeout: number = 15000): Promise<string> {
  const tmpFile = `/tmp/oc_config_${Date.now()}.py`;
  const b64 = Buffer.from(script).toString('base64');
  try {
    await WslService.execCommand(`printf '%s' '${b64}' | base64 -d > ${tmpFile}`, 5000);
    const output = await WslService.execCommand(`python3 ${tmpFile}`, timeout);
    return output;
  } finally {
    await WslService.execCommand(`rm -f ${tmpFile}`, 3000);
  }
}

const SECTION_DESCRIPTIONS: Record<string, string> = {
  meta: '元信息',
  env: '环境变量',
  wizard: '向导配置',
  diagnostics: '诊断设置',
  auth: '认证配置',
  acp: 'ACP 协议',
  models: '模型配置',
  agents: 'Agent 配置',
  tools: '工具配置',
  messages: '消息设置',
  commands: '命令配置',
  session: '会话设置',
  channels: '渠道配置',
  talk: '对话设置',
  gateway: '网关配置',
  memory: '记忆配置',
  mcp: 'MCP 协议',
  skills: '技能配置',
  plugins: '插件配置',
};

export class ConfigManageService {
  static async getSections(): Promise<ConfigSection[]> {
    return DataCache.getOrFetch('config-sections', async () => {
      try {
      const script = `
import json, os

config_path = "${OPENCLAW_PATH}/openclaw.json"
if not os.path.exists(config_path):
    print(json.dumps([]))
    exit()

with open(config_path) as f:
    config = json.load(f)

descriptions = ${JSON.stringify(SECTION_DESCRIPTIONS)}
result = []

for key in sorted(config.keys()):
    val = config[key]
    has_data = val is not None and val != {} and val != [] and val != ""
    result.append({
        "key": key,
        "description": descriptions.get(key, ""),
        "hasData": bool(has_data)
    })

print(json.dumps(result, ensure_ascii=False))
`;
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return [];
    }
    }, 120000);
  }

  static async getConfigJson(section?: string): Promise<any> {
    return DataCache.getOrFetch(`config-json-${section || 'all'}`, async () => {
      try {
      const script = `
import json, os

config_path = "${OPENCLAW_PATH}/openclaw.json"
with open(config_path) as f:
    config = json.load(f)

${section ? `section = "${section}"\nif section in config:\n    print(json.dumps(config[section], ensure_ascii=False, indent=2))\nelse:\n    print(json.dumps(None))` : `print(json.dumps(config, ensure_ascii=False, indent=2))`}
`;
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return null;
    }
    }, 120000);
  }

  static async listBackups(): Promise<ConfigBackup[]> {
    try {
      const script = `
import json, os, time

backups_dir = "${BACKUPS_DIR}"
if not os.path.isdir(backups_dir):
    print(json.dumps([]))
    exit()

result = []
for fn in sorted(os.listdir(backups_dir), reverse=True):
    if not fn.endswith(".json"):
        continue
    fp = os.path.join(backups_dir, fn)
    stat = os.stat(fp)
    size_kb = round(stat.st_size / 1024, 1)

    parts = fn.replace(".json", "").split("_", 2)
    ts_str = parts[0] if len(parts) > 0 else ""
    label = parts[2] if len(parts) > 2 else parts[1] if len(parts) > 1 else ""

    try:
        ts = time.strptime(ts_str, "%Y%m%d%H%M%S")
        ts_iso = time.strftime("%Y-%m-%dT%H:%M:%S", ts)
    except:
        ts_iso = ts_str

    sections = []
    try:
        with open(fp) as f:
            data = json.load(f)
        sections = [k for k in data.keys() if data[k] is not None and data[k] != {} and data[k] != []]
    except:
        pass

    result.append({
        "id": fn.replace(".json", ""),
        "filename": fn,
        "timestamp": ts_iso,
        "label": label.replace("-", " "),
        "sizeKB": size_kb,
        "sections": sections,
    })

print(json.dumps(result, ensure_ascii=False))
`;
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return [];
    }
  }

  static async createBackup(label: string = ''): Promise<ConfigBackup> {
    const safeLabel = label.replace(/"/g, '\\"');
    const script = `
import json, os, time, shutil

config_path = "${OPENCLAW_PATH}/openclaw.json"
backups_dir = "${BACKUPS_DIR}"

os.makedirs(backups_dir, exist_ok=True)

ts = time.strftime("%Y%m%d%H%M%S")
label_part = "_" + "${safeLabel}".replace(" ", "-") if "${safeLabel}" else "_manual"
filename = ts + label_part + ".json"
dest = os.path.join(backups_dir, filename)

shutil.copy2(config_path, dest)

with open(dest) as f:
    data = json.load(f)

sections = [k for k in data.keys() if data[k] is not None and data[k] != {} and data[k] != []]
size_kb = round(os.path.getsize(dest) / 1024, 1)

result = {
    "id": filename.replace(".json", ""),
    "filename": filename,
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    "label": "${safeLabel}" or "manual",
    "sizeKB": size_kb,
    "sections": sections,
}

print(json.dumps(result, ensure_ascii=False))
`;
    const output = await runPythonScript(script);
    return JSON.parse(output.trim());
  }

  static async restoreBackup(backupId: string): Promise<{ success: boolean; message: string }> {
    const script = `
import json, os, shutil, signal, subprocess

config_path = "${OPENCLAW_PATH}/openclaw.json"
backups_dir = "${BACKUPS_DIR}"
backup_id = "${backupId}"

backup_file = os.path.join(backups_dir, backup_id + ".json")
if not os.path.exists(backup_file):
    for fn in os.listdir(backups_dir):
        if fn.startswith(backup_id):
            backup_file = os.path.join(backups_dir, fn)
            break

if not os.path.exists(backup_file):
    print(json.dumps({"success": False, "message": "Backup not found"}))
    exit()

try:
    with open(backup_file) as f:
        data = json.load(f)
except:
    print(json.dumps({"success": False, "message": "Invalid backup file"}))
    exit()

shutil.copy2(config_path, config_path + ".pre-restore")

with open(config_path, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

try:
    result = subprocess.run(["pgrep", "-f", "openclaw-gateway"], capture_output=True, text=True)
    pids = result.stdout.strip().split("\\n")
    for pid in pids:
        if pid.isdigit():
            os.kill(int(pid), signal.SIGHUP)
except:
    pass

print(json.dumps({"success": True, "message": "Config restored and gateway reloaded"}))
`;
    const output = await runPythonScript(script);
    return JSON.parse(output.trim());
  }

  static async deleteBackup(backupId: string): Promise<{ success: boolean; message: string }> {
    const script = `
import json, os

backups_dir = "${BACKUPS_DIR}"
backup_id = "${backupId}"

deleted = False
for fn in os.listdir(backups_dir):
    if fn.startswith(backup_id) and fn.endswith(".json"):
        os.remove(os.path.join(backups_dir, fn))
        deleted = True

if deleted:
    print(json.dumps({"success": True, "message": "Backup deleted"}))
else:
    print(json.dumps({"success": False, "message": "Backup not found"}))
`;
    const output = await runPythonScript(script);
    return JSON.parse(output.trim());
  }

  static async diffBackups(backupId1: string, backupId2: string): Promise<ConfigDiff[]> {
    const script = `
import json, os

backups_dir = "${BACKUPS_DIR}"

def find_backup(bid):
    for fn in os.listdir(backups_dir):
        if fn.startswith(bid) and fn.endswith(".json"):
            return os.path.join(backups_dir, fn)
    return None

f1 = find_backup("${backupId1}")
f2 = find_backup("${backupId2}")

if not f1 or not f2:
    print(json.dumps([]))
    exit()

with open(f1) as fh:
    d1 = json.load(fh)
with open(f2) as fh:
    d2 = json.load(fh)

def flatten(obj, prefix=""):
    result = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            path = f"{prefix}.{k}" if prefix else k
            if isinstance(v, (dict, list)):
                result.update(flatten(v, path))
            else:
                result[path] = v
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            path = f"{prefix}[{i}]"
            if isinstance(v, (dict, list)):
                result.update(flatten(v, path))
            else:
                result[path] = v
    return result

flat1 = flatten(d1)
flat2 = flatten(d2)

all_keys = set(flat1.keys()) | set(flat2.keys())
diffs = []

for key in sorted(all_keys):
    in1 = key in flat1
    in2 = key in flat2
    if in1 and not in2:
        diffs.append({"path": key, "oldValue": flat1[key], "newValue": None, "type": "removed"})
    elif not in1 and in2:
        diffs.append({"path": key, "oldValue": None, "newValue": flat2[key], "type": "added"})
    elif flat1[key] != flat2[key]:
        diffs.append({"path": key, "oldValue": flat1[key], "newValue": flat2[key], "type": "changed"})

print(json.dumps(diffs, ensure_ascii=False))
`;
    const output = await runPythonScript(script);
    return JSON.parse(output.trim());
  }

  static async exportConfig(): Promise<{ config: any; timestamp: string; version: string }> {
    try {
      const config = await this.getConfigJson();
      return {
        config,
        timestamp: new Date().toISOString(),
        version: '1.0',
      };
    } catch {
      return { config: null, timestamp: new Date().toISOString(), version: '1.0' };
    }
  }

  static async importConfig(configData: any, merge: boolean = false): Promise<{ success: boolean; message: string }> {
    const script = `
import json, os, signal, subprocess

config_path = "${OPENCLAW_PATH}/openclaw.json"
merge = ${merge ? 'True' : 'False'}

try:
    new_config = json.loads(${JSON.stringify(JSON.stringify(configData))})
except:
    print(json.dumps({"success": False, "message": "Invalid config data"}))
    exit()

if merge:
    with open(config_path) as f:
        existing = json.load(f)
    for key, value in new_config.items():
        if isinstance(value, dict) and isinstance(existing.get(key), dict):
            existing[key].update(value)
        else:
            existing[key] = value
    final = existing
else:
    final = new_config

with open(config_path, 'w') as f:
    json.dump(final, f, indent=2, ensure_ascii=False)

try:
    result = subprocess.run(["pgrep", "-f", "openclaw-gateway"], capture_output=True, text=True)
    pids = result.stdout.strip().split("\\n")
    for pid in pids:
        if pid.isdigit():
            os.kill(int(pid), signal.SIGHUP)
except:
    pass

print(json.dumps({"success": True, "message": "Config imported and gateway reloaded"}))
`;
    const output = await runPythonScript(script);
    return JSON.parse(output.trim());
  }

  static async updateSection(section: string, data: any): Promise<{ success: boolean; message: string }> {
    const script = `
import json, os, signal, subprocess

config_path = "${OPENCLAW_PATH}/openclaw.json"
section = "${section}"

with open(config_path) as f:
    config = json.load(f)

config[section] = json.loads(${JSON.stringify(JSON.stringify(data))})

with open(config_path, 'w') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

try:
    result = subprocess.run(["pgrep", "-f", "openclaw-gateway"], capture_output=True, text=True)
    pids = result.stdout.strip().split("\\n")
    for pid in pids:
        if pid.isdigit():
            os.kill(int(pid), signal.SIGHUP)
except:
    pass

print(json.dumps({"success": True, "message": "Section " + section + " updated"}))
`;
    const output = await runPythonScript(script);
    return JSON.parse(output.trim());
  }
}
