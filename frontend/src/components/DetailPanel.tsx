import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertTriangle, Cpu, Zap, Layers, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import type { AgentInfo, SkillInfo, WorkspaceInfo } from '../types';

type PanelType = 'agents' | 'skills' | 'workspaces' | null;

interface DetailPanelProps {
  panelType: PanelType;
  onClose: () => void;
}

const AgentList: React.FC = () => {
  const queryClient = useQueryClient();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchMessage, setSwitchMessage] = useState<string>('');
  const [showStats, setShowStats] = useState(false);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: apiService.getAgents,
  });

  const { data: activeAgent = 'main' } = useQuery({
    queryKey: ['activeAgent'],
    queryFn: apiService.getActiveAgent,
  });

  const { data: agentStats } = useQuery({
    queryKey: ['agentStats'],
    queryFn: apiService.getAgentStats,
    refetchInterval: 30000,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: apiService.getServices,
  });

  const switchMutation = useMutation({
    mutationFn: async (agentId: string) => {
      setSwitchingId(agentId);
      setSwitchMessage('正在切换特工...');
      const switchResult = await apiService.switchAgent(agentId);
      if (!switchResult.success) {
        throw new Error(switchResult.message);
      }
      setSwitchMessage('特工已切换，等待 Gateway 重启就绪...');
      const waitResult = await apiService.waitForGateway();
      return { switchResult, waitResult };
    },
    onSuccess: (data) => {
      const msg = data.waitResult.ready
        ? `切换成功！${data.waitResult.message}`
        : `切换完成，但 Gateway 可能还在启动中`;
      setSwitchMessage(msg);
      queryClient.invalidateQueries({ queryKey: ['activeAgent'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });

      if (data.waitResult.ready) {
        const gateway = services.find(s => s.name === 'openclaw-gateway');
        if (gateway?.url && gateway?.authToken) {
          const url = `${gateway.url}#token=${gateway.authToken}`;
          window.open(url, '_blank');
        }
      }

      setTimeout(() => {
        setSwitchingId(null);
        setSwitchMessage('');
      }, 3000);
    },
    onError: (error: any) => {
      setSwitchMessage(`切换失败: ${error.message || '未知错误'}`);
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      setTimeout(() => {
        setSwitchingId(null);
        setSwitchMessage('');
      }, 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setShowStats(!showStats)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition-all"
        >
          📊 {showStats ? '隐藏统计' : '性能统计'}
        </button>
      </div>

      <AnimatePresence>
        {showStats && agentStats && agentStats.summary && agentStats.agents && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-xl p-4 mb-3 space-y-4">
              <h4 className="text-sm font-semibold text-white">Agent 性能概览</h4>

              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                  <div className="text-xl font-bold text-cyan-400">{agentStats.summary.totalAgents ?? 0}</div>
                  <div className="text-[10px] text-gray-400">总 Agent</div>
                </div>
                <div className="text-center p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <div className="text-xl font-bold text-purple-400">{agentStats.summary.totalSessions ?? 0}</div>
                  <div className="text-[10px] text-gray-400">总会话</div>
                </div>
                <div className="text-center p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <div className="text-xl font-bold text-emerald-400">{((agentStats.summary.totalMemorySize ?? 0) / 1024).toFixed(1)}K</div>
                  <div className="text-[10px] text-gray-400">记忆总量</div>
                </div>
                <div className="text-center p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <div className="text-xl font-bold text-orange-400">{agentStats.summary.totalSwitches ?? 0}</div>
                  <div className="text-[10px] text-gray-400">切换次数</div>
                </div>
              </div>

              {agentStats.agents.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs text-gray-400">各 Agent 活跃度</h5>
                  {agentStats.agents.map(stat => {
                    const maxSessions = Math.max(...agentStats.agents.map(a => a.sessionCount ?? 0), 1);
                    const maxSwitches = Math.max(...agentStats.agents.map(a => a.switchCount ?? 0), 1);
                    return (
                      <div key={stat.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300 font-mono">{stat.name}</span>
                          <span className="text-gray-500">{stat.sessionCount ?? 0} 会话 · {stat.switchCount ?? 0} 切换</span>
                        </div>
                        <div className="flex gap-1 h-2">
                          <div
                            className="bg-cyan-500/60 rounded-full transition-all"
                            style={{ width: `${((stat.sessionCount ?? 0) / maxSessions) * 100}%`, minWidth: (stat.sessionCount ?? 0) > 0 ? '4px' : '0' }}
                            title={`${stat.sessionCount ?? 0} sessions`}
                          />
                          <div
                            className="bg-orange-500/60 rounded-full transition-all"
                            style={{ width: `${((stat.switchCount ?? 0) / maxSwitches) * 100}%`, minWidth: (stat.switchCount ?? 0) > 0 ? '4px' : '0' }}
                            title={`${stat.switchCount ?? 0} switches`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {switchMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 p-3 rounded-xl border ${
            switchMessage.includes('失败')
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
          }`}
        >
          {switchingId ? (
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="text-sm">{switchMessage}</span>
        </motion.div>
      )}
      {agents.map((agent: AgentInfo) => {
        const isActive = agent.id === activeAgent;
        const isSwitching = switchingId === agent.id;

        return (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.01 }}
            onClick={() => !isActive && switchMutation.mutate(agent.id)}
            className={`relative rounded-xl p-4 border transition-all cursor-pointer ${
              isActive
                ? 'bg-cyan-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
            } ${isSwitching ? 'opacity-70 pointer-events-none' : ''}`}
          >
            {isActive && (
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {agent.emoji && <span className="text-base">{agent.emoji}</span>}
                  <span className="font-bold text-white truncate">{agent.name}</span>
                  {agent.isDefault && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                      DEFAULT
                    </span>
                  )}
                  {isActive && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-green-500/20 text-green-300 rounded-full border border-green-500/30">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {agent.identity && (
                    <span className="truncate max-w-[200px]">{agent.identity}</span>
                  )}
                  {agent.model && (
                    <span className="px-1.5 py-0.5 bg-purple-500/15 text-purple-300 rounded border border-purple-500/20 truncate max-w-[150px]">
                      {agent.model}
                    </span>
                  )}
                </div>

                {agent.workspace && (
                  <div className="text-[11px] text-gray-500 mt-1 truncate">
                    📁 {agent.workspace}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-3">
                {isSwitching ? (
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                ) : isActive ? (
                  <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

const SkillList: React.FC = () => {
  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: apiService.getSkills,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  const readySkills = skills.filter((s: SkillInfo) => s.status === 'ready');
  const needsSetupSkills = skills.filter((s: SkillInfo) => s.status === 'needs-setup');

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
      {readySkills.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs text-green-400 font-semibold uppercase tracking-wider">
            <Check className="w-3.5 h-3.5" />
            Ready ({readySkills.length})
          </div>
          <div className="space-y-1.5">
            {readySkills.map((skill: SkillInfo) => (
              <motion.div
                key={skill.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-xl p-3 bg-green-500/5 border border-green-500/15 hover:bg-green-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {skill.emoji && <span className="text-base">{skill.emoji}</span>}
                  <span className="font-semibold text-white text-sm">{skill.name}</span>
                  <span className="text-[10px] text-gray-500 ml-auto">{skill.source}</span>
                </div>
                {skill.description && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{skill.description}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {needsSetupSkills.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs text-yellow-400 font-semibold uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5" />
            Needs Setup ({needsSetupSkills.length})
          </div>
          <div className="space-y-1.5">
            {needsSetupSkills.map((skill: SkillInfo) => (
              <motion.div
                key={skill.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-xl p-3 bg-yellow-500/5 border border-yellow-500/15 hover:bg-yellow-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {skill.emoji && <span className="text-base">{skill.emoji}</span>}
                  <span className="font-semibold text-gray-300 text-sm">{skill.name}</span>
                  <span className="text-[10px] text-gray-500 ml-auto">{skill.source}</span>
                </div>
                {skill.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{skill.description}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const WorkspaceList: React.FC = () => {
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: apiService.getWorkspaces,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
      {workspaces.map((ws: WorkspaceInfo) => (
        <motion.div
          key={ws.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl p-4 bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{ws.name}</span>
                {ws.agentId && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-500/20 text-orange-300 rounded-full border border-orange-500/30">
                    {ws.agentId}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 truncate">
                📁 {ws.path}
              </div>
            </div>
            {ws.lastModified && (
              <div className="text-[10px] text-gray-500 ml-2 whitespace-nowrap">
                {new Date(ws.lastModified).toLocaleDateString()}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const DetailPanel: React.FC<DetailPanelProps> = ({ panelType, onClose }) => {
  const panelConfig = {
    agents: {
      title: '特工列表',
      subtitle: '点击切换活跃特工，热同步到 Gateway',
      icon: Cpu,
      color: 'cyan',
      gradient: 'from-cyan-500/20 to-purple-500/20',
    },
    skills: {
      title: '技能列表',
      subtitle: '查看已安装技能和配置状态',
      icon: Zap,
      color: 'purple',
      gradient: 'from-purple-500/20 to-pink-500/20',
    },
    workspaces: {
      title: '工作空间列表',
      subtitle: '查看各特工关联的工作空间',
      icon: Layers,
      color: 'orange',
      gradient: 'from-orange-500/20 to-yellow-500/20',
    },
  };

  if (!panelType) return null;
  const config = panelConfig[panelType];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        <div className={`absolute -inset-2 bg-gradient-to-r ${config.gradient} rounded-3xl blur-xl opacity-40`}></div>

        <div className="relative glass-card rounded-2xl p-6 overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-${config.color}-500 to-transparent`}></div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-${config.color}-500/20 border border-${config.color}-500/30 flex items-center justify-center`}>
                <Icon className={`w-5 h-5 text-${config.color}-400`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{config.title}</h3>
                <p className="text-xs text-gray-400">{config.subtitle}</p>
              </div>
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </motion.button>
          </div>

          {panelType === 'agents' && <AgentList />}
          {panelType === 'skills' && <SkillList />}
          {panelType === 'workspaces' && <WorkspaceList />}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DetailPanel;
