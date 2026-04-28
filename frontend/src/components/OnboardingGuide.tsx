import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, BookOpen, Server, Cpu, Zap, Settings, Activity,
  Brain, Users, FileText, Wrench, Workflow,
  ChevronRight, Search
} from 'lucide-react';

interface DocSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  color: string;
  sections: {
    subtitle: string;
    content: string;
    example?: string;
    tip?: string;
  }[];
}

const STORAGE_ONBOARDING = 'openclaw-onboarding-done';

const docSections: DocSection[] = [
  {
    id: 'quick-start',
    icon: <BookOpen className="w-5 h-5" />,
    title: '快速开始',
    color: 'text-cyan-400',
    sections: [
      {
        subtitle: '什么是 OpenClaw？',
        content: 'OpenClaw 是一个多智能体（Agent）协作系统。你可以把它理解为一个 AI 团队：每个 Agent 负责不同领域（编程、写作、搜索等），它们可以互相协作完成复杂任务。',
      },
      {
        subtitle: '第一步：启动服务',
        content: '在首页找到「服务状态」卡片，点击 openclaw-gateway 的「启动」按钮。Gateway 是核心网关服务，必须先启动才能使用其他功能。',
        example: '操作：首页 → 服务卡片 → 点击「启动」',
        tip: '如果启动失败，请检查 WSL 是否正常运行，以及 OpenClaw 是否已正确安装',
      },
      {
        subtitle: '第二步：查看你的 Agent',
        content: '点击首页「Agent」卡片或按 Ctrl+1，查看当前配置的所有智能体。每个 Agent 有独立的模型、技能和工作区。',
        example: '快捷键：Ctrl+1 打开 Agent 面板',
      },
      {
        subtitle: '第三步：安装技能',
        content: 'Agent 通过技能（Skill）来扩展能力。在「技能增强」面板中搜索和安装技能，比如搜索 "code review" 安装代码审查技能。',
        example: '操作：技能增强面板 → 技能市场 → 搜索 "code review" → 点击安装',
        tip: '搜索支持中英文，输入"代码审查"也能搜到相关技能',
      },
    ],
  },
  {
    id: 'services',
    icon: <Server className="w-5 h-5" />,
    title: '服务管理',
    color: 'text-emerald-400',
    sections: [
      {
        subtitle: '服务类型',
        content: 'OpenClaw 有两个核心服务：\n• openclaw-gateway：网关服务，负责消息路由和 Agent 调度\n• canvas：画布服务，负责多模态内容处理',
      },
      {
        subtitle: '启动/停止/重启',
        content: '每个服务卡片上都有启动、停止、重启按钮。服务状态会实时更新（每 30 秒刷新一次）。',
        example: '重启服务：点击服务卡片 → 点击「↻ 重启」按钮',
      },
      {
        subtitle: '健康检查',
        content: '服务卡片下方的「健康检查」面板会自动检测服务存活状态。开启「自动恢复」后，服务异常停止时会自动重启。',
        example: '设置：健康检查面板 → 点击 ⚙️ → 开启「自动恢复」→ 设置检查间隔',
        tip: '建议开启自动恢复，避免服务意外停止后无人值守',
      },
    ],
  },
  {
    id: 'agents',
    icon: <Cpu className="w-5 h-5" />,
    title: 'Agent 管理',
    color: 'text-purple-400',
    sections: [
      {
        subtitle: '什么是 Agent？',
        content: 'Agent（智能体）是 OpenClaw 的核心执行单元。每个 Agent 有独立的：\n• 模型配置（使用哪个 LLM）\n• 技能列表（能做什么）\n• 工作区（在哪个目录工作）\n• 会话历史（对话记录）',
      },
      {
        subtitle: '查看 Agent 详情',
        content: '点击首页「Agent」卡片，展开某个 Agent 可以查看：当前模型、会话数、记忆文件数、技能列表等详细信息。',
        example: '操作：首页 → Agent 卡片 → 点击展开箭头',
      },
      {
        subtitle: '切换默认 Agent',
        content: '在 Agent 详情面板中，点击「设为默认」可以将某个 Agent 设为默认对话对象。',
      },
    ],
  },
  {
    id: 'models',
    icon: <Settings className="w-5 h-5" />,
    title: '模型配置',
    color: 'text-orange-400',
    sections: [
      {
        subtitle: '模型提供商',
        content: 'OpenClaw 支持多个 LLM 提供商：OpenAI、Anthropic、Google、本地模型等。在「模型」面板中查看和配置提供商。',
      },
      {
        subtitle: '检测提供商',
        content: '点击「检测提供商」按钮，系统会自动扫描配置文件中已配置的模型提供商及其可用模型。',
        example: '操作：模型面板 → 点击「检测提供商」',
      },
      {
        subtitle: '为 Agent 分配模型',
        content: '每个 Agent 可以使用不同的模型。在 Agent 详情中查看当前使用的模型，在配置文件中修改。',
      },
    ],
  },
  {
    id: 'skills',
    icon: <Zap className="w-5 h-5" />,
    title: '技能系统',
    color: 'text-amber-400',
    sections: [
      {
        subtitle: '什么是技能？',
        content: 'Skill（技能）是 Agent 可调用的能力模块。例如：\n• skill-finder：搜索和安装新技能\n• runninghub：生成图片和视频\n• brave-search：网络搜索',
      },
      {
        subtitle: '搜索安装技能',
        content: '在「技能增强」面板的「技能市场」Tab 中搜索技能。支持中英文搜索，输入关键词后点击安装。',
        example: '搜索示例：\n• 输入 "search" → 搜索相关技能\n• 输入 "搜索" → 自动翻译为 search 搜索\n• 输入 "code review" → 搜索代码审查技能',
        tip: '如果搜索不到结果，可能是网络问题，请尝试英文关键词',
      },
      {
        subtitle: '技能推荐',
        content: '首页底部的「技能推荐」栏会根据你的 Agent 配置智能推荐技能。也可以切换到「热门趋势」查看最受欢迎的技能。',
      },
      {
        subtitle: '技能评估',
        content: '在「技能评估」面板中可以查看已安装技能的评分、使用统计和优化建议。',
      },
    ],
  },
  {
    id: 'memory',
    icon: <Brain className="w-5 h-5" />,
    title: '记忆管理',
    color: 'text-blue-400',
    sections: [
      {
        subtitle: '什么是记忆？',
        content: 'Agent 的记忆是它保存的长期知识，包括对话摘要、学习到的规则、用户偏好等。记忆让 Agent 在不同会话间保持上下文。',
      },
      {
        subtitle: '查看记忆',
        content: '在「记忆」面板中选择一个 Agent，可以查看：\n• 状态概览：文件数、分块数、回忆条目\n• 记忆条目：具体的记忆文件列表\n• 短期回忆：最近的对话摘要\n• 搜索：跨 Agent 搜索记忆内容',
        example: '操作：记忆面板 → 选择 Agent → 切换 Tab 查看不同内容',
        tip: '如果显示"WSL 不可用"，请确保 WSL 已安装并运行',
      },
      {
        subtitle: '搜索记忆',
        content: '在「搜索」Tab 中输入关键词，可以搜索所有 Agent 的记忆内容。搜索会先尝试 OpenClaw 内置搜索，失败时自动降级为文件系统搜索。',
      },
    ],
  },
  {
    id: 'collaboration',
    icon: <Users className="w-5 h-5" />,
    title: '多 Agent 协作',
    color: 'text-pink-400',
    sections: [
      {
        subtitle: 'Agent 间通信',
        content: '在「协作」面板中，你可以：\n• 给指定 Agent 发送消息\n• 广播消息给所有 Agent\n• 查看 Agent 之间的路由绑定关系',
      },
      {
        subtitle: '发送消息',
        content: '选择目标 Agent，输入消息内容，点击发送。消息会通过 Gateway 路由到目标 Agent。',
        example: '操作：协作面板 → 选择 Agent → 输入消息 → 点击发送',
        tip: '如果 Agent 列表为空，点击刷新按钮重新检测',
      },
      {
        subtitle: '工作流',
        content: '在「工作流」Tab 中可以创建多步骤的 Agent 协作流程，让多个 Agent 按顺序处理任务。',
      },
    ],
  },
  {
    id: 'monitor',
    icon: <Activity className="w-5 h-5" />,
    title: '监控面板',
    color: 'text-green-400',
    sections: [
      {
        subtitle: '系统资源',
        content: '监控面板显示 Gateway 和 Canvas 的 CPU、内存使用情况，以及会话数、记忆文件数、任务数等统计信息。',
      },
      {
        subtitle: 'Agent 活跃度',
        content: '在「Agent 活跃度」Tab 中查看每个 Agent 的会话数、活跃会话数、最后活跃时间等。',
      },
      {
        subtitle: '会话统计',
        content: '在「会话统计」Tab 中查看最近的会话列表，包括使用的模型、状态、通道、数据大小等。',
      },
      {
        subtitle: '导出数据',
        content: '点击监控面板右上角的下载按钮，可以将监控数据导出为 JSON 文件，方便分析和归档。',
        example: '操作：监控面板 → 点击 ↓ 按钮 → 自动下载 JSON 文件',
      },
    ],
  },
  {
    id: 'automation',
    icon: <Workflow className="w-5 h-5" />,
    title: '自动化',
    color: 'text-violet-400',
    sections: [
      {
        subtitle: '什么是自动化？',
        content: '自动化规则让你设置定时任务或事件触发器，自动执行操作。比如每天重启服务、服务停止时发送通知等。',
      },
      {
        subtitle: '从模板创建',
        content: '最简单的方式是使用预设模板。点击「从模板创建」，选择一个模板，修改参数后即可创建规则。',
        example: '模板示例：\n• 每日定时重启 Gateway\n• 服务停止时自动通知\n• 每小时健康检查\n• 健康检查失败时重启\n• 配置变更后通知',
      },
      {
        subtitle: '自定义规则',
        content: '点击「新建规则」自定义：\n1. 选择触发方式（定时/事件）\n2. 选择执行动作（执行命令/发送通知/切换Agent/重启服务）\n3. 配置具体参数\n4. 点击创建',
        example: '示例：创建一个每 30 分钟检查一次的规则\n触发方式：定时 → 间隔：30分钟\n执行动作：执行命令 → openclaw status',
      },
      {
        subtitle: '管理规则',
        content: '创建后的规则可以通过开关启用/禁用，点击「执行」手动触发，点击「日志」查看执行历史。',
      },
    ],
  },
  {
    id: 'config',
    icon: <Wrench className="w-5 h-5" />,
    title: '配置管理',
    color: 'text-teal-400',
    sections: [
      {
        subtitle: '配置分区',
        content: '配置管理面板分为多个分区：\n• 模型配置：LLM 提供商和模型设置\n• Agent 配置：智能体列表和属性\n• 插件配置：启用的插件和参数\n• 通道配置：消息通道设置',
      },
      {
        subtitle: '备份与还原',
        content: '修改配置前建议先创建备份。在「备份/还原」Tab 中可以：\n• 创建备份（带标签）\n• 还原到某个备份\n• 对比两个备份的差异\n• 导出/导入配置',
        example: '操作：配置管理 → 备份/还原 → 点击「创建备份」',
        tip: '配置修改后会自动热重载，无需重启服务',
      },
    ],
  },
  {
    id: 'shortcuts',
    icon: <FileText className="w-5 h-5" />,
    title: '快捷键',
    color: 'text-gray-400',
    sections: [
      {
        subtitle: '全局快捷键',
        content: '• Ctrl+K：打开命令面板\n• Ctrl+1~9：切换各功能面板\n• Ctrl+R：刷新页面\n• Esc：关闭当前面板\n• ?：打开帮助文档',
      },
      {
        subtitle: '命令面板',
        content: '按 Ctrl+K 打开命令面板，可以快速搜索和执行操作。支持搜索命令、查看历史、收藏常用命令。',
        example: '操作：按 Ctrl+K → 输入 "restart" → 选择重启命令 → 回车执行',
      },
    ],
  },
];

const HelpDocPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState('quick-start');
  const [searchQuery, setSearchQuery] = useState('');

  const currentDoc = docSections.find(d => d.id === activeSection);

  const filteredSections = searchQuery
    ? docSections.filter(d =>
        d.title.includes(searchQuery) ||
        d.sections.some(s =>
          s.subtitle.includes(searchQuery) ||
          s.content.includes(searchQuery)
        )
      )
    : docSections;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed right-0 top-0 bottom-0 w-full max-w-2xl z-50 flex"
    >
      <div className="flex-1" onClick={onClose} />
      <div className="w-full max-w-2xl bg-gray-900/95 backdrop-blur-xl border-l border-white/10 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">使用文档</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索文档内容..."
              className="w-full bg-gray-800/50 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/30"
            />
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-48 border-r border-white/5 overflow-y-auto py-2 shrink-0">
            {filteredSections.map(section => (
              <button
                key={section.id}
                onClick={() => { setActiveSection(section.id); setSearchQuery(''); }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                  activeSection === section.id
                    ? 'bg-white/5 text-white font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
                }`}
              >
                <span className={section.color}>{section.icon}</span>
                <span className="truncate">{section.title}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {currentDoc && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className={currentDoc.color}>{currentDoc.icon}</span>
                  <h3 className="text-xl font-bold text-white">{currentDoc.title}</h3>
                </div>

                <div className="space-y-6">
                  {currentDoc.sections.map((sub, i) => (
                    <div key={i}>
                      <h4 className="text-sm font-semibold text-gray-200 mb-2">{sub.subtitle}</h4>
                      <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">{sub.content}</p>
                      {sub.example && (
                        <div className="mt-2 px-3 py-2 bg-gray-800/60 border border-white/5 rounded-lg">
                          <div className="flex items-center gap-1.5 mb-1">
                            <ChevronRight className="w-3 h-3 text-cyan-400" />
                            <span className="text-[10px] font-medium text-cyan-400 uppercase tracking-wider">操作示例</span>
                          </div>
                          <p className="text-xs text-gray-300 whitespace-pre-line">{sub.example}</p>
                        </div>
                      )}
                      {sub.tip && (
                        <div className="mt-2 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                          <span className="text-[10px] font-medium text-amber-400">💡 提示：</span>
                          <span className="text-xs text-amber-300/80 ml-1">{sub.tip}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const OnboardingGuide: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { title: '欢迎使用 OpenClaw 管理平台', desc: '这是一个可视化管理界面，帮助你管理和监控 OpenClaw 智能体系统。' },
    { title: '第一步：启动服务', desc: '在首页找到服务卡片，点击「启动」按钮启动 Gateway 网关服务。' },
    { title: '第二步：查看 Agent', desc: '按 Ctrl+1 查看 Agent 列表，了解每个智能体的配置和能力。' },
    { title: '第三步：安装技能', desc: '在技能市场搜索和安装技能，扩展 Agent 的能力。支持中英文搜索。' },
    { title: '需要帮助？', desc: '随时点击右上角「📖」按钮或按 ? 键打开详细使用文档，包含每个功能的说明和操作示例。' },
  ];

  useState(() => {
    const done = localStorage.getItem(STORAGE_ONBOARDING);
    if (!done) setVisible(true);
  });

  const handleClose = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_ONBOARDING, '1');
  };

  const step = steps[currentStep];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md mx-4 glass-card rounded-2xl p-8 border border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6">
                <BookOpen className="w-8 h-8 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">{step.title}</h2>
              <p className="text-gray-300 leading-relaxed mb-6">{step.desc}</p>

              <div className="flex items-center gap-2 mb-6">
                {steps.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentStep ? 'w-8 bg-cyan-400' : i < currentStep ? 'w-4 bg-cyan-400/40' : 'w-4 bg-gray-600'}`} />
                ))}
              </div>

              <div className="flex items-center gap-4 w-full">
                <button onClick={() => setCurrentStep(p => Math.max(0, p - 1))} disabled={currentStep === 0} className="px-4 py-2 text-sm text-gray-400 disabled:opacity-30">
                  上一步
                </button>
                <div className="flex-1" />
                <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-400">跳过</button>
                <button
                  onClick={() => currentStep === steps.length - 1 ? handleClose() : setCurrentStep(p => p + 1)}
                  className="px-6 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-600 to-cyan-500 text-white"
                >
                  {currentStep === steps.length - 1 ? '开始使用' : '下一步'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export { HelpDocPanel, OnboardingGuide };
export default OnboardingGuide;
