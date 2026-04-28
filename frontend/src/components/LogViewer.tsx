import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Play, Square, RotateCcw, ArrowRightLeft, Clock, CheckCircle2, XCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import type { OperationLog } from '../types';

interface LogViewerProps {
  logs: OperationLog[];
}

const opConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  start: { icon: Play, color: 'text-green-400', label: '启动' },
  stop: { icon: Square, color: 'text-red-400', label: '停止' },
  restart: { icon: RotateCcw, color: 'text-orange-400', label: '重启' },
  switch: { icon: ArrowRightLeft, color: 'text-cyan-400', label: '切换' },
  wait: { icon: Clock, color: 'text-yellow-400', label: '等待' },
};

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  success: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30' },
  failure: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' },
  pending: { icon: Loader2, color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' },
};

const formatTime = (ts: string) => {
  try {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return ts;
  }
};

const LogLine = ({ log, index }: { log: OperationLog; index: number }) => {
  const op = opConfig[log.operationType] || opConfig.wait;
  const st = statusConfig[log.status] || statusConfig.pending;
  const OpIcon = op.icon;
  const StIcon = st.icon;

  let detail = log.message;
  if (log.metadata) {
    try {
      const meta = JSON.parse(log.metadata);
      if (meta.agentId) detail = `切换到特工: ${meta.agentId}`;
    } catch { /* ignore */ }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${st.bg} hover:brightness-110 transition-all`}
    >
      <OpIcon className={`w-4 h-4 ${op.color} flex-shrink-0`} />
      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${op.color} bg-white/5`}>
        {op.label}
      </span>
      <span className="text-xs text-gray-400 truncate max-w-[120px]">{log.serviceName}</span>
      <span className="flex-1 text-xs text-gray-300 truncate">{detail}</span>
      <StIcon className={`w-3.5 h-3.5 ${st.color} ${log.status === 'pending' ? 'animate-spin' : ''} flex-shrink-0`} />
      <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap">{formatTime(log.timestamp)}</span>
    </motion.div>
  );
};

const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [liveLines, setLiveLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const es = new EventSource('/api/logs/stream');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'activity' && msg.data) {
          setLiveLines(prev => {
            const next = [...prev, `[${msg.timestamp}] ${msg.data}`];
            return next.slice(-100);
          });
        }
      } catch {}
    };
    return () => { es.close(); setConnected(false); };
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveLines, logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="relative"
    >
      <div className="absolute -inset-1 bg-cyan-500/20 rounded-2xl blur-xl"></div>

      <div className="relative glass-card rounded-2xl p-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>

        <div className="flex items-center gap-3 mb-4">
          <Terminal className="w-6 h-6 text-cyan-400" />
          <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            操作日志
          </h3>
          <div className="flex items-center gap-1.5 ml-auto">
            {connected ? (
              <Wifi className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className="text-xs text-gray-500">{connected ? '实时' : '离线'}</span>
            <span className="text-xs text-gray-500 ml-2">{logs.length} 条记录</span>
          </div>
        </div>

        <div className="relative">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900/80 rounded-t-xl border-b border-white/10">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="ml-4 text-xs text-gray-500 font-mono">operations.log</span>
            {liveLines.length > 0 && (
              <span className="ml-auto text-xs text-green-400 font-mono animate-pulse">● LIVE</span>
            )}
          </div>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="bg-gray-900/60 rounded-b-xl p-3 h-72 overflow-y-auto font-mono text-sm border-x border-b border-white/10 custom-scrollbar"
          >
            {liveLines.length > 0 && (
              <div className="mb-3 pb-3 border-b border-gray-700/50">
                <div className="text-xs text-green-400 mb-1.5">── 实时输出 ──</div>
                {liveLines.map((line, i) => (
                  <div key={i} className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-all">
                    <span className="text-gray-500 select-none mr-2">{String(i + 1).padStart(3, ' ')}</span>
                    {line}
                  </div>
                ))}
              </div>
            )}

            {logs.length === 0 && liveLines.length === 0 ? (
              <div className="text-gray-500 text-center py-12 flex flex-col items-center gap-3">
                <Terminal className="w-10 h-10 opacity-30" />
                <span className="text-sm">暂无操作记录</span>
                <span className="text-xs text-gray-600">在 UI 中的操作会自动记录到这里</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-xs text-cyan-400 mb-1.5">── 操作记录 ──</div>
                <AnimatePresence>
                  {logs.map((log, index) => (
                    <LogLine key={log.id || index} log={log} index={index} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {!autoScroll && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => {
                  setAutoScroll(true);
                  if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }}
                className="sticky bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-cyan-600/80 text-white text-xs rounded-full"
              >
                ↓ 回到底部
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LogViewer;
