import axios from 'axios';
import type { ServiceStatus, OverviewData, ConfigData, OperationLog, AgentInfo, SkillInfo, WorkspaceInfo, ModelProvider, ModelDefinition, ModelAlias, AgentModelInfo, DetectProviderResult, SystemResources, AgentActivity, GatewayMetrics, ConfigBackup, ConfigDiff, ConfigSection, CommandEntry, CommandHistoryEntry, CommandResult, SkillDetail, MemoryEntry, RecallEntry, MemoryStatus, MemorySearchResult, SessionInfo, AppNotification, AgentBinding, AgentMessage, WorkflowStep, AgentWorkflow, AppSettings, AutomationRule, AutomationLog, GitHubSkillRecommendation, WorkspaceStat, WorkspaceBackup, ScannedWorkspace, SkillStat, SkillRecommendation, SkillAnalysis, WorkflowInfo, TaskInfo, SearchResultItem, HealthCheckConfig, HealthCheckResult, HealthCheckHistoryEntry, MemoryDiagnostic } from '../types';

const API_KEY = import.meta.env.VITE_API_KEY || '';

const api = axios.create({
  baseURL: '/api',
  headers: API_KEY ? { 'x-api-key': API_KEY } : {},
  timeout: 25000,
});

api.interceptors.request.use((config) => {
  return config;
}, (error) => {
  return Promise.reject(error);
});

const RETRYABLE_STATUS = [408, 429, 500, 502, 503, 504];
const MAX_RETRIES = 2;

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;
    if (!config || config.__retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }
    const status = error.response?.status;
    if (!RETRYABLE_STATUS.includes(status)) {
      return Promise.reject(error);
    }
    config.__retryCount = config.__retryCount || 0;
    config.__retryCount += 1;
    const delay = Math.min(1000 * Math.pow(2, config.__retryCount), 5000);
    await new Promise(resolve => setTimeout(resolve, delay));
    return api(config);
  }
);

export const apiService = {
  getOverview: async (): Promise<OverviewData> => {
    const res = await api.get('/overview');
    return res.data;
  },

  getServices: async (): Promise<ServiceStatus[]> => {
    const res = await api.get('/services');
    return res.data;
  },

  startService: async (name: string): Promise<void> => {
    await api.post(`/services/${name}/start`);
  },

  stopService: async (name: string): Promise<void> => {
    await api.post(`/services/${name}/stop`);
  },

  restartService: async (name: string): Promise<void> => {
    await api.post(`/services/${name}/restart`);
  },

  getConfig: async (): Promise<ConfigData> => {
    const res = await api.get('/config');
    return res.data;
  },

  getLogs: async (): Promise<OperationLog[]> => {
    const res = await api.get('/logs');
    return res.data;
  },

  getOperations: async (): Promise<OperationLog[]> => {
    const res = await api.get('/operations');
    return res.data;
  },

  getAgents: async (): Promise<AgentInfo[]> => {
    const res = await api.get('/agents');
    return res.data;
  },

  getActiveAgent: async (): Promise<string> => {
    const res = await api.get('/agents/active');
    return res.data.activeAgent;
  },

  switchAgent: async (agentId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post('/agents/switch', { agentId });
    return res.data;
  },

  waitForGateway: async (): Promise<{ ready: boolean; message: string }> => {
    const res = await api.get('/agents/wait-gateway', { timeout: 90000 });
    return res.data;
  },

  getAgentStats: async (): Promise<{
    agents: { id: string; name: string; sessionCount: number; memoryCount: number; totalMemorySize: number; lastActive: string | null; switchCount: number }[];
    summary: { totalAgents: number; totalSessions: number; totalMemorySize: number; totalSwitches: number };
  }> => {
    const res = await api.get('/agents/stats');
    return res.data;
  },

  getSkills: async (): Promise<SkillInfo[]> => {
    const res = await api.get('/skills');
    return res.data;
  },

  getWorkspaces: async (): Promise<WorkspaceInfo[]> => {
    const res = await api.get('/workspaces');
    return res.data;
  },

  getModelProviders: async (): Promise<ModelProvider[]> => {
    const res = await api.get('/models/providers');
    return res.data;
  },

  getModelAliases: async (): Promise<ModelAlias[]> => {
    const res = await api.get('/models/aliases');
    return res.data;
  },

  getAgentModels: async (): Promise<AgentModelInfo[]> => {
    const res = await api.get('/models/agent-models');
    return res.data;
  },

  detectProvider: async (baseUrl: string, apiKey: string): Promise<DetectProviderResult> => {
    const res = await api.post('/models/detect', { baseUrl, apiKey }, { timeout: 30000 });
    return res.data;
  },

  addModelProvider: async (name: string, baseUrl: string, apiKey: string): Promise<ModelProvider> => {
    const res = await api.post('/models/providers', { name, baseUrl, apiKey }, { timeout: 30000 });
    return res.data;
  },

  removeModelProvider: async (name: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/models/providers/${name}`);
    return res.data;
  },

  refreshProviderModels: async (name: string): Promise<{ providerName: string; models: ModelDefinition[] }> => {
    const res = await api.post(`/models/providers/${name}/refresh`, {}, { timeout: 30000 });
    return res.data;
  },

  setAgentModel: async (agentId: string, modelId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post('/models/set-agent-model', { agentId, modelId });
    return res.data;
  },

  getSystemResources: async (): Promise<SystemResources> => {
    const res = await api.get('/monitor/resources');
    return res.data;
  },

  getAgentActivities: async (): Promise<AgentActivity[]> => {
    const res = await api.get('/monitor/agent-activities');
    return res.data;
  },

  getRecentSessions: async (limit: number = 20): Promise<SessionInfo[]> => {
    const res = await api.get('/monitor/sessions', { params: { limit } });
    return res.data;
  },

  getGatewayMetrics: async (): Promise<GatewayMetrics> => {
    const res = await api.get('/monitor/gateway');
    return res.data;
  },

  getConfigSections: async (): Promise<ConfigSection[]> => {
    const res = await api.get('/config-manage/sections');
    return res.data;
  },

  getConfigJson: async (section?: string): Promise<Record<string, unknown>> => {
    const res = await api.get('/config-manage/json', { params: section ? { section } : {} });
    return res.data;
  },

  updateConfigSection: async (section: string, data: Record<string, unknown>): Promise<{ success: boolean; message: string }> => {
    const res = await api.put(`/config-manage/section/${section}`, data);
    return res.data;
  },

  getConfigBackups: async (): Promise<ConfigBackup[]> => {
    const res = await api.get('/config-manage/backups');
    return res.data;
  },

  createConfigBackup: async (label?: string): Promise<ConfigBackup> => {
    const res = await api.post('/config-manage/backups', { label });
    return res.data;
  },

  restoreConfigBackup: async (backupId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/config-manage/backups/${backupId}/restore`);
    return res.data;
  },

  deleteConfigBackup: async (backupId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/config-manage/backups/${backupId}`);
    return res.data;
  },

  diffConfigBackups: async (backupId1: string, backupId2: string): Promise<ConfigDiff[]> => {
    const res = await api.post('/config-manage/diff', { backupId1, backupId2 });
    return res.data;
  },

  exportConfig: async (): Promise<{ config: Record<string, unknown>; timestamp: string; version: string }> => {
    const res = await api.get('/config-manage/export');
    return res.data;
  },

  importConfig: async (config: Record<string, unknown>, merge?: boolean): Promise<{ success: boolean; message: string }> => {
    const res = await api.post('/config-manage/import', { config, merge });
    return res.data;
  },

  hotReloadConfig: async (): Promise<{ success: boolean; results: { service: string; success: boolean; message: string }[]; timestamp: string }> => {
    const res = await api.post('/config-manage/hot-reload');
    return res.data;
  },

  hotReloadService: async (serviceName: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/config-manage/hot-reload/service/${serviceName}`);
    return res.data;
  },

  getCommandList: async (): Promise<CommandEntry[]> => {
    const res = await api.get('/command-palette/commands');
    return res.data;
  },

  executeCommand: async (command: string, timeout?: number): Promise<CommandResult> => {
    const res = await api.post('/command-palette/execute', { command, timeout });
    return res.data;
  },

  getCommandHistory: async (limit?: number): Promise<CommandHistoryEntry[]> => {
    const res = await api.get('/command-palette/history', { params: limit ? { limit } : {} });
    return res.data;
  },

  clearCommandHistory: async (): Promise<{ success: boolean }> => {
    const res = await api.delete('/command-palette/history');
    return res.data;
  },

  getCommandFavorites: async (): Promise<CommandEntry[]> => {
    const res = await api.get('/command-palette/favorites');
    return res.data;
  },

  addCommandFavorite: async (entry: CommandEntry): Promise<CommandEntry[]> => {
    const res = await api.post('/command-palette/favorites', entry);
    return res.data;
  },

  removeCommandFavorite: async (id: string): Promise<CommandEntry[]> => {
    const res = await api.delete(`/command-palette/favorites/${id}`);
    return res.data;
  },

  getInstalledSkills: async (): Promise<SkillDetail[]> => {
    const res = await api.get('/skill-enhance/installed');
    return res.data;
  },

  getSkillDetail: async (slug: string): Promise<SkillDetail> => {
    const res = await api.get(`/skill-enhance/detail/${slug}`);
    return res.data;
  },

  getSkillFile: async (slug: string, filename: string): Promise<{ content: string }> => {
    const res = await api.get(`/skill-enhance/file/${slug}/${filename}`);
    return res.data;
  },

  updateSkillFile: async (slug: string, filename: string, content: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.put(`/skill-enhance/file/${slug}/${filename}`, { content });
    return res.data;
  },

  getSkillDependencies: async (): Promise<Record<string, string[]>> => {
    const res = await api.get('/skill-enhance/dependencies');
    return res.data;
  },

  searchSkills: async (query: string): Promise<SearchResultItem[]> => {
    const res = await api.get('/skill-enhance/search', { params: { q: query } });
    return res.data;
  },

  installSkill: async (slug: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post('/skill-enhance/install', { slug });
    return res.data;
  },

  uninstallSkill: async (slug: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/skill-enhance/uninstall/${slug}`);
    return res.data;
  },

  getMemoryStatus: async (): Promise<MemoryStatus[]> => {
    const res = await api.get('/memory/status');
    return res.data;
  },

  getMemoryDiagnostic: async (): Promise<MemoryDiagnostic> => {
    const res = await api.get('/memory/diagnostic');
    return res.data;
  },

  getMemoryEntries: async (agent: string): Promise<MemoryEntry[]> => {
    const res = await api.get(`/memory/entries/${agent}`);
    return res.data;
  },

  getMemoryFile: async (agent: string, path: string): Promise<{ content: string }> => {
    const res = await api.get(`/memory/file/${agent}`, { params: { path } });
    return res.data;
  },

  getRecallEntries: async (agent: string): Promise<RecallEntry[]> => {
    const res = await api.get(`/memory/recall/${agent}`);
    return res.data;
  },

  searchMemory: async (query: string, agent?: string): Promise<MemorySearchResult[]> => {
    const res = await api.get('/memory/search', { params: { q: query, agent } });
    return res.data;
  },

  getSessions: async (agent: string): Promise<SessionInfo[]> => {
    const res = await api.get(`/memory/sessions/${agent}`);
    return res.data;
  },

  deleteMemoryEntry: async (agent: string, path: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/memory/entry/${agent}`, { params: { path } });
    return res.data;
  },

  cleanOldMemories: async (agent: string, maxAgeDays: number = 30): Promise<{ success: boolean; deleted: number; message: string }> => {
    const res = await api.post(`/memory/clean/${agent}`, { maxAgeDays });
    return res.data;
  },

  reindexMemory: async (agent?: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post('/memory/reindex', { agent });
    return res.data;
  },

  getNotifications: async (limit: number = 50): Promise<AppNotification[]> => {
    const res = await api.get('/notifications', { params: { limit } });
    return res.data;
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const res = await api.get('/notifications/unread-count');
    return res.data;
  },

  markNotificationRead: async (id: string): Promise<{ success: boolean }> => {
    const res = await api.put(`/notifications/read/${id}`);
    return res.data;
  },

  markAllNotificationsRead: async (): Promise<{ success: boolean }> => {
    const res = await api.put('/notifications/read-all');
    return res.data;
  },

  clearNotifications: async (): Promise<{ success: boolean }> => {
    const res = await api.delete('/notifications');
    return res.data;
  },

  createNotification: async (notification: { type: string; title: string; message: string; agent?: string; service?: string }): Promise<AppNotification> => {
    const res = await api.post('/notifications', notification);
    return res.data;
  },

  getCollaborationBindings: async (): Promise<AgentBinding[]> => {
    const res = await api.get('/collaboration/bindings');
    return res.data;
  },

  addCollaborationBinding: async (agent: string, binding: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post('/collaboration/bindings', { agent, binding });
    return res.data;
  },

  removeCollaborationBinding: async (agent: string, binding: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete('/collaboration/bindings', { data: { agent, binding } });
    return res.data;
  },

  getCollaborationAgents: async (): Promise<string[]> => {
    const res = await api.get('/collaboration/agents');
    return res.data;
  },

  sendAgentMessage: async (fromAgent: string, toAgent: string, message: string, options?: { channel?: string; deliver?: boolean; sessionId?: string }): Promise<{ success: boolean; message: string; result?: Record<string, unknown> }> => {
    const res = await api.post('/collaboration/send', { fromAgent, toAgent, message, ...options });
    return res.data;
  },

  broadcastMessage: async (message: string, targets: string[], channel?: string): Promise<{ success: boolean; message: string; results?: Record<string, unknown>[] }> => {
    const res = await api.post('/collaboration/broadcast', { message, targets, channel });
    return res.data;
  },

  getAgentMessages: async (agent: string, limit?: number): Promise<AgentMessage[]> => {
    const res = await api.get(`/collaboration/messages/${agent}`, { params: { limit } });
    return res.data;
  },

  executeWorkflow: async (name: string, steps: WorkflowStep[]): Promise<AgentWorkflow> => {
    const res = await api.post('/collaboration/workflow', { name, steps });
    return res.data;
  },

  getSettings: async (): Promise<AppSettings> => {
    const res = await api.get('/settings');
    return res.data;
  },

  updateSettings: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
    const res = await api.put('/settings', settings);
    return res.data;
  },

  getSettingsAgents: async (): Promise<string[]> => {
    const res = await api.get('/settings/agents');
    return res.data;
  },

  setDefaultAgent: async (agent: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.put('/settings/default-agent', { agent });
    return res.data;
  },

  setAutoStart: async (enabled: boolean): Promise<{ success: boolean; message: string }> => {
    const res = await api.put('/settings/auto-start', { enabled });
    return res.data;
  },

  getAutomationRules: async (): Promise<AutomationRule[]> => {
    const res = await api.get('/automation/rules');
    return res.data;
  },

  createAutomationRule: async (rule: Omit<AutomationRule, 'id' | 'lastTriggered' | 'triggerCount' | 'createdAt' | 'updatedAt'>): Promise<AutomationRule> => {
    const res = await api.post('/automation/rules', rule);
    return res.data;
  },

  updateAutomationRule: async (id: number, updates: Partial<AutomationRule>): Promise<AutomationRule> => {
    const res = await api.put(`/automation/rules/${id}`, updates);
    return res.data;
  },

  deleteAutomationRule: async (id: number): Promise<{ success: boolean }> => {
    const res = await api.delete(`/automation/rules/${id}`);
    return res.data;
  },

  executeAutomationRule: async (id: number): Promise<{ success: boolean; result: string }> => {
    const res = await api.post(`/automation/rules/${id}/execute`);
    return res.data;
  },

  triggerAutomationEvent: async (event: string, data?: Record<string, unknown>): Promise<{ success: boolean }> => {
    const res = await api.post('/automation/event', { event, data });
    return res.data;
  },

  getAutomationLogs: async (ruleId?: number): Promise<AutomationLog[]> => {
    const params = ruleId ? { ruleId } : {};
    const res = await api.get('/automation/logs', { params });
    return res.data;
  },

  getWorkflows: async (): Promise<WorkflowInfo[]> => {
    const res = await api.get('/workflow/workflows');
    return res.data;
  },

  createWorkflow: async (workflow: { name: string; description?: string; steps: unknown[] }): Promise<WorkflowInfo> => {
    const res = await api.post('/workflow/workflows', workflow);
    return res.data;
  },

  executeWorkflowById: async (id: number): Promise<{ success: boolean; taskId: number; message: string }> => {
    const res = await api.post(`/workflow/workflows/${id}/execute`);
    return res.data;
  },

  getTasks: async (limit = 50): Promise<TaskInfo[]> => {
    const res = await api.get('/workflow/tasks', { params: { limit } });
    return res.data;
  },

  getWorkspaceStats: async (): Promise<WorkspaceStat[]> => {
    const res = await api.get('/workspace-manage/stats');
    return res.data;
  },

  scanWorkspaces: async (): Promise<ScannedWorkspace[]> => {
    const res = await api.get('/workspace-manage/scan');
    return res.data;
  },

  getWorkspaceBackups: async (): Promise<WorkspaceBackup[]> => {
    const res = await api.get('/workspace-manage/backups');
    return res.data;
  },

  createWorkspaceBackup: async (workspace: string): Promise<WorkspaceBackup> => {
    const res = await api.post('/workspace-manage/backups', { workspace });
    return res.data;
  },

  restoreWorkspaceBackup: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/workspace-manage/backups/${id}/restore`);
    return res.data;
  },

  switchWorkspace: async (workspace: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post('/workspace-manage/switch', { workspace });
    return res.data;
  },

  getSkillStats: async (): Promise<SkillStat[]> => {
    const res = await api.get('/skill-evaluation/stats');
    return res.data;
  },

  getSkillEvalRecommendations: async (count = 5): Promise<SkillRecommendation[]> => {
    const res = await api.get('/skill-evaluation/recommendations', { params: { count } });
    return res.data;
  },

  analyzeSkill: async (skill: string): Promise<SkillAnalysis> => {
    const res = await api.get(`/skill-evaluation/analyze/${skill}`);
    return res.data;
  },

  executeSkill: async (skill: string, params?: string): Promise<{ success: boolean; output: string; executionTimeMs: number }> => {
    const res = await api.post('/skill-evaluation/execute', { skill, params });
    return res.data;
  },

  rateSkill: async (skill: string, rating: number): Promise<void> => {
    await api.put(`/skill-evaluation/rating/${skill}`, { rating });
  },

  getSkillRecommendations: async (count = 6): Promise<GitHubSkillRecommendation[]> => {
    const res = await api.get('/skill-recommendation/recommendations', { params: { count } });
    return res.data;
  },

  getTrendingSkills: async (): Promise<GitHubSkillRecommendation[]> => {
    const res = await api.get('/skill-recommendation/trending');
    return res.data;
  },

  searchSkillRecommendations: async (query: string): Promise<GitHubSkillRecommendation[]> => {
    const res = await api.get('/skill-recommendation/search', { params: { q: query } });
    return res.data;
  },

  getHealthCheckConfig: async (): Promise<HealthCheckConfig> => {
    const res = await api.get('/health-check/config');
    return res.data;
  },

  updateHealthCheckConfig: async (config: Partial<HealthCheckConfig>): Promise<HealthCheckConfig> => {
    const res = await api.put('/health-check/config', config);
    return res.data;
  },

  getHealthCheckStatus: async (): Promise<HealthCheckResult[]> => {
    const res = await api.get('/health-check/status');
    return res.data;
  },

  triggerHealthCheck: async (): Promise<HealthCheckResult[]> => {
    const res = await api.post('/health-check/check');
    return res.data;
  },

  resetHealthRecovery: async (serviceName: string): Promise<{ success: boolean }> => {
    const res = await api.post(`/health-check/reset/${serviceName}`);
    return res.data;
  },

  getHealthCheckHistory: async (limit = 100): Promise<HealthCheckHistoryEntry[]> => {
    const res = await api.get('/health-check/history', { params: { limit } });
    return res.data;
  },
};
