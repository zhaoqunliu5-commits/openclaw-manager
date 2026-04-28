import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Send, Radio, ArrowRight, Plus, Trash2,
  Play, MessageSquare, GitBranch
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import type { WorkflowStep } from '../types';

const CollaborationPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'messages' | 'bindings' | 'workflow' | 'broadcast'>('messages');
  const [selectedAgent, setSelectedAgent] = useState<string>('main');
  const [messageForm, setMessageForm] = useState({ fromAgent: 'main', toAgent: '', message: '' });
  const [bindingForm, setBindingForm] = useState({ agent: '', binding: '' });
  const [workflowName, setWorkflowName] = useState('');
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([{ agent: '', message: '', waitForReply: true }]);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastTargets, setBroadcastTargets] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: agents = [] } = useQuery({
    queryKey: ['collabAgents'],
    queryFn: apiService.getCollaborationAgents,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['agentMessages', selectedAgent],
    queryFn: () => apiService.getAgentMessages(selectedAgent, 30),
    enabled: activeTab === 'messages',
  });

  const { data: bindings = [] } = useQuery({
    queryKey: ['collabBindings'],
    queryFn: apiService.getCollaborationBindings,
    enabled: activeTab === 'bindings',
  });

  const sendMutation = useMutation({
    mutationFn: () => apiService.sendAgentMessage(messageForm.fromAgent, messageForm.toAgent, messageForm.message),
    onSuccess: (data) => {
      showMessage('success', data.success ? '消息已发送' : `发送失败: ${data.message}`);
      setMessageForm(prev => ({ ...prev, message: '' }));
      queryClient.invalidateQueries({ queryKey: ['agentMessages', selectedAgent] });
    },
    onError: () => showMessage('error', '发送失败'),
  });

  const addBindingMutation = useMutation({
    mutationFn: () => apiService.addCollaborationBinding(bindingForm.agent, bindingForm.binding),
    onSuccess: (data) => {
      showMessage('success', data.success ? '绑定已添加' : `添加失败: ${data.message}`);
      setBindingForm({ agent: '', binding: '' });
      queryClient.invalidateQueries({ queryKey: ['collabBindings'] });
    },
    onError: () => showMessage('error', '添加绑定失败'),
  });

  const removeBindingMutation = useMutation({
    mutationFn: ({ agent, binding }: { agent: string; binding: string }) =>
      apiService.removeCollaborationBinding(agent, binding),
    onSuccess: () => {
      showMessage('success', '绑定已移除');
      queryClient.invalidateQueries({ queryKey: ['collabBindings'] });
    },
    onError: () => showMessage('error', '移除绑定失败'),
  });

  const broadcastMutation = useMutation({
    mutationFn: () => apiService.broadcastMessage(broadcastMsg, broadcastTargets),
    onSuccess: (data) => {
      showMessage('success', data.success ? '广播已发送' : `广播失败: ${data.message}`);
      setBroadcastMsg('');
      setBroadcastTargets([]);
    },
    onError: () => showMessage('error', '广播失败'),
  });

  const workflowMutation = useMutation({
    mutationFn: () => apiService.executeWorkflow(workflowName, workflowSteps),
    onSuccess: (data) => {
      showMessage('success', `工作流 ${data.status === 'completed' ? '执行完成' : '状态: ' + data.status}`);
    },
    onError: () => showMessage('error', '工作流执行失败'),
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const addWorkflowStep = () => {
    setWorkflowSteps([...workflowSteps, { agent: '', message: '', waitForReply: true }]);
  };

  const removeWorkflowStep = (index: number) => {
    setWorkflowSteps(workflowSteps.filter((_, i) => i !== index));
  };

  const updateWorkflowStep = (index: number, field: keyof WorkflowStep, value: any) => {
    const updated = [...workflowSteps];
    updated[index] = { ...updated[index], [field]: value };
    setWorkflowSteps(updated);
  };

  const tabs = [
    { key: 'messages', label: 'Agent 通信', icon: MessageSquare },
    { key: 'bindings', label: '路由绑定', icon: GitBranch },
    { key: 'workflow', label: '工作流', icon: Play },
    { key: 'broadcast', label: '广播', icon: Radio },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-bold text-gray-200">多 Agent 协作</h2>
        </div>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-4 px-4 py-2 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}
        >
          {message.text}
        </motion.div>
      )}

      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-400 hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'messages' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">From Agent</label>
              <select
                value={messageForm.fromAgent}
                onChange={e => setMessageForm(prev => ({ ...prev, fromAgent: e.target.value }))}
                className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300"
              >
                {agents.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-500 mt-6" />
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">To Agent</label>
              <select
                value={messageForm.toAgent}
                onChange={e => setMessageForm(prev => ({ ...prev, toAgent: e.target.value }))}
                className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300"
              >
                <option value="">选择目标...</option>
                {agents.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex-[2]">
              <label className="text-xs text-gray-500 mb-1 block">消息</label>
              <input
                value={messageForm.message}
                onChange={e => setMessageForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="输入消息内容..."
                className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300"
              />
            </div>
            <button
              onClick={() => sendMutation.mutate()}
              disabled={!messageForm.toAgent || !messageForm.message}
              className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 disabled:opacity-30 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">查看 Agent 消息</label>
            <div className="flex gap-2 mb-3">
              {agents.map(a => (
                <button
                  key={a}
                  onClick={() => setSelectedAgent(a)}
                  className={`px-3 py-1 rounded-full text-xs ${
                    selectedAgent === a ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800/50 text-gray-500 hover:bg-white/5'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            {messagesLoading ? (
              <div className="text-center text-gray-500 py-8">加载中...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">暂无消息</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {messages.map(msg => (
                  <div key={msg.id} className={`p-3 rounded-lg border border-white/5 ${
                    msg.from === 'user' ? 'bg-blue-500/5' : 'bg-gray-800/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-400">{msg.from}</span>
                      <ArrowRight className="w-3 h-3 text-gray-600" />
                      <span className="text-xs font-medium text-gray-400">{msg.to}</span>
                      {msg.sessionId && (
                        <span className="text-[9px] text-gray-600 ml-auto">session: {msg.sessionId.substring(0, 8)}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-300 line-clamp-2">{msg.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'bindings' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Agent</label>
              <select
                value={bindingForm.agent}
                onChange={e => setBindingForm(prev => ({ ...prev, agent: e.target.value }))}
                className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300"
              >
                <option value="">选择 Agent...</option>
                {agents.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">绑定 (channel[:accountId])</label>
              <input
                value={bindingForm.binding}
                onChange={e => setBindingForm(prev => ({ ...prev, binding: e.target.value }))}
                placeholder="如: discord:123456"
                className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300"
              />
            </div>
            <button
              onClick={() => addBindingMutation.mutate()}
              disabled={!bindingForm.agent || !bindingForm.binding}
              className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 disabled:opacity-30"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {bindings.length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无路由绑定</div>
          ) : (
            <div className="space-y-2">
              {bindings.map((b, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-purple-400 font-medium">{b.agent}</span>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <span className="text-sm text-gray-300">{b.channel}</span>
                    {b.accountId && <span className="text-xs text-gray-500">({b.accountId})</span>}
                  </div>
                  <button
                    onClick={() => removeBindingMutation.mutate({ agent: b.agent, binding: b.channel })}
                    className="p-1 hover:bg-red-500/10 rounded text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'workflow' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">工作流名称</label>
            <input
              value={workflowName}
              onChange={e => setWorkflowName(e.target.value)}
              placeholder="输入工作流名称..."
              className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300"
            />
          </div>

          <div className="space-y-3">
            {workflowSteps.map((step, i) => (
              <div key={i} className="p-3 bg-gray-800/30 rounded-lg border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-400 font-medium">步骤 {i + 1}</span>
                  {workflowSteps.length > 1 && (
                    <button onClick={() => removeWorkflowStep(i)} className="p-1 hover:bg-red-500/10 rounded text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <select
                    value={step.agent}
                    onChange={e => updateWorkflowStep(i, 'agent', e.target.value)}
                    className="flex-1 bg-gray-800/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300"
                  >
                    <option value="">选择 Agent...</option>
                    {agents.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={step.waitForReply}
                      onChange={e => updateWorkflowStep(i, 'waitForReply', e.target.checked)}
                      className="rounded"
                    />
                    等待回复
                  </label>
                </div>
                <input
                  value={step.message}
                  onChange={e => updateWorkflowStep(i, 'message', e.target.value)}
                  placeholder="指令消息..."
                  className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={addWorkflowStep}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-800/50 text-gray-400 rounded-lg hover:bg-white/5 text-xs"
            >
              <Plus className="w-3 h-3" /> 添加步骤
            </button>
            <button
              onClick={() => workflowMutation.mutate()}
              disabled={!workflowName || workflowSteps.some(s => !s.agent || !s.message)}
              className="flex items-center gap-1 px-4 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 disabled:opacity-30 text-xs ml-auto"
            >
              <Play className="w-3 h-3" /> 执行工作流
            </button>
          </div>
        </div>
      )}

      {activeTab === 'broadcast' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">广播消息</label>
            <textarea
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              placeholder="输入广播消息..."
              rows={3}
              className="w-full bg-gray-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">目标 Agents</label>
            <div className="flex flex-wrap gap-2">
              {agents.map(a => (
                <button
                  key={a}
                  onClick={() => setBroadcastTargets(prev =>
                    prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
                  )}
                  className={`px-3 py-1 rounded-full text-xs ${
                    broadcastTargets.includes(a)
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-gray-800/50 text-gray-500 hover:bg-white/5'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => broadcastMutation.mutate()}
            disabled={!broadcastMsg || broadcastTargets.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 disabled:opacity-30"
          >
            <Radio className="w-4 h-4" /> 发送广播
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default CollaborationPanel;
