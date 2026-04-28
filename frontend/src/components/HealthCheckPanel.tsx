import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, HeartPulse, Settings, RefreshCw, ShieldAlert,
  ShieldCheck, ShieldOff, RotateCcw, AlertTriangle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import type { HealthCheckConfig } from '../types';

const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  healthy: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <ShieldCheck className="w-4 h-4" />, label: '健康' },
  degraded: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: <AlertTriangle className="w-4 h-4" />, label: '降级' },
  down: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: <ShieldAlert className="w-4 h-4" />, label: '宕机' },
  recovering: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: <RotateCcw className="w-4 h-4 animate-spin" />, label: '恢复中' },
  disabled: { color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20', icon: <ShieldOff className="w-4 h-4" />, label: '已禁用' },
};

const HealthCheckPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);
  const [editConfig, setEditConfig] = useState<HealthCheckConfig | null>(null);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['healthCheckConfig'],
    queryFn: apiService.getHealthCheckConfig,
    staleTime: 30000,
  });

  const { data: results = [], isLoading: statusLoading } = useQuery({
    queryKey: ['healthCheckStatus'],
    queryFn: apiService.getHealthCheckStatus,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const updateConfigMutation = useMutation({
    mutationFn: (cfg: Partial<HealthCheckConfig>) => apiService.updateHealthCheckConfig(cfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['healthCheckConfig'] });
      queryClient.invalidateQueries({ queryKey: ['healthCheckStatus'] });
    },
  });

  const triggerCheckMutation = useMutation({
    mutationFn: () => apiService.triggerHealthCheck(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['healthCheckStatus'] });
    },
  });

  const resetRecoveryMutation = useMutation({
    mutationFn: (serviceName: string) => apiService.resetHealthRecovery(serviceName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['healthCheckStatus'] });
    },
  });

  const handleSaveConfig = () => {
    if (!editConfig) return;
    updateConfigMutation.mutate(editConfig);
    setShowConfig(false);
    setEditConfig(null);
  };

  const openConfigEditor = () => {
    if (!config) return;
    setEditConfig({ ...config });
    setShowConfig(true);
  };

  const overallStatus = results.length === 0
    ? 'disabled'
    : results.some(r => r.status === 'down')
      ? 'down'
      : results.some(r => r.status === 'recovering')
        ? 'recovering'
        : results.some(r => r.status === 'degraded')
          ? 'degraded'
          : results.every(r => r.status === 'healthy' || r.status === 'disabled')
            ? 'healthy'
            : 'degraded';

  const overall = statusConfig[overallStatus] || statusConfig.disabled;

  if (configLoading || statusLoading) {
    return (
      <div className="bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 animate-pulse">
          <Heart className="w-5 h-5 text-gray-600" />
          <div className="h-5 bg-gray-700/50 rounded w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${overall.bg}`}>
            <HeartPulse className={`w-5 h-5 ${overall.color}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              健康检查
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${overall.bg} ${overall.color}`}>
                {overall.icon}
                {overall.label}
              </span>
            </h2>
            <p className="text-xs text-gray-500">
              {config?.enabled ? `每 ${((config?.intervalMs || 30000) / 1000).toFixed(0)}s 检查一次` : '已禁用'}
              {config?.autoRecover && config?.enabled && ' · 自动恢复开启'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerCheckMutation.mutate()}
            disabled={triggerCheckMutation.isPending}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${triggerCheckMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openConfigEditor}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {results.map(result => {
            const sc = statusConfig[result.status] || statusConfig.disabled;
            return (
              <div key={result.serviceName} className={`rounded-xl p-4 border ${sc.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {sc.icon}
                    <span className="text-sm font-semibold text-gray-200">{result.serviceName}</span>
                  </div>
                  <span className={`text-xs font-medium ${sc.color}`}>{sc.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">连续失败</span>
                    <span className={`ml-1 ${result.consecutiveFailures > 0 ? 'text-red-400' : 'text-gray-300'}`}>
                      {result.consecutiveFailures}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">恢复尝试</span>
                    <span className={`ml-1 ${result.recoveryAttempts > 0 ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {result.recoveryAttempts}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">最后检查</span>
                    <span className="ml-1 text-gray-300">
                      {result.lastCheck ? new Date(result.lastCheck).toLocaleTimeString() : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">最后故障</span>
                    <span className="ml-1 text-gray-300">
                      {result.lastFailure ? new Date(result.lastFailure).toLocaleTimeString() : '-'}
                    </span>
                  </div>
                </div>
                {result.recoveryAttempts > 0 && (
                  <button
                    onClick={() => resetRecoveryMutation.mutate(result.serviceName)}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    重置恢复计数
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {results.length === 0 && (
          <div className="text-center py-6 text-gray-500 text-sm">
            {config?.enabled ? '等待首次健康检查...' : '健康检查已禁用，点击 ⚙️ 开启'}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showConfig && editConfig && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-300">健康检查配置</h3>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-300">启用健康检查</div>
                  <div className="text-xs text-gray-500">定时检测服务存活状态</div>
                </div>
                <button
                  onClick={() => setEditConfig({ ...editConfig, enabled: !editConfig.enabled })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    editConfig.enabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                  }`}
                >
                  {editConfig.enabled ? '已开启' : '已关闭'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-300">自动恢复</div>
                  <div className="text-xs text-gray-500">服务异常时自动重启</div>
                </div>
                <button
                  onClick={() => setEditConfig({ ...editConfig, autoRecover: !editConfig.autoRecover })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    editConfig.autoRecover
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                  }`}
                >
                  {editConfig.autoRecover ? '已开启' : '已关闭'}
                </button>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-1">检查间隔（秒）</label>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={editConfig.intervalMs / 1000}
                  onChange={e => setEditConfig({ ...editConfig, intervalMs: Math.max(10, parseInt(e.target.value) || 30) * 1000 })}
                  className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-1">最大重启尝试次数</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={editConfig.maxRestartAttempts}
                  onChange={e => setEditConfig({ ...editConfig, maxRestartAttempts: Math.max(1, Math.min(10, parseInt(e.target.value) || 3)) })}
                  className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-1">重启冷却时间（分钟）</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={editConfig.restartCooldownMs / 60000}
                  onChange={e => setEditConfig({ ...editConfig, restartCooldownMs: Math.max(1, parseInt(e.target.value) || 5) * 60000 })}
                  className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">监控的服务</label>
                <div className="space-y-2">
                  {editConfig.services.map((svc, idx) => (
                    <div key={svc.name} className="flex items-center justify-between bg-gray-800/30 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-300">{svc.name}</span>
                      <button
                        onClick={() => {
                          const newServices = [...editConfig.services];
                          newServices[idx] = { ...newServices[idx], enabled: !newServices[idx].enabled };
                          setEditConfig({ ...editConfig, services: newServices });
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                          svc.enabled
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-gray-700/50 text-gray-500'
                        }`}
                      >
                        {svc.enabled ? '监控中' : '已忽略'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveConfig}
                  disabled={updateConfigMutation.isPending}
                  className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  保存配置
                </button>
                <button
                  onClick={() => { setShowConfig(false); setEditConfig(null); }}
                  className="px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HealthCheckPanel;
