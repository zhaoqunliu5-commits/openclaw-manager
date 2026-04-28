export interface ServiceStatus {
  name: string;
  isRunning: boolean;
  pid?: number;
  memory?: string;
  uptime?: string;
  url?: string;
  authToken?: string;
}

export interface OverviewData {
  agentCount: number;
  skillCount: number;
  workspaceCount: number;
  runningServiceCount: number;
}

export interface ConfigData {
  gatewayPort: number;
  gatewayMode: string;
  authMode: string;
  enabledPlugins: string[];
  enabledChannels: string[];
}

export interface LogEntry {
  timestamp: string;
  message: string;
}

export interface OperationLog {
  id: number;
  operationType: 'start' | 'stop' | 'restart' | 'switch' | 'wait';
  serviceName: string;
  status: 'success' | 'failure' | 'pending';
  message: string;
  timestamp: string;
  metadata?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  isDefault: boolean;
  model: string;
  workspace: string;
  identity?: string;
  sessionCount: number;
  heartbeatEnabled: boolean;
  emoji?: string;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  status: 'ready' | 'needs-setup' | 'disabled';
  primaryEnv?: string;
  source: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  agentId?: string;
  lastModified?: string;
}

export interface ModelDefinition {
  id: string;
  name: string;
  api: string;
  reasoning: boolean;
  input: string[];
  contextWindow?: number;
  maxTokens?: number;
}

export interface ModelProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  apiType: string;
  models: ModelDefinition[];
}

export interface ModelAlias {
  alias: string;
  provider: string;
  modelId: string;
}

export interface AgentModelInfo {
  agentId: string;
  model: string;
  fallbacks: string[];
}

export interface DetectProviderResult {
  provider: string;
  models: ModelDefinition[];
}

export interface GatewayMetrics {
  pid: number;
  memoryMB: number;
  cpuPercent: number;
  uptime: string;
  status: 'running' | 'stopped';
}

export interface AgentActivity {
  agentId: string;
  agentName: string;
  emoji: string;
  sessionCount: number;
  activeSessionCount: number;
  lastActiveAt: string | null;
  currentModel: string;
  currentStatus: string;
  totalSessionSizeKB: number;
}

export interface SessionInfo {
  sessionId: string;
  agentId: string;
  model: string;
  modelProvider: string;
  status: string;
  channel: string;
  startedAt: string | null;
  updatedAt: string | null;
  sizeKB: number;
}

export interface SystemResources {
  gateway: GatewayMetrics;
  canvas: GatewayMetrics;
  totalMemoryMB: number;
  totalSessions: number;
  totalSessionSizeMB: number;
  memoryFiles: number;
  memorySizeKB: number;
  taskCount: number;
}

export interface ConfigBackup {
  id: string;
  filename: string;
  timestamp: string;
  label: string;
  sizeKB: number;
  sections: string[];
}

export interface ConfigDiff {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'added' | 'removed' | 'changed';
}

export interface ConfigSection {
  key: string;
  description: string;
  hasData: boolean;
}

export interface CommandEntry {
  id: string;
  command: string;
  description: string;
  category: string;
  isFavorite: boolean;
}

export interface CommandHistoryEntry {
  id: string;
  command: string;
  timestamp: string;
  output?: string;
  exitCode?: number;
  duration?: number;
}

export interface CommandResult {
  success: boolean;
  output: string;
  exitCode: number;
  duration: number;
}

export interface SkillDetail {
  slug: string;
  name: string;
  description: string;
  version: string;
  status: string;
  emoji: string;
  source: string;
  homepage?: string;
  configPaths?: string[];
  requires?: { bins?: string[]; skills?: string[] };
  os?: string[];
  files?: string[];
  dependencies?: string[];
  agentAssignments?: string[];
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

export interface MemorySearchResult {
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

export interface AppNotification {
  id: string;
  type: 'service_status' | 'agent_switch' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  agent?: string;
  service?: string;
}

export interface AgentBinding {
  agent: string;
  channel: string;
  accountId?: string;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: string;
  channel?: string;
  sessionId?: string;
}

export interface WorkflowStep {
  agent: string;
  message: string;
  waitForReply: boolean;
  deliverTo?: string;
  deliverChannel?: string;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  status: 'idle' | 'running' | 'completed' | 'failed';
  currentStep: number;
  createdAt: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  defaultAgent: string;
  autoStartServices: boolean;
  notificationPreferences: {
    serviceStatus: boolean;
    agentSwitch: boolean;
    errors: boolean;
    warnings: boolean;
    info: boolean;
  };
  refreshInterval: number;
  language: string;
}

export interface AutomationRule {
  id: number;
  name: string;
  enabled: boolean;
  triggerType: 'cron' | 'event' | 'webhook';
  triggerConfig: string;
  actionType: 'command' | 'notify' | 'switch_agent' | 'restart_service';
  actionConfig: string;
  lastTriggered: string | null;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLog {
  id: number;
  ruleId: number;
  ruleName: string;
  triggerType: string;
  actionType: string;
  status: 'running' | 'success' | 'failed';
  result: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface GitHubSkillRecommendation {
  name: string;
  slug: string;
  description: string;
  repo: string;
  url: string;
  stars: number;
  category: string;
  reason: string;
  installCommand: string;
}

export interface WorkspaceStat {
  workspace: string;
  accessCount: number;
  totalSessions: number;
  avgSessionDuration: number;
  lastAccess: string | null;
}

export interface WorkspaceBackup {
  id: number;
  workspace: string;
  backupPath: string;
  sizeBytes: number | null;
  createdAt: string;
}

export interface ScannedWorkspace {
  name: string;
  path: string;
  size: number;
}

export interface SkillStat {
  skill: string;
  useCount: number;
  successCount: number;
  successRate: number;
  avgExecutionTimeMs: number | null;
  lastUsed: string | null;
  rating: number;
}

export interface SkillRecommendation {
  skill: string;
  useCount: number;
  successRate: number;
  rating: number;
}

export interface SkillAnalysis {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface WorkflowInfo {
  id: number;
  name: string;
  description: string | null;
  steps: WorkflowStep[];
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'idle';
  agentId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TaskInfo {
  id: number;
  workflowId: number | null;
  name: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputData: string | null;
  result: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface SearchResultItem {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  version: string;
  author: string;
  rating: number;
  downloads: number;
  source?: string;
  homepage?: string;
  stars?: number;
  owner?: string;
}

export type LucideIcon = React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>;

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  autoRecover: boolean;
  maxRestartAttempts: number;
  restartCooldownMs: number;
  services: {
    name: string;
    enabled: boolean;
  }[];
}

export interface HealthCheckResult {
  serviceName: string;
  healthy: boolean;
  lastCheck: string;
  consecutiveFailures: number;
  lastFailure: string | null;
  lastRecovery: string | null;
  recoveryAttempts: number;
  status: 'healthy' | 'degraded' | 'down' | 'recovering' | 'disabled';
}

export interface HealthCheckHistoryEntry {
  id: number;
  service_name: string;
  healthy: number;
  response_time_ms: number | null;
  details: string | null;
  checked_at: string;
}

export interface MemoryDiagnostic {
  wslAvailable: boolean;
  openclawPathExists: boolean;
  agentsDirExists: boolean;
  agents: string[];
  error?: string;
}
