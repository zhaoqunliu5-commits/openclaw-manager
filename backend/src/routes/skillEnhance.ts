import { getErrorMessage } from '../middleware/errorHandler.js';
import { Router } from 'express';
import { SkillEnhanceService } from '../services/skillEnhanceService.js';

const router = Router();

router.get('/installed', async (_req, res) => {
  try {
    const skills = await SkillEnhanceService.getInstalledSkills();
    res.json(skills);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get installed skills', message: getErrorMessage(error) });
  }
});

router.get('/detail/:slug', async (req, res) => {
  try {
    const skill = await SkillEnhanceService.getSkillDetail(req.params.slug);
    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }
    res.json(skill);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get skill detail', message: getErrorMessage(error) });
  }
});

router.get('/file/:slug/:filename', async (req, res) => {
  try {
    const content = await SkillEnhanceService.getSkillFile(req.params.slug, req.params.filename);
    res.json({ content });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get skill file', message: getErrorMessage(error) });
  }
});

router.put('/file/:slug/:filename', async (req, res) => {
  try {
    const { content } = req.body;
    if (content === undefined) {
      res.status(400).json({ error: 'content is required' });
      return;
    }
    const result = await SkillEnhanceService.updateSkillConfig(req.params.slug, req.params.filename, content);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to update skill file', message: getErrorMessage(error) });
  }
});

router.get('/dependencies', async (_req, res) => {
  try {
    const deps = await SkillEnhanceService.getSkillDependencies();
    res.json(deps);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to get dependencies', message: getErrorMessage(error) });
  }
});

router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.json([]);
      return;
    }
    const results = await SkillEnhanceService.searchClawhub(query);
    res.json(results);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to search skills', message: getErrorMessage(error) });
  }
});

router.post('/install', async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) {
      res.status(400).json({ error: 'slug is required' });
      return;
    }
    const result = await SkillEnhanceService.installSkill(slug);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to install skill', message: getErrorMessage(error) });
  }
});

router.delete('/uninstall/:slug', async (req, res) => {
  try {
    const result = await SkillEnhanceService.uninstallSkill(req.params.slug);
    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to uninstall skill', message: getErrorMessage(error) });
  }
});

export default router;
