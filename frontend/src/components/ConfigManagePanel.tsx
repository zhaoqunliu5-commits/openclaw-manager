import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, RotateCcw, Trash2, Download, Upload, GitCompare,
  ChevronDown, ChevronRight, RefreshCw, Clock, FileJson,
  Plus, CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import type { ConfigBackup, ConfigDiff, ConfigSection } from '../types';

const formatTimestamp = (ts: string): string => {
  try {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
};

const DiffBadge: React.FC<{ type: string }> = ({ type }) => {
  const config: Record<string, { color: string; label: string }> = {
    added: { color: 'text-emerald-400 bg-emerald-400/10', label: '+' },
    removed: { color: 'text-red-400 bg-red-400/10', label: '-' },
    changed: { color: 'text-amber-400 bg-amber-400/10', label: '~' },
  };
  const c = config[type] || config.changed;
  return <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${c.color}`}>{c.label}</span>;
};

const ConfigManagePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'backups' | 'editor' | 'diff' | 'transfer' | 'reload'>('backups');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [configJson, setConfigJson] = useState<string>('');
  const [editJson, setEditJson] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [diffIds, setDiffIds] = useState<{ id1: string; id2: string }>({ id1: '', id2: '' });
  const [backupLabel, setBackupLabel] = useState('');
  const [showCreateBackup, setShowCreateBackup] = useState(false);
  const [importMerge, setImportMerge] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<ConfigSection[]>({
    queryKey: ['configSections'],
    queryFn: apiService.getConfigSections,
  });

  const { data: backups = [], isLoading: backupsLoading, refetch: refetchBackups } = useQuery<ConfigBackup[]>({
    queryKey: ['configBackups'],
    queryFn: apiService.getConfigBackups,
  });

  const { data: diffResult = [] } = useQuery<ConfigDiff[]>({
    queryKey: ['configDiff', diffIds],
    queryFn: () => apiService.diffConfigBackups(diffIds.id1, diffIds.id2),
    enabled: !!(diffIds.id1 && diffIds.id2),
  });

  const createBackupMutation = useMutation({
    mutationFn: (label: string) => apiService.createConfigBackup(label),
    onSuccess: () => {
      refetchBackups();
      setShowCreateBackup(false);
      setBackupLabel('');
      showMessage('success', '备份创建成功');
    },
    onError: () => showMessage('error', '备份创建失败'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => apiService.restoreConfigBackup(id),
    onSuccess: (data) => {
      refetchBackups();
      queryClient.invalidateQueries({ queryKey: ['configSections'] });
      showMessage('success', data.message || '还原成功');
    },
    onError: () => showMessage('error', '还原失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteConfigBackup(id),
    onSuccess: () => {
      refetchBackups();
      showMessage('success', '备份已删除');
    },
    onError: () => showMessage('error', '删除失败'),
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ section, data }: { section: string; data: any }) => apiService.updateConfigSection(section, data),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['configSections'] });
      showMessage('success', '配置已更新并同步到 WSL OpenClaw');
    },
    onError: () => showMessage('error', '更新失败'),
  });

  const importMutation = useMutation({
    mutationFn: ({ config, merge }: { config: any; merge: boolean }) => apiService.importConfig(config, merge),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['configSections'] });
      refetchBackups();
      showMessage('success', data.message || '导入成功');
    },
    onError: () => showMessage('error', '导入失败'),
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadSectionConfig = async (section: string) => {
    setSelectedSection(section);
    setIsEditing(false);
    try {
      const data = await apiService.getConfigJson(section);
      const jsonStr = JSON.stringify(data, null, 2);
      setConfigJson(jsonStr);
      setEditJson(jsonStr);
    } catch {
      setConfigJson('加载失败');
      setEditJson('');
    }
  };

  const handleExport = async () => {
    try {
      const data = await apiService.exportConfig();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openclaw-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage('success', '配置已导出');
    } catch {
      showMessage('error', '导出失败');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const configData = data.config || data;
        importMutation.mutate({ config: configData, merge: importMerge });
      } catch {
        showMessage('error', '文件格式无效');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveSection = () => {
    if (!selectedSection) return;
    try {
      const data = JSON.parse(editJson);
      updateSectionMutation.mutate({ section: selectedSection, data });
    } catch {
      showMessage('error', 'JSON 格式无效');
    }
  };

  const tabs = [
    { key: 'backups' as const, label: '备份/还原', icon: <Clock className="w-4 h-4" /> },
    { key: 'editor' as const, label: '配置编辑', icon: <FileJson className="w-4 h-4" /> },
    { key: 'diff' as const, label: '配置对比', icon: <GitCompare className="w-4 h-4" /> },
    { key: 'transfer' as const, label: '导入/导出', icon: <Download className="w-4 h-4" /> },
    { key: 'reload' as const, label: '热重载', icon: <RefreshCw className="w-4 h-4" /> },
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
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Save className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-100">配置管理</h2>
            <p className="text-xs text-gray-500">备份还原 · 配置编辑 · 版本对比 · 迁移导入</p>
          </div>
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
                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
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
          {activeTab === 'backups' && (
            <motion.div key="backups" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">版本历史 ({backups.length})</span>
                <button
                  onClick={() => setShowCreateBackup(!showCreateBackup)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-xs text-blue-300 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  创建备份
                </button>
              </div>

              <AnimatePresence>
                {showCreateBackup && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
                    <div className="flex gap-2 p-3 bg-gray-800/50 rounded-xl border border-blue-500/10">
                      <input
                        type="text"
                        value={backupLabel}
                        onChange={e => setBackupLabel(e.target.value)}
                        placeholder="备份标签（可选）"
                        className="flex-1 bg-gray-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500/50 focus:outline-none"
                      />
                      <button
                        onClick={() => createBackupMutation.mutate(backupLabel)}
                        disabled={createBackupMutation.isPending}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs text-blue-300 disabled:opacity-40 transition-all"
                      >
                        {createBackupMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        确认备份
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {backupsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">暂无备份记录</div>
              ) : (
                <div className="space-y-2">
                  {backups.map(backup => (
                    <div key={backup.id} className="bg-gray-800/30 rounded-xl border border-white/5 p-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-700/30 rounded-lg">
                          <FileJson className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-200 font-medium truncate">
                            {backup.label || '手动备份'}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                            <span>{formatTimestamp(backup.timestamp)}</span>
                            <span>·</span>
                            <span>{backup.sizeKB} KB</span>
                            <span>·</span>
                            <span>{backup.sections.length} 配置项</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => restoreMutation.mutate(backup.id)}
                            disabled={restoreMutation.isPending}
                            className="p-1.5 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-40"
                            title="还原此备份"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                          <button
                            onClick={() => {
                              if (diffIds.id1 === backup.id) setDiffIds(prev => ({ ...prev, id1: '' }));
                              else if (diffIds.id2 === backup.id) setDiffIds(prev => ({ ...prev, id2: '' }));
                              else if (!diffIds.id1) setDiffIds(prev => ({ ...prev, id1: backup.id }));
                              else if (!diffIds.id2) setDiffIds(prev => ({ ...prev, id2: backup.id }));
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              diffIds.id1 === backup.id || diffIds.id2 === backup.id
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'hover:bg-white/5 text-gray-400'
                            }`}
                            title="选择对比"
                          >
                            <GitCompare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(backup.id)}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
                            title="删除备份"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                      {backup.sections.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {backup.sections.slice(0, 8).map(s => (
                            <span key={s} className="px-1.5 py-0.5 bg-gray-700/30 text-gray-400 text-[10px] rounded">{s}</span>
                          ))}
                          {backup.sections.length > 8 && (
                            <span className="px-1.5 py-0.5 text-gray-500 text-[10px]">+{backup.sections.length - 8}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'editor' && (
            <motion.div key="editor" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="flex gap-3">
                <div className="w-48 flex-shrink-0 space-y-1">
                  <div className="text-xs text-gray-500 mb-2 font-medium">配置分区</div>
                  {sectionsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                    </div>
                  ) : (
                    sections.map(section => (
                      <button
                        key={section.key}
                        onClick={() => loadSectionConfig(section.key)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all ${
                          selectedSection === section.key
                            ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-300'
                        }`}
                      >
                        {selectedSection === section.key ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <span className="truncate">{section.key}</span>
                        {section.hasData && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </button>
                    ))
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {selectedSection ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300 font-medium">{selectedSection}</span>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => { setIsEditing(false); setEditJson(configJson); }}
                                className="px-3 py-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
                              >
                                取消
                              </button>
                              <button
                                onClick={handleSaveSection}
                                disabled={updateSectionMutation.isPending}
                                className="flex items-center gap-1 px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs text-blue-300 disabled:opacity-40 transition-all"
                              >
                                {updateSectionMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                保存并同步
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setIsEditing(true)}
                              className="flex items-center gap-1 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-all"
                            >
                              编辑
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        value={isEditing ? editJson : configJson}
                        onChange={e => { if (isEditing) setEditJson(e.target.value); }}
                        readOnly={!isEditing}
                        className={`w-full h-80 bg-gray-900/60 border rounded-xl px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none resize-none ${
                          isEditing ? 'border-blue-500/30 focus:border-blue-500/50' : 'border-white/5'
                        }`}
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-80 text-gray-500 text-sm">
                      选择左侧配置分区查看/编辑
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'diff' && (
            <motion.div key="diff" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">选择两个备份版本进行对比（在备份列表中点击 <GitCompare className="w-3 h-3 inline" /> 选择）</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <select
                      value={diffIds.id1}
                      onChange={e => setDiffIds(prev => ({ ...prev, id1: e.target.value }))}
                      className="w-full bg-gray-900/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="">选择版本 A</option>
                      {backups.map(b => (
                        <option key={b.id} value={b.id}>{b.label || b.filename} ({formatTimestamp(b.timestamp)})</option>
                      ))}
                    </select>
                  </div>
                  <GitCompare className="w-4 h-4 text-gray-500" />
                  <div className="flex-1">
                    <select
                      value={diffIds.id2}
                      onChange={e => setDiffIds(prev => ({ ...prev, id2: e.target.value }))}
                      className="w-full bg-gray-900/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="">选择版本 B</option>
                      {backups.map(b => (
                        <option key={b.id} value={b.id}>{b.label || b.filename} ({formatTimestamp(b.timestamp)})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {diffIds.id1 && diffIds.id2 && diffResult.length === 0 && (
                <div className="text-center py-8 text-emerald-400 text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  两个版本完全相同
                </div>
              )}

              {diffResult.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 mb-2">发现 {diffResult.length} 处差异</div>
                  <div className="max-h-96 overflow-y-auto space-y-1">
                    {diffResult.map((diff, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-800/30 rounded-lg text-xs">
                        <DiffBadge type={diff.type} />
                        <span className="text-gray-300 font-mono flex-1 truncate">{diff.path}</span>
                        <div className="flex items-center gap-2 text-[10px]">
                          {diff.type !== 'added' && (
                            <span className="text-red-400 line-through truncate max-w-[120px]">{String(diff.oldValue)}</span>
                          )}
                          {diff.type !== 'removed' && (
                            <span className="text-emerald-400 truncate max-w-[120px]">{String(diff.newValue)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!diffIds.id1 || !diffIds.id2) && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  请选择两个备份版本进行对比
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'transfer' && (
            <motion.div key="transfer" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800/30 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Download className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-gray-200">导出配置</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">导出当前 WSL OpenClaw 的完整配置文件，可迁移到其他机器</p>
                  <button
                    onClick={handleExport}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-sm text-blue-300 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    导出 openclaw.json
                  </button>
                </div>

                <div className="bg-gray-800/30 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-gray-200">导入配置</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">从 JSON 文件导入配置到 WSL OpenClaw</p>
                  <div className="flex items-center gap-2 mb-3">
                    <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importMerge}
                        onChange={e => setImportMerge(e.target.checked)}
                        className="rounded border-gray-600"
                      />
                      合并模式（保留现有配置）
                    </label>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg text-sm text-emerald-300 disabled:opacity-40 transition-all"
                  >
                    {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    选择文件导入
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'reload' && (
            <motion.div key="reload" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <HotReloadTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const HotReloadTab: React.FC = () => {
  const [reloadResult, setReloadResult] = useState<{ success: boolean; results: { service: string; success: boolean; message: string }[]; timestamp: string } | null>(null);
  const [reloading, setReloading] = useState(false);

  const handleReload = async () => {
    setReloading(true);
    setReloadResult(null);
    try {
      const result = await apiService.hotReloadConfig();
      setReloadResult(result);
    } catch (error: any) {
      setReloadResult({
        success: false,
        results: [{ service: 'unknown', success: false, message: error.message || '热重载失败' }],
        timestamp: new Date().toISOString(),
      });
    } finally {
      setReloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-800/30 rounded-xl border border-white/5 p-6 text-center">
        <div className="text-4xl mb-3">🔥</div>
        <h3 className="text-lg font-semibold text-white mb-2">配置热重载</h3>
        <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
          修改配置后，无需重启服务即可生效。系统会向 OpenClaw 进程发送重载信号，让新配置立即生效。
        </p>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleReload}
          disabled={reloading}
          className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white font-medium disabled:opacity-50 inline-flex items-center gap-2"
        >
          {reloading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              正在重载...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              立即热重载
            </>
          )}
        </motion.button>
      </div>

      {reloadResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/30 rounded-xl border border-white/5 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-200">重载结果</span>
            <span className="text-xs text-gray-500">{new Date(reloadResult.timestamp).toLocaleString()}</span>
          </div>
          <div className="space-y-2">
            {reloadResult.results.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${r.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                {r.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-sm text-gray-300 font-mono">{r.service}</span>
                <span className="text-xs text-gray-400 flex-1">{r.message}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ConfigManagePanel;
