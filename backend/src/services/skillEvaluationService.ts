import { dbService } from './dbService.js';
import { WslService } from './wslService.js';
import { appConfig } from '../config.js';

export interface SkillStat {
  id: number;
  skill: string;
  useCount: number;
  successCount: number;
  avgExecutionTimeMs: number | null;
  lastUsed: string | null;
  rating: number;
  successRate: number;
  createdAt: string;
  updatedAt: string;
}

interface DbSkillStat {
  id: number;
  skill: string;
  use_count: number;
  success_count: number;
  avg_execution_time_ms: number | null;
  last_used: string | null;
  rating: number;
  created_at: string;
  updated_at: string;
}

class SkillEvaluationService {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    const count = dbService.getDb().prepare(`SELECT COUNT(*) as c FROM skill_stats`).get() as any;
    if (count.c > 0) { this.initialized = true; return; }

    try {
      const { DataCache } = await import('./dataCache.js');
      const skills = await DataCache.getOrFetch('skills-list', async () => {
        const { OpenclawService } = await import('./openclawService.js');
        return OpenclawService.getSkills();
      }, 120000);

      const insert = dbService.getDb().prepare(
        `INSERT OR IGNORE INTO skill_stats (skill, use_count, success_count, rating) VALUES (?, 0, 0, 3)`
      );
      for (const skill of skills) {
        insert.run(skill.name || skill.id);
      }
    } catch {}
    this.initialized = true;
  }

  getStats(): SkillStat[] {
    const rows = dbService.getDb().prepare(
      `SELECT * FROM skill_stats ORDER BY use_count DESC`
    ).all() as DbSkillStat[];
    return rows.map(r => ({
      id: r.id, skill: r.skill, useCount: r.use_count, successCount: r.success_count,
      avgExecutionTimeMs: r.avg_execution_time_ms, lastUsed: r.last_used,
      rating: r.rating, successRate: r.use_count > 0 ? (r.success_count / r.use_count) * 100 : 0,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  async scanSkills(): Promise<{ slug: string; name: string; description: string; category: string }[]> {
    try {
      const output = await WslService.execCommand(
        `find ${appConfig.openclawPath}/skills -maxdepth 2 -name "manifest.json" 2>/dev/null`,
        10000
      );
      const files = output.split('\n').filter(f => f.trim());
      const skills: { slug: string; name: string; description: string; category: string }[] = [];

      for (const file of files) {
        try {
          const manifest = await WslService.execCommand(`cat "${file}" 2>/dev/null`, 5000);
          const json = JSON.parse(manifest);
          const slug = file.split('/skills/')[1]?.split('/')[0] || 'unknown';
          skills.push({
            slug,
            name: json.name || slug,
            description: json.description || '',
            category: json.category || 'general',
          });
        } catch {}
      }
      return skills;
    } catch {
      return [];
    }
  }

  recordUsage(skill: string, success: boolean, executionTimeMs?: number) {
    const existing = dbService.getDb().prepare(`SELECT * FROM skill_stats WHERE skill = ?`).get(skill);

    if (existing) {
      const current = existing as DbSkillStat;
      const newUseCount = current.use_count + 1;
      const newSuccessCount = current.success_count + (success ? 1 : 0);

      let newAvgTime = current.avg_execution_time_ms;
      if (executionTimeMs !== undefined) {
        if (newAvgTime) {
          newAvgTime = Math.round((newAvgTime + executionTimeMs) / 2);
        } else {
          newAvgTime = executionTimeMs;
        }
      }

      dbService.getDb().prepare(
        `UPDATE skill_stats SET use_count = ?, success_count = ?, avg_execution_time_ms = ?, last_used = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE skill = ?`
      ).run(newUseCount, newSuccessCount, newAvgTime, skill);
    } else {
      dbService.getDb().prepare(
        `INSERT INTO skill_stats (skill, use_count, success_count, avg_execution_time_ms, last_used) VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)`
      ).run(skill, success ? 1 : 0, executionTimeMs || null);
    }
  }

  updateRating(skill: string, rating: number) {
    dbService.getDb().prepare(
      `UPDATE skill_stats SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE skill = ?`
    ).run(rating, skill);
  }

  getRecommendations(count = 5): SkillStat[] {
    const rows = dbService.getDb().prepare(
      `SELECT * FROM skill_stats ORDER BY rating DESC, use_count DESC LIMIT ?`
    ).all(count) as DbSkillStat[];
    return rows.map(r => ({
      id: r.id, skill: r.skill, useCount: r.use_count, successCount: r.success_count,
      avgExecutionTimeMs: r.avg_execution_time_ms, lastUsed: r.last_used,
      rating: r.rating, successRate: r.use_count > 0 ? (r.success_count / r.use_count) * 100 : 0,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  getUnpopularSkills(limit = 10): SkillStat[] {
    const rows = dbService.getDb().prepare(
      `SELECT * FROM skill_stats WHERE use_count = 0 OR last_used IS NULL ORDER BY use_count ASC LIMIT ?`
    ).all(limit) as DbSkillStat[];
    return rows.map(r => ({
      id: r.id, skill: r.skill, useCount: r.use_count, successCount: r.success_count,
      avgExecutionTimeMs: r.avg_execution_time_ms, lastUsed: r.last_used,
      rating: r.rating, successRate: r.use_count > 0 ? (r.success_count / r.use_count) * 100 : 0,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  async analyzeSkillPerformance(skillSlug: string): Promise<{ score: number; strengths: string[]; weaknesses: string[]; suggestions: string[] }> {
    const stat = dbService.getDb().prepare(`SELECT * FROM skill_stats WHERE skill = ?`).get(skillSlug) as DbSkillStat | undefined;

    const score = stat ? Math.min(100, Math.round((stat.rating * 25) + (stat.use_count / 10) + (stat.success_count / stat.use_count * 50))) : 50;

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];

    if (stat) {
      if (stat.rating >= 4) strengths.push('用户评分高');
      if (stat.use_count > 10) strengths.push('使用频率高');
      if (stat.success_count / stat.use_count > 0.9) strengths.push('成功率高');

      if (stat.rating < 3) weaknesses.push('用户评分偏低');
      if (stat.use_count < 5) weaknesses.push('使用频率低');
      if (stat.avg_execution_time_ms && stat.avg_execution_time_ms > 5000) weaknesses.push('执行时间较长');

      if (stat.use_count < 5) suggestions.push('建议增加使用场景');
      if (stat.rating < 3) suggestions.push('建议优化技能实现');
      if (stat.avg_execution_time_ms && stat.avg_execution_time_ms > 3000) suggestions.push('考虑优化执行效率');
    } else {
      suggestions.push('该技能尚未被使用过');
    }

    return { score, strengths, weaknesses, suggestions };
  }

  async executeSkill(skillSlug: string, params?: string): Promise<{ success: boolean; output: string; executionTimeMs: number }> {
    const startTime = Date.now();
    try {
      let output: string;
      if (params) {
        output = await WslService.execCommand(`openclaw skill run ${skillSlug} ${params} 2>&1`, 30000);
      } else {
        output = await WslService.execCommand(`openclaw skill run ${skillSlug} 2>&1`, 30000);
      }
      const executionTime = Date.now() - startTime;
      const success = !output.includes('error') && !output.includes('Error') && !output.includes('failed');
      this.recordUsage(skillSlug, success, executionTime);
      return { success, output, executionTimeMs: executionTime };
    } catch (err: any) {
      const executionTime = Date.now() - startTime;
      this.recordUsage(skillSlug, false, executionTime);
      return { success: false, output: err.message, executionTimeMs: executionTime };
    }
  }
}

export const skillEvaluationService = new SkillEvaluationService();