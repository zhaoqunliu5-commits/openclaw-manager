import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCheck, Trash2, X, AlertTriangle,
  Info, Zap, Radio, XCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import type { AppNotification } from '../types';

const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [liveNotifications, setLiveNotifications] = useState<AppNotification[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiService.getNotifications(50),
  });

  const { data: unreadData } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: apiService.getUnreadCount,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiService.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiService.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const clearMutation = useMutation({
    mutationFn: () => apiService.clearNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setLiveNotifications([]);
    },
  });

  const connectSSE = () => {
    const es = new EventSource('/api/notifications/stream');
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') return;
        setLiveNotifications(prev => [data, ...prev].slice(0, 50));
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      } catch { }
    };
    es.onerror = () => {
      es.close();
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          connectSSE();
        }
      }, 5000);
    };
    eventSourceRef.current = es;
  };

  useEffect(() => {
    connectSSE();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [queryClient]);

  const allNotifications = [...liveNotifications, ...notifications].filter(
    (n, i, arr) => arr.findIndex(x => x.id === n.id) === i
      ).slice(0, 50);

  const unreadCount = unreadData?.count ?? allNotifications.filter(n => !n.read).length;

  const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
    service_status: { icon: Radio, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    agent_switch: { icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    info: { icon: Info, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-white/5 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-400" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-96 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-200">通知</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[10px] rounded">{unreadCount} 未读</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                    title="全部已读"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={() => clearMutation.mutate()}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                    title="清空"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {allNotifications.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 text-sm">暂无通知</div>
                ) : (
                  allNotifications.map(n => {
                    const config = typeConfig[n.type] || typeConfig.info;
                    const Icon = config.icon;
                    return (
                      <div
                        key={n.id}
                        onClick={() => markReadMutation.mutate(n.id)}
                        className={`px-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                          !n.read ? 'bg-white/[0.02]' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`p-1.5 rounded-lg ${config.bg} flex-shrink-0 mt-0.5`}>
                            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${!n.read ? 'text-gray-200' : 'text-gray-400'}`}>
                                {n.title}
                              </span>
                              {!n.read && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0" />}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-gray-600">
                                {new Date(n.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {n.agent && (
                                <span className="px-1 py-0.5 bg-purple-500/10 text-purple-400 text-[8px] rounded">{n.agent}</span>
                              )}
                              {n.service && (
                                <span className="px-1 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] rounded">{n.service}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
