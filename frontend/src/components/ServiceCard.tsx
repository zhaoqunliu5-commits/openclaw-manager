import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, RotateCcw, Server, Activity, Clock, HardDrive, ExternalLink } from 'lucide-react';
import type { ServiceStatus, LucideIcon } from '../types';

interface ServiceCardProps {
  service: ServiceStatus;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  isLoading?: boolean;
  index?: number;
}

const StatusIndicator = React.memo(({ isRunning }: { isRunning: boolean }) => {
  return (
    <div className="relative">
      <motion.div
        animate={{
          scale: isRunning ? [1, 1.2, 1] : 1,
          opacity: isRunning ? [0.5, 1, 0.5] : 1,
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className={`absolute inset-0 rounded-full blur-md ${
          isRunning ? 'bg-green-500' : 'bg-gray-600'
        }`}
      ></motion.div>
      <motion.div
        className={`w-4 h-4 rounded-full relative z-10 ${
          isRunning ? 'bg-green-400' : 'bg-gray-500'
        }`}
        animate={{
          boxShadow: isRunning 
            ? '0 0 20px rgba(74, 222, 128, 0.6), 0 0 40px rgba(74, 222, 128, 0.3)'
            : '0 0 10px rgba(107, 114, 128, 0.3)'
        }}
      ></motion.div>
    </div>
  );
});

const ActionButton = React.memo(({ 
  icon: Icon, 
  label, 
  onClick, 
  variant, 
  disabled 
}: { 
  icon: LucideIcon; 
  label: string; 
  onClick: () => void; 
  variant: 'start' | 'stop' | 'restart' | 'open';
  disabled?: boolean;
}) => {
  const variants = {
    start: 'from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400',
    stop: 'from-red-600 to-red-500 hover:from-red-500 hover:to-red-400',
    restart: 'from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400',
    open: 'from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onClick();
    }
  };

  return (
    <motion.button
      type="button"
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={handleClick}
      disabled={disabled}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all btn-glow ${
        disabled 
          ? 'bg-gray-700 cursor-not-allowed opacity-50' 
          : `bg-gradient-to-r ${variants[variant]} text-white`
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </motion.button>
  );
});

const ServiceCard: React.FC<ServiceCardProps> = React.memo(({ 
  service, 
  onStart, 
  onStop, 
  onRestart,
  isLoading = false,
  index = 0
}) => {
  const statusText = service.isRunning ? '运行中' : '已停止';

  const handleOpenUI = () => {
    if (service.url) {
      const url = service.authToken
        ? `${service.url}#token=${service.authToken}`
        : service.url;
      window.open(url, '_blank');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="relative"
    >
      <div className={`absolute -inset-1 rounded-2xl blur-xl opacity-30 transition-all duration-500 ${
        service.isRunning ? 'bg-green-500/30' : 'bg-gray-600/20'
      }`}></div>
      
      <div className="relative glass-card rounded-2xl p-6 overflow-hidden group">
        <div className={`absolute top-0 left-0 w-full h-0.5 transition-all duration-500 ${
          service.isRunning 
            ? 'bg-gradient-to-r from-transparent via-green-500 to-transparent' 
            : 'bg-gradient-to-r from-transparent via-gray-600 to-transparent'
        }`}></div>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <StatusIndicator isRunning={service.isRunning} />
            <div>
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-400" />
                <h3 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  {service.name}
                </h3>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {service.isRunning && service.url && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenUI}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                打开 UI
              </motion.button>
            )}
            <motion.div
              animate={{
                backgroundColor: service.isRunning ? 'rgba(74, 222, 128, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                borderColor: service.isRunning ? 'rgba(74, 222, 128, 0.3)' : 'rgba(107, 114, 128, 0.3)',
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-bold border ${
                service.isRunning ? 'text-green-400' : 'text-gray-400'
              }`}
            >
              {statusText}
            </motion.div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {service.isRunning && (
            <motion.div
              key="details"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Activity className="w-4 h-4" />
                    <span>PID</span>
                  </div>
                  <div className="text-xl font-mono font-bold text-cyan-400">
                    {service.pid != null ? service.pid : '-'}
                  </div>
                </div>
                
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <HardDrive className="w-4 h-4" />
                    <span>内存</span>
                  </div>
                  <div className="text-xl font-mono font-bold text-purple-400">
                    {service.memory ?? '-'}
                  </div>
                </div>
                
                <div className="col-span-2 bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    <span>运行时间</span>
                  </div>
                  <div className="text-xl font-mono font-bold text-orange-400">
                    {service.uptime ?? '-'}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3">
          {!service.isRunning ? (
            <ActionButton
              icon={Play}
              label="启动"
              variant="start"
              onClick={onStart}
              disabled={isLoading}
            />
          ) : (
            <>
              <ActionButton
                icon={RotateCcw}
                label="重启"
                variant="restart"
                onClick={onRestart}
                disabled={isLoading}
              />
              <ActionButton
                icon={Square}
                label="停止"
                variant="stop"
                onClick={onStop}
                disabled={isLoading}
              />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default ServiceCard;
