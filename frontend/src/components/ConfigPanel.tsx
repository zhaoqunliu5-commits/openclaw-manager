import React from 'react';
import { motion } from 'framer-motion';
import { Settings, Server, Shield, Puzzle, MessageSquare } from 'lucide-react';
import type { ConfigData } from '../types';

interface ConfigPanelProps {
  config: ConfigData;
}

const ConfigItem = ({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  color: string; 
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02, x: 2 }}
      className="bg-white/5 rounded-xl p-4 border border-white/10"
    >
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      <div className={`text-xl font-mono font-bold ${color}`}>
        {value}
      </div>
    </motion.div>
  );
};

const TagItem = ({ label, color }: { label: string; color: string }) => {
  return (
    <motion.span
      whileHover={{ scale: 1.1, y: -2 }}
      className={`px-4 py-2 rounded-xl text-sm font-bold border ${color}`}
    >
      {label}
    </motion.span>
  );
};

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="relative"
    >
      {/* 背景光晕 */}
      <div className="absolute -inset-1 bg-purple-500/20 rounded-2xl blur-xl"></div>
      
      {/* 主卡片 */}
      <div className="relative glass-card rounded-2xl p-6 overflow-hidden">
        {/* 装饰线 */}
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-purple-400" />
          <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            配置信息
          </h3>
        </div>
        
        <div className="space-y-6">
          {/* 基本配置 */}
          <div className="grid grid-cols-2 gap-4">
            <ConfigItem
              icon={Server}
              label="Gateway 端口"
              value={config.gatewayPort}
              color="text-cyan-400"
            />
            <ConfigItem
              icon={Settings}
              label="Gateway 模式"
              value={config.gatewayMode}
              color="text-purple-400"
            />
            <ConfigItem
              icon={Shield}
              label="认证方式"
              value={config.authMode}
              color="text-orange-400"
            />
          </div>

          {/* 已启用插件 */}
          <div>
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
              <Puzzle className="w-4 h-4" />
              <span>已启用插件</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(config.enabledPlugins ?? []).map((plugin) => (
              <TagItem
                key={plugin}
                label={plugin}
                color="bg-purple-500/20 text-purple-300 border-purple-500/30"
              />
            ))}
          </div>
          </div>

          {/* 已启用渠道 */}
          <div>
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
              <MessageSquare className="w-4 h-4" />
              <span>已启用渠道</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(config.enabledChannels ?? []).map((channel) => (
              <TagItem
                key={channel}
                label={channel}
                color="bg-green-500/20 text-green-300 border-green-500/30"
              />
            ))}
          </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ConfigPanel;
