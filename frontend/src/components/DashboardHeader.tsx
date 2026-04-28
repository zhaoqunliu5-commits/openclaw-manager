import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Zap, Layers, Activity, Terminal, ChevronDown, Sparkles, Monitor, Settings, Package, Brain, Users, Bot } from 'lucide-react';
import type { OverviewData, LucideIcon } from '../types';
import NotificationBell from './NotificationBell';

interface DashboardHeaderProps {
  data: OverviewData;
  activePanel: string | null;
  onPanelToggle: (panel: string) => void;
  modelCount?: number;
}

const AnimatedCounter = React.memo(({ value }: { value: number }) => {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.span
        key={value}
        initial={{ scale: 0.8, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {value}
      </motion.span>
    </motion.span>
  );
});

const StatCard = React.memo(({ 
  icon: Icon, 
  value, 
  label, 
  color,
  panelKey,
  isActive,
  onToggle,
}: { 
  icon: LucideIcon;
  value: number | string; 
  label: string; 
  color: string;
  panelKey: string;
  isActive: boolean;
  onToggle: () => void;
}) => {
  void panelKey;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className="relative cursor-pointer w-full text-left"
    >
      <div className={`absolute inset-0 rounded-2xl blur-xl opacity-30 ${color} transition-opacity ${isActive ? 'opacity-60' : ''}`}></div>
      <div className={`relative bg-white/5 backdrop-blur-sm border rounded-2xl p-4 text-center transition-all ${
        isActive ? 'border-white/30 bg-white/10' : 'border-white/10'
      }`}>
        <div className="flex items-center justify-center gap-1 mb-2">
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} strokeWidth={2} />
          <motion.div
            animate={{ rotate: isActive ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
          </motion.div>
        </div>
        <div className="text-3xl font-bold neon-green mb-1">
          {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
        </div>
        <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className={`absolute -bottom-0.5 left-1/4 right-1/4 h-0.5 rounded-full ${color}`}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        )}
      </div>
    </motion.button>
  );
});

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ data, activePanel, onPanelToggle, modelCount = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative mb-8"
    >
      <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 via-cyan-600/20 to-purple-600/20 rounded-3xl blur-2xl"></div>
      
      <div className="relative glass-card rounded-3xl p-8 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Terminal className="w-8 h-8 text-cyan-400 neon-green" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                OpenClaw 效率管理平台
              </h1>
            </div>
            <p className="text-gray-400 text-lg">
              服务监控 & 管理控制台 · 赛博科技版
            </p>
            <div className="mt-2">
              <NotificationBell />
            </div>
          </motion.div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full lg:w-auto">
            <StatCard 
              icon={Cpu} 
              value={data.agentCount} 
              label="Agents" 
              color="bg-cyan-500"
              panelKey="agents"
              isActive={activePanel === 'agents'}
              onToggle={() => onPanelToggle('agents')}
            />
            <StatCard 
              icon={Zap} 
              value={data.skillCount} 
              label="Skills" 
              color="bg-purple-500"
              panelKey="skills"
              isActive={activePanel === 'skills'}
              onToggle={() => onPanelToggle('skills')}
            />
            <StatCard 
              icon={Layers} 
              value={data.workspaceCount} 
              label="Workspaces" 
              color="bg-orange-500"
              panelKey="workspaces"
              isActive={activePanel === 'workspaces'}
              onToggle={() => onPanelToggle('workspaces')}
            />
            <StatCard 
              icon={Sparkles} 
              value={modelCount} 
              label="Models" 
              color="bg-pink-500"
              panelKey="models"
              isActive={activePanel === 'models'}
              onToggle={() => onPanelToggle('models')}
            />
            <StatCard 
              icon={Activity} 
              value={data.runningServiceCount} 
              label="运行服务" 
              color="bg-green-500"
              panelKey="services"
              isActive={activePanel === 'services'}
              onToggle={() => onPanelToggle('services')}
            />
            <StatCard 
              icon={Monitor} 
              value="监控" 
              label="Monitor" 
              color="bg-emerald-500"
              panelKey="monitor"
              isActive={activePanel === 'monitor'}
              onToggle={() => onPanelToggle('monitor')}
            />
            <StatCard 
              icon={Brain} 
              value="记忆" 
              label="Memory" 
              color="bg-cyan-500"
              panelKey="memory"
              isActive={activePanel === 'memory'}
              onToggle={() => onPanelToggle('memory')}
            />
            <StatCard 
              icon={Users} 
              value="协作" 
              label="协作" 
              color="bg-purple-500"
              panelKey="collaboration"
              isActive={activePanel === 'collaboration'}
              onToggle={() => onPanelToggle('collaboration')}
            />
            <StatCard 
              icon={Bot} 
              value="自动化" 
              label="自动化" 
              color="bg-amber-500"
              panelKey="automation"
              isActive={activePanel === 'automation'}
              onToggle={() => onPanelToggle('automation')}
            />
            <StatCard 
              icon={Settings} 
              value="设置" 
              label="设置" 
              color="bg-gray-500"
              panelKey="settings"
              isActive={activePanel === 'settings'}
              onToggle={() => onPanelToggle('settings')}
            />
            <StatCard 
              icon={Package} 
              value="技能" 
              label="管理" 
              color="bg-violet-500"
              panelKey="skill-enhance"
              isActive={activePanel === 'skill-enhance'}
              onToggle={() => onPanelToggle('skill-enhance')}
            />
            <StatCard 
              icon={Sparkles} 
              value="评估" 
              label="技能评估" 
              color="bg-pink-500"
              panelKey="skill-evaluation"
              isActive={activePanel === 'skill-evaluation'}
              onToggle={() => onPanelToggle('skill-evaluation')}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DashboardHeader;
