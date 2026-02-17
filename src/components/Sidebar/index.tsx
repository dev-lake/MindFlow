import { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, Star, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { ModelConfig } from '../../types';

export function Sidebar() {
  const { modelConfigs, createModelConfig, updateModelConfig, deleteModelConfig, setDefaultModel, closeSettings } = useSettingsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [formData, setFormData] = useState<Partial<ModelConfig>>({
    name: '',
    provider: 'openai',
    apiProtocol: 'openai',
    model: '',
    apiKey: '',
    baseURL: '',
    temperature: 0.7,
    maxTokens: 2000,
  });

  const handleStartEdit = (config: ModelConfig) => {
    setEditingId(config.id);
    setFormData(config);
    setIsDialogOpen(true);
    setShowApiKey(false);
    setTestResult(null);
    setAvailableModels([]);
  };

  const handleStartAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      provider: 'openai',
      apiProtocol: 'openai',
      model: '',
      apiKey: '',
      baseURL: '',
      temperature: 0.7,
      maxTokens: 2000,
    });
    setIsDialogOpen(true);
    setShowApiKey(false);
    setTestResult(null);
    setAvailableModels([]);
  };

  // 测试 API 连接
  const handleTestAPI = async () => {
    if (!formData.apiKey && formData.provider !== 'local' && formData.provider !== 'custom') {
      setTestResult({ success: false, message: '请先输入 API Key' });
      return;
    }

    if ((formData.provider === 'custom' || formData.provider === 'local') && !formData.baseURL) {
      setTestResult({ success: false, message: '请先输入 API 地址' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const testConfig: ModelConfig = {
        id: 'test',
        name: 'Test',
        provider: formData.provider as ModelConfig['provider'],
        apiProtocol: formData.apiProtocol,
        model: formData.model || 'gpt-3.5-turbo',
        apiKey: formData.apiKey,
        baseURL: formData.baseURL,
        temperature: 0.7,
        maxTokens: 100,
        createdAt: Date.now(),
      };

      const { sendAIMessage } = await import('../../services/ai');
      const testMessage = [{ role: 'user' as const, content: 'Hi' }];

      await sendAIMessage(testMessage, testConfig);
      setTestResult({ success: true, message: 'API 连接成功！' });
    } catch (error) {
      setTestResult({
        success: false,
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 获取可用模型列表
  const handleFetchModels = async () => {
    if (!formData.apiKey && formData.provider !== 'local') {
      alert('请先输入 API Key');
      return;
    }

    setIsLoadingModels(true);
    setAvailableModels([]);

    try {
      let url = '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (formData.provider === 'openai') {
        url = 'https://api.openai.com/v1/models';
        headers['Authorization'] = `Bearer ${formData.apiKey}`;
      } else if (formData.provider === 'anthropic') {
        // Anthropic 不提供模型列表 API，使用预定义列表
        setAvailableModels([
          'claude-opus-4-6',
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
        ]);
        setIsLoadingModels(false);
        return;
      } else if (formData.provider === 'deepseek') {
        // DeepSeek 使用预定义列表
        setAvailableModels([
          'deepseek-chat',
          'deepseek-coder',
        ]);
        setIsLoadingModels(false);
        return;
      } else if (formData.provider === 'local') {
        url = `${formData.baseURL || 'http://localhost:11434'}/api/tags`;
      } else if (formData.provider === 'custom') {
        if (formData.apiProtocol === 'openai') {
          url = `${formData.baseURL}/v1/models`;
          if (formData.apiKey) {
            headers['Authorization'] = `Bearer ${formData.apiKey}`;
          }
        } else if (formData.apiProtocol === 'ollama') {
          url = `${formData.baseURL}/api/tags`;
        } else {
          alert('该协议暂不支持自动获取模型列表');
          setIsLoadingModels(false);
          return;
        }
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      let models: string[] = [];
      if (formData.provider === 'local' || (formData.provider === 'custom' && formData.apiProtocol === 'ollama')) {
        models = data.models?.map((m: any) => m.name) || [];
      } else {
        models = data.data?.map((m: any) => m.id) || [];
      }

      setAvailableModels(models);
      if (models.length === 0) {
        alert('未找到可用模型');
      }
    } catch (error) {
      alert(`获取模型列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.model) {
      alert('请填写模型名称和模型');
      return;
    }

    if (editingId) {
      const updatedConfig: ModelConfig = {
        ...formData,
        id: editingId,
        name: formData.name!,
        provider: formData.provider!,
        model: formData.model!,
        temperature: formData.temperature!,
        maxTokens: formData.maxTokens!,
        createdAt: formData.createdAt || Date.now(),
      };
      await updateModelConfig(updatedConfig);
    } else {
      const newConfig: ModelConfig = {
        ...formData,
        id: `model-${Date.now()}`,
        name: formData.name!,
        provider: formData.provider!,
        model: formData.model!,
        temperature: formData.temperature!,
        maxTokens: formData.maxTokens!,
        createdAt: Date.now(),
      };
      await createModelConfig(newConfig);
    }

    setIsDialogOpen(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个模型配置吗？')) {
      await deleteModelConfig(id);
    }
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultModel(id);
  };

  return (
    <>
      <div className="w-full h-full bg-gray-50 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {/* 关闭按钮 */}
          <div className="flex justify-end mb-4">
            <button
              onClick={closeSettings}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2 text-gray-600"
              title="关闭设置"
            >
              <X size={20} />
              <span>关闭</span>
            </button>
          </div>

          {/* AI模型配置列表 */}
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">AI 模型配置</h3>
              <button
                onClick={handleStartAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Plus size={18} />
                添加模型
              </button>
            </div>

            {/* 模型列表 */}
            <div className="space-y-3">
              {modelConfigs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暂无模型配置，请添加一个</p>
              ) : (
                modelConfigs.map((config) => (
                  <div
                    key={config.id}
                    className={`p-4 border rounded-lg transition-colors ${
                      config.isDefault ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-lg">{config.name}</h4>
                          {config.isDefault && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs rounded">
                              <Star size={12} />
                              默认
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>服务商: {config.provider === 'custom' ? `自定义 (${config.apiProtocol})` : config.provider}</p>
                          <p>模型: {config.model}</p>
                          {config.baseURL && <p>API地址: {config.baseURL}</p>}
                          <p>Temperature: {config.temperature} | Max Tokens: {config.maxTokens}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!config.isDefault && (
                          <button
                            onClick={() => handleSetDefault(config.id)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="设为默认"
                          >
                            <Star size={18} className="text-gray-400" />
                          </button>
                        )}
                        <button
                          onClick={() => handleStartEdit(config)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(config.id)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-red-500"
                          title="删除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 预留更多设置区域 */}
          <section className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">其他设置</h3>
            <p className="text-sm text-gray-500">更多设置选项即将推出...</p>
          </section>
        </div>
      </div>

      {/* 添加/编辑对话框 */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold">{editingId ? '编辑模型' : '添加新模型'}</h3>
              <button
                onClick={handleCancel}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">模型名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: GPT-3.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">AI服务商</label>
                <select
                  value={formData.provider}
                  onChange={(e) => {
                    const provider = e.target.value as ModelConfig['provider'];
                    setFormData({
                      ...formData,
                      provider,
                      apiProtocol: provider === 'custom' ? 'openai' : undefined,
                      baseURL: provider === 'local' ? 'http://localhost:11434' : ''
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="local">本地模型 (Ollama)</option>
                  <option value="custom">自定义服务商</option>
                </select>
              </div>

              {formData.provider === 'custom' && (
                <div>
                  <label className="block text-sm font-medium mb-2">API 协议</label>
                  <select
                    value={formData.apiProtocol || 'openai'}
                    onChange={(e) => setFormData({ ...formData, apiProtocol: e.target.value as ModelConfig['apiProtocol'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="openai">OpenAI 兼容</option>
                    <option value="anthropic">Anthropic 兼容</option>
                    <option value="ollama">Ollama 兼容</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    选择与你的服务商兼容的 API 协议。大多数服务商支持 OpenAI 兼容协议。
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">模型</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      onFocus={() => availableModels.length > 0 && setShowModelDropdown(true)}
                      placeholder={
                        formData.provider === 'openai' ? '例如: gpt-4o' :
                        formData.provider === 'anthropic' ? '例如: claude-3-5-sonnet-20241022' :
                        formData.provider === 'deepseek' ? '例如: deepseek-chat' :
                        formData.provider === 'local' ? '例如: llama3.2' :
                        '输入模型名称'
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {/* 模型下拉列表 */}
                    {showModelDropdown && availableModels.length > 0 && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowModelDropdown(false)}
                        />
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-[200px] overflow-y-auto">
                          {availableModels.map((model) => (
                            <button
                              key={model}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, model });
                                setShowModelDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors text-sm"
                            >
                              {model}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={isLoadingModels || (!formData.apiKey && formData.provider !== 'local')}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-lg transition-colors flex items-center gap-2 text-sm"
                    title="获取可用模型列表"
                  >
                    <RefreshCw size={16} className={isLoadingModels ? 'animate-spin' : ''} />
                    {isLoadingModels ? '加载中' : '获取'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  点击"获取"按钮自动获取可用模型列表，或手动输入模型名称
                </p>
              </div>

              {(formData.provider === 'custom' || formData.provider === 'local') && (
                <div>
                  <label className="block text-sm font-medium mb-2">API 地址</label>
                  <input
                    type="text"
                    value={formData.baseURL || ''}
                    onChange={(e) => setFormData({ ...formData, baseURL: e.target.value })}
                    placeholder={
                      formData.provider === 'local' ? 'http://localhost:11434' :
                      formData.apiProtocol === 'openai' ? 'https://api.example.com' :
                      formData.apiProtocol === 'anthropic' ? 'https://api.example.com' :
                      'https://api.example.com'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.provider === 'custom' && formData.apiProtocol === 'openai' && '完整的 API 地址，例如: https://api.example.com（会自动添加 /v1/chat/completions）'}
                    {formData.provider === 'custom' && formData.apiProtocol === 'anthropic' && '完整的 API 地址，例如: https://api.example.com（会自动添加 /v1/messages）'}
                    {formData.provider === 'custom' && formData.apiProtocol === 'ollama' && '完整的 API 地址，例如: http://localhost:11434（会自动添加 /api/chat）'}
                    {formData.provider === 'local' && 'Ollama 服务地址，默认: http://localhost:11434'}
                  </p>
                </div>
              )}

              {formData.provider !== 'local' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    API Key {formData.provider === 'custom' && '(可选)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={formData.apiKey || ''}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder={formData.provider === 'custom' ? '如果需要认证，请输入 API Key' : '输入 API Key'}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      title={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                    >
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Temperature: {formData.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Tokens</label>
                <input
                  type="number"
                  value={formData.maxTokens}
                  onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 测试 API 连接 */}
              <div className="pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleTestAPI}
                  disabled={isTesting || (!formData.apiKey && formData.provider !== 'local' && formData.provider !== 'custom')}
                  className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <RefreshCw size={16} className={isTesting ? 'animate-spin' : ''} />
                  {isTesting ? '测试中...' : '测试 API 连接'}
                </button>

                {/* 测试结果 */}
                {testResult && (
                  <div className={`mt-2 p-3 rounded-lg text-sm ${
                    testResult.success
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Check size={18} />
                保存
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                <X size={18} />
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
