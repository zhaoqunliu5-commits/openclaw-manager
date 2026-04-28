const { execSync } = require('child_process');
const out = execSync('wsl -- bash -c "openclaw config schema 2>/dev/null"', { encoding: 'utf8', timeout: 15000, maxBuffer: 50*1024*1024 });
const schema = JSON.parse(out);
const agents = schema.properties?.agents;
console.log('agents.defaults:', JSON.stringify(agents?.properties?.defaults, null, 2)?.substring(0, 500));
console.log('agents.list:', JSON.stringify(agents?.properties?.list, null, 2)?.substring(0, 500));
