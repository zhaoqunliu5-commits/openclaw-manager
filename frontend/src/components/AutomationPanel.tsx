import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import type { AutomationRule, AutomationLog } from '../types';
import { Zap, Clock, Radio, ArrowRight, Trash2, FileText, ChevronDown, ChevronRight } from 'lucide-react';

const TRIGGER_TYPES = [
  { value: 'cron', label: '定时触发', desc: '按固定间隔执行', icon: <Clock className="w-4 h-4" /> },
  { value: 'event', label: '事件触发', desc: '当特定事件发生时执行', icon: <Radio className="w-4 h-4" /> },
];

const ACTION_TYPES = [
  { value: 'command', label: '执行命令', desc: '在 WSL 中运行命令' },
  { value: 'notify', label: '发送通知', desc: '推送桌面通知' },
  { value: 'switch_agent', label: '切换 Agent', desc: '自动切换默认 Agent' },
  { value: 'restart_service', label: '重启服务', desc: '重启指定服务' },
];

const SYSTEM_EVENTS = [
  { value: 'service.stopped', label: '服务停止', desc: '任何 OpenClaw 服务意外停止' },
  { value: 'service.started', label: '服务启动', desc: 'OpenClaw 服务启动完成' },
  { value: 'agent.error', label: 'Agent 错误', desc: 'Agent 运行出现错误' },
  { value: 'memory.threshold', label: '内存阈值', desc: '内存使用超过阈值' },
  { value: 'config.changed', label: '配置变更', desc: '配置文件被修改' },
  { value: 'health.check_failed', label: '健康检查失败', desc: '服务健康检查未通过' },
];

const SERVICE_OPTIONS = [
  { value: 'openclaw-gateway', label: 'openclaw-gateway（网关）' },
  { value: 'canvas', label: 'canvas（画布）' },
];

const PRESET_TEMPLATES = [
  {
    name: '每日定时重启 Gateway',
    triggerType: 'cron' as const,
    intervalMinutes: 1440,
    actionType: 'restart_service' as const,
    serviceName: 'openclaw-gateway',
    description: '每 24 小时自动重启 Gateway 服务，保持服务稳定',
  },
  {
    name: '服务停止时自动通知',
    triggerType: 'event' as const,
    eventName: 'service.stopped',
    actionType: 'notify' as const,
    notifyTitle: '服务异常停止',
    notifyMessage: 'OpenClaw 服务已停止运行，请及时检查',
    description: '当任何服务意外停止时，发送通知提醒',
  },
  {
    name: '每小时健康检查',
    triggerType: 'cron' as const,
    intervalMinutes: 60,
    actionType: 'command' as const,
    command: 'openclaw status --json',
    description: '每小时执行一次状态检查命令',
  },
  {
    name: '健康检查失败时重启',
    triggerType: 'event' as const,
    eventName: 'health.check_failed',
    actionType: 'restart_service' as const,
    serviceName: 'openclaw-gateway',
    description: '当健康检查失败时，自动重启 Gateway 服务',
  },
  {
    name: '配置变更后通知',
    triggerType: 'event' as const,
    eventName: 'config.changed',
    actionType: 'notify' as const,
    notifyTitle: '配置已变更',
    notifyMessage: 'OpenClaw 配置文件已被修改，请确认变更内容',
    description: '配置文件被修改时发送通知',
  },
];

const describeTrigger = (rule: AutomationRule): string => {
  try {
    const cfg = JSON.parse(rule.triggerConfig || '{}');
    if (rule.triggerType === 'cron') {
      const mins = cfg.intervalMinutes;
      if (mins >= 1440) return `每 ${(mins / 1440).toFixed(0)} 天执行`;
      if (mins >= 60) return `每 ${(mins / 60).toFixed(0)} 小时执行`;
      return `每 ${mins} 分钟执行`;
    }
    const evt = cfg.event || rule.triggerConfig;
    const found = SYSTEM_EVENTS.find(e => e.value === evt);
    return found ? `当「${found.label}」时` : `事件: ${evt}`;
  } catch {
    return rule.triggerConfig || '-';
  }
};

const describeAction = (rule: AutomationRule): string => {
  try {
    const cfg = JSON.parse(rule.actionConfig || '{}');
    switch (rule.actionType) {
      case 'command': return `执行: ${cfg.command || '-'}`;
      case 'notify': return `通知: ${cfg.title || '-'}`;
      case 'switch_agent': return `切换到: ${cfg.agent || '-'}`;
      case 'restart_service': return `重启: ${cfg.service || '-'}`;
      default: return rule.actionConfig || '-';
    }
  } catch {
    return rule.actionConfig || '-';
  }
};

export default function AutomationPanel() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedRule, setSelectedRule] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    triggerType: 'cron' as 'cron' | 'event',
    intervalMinutes: 30,
    eventName: '',
    actionType: 'command' as 'command' | 'notify' | 'switch_agent' | 'restart_service',
    command: '',
    notifyTitle: '',
    notifyMessage: '',
    notifyType: 'info',
    agentName: '',
    serviceName: '',
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['automation-rules'],
    queryFn: apiService.getAutomationRules,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['automation-logs', selectedRule],
    queryFn: () => apiService.getAutomationLogs(selectedRule || undefined),
    staleTime: 20000,
    refetchInterval: 30000,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['collabAgents'],
    queryFn: apiService.getCollaborationAgents,
    staleTime: 60000,
  });

  const createMutation = useMutation({
    mutationFn: apiService.createAutomationRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      setShowCreate(false);
      resetForm();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiService.updateAutomationRule(id, { enabled } as Partial<AutomationRule>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: apiService.deleteAutomationRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
  });

  const executeMutation = useMutation({
    mutationFn: apiService.executeAutomationRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-logs'] }),
  });

  const resetForm = () => {
    setForm({
      name: '', triggerType: 'cron', intervalMinutes: 30, eventName: '',
      actionType: 'command', command: '', notifyTitle: '', notifyMessage: '',
      notifyType: 'info', agentName: '', serviceName: '',
    });
  };

  const applyTemplate = (tpl: typeof PRESET_TEMPLATES[number]) => {
    setForm({
      name: tpl.name,
      triggerType: tpl.triggerType,
      intervalMinutes: tpl.intervalMinutes || 30,
      eventName: tpl.eventName || '',
      actionType: tpl.actionType,
      command: tpl.command || '',
      notifyTitle: tpl.notifyTitle || '',
      notifyMessage: tpl.notifyMessage || '',
      notifyType: 'info',
      agentName: '',
      serviceName: tpl.serviceName || '',
    });
    setShowTemplates(false);
    setShowCreate(true);
  };

  const buildTriggerConfig = () => {
    if (form.triggerType === 'cron') {
      return JSON.stringify({ intervalMinutes: form.intervalMinutes });
    }
    return JSON.stringify({ event: form.eventName });
  };

  const buildActionConfig = () => {
    switch (form.actionType) {
      case 'command': return JSON.stringify({ command: form.command, timeout: 30000 });
      case 'notify': return JSON.stringify({ title: form.notifyTitle, message: form.notifyMessage, type: form.notifyType });
      case 'switch_agent': return JSON.stringify({ agent: form.agentName });
      case 'restart_service': return JSON.stringify({ service: form.serviceName });
    }
  };

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createMutation.mutate({
      name: form.name,
      enabled: true,
      triggerType: form.triggerType,
      triggerConfig: buildTriggerConfig(),
      actionType: form.actionType,
      actionConfig: buildActionConfig(),
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✓';
      case 'failed': return '✗';
      default: return '⟳';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-purple-400" />
            工作流自动化
          </h2>
          <p className="text-gray-400 text-sm mt-1">创建定时任务和事件触发规则，自动化你的 OpenClaw 工作流</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 border border-white/10 rounded-lg text-gray-300 text-sm font-medium transition-colors"
          >
            📋 从模板创建
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setShowCreate(!showCreate); setShowTemplates(false); }}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg text-white text-sm font-medium"
          >
            {showCreate ? '取消' : '+ 新建规则'}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">选择模板</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRESET_TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => applyTemplate(tpl)}
                    className="text-left p-4 bg-gray-800/40 border border-white/5 rounded-xl hover:border-purple-500/30 hover:bg-purple-500/5 transition-all"
                  >
                    <div className="text-sm font-medium text-gray-200 mb-1">{tpl.name}</div>
                    <div className="text-xs text-gray-500 mb-2">{tpl.description}</div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300">
                        {tpl.triggerType === 'cron' ? '⏱ 定时' : '📡 事件'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                        {ACTION_TYPES.find(a => a.value === tpl.actionType)?.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <h3 className="text-lg font-semibold text-white">创建自动化规则</h3>

              <div>
                <label className="text-gray-300 text-sm mb-1 block">规则名称</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例：每日健康检查"
                  className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-2 block">触发方式</label>
                  <div className="space-y-2">
                    {TRIGGER_TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setForm(f => ({ ...f, triggerType: t.value as 'cron' | 'event' }))}
                        className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all flex items-center gap-3 ${
                          form.triggerType === t.value
                            ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                            : 'border-gray-600/50 bg-gray-800/30 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {t.icon}
                        <div>
                          <div className="font-medium">{t.label}</div>
                          <div className="text-xs opacity-70">{t.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-gray-300 text-sm mb-2 block">执行动作</label>
                  <div className="space-y-2">
                    {ACTION_TYPES.map(a => (
                      <button
                        key={a.value}
                        onClick={() => setForm(f => ({ ...f, actionType: a.value as 'command' | 'notify' | 'switch_agent' | 'restart_service' }))}
                        className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                          form.actionType === a.value
                            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                            : 'border-gray-600/50 bg-gray-800/30 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        <div className="font-medium">{a.label}</div>
                        <div className="text-xs opacity-70">{a.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {form.triggerType === 'cron' && (
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">执行间隔</label>
                  <div className="flex gap-2">
                    {[5, 15, 30, 60, 360, 1440].map(m => (
                      <button
                        key={m}
                        onClick={() => setForm(f => ({ ...f, intervalMinutes: m }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          form.intervalMinutes === m
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-gray-800/30 text-gray-400 border border-gray-600/30 hover:border-gray-500'
                        }`}
                      >
                        {m >= 1440 ? `${m / 1440}天` : m >= 60 ? `${m / 60}小时` : `${m}分钟`}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={form.intervalMinutes}
                    onChange={e => setForm(f => ({ ...f, intervalMinutes: Number(e.target.value) }))}
                    className="mt-2 w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {form.triggerType === 'event' && (
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">触发事件</label>
                  <select
                    value={form.eventName}
                    onChange={e => setForm(f => ({ ...f, eventName: e.target.value }))}
                    className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="">选择事件...</option>
                    {SYSTEM_EVENTS.map(evt => (
                      <option key={evt.value} value={evt.value}>{evt.label} — {evt.desc}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.actionType === 'command' && (
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">要执行的命令</label>
                  <input
                    value={form.command}
                    onChange={e => setForm(f => ({ ...f, command: e.target.value }))}
                    placeholder="例：openclaw status"
                    className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              )}

              {form.actionType === 'notify' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm mb-1 block">通知标题</label>
                    <input
                      value={form.notifyTitle}
                      onChange={e => setForm(f => ({ ...f, notifyTitle: e.target.value }))}
                      placeholder="例：定时检查完成"
                      className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm mb-1 block">通知内容</label>
                    <textarea
                      value={form.notifyMessage}
                      onChange={e => setForm(f => ({ ...f, notifyMessage: e.target.value }))}
                      placeholder="通知正文..."
                      rows={2}
                      className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                </div>
              )}

              {form.actionType === 'switch_agent' && (
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">选择 Agent</label>
                  <select
                    value={form.agentName}
                    onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))}
                    className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="">选择 Agent...</option>
                    {agents.map((a: string) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  {agents.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">未检测到 Agent，可手动输入名称</p>
                  )}
                </div>
              )}

              {form.actionType === 'restart_service' && (
                <div>
                  <label className="text-gray-300 text-sm mb-1 block">选择服务</label>
                  <select
                    value={form.serviceName}
                    onChange={e => setForm(f => ({ ...f, serviceName: e.target.value }))}
                    className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="">选择服务...</option>
                    {SERVICE_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowCreate(false); resetForm(); }}
                  className="px-4 py-2 rounded-lg text-gray-400 text-sm hover:text-white transition-colors"
                >
                  取消
                </button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreate}
                  disabled={!form.name.trim() || createMutation.isPending}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                >
                  {createMutation.isPending ? '创建中...' : '创建规则'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {rules.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-gray-400 mb-1">还没有自动化规则</p>
          <p className="text-gray-500 text-sm mb-4">从模板快速创建，或自定义规则</p>
          <button
            onClick={() => setShowTemplates(true)}
            className="px-4 py-2 bg-purple-600/20 text-purple-300 rounded-lg text-sm hover:bg-purple-600/30 transition-colors"
          >
            📋 从模板创建
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <motion.div
              key={rule.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                    className={`w-10 h-6 rounded-full transition-all relative ${rule.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                  <div>
                    <h4 className="text-white font-medium">{rule.name}</h4>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                        {rule.triggerType === 'cron' ? '⏱ 定时' : '📡 事件'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        {ACTION_TYPES.find(a => a.value === rule.actionType)?.label || rule.actionType}
                      </span>
                      {rule.triggerCount > 0 && (
                        <span>已触发 {rule.triggerCount} 次</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                      <span>{describeTrigger(rule)}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span>{describeAction(rule)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => executeMutation.mutate(rule.id)}
                    disabled={executeMutation.isPending}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg text-xs hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                    title="手动执行"
                  >
                    ▶ 执行
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedRule(selectedRule === rule.id ? null : rule.id)}
                    className="px-3 py-1.5 bg-gray-500/20 text-gray-300 rounded-lg text-xs hover:bg-gray-500/30 transition-colors flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    日志
                    {selectedRule === rule.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => deleteMutation.mutate(rule.id)}
                    className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-xs hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </motion.button>
                </div>
              </div>

              <AnimatePresence>
                {selectedRule === rule.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                      <h5 className="text-gray-300 text-xs font-medium mb-2">执行日志</h5>
                      {(logs as AutomationLog[]).filter(l => l.ruleId === rule.id).length === 0 ? (
                        <p className="text-gray-500 text-xs">暂无日志，触发自动化规则后日志会出现在这里</p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {(logs as AutomationLog[]).filter(l => l.ruleId === rule.id).slice(0, 10).map(log => (
                            <div key={log.id} className="flex items-center gap-2 text-xs">
                              <span className={statusColor(log.status)}>{statusIcon(log.status)}</span>
                              <span className="text-gray-400">{new Date(log.startedAt).toLocaleString()}</span>
                              {log.result && (
                                <span className="text-gray-500 truncate max-w-[200px]" title={log.result}>
                                  {log.result}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
