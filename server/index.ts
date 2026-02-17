import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  getAllSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  getAllModelConfigs,
  getModelConfig,
  getDefaultModelConfig,
  createModelConfig,
  updateModelConfig,
  setDefaultModelConfig,
  deleteModelConfig,
} from './database.js';
import { ChatSession, ModelConfig } from '../src/types/index.js';

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 获取所有会话
app.get('/api/sessions', (req: Request, res: Response) => {
  try {
    const sessions = getAllSessions();
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// 获取单个会话
app.get('/api/sessions/:id', (req: Request, res: Response) => {
  try {
    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// 创建会话
app.post('/api/sessions', (req: Request, res: Response) => {
  try {
    const session: ChatSession = req.body;
    createSession(session);
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// 更新会话
app.put('/api/sessions/:id', (req: Request, res: Response) => {
  try {
    const session: ChatSession = req.body;
    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (session.id !== sessionId) {
      res.status(400).json({ error: 'Session ID mismatch' });
      return;
    }
    updateSession(session);
    res.json(session);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// 删除会话
app.delete('/api/sessions/:id', (req: Request, res: Response) => {
  try {
    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    deleteSession(sessionId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ========== 模型配置相关路由 ==========

// 获取所有模型配置
app.get('/api/model-configs', (req: Request, res: Response) => {
  try {
    const configs = getAllModelConfigs();
    res.json(configs);
  } catch (error) {
    console.error('Error getting model configs:', error);
    res.status(500).json({ error: 'Failed to get model configs' });
  }
});

// 获取默认模型配置
app.get('/api/model-configs/default', (req: Request, res: Response) => {
  try {
    const config = getDefaultModelConfig();
    if (!config) {
      res.status(404).json({ error: 'No default model config found' });
      return;
    }
    res.json(config);
  } catch (error) {
    console.error('Error getting default model config:', error);
    res.status(500).json({ error: 'Failed to get default model config' });
  }
});

// 获取单个模型配置
app.get('/api/model-configs/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const config = getModelConfig(id);
    if (!config) {
      res.status(404).json({ error: 'Model config not found' });
      return;
    }
    res.json(config);
  } catch (error) {
    console.error('Error getting model config:', error);
    res.status(500).json({ error: 'Failed to get model config' });
  }
});

// 创建模型配置
app.post('/api/model-configs', (req: Request, res: Response) => {
  try {
    const config: ModelConfig = req.body;
    createModelConfig(config);
    res.status(201).json(config);
  } catch (error) {
    console.error('Error creating model config:', error);
    res.status(500).json({ error: 'Failed to create model config' });
  }
});

// 更新模型配置
app.put('/api/model-configs/:id', (req: Request, res: Response) => {
  try {
    const config: ModelConfig = req.body;
    updateModelConfig(config);
    res.json(config);
  } catch (error) {
    console.error('Error updating model config:', error);
    res.status(500).json({ error: 'Failed to update model config' });
  }
});

// 设置默认模型
app.put('/api/model-configs/:id/set-default', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    setDefaultModelConfig(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting default model config:', error);
    res.status(500).json({ error: 'Failed to set default model config' });
  }
});

// 删除模型配置
app.delete('/api/model-configs/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    deleteModelConfig(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting model config:', error);
    res.status(500).json({ error: 'Failed to delete model config' });
  }
});

// 健康检查
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
