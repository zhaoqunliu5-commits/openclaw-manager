import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api';
import { Sparkles, TrendingUp, Star, Clock, Zap, AlertTriangle, Play, ThumbsUp } from 'lucide-react';

export default function SkillEvaluationPanel() {
  const queryClient = useQueryClient();
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const { data: stats = [] } = useQuery({
    queryKey: ['skill-stats'],
    queryFn: apiService.getSkillStats,
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['skill-recommendations'],
    queryFn: () => apiService.getSkillEvalRecommendations(5),
  });

  const analyzeMutation = useMutation({
    mutationFn: apiService.analyzeSkill,
    onSuccess: (data) => setAnalysis(data),
  });

  const executeMutation = useMutation({
    mutationFn: ({ skill, params }: { skill: string; params?: string }) =>
      apiService.executeSkill(skill, params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skill-stats'] }),
  });

  const rateMutation = useMutation({
    mutationFn: ({ skill, rating }: { skill: string; rating: number }) =>
      apiService.rateSkill(skill, rating),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skill-stats'] }),
  });

  const getRatingStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          onClick={() => selectedSkill && rateMutation.mutate({ skill: selectedSkill, rating: i })}
          className={`${i <= rating ? 'text-yellow-400' : 'text-gray-600'} hover:text-yellow-300 transition-colors`}
        >
          <Star className="w-4 h-4" fill={i <= rating ? 'currentColor' : 'none'} />
        </button>
      );
    }
    return stars;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-cyan-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-400" />
          技能评估中心
        </h2>
        <p className="text-gray-400 text-sm mt-1">分析技能使用情况、获取推荐、执行技能并评分</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-5 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" /> 技能排行榜
          </h3>

          {stats.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              暂无技能使用数据。执行技能后会自动记录统计数据。
            </div>
          ) : (
            <div className="space-y-3">
              {stats.slice(0, 10).map((skill: any, index: number) => (
                <motion.div
                  key={skill.skill}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-gray-800/50 rounded-xl p-4 cursor-pointer transition-all ${
                    selectedSkill === skill.skill ? 'border border-cyan-500/30 bg-cyan-500/10' : 'hover:bg-gray-700/50'
                  }`}
                  onClick={() => setSelectedSkill(skill.skill)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        index === 1 ? 'bg-gray-400/20 text-gray-300' :
                        index === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-gray-700/50 text-gray-400'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{skill.skill}</h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {skill.useCount} 次使用
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" /> {skill.successRate.toFixed(0)}% 成功率
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {getRatingStars(Math.round(skill.rating))}
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          analyzeMutation.mutate(skill.skill);
                        }}
                        className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-xs hover:bg-purple-500/30"
                      >
                        分析
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          executeMutation.mutate({ skill: skill.skill });
                        }}
                        disabled={executeMutation.isPending}
                        className="px-3 py-1.5 bg-cyan-500/20 text-cyan-300 rounded-lg text-xs hover:bg-cyan-500/30 disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 inline" />
                      </motion.button>
                    </div>
                  </div>

                  {skill.avgExecutionTimeMs && (
                    <div className="mt-2 text-xs text-gray-500">
                      平均执行时间: {(skill.avgExecutionTimeMs / 1000).toFixed(1)}s
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" /> 推荐技能
          </h3>
          {recommendations.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">暂无推荐</div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((skill: any) => (
                <div
                  key={skill.skill}
                  className="bg-gray-800/50 rounded-lg p-3 cursor-pointer hover:bg-gray-700/50 transition-all"
                  onClick={() => setSelectedSkill(skill.skill)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white font-medium">{skill.skill}</span>
                    <div className="flex items-center gap-1">
                      {[...Array(Math.round(skill.rating))].map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-yellow-400" fill="currentColor" />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{skill.useCount} 次使用</span>
                    <span>·</span>
                    <span>{skill.successRate.toFixed(0)}% 成功率</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">技能分析: {analyzeMutation.variables}</h3>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">综合评分</span>
                <span className={`text-3xl font-bold ${getScoreColor(analysis.score)}`}>{analysis.score}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {analysis.strengths.length > 0 && (
                <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                  <h4 className="text-green-400 font-medium mb-2 flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4" /> 优势
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-300">
                    {analysis.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-green-400">✓</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.weaknesses.length > 0 && (
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                  <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> 不足
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-300">
                    {analysis.weaknesses.map((w: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-red-400">!</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.suggestions.length > 0 && (
                <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                  <h4 className="text-purple-400 font-medium mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> 建议
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-300">
                    {analysis.suggestions.map((s: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-purple-400">→</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}