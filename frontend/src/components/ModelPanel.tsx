import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, RefreshCw, ChevronDown, ChevronRight,
  Server, Globe, Search, Loader2, CheckCircle2,
  Sparkles, Brain, ArrowRight
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import type { ModelDefinition } from '../types';

const AddProviderForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [providerName, setProviderName] = useState('');
  const [detected, setDetected] = useState<{ provider: string; models: ModelDefinition[] } | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleDetect = async () => {
    if (!baseUrl || !apiKey) return;
    setDetecting(true);
    try {
      const result = await apiService.detectProvider(baseUrl, apiKey);
      setDetected(result);
      if (!providerName) setProviderName(result.provider);
    } catch {
      setDetected({ provider: 'custom', models: [] });
    }
    setDetecting(false);
  };

  const handleAdd = async () => {
    if (!baseUrl || !apiKey) return;
    setAdding(true);
    try {
      await apiService.addModelProvider(providerName || 'custom', baseUrl, apiKey);
      queryClient.invalidateQueries({ queryKey: ['modelProviders'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      onClose();
    } catch { /* */ }
    setAdding(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gray-800/50 rounded-xl p-4 border border-cyan-500/20"
    >
      <div className="flex items-center gap-2 mb-4">
        <Plus className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-cyan-300">添加 API 提供商</span>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full bg-gray-900/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-gray-900/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDetect}
            disabled={!baseUrl || !apiKey || detecting}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-lg text-sm text-cyan-300 disabled:opacity-40 transition-all"
          >
            {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {detecting ? '识别中...' : '自动识别'}
          </button>
          {detected && (
            <button
              onClick={handleAdd}
              disabled={adding}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg text-sm text-emerald-300 disabled:opacity-40 transition-all"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {adding ? '添加中...' : `添加 ${providerName || 'custom'}`}
            </button>
          )}
        </div>
        {detected && (
          <div className="bg-gray-900/40 rounded-lg p-3 border border-white/5">
            <div className="text-xs text-emerald-400 mb-2">识别结果: {detected.provider} ({detected.models.length} 个模型)</div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {detected.models.slice(0, 10).map(m => (
                <div key={m.id} className="text-xs text-gray-400 flex items-center gap-1">
                  <span>{m.name}</span>
                  {m.reasoning && <Brain className="w-3 h-3 text-purple-400" />}
                </div>
              ))}
              {detected.models.length > 10 && (
                <div className="text-xs text-gray-500">...还有 {detected.models.length - 10} 个模型</div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const ModelPanel: React.FC = () => {
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [assigningModel, setAssigningModel] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['modelProviders'],
    queryFn: apiService.getModelProviders,
  });

  const { data: agentModels = [] } = useQuery({
    queryKey: ['agentModels'],
    queryFn: apiService.getAgentModels,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: apiService.getAgents,
  });

  const removeMutation = useMutation({
    mutationFn: (name: string) => apiService.removeModelProvider(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modelProviders'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (name: string) => apiService.refreshProviderModels(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modelProviders'] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ agentId, modelId }: { agentId: string; modelId: string }) => apiService.setAgentModel(agentId, modelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentModels'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      setAssigningModel(null);
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-100">模型管理</h2>
            <p className="text-xs text-gray-500">管理 API 提供商和模型配置</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-lg text-xs text-pink-300 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          添加提供商
        </button>
      </div>

      <div className="p-4 max-h-[600px] overflow-y-auto">
        <AnimatePresence>
          {showAddForm && (
            <AddProviderForm onClose={() => setShowAddForm(false)} />
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-pink-400 animate-spin" />
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">暂无模型提供商，请检查 OpenClaw 配置文件中的 providers 设置</div>
        ) : (
          <div className="space-y-2 mt-3">
            {providers.map(provider => (
              <div key={provider.name} className="bg-gray-800/30 rounded-xl border border-white/5 overflow-hidden">
                <button
                  onClick={() => setExpandedProvider(expandedProvider === provider.name ? null : provider.name)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <Server className="w-4 h-4 text-pink-400" />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-200">{provider.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      <Globe className="w-3 h-3" />
                      <span className="truncate max-w-[200px]">{provider.baseUrl}</span>
                      <span className="text-gray-600">·</span>
                      <span>{provider.models.length} 模型</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); refreshMutation.mutate(provider.name); }}
                      className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); removeMutation.mutate(provider.name); }}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                    </span>
                    {expandedProvider === provider.name ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {expandedProvider === provider.name && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 space-y-1">
                        {provider.models.map(model => (
                          <div
                            key={model.id}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-900/40 rounded-lg group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-300 flex items-center gap-1.5">
                                <span className="truncate">{model.name}</span>
                                {model.reasoning && <Brain className="w-3 h-3 text-purple-400 flex-shrink-0" />}
                              </div>
                              <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5">
                                <span>{model.api}</span>
                                {model.contextWindow && <span>· {model.contextWindow.toLocaleString()} ctx</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => setAssigningModel(assigningModel === model.id ? null : model.id)}
                              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 rounded text-[10px] text-cyan-300 transition-all"
                            >
                              <ArrowRight className="w-3 h-3" />
                              分配
                            </button>
                          </div>
                        ))}
                        {assigningModel && provider.models.some(m => m.id === assigningModel) && (
                          <div className="mt-2 p-3 bg-gray-900/60 rounded-lg border border-cyan-500/10">
                            <div className="text-xs text-cyan-300 mb-2">分配 {assigningModel} 到 Agent:</div>
                            <div className="space-y-1">
                              {agents.map(agent => {
                                const am = agentModels.find(a => a.agentId === agent.id);
                                return (
                                  <button
                                    key={agent.id}
                                    onClick={() => assignMutation.mutate({ agentId: agent.id, modelId: assigningModel })}
                                    disabled={assignMutation.isPending}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded text-xs text-left transition-colors disabled:opacity-40"
                                  >
                                    <span>{agent.emoji || '🤖'}</span>
                                    <span className="text-gray-300">{agent.name}</span>
                                    {am && <span className="text-gray-500 ml-auto">当前: {am.model}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ModelPanel;
