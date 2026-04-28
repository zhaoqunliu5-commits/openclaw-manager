import { WslService } from './wslService.js';
import { appConfig } from '../config.js';
import { DataCache } from './dataCache.js';
import { getErrorMessage } from '../middleware/errorHandler.js';
import type { SkillDetail } from '../types/index.js';

const OPENCLAW_PATH = appConfig.openclawPath;
const SKILLS_DIR = `${OPENCLAW_PATH}/skills`;

const CN_TO_EN: Record<string, string> = {
  '搜索': 'search', '代码审查': 'code review', '代码': 'code', '编程': 'programming',
  '开发': 'development', '写作': 'writing', '创作': 'creative', '图像': 'image generation',
  '图片': 'image', '自动化': 'automation', '监控': 'monitor', '安全': 'security',
  '翻译': 'translation', '对话': 'chat', '聊天': 'chat', '分析': 'analysis',
  '数据': 'data', '文档': 'document', '测试': 'testing', '部署': 'deploy',
  '运维': 'devops', '爬虫': 'crawler spider', '总结': 'summarize', '邮件': 'email',
  '通知': 'notification', '音乐': 'music', '视频': 'video', '语音': 'voice audio',
  '数学': 'math', '教育': 'education', '游戏': 'game', '工具': 'tool utility',
  '助手': 'assistant agent', '前端': 'frontend web', '后端': 'backend server',
  '数据库': 'database',
};

function translateChineseQuery(query: string): string {
  let translated = query;
  const sortedKeys = Object.keys(CN_TO_EN).sort((a, b) => b.length - a.length);
  for (const cn of sortedKeys) {
    if (translated.includes(cn)) {
      translated = translated.replace(new RegExp(cn, 'g'), CN_TO_EN[cn]);
    }
  }
  const hasChinese = /[\u4e00-\u9fff]/.test(translated);
  if (hasChinese) {
    translated = translated.replace(/[\u4e00-\u9fff]+/g, '').trim();
    if (!translated) translated = query;
  }
  return translated || query;
}

async function runPythonScript(script: string, timeout: number = 15000): Promise<string> {
  const tmpFile = `/tmp/oc_skill_${Date.now()}.py`;
  const b64 = Buffer.from(script).toString('base64');
  try {
    await WslService.execCommand(`printf '%s' '${b64}' | base64 -d > ${tmpFile}`, 5000);
    const output = await WslService.execCommand(`python3 ${tmpFile}`, timeout);
    return output;
  } finally {
    await WslService.execCommand(`rm -f ${tmpFile}`, 3000);
  }
}

export class SkillEnhanceService {
  static async getInstalledSkills(): Promise<SkillDetail[]> {
    return DataCache.getOrFetch('skill-enhance-installed', async () => {
      const script = `
import json, os, re

skills_dir = "${SKILLS_DIR}"
config_path = "${OPENCLAW_PATH}/openclaw.json"

if not os.path.isdir(skills_dir):
    print(json.dumps([]))
    exit()

agent_skills = {}
try:
    with open(config_path) as f:
        config = json.load(f)
    for agent in config.get("agents", {}).get("list", []):
        aid = agent.get("id", "")
        sk = agent.get("skills", "")
        if sk:
            for s in sk.split(","):
                s = s.strip()
                if s:
                    agent_skills.setdefault(s, []).append(aid)
except:
    pass

result = []
for slug in sorted(os.listdir(skills_dir)):
    skill_path = os.path.join(skills_dir, slug)
    if not os.path.isdir(skill_path):
        continue

    skill = {
        "slug": slug,
        "name": slug,
        "description": "",
        "version": "",
        "status": "installed",
        "emoji": "",
        "source": "local",
        "homepage": "",
        "configPaths": [],
        "requires": {},
        "os": [],
        "files": [],
        "dependencies": [],
        "agentAssignments": agent_skills.get(slug, [])
    }

    meta_path = os.path.join(skill_path, "_meta.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path) as f:
                meta = json.load(f)
            skill["version"] = meta.get("version", "")
            skill["source"] = "clawhub" if meta.get("ownerId") else "local"
            if meta.get("publishedAt"):
                skill["source"] = "clawhub"
        except:
            pass

    skill_md = os.path.join(skill_path, "SKILL.md")
    if os.path.exists(skill_md):
        try:
            with open(skill_md) as f:
                content = f.read(4096)
            frontmatter = {}
            in_fm = False
            fm_lines = []
            for line in content.split("\\n"):
                if line.strip() == "---":
                    if in_fm:
                        break
                    in_fm = True
                    continue
                if in_fm:
                    fm_lines.append(line)
            for line in fm_lines:
                if ":" in line:
                    k, v = line.split(":", 1)
                    frontmatter[k.strip()] = v.strip().strip('"').strip("'")

            skill["name"] = frontmatter.get("name", slug)
            skill["description"] = frontmatter.get("description", "")
            skill["homepage"] = frontmatter.get("homepage", "")

            metadata_str = frontmatter.get("metadata", "{}")
            try:
                metadata = json.loads(metadata_str)
                clawdbot = metadata.get("clawdbot", {})
                skill["emoji"] = clawdbot.get("emoji", "")
                skill["configPaths"] = clawdbot.get("configPaths", [])
                skill["requires"] = clawdbot.get("requires", {})
                skill["os"] = clawdbot.get("os", [])
            except:
                pass
        except:
            pass

    files = []
    try:
        for fn in os.listdir(skill_path):
            if not fn.startswith(".") and os.path.isfile(os.path.join(skill_path, fn)):
                files.append(fn)
        skill["files"] = sorted(files)
    except:
        pass

    result.append(skill)

print(json.dumps(result, ensure_ascii=False))
`;
    try {
      const output = await runPythonScript(script, 20000);
      return JSON.parse(output.trim());
    } catch {
      return [];
    }
    }, 120000);
  }

  static async getSkillDetail(slug: string): Promise<SkillDetail | null> {
    const script = `
import json, os

slug = "${slug}"
skill_path = "${SKILLS_DIR}/" + slug
config_path = "${OPENCLAW_PATH}/openclaw.json"

if not os.path.isdir(skill_path):
    print(json.dumps(None))
    exit()

agent_skills = {}
try:
    with open(config_path) as f:
        config = json.load(f)
    for agent in config.get("agents", {}).get("list", []):
        aid = agent.get("id", "")
        sk = agent.get("skills", "")
        if sk:
            for s in sk.split(","):
                s = s.strip()
                if s:
                    agent_skills.setdefault(s, []).append(aid)
except:
    pass

skill = {
    "slug": slug,
    "name": slug,
    "description": "",
    "version": "",
    "status": "installed",
    "emoji": "",
    "source": "local",
    "homepage": "",
    "configPaths": [],
    "requires": {},
    "os": [],
    "files": [],
    "dependencies": [],
    "agentAssignments": agent_skills.get(slug, [])
}

meta_path = os.path.join(skill_path, "_meta.json")
if os.path.exists(meta_path):
    try:
        with open(meta_path) as f:
            meta = json.load(f)
        skill["version"] = meta.get("version", "")
        skill["source"] = "clawhub" if meta.get("ownerId") else "local"
    except:
        pass

skill_md = os.path.join(skill_path, "SKILL.md")
if os.path.exists(skill_md):
    try:
        with open(skill_md) as f:
            content = f.read()
        frontmatter = {}
        in_fm = False
        fm_lines = []
        for line in content.split("\\n"):
            if line.strip() == "---":
                if in_fm:
                    break
                in_fm = True
                continue
            if in_fm:
                fm_lines.append(line)
        for line in fm_lines:
            if ":" in line:
                k, v = line.split(":", 1)
                frontmatter[k.strip()] = v.strip().strip('"').strip("'")

        skill["name"] = frontmatter.get("name", slug)
        skill["description"] = frontmatter.get("description", "")
        skill["homepage"] = frontmatter.get("homepage", "")

        metadata_str = frontmatter.get("metadata", "{}")
        try:
            metadata = json.loads(metadata_str)
            clawdbot = metadata.get("clawdbot", {})
            skill["emoji"] = clawdbot.get("emoji", "")
            skill["configPaths"] = clawdbot.get("configPaths", [])
            skill["requires"] = clawdbot.get("requires", {})
            skill["os"] = clawdbot.get("os", [])
            deps = clawdbot.get("requires", {}).get("skills", [])
            if isinstance(deps, list):
                skill["dependencies"] = deps
            elif isinstance(deps, str):
                skill["dependencies"] = [s.strip() for s in deps.split(",") if s.strip()]
        except:
            pass
    except:
        pass

files = []
try:
    for fn in os.listdir(skill_path):
        if not fn.startswith(".") and os.path.isfile(os.path.join(skill_path, fn)):
            files.append(fn)
    skill["files"] = sorted(files)
except:
    pass

print(json.dumps(skill, ensure_ascii=False))
`;
    try {
      const output = await runPythonScript(script);
      const parsed = JSON.parse(output.trim());
      return parsed;
    } catch {
      return null;
    }
  }

  static async getSkillFile(slug: string, filename: string): Promise<string> {
    try {
      const safeSlug = slug.replace(/[^a-zA-Z0-9_\-]/g, '');
      const safeFile = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
      const output = await WslService.execCommand(`cat "${SKILLS_DIR}/${safeSlug}/${safeFile}" 2>/dev/null`, 10000);
      return output;
    } catch {
      return '';
    }
  }

  static async updateSkillConfig(slug: string, filename: string, content: string): Promise<{ success: boolean; message: string }> {
    const safeSlug = slug.replace(/[^a-zA-Z0-9_\-]/g, '');
    const safeFile = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const contentB64 = Buffer.from(content).toString('base64');
    const script = `
import os, base64

slug = "${safeSlug}"
filename = "${safeFile}"
skill_path = "${SKILLS_DIR}/" + slug
filepath = os.path.join(skill_path, filename)

if not os.path.isdir(skill_path):
    print('{"success": false, "message": "Skill not found"}')
    exit()

try:
    content = base64.b64decode("${contentB64}").decode("utf-8")
    with open(filepath, "w") as f:
        f.write(content)
    print('{"success": true, "message": "File updated"}')
except Exception as e:
    print('{"success": false, "message": "' + str(e) + '"}')
`;
    try {
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return { success: false, message: 'Failed to update file' };
    }
  }

  static async getSkillDependencies(): Promise<Record<string, string[]>> {
    const script = `
import json, os

skills_dir = "${SKILLS_DIR}"
if not os.path.isdir(skills_dir):
    print(json.dumps({}))
    exit()

deps_map = {}
for slug in sorted(os.listdir(skills_dir)):
    skill_path = os.path.join(skills_dir, slug)
    if not os.path.isdir(skill_path):
        continue

    skill_md = os.path.join(skill_path, "SKILL.md")
    if not os.path.exists(skill_md):
        continue

    try:
        with open(skill_md) as f:
            content = f.read(4096)
        frontmatter = {}
        in_fm = False
        fm_lines = []
        for line in content.split("\\n"):
            if line.strip() == "---":
                if in_fm:
                    break
                in_fm = True
                continue
            if in_fm:
                fm_lines.append(line)
        for line in fm_lines:
            if ":" in line:
                k, v = line.split(":", 1)
                frontmatter[k.strip()] = v.strip().strip('"').strip("'")

        metadata_str = frontmatter.get("metadata", "{}")
        try:
            metadata = json.loads(metadata_str)
            clawdbot = metadata.get("clawdbot", {})
            req_skills = clawdbot.get("requires", {}).get("skills", [])
            if isinstance(req_skills, list) and req_skills:
                deps_map[slug] = req_skills
            elif isinstance(req_skills, str) and req_skills:
                deps_map[slug] = [s.strip() for s in req_skills.split(",") if s.strip()]
        except:
            pass
    except:
        pass

print(json.dumps(deps_map, ensure_ascii=False))
`;
    try {
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return {};
    }
  }

  static async searchClawhub(query: string): Promise<any[]> {
    const safeQuery = query.replace(/"/g, '').replace(/[`;$|]/g, '');
    const translatedQuery = translateChineseQuery(safeQuery);

    try {
      const output = await WslService.execCommand(`openclaw skills search "${safeQuery}" --json 2>/dev/null || openclaw skills search "${safeQuery}" 2>/dev/null`, 30000);
      try {
        const parsed = JSON.parse(output.trim());
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { }
    } catch { }

    try {
      const encodedQuery = encodeURIComponent(`openclaw skill ${translatedQuery}`);
      const url = `https://api.github.com/search/repositories?q=${encodedQuery}&sort=stars&order=desc&per_page=10`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'OpenClaw-Manager' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return [];
      const data = await response.json() as { items?: any[] };
      if (!data.items || data.items.length === 0) return [];

      return data.items.map((repo: any) => ({
        slug: repo.name,
        name: repo.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        description: repo.description || '',
        emoji: '📦',
        source: 'github',
        homepage: repo.html_url,
        stars: repo.stargazers_count || 0,
        owner: repo.owner?.login || '',
      }));
    } catch {
      return [];
    }
  }

  static async installSkill(slug: string): Promise<{ success: boolean; message: string }> {
    try {
      const safeSlug = slug.replace(/"/g, '');
      const output = await WslService.execCommand(`openclaw skills install "${safeSlug}" 2>&1`, 60000);
      return { success: true, message: output.substring(0, 500) };
    } catch (error: unknown) {
      return { success: false, message: getErrorMessage(error) || 'Install failed' };
    }
  }

  static async uninstallSkill(slug: string): Promise<{ success: boolean; message: string }> {
    const safeSlug = slug.replace(/[^a-zA-Z0-9_\-]/g, '');
    const script = `
import os, shutil, json

slug = "${safeSlug}"
skill_path = "${SKILLS_DIR}/" + slug

if not os.path.isdir(skill_path):
    print(json.dumps({"success": False, "message": "Skill not found"}))
    exit()

shutil.rmtree(skill_path)
print(json.dumps({"success": True, "message": "Skill " + slug + " uninstalled"}))
`;
    try {
      const output = await runPythonScript(script);
      return JSON.parse(output.trim());
    } catch {
      return { success: false, message: 'Failed to uninstall skill' };
    }
  }
}
