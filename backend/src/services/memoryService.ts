import { WslService } from './wslService.js';
import { appConfig } from '../config.js';
import { DataCache } from './dataCache.js';

const OPENCLAW_PATH = appConfig.openclawPath;
const WORKSPACES_PATH = appConfig.workspacesPath;

async function runPythonScript(script: string, timeout: number = 20000): Promise<string> {
  const tmpFile = `/tmp/oc_memory_${Date.now()}.py`;
  const b64 = Buffer.from(script).toString('base64');
  try {
    await WslService.execCommand(`printf '%s' '${b64}' | base64 -d > ${tmpFile}`, 5000);
    const output = await WslService.execCommand(`python3 ${tmpFile} 2>&1`, timeout);
    return output;
  } finally {
    await WslService.execCommand(`rm -f ${tmpFile}`, 3000);
  }
}

export interface MemoryEntry {
  agent: string;
  path: string;
  filename: string;
  size: number;
  modified: string;
  type: 'daily' | 'topic' | 'lesson' | 'project' | 'dream' | 'other';
  preview: string;
}

export interface RecallEntry {
  key: string;
  path: string;
  snippet: string;
  recallCount: number;
  dailyCount: number;
  totalScore: number;
  firstRecalledAt: string;
  lastRecalledAt: string;
}

export interface MemoryStatus {
  agent: string;
  provider: string;
  model: string;
  indexedFiles: number;
  totalFiles: number;
  chunks: number;
  vectorReady: boolean;
  recallEntries: number;
  promoted: number;
  workspace: string;
  dreaming: string;
}

export interface SearchResult {
  score: number;
  file: string;
  lines: string;
  snippet: string;
}

export interface SessionInfo {
  id: string;
  agent: string;
  filename: string;
  size: number;
  modified: string;
  active: boolean;
}

export class MemoryService {
  static async getMemoryStatus(): Promise<MemoryStatus[]> {
    return DataCache.getOrFetch('memory-status', async () => {
      try {
      const agents = await (await import('./openclawService.js')).OpenclawService.getAgents();
      const script = `
import json, os

agents_dir = "${OPENCLAW_PATH}/agents"
result = []

if os.path.isdir(agents_dir):
    for entry in sorted(os.listdir(agents_dir)):
        agent_path = os.path.join(agents_dir, entry)
        if not os.path.isdir(agent_path) or entry.startswith("."):
            continue
        memory_dir = os.path.join(agent_path, "memory")
        indexed = 0
        total = 0
        chunks = 0
        workspace = ""
        if os.path.isdir(memory_dir):
            for root, dirs, files in os.walk(memory_dir):
                for f in files:
                    if not f.startswith("."):
                        total += 1
                        if f.endswith(".md") or f.endswith(".json"):
                            indexed += 1
            workspace = memory_dir
        result.append({
            "agentId": entry,
            "status": {"files": indexed, "chunks": chunks, "workspaceDir": workspace,
                       "recall": {"totalEntries": 0, "promoted": 0},
                       "vector": {"available": False},
                       "provider": "qmd", "model": "qmd",
                       "dreaming": {"schedule": ""}}
        })

print(json.dumps(result))
`;
      const output = await runPythonScript(script, 15000);
      const raw = JSON.parse(output.trim());
      if (Array.isArray(raw)) {
        return raw.map((item: any) => {
          const s = item.status || {};
          const recall = s.recall || {};
          return {
            agent: item.agentId || '',
            provider: s.provider || s.backend || '',
            model: s.model || '',
            indexedFiles: s.files || 0,
            totalFiles: s.files || 0,
            chunks: s.chunks || 0,
            vectorReady: s.vector?.available || false,
            recallEntries: recall.totalEntries || recall.entries || 0,
            promoted: recall.promoted || 0,
            workspace: s.workspaceDir || '',
            dreaming: s.dreaming?.schedule || '',
          };
        });
      }
      return [];
    } catch {
      return [];
    }
    }, 120000);
  }

  private static parseMemoryStatusText(text: string): MemoryStatus[] {
    const results: MemoryStatus[] = [];
    const blocks = text.split(/Memory Search \(/);
    for (const block of blocks) {
      if (!block.trim()) continue;
      const agentMatch = block.match(/^([^)]+)\)/);
      if (!agentMatch) continue;
      const agent = agentMatch[1].trim();
      const indexedMatch = block.match(/Indexed:\s*(\d+)\/(\d+)\s*files\s*[·]\s*(\d+)\s*chunks/);
      const vectorMatch = block.match(/Vector:\s*(\w+)/);
      const recallMatch = block.match(/Recall store:\s*(\d+)\s*entries/);
      const promotedMatch = block.match(/(\d+)\s*promoted/);
      const workspaceMatch = block.match(/Workspace:\s*(\S+)/);
      const dreamingMatch = block.match(/Dreaming:\s*(.+)/);

      results.push({
        agent,
        provider: 'qmd',
        model: 'qmd',
        indexedFiles: indexedMatch ? parseInt(indexedMatch[1]) : 0,
        totalFiles: indexedMatch ? parseInt(indexedMatch[2]) : 0,
        chunks: indexedMatch ? parseInt(indexedMatch[3]) : 0,
        vectorReady: vectorMatch ? vectorMatch[1] === 'ready' : false,
        recallEntries: recallMatch ? parseInt(recallMatch[1]) : 0,
        promoted: promotedMatch ? parseInt(promotedMatch[1]) : 0,
        workspace: workspaceMatch ? workspaceMatch[1] : '',
        dreaming: dreamingMatch ? dreamingMatch[1].trim().split('\n')[0] : '',
      });
    }
    return results;
  }

  static async getMemoryEntries(agent: string): Promise<MemoryEntry[]> {
    const safeAgent = agent.replace(/[^a-zA-Z0-9_\-]/g, '');
    const script = `
import json, os, time

agent = "${safeAgent}"
search_dirs = [
    "${WORKSPACES_PATH}/" + agent + "/memory",
    "${OPENCLAW_PATH}/agents/" + agent + "/qmd/xdg-config/qmd",
]
result = []

def get_type(fn, parent):
    if fn.endswith('.md') and len(fn) == 13 and fn.startswith('20'):
        return 'daily'
    if parent == 'topics':
        return 'topic'
    if parent == 'lessons':
        return 'lesson'
    if parent == 'projects':
        return 'project'
    if parent == '.dreams' or 'dream' in parent.lower():
        return 'dream'
    if fn.endswith('.yml') or fn.endswith('.yaml'):
        return 'config'
    if fn.endswith('.sqlite') or fn.endswith('.gguf'):
        return 'index'
    return 'other'

def scan_dir(base, rel=""):
    try:
        items = sorted(os.listdir(base), reverse=True)
    except:
        return
    for fn in items:
        fp = os.path.join(base, fn)
        if os.path.isdir(fp):
            scan_dir(fp, os.path.join(rel, fn) if rel else fn)
            continue
        if fn.startswith('.') and fn != '.dreams':
            continue
        st = os.stat(fp)
        parent = rel.split('/')[-1] if rel else ''
        entry_type = get_type(fn, parent)
        preview = ""
        try:
            with open(fp, 'r', errors='replace') as f:
                preview = f.read(200).replace("\\n", " ").strip()
        except:
            pass
        result.append({
            "agent": agent,
            "path": os.path.join(rel, fn) if rel else fn,
            "filename": fn,
            "size": st.st_size,
            "modified": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(st.st_mtime)),
            "type": entry_type,
            "preview": preview
        })

for d in search_dirs:
    if os.path.isdir(d):
        scan_dir(d)

print(json.dumps(result[:200], ensure_ascii=False))
`;
    try {
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return [];
    }
  }

  static async getMemoryFile(agent: string, path: string): Promise<string> {
    const safeAgent = agent.replace(/[^a-zA-Z0-9_\-]/g, '');
    const safePath = path.replace(/[^a-zA-Z0-9_\-\.\/]/g, '');
    try {
      let output = await WslService.execCommand(
        `cat "${OPENCLAW_PATH}/agents/${safeAgent}/qmd/xdg-config/qmd/${safePath}" 2>/dev/null`,
        10000
      );
      if (!output.trim()) {
        output = await WslService.execCommand(
          `cat "${WORKSPACES_PATH}/${safeAgent}/memory/${safePath}" 2>/dev/null`,
          10000
        );
      }
      return output;
    } catch {
      return '';
    }
  }

  static async getRecallEntries(agent: string): Promise<RecallEntry[]> {
    const safeAgent = agent.replace(/[^a-zA-Z0-9_\-]/g, '');
    const script = `
import json, os

agent = "${safeAgent}"
recall_path = "${OPENCLAW_PATH}/agents/" + agent + "/qmd/xdg-config/qmd/recall.json"
if not os.path.exists(recall_path):
    recall_path = "${WORKSPACES_PATH}/" + agent + "/memory/.dreams/short-term-recall.json"

if not os.path.exists(recall_path):
    print(json.dumps([]))
    exit()

try:
    with open(recall_path) as f:
        data = json.load(f)
    entries = data.get("entries", {})
    result = []
    for key, val in entries.items():
        result.append({
            "key": key,
            "path": val.get("path", ""),
            "snippet": val.get("snippet", "")[:200],
            "recallCount": val.get("recallCount", 0),
            "dailyCount": val.get("dailyCount", 0),
            "totalScore": val.get("totalScore", 0),
            "firstRecalledAt": val.get("firstRecalledAt", ""),
            "lastRecalledAt": val.get("lastRecalledAt", ""),
        })
    result.sort(key=lambda x: x["totalScore"], reverse=True)
    print(json.dumps(result[:100], ensure_ascii=False))
except:
    print(json.dumps([]))
`;
    try {
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return [];
    }
  }

  static async searchMemory(query: string, agent?: string): Promise<SearchResult[]> {
    const safeQuery = query.replace(/"/g, '');
    const agentFlag = agent ? ` --agent ${agent.replace(/[^a-zA-Z0-9_\-]/g, '')}` : '';
    try {
      const output = await WslService.execCommand(
        `openclaw memory search "${safeQuery}" --max-results 20${agentFlag} 2>&1`,
        30000
      );
      const results: SearchResult[] = [];
      const blocks = output.trim().split(/\n(?=\d+\.\d+)/);
      for (const block of blocks) {
        const scoreMatch = block.match(/^(\d+\.\d+)\s+(\S+)/);
        if (scoreMatch) {
          const linesMatch = block.match(/@@.*?@@/);
          results.push({
            score: parseFloat(scoreMatch[1]),
            file: scoreMatch[2],
            lines: linesMatch ? linesMatch[0] : '',
            snippet: block.replace(scoreMatch[0], '').replace(/@@.*?@@/, '').trim().substring(0, 300),
          });
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  static async getSessions(agent: string): Promise<SessionInfo[]> {
    return DataCache.getOrFetch(`sessions-${agent}`, async () => {
    const safeAgent = agent.replace(/[^a-zA-Z0-9_\-]/g, '');
    const script = `
import json, os, time

agent = "${safeAgent}"
sessions_dir = "${OPENCLAW_PATH}/agents/" + agent + "/sessions"
result = []

if not os.path.isdir(sessions_dir):
    print(json.dumps([]))
    exit()

active_ids = set()
try:
    with open(os.path.join(sessions_dir, "sessions.json")) as f:
        sessions_data = json.load(f)
    if isinstance(sessions_data, dict):
        for key, val in sessions_data.items():
            sid = val.get("sessionId", "") if isinstance(val, dict) else ""
            if sid:
                active_ids.add(sid)
    elif isinstance(sessions_data, list):
        for s in sessions_data:
            sid = s.get("id", "") if isinstance(s, dict) else ""
            if sid:
                active_ids.add(sid)
except:
    pass

for fn in os.listdir(sessions_dir):
    if not fn.endswith(".jsonl") or fn == "sessions.json":
        continue
    fp = os.path.join(sessions_dir, fn)
    st = os.stat(fp)
    sid = fn.replace(".jsonl", "")
    is_active = sid in active_ids
    result.append({
        "id": sid,
        "agent": agent,
        "filename": fn,
        "size": st.st_size,
        "modified": time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(st.st_mtime)),
        "active": is_active
    })

result.sort(key=lambda x: x["modified"], reverse=True)
print(json.dumps(result[:50], ensure_ascii=False))
`;
    try {
      const output = await runPythonScript(script, 30000);
      return JSON.parse(output.trim());
    } catch {
      return [];
    }
    }, 120000);
  }

  static async deleteMemoryEntry(agent: string, path: string): Promise<{ success: boolean; message: string }> {
    const safeAgent = agent.replace(/[^a-zA-Z0-9_\-]/g, '');
    const safePath = path.replace(/[^a-zA-Z0-9_\-\.\/]/g, '');
    const script = `
import os, json

agent = "${safeAgent}"
path = "${safePath}"
full = "${WORKSPACES_PATH}/" + agent + "/memory/" + path
if not os.path.exists(full):
    full = "${OPENCLAW_PATH}/agents/" + agent + "/qmd/xdg-config/qmd/" + path

if not os.path.exists(full):
    print(json.dumps({"success": False, "message": "File not found"}))
    exit()

os.remove(full)
print(json.dumps({"success": True, "message": "Deleted " + path}))
`;
    try {
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return { success: false, message: 'Failed to delete' };
    }
  }

  static async cleanOldMemories(agent: string, maxAgeDays: number = 30): Promise<{ success: boolean; deleted: number; message: string }> {
    const safeAgent = agent.replace(/[^a-zA-Z0-9_\-]/g, '');
    const script = `
import os, json, time

agent = "${safeAgent}"
search_dirs = [
    "${WORKSPACES_PATH}/" + agent + "/memory",
    "${OPENCLAW_PATH}/agents/" + agent + "/qmd/xdg-config/qmd",
]
max_age = ${maxAgeDays}
now = time.time()
deleted = 0

for ws in search_dirs:
    if not os.path.isdir(ws):
        continue

    for root, dirs, files in os.walk(ws):
        if ".dreams" in root:
            continue
        for fn in files:
            if not fn.endswith(".md"):
                continue
            fp = os.path.join(root, fn)
            st = os.stat(fp)
            age_days = (now - st.st_mtime) / 86400
            if age_days > max_age:
                os.remove(fp)
                deleted += 1

print(json.dumps({"success": True, "deleted": deleted, "message": "Cleaned " + str(deleted) + " old entries"}))
`;
    try {
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return { success: false, deleted: 0, message: 'Failed to clean' };
    }
  }

  static async reindexMemory(agent?: string): Promise<{ success: boolean; message: string }> {
    const agentFlag = agent ? ` --agent ${agent.replace(/[^a-zA-Z0-9_\-]/g, '')}` : '';
    try {
      const output = await WslService.execCommand(
        `openclaw memory index --force${agentFlag} 2>&1`,
        60000
      );
      return { success: true, message: output.substring(0, 300) };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Reindex failed' };
    }
  }
}
