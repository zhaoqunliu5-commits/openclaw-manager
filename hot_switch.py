import json, subprocess, sys, os, time

agent_id = sys.argv[1] if len(sys.argv) > 1 else "main"

with open('/home/afan/.openclaw/openclaw.json', 'r') as f:
    config = json.load(f)

agent_list = config.get('agents', {}).get('list', [])
found = False
for agent in agent_list:
    if agent.get('id') == agent_id:
        agent['default'] = True
        found = True
    else:
        agent.pop('default', None)

if not found:
    print(f"Agent '{agent_id}' not found in config", file=sys.stderr)
    sys.exit(1)

with open('/home/afan/.openclaw/openclaw.json', 'w') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

subprocess.Popen(
    ["bash", "-c", f"systemctl --user restart openclaw-gateway"],
    start_new_session=True,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)

print(f"Switched to agent: {agent_id}")
