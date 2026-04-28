import { WslService } from './wslService.js';
import { appConfig } from '../config.js';
import { DataCache } from './dataCache.js';
import { getErrorMessage } from '../middleware/errorHandler.js';
import type { ModelProvider, ModelAlias, AgentModelInfo, ModelDefinition } from '../types/index.js';

const OPENCLAW_PATH = appConfig.openclawPath;

async function runPythonScript(script: string, timeout: number = 15000): Promise<string> {
  const tmpFile = `/tmp/oc_model_${Date.now()}.py`;
  const b64 = Buffer.from(script).toString('base64');
  try {
    await WslService.execCommand(`printf '%s' '${b64}' | base64 -d > ${tmpFile}`, 5000);
    const output = await WslService.execCommand(`python3 ${tmpFile}`, timeout);
    return output;
  } finally {
    await WslService.execCommand(`rm -f ${tmpFile}`, 3000);
  }
}

export class ModelService {
  static async getProviders(): Promise<ModelProvider[]> {
    return DataCache.getOrFetch('model-providers', async () => {
      try {
      const script = `
import json, os

config_path = "${OPENCLAW_PATH}/openclaw.json"
if not os.path.exists(config_path):
    print(json.dumps([]))
    exit()

with open(config_path) as f:
    config = json.load(f)

providers = config.get("models", {}).get("providers", {})
result = []

for name, pdata in providers.items():
    base_url = pdata.get("baseUrl", "")
    api_key = pdata.get("apiKey", "")
    api_type = pdata.get("api", pdata.get("apiType", "openai"))
    models = []

    raw_models = pdata.get("models", [])
    if isinstance(raw_models, list):
        for mdata in raw_models:
            mid = mdata.get("id", "")
            models.append({
                "id": mid,
                "name": mdata.get("name", mid),
                "api": mdata.get("api", "chat"),
                "reasoning": mdata.get("reasoning", False),
                "input": mdata.get("input", ["text"]),
                "contextWindow": mdata.get("contextWindow"),
                "maxTokens": mdata.get("maxTokens"),
            })
    elif isinstance(raw_models, dict):
        for mid, mdata in raw_models.items():
            models.append({
                "id": mid,
                "name": mdata.get("name", mid),
                "api": mdata.get("api", "chat"),
                "reasoning": mdata.get("reasoning", False),
                "input": mdata.get("input", ["text"]),
                "contextWindow": mdata.get("contextWindow"),
                "maxTokens": mdata.get("maxTokens"),
            })

    result.append({
        "name": name,
        "baseUrl": base_url,
        "apiKey": api_key[:8] + "..." if len(api_key) > 8 else api_key,
        "apiType": api_type,
        "models": models,
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

  static async getAliases(): Promise<ModelAlias[]> {
    return DataCache.getOrFetch('model-aliases', async () => {
      try {
      const script = `
import json, os

config_path = "${OPENCLAW_PATH}/openclaw.json"
if not os.path.exists(config_path):
    print(json.dumps([]))
    exit()

with open(config_path) as f:
    config = json.load(f)

aliases = config.get("models", {}).get("aliases", {})
result = []

for alias, data in aliases.items():
    if isinstance(data, dict):
        result.append({
            "alias": alias,
            "provider": data.get("provider", ""),
            "modelId": data.get("modelId", data.get("model", "")),
        })
    elif isinstance(data, str):
        result.append({"alias": alias, "provider": "", "modelId": data})

print(json.dumps(result, ensure_ascii=False))
`;
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return [];
    }
    }, 120000);
  }

  static async getAgentModels(): Promise<AgentModelInfo[]> {
    return DataCache.getOrFetch('model-agent-models', async () => {
      try {
      const script = `
import json, os

config_path = "${OPENCLAW_PATH}/openclaw.json"
if not os.path.exists(config_path):
    print(json.dumps([]))
    exit()

with open(config_path) as f:
    config = json.load(f)

agents_list = config.get("agents", {}).get("list", [])
result = []

for agent in agents_list:
    agent_id = agent.get("id", "")
    model = agent.get("model", "")
    fallbacks = agent.get("fallbackModels", [])
    if agent_id:
        result.append({
            "agentId": agent_id,
            "model": model,
            "fallbacks": fallbacks if isinstance(fallbacks, list) else [],
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

  static async detectProvider(baseUrl: string, apiKey: string): Promise<{ provider: string; models: ModelDefinition[] }> {
    try {
      const script = `
import json, urllib.request, ssl

base_url = "${baseUrl}".rstrip("/")
api_key = "${apiKey}"

provider = "custom"
if "openai" in base_url.lower():
    provider = "openai"
elif "anthropic" in base_url.lower():
    provider = "anthropic"
elif "gemini" in base_url.lower() or "google" in base_url.lower():
    provider = "google"
elif "deepseek" in base_url.lower():
    provider = "deepseek"
elif "qwen" in base_url.lower() or "dashscope" in base_url.lower():
    provider = "qwen"

models = []
try:
    url = base_url + "/models"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
    ctx = ssl.create_default_context()
    resp = urllib.request.urlopen(req, timeout=10, context=ctx)
    data = json.loads(resp.read())
    for m in data.get("data", []):
        mid = m.get("id", "")
        models.append({
            "id": mid,
            "name": m.get("name", mid),
            "api": "chat",
            "reasoning": "reason" in mid.lower() or "o1" in mid.lower() or "o3" in mid.lower(),
            "input": m.get("input", ["text"]),
        })
except Exception as e:
    models = []

print(json.dumps({"provider": provider, "models": models}, ensure_ascii=False))
`;
      const output = await runPythonScript(script, 20000);
      return JSON.parse(output.trim());
    } catch (error: unknown) {
      console.error('[ModelService] refreshProviderModels error:', getErrorMessage(error));
      return { provider: 'custom', models: [] };
    }
  }

  static async addProvider(name: string, baseUrl: string, apiKey: string): Promise<ModelProvider> {
    const script = `
import json, os

config_path = "${OPENCLAW_PATH}/openclaw.json"
with open(config_path) as f:
    config = json.load(f)

if "models" not in config:
    config["models"] = {}
if "providers" not in config["models"]:
    config["models"]["providers"] = {}

config["models"]["providers"]["${name}"] = {
    "baseUrl": "${baseUrl}",
    "apiKey": "${apiKey}",
    "api": "openai",
    "models": []
}

with open(config_path, 'w') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

print(json.dumps({"success": True}))
`;
    await runPythonScript(script);
    return {
      name,
      baseUrl,
      apiKey: apiKey.slice(0, 8) + '...',
      apiType: 'openai',
      models: [],
    };
  }

  static async removeProvider(name: string): Promise<{ success: boolean; message: string }> {
    const script = `
import json, os

config_path = "${OPENCLAW_PATH}/openclaw.json"
with open(config_path) as f:
    config = json.load(f)

providers = config.get("models", {}).get("providers", {})
if "${name}" in providers:
    del providers["${name}"]
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    print(json.dumps({"success": True, "message": "Provider removed"}))
else:
    print(json.dumps({"success": False, "message": "Provider not found"}))
`;
    const output = await runPythonScript(script);
    return JSON.parse(output.trim());
  }

  static async refreshProviderModels(name: string): Promise<{ providerName: string; models: any[] }> {
    try {
      const script = `
import json, os, urllib.request, ssl

config_path = "${OPENCLAW_PATH}/openclaw.json"
with open(config_path) as f:
    config = json.load(f)

provider_data = config.get("models", {}).get("providers", {}).get("${name}", {})
base_url = provider_data.get("baseUrl", "").rstrip("/")
api_key = provider_data.get("apiKey", "")

models = []
try:
    url = base_url + "/models"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
    ctx = ssl.create_default_context()
    resp = urllib.request.urlopen(req, timeout=10, context=ctx)
    data = json.loads(resp.read())
    for m in data.get("data", []):
        mid = m.get("id", "")
        models.append({
            "id": mid,
            "name": m.get("name", mid),
            "api": "chat",
            "reasoning": "reason" in mid.lower() or "o1" in mid.lower() or "o3" in mid.lower(),
            "input": m.get("input", ["text"]),
        })

    if "models" not in provider_data:
        provider_data["models"] = []
    existing_ids = [m.get("id") for m in provider_data["models"] if isinstance(m, dict)]
    for m in models:
        if m["id"] not in existing_ids:
            provider_data["models"].append({
                "id": m["id"],
                "name": m["name"],
                "api": m["api"],
                "reasoning": m["reasoning"],
                "input": m["input"],
            })

    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
except Exception as e:
    pass

print(json.dumps({"providerName": "${name}", "models": models}, ensure_ascii=False))
`;
      const output = await runPythonScript(script, 20000);
      return JSON.parse(output.trim());
    } catch {
      return { providerName: name, models: [] };
    }
  }

  static async setAgentModel(agentId: string, modelId: string): Promise<{ success: boolean; message: string }> {
    const script = `
import json, os, signal, subprocess

config_path = "${OPENCLAW_PATH}/openclaw.json"
with open(config_path) as f:
    config = json.load(f)

agents_list = config.get("agents", {}).get("list", [])
found = False
for agent in agents_list:
    if agent.get("id") == "${agentId}":
        agent["model"] = "${modelId}"
        found = True
        break

if not found:
    print(json.dumps({"success": False, "message": "Agent not found"}))
    exit()

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

print(json.dumps({"success": True, "message": "Model updated for ${agentId}"}))
`;
    const output = await runPythonScript(script);
    return JSON.parse(output.trim());
  }
}
