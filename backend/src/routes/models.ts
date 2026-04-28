import { Router } from 'express';
import { ModelService } from '../services/modelService.js';

const router = Router();

router.get('/providers', async (_req, res) => {
  try {
    const providers = await ModelService.getProviders();
    res.json(providers);
  } catch (error: any) {
    console.error('Failed to get model providers:', error);
    res.status(500).json({ error: 'Failed to get model providers', message: error.message });
  }
});

router.get('/aliases', async (_req, res) => {
  try {
    const aliases = await ModelService.getAliases();
    res.json(aliases);
  } catch (error: any) {
    console.error('Failed to get model aliases:', error);
    res.status(500).json({ error: 'Failed to get model aliases', message: error.message });
  }
});

router.get('/agent-models', async (_req, res) => {
  try {
    const agentModels = await ModelService.getAgentModels();
    res.json(agentModels);
  } catch (error: any) {
    console.error('Failed to get agent models:', error);
    res.status(500).json({ error: 'Failed to get agent models', message: error.message });
  }
});

router.post('/detect', async (req, res) => {
  try {
    const { baseUrl, apiKey } = req.body;
    if (!baseUrl || !apiKey) {
      res.status(400).json({ error: 'baseUrl and apiKey are required' });
      return;
    }
    const result = await ModelService.detectProvider(baseUrl, apiKey);
    res.json(result);
  } catch (error: any) {
    console.error('Failed to detect provider:', error);
    res.status(500).json({ error: 'Failed to detect provider', message: error.message });
  }
});

router.post('/providers', async (req, res) => {
  try {
    const { name, baseUrl, apiKey } = req.body;
    if (!baseUrl || !apiKey) {
      res.status(400).json({ error: 'baseUrl and apiKey are required' });
      return;
    }
    const provider = await ModelService.addProvider(name || 'custom', baseUrl, apiKey);
    res.json(provider);
  } catch (error: any) {
    console.error('Failed to add provider:', error);
    res.status(500).json({ error: 'Failed to add provider', message: error.message });
  }
});

router.delete('/providers/:name', async (req, res) => {
  try {
    const result = await ModelService.removeProvider(req.params.name);
    res.json(result);
  } catch (error: any) {
    console.error('Failed to remove provider:', error);
    res.status(500).json({ error: 'Failed to remove provider', message: error.message });
  }
});

router.post('/providers/:name/refresh', async (req, res) => {
  try {
    const result = await ModelService.refreshProviderModels(req.params.name);
    res.json(result);
  } catch (error: any) {
    console.error('Failed to refresh provider models:', error);
    res.status(500).json({ error: 'Failed to refresh provider models', message: error.message });
  }
});

router.post('/set-agent-model', async (req, res) => {
  try {
    const { agentId, modelId } = req.body;
    if (!agentId || !modelId) {
      res.status(400).json({ error: 'agentId and modelId are required' });
      return;
    }
    const result = await ModelService.setAgentModel(agentId, modelId);
    res.json(result);
  } catch (error: any) {
    console.error('Failed to set agent model:', error);
    res.status(500).json({ error: 'Failed to set agent model', message: error.message });
  }
});

export default router;
