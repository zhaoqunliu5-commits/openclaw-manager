import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Clock, Star, StarOff, Play, Trash2,
  ChevronRight, Loader2, CheckCircle2, XCircle,
  Command, History, Bookmark
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import type { CommandEntry, CommandResult } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabView = 'commands' | 'history' | 'favorites';

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabView>('commands');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [customCommand, setCustomCommand] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: commands = [] } = useQuery({
    queryKey: ['commandList'],
    queryFn: apiService.getCommandList,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['commandHistory'],
    queryFn: () => apiService.getCommandHistory(50),
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['commandFavorites'],
    queryFn: apiService.getCommandFavorites,
  });

  const executeMutation = useMutation({
    mutationFn: (cmd: string) => apiService.executeCommand(cmd),
    onSuccess: (result) => {
      setLastResult(result);
      setExecuting(false);
      queryClient.invalidateQueries({ queryKey: ['commandHistory'] });
    },
    onError: () => {
      setExecuting(false);
      setLastResult({ success: false, output: '执行失败', exitCode: 1, duration: 0 });
    },
  });

  const addFavMutation = useMutation({
    mutationFn: (entry: CommandEntry) => apiService.addCommandFavorite(entry),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commandFavorites'] }),
  });

  const removeFavMutation = useMutation({
    mutationFn: (id: string) => apiService.removeCommandFavorite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commandFavorites'] }),
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => apiService.clearCommandHistory(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commandHistory'] }),
  });

  const handleExecute = useCallback((cmd: string) => {
    if (!cmd.trim() || executing) return;
    setExecuting(true);
    setLastResult(null);
    executeMutation.mutate(cmd.trim());
  }, [executing, executeMutation]);

  const filteredCommands = commands.filter(c =>
    c.command.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredHistory = history.filter(h =>
    h.command.toLowerCase().includes(search.toLowerCase())
  );

  const filteredFavorites = favorites.filter(f =>
    f.command.toLowerCase().includes(search.toLowerCase()) ||
    f.description.toLowerCase().includes(search.toLowerCase())
  );

  const currentList = activeTab === 'commands'
    ? filteredCommands
    : activeTab === 'history'
    ? filteredHistory
    : filteredFavorites;

  useEffect(() => {
    setSelectedIdx(0);
  }, [search, activeTab]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearch('');
      setLastResult(null);
      setCustomCommand('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(prev => Math.min(prev + 1, currentList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentList[selectedIdx]) {
          const item = currentList[selectedIdx];
          const cmd = 'command' in item ? item.command : '';
          if (cmd) handleExecute(cmd);
        } else if (customCommand.trim()) {
          handleExecute(customCommand.trim());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIdx, currentList, customCommand, handleExecute, onClose]);

  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIdx] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIdx]);

  const isFavorited = (id: string) => favorites.some(f => f.id === id);

  const toggleFavorite = (cmd: CommandEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavorited(cmd.id)) {
      removeFavMutation.mutate(cmd.id);
    } else {
      addFavMutation.mutate(cmd);
    }
  };

  const tabs: { key: TabView; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'commands', label: '命令', icon: <Command className="w-3.5 h-3.5" />, count: filteredCommands.length },
    { key: 'history', label: '历史', icon: <History className="w-3.5 h-3.5" />, count: filteredHistory.length },
    { key: 'favorites', label: '收藏', icon: <Bookmark className="w-3.5 h-3.5" />, count: filteredFavorites.length },
  ];

  const categories = [...new Set(filteredCommands.map(c => c.category))];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[640px] max-h-[70vh] bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <Terminal className="w-5 h-5 text-blue-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索命令或输入自定义命令 (Ctrl+K)"
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-500 border border-gray-700">ESC</kbd>
            </div>

            <div className="flex gap-1 px-3 py-1.5 border-b border-white/5">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedIdx(0); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === tab.key
                      ? 'bg-blue-500/15 text-blue-300'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  <span className="text-[10px] text-gray-500">{tab.count}</span>
                </button>
              ))}
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto max-h-[300px] p-2">
              {activeTab === 'commands' && categories.map(cat => {
                const catCmds = filteredCommands.filter(c => c.category === cat);
                return (
                  <div key={cat} className="mb-2">
                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{cat}</div>
                    {catCmds.map((cmd) => {
                      const globalIdx = filteredCommands.indexOf(cmd);
                      return (
                        <div
                          key={cmd.id}
                          onClick={() => handleExecute(cmd.command)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                            selectedIdx === globalIdx ? 'bg-blue-500/10 text-blue-200' : 'text-gray-300 hover:bg-white/5'
                          }`}
                        >
                          <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          <span className="text-xs font-mono flex-1 truncate">{cmd.command}</span>
                          <span className="text-[10px] text-gray-500 truncate max-w-[200px]">{cmd.description}</span>
                          <button
                            onClick={(e) => toggleFavorite(cmd, e)}
                            className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                          >
                            {isFavorited(cmd.id)
                              ? <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              : <Star className="w-3 h-3 text-gray-500" />
                            }
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {activeTab === 'history' && filteredHistory.map((entry, idx) => (
                <div
                  key={entry.id}
                  onClick={() => handleExecute(entry.command)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                    selectedIdx === idx ? 'bg-blue-500/10 text-blue-200' : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Clock className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  <span className="text-xs font-mono flex-1 truncate">{entry.command}</span>
                  <span className="text-[10px] text-gray-500">{entry.duration ? `${entry.duration}ms` : ''}</span>
                  {entry.exitCode !== undefined && (
                    entry.exitCode === 0
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      : <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                  )}
                </div>
              ))}

              {activeTab === 'favorites' && filteredFavorites.map((cmd, idx) => (
                <div
                  key={cmd.id}
                  onClick={() => handleExecute(cmd.command)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                    selectedIdx === idx ? 'bg-blue-500/10 text-blue-200' : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                  <span className="text-xs font-mono flex-1 truncate">{cmd.command}</span>
                  <span className="text-[10px] text-gray-500 truncate max-w-[200px]">{cmd.description}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFavMutation.mutate(cmd.id); }}
                    className="p-1 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                  >
                    <StarOff className="w-3 h-3 text-gray-500 hover:text-red-400" />
                  </button>
                </div>
              ))}

              {currentList.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">无匹配结果</div>
              )}
            </div>

            <div className="border-t border-white/5 px-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-gray-500">$</span>
                <input
                  type="text"
                  value={customCommand}
                  onChange={e => setCustomCommand(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && customCommand.trim()) handleExecute(customCommand.trim()); }}
                  placeholder="输入自定义命令..."
                  className="flex-1 bg-gray-800/50 border border-white/5 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/30"
                />
                <button
                  onClick={() => customCommand.trim() && handleExecute(customCommand.trim())}
                  disabled={executing || !customCommand.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs text-blue-300 disabled:opacity-30 transition-all"
                >
                  {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  执行
                </button>
              </div>

              {activeTab === 'history' && history.length > 0 && (
                <button
                  onClick={() => clearHistoryMutation.mutate()}
                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  清空历史
                </button>
              )}

              <AnimatePresence>
                {lastResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 overflow-hidden"
                  >
                    <div className={`p-2 rounded-lg text-xs font-mono max-h-32 overflow-y-auto ${
                      lastResult.success ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-red-500/5 border border-red-500/10'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        {lastResult.success
                          ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          : <XCircle className="w-3 h-3 text-red-400" />
                        }
                        <span className="text-gray-400">退出码: {lastResult.exitCode} · 耗时: {lastResult.duration}ms</span>
                      </div>
                      <pre className="text-gray-300 whitespace-pre-wrap break-all">{lastResult.output}</pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
