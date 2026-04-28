import { Router } from 'express';
import { OpenclawService } from '../services/openclawService.js';
import { DbService } from '../services/dbService.js';
import { DataCache } from '../services/dataCache.js';
import { WslService } from '../services/wslService.js';
import { appConfig } from '../config.js';

const router = Router();
const db = new DbService();

function runPythonScript(script: string, timeout: number = 30000): Promise<string> {
  const tmpFile = `/tmp/oc_agents_${Date.now()}.py`;
  const b64 = Buffer.from(script).toString('base64');
  return (async () => {
    try {
      await WslService.execCommand(`printf '%s' '${b64}' | base64 -d > ${tmpFile}`, 5000);
      const output = await WslService.execCommand(`python3 ${tmpFile}`, timeout);
      return output;
    } finally {
      await WslService.execCommand(`rm -f ${tmpFile}`, 3000);
    }
  })();
}

router.get('/stats', async (_req, res) => {
  try {
    const statsData = await DataCache.getOrFetch('agent-stats', async () => {
      const agents = await OpenclawService.getAgents();
      const agentsDir = appConfig.agentsDir;

      const script = `
import json, os, subprocess

agents_dir = "${agentsDir}"
result = []

for entry in sorted(os.listdir(agents_dir)):
    agent_path = os.path.join(agents_dir, entry)
    if not os.path.isdir(agent_path) or entry.startswith("."):
        continue

    sessions_dir = os.path.join(agent_path, "sessions")
    session_count = 0
    if os.path.isdir(sessions_dir):
        session_count = len([f for f in os.listdir(sessions_dir) if not f.startswith(".")])

    memory_dir = os.path.join(agent_path, "memory")
    memory_count = 0
    total_memory_size = 0
    if os.path.isdir(memory_dir):
        for root, dirs, files in os.walk(memory_dir):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    total_memory_size += os.path.getsize(fp)
                    memory_count += 1
                except:
                    pass

    last_active = None
    try:
        ts = int(os.path.getmtime(agent_path))
        if ts > 0:
            from datetime import datetime
            last_active = datetime.utcfromtimestamp(ts).isoformat() + "Z"
    except:
        pass

    result.append({
        "id": entry,
        "name": entry,
        "sessionCount": session_count,
        "memoryCount": memory_count,
        "totalMemorySize": total_memory_size,
        "lastActive": last_active,
    })

print(json.dumps(result))
`;
      const output = await runPythonScript(script, 20000);
      const jsonLine = output.split('\n').find(l => l.trim().startsWith('[')) || '[]';
      const agentStats = JSON.parse(jsonLine);

      const recentOps = db.getOperations(100);
      const agentOps = recentOps.filter(op => op.operationType === 'switch');
      const switchCounts: Record<string, number> = {};
      for (const op of agentOps) {
        try {
          const meta = JSON.parse(op.metadata || '{}');
          if (meta.agentId) switchCounts[meta.agentId] = (switchCounts[meta.agentId] || 0) + 1;
        } catch {}
      }

      const totalSessions = agentStats.reduce((s: number, a: any) => s + a.sessionCount, 0);
      const totalMemory = agentStats.reduce((s: number, a: any) => s + a.totalMemorySize, 0);

      return {
        agents: agentStats.map((a: any) => ({
          ...a,
          switchCount: switchCounts[a.id] || 0,
        })),
        summary: {
          totalAgents: agents.length,
          totalSessions,
          totalMemorySize: totalMemory,
          totalSwitches: Object.values(switchCounts).reduce((a: number, b: number) => a + b, 0),
        },
      };
    }, 120000);

    res.json(statsData);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get agent stats', message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const agents = await OpenclawService.getAgents();
    res.json(agents);
  } catch (error: any) {
    console.error('Failed to get agents:', error);
    res.status(500).json({ error: 'Failed to get agents', message: error.message });
  }
});

router.get('/active', async (req, res) => {
  try {
    const activeAgent = await OpenclawService.getActiveAgent();
    res.json({ activeAgent });
  } catch (error: any) {
    console.error('Failed to get active agent:', error);
    res.status(500).json({ error: 'Failed to get active agent', message: error.message });
  }
});

router.post('/switch', async (req, res) => {
  try {
    const { agentId } = req.body;
    if (!agentId) {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }
    const result = await OpenclawService.switchAgent(agentId);

    db.logOperation({
      operationType: 'switch',
      serviceName: 'openclaw-gateway',
      status: result.success ? 'success' : 'failure',
      message: result.message,
      metadata: JSON.stringify({ agentId })
    });

    DataCache.invalidate('agent-stats');
    DataCache.invalidate('agents');

    res.json(result);
  } catch (error: any) {
    console.error('Failed to switch agent:', error);

    db.logOperation({
      operationType: 'switch',
      serviceName: 'openclaw-gateway',
      status: 'failure',
      message: error.message,
      metadata: JSON.stringify({ agentId: req.body.agentId })
    });

    res.status(500).json({ error: 'Failed to switch agent', message: error.message });
  }
});

router.get('/wait-gateway', async (req, res) => {
  try {
    const result = await OpenclawService.waitForGatewayReady();

    db.logOperation({
      operationType: 'wait',
      serviceName: 'openclaw-gateway',
      status: result.ready ? 'success' : 'failure',
      message: result.message
    });

    res.json(result);
  } catch (error: any) {
    console.error('Failed to wait for gateway:', error);
    res.status(500).json({ error: 'Failed to wait for gateway', message: error.message });
  }
});

export default router;
