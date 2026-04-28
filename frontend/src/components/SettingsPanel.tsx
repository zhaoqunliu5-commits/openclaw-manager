import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Sun, Moon, User, Power, Bell,
  RefreshCw, Globe, CheckCircle2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import type { AppSettings as AppSettingsType } from '../types';

const SettingsPanel: React.FC = () => {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['appSettings'],
    queryFn: apiService.getSettings,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['settingsAgents'],
    queryFn: apiService.getSettingsAgents,
  });

  const updateMutation = useMutation({
    mutationFn: (partial: Partial<AppSettingsType>) => apiService.updateSettings(partial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      showMessage('success', '设置已保存');
    },
    onError: () => showMessage('error', '保存失败'),
  });

  const defaultAgentMutation = useMutation({
    mutationFn: (agent: string) => apiService.setDefaultAgent(agent),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      showMessage('success', data.message);
    },
    onError: () => showMessage('error', '设置默认 Agent 失败'),
  });

  const autoStartMutation = useMutation({
    mutationFn: (enabled: boolean) => apiService.setAutoStart(enabled),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      showMessage('success', data.message);
    },
    onError: () => showMessage('error', '设置自动启动失败'),
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  if (isLoading || !settings) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
      >
        <div className="text-center text-gray-500 py-8">加载设置中...</div>
      </motion.div>
    );
  }

  const notifPrefs = settings.notificationPreferences;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-gray-400" />
        <h2 className="text-xl font-bold text-gray-200">设置中心</h2>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-4 px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}
        >
          {message.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
          {message.text}
        </motion.div>
      )}

      <div className="space-y-6">
        {/* 主题切换 */}
        <div className="p-4 bg-gray-800/30 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.theme === 'dark' ? (
                <Moon className="w-5 h-5 text-purple-400" />
              ) : (
                <Sun className="w-5 h-5 text-amber-400" />
              )}
              <div>
                <div className="text-sm font-medium text-gray-200">主题模式</div>
                <div className="text-xs text-gray-500">切换深色/浅色主题</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateMutation.mutate({ theme: 'dark' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  settings.theme === 'dark'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-gray-800/50 text-gray-500 hover:bg-white/5'
                }`}
              >
                <Moon className="w-3.5 h-3.5 inline mr-1" />深色
              </button>
              <button
                onClick={() => updateMutation.mutate({ theme: 'light' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  settings.theme === 'light'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-gray-800/50 text-gray-500 hover:bg-white/5'
                }`}
              >
                <Sun className="w-3.5 h-3.5 inline mr-1" />浅色
              </button>
            </div>
          </div>
        </div>

        {/* 默认 Agent */}
        <div className="p-4 bg-gray-800/30 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="text-sm font-medium text-gray-200">默认 Agent</div>
                <div className="text-xs text-gray-500">设置启动时的默认 Agent</div>
              </div>
            </div>
            <select
              value={settings.defaultAgent}
              onChange={e => defaultAgentMutation.mutate(e.target.value)}
              className="bg-gray-800/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300"
            >
              {agents.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 自动启动 */}
        <div className="p-4 bg-gray-800/30 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power className="w-5 h-5 text-green-400" />
              <div>
                <div className="text-sm font-medium text-gray-200">自动启动服务</div>
                <div className="text-xs text-gray-500">系统启动时自动启动 OpenClaw 服务</div>
              </div>
            </div>
            <button
              onClick={() => autoStartMutation.mutate(!settings.autoStartServices)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.autoStartServices ? 'bg-green-500/30' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
                  settings.autoStartServices
                    ? 'left-6.5 bg-green-400'
                    : 'left-0.5 bg-gray-400'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 通知偏好 */}
        <div className="p-4 bg-gray-800/30 rounded-xl border border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-sm font-medium text-gray-200">通知偏好</div>
              <div className="text-xs text-gray-500">选择接收哪些类型的通知</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'serviceStatus', label: '服务状态变更', icon: Power, color: 'text-green-400' },
              { key: 'agentSwitch', label: 'Agent 切换', icon: User, color: 'text-cyan-400' },
              { key: 'errors', label: '错误告警', icon: Power, color: 'text-red-400' },
              { key: 'warnings', label: '警告通知', icon: Bell, color: 'text-amber-400' },
              { key: 'info', label: '信息通知', icon: Bell, color: 'text-blue-400' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() =>
                  updateMutation.mutate({
                    notificationPreferences: {
                      ...notifPrefs,
                      [item.key]: !notifPrefs[item.key as keyof typeof notifPrefs],
                    },
                  })
                }
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                  notifPrefs[item.key as keyof typeof notifPrefs]
                    ? 'bg-white/5 text-gray-200 border border-white/10'
                    : 'bg-gray-800/30 text-gray-600 border border-transparent'
                }`}
              >
                <item.icon className={`w-3.5 h-3.5 ${notifPrefs[item.key as keyof typeof notifPrefs] ? item.color : ''}`} />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 刷新间隔 */}
        <div className="p-4 bg-gray-800/30 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-sm font-medium text-gray-200">数据刷新间隔</div>
                <div className="text-xs text-gray-500">自动刷新监控数据的时间间隔</div>
              </div>
            </div>
            <select
              value={settings.refreshInterval}
              onChange={e => updateMutation.mutate({ refreshInterval: parseInt(e.target.value) })}
              className="bg-gray-800/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300"
            >
              <option value="5000">5 秒</option>
              <option value="10000">10 秒</option>
              <option value="15000">15 秒</option>
              <option value="30000">30 秒</option>
              <option value="60000">60 秒</option>
            </select>
          </div>
        </div>

        {/* 语言 */}
        <div className="p-4 bg-gray-800/30 rounded-xl border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-indigo-400" />
              <div>
                <div className="text-sm font-medium text-gray-200">语言</div>
                <div className="text-xs text-gray-500">界面显示语言</div>
              </div>
            </div>
            <select
              value={settings.language}
              onChange={e => updateMutation.mutate({ language: e.target.value })}
              className="bg-gray-800/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300"
            >
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsPanel;
