import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Cpu, HardDrive, Clock, Zap, ChevronDown, ChevronRight,
  RefreshCw, Server, Brain, MessageSquare, Database,
  CheckCircle2, XCircle, AlertCircle, WifiOff, Download
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../api';
import type { GatewayMetrics, SystemResources } from '../types';
import { exportData } from '../utils/export';

const safeNum = (val: unknown, fallback: number = 0): number => {
  if (val === null || val === undefined) return fallback;
  const n = typeof val === 'number' ? val : Number(val);
  return isNaN(n) ? fallback : n;
};

const safeStr = (val: unknown, fallback: string = '-'): string => {
  if (val === null || val === undefined || val === '') return fallback;
  return String(val);
};

const defaultGatewayMetrics: GatewayMetrics = {
  pid: 0,
  memoryMB: 0,
  cpuPercent: 0,
  uptime: '0',
  status: 'stopped',
};

const defaultSystemResources: SystemResources = {
  gateway: { ...defaultGatewayMetrics },
  canvas: { ...defaultGatewayMetrics },
  totalMemoryMB: 0,
  totalSessions: 0,
  totalSessionSizeMB: 0,
  memoryFiles: 0,
  memorySizeKB: 0,
  taskCount: 0,
};

const normalizeMetrics = (m: Partial<GatewayMetrics> | undefined): GatewayMetrics => {
  if (!m) return { ...defaultGatewayMetrics };
  return {
    pid: safeNum(m.pid),
    memoryMB: safeNum(m.memoryMB),
    cpuPercent: safeNum(m.cpuPercent),
    uptime: safeStr(m.uptime, '0'),
    status: m.status === 'running' ? 'running' : 'stopped',
  };
};

const normalizeResources = (r: Partial<SystemResources> | undefined | null): SystemResources => {
  if (!r) return { ...defaultSystemResources };
  return {
    gateway: normalizeMetrics(r.gateway),
    canvas: normalizeMetrics(r.canvas),
    totalMemoryMB: safeNum(r.totalMemoryMB),
    totalSessions: safeNum(r.totalSessions),
    totalSessionSizeMB: safeNum(r.totalSessionSizeMB),
    memoryFiles: safeNum(r.memoryFiles),
    memorySizeKB: safeNum(r.memorySizeKB),
    taskCount: safeNum(r.taskCount),
  };
};

const formatUptime = (uptime: string): string => {
  if (!uptime || uptime === '0' || uptime === '-') return '-';
  const match = uptime.match(/(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)/);
  if (!match) return uptime;
  const days = parseInt(match[1]) || 0;
  const hours = parseInt(match[2]) || 0;
  const mins = parseInt(match[3]) || 0;
  if (days > 0) return `${days}天 ${hours}时`;
  if (hours > 0) return `${hours}时 ${mins}分`;
  return `${mins}分`;
};

const formatTimeAgo = (ts: string | null): string => {
  if (!ts) return '从未';
  const now = Date.now();
  const then = typeof ts === 'number' ? ts : parseInt(ts);
  if (isNaN(then)) return '-';
  const diff = now - then;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
};

const ProcessCard: React.FC<{ name: string; metrics: GatewayMetrics; icon: React.ReactNode; color: string }> = ({ name, metrics, icon, color }) => {
  const isRunning = metrics.status === 'running';
  return (
  <div className="bg-gray-800/40 rounded-xl p-4 border border-white/5">
    <div className="flex items-center gap-2 mb-3">
      <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
      <span className="text-sm font-semibold text-gray-200">{name}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
        <span className={`text-xs ${isRunning ? 'text-emerald-400' : 'text-gray-500'}`}>
          {isRunning ? '运行中' : '已停止'}
        </span>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-xs text-gray-500 mb-0.5">PID</div>
        <div className="text-sm text-gray-300 font-mono">{isRunning ? safeNum(metrics.pid) || '-' : '-'}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-0.5">运行时间</div>
        <div className="text-sm text-gray-300">{isRunning ? formatUptime(metrics.uptime) : '-'}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-0.5">内存</div>
        <div className="text-sm text-gray-300">{isRunning ? `${safeNum(metrics.memoryMB)} MB` : '-'}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-0.5">CPU</div>
        <div className="text-sm text-gray-300">{isRunning ? `${safeNum(metrics.cpuPercent)}%` : '-'}</div>
      </div>
    </div>
  </div>
  );
};

const ResourceBar: React.FC<{ label: string; value: number; max: number; unit: string; color: string }> = ({ label, value, max, unit, color }) => {
  const safeValue = safeNum(value);
  const safeMax = safeNum(max, 1);
  const percent = safeMax > 0 ? Math.min((safeValue / safeMax) * 100, 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-300">{safeValue} {unit}</span>
      </div>
      <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    done: { color: 'text-emerald-400 bg-emerald-400/10', icon: <CheckCircle2 className="w-3 h-3" />, label: '完成' },
    running: { color: 'text-blue-400 bg-blue-400/10', icon: <Zap className="w-3 h-3" />, label: '运行中' },
    error: { color: 'text-red-400 bg-red-400/10', icon: <XCircle className="w-3 h-3" />, label: '错误' },
    aborted: { color: 'text-yellow-400 bg-yellow-400/10', icon: <AlertCircle className="w-3 h-3" />, label: '中断' },
  };
  const c = config[status] || config.done;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.color}`}>
      {c.icon}{c.label}
    </span>
  );
};

const StatBox: React.FC<{ icon: React.ReactNode; label: string; value: number | string; color: string }> = ({ icon, label, value, color }) => (
  <div className="bg-gray-800/30 rounded-lg p-3 border border-white/5">
    <div className={`${color} mb-1`}>{icon}</div>
    <div className="text-lg font-bold text-gray-200">{value}</div>
    <div className="text-[10px] text-gray-500">{label}</div>
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <span className="text-gray-500">{label}:</span>{' '}
    <span className="text-gray-300">{value}</span>
  </div>
);

const MonitorPanel: React.FC = () => {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'sessions'>('overview');

  const { data: rawResources, isLoading: resLoading, isError: resError, refetch: refetchRes } = useQuery({
    queryKey: ['systemResources'],
    queryFn: apiService.getSystemResources,
    staleTime: 30000,
    refetchInterval: 60000,
  });
  const resources = normalizeResources(rawResources);

  const { data: activities = [], isLoading: actLoading, refetch: refetchAct } = useQuery({
    queryKey: ['agentActivities'],
    queryFn: apiService.getAgentActivities,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: sessions = [], isLoading: sessLoading, refetch: refetchSess } = useQuery({
    queryKey: ['recentSessions'],
    queryFn: () => apiService.getRecentSessions(30),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const handleRefreshAll = () => {
    refetchRes();
    refetchAct();
    refetchSess();
  };

  const tabs = [
    { key: 'overview' as const, label: '系统概览', icon: <Activity className="w-4 h-4" /> },
    { key: 'agents' as const, label: 'Agent 活跃度', icon: <Brain className="w-4 h-4" /> },
    { key: 'sessions' as const, label: '会话统计', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-100">实时监控</h2>
            <p className="text-xs text-gray-500">同步 WSL OpenClaw 运行状态</p>
          </div>
        </div>
        <button onClick={handleRefreshAll} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={() => {
            const exportPayload = {
              resources,
              activities,
              sessions,
              exportedAt: new Date().toISOString(),
            };
            exportData(exportPayload, 'openclaw-monitor', 'json');
          }}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          title="导出监控数据"
        >
          <Download className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex gap-1 px-4 py-2 border-b border-white/5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-h-[600px] overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              {resLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
              ) : resError ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <WifiOff className="w-8 h-8 mb-3 text-gray-600" />
                  <p className="text-sm mb-1">无法获取监控数据</p>
                  <p className="text-xs text-gray-600">请确认 OpenClaw 服务正在运行，或点击右上角刷新重试</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ProcessCard name="Gateway" metrics={resources.gateway} icon={<Server className="w-4 h-4 text-white" />} color="bg-cyan-500/20" />
                    <ProcessCard name="Canvas" metrics={resources.canvas} icon={<Cpu className="w-4 h-4 text-white" />} color="bg-purple-500/20" />
                  </div>
                  <div className="bg-gray-800/40 rounded-xl p-4 border border-white/5">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-blue-400" />资源使用
                    </h3>
                    <ResourceBar label="Gateway 内存" value={resources.gateway.memoryMB} max={2048} unit="MB" color="bg-cyan-500" />
                    <ResourceBar label="Canvas 内存" value={resources.canvas.memoryMB} max={512} unit="MB" color="bg-purple-500" />
                    <ResourceBar label="会话数据" value={Math.round(resources.totalSessionSizeMB)} max={500} unit="MB" color="bg-amber-500" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatBox icon={<MessageSquare className="w-4 h-4" />} label="总会话数" value={safeNum(resources.totalSessions)} color="text-emerald-400" />
                    <StatBox icon={<Database className="w-4 h-4" />} label="记忆文件" value={safeNum(resources.memoryFiles)} color="text-blue-400" />
                    <StatBox icon={<Brain className="w-4 h-4" />} label="记忆大小" value={`${safeNum(resources.memorySizeKB)}KB`} color="text-purple-400" />
                    <StatBox icon={<Clock className="w-4 h-4" />} label="任务数" value={safeNum(resources.taskCount)} color="text-amber-400" />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'agents' && (
            <motion.div key="agents" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              {actLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">暂无 Agent 数据，启动 OpenClaw 服务后数据会自动同步</div>
              ) : (
                <div className="space-y-2">
                  {activities
                    .sort((a, b) => (safeNum(b.activeSessionCount) || safeNum(b.sessionCount)) - (safeNum(a.activeSessionCount) || safeNum(a.sessionCount)))
                    .map(agent => (
                      <div key={agent.agentId} className="bg-gray-800/30 rounded-xl border border-white/5 overflow-hidden">
                        <button
                          onClick={() => setExpandedAgent(expandedAgent === agent.agentId ? null : agent.agentId)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                        >
                          <span className="text-lg">{agent.emoji || '🤖'}</span>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-200">{agent.agentName || agent.agentId}</span>
                              {safeNum(agent.activeSessionCount) > 0 && (
                                <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] rounded font-medium">活跃</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {agent.currentModel && <span className="mr-2">🧠 {agent.currentModel}</span>}
                              <span>{safeNum(agent.sessionCount)} 会话</span>
                              <span className="mx-1">·</span>
                              <span>{safeNum(agent.totalSessionSizeKB).toFixed(0)}KB</span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">{formatTimeAgo(agent.lastActiveAt)}</div>
                          {expandedAgent === agent.agentId ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                        </button>
                        <AnimatePresence>
                          {expandedAgent === agent.agentId && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="px-4 pb-3 grid grid-cols-2 gap-2 text-xs">
                                <InfoRow label="Agent ID" value={agent.agentId} />
                                <InfoRow label="状态" value={agent.currentStatus || '-'} />
                                <InfoRow label="活跃会话" value={`${safeNum(agent.activeSessionCount)}`} />
                                <InfoRow label="总会话数" value={`${safeNum(agent.sessionCount)}`} />
                                <InfoRow label="当前模型" value={agent.currentModel || '-'} />
                                <InfoRow label="数据大小" value={`${safeNum(agent.totalSessionSizeKB).toFixed(1)} KB`} />
                                <InfoRow label="最后活跃" value={formatTimeAgo(agent.lastActiveAt)} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'sessions' && (
            <motion.div key="sessions" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              {sessLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">最近 {sessions.length} 个会话</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-white/5">
                          <th className="text-left py-2 px-2 font-medium">Agent</th>
                          <th className="text-left py-2 px-2 font-medium">模型</th>
                          <th className="text-left py-2 px-2 font-medium">状态</th>
                          <th className="text-left py-2 px-2 font-medium">渠道</th>
                          <th className="text-left py-2 px-2 font-medium">大小</th>
                          <th className="text-left py-2 px-2 font-medium">更新</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map(s => (
                          <tr key={s.sessionId} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                            <td className="py-2 px-2 text-gray-300">{s.agentId || '-'}</td>
                            <td className="py-2 px-2 text-gray-400 font-mono text-[11px]">{s.model || '-'}</td>
                            <td className="py-2 px-2"><StatusBadge status={s.status || 'done'} /></td>
                            <td className="py-2 px-2 text-gray-400">{s.channel || '-'}</td>
                            <td className="py-2 px-2 text-gray-400">{safeNum(s.sizeKB).toFixed(1)}KB</td>
                            <td className="py-2 px-2 text-gray-500">{formatTimeAgo(s.updatedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {sessions.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">暂无会话数据</div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default MonitorPanel;
