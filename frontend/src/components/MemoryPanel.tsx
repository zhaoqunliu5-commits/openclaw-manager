import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Search, Trash2, RefreshCw, FileText, Database,
  CheckCircle2, XCircle, Loader2, Clock
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';

const MemoryPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'status' | 'entries' | 'recall' | 'search' | 'sessions'>('status');
  const [selectedAgent, setSelectedAgent] = useState<string>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: statusList = [], isLoading: statusLoading } = useQuery({
    queryKey: ['memoryStatus'],
    queryFn: apiService.getMemoryStatus,
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['memoryEntries', selectedAgent],
    queryFn: () => apiService.getMemoryEntries(selectedAgent),
    enabled: activeTab === 'entries',
  });

  const { data: recallEntries = [] } = useQuery({
    queryKey: ['recallEntries', selectedAgent],
    queryFn: () => apiService.getRecallEntries(selectedAgent),
    enabled: activeTab === 'recall',
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['memorySearch', searchQuery],
    queryFn: () => apiService.searchMemory(searchQuery),
    enabled: !!searchQuery && activeTab === 'search',
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['memorySessions', selectedAgent],
    queryFn: () => apiService.getSessions(selectedAgent),
    enabled: activeTab === 'sessions',
  });

  const cleanMutation = useMutation({
    mutationFn: ({ agent, maxAgeDays }: { agent: string; maxAgeDays: number }) =>
      apiService.cleanOldMemories(agent, maxAgeDays),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['memoryEntries', selectedAgent] });
      showMessage('success', `已清理 ${data.deleted} 条旧记忆`);
    },
    onError: () => showMessage('error', '清理失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ agent, path }: { agent: string; path: string }) =>
      apiService.deleteMemoryEntry(agent, path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memoryEntries', selectedAgent] });
      showMessage('success', '已删除');
    },
    onError: () => showMessage('error', '删除失败'),
  });

  const reindexMutation = useMutation({
    mutationFn: (agent?: string) => apiService.reindexMemory(agent),
    onSuccess: () => showMessage('success', '重新索引完成'),
    onError: () => showMessage('error', '重新索引失败'),
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const openFile = async (agent: string, path: string) => {
    setViewingFile(path);
    const data = await apiService.getMemoryFile(agent, path);
    setFileContent(data.content);
  };

  const agents = statusList.map(s => s.agent);
  if (!agents.includes(selectedAgent) && agents.length > 0) {
    setSelectedAgent(agents[0]);
  }

  const typeIcons: Record<string, string> = {
    daily: '📅', topic: '📌', lesson: '📝', project: '🎯', dream: '💭', other: '📄',
  };

  const tabs = [
    { key: 'status' as const, label: '状态概览', icon: <Database className="w-4 h-4" /> },
    { key: 'entries' as const, label: '记忆条目', icon: <FileText className="w-4 h-4" /> },
    { key: 'recall' as const, label: '短期回忆', icon: <Brain className="w-4 h-4" /> },
    { key: 'search' as const, label: '搜索', icon: <Search className="w-4 h-4" /> },
    { key: 'sessions' as const, label: '会话', icon: <Clock className="w-4 h-4" /> },
  ];

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <Brain className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-100">内存/知识库管理</h2>
            <p className="text-xs text-gray-500">记忆条目 · 搜索会话 · 记忆清理</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            className="bg-gray-800/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none"
          >
            {agents.length > 0 ? agents.map(a => (
              <option key={a} value={a}>{a}</option>
            )) : <option value="main">main</option>}
          </select>
          <button
            onClick={() => reindexMutation.mutate(selectedAgent)}
            disabled={reindexMutation.isPending}
            className="flex items-center gap-1 px-2 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-lg text-xs text-cyan-300 disabled:opacity-40"
          >
            {reindexMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            重建索引
          </button>
        </div>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`mx-4 mt-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
              message.type === 'success' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-1 px-4 py-2 border-b border-white/5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20'
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
          {activeTab === 'status' && (
            <motion.div key="status" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              {statusLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {statusList.map(s => (
                    <div key={s.agent} className="bg-gray-800/30 rounded-xl border border-white/5 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200">{s.agent}</span>
                          {s.vectorReady && (
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] rounded">向量就绪</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{s.workspace}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center">
                          <div className="text-lg font-bold text-cyan-400">{s.indexedFiles}/{s.totalFiles}</div>
                          <div className="text-[10px] text-gray-500">索引文件</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-purple-400">{s.chunks}</div>
                          <div className="text-[10px] text-gray-500">分块</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-amber-400">{s.recallEntries}</div>
                          <div className="text-[10px] text-gray-500">回忆条目</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-emerald-400">{s.promoted}</div>
                          <div className="text-[10px] text-gray-500">已提升</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'entries' && (
            <motion.div key="entries" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">共 {entries.length} 条记忆</span>
                <button
                  onClick={() => cleanMutation.mutate({ agent: selectedAgent, maxAgeDays: 30 })}
                  disabled={cleanMutation.isPending}
                  className="flex items-center gap-1 px-2 py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-xs text-red-300 disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" />
                  清理30天前
                </button>
              </div>
              {entriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-1">
                  {entries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors group">
                      <span className="text-sm">{typeIcons[entry.type] || '📄'}</span>
                      <button
                        onClick={() => openFile(selectedAgent, entry.path)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="text-xs text-gray-300 truncate">{entry.filename}</div>
                        <div className="text-[10px] text-gray-500 truncate">{entry.preview.substring(0, 80)}</div>
                      </button>
                      <span className="text-[10px] text-gray-600">{formatSize(entry.size)}</span>
                      <span className="text-[10px] text-gray-600">{entry.modified.split('T')[0]}</span>
                      <button
                        onClick={() => deleteMutation.mutate({ agent: selectedAgent, path: entry.path })}
                        disabled={deleteMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-all"
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {viewingFile && (
                <div className="mt-3 border-t border-white/5 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-300 font-mono">{viewingFile}</span>
                    <button onClick={() => { setViewingFile(null); setFileContent(''); }}
                      className="text-xs text-gray-500 hover:text-gray-300">关闭</button>
                  </div>
                  <pre className="bg-gray-900/60 border border-white/5 rounded-xl p-3 text-xs font-mono text-gray-300 max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {fileContent}
                  </pre>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'recall' && (
            <motion.div key="recall" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="text-xs text-gray-500 mb-3">短期回忆条目 ({recallEntries.length})</div>
              <div className="space-y-1">
                {recallEntries.map((entry, i) => (
                  <div key={i} className="px-3 py-2 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300 truncate flex-1">{entry.path}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] rounded">
                          得分 {entry.totalScore.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-gray-500">×{entry.recallCount}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">{entry.snippet}</div>
                    {entry.lastRecalledAt && (
                      <div className="text-[9px] text-gray-600 mt-1">最后回忆: {entry.lastRecalledAt.split('T')[0]}</div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div key="search" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="跨 Agent 搜索记忆..."
                    className="w-full bg-gray-800/50 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/30"
                  />
                </div>
              </div>
              {!searchQuery ? (
                <div className="text-center py-8 text-gray-500 text-sm">输入关键词搜索所有 Agent 的记忆</div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">未找到匹配结果</div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((result, i) => (
                    <div key={i} className="bg-gray-800/30 rounded-xl border border-white/5 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300 font-mono truncate">{result.file}</span>
                        <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 text-[9px] rounded">
                          {result.score.toFixed(3)}
                        </span>
                      </div>
                      <pre className="text-[10px] text-gray-400 whitespace-pre-wrap max-h-24 overflow-y-auto">{result.snippet}</pre>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'sessions' && (
            <motion.div key="sessions" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="text-xs text-gray-500 mb-3">会话记录 ({sessions.length})</div>
              <div className="space-y-1">
                {sessions.map(session => (
                  <div key={session.id} className="flex items-center gap-2 px-3 py-2 bg-gray-800/30 rounded-lg">
                    <span className={`w-2 h-2 rounded-full ${session.active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                    <span className="text-xs text-gray-300 font-mono truncate flex-1">{session.id.substring(0, 16)}...</span>
                    <span className="text-[10px] text-gray-600">{formatSize(session.size)}</span>
                    <span className="text-[10px] text-gray-600">{session.modified.split('T')[0]}</span>
                    {session.active && (
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] rounded">活跃</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default MemoryPanel;
