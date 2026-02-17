import axios from 'axios';
import { ChatSession, ModelConfig } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ========== 会话相关 ==========

export const sessionAPI = {
  // 获取所有会话
  getAllSessions: async (): Promise<ChatSession[]> => {
    const response = await api.get('/sessions');
    return response.data;
  },

  // 获取单个会话
  getSession: async (id: string): Promise<ChatSession> => {
    const response = await api.get(`/sessions/${id}`);
    return response.data;
  },

  // 创建会话
  createSession: async (session: ChatSession): Promise<ChatSession> => {
    const response = await api.post('/sessions', session);
    return response.data;
  },

  // 更新会话
  updateSession: async (session: ChatSession): Promise<ChatSession> => {
    const response = await api.put(`/sessions/${session.id}`, session);
    return response.data;
  },

  // 删除会话
  deleteSession: async (id: string): Promise<void> => {
    await api.delete(`/sessions/${id}`);
  },
};

// ========== 模型配置相关 ==========

export const modelConfigAPI = {
  // 获取所有模型配置
  getAllModelConfigs: async (): Promise<ModelConfig[]> => {
    const response = await api.get('/model-configs');
    return response.data;
  },

  // 获取默认模型配置
  getDefaultModelConfig: async (): Promise<ModelConfig | null> => {
    try {
      console.log('[API] Fetching default model config...');
      const response = await api.get('/model-configs/default');
      console.log('[API] Default model config response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] Failed to fetch default model config:', error);
      return null;
    }
  },

  // 获取单个模型配置
  getModelConfig: async (id: string): Promise<ModelConfig> => {
    const response = await api.get(`/model-configs/${id}`);
    return response.data;
  },

  // 创建模型配置
  createModelConfig: async (config: ModelConfig): Promise<ModelConfig> => {
    const response = await api.post('/model-configs', config);
    return response.data;
  },

  // 更新模型配置
  updateModelConfig: async (config: ModelConfig): Promise<ModelConfig> => {
    const response = await api.put(`/model-configs/${config.id}`, config);
    return response.data;
  },

  // 设置默认模型
  setDefaultModelConfig: async (id: string): Promise<void> => {
    await api.put(`/model-configs/${id}/set-default`);
  },

  // 删除模型配置
  deleteModelConfig: async (id: string): Promise<void> => {
    await api.delete(`/model-configs/${id}`);
  },
};
