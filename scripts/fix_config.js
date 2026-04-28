const { execSync, spawnSync } = require('child_process');
const openclawPath = process.env.OPENCLAW_PATH || '/home/<username>/.openclaw';
const out = execSync(`wsl -- bash -c "cat ${openclawPath}/openclaw.json"`, { encoding: 'utf8', timeout: 10000 });
const config = JSON.parse(out);
if (config.gateway && config.gateway.defaultAgent !== undefined) {
  delete config.gateway.defaultAgent;
  const newJson = JSON.stringify(config, null, 2);
  const child = spawnSync('wsl', ['--', 'bash', '-c', `cat > ${openclawPath}/openclaw.json`], {
    input: newJson,
    encoding: 'utf8',
  });
  console.log('Removed gateway.defaultAgent, exit code:', child.status);
} else {
  console.log('No defaultAgent found in gateway config');
}
