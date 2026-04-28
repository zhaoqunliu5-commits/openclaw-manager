import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, Settings, GitBranch, Trash2, Download,
  RefreshCw, FileText, Loader2,
  CheckCircle2, XCircle, ExternalLink, Save
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import type { SearchResultItem, GitHubSkillRecommendation } from '../types';

const SkillEnhancePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'installed' | 'market' | 'deps'>('installed');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingFile, setEditingFile] = useState<{ slug: string; filename: string } | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: skills = [], isLoading: skillsLoading } = useQuery({
    queryKey: ['installedSkills'],
    queryFn: apiService.getInstalledSkills,
  });

  const { data: skillDetail } = useQuery({
    queryKey: ['skillDetail', selectedSkill],
    queryFn: () => apiService.getSkillDetail(selectedSkill!),
    enabled: !!selectedSkill,
  });

  const { data: dependencies = {} } = useQuery({
    queryKey: ['skillDependencies'],
    queryFn: apiService.getSkillDependencies,
  });

  const { data: searchResults = [], isLoading: searchLoading, isError: searchError } = useQuery({
    queryKey: ['skillSearch', searchQuery],
    queryFn: () => apiService.searchSkills(searchQuery),
    enabled: !!searchQuery && activeTab === 'market',
  });

  const { data: trendingSkills = [] } = useQuery({
    queryKey: ['trendingSkills'],
    queryFn: apiService.getTrendingSkills,
    enabled: activeTab === 'market',
    staleTime: 300000,
  });

  const installMutation = useMutation({
    mutationFn: (slug: string) => apiService.installSkill(slug),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['installedSkills'] });
      showMessage('success', data.message || '安装成功');
    },
    onError: () => showMessage('error', '安装失败'),
  });

  const uninstallMutation = useMutation({
    mutationFn: (slug: string) => apiService.uninstallSkill(slug),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['installedSkills'] });
      setSelectedSkill(null);
      showMessage('success', data.message || '卸载成功');
    },
    onError: () => showMessage('error', '卸载失败'),
  });

  const updateFileMutation = useMutation({
    mutationFn: ({ slug, filename, content }: { slug: string; filename: string; content: string }) =>
      apiService.updateSkillFile(slug, filename, content),
    onSuccess: () => {
      setIsEditing(false);
      showMessage('success', '文件已保存');
    },
    onError: () => showMessage('error', '保存失败'),
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const openFile = async (slug: string, filename: string) => {
    setEditingFile({ slug, filename });
    setIsEditing(false);
    const data = await apiService.getSkillFile(slug, filename);
    setFileContent(data.content);
    setEditContent(data.content);
  };

  const handleSaveFile = () => {
    if (!editingFile) return;
    updateFileMutation.mutate({
      slug: editingFile.slug,
      filename: editingFile.filename,
      content: editContent,
    });
  };

  const allDeps = Object.entries(dependencies);
  const installedSlugs = new Set(skills.map(s => s.slug));

  const tabs = [
    { key: 'installed' as const, label: '已安装', icon: <Package className="w-4 h-4" /> },
    { key: 'market' as const, label: '技能市场', icon: <Download className="w-4 h-4" /> },
    { key: 'deps' as const, label: '依赖关系', icon: <GitBranch className="w-4 h-4" /> },
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
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Package className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-100">技能管理</h2>
            <p className="text-xs text-gray-500">已安装 · 技能市场 · 依赖关系 · 配置编辑</p>
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
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
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
          {activeTab === 'installed' && (
            <motion.div key="installed" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="flex gap-3">
                <div className="w-56 flex-shrink-0 space-y-1">
                  <div className="text-xs text-gray-500 mb-2 font-medium">已安装技能 ({skills.length})</div>
                  {skillsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                    </div>
                  ) : (
                    skills.map(skill => (
                      <button
                        key={skill.slug}
                        onClick={() => setSelectedSkill(skill.slug)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all ${
                          selectedSkill === skill.slug
                            ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-300'
                        }`}
                      >
                        <span className="text-sm">{skill.emoji || '📦'}</span>
                        <span className="truncate flex-1">{skill.name || skill.slug}</span>
                        {skill.source === 'clawhub' && (
                          <span className="px-1 py-0.5 bg-blue-500/10 text-blue-400 text-[9px] rounded">hub</span>
                        )}
                      </button>
                    ))
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {skillDetail ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{skillDetail.emoji || '📦'}</span>
                        <div>
                          <h3 className="text-sm font-bold text-gray-200">{skillDetail.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{skillDetail.slug}</span>
                            {skillDetail.version && <span>· v{skillDetail.version}</span>}
                            <span>· {skillDetail.source}</span>
                          </div>
                        </div>
                        <div className="ml-auto flex items-center gap-1">
                          {skillDetail.homepage && (
                            <a href={skillDetail.homepage} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                            </a>
                          )}
                          <button
                            onClick={() => uninstallMutation.mutate(skillDetail.slug)}
                            disabled={uninstallMutation.isPending}
                            className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
                            title="卸载技能"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                          </button>
                        </div>
                      </div>

                      {skillDetail.description && (
                        <p className="text-xs text-gray-400 leading-relaxed">{skillDetail.description}</p>
                      )}

                      {skillDetail.agentAssignments && skillDetail.agentAssignments.length > 0 && (
                        <div>
                          <div className="text-[10px] text-gray-500 mb-1 font-medium">关联 Agent</div>
                          <div className="flex flex-wrap gap-1">
                            {skillDetail.agentAssignments.map(a => (
                              <span key={a} className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 text-[10px] rounded">{a}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {skillDetail.requires?.bins && skillDetail.requires.bins.length > 0 && (
                        <div>
                          <div className="text-[10px] text-gray-500 mb-1 font-medium">依赖工具</div>
                          <div className="flex flex-wrap gap-1">
                            {skillDetail.requires.bins.map(b => (
                              <span key={b} className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] rounded">{b}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {skillDetail.files && skillDetail.files.length > 0 && (
                        <div>
                          <div className="text-[10px] text-gray-500 mb-1 font-medium">技能文件</div>
                          <div className="space-y-0.5">
                            {skillDetail.files.map(f => (
                              <button
                                key={f}
                                onClick={() => openFile(skillDetail.slug, f)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-all ${
                                  editingFile?.filename === f && editingFile?.slug === skillDetail.slug
                                    ? 'bg-purple-500/10 text-purple-300'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-300'
                                }`}
                              >
                                <FileText className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{f}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
                      选择左侧技能查看详情
                    </div>
                  )}

                  {editingFile && (
                    <div className="mt-3 border-t border-white/5 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-300 font-mono">{editingFile.filename}</span>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button onClick={() => { setIsEditing(false); setEditContent(fileContent); }}
                                className="px-2 py-1 text-[10px] text-gray-400 hover:text-gray-300">取消</button>
                              <button onClick={handleSaveFile} disabled={updateFileMutation.isPending}
                                className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded text-[10px] text-purple-300 disabled:opacity-40">
                                {updateFileMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                保存
                              </button>
                            </>
                          ) : (
                            <button onClick={() => setIsEditing(true)}
                              className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] text-gray-300">
                              <Settings className="w-3 h-3" /> 编辑
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        value={isEditing ? editContent : fileContent}
                        onChange={e => { if (isEditing) setEditContent(e.target.value); }}
                        readOnly={!isEditing}
                        className={`w-full h-48 bg-gray-900/60 border rounded-xl px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none resize-none ${
                          isEditing ? 'border-purple-500/30 focus:border-purple-500/50' : 'border-white/5'
                        }`}
                        spellCheck={false}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'market' && (
            <motion.div key="market" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="搜索技能（支持中英文关键词）..."
                    className="w-full bg-gray-800/50 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/30"
                  />
                </div>
              </div>

              {searchLoading && searchQuery ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
                  <span className="ml-2 text-sm text-gray-400">搜索中...</span>
                </div>
              ) : searchError && searchQuery ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <XCircle className="w-8 h-8 mb-2 text-red-400" />
                  <p className="text-sm mb-1">搜索服务暂时不可用</p>
                  <p className="text-xs text-gray-600">请检查网络连接或稍后重试</p>
                </div>
              ) : searchQuery && searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Search className="w-8 h-8 mb-2 text-gray-600" />
                  <p className="text-sm mb-1">未找到匹配的技能</p>
                  <p className="text-xs text-gray-600">尝试使用英文关键词，如 "code review"、"search"、"writing"</p>
                </div>
              ) : searchQuery ? (
                <div className="space-y-2">
                  {searchResults.map((skill: SearchResultItem, i: number) => (
                    <div key={i} className="bg-gray-800/30 rounded-xl border border-white/5 p-3 flex items-center gap-3">
                      <span className="text-xl">{skill.emoji || '📦'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-200 font-medium truncate">{skill.name || skill.slug}</div>
                        <div className="text-xs text-gray-500 truncate">{skill.description || ''}</div>
                      </div>
                      {skill.source === 'github' && (
                        <span className="px-1.5 py-0.5 bg-gray-500/10 text-gray-400 text-[9px] rounded">GitHub</span>
                      )}
                      {installedSlugs.has(skill.slug) ? (
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] rounded-lg">已安装</span>
                      ) : (
                        <button
                          onClick={() => installMutation.mutate(skill.slug)}
                          disabled={installMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-xs text-purple-300 disabled:opacity-40"
                        >
                          {installMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          安装
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {trendingSkills.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 mb-3 font-medium flex items-center gap-1.5">
                        <span>🔥</span> 热门推荐
                      </div>
                      <div className="space-y-2">
                        {trendingSkills.slice(0, 6).map((skill: GitHubSkillRecommendation, i: number) => (
                          <div key={i} className="bg-gray-800/30 rounded-xl border border-white/5 p-3 flex items-center gap-3">
                            <span className="text-xl">📦</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-200 font-medium truncate">{skill.name || skill.slug}</div>
                              <div className="text-xs text-gray-500 truncate">{skill.description || skill.reason || ''}</div>
                            </div>
                            {installedSlugs.has(skill.slug) ? (
                              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] rounded-lg">已安装</span>
                            ) : (
                              <button
                                onClick={() => installMutation.mutate(skill.slug)}
                                disabled={installMutation.isPending}
                                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-xs text-purple-300 disabled:opacity-40"
                              >
                                {installMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                安装
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {trendingSkills.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <p className="mb-1">输入关键词搜索可安装的技能</p>
                      <p className="text-xs text-gray-600">支持中英文搜索，如 "代码审查"、"search"、"writing"</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'deps' && (
            <motion.div key="deps" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              {allDeps.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">未发现技能间依赖关系</div>
              ) : (
                <div className="space-y-3">
                  {allDeps.map(([slug, deps]) => (
                    <div key={slug} className="bg-gray-800/30 rounded-xl border border-white/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">{skills.find(s => s.slug === slug)?.emoji || '📦'}</span>
                        <span className="text-sm text-gray-200 font-medium">{slug}</span>
                        <GitBranch className="w-3 h-3 text-gray-500 ml-1" />
                      </div>
                      <div className="flex flex-wrap gap-1 ml-6">
                        {deps.map((dep: string) => (
                          <span key={dep} className={`px-1.5 py-0.5 text-[10px] rounded ${
                            installedSlugs.has(dep) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {dep} {installedSlugs.has(dep) ? '✓' : '✗'}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default SkillEnhancePanel;
