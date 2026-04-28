const OPENCLAW_PATH = process.env.OPENCLAW_PATH || (() => {
  throw new Error('OPENCLAW_PATH environment variable is required. Set it in your .env file, e.g. OPENCLAW_PATH=/home/<username>/.openclaw');
})();
const OPENCLAW_WORKSPACES_PATH = process.env.OPENCLAW_WORKSPACES_PATH || (() => {
  throw new Error('OPENCLAW_WORKSPACES_PATH environment variable is required. Set it in your .env file, e.g. OPENCLAW_WORKSPACES_PATH=/home/<username>/workspaces');
})();

export const appConfig = {
  openclawPath: OPENCLAW_PATH,
  workspacesPath: OPENCLAW_WORKSPACES_PATH,
  configJson: `${OPENCLAW_PATH}/openclaw.json`,
  agentsDir: `${OPENCLAW_PATH}/agents`,
  commandHistoryFile: `${OPENCLAW_PATH}/command-history.json`,
  commandFavoritesFile: `${OPENCLAW_PATH}/command-favorites.json`,
  getAgentDir: (agent: string) => `${OPENCLAW_PATH}/agents/${agent}`,
  getAgentSessionsDir: (agent: string) => `${OPENCLAW_PATH}/agents/${agent}/sessions`,
  getAgentMemoryDir: (agent: string) => `${OPENCLAW_PATH}/agents/${agent}/memory`,
  getAgentRecallDir: (agent: string) => `${OPENCLAW_PATH}/agents/${agent}/recall`,
  getSkillDir: (slug: string) => `${OPENCLAW_PATH}/skills/${slug}`,
  getBackupDir: () => `${OPENCLAW_PATH}/backups`,
};
