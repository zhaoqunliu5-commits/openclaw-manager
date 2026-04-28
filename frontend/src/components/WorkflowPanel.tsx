import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import type { WorkflowInfo, TaskInfo } from '../types';
import { Play, Pause, Trash2, Clock, CheckCircle2, XCircle, Loader2, Workflow } from 'lucide-react';

interface WorkflowStep {
  id: number;
  name: string;
  type: 'command' | 'switch_agent' | 'wait' | 'condition';
  config: { command?: string; agent?: string; seconds?: number; condition?: string; expected_result?: string };
  timeout?: number;
  retry?: number;
}

export default function WorkflowPanel() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newSteps, setNewSteps] = useState<WorkflowStep[]>([]);

  const { data: workflows = [] } = useQuery<WorkflowInfo[]>({
    queryKey: ['workflows'],
    queryFn: apiService.getWorkflows,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: tasks = [] } = useQuery<TaskInfo[]>({
    queryKey: ['workflow-tasks'],
    queryFn: () => apiService.getTasks(20),
    staleTime: 20000,
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: apiService.createWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setShowCreate(false);
      setNewSteps([]);
    },
  });

  const executeMutation = useMutation({
    mutationFn: (id: number) => apiService.executeWorkflowById(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow-tasks'] }),
  });

  const addStep = (type: 'command' | 'switch_agent' | 'wait' | 'condition') => {
    const newStep: WorkflowStep = {
      id: Date.now(),
      name: `Step ${newSteps.length + 1}`,
      type,
      config: {},
      timeout: 30000,
      retry: 0,
    };
    setNewSteps([...newSteps, newStep]);
  };

  const updateStep = (id: number, updates: Partial<WorkflowStep>) => {
    setNewSteps(newSteps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeStep = (id: number) => {
    setNewSteps(newSteps.filter(s => s.id !== id));
  };

  const handleCreate = () => {
    if (newSteps.length === 0) return;
    createMutation.mutate({
      name: `工作流 ${new Date().toLocaleTimeString()}`,
      description: '自定义工作流',
      steps: newSteps,
    });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'running': return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
      case 'paused': return <Pause className="w-4 h-4 text-yellow-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const stepTypeLabel: Record<string, string> = {
    command: '执行命令', switch_agent: '切换Agent', wait: '等待', condition: '条件判断'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Workflow className="w-6 h-6 text-purple-400" />
            工作流编排
          </h2>
          <p className="text-gray-400 text-sm mt-1">创建和管理自动化工作流，包含任务队列和步骤编排</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white text-sm font-medium"
        >
          {showCreate ? '取消' : '+ 新建工作流'}
        </motion.button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">创建工作流步骤</h3>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => addStep('command')} className="px-3 py-1.5 bg-gray-700/50 text-gray-300 rounded-lg text-xs hover:bg-gray-600/50">+ 执行命令</button>
                <button onClick={() => addStep('switch_agent')} className="px-3 py-1.5 bg-gray-700/50 text-gray-300 rounded-lg text-xs hover:bg-gray-600/50">+ 切换Agent</button>
                <button onClick={() => addStep('wait')} className="px-3 py-1.5 bg-gray-700/50 text-gray-300 rounded-lg text-xs hover:bg-gray-600/50">+ 等待</button>
                <button onClick={() => addStep('condition')} className="px-3 py-1.5 bg-gray-700/50 text-gray-300 rounded-lg text-xs hover:bg-gray-600/50">+ 条件判断</button>
              </div>

              {newSteps.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">点击上方按钮添加步骤</div>
              ) : (
                <div className="space-y-3">
                  {newSteps.map((step, i) => (
                    <div key={step.id} className="bg-gray-800/50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-cyan-400 font-mono">Step {i + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">{stepTypeLabel[step.type]}</span>
                          <button onClick={() => removeStep(step.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      {step.type === 'command' && (
                        <input
                          value={step.config.command || ''}
                          onChange={e => updateStep(step.id, { config: { command: e.target.value } })}
                          placeholder="输入命令，如: openclaw status"
                          className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                        />
                      )}
                      {step.type === 'switch_agent' && (
                        <input
                          value={step.config.agent || ''}
                          onChange={e => updateStep(step.id, { config: { agent: e.target.value } })}
                          placeholder="Agent名称，如: claude"
                          className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                        />
                      )}
                      {step.type === 'wait' && (
                        <input
                          type="number"
                          value={step.config.seconds || 1}
                          onChange={e => updateStep(step.id, { config: { seconds: parseInt(e.target.value) || 1 } })}
                          placeholder="等待秒数"
                          className="w-full bg-gray-900/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowCreate(false); setNewSteps([]); }} className="px-4 py-2 text-gray-400 hover:text-white text-sm">取消</button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreate}
                  disabled={newSteps.length === 0 || createMutation.isPending}
                  className="px-6 py-2 bg-purple-600 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                >
                  创建工作流
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-cyan-400" /> 工作流列表
          </h3>
          {workflows.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">暂无工作流，点击上方「+」按钮创建你的第一个工作流</div>
          ) : (
            <div className="space-y-3">
              {workflows.map((wf: WorkflowInfo) => (
                <div key={wf.id} className="bg-gray-800/50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">{wf.name}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span className="px-2 py-0.5 bg-gray-700/50 rounded">{wf.steps?.length || 0} 步骤</span>
                      <span className="px-2 py-0.5 bg-gray-700/50 rounded">{wf.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusIcon(wf.status)}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => executeMutation.mutate(wf.id)}
                      disabled={wf.status === 'running'}
                      className="px-3 py-1.5 bg-cyan-500/20 text-cyan-300 rounded-lg text-xs hover:bg-cyan-500/30 disabled:opacity-50"
                    >
                      ▶ 执行
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-400" /> 任务队列
          </h3>
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">暂无任务，执行工作流后任务会出现在这里</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {tasks.map((task: TaskInfo) => (
                <div key={task.id} className="bg-gray-800/50 rounded-lg p-3 flex items-center gap-3">
                  {statusIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{task.name}</div>
                    <div className="text-xs text-gray-500">{task.createdAt ? new Date(task.createdAt).toLocaleString() : ''}</div>
                  </div>
                  {task.result && (
                    <div className="text-xs text-gray-400 max-w-[150px] truncate" title={task.result}>
                      {task.result}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}