import { WslService } from './wslService.js';
import { DataCache } from './dataCache.js';
import { appConfig } from '../config.js';

const OPENCLAW_PATH = appConfig.openclawPath;

interface GitHubSkill {
  name: string;
  slug: string;
  description: string;
  repo: string;
  url: string;
  stars: number;
  category: string;
  reason: string;
  installCommand: string;
}

interface UserContext {
  agents: { id: string; model: string; identity: string }[];
  skills: string[];
  plugins: string[];
  channels: string[];
  providers: string[];
}

interface GitHubSearchResult {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
}

const SEARCH_QUERIES: Record<string, { query: string; reason: string; category: string }> = {
  search: { query: 'openclaw+skill+search', reason: '未检测到搜索类插件，推荐增强信息检索能力', category: 'search' },
  development: { query: 'openclaw+skill+code+review', reason: '检测到编程类 Agent，推荐增强代码审查能力', category: 'development' },
  creative: { query: 'openclaw+skill+creative+writing', reason: '检测到创作类 Agent，推荐增强内容生成能力', category: 'creative' },
  automation: { query: 'openclaw+skill+automation', reason: '推荐增强自动化和任务调度能力', category: 'automation' },
  image: { query: 'openclaw+skill+image+generation', reason: '推荐增强图像生成能力', category: 'creative' },
  monitor: { query: 'openclaw+skill+monitor', reason: '推荐增强服务监控和告警能力', category: 'operations' },
  security: { query: 'openclaw+skill+security', reason: '推荐增强安全审计能力', category: 'security' },
  general: { query: 'openclaw+skill', reason: 'GitHub 上的 OpenClaw 技能', category: 'general' },
};

let searchCache: { data: GitHubSkill[]; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

export class SkillRecommendationService {
  static async getUserContext(): Promise<UserContext> {
    return DataCache.getOrFetch('skill-rec-context', async () => {
    const agents: UserContext['agents'] = [];
    const skills: string[] = [];
    const plugins: string[] = [];
    const channels: string[] = [];
    const providers: string[] = [];

    try {
      const listOutput = await WslService.execCommand('openclaw agents list --json 2>/dev/null');
      const listData = JSON.parse(listOutput);
      if (Array.isArray(listData)) {
        for (const a of listData) {
          agents.push({ id: a.id, model: a.model || '', identity: a.identityName || a.name || '' });
        }
      }
    } catch { /* ignore */ }

    try {
      const skillDirs = await WslService.listDirectory(`${OPENCLAW_PATH}/skills`);
      for (const dir of skillDirs) {
        if (!dir.startsWith('.') && !dir.endsWith('.html')) {
          skills.push(dir);
        }
      }
    } catch { /* ignore */ }

    try {
      const configContent = await WslService.readFile(`${OPENCLAW_PATH}/openclaw.json`);
      const config = JSON.parse(configContent);

      if (config.plugins?.entries) {
        for (const [name, pluginConfig] of Object.entries(config.plugins.entries as Record<string, any>)) {
          if (pluginConfig.enabled) plugins.push(name);
        }
      }
      if (config.channels) {
        for (const [name, channelConfig] of Object.entries(config.channels as Record<string, any>)) {
          if (channelConfig.enabled) channels.push(name);
        }
      }
      if (config.models?.providers) {
        for (const name of Object.keys(config.models.providers as Record<string, any>)) {
          providers.push(name);
        }
      }
    } catch { /* ignore */ }

    return { agents, skills, plugins, channels, providers };
    }, 30000);
  }

  private static async searchGitHub(query: string): Promise<GitHubSearchResult[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=10`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'OpenClaw-Manager',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.items || []) as GitHubSearchResult[];
    } catch {
      return [];
    }
  }

  private static resultToSkill(item: GitHubSearchResult, reason: string, category: string): GitHubSkill {
    const slug = item.full_name.split('/')[1] || item.full_name;
    return {
      name: slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      slug,
      description: item.description || '暂无描述',
      repo: item.full_name,
      url: item.html_url,
      stars: item.stargazers_count,
      category,
      reason,
      installCommand: `openclaw skills install ${slug}`,
    };
  }

  static async getRecommendations(count: number = 6): Promise<GitHubSkill[]> {
    return DataCache.getOrFetch(`skill-rec-${count}`, async () => {
    try {
      const ctx = await Promise.race([
        this.getUserContext(),
        new Promise<UserContext>((resolve) =>
          setTimeout(() => resolve({ agents: [], skills: [], plugins: [], channels: [], providers: [] }), 15000)
        ),
      ]);

    const queryKeys: string[] = [];

    const hasSearchPlugin = ctx.plugins.includes('brave') || ctx.plugins.includes('tavily');
    const hasCreativeAgent = ctx.agents.some(a =>
      /剧本|漫剧|视频|小说|笔|创作|film|manga|video|novel|writer/i.test(a.identity)
    );
    const hasDevAgent = ctx.agents.some(a =>
      /code|编程|spider|dev|程序/i.test(a.identity)
    );
    const hasRunningHub = ctx.plugins.includes('runninghub');

    if (!hasSearchPlugin) queryKeys.push('search');
    if (hasDevAgent) queryKeys.push('development');
    if (hasCreativeAgent) queryKeys.push('creative');
    if (hasRunningHub) queryKeys.push('image');
    if (ctx.agents.length >= 3) queryKeys.push('automation');
    if (ctx.plugins.length >= 3) queryKeys.push('security');

    if (queryKeys.length === 0) queryKeys.push('general');

    const allResults: GitHubSkill[] = [];

    const searchPromises = queryKeys.map(async (key) => {
      const config = SEARCH_QUERIES[key];
      if (!config) return;
      const results = await this.searchGitHub(config.query);
      for (const item of results) {
        if (ctx.skills.some(s => item.full_name.includes(s))) continue;
        allResults.push(this.resultToSkill(item, config.reason, config.category));
      }
    });

    await Promise.all(searchPromises);

    if (allResults.length === 0) {
      return this.getLocalFallback(ctx, count);
    }

    const seen = new Set<string>();
    const unique = allResults.filter(s => {
      if (seen.has(s.repo)) return false;
      seen.add(s.repo);
      return true;
    });

    unique.sort((a, b) => b.stars - a.stars);

    return unique.slice(0, count);
    } catch {
      return this.getLocalFallback({ agents: [], skills: [], plugins: [], channels: [], providers: [] }, count);
    }
    }, 120000);
  }

  private static getLocalFallback(ctx: UserContext, count: number): GitHubSkill[] {
    const suggestions: GitHubSkill[] = [];

    const hasSearchPlugin = ctx.plugins.includes('brave') || ctx.plugins.includes('tavily');
    const hasCreativeAgent = ctx.agents.some(a =>
      /剧本|漫剧|视频|小说|笔|创作|film|manga|video|novel|writer/i.test(a.identity)
    );
    const hasDevAgent = ctx.agents.some(a =>
      /code|编程|spider|dev|程序/i.test(a.identity)
    );

    if (!hasSearchPlugin) {
      suggestions.push({
        name: 'Web Search 插件',
        slug: 'web-search',
        description: '安装 Brave 或 Tavily 搜索插件以增强信息检索能力',
        repo: 'openclaw/openclaw',
        url: 'https://github.com/openclaw/openclaw',
        stars: 0,
        category: 'search',
        reason: '未检测到搜索类插件，建议在配置中启用 Brave 或 Tavily',
        installCommand: 'openclaw plugins enable brave',
      });
    }

    if (hasDevAgent) {
      suggestions.push({
        name: 'Code Review Skill',
        slug: 'code-review',
        description: '在 GitHub 上搜索 OpenClaw 代码审查技能',
        repo: '',
        url: 'https://github.com/search?q=openclaw+skill+code+review&type=repositories',
        stars: 0,
        category: 'development',
        reason: '检测到编程类 Agent，推荐搜索代码审查相关技能',
        installCommand: 'openclaw skills search code-review',
      });
    }

    if (hasCreativeAgent) {
      suggestions.push({
        name: 'Creative Writing Skill',
        slug: 'creative-writing',
        description: '在 GitHub 上搜索 OpenClaw 创意写作技能',
        repo: '',
        url: 'https://github.com/search?q=openclaw+skill+creative+writing&type=repositories',
        stars: 0,
        category: 'creative',
        reason: '检测到创作类 Agent，推荐搜索创意写作相关技能',
        installCommand: 'openclaw skills search creative',
      });
    }

    suggestions.push({
      name: '浏览 GitHub OpenClaw 生态',
      slug: 'browse-github',
      description: '在 GitHub 上探索更多 OpenClaw 技能和插件',
      repo: '',
      url: 'https://github.com/search?q=openclaw+skill&type=repositories',
      stars: 0,
      category: 'general',
      reason: 'GitHub API 暂时不可用，请直接访问 GitHub 搜索',
      installCommand: 'openclaw skills search',
    });

    return suggestions.slice(0, count);
  }

  static async getTrending(): Promise<GitHubSkill[]> {
    if (searchCache && Date.now() - searchCache.timestamp < CACHE_TTL) {
      return searchCache.data;
    }

    const results = await this.searchGitHub('openclaw+skill');
    if (results.length === 0) {
      return [{
        name: '浏览 GitHub OpenClaw 生态',
        slug: 'browse-github',
        description: '在 GitHub 上探索 OpenClaw 技能和插件',
        repo: '',
        url: 'https://github.com/search?q=openclaw+skill&type=repositories',
        stars: 0,
        category: 'general',
        reason: 'GitHub API 暂时不可用，请直接访问 GitHub 搜索',
        installCommand: 'openclaw skills search',
      }];
    }
    const skills = results.map(item =>
      this.resultToSkill(item, `热门技能 · ⭐ ${item.stargazers_count}`, 'trending')
    );

    searchCache = { data: skills, timestamp: Date.now() };
    return skills;
  }
}
