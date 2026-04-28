import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import { Folder, Database, Play, RotateCcw, BarChart3, Plus } from 'lucide-react';

export default function WorkspaceManagePanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'stats' | 'backups' | 'scan'>('stats');

  const { data: stats = [] } = useQuery({
    queryKey: ['workspace-stats'],
    queryFn: apiService.getWorkspaceStats,
  });

  const { data: backups = [] } = useQuery({
    queryKey: ['workspace-backups'],
    queryFn: apiService.getWorkspaceBackups,
  });

  const { data: scanned = [], isLoading: scanLoading, refetch: doScan } = useQuery({
    queryKey: ['workspaces-scan'],
    queryFn: apiService.scanWorkspaces,
    enabled: false,
  });

  const switchMutation = useMutation({
    mutationFn: apiService.switchWorkspace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-stats'] }),
  });

  const backupMutation = useMutation({
    mutationFn: apiService.createWorkspaceBackup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-backups'] }),
  });

  const restoreMutation = useMutation({
    mutationFn: apiService.restoreWorkspaceBackup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace-backups'] }),
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  const tabs = [
    { key: 'stats' as const, label: '使用统计', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'backups' as const, label: '备份管理', icon: <Database className="w-4 h-4" /> },
    { key: 'scan' as const, label: '工作区扫描', icon: <Folder className="w-4 h-4" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Folder className="w-6 h-6 text-emerald-400" />
            工作区管理
          </h2>
          <p className="text-gray-400 text-sm mt-1">监控使用情况、创建备份、快速切换工作区</p>
        </div>
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
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">{stats.length}</div>
                <div className="text-xs text-gray-400">已记录工作区</div>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-cyan-400">{stats.reduce((s: number, w: any) => s + w.accessCount, 0)}</div>
                <div className="text-xs text-gray-400">总访问次数</div>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-400">{stats.reduce((s: number, w: any) => s + w.totalSessions, 0)}</div>
                <div className="text-xs text-gray-400">总会话数</div>
              </div>
            </div>

            {stats.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">暂无使用记录</div>
            ) : (
              <div className="space-y-3">
                {stats.map((ws: any) => (
                  <motion.div
                    key={ws.workspace}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-gray-800/50 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Folder className="w-5 h-5 text-emerald-400" />
                        <h4 className="text-white font-medium">{ws.workspace}</h4>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => switchMutation.mutate(ws.workspace)}
                        disabled={switchMutation.isPending}
                        className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 inline mr-1" /> 切换
                      </motion.button>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                        <div className="text-cyan-400 font-bold">{ws.accessCount}</div>
                        <div className="text-gray-500">访问次数</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                        <div className="text-purple-400 font-bold">{ws.totalSessions}</div>
                        <div className="text-gray-500">会话数</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                        <div className="text-orange-400 font-bold">{ws.avgSessionDuration}s</div>
                        <div className="text-gray-500">平均时长</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-2 text-center">
                        <div className="text-gray-300 truncate">{ws.lastAccess ? new Date(ws.lastAccess).toLocaleDateString() : '-'}</div>
                        <div className="text-gray-500">最近访问</div>
                      </div>
                    </div>
                    <div className="mt-2 h-2 bg-gray-900/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                        style={{ width: `${Math.min(100, (ws.accessCount / Math.max(...stats.map((s: any) => s.accessCount), 1)) * 100)}%` }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'backups' && (
          <div className="space-y-4">
            {backups.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">暂无备份</div>
            ) : (
              <div className="space-y-3">
                {backups.map((backup: any) => (
                  <div key={backup.id} className="bg-gray-800/50 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-purple-400" />
                      <div>
                        <div className="text-white font-medium">{backup.workspace}</div>
                        <div className="text-xs text-gray-400">
                          {backup.sizeBytes ? formatSize(backup.sizeBytes) : '-'} · {new Date(backup.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => restoreMutation.mutate(backup.id)}
                        disabled={restoreMutation.isPending}
                        className="px-3 py-1.5 bg-orange-500/20 text-orange-300 rounded-lg text-xs hover:bg-orange-500/30 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3 inline mr-1" /> 还原
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'scan' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => doScan()}
                disabled={scanLoading}
                className="px-4 py-2 bg-emerald-600/20 text-emerald-300 rounded-lg text-sm border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-50"
              >
                <Folder className="w-4 h-4 inline mr-1" /> 扫描工作区
              </motion.button>
            </div>
            {scanned.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">点击上方按钮扫描工作区</div>
            ) : (
              <div className="space-y-3">
                {scanned.map((ws: any) => (
                  <div key={ws.name} className="bg-gray-800/50 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Folder className="w-5 h-5 text-emerald-400" />
                      <div>
                        <div className="text-white font-medium">{ws.name}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[300px]">{ws.path}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{formatSize(ws.size)}</span>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => backupMutation.mutate(ws.name)}
                        className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-xs hover:bg-purple-500/30"
                      >
                        <Plus className="w-3 h-3 inline mr-1" /> 备份
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}