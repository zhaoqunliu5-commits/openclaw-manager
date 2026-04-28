import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Star, ExternalLink, ChevronRight, Sparkles, Terminal, Copy, Check, Github } from 'lucide-react';
import { apiService } from '../api';
import type { GitHubSkillRecommendation } from '../types';

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  search: { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  development: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  creative: { bg: 'bg-pink-500/15', text: 'text-pink-300', border: 'border-pink-500/30' },
  language: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  automation: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  operations: { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30' },
  security: { bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30' },
  analytics: { bg: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-500/30' },
};

const categoryLabels: Record<string, string> = {
  search: '搜索',
  development: '开发',
  creative: '创意',
  language: '语言',
  automation: '自动化',
  operations: '运维',
  security: '安全',
  analytics: '分析',
};

const SkillCard = ({ skill, index }: { skill: GitHubSkillRecommendation; index: number }) => {
  const [copied, setCopied] = useState(false);
  const colors = categoryColors[skill.category] || categoryColors.development;

  const handleCopy = () => {
    navigator.clipboard.writeText(skill.installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.08 }}
      className="group relative"
    >
      <div className={`absolute -inset-0.5 ${colors.bg} rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                {categoryLabels[skill.category] || skill.category}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] text-yellow-400">
                <Star className="w-3 h-3 fill-yellow-400" />
                {skill.stars}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-white truncate">{skill.name}</h4>
          </div>
          <a
            href={skill.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="在 GitHub 查看"
          >
            <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
          </a>
        </div>

        <p className="text-xs text-gray-400 mb-3 line-clamp-2">{skill.description}</p>

        <div className="flex items-center gap-1.5 text-[10px] text-cyan-400/80 mb-3">
          <Sparkles className="w-3 h-3" />
          <span className="truncate">{skill.reason}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] text-gray-300 transition-all"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <Terminal className="w-3 h-3" />
            <span className="font-mono truncate max-w-[120px]">{skill.installCommand}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const SkillRecommendationBar: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTrending, setShowTrending] = useState(false);

  const { data: recommendations, isLoading: recLoading } = useQuery({
    queryKey: ['skill-recommendations'],
    queryFn: () => apiService.getSkillRecommendations(6),
    staleTime: 60000,
    enabled: isExpanded && !showTrending,
  });

  const { data: trending, isLoading: trendLoading } = useQuery({
    queryKey: ['trending-skills'],
    queryFn: () => apiService.getTrendingSkills(),
    staleTime: 60000,
    enabled: showTrending,
  });

  const displayData = showTrending ? trending : recommendations;
  const loading = showTrending ? trendLoading : recLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="relative"
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/10 via-cyan-600/10 to-pink-600/10 rounded-2xl blur-xl" />

      <div className="relative glass-card rounded-2xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Github className="w-5 h-5 text-purple-400" />
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-white">技能推荐</h3>
              <p className="text-[10px] text-gray-400">基于你的 OpenClaw 配置智能推荐 GitHub 技能</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2.5 py-1 bg-gray-800/60 hover:bg-gray-700/60 border border-gray-600/30 rounded-lg text-[10px] text-gray-300 transition-colors"
            >
              <Github className="w-3 h-3" />
              GitHub
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </motion.div>
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-5">
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setShowTrending(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      !showTrending
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    为你推荐
                  </button>
                  <button
                    onClick={() => setShowTrending(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showTrending
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
                    }`}
                  >
                    热门趋势
                  </button>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="bg-white/5 rounded-xl p-4 animate-pulse">
                        <div className="h-3 bg-gray-700/50 rounded w-16 mb-2" />
                        <div className="h-4 bg-gray-700/50 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-gray-700/50 rounded w-full mb-3" />
                        <div className="h-6 bg-gray-700/50 rounded w-32" />
                      </div>
                    ))}
                  </div>
                ) : (displayData ?? []).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <AnimatePresence>
                      {(displayData ?? []).map((skill, index) => (
                        <SkillCard key={skill.slug} skill={skill} index={index} />
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    暂无推荐，请确保 OpenClaw 服务正常运行
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default SkillRecommendationBar;
