import { useState, useEffect, useMemo } from 'react';
import { Send, ChevronDown } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { sendAIMessage } from '../../services/ai';
import { ChatNode, ModelConfig } from '../../types';

export function MessageInput() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);
  const [showModelSelector, setShowModelSelector] = useState(false);

  const { currentSession, selectedNodeId, addNode, getConversationPath } = useChatStore();
  const { modelConfigs, defaultModelConfig, loadModelConfigs } = useSettingsStore();

  // 获取会话默认模型
  const sessionDefaultModel = currentSession?.defaultModelId
    ? modelConfigs.find(m => m.id === currentSession.defaultModelId)
    : null;

  // 优先使用会话默认模型，其次是全局默认模型
  const effectiveDefaultModel = sessionDefaultModel || defaultModelConfig;

  // 获取选中节点使用的模型（用于继承）
  const selectedNodeModel = useMemo(() => {
    if (!currentSession || !selectedNodeId) return null;
    const selectedNode = currentSession.nodes[selectedNodeId];
    if (!selectedNode || !selectedNode.model) return null;

    // 解析节点的模型字符串 "provider:model"
    const [provider, modelName] = selectedNode.model.split(':');
    return modelConfigs.find(m => m.provider === provider && m.model === modelName);
  }, [currentSession, selectedNodeId, modelConfigs]);

  // 如果选中的节点有模型，则继承该模型，否则使用会话默认模型
  const inputDefaultModel = selectedNodeModel || effectiveDefaultModel;

  // 确保模型配置已加载（只在组件挂载时加载一次）
  useEffect(() => {
    console.log('[MessageInput] Component mounted, loading model configs...');
    loadModelConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当默认模型配置变化时，更新选中的模型
  useEffect(() => {
    console.log('[MessageInput] inputDefaultModel changed:', inputDefaultModel);
    if (inputDefaultModel && !selectedModel) {
      setSelectedModel(inputDefaultModel);
    }
  }, [inputDefaultModel, selectedModel]);

  const handleSend = async () => {
    const modelToUse = selectedModel || inputDefaultModel;
    console.log('[MessageInput] handleSend called. modelToUse:', modelToUse);
    if (!input.trim() || !currentSession || !selectedNodeId) return;

    if (!modelToUse) {
      console.error('[MessageInput] No model config found!');
      alert('请先在设置中配置并设置默认 AI 模型');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // 创建用户消息节点
      const userNodeId = `user-${Date.now()}`;
      const selectedNode = currentSession.nodes[selectedNodeId];

      const userNode: ChatNode = {
        id: userNodeId,
        type: 'user',
        content: userMessage,
        parentId: selectedNodeId,
        children: [],
        model: '',
        timestamp: Date.now(),
        position: {
          x: selectedNode.position.x - 100,
          y: selectedNode.position.y + 150,
        },
      };

      addNode(userNode);

      // 获取对话历史
      const conversationPath = getConversationPath();
      const messages = conversationPath.map((node) => ({
        role: node.type as 'user' | 'assistant',
        content: node.content,
      }));

      // 添加当前用户消息
      messages.push({ role: 'user', content: userMessage });

      // 调用AI API
      const aiResponse = await sendAIMessage(messages, modelToUse);

      // 创建AI回复节点
      const aiNodeId = `assistant-${Date.now()}`;
      const aiNode: ChatNode = {
        id: aiNodeId,
        type: 'assistant',
        content: aiResponse,
        parentId: userNodeId,
        children: [],
        model: `${modelToUse.provider}:${modelToUse.model}`,
        timestamp: Date.now(),
        position: {
          x: selectedNode.position.x + 100,
          y: selectedNode.position.y + 300,
        },
      };

      addNode(aiNode);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert(`发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentModel = selectedModel || inputDefaultModel;

  return (
    <div className="border-t border-gray-300 bg-white p-4">
      <div className="flex flex-col gap-2 max-w-4xl mx-auto">
        {/* 输入框容器 - 使用相对定位 */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            {/* 模型选择器 - 定位在输入框左上角 */}
            <div className="absolute top-2 left-4 z-10 flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowModelSelector(!showModelSelector)}
                  className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-gray-50 rounded transition-colors text-xs text-gray-600"
                  disabled={isLoading}
                  title={currentModel ? currentModel.name : '未选择模型'}
                >
                  <span className="font-medium max-w-[150px] truncate">
                    {currentModel ? currentModel.name : '未选择模型'}
                  </span>
                  <ChevronDown size={12} className="flex-shrink-0" />
                </button>

                {/* 下拉菜单 */}
                {showModelSelector && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowModelSelector(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 min-w-[250px] max-h-[300px] overflow-y-auto">
                      {modelConfigs.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">
                          暂无可用模型
                        </div>
                      ) : (
                        modelConfigs.map((config) => (
                          <button
                            key={config.id}
                            onClick={() => {
                              setSelectedModel(config);
                              setShowModelSelector(false);
                            }}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                              currentModel?.id === config.id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="font-medium text-sm">{config.name}</div>
                            <div className="text-xs text-gray-500">
                              {config.provider === 'custom' ? `自定义 (${config.apiProtocol})` : config.provider} · {config.model}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              {currentModel && currentModel.id !== inputDefaultModel?.id && (
                <button
                  onClick={() => setSelectedModel(inputDefaultModel)}
                  className="text-xs text-blue-600 hover:text-blue-700 whitespace-nowrap px-1.5 py-0.5 rounded hover:bg-blue-50"
                  title="恢复默认模型"
                >
                  恢复默认
                </button>
              )}
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                !currentModel
                  ? "请先在设置中配置 AI 模型..."
                  : "输入消息... (Enter发送, Shift+Enter换行)"
              }
              disabled={isLoading || !currentSession || !currentModel}
              className="w-full px-4 py-2 pt-7 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              rows={3}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !currentSession || !currentModel}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            title={!currentModel ? "请先配置 AI 模型" : ""}
          >
            <Send size={20} />
            {isLoading ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}
