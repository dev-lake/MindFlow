import { create } from 'zustand';
import { ModelConfig } from '../types';
import { modelConfigAPI } from '../services/api';

interface SettingsStore {
  modelConfigs: ModelConfig[];
  defaultModelConfig: ModelConfig | null;
  isSettingsOpen: boolean;
  isLoading: boolean;

  // 加载所有模型配置
  loadModelConfigs: () => Promise<void>;

  // 创建模型配置
  createModelConfig: (config: ModelConfig) => Promise<void>;

  // 更新模型配置
  updateModelConfig: (config: ModelConfig) => Promise<void>;

  // 删除模型配置
  deleteModelConfig: (id: string) => Promise<void>;

  // 设置默认模型
  setDefaultModel: (id: string) => Promise<void>;

  // UI 状态
  openSettings: () => void;
  closeSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  modelConfigs: [],
  defaultModelConfig: null,
  isSettingsOpen: false,
  isLoading: false,

  loadModelConfigs: async () => {
    try {
      console.log('[settingsStore] Starting loadModelConfigs...');
      set({ isLoading: true });
      const configs = await modelConfigAPI.getAllModelConfigs();
      console.log('[settingsStore] Fetched configs:', configs);
      const defaultConfig = await modelConfigAPI.getDefaultModelConfig();
      console.log('[settingsStore] Fetched defaultConfig:', defaultConfig);
      set({
        modelConfigs: configs,
        defaultModelConfig: defaultConfig,
        isLoading: false
      });
      console.log('[settingsStore] State updated. Current defaultModelConfig:', defaultConfig);
    } catch (error) {
      console.error('[settingsStore] Failed to load model configs:', error);
      set({ isLoading: false });
    }
  },

  createModelConfig: async (config) => {
    try {
      await modelConfigAPI.createModelConfig(config);
      await get().loadModelConfigs();
    } catch (error) {
      console.error('Failed to create model config:', error);
    }
  },

  updateModelConfig: async (config) => {
    try {
      await modelConfigAPI.updateModelConfig(config);
      await get().loadModelConfigs();
    } catch (error) {
      console.error('Failed to update model config:', error);
    }
  },

  deleteModelConfig: async (id) => {
    try {
      await modelConfigAPI.deleteModelConfig(id);
      await get().loadModelConfigs();
    } catch (error) {
      console.error('Failed to delete model config:', error);
    }
  },

  setDefaultModel: async (id) => {
    try {
      await modelConfigAPI.setDefaultModelConfig(id);
      await get().loadModelConfigs();
    } catch (error) {
      console.error('Failed to set default model:', error);
    }
  },

  openSettings: () => {
    console.log('openSettings called');
    set({ isSettingsOpen: true });
  },

  closeSettings: () => set({ isSettingsOpen: false }),
}));
