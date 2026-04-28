import { WslService } from './wslService.js';
import { appConfig } from '../config.js';
import { DataCache } from './dataCache.js';
import type { GatewayMetrics, AgentActivity, SessionInfo, SystemResources } from '../types/index.js';

const OPENCLAW_PATH = appConfig.openclawPath;

async function runPythonScript(script: string, timeout: number = 15000): Promise<string> {
  const tmpFile = `/tmp/oc_monitor_${Date.now()}.py`;
  const b64 = Buffer.from(script).toString('base64');
  try {
    await WslService.execCommand(`printf '%s' '${b64}' | base64 -d > ${tmpFile}`, 5000);
    const output = await WslService.execCommand(`python3 ${tmpFile}`, timeout);
    return output;
  } finally {
    await WslService.execCommand(`rm -f ${tmpFile}`, 3000);
  }
}

export class MonitorService {
  static async getProcessMetrics(serviceName: string): Promise<GatewayMetrics> {
    return DataCache.getOrFetch(`monitor-process-${serviceName}`, async () => {
      try {
      const script = `
import json, subprocess, os, time

service_name = "${serviceName}"
result = {"pid": 0, "memoryMB": 0, "cpuPercent": 0, "uptime": "0", "status": "stopped"}

if service_name == "openclaw-gateway":
    pattern = "openclaw.*gateway"
elif service_name == "canvas":
    pattern = "openclaw.*canvas"
else:
    pattern = service_name

try:
    pgrep = subprocess.run(["pgrep", "-f", pattern], capture_output=True, text=True)
    pids = [p for p in pgrep.stdout.strip().split("\\n") if p.isdigit()]
    if not pids:
        print(json.dumps(result))
        exit()

    pid = int(pids[0])
    result["pid"] = pid
    result["status"] = "running"

    try:
        with open(f"/proc/{pid}/stat") as f:
            stat = f.read().split()
        utime = int(stat[13])
        stime = int(stat[14])
        total_ticks = utime + stime
        with open("/proc/stat") as f:
            cpu_line = f.readline().split()
        idle1 = int(cpu_line[4])
        total1 = sum(int(x) for x in cpu_line[1:])
        time.sleep(0.1)
        with open(f"/proc/{pid}/stat") as f:
            stat2 = f.read().split()
        utime2 = int(stat2[13])
        stime2 = int(stat2[14])
        with open("/proc/stat") as f:
            cpu_line2 = f.readline().split()
        idle2 = int(cpu_line2[4])
        total2 = sum(int(x) for x in cpu_line2[1:])
        d_idle = idle2 - idle1
        d_total = total2 - total1
        d_proc = (utime2 + stime2) - total_ticks
        if d_total > 0:
            result["cpuPercent"] = round((d_proc / d_total) * 100, 1)
    except:
        pass

    try:
        with open(f"/proc/{pid}/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    result["memoryMB"] = round(int(line.split()[1]) / 1024, 0)
                    break
    except:
        pass

    try:
        with open(f"/proc/{pid}/stat") as f:
            stat = f.read().split()
        start_ticks = int(stat[21])
        with open("/proc/uptime") as f:
            uptime_sec = float(f.read().split()[0])
        clk_tck = os.sysconf("SC_CLK_TCK")
        proc_uptime = uptime_sec - (start_ticks / clk_tck)
        hours = int(proc_uptime // 3600)
        mins = int((proc_uptime % 3600) // 60)
        secs = int(proc_uptime % 60)
        result["uptime"] = f"{hours:02d}:{mins:02d}:{secs:02d}"
    except:
        pass

except Exception as e:
    pass

print(json.dumps(result))
`;
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return { pid: 0, memoryMB: 0, cpuPercent: 0, uptime: '0', status: 'stopped' };
    }
    }, 120000);
  }

  static async getSystemResources(): Promise<SystemResources> {
    return DataCache.getOrFetch('monitor-system', async () => {
      try {
      const [gateway, canvas] = await Promise.all([
        this.getProcessMetrics('openclaw-gateway'),
        this.getProcessMetrics('canvas'),
      ]);

      const script = `
import json, os, time

oc_path = "${OPENCLAW_PATH}"
result = {
    "totalSessions": 0,
    "totalSessionSizeMB": 0,
    "memoryFiles": 0,
    "memorySizeKB": 0,
    "taskCount": 0
}

agents_dir = os.path.join(oc_path, "agents")
if os.path.isdir(agents_dir):
    for agent_name in os.listdir(agents_dir):
        sessions_dir = os.path.join(agents_dir, agent_name, "sessions")
        if not os.path.isdir(sessions_dir):
            continue
        sessions_file = os.path.join(sessions_dir, "sessions.json")
        if os.path.exists(sessions_file):
            try:
                with open(sessions_file) as f:
                    sessions = json.load(f)
                result["totalSessions"] += len(sessions) if isinstance(sessions, dict) else len(sessions)
            except:
                pass
        for fn in os.listdir(sessions_dir):
            fp = os.path.join(sessions_dir, fn)
            if os.path.isfile(fp):
                result["totalSessionSizeMB"] += os.path.getsize(fp)

result["totalSessionSizeMB"] = round(result["totalSessionSizeMB"] / (1024 * 1024), 1)

memories_dir = os.path.join(oc_path, "memories")
if os.path.isdir(memories_dir):
    for fn in os.listdir(memories_dir):
        fp = os.path.join(memories_dir, fn)
        if os.path.isfile(fp):
            result["memoryFiles"] += 1
            result["memorySizeKB"] += os.path.getsize(fp)
result["memorySizeKB"] = round(result["memorySizeKB"] / 1024, 1)

tasks_dir = os.path.join(oc_path, "tasks")
if os.path.isdir(tasks_dir):
    for fn in os.listdir(tasks_dir):
        fp = os.path.join(tasks_dir, fn)
        if os.path.isfile(fp):
            result["taskCount"] += 1

print(json.dumps(result))
`;
      const statsOutput = await runPythonScript(script);
      const stats = JSON.parse(statsOutput.trim());

      return {
        gateway,
        canvas,
        totalMemoryMB: gateway.memoryMB + canvas.memoryMB,
        ...stats,
      };
    } catch {
      return {
        gateway: { pid: 0, memoryMB: 0, cpuPercent: 0, uptime: '0', status: 'stopped' },
        canvas: { pid: 0, memoryMB: 0, cpuPercent: 0, uptime: '0', status: 'stopped' },
        totalMemoryMB: 0,
        totalSessions: 0,
        totalSessionSizeMB: 0,
        memoryFiles: 0,
        memorySizeKB: 0,
        taskCount: 0,
      };
    }
    }, 120000);
  }

  static async getAgentActivities(): Promise<AgentActivity[]> {
    return DataCache.getOrFetch('monitor-activities', async () => {
      try {
      const script = `
import json, os, time

agents_dir = "${OPENCLAW_PATH}/agents"
result = []

if not os.path.isdir(agents_dir):
    print(json.dumps(result, ensure_ascii=False))
    exit()

for agent_name in os.listdir(agents_dir):
    agent_path = os.path.join(agents_dir, agent_name)
    if not os.path.isdir(agent_path):
        continue

    sessions_dir = os.path.join(agent_path, "sessions")
    if not os.path.isdir(sessions_dir):
        continue

    sessions_file = os.path.join(sessions_dir, "sessions.json")
    session_count = 0
    active_count = 0
    last_active = None
    current_model = ""
    current_status = ""
    total_size = 0

    if os.path.exists(sessions_file):
        try:
            with open(sessions_file) as f:
                sessions = json.load(f)
            session_count = len(sessions) if isinstance(sessions, dict) else len(sessions)
            now = time.time() * 1000
            if isinstance(sessions, dict):
                for key, s in sessions.items():
                    updated = s.get("updatedAt", 0)
                    if updated and (now - updated) < 3600000:
                        active_count += 1
                    if updated and (last_active is None or updated > last_active):
                        last_active = updated
                        current_model = s.get("model", "")
                        current_status = s.get("status", "")
        except:
            pass

    for fn in os.listdir(sessions_dir):
        fp = os.path.join(sessions_dir, fn)
        if os.path.isfile(fp):
            total_size += os.path.getsize(fp)

    identity_file = os.path.join(agent_path, "identity.json")
    agent_display = agent_name
    emoji = ""
    if os.path.exists(identity_file):
        try:
            with open(identity_file) as f:
                ident = json.load(f)
            agent_display = ident.get("name", agent_name)
            emoji = ident.get("emoji", "")
        except:
            pass

    result.append({
        "agentId": agent_name,
        "agentName": agent_display,
        "emoji": emoji,
        "sessionCount": session_count,
        "activeSessionCount": active_count,
        "lastActiveAt": last_active,
        "currentModel": current_model,
        "currentStatus": current_status,
        "totalSessionSizeKB": round(total_size / 1024, 1)
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

  static async getRecentSessions(limit: number = 20): Promise<SessionInfo[]> {
    return DataCache.getOrFetch(`monitor-sessions-${limit}`, async () => {
      try {
      const script = `
import json, os, time

agents_dir = "${OPENCLAW_PATH}/agents"
all_sessions = []

if not os.path.isdir(agents_dir):
    print(json.dumps([], ensure_ascii=False))
    exit()

for agent_name in os.listdir(agents_dir):
    sessions_file = os.path.join(agents_dir, agent_name, "sessions", "sessions.json")
    if not os.path.exists(sessions_file):
        continue
    try:
        with open(sessions_file) as f:
            sessions = json.load(f)
        if isinstance(sessions, dict):
            for sid, s in sessions.items():
                all_sessions.append({
                    "sessionId": sid,
                    "agentId": agent_name,
                    "model": s.get("model", ""),
                    "modelProvider": s.get("modelProvider", ""),
                    "status": s.get("status", ""),
                    "channel": s.get("channel", ""),
                    "startedAt": s.get("startedAt"),
                    "updatedAt": s.get("updatedAt"),
                    "sizeKB": 0,
                })
    except:
        pass

for agent_name in os.listdir(agents_dir):
    sessions_dir = os.path.join(agents_dir, agent_name, "sessions")
    if not os.path.isdir(sessions_dir):
        continue
    for fn in os.listdir(sessions_dir):
        if fn == "sessions.json":
            continue
        fp = os.path.join(sessions_dir, fn)
        if os.path.isfile(fp):
            size = os.path.getsize(fp)
            sid = fn.replace(".json", "")
            for s in all_sessions:
                if s["sessionId"] == sid and s["agentId"] == agent_name:
                    s["sizeKB"] = round(size / 1024, 1)
                    break

all_sessions.sort(key=lambda x: x.get("updatedAt") or 0, reverse=True)
all_sessions = all_sessions[:${limit}]

print(json.dumps(all_sessions, ensure_ascii=False))
`;
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return [];
    }
    }, 120000);
  }
}
