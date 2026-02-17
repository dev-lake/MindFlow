import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Send, Quote, GripVertical, StopCircle, Plus, GitBranch, X, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatNode as ChatNodeType, ModelConfig } from '../../types';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { sendAIMessage } from '../../services/ai';
import { estimateNodeHeight } from '../../utils/layoutUtils';

interface ChatNodeData {
  node: ChatNodeType;
  isSelected: boolean;
  onSelect: () => void;
}

export const ChatNodeComponent = memo(({ data }: NodeProps<ChatNodeData>) => {
  const { node, isSelected, onSelect } = data;
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showQuoteButton, setShowQuoteButton] = useState(false);
  const [quoteButtonPosition, setQuoteButtonPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelConfig | null>(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [isThinkingInProgress, setIsThinkingInProgress] = useState(false);
  const [isUserMessageCollapsed, setIsUserMessageCollapsed] = useState(false);
  const [isAssistantMessageCollapsed, setIsAssistantMessageCollapsed] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { currentSession, addNode, updateNode, selectNode, getConversationPath, quotedContent, setQuotedContent, deleteNode } = useChatStore();
  const { modelConfigs, defaultModelConfig } = useSettingsStore();

  // 获取会话默认模型
  const sessionDefaultModel = currentSession?.defaultModelId
    ? modelConfigs.find(m => m.id === currentSession.defaultModelId)
    : null;

  // 优先使用会话默认模型，其次是全局默认模型
  const effectiveDefaultModel = sessionDefaultModel || defaultModelConfig;

  // 获取父节点使用的模型（用于继承）
  const parentNodeModel = useMemo(() => {
    if (!currentSession || !node.parentId) return null;
    const parentNode = currentSession.nodes[node.parentId];
    if (!parentNode || !parentNode.model) return null;

    // 解析父节点的模型字符串 "provider:model"
    const [provider, modelName] = parentNode.model.split(':');
    return modelConfigs.find(m => m.provider === provider && m.model === modelName);
  }, [currentSession, node.parentId, modelConfigs]);

  // 对于输入节点，如果有父节点模型则继承，否则使用会话默认模型
  const inputNodeDefaultModel = node.type === 'input' && parentNodeModel
    ? parentNodeModel
    : effectiveDefaultModel;

  // 初始化选中的模型（仅在组件挂载时执行一次）
  useEffect(() => {
    if (node.type === 'input' && !selectedModel && inputNodeDefaultModel) {
      setSelectedModel(inputNodeDefaultModel);
    }
  }, [node.type, inputNodeDefaultModel]); // 移除 selectedModel 依赖，避免循环

  // 检查节点是否有多个子节点
  const hasMultipleChildren = node.children && node.children.length > 1;

  // 检查节点的子节点中是否已经有输入节点
  const hasInputChild = currentSession && node.children.some(childId => {
    const child = currentSession.nodes[childId];
    return child && child.type === 'input';
  });

  // 是否应该显示加号按钮：节点没有输入节点子节点时才显示
  const shouldShowAddButton = !hasInputChild && !isSending;

  // 监听文本选择
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 0 && nodeRef.current?.contains(selection?.anchorNode || null)) {
        setSelectedText(text);

        // 获取选中文本的位置和节点容器的位置
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        const nodeRect = nodeRef.current?.getBoundingClientRect();

        if (rect && nodeRect) {
          // 计算相对于节点容器的位置
          setQuoteButtonPosition({
            x: rect.left - nodeRect.left + rect.width / 2,
            y: rect.top - nodeRect.top,
          });
          setShowQuoteButton(true);
        }
      } else {
        setShowQuoteButton(false);
      }
    };

    // 点击其他地方时隐藏按钮
    const handleClickOutside = (e: MouseEvent) => {
      if (showQuoteButton) {
        const target = e.target as HTMLElement;
        // 如果点击的不是引用按钮本身，则隐藏
        if (!target.closest('.quote-button')) {
          setShowQuoteButton(false);
        }
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showQuoteButton]);

  const handleQuote = () => {
    if (selectedText && currentSession) {
      // 确定引用来源和完整上下文
      let sourceType: 'user' | 'assistant' = 'user';
      let fullContext = '';

      if (isConversation) {
        // 对话节点，需要判断选中的文本来自用户消息还是AI回复
        const userMessageText = node.userMessage || '';
        const assistantMessageText = node.assistantMessage || '';

        if (userMessageText.includes(selectedText)) {
          sourceType = 'user';
          fullContext = userMessageText;
        } else if (assistantMessageText.includes(selectedText)) {
          sourceType = 'assistant';
          fullContext = assistantMessageText;
        }
      } else {
        // 其他类型节点
        sourceType = node.type === 'user' ? 'user' : 'assistant';
        fullContext = node.content;
      }

      // 设置全局引用内容
      setQuotedContent({
        text: selectedText,
        nodeId: node.id,
        sourceType,
        fullContext,
      });
      setShowQuoteButton(false);
      window.getSelection()?.removeAllRanges();

      // 找到当前的输入节点并选中它
      const inputNode = Object.values(currentSession.nodes).find(n => n.type === 'input');
      if (inputNode) {
        selectNode(inputNode.id);
      }
    }
  };

  // 添加新分支（从选中文本创建）
  const handleAddBranchFromSelection = () => {
    if (selectedText && currentSession) {
      // 确定引用来源和完整上下文
      let sourceType: 'user' | 'assistant' = 'user';
      let fullContext = '';

      if (isConversation) {
        const userMessageText = node.userMessage || '';
        const assistantMessageText = node.assistantMessage || '';

        if (userMessageText.includes(selectedText)) {
          sourceType = 'user';
          fullContext = userMessageText;
        } else if (assistantMessageText.includes(selectedText)) {
          sourceType = 'assistant';
          fullContext = assistantMessageText;
        }
      } else {
        sourceType = node.type === 'user' ? 'user' : 'assistant';
        fullContext = node.content;
      }

      // 设置引用内容
      setQuotedContent({
        text: selectedText,
        nodeId: node.id,
        sourceType,
        fullContext,
      });

      // 创建新的输入节点作为分支
      createBranchNode();

      setShowQuoteButton(false);
      window.getSelection()?.removeAllRanges();
    }
  };

  // 创建新分支节点
  const createBranchNode = () => {
    if (!currentSession) return;

    const newInputNodeId = `input-${Date.now()}`;

    // 计算新分支的位置
    const existingChildren = node.children || [];
    const childrenCount = existingChildren.length;

    // 使用统一的高度估算函数
    const parentNodeHeight = estimateNodeHeight(node);

    // 默认位置：X轴与父节点相同，Y轴在父节点下方（父节点高度 + 间距）
    let newX = node.position.x;
    let newY = node.position.y + parentNodeHeight + 80;

    // 如果已有子节点，找到最下方的子节点位置
    if (childrenCount > 0 && currentSession) {
      let maxY = node.position.y;
      let maxYChildNode: ChatNodeType | null = null;

      existingChildren.forEach(childId => {
        const child = currentSession.nodes[childId];
        if (child && child.position.y > maxY) {
          maxY = child.position.y;
          maxYChildNode = child;
        }
      });

      if (maxYChildNode) {
        // 使用统一的高度估算函数
        const estimatedHeight = estimateNodeHeight(maxYChildNode);

        // 新节点放在最下方子节点下方，加上估算高度和额外间距
        newY = maxY + estimatedHeight + 100;

        // X轴根据子节点数量偏移，避免与父节点重叠
        // 使用更大的偏移量，确保节点不会重叠
        const baseXOffset = 400;
        const offsetMultiplier = (childrenCount % 4) - 1; // -1, 0, 1, 2
        newX = node.position.x + offsetMultiplier * baseXOffset;
      }
    }

    const newInputNode: ChatNodeType = {
      id: newInputNodeId,
      type: 'input',
      content: '',
      parentId: node.id,
      children: [],
      model: '',
      timestamp: Date.now(),
      position: {
        x: newX,
        y: newY,
      },
    };

    addNode(newInputNode);
    selectNode(newInputNodeId);
  };

  // 关闭（删除）输入节点
  const handleCloseInputNode = () => {
    if (isInput && node.id !== 'root') {
      deleteNode(node.id);
    }
  };

  const isUser = node.type === 'user';
  const isSystem = node.type === 'system';
  const isInput = node.type === 'input';
  const isLoadingNode = node.type === 'loading';
  const isConversation = node.type === 'conversation';

  const handleSend = async () => {
    if (!input.trim() || !currentSession) return;

    const modelToUse = selectedModel || inputNodeDefaultModel;
    if (!modelToUse) {
      alert('请先在设置中配置并设置默认 AI 模型');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setIsSending(true);

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    // 将这些变量提升到外层作用域，以便在 catch 块中访问
    let conversationNodeId: string = '';
    let streamedContent = '';
    let streamedThinking = '';
    let baseY: number = 0;
    let shouldCreateInputNode = false;

    try {
      // 如果是input节点，将其转换为conversation节点
      if (isInput) {
        conversationNodeId = node.id;
        baseY = node.position.y;

        // 更新当前节点为对话节点，先显示用户消息和加载状态
        updateNode(node.id, {
          type: 'conversation',
          content: userMessage,
          userMessage: userMessage,
          assistantMessage: undefined,
          timestamp: Date.now(),
          quotedContent: quotedContent || undefined,
          model: `${modelToUse.provider}:${modelToUse.model}`,
        });

        // 如果是第一条消息且会话标题是"新对话"，自动生成标题
        if (currentSession.title === '新对话' && node.id === 'root') {
          const title = userMessage.length > 30 ? userMessage.slice(0, 30) + '...' : userMessage;
          useChatStore.getState().updateSessionTitle(currentSession.id, title);
        }
      } else {
        // 否则创建新的对话节点
        conversationNodeId = `conversation-${Date.now()}`;
        baseY = node.position.y + 200;

        const conversationNode: ChatNodeType = {
          id: conversationNodeId,
          type: 'conversation',
          content: userMessage,
          userMessage: userMessage,
          assistantMessage: undefined,
          parentId: node.id,
          children: [],
          model: `${modelToUse.provider}:${modelToUse.model}`,
          timestamp: Date.now(),
          position: {
            x: node.position.x,
            y: baseY,
          },
          quotedContent: quotedContent || undefined,
        };

        addNode(conversationNode);
      }

      // 清除引用状态
      setQuotedContent(null);

      // 获取对话历史
      const conversationPath = getConversationPath();
      const messages = conversationPath.map((n) => ({
        role: n.type as 'user' | 'assistant',
        content: n.content,
      }));

      // 添加当前用户消息，如果有引用内容，将其包含在消息中
      let finalUserMessage = userMessage;
      if (quotedContent) {
        const sourceLabel = quotedContent.sourceType === 'user' ? '用户' : 'AI助手';

        // 如果选中的文本不是完整内容，提供完整上下文
        if (quotedContent.fullContext && quotedContent.fullContext !== quotedContent.text) {
          finalUserMessage = `[引用上下文]
来源：${sourceLabel}的回复
完整内容：
"""
${quotedContent.fullContext}
"""

选中部分：
"""
${quotedContent.text}
"""

[我的问题]
${userMessage}`;
        } else {
          // 选中的就是完整内容
          finalUserMessage = `[引用内容]
来源：${sourceLabel}的回复
"""
${quotedContent.text}
"""

[我的问题]
${userMessage}`;
        }
      }
      messages.push({ role: 'user', content: finalUserMessage });

      // 调用AI API，使用流式响应
      const response = await sendAIMessage(messages, modelToUse, (chunk, type) => {
        if (type === 'thinking') {
          streamedThinking += chunk;
          // 思考过程开始时自动展开
          setShowThinking(true);
          setIsThinkingInProgress(true);
          // 实时更新思考过程（不保存到数据库）
          updateNode(conversationNodeId, {
            thinkingContent: streamedThinking,
          }, false);
        } else {
          streamedContent += chunk;
          // 实时更新节点内容（不保存到数据库）
          updateNode(conversationNodeId, {
            assistantMessage: streamedContent,
          }, false);
        }
      }, abortControllerRef.current.signal);

      // 最终更新时间戳并保存到数据库
      await updateNode(conversationNodeId, {
        assistantMessage: response.content,
        thinkingContent: response.thinkingContent,
        timestamp: Date.now(),
      }, true);

      // 思考完成后自动折叠
      setIsThinkingInProgress(false);
      setShowThinking(false);

      // 标记需要创建输入节点
      shouldCreateInputNode = true;

      // 标记需要创建输入节点
      shouldCreateInputNode = true;

      // AI生成完成后，创建新的输入节点
      const newInputNodeId = `input-${Date.now()}`;

      // 更准确地估算节点高度，考虑 Markdown 渲染
      // 固定宽度600px，考虑各种元素的实际高度
      const estimateContentHeight = (text: string): number => {
        if (!text) return 0;

        // 基础行高计算（每行约60个字符，行高约24px）
        const lines = text.split('\n');
        let totalHeight = 0;

        for (const line of lines) {
          if (line.trim() === '') {
            totalHeight += 24; // 空行
          } else if (line.startsWith('#')) {
            // 标题行，高度更大
            totalHeight += 36;
          } else if (line.startsWith('```')) {
            // 代码块，跳过
            continue;
          } else {
            // 普通文本，按宽度换行
            const lineLength = line.length;
            const wrappedLines = Math.ceil(lineLength / 60);
            totalHeight += wrappedLines * 24;
          }
        }

        // 额外考虑代码块
        const codeBlocks = (text.match(/```[\s\S]*?```/g) || []);
        codeBlocks.forEach(block => {
          const blockLines = block.split('\n').length;
          totalHeight += blockLines * 20 + 32; // 代码块行高 + padding
        });

        return totalHeight;
      };

      const userHeight = estimateContentHeight(userMessage);
      const assistantHeight = estimateContentHeight(streamedContent);

      // 基础高度（标题、边距等）+ 内容高度 + 额外安全间距
      const estimatedHeight = 120 + userHeight + assistantHeight + 100;

      const newInputNode: ChatNodeType = {
        id: newInputNodeId,
        type: 'input',
        content: '',
        parentId: conversationNodeId,
        children: [],
        model: '',
        timestamp: Date.now(),
        position: {
          x: node.position.x,
          y: baseY + estimatedHeight,
        },
      };

      addNode(newInputNode);
      selectNode(newInputNodeId);
    } catch (error) {
      // 检查是否是用户主动取消
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Generation stopped by user');
        // 保存已生成的部分内容，并添加终止标记
        if (conversationNodeId && streamedContent) {
          const contentWithStopMark = streamedContent + '\n\n---\n*[生成已停止]*';
          await updateNode(conversationNodeId, {
            assistantMessage: contentWithStopMark,
            thinkingContent: streamedThinking || undefined,
            timestamp: Date.now(),
          }, true);
          // 标记需要创建输入节点
          shouldCreateInputNode = true;
        }
        // 停止时也折叠思考过程
        setIsThinkingInProgress(false);
        setShowThinking(false);
      } else {
        console.error('Failed to send message:', error);
        alert(`发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    } finally {
      // 如果需要创建输入节点（无论是正常完成还是被终止）
      if (shouldCreateInputNode && conversationNodeId) {
        const estimateContentHeight = (text: string): number => {
          if (!text) return 0;

          const lines = text.split('\n');
          let totalHeight = 0;

          for (const line of lines) {
            if (line.trim() === '') {
              totalHeight += 24;
            } else if (line.startsWith('#')) {
              totalHeight += 36;
            } else if (line.startsWith('```')) {
              continue;
            } else {
              const lineLength = line.length;
              const wrappedLines = Math.ceil(lineLength / 60);
              totalHeight += wrappedLines * 24;
            }
          }

          const codeBlocks = (text.match(/```[\s\S]*?```/g) || []);
          codeBlocks.forEach(block => {
            const blockLines = block.split('\n').length;
            totalHeight += blockLines * 20 + 32;
          });

          return totalHeight;
        };

        const userHeight = estimateContentHeight(userMessage);
        const assistantHeight = estimateContentHeight(streamedContent);
        const estimatedHeight = 120 + userHeight + assistantHeight + 100;

        const newInputNodeId = `input-${Date.now()}`;
        const newInputNode: ChatNodeType = {
          id: newInputNodeId,
          type: 'input',
          content: '',
          parentId: conversationNodeId,
          children: [],
          model: '',
          timestamp: Date.now(),
          position: {
            x: node.position.x,
            y: baseY + estimatedHeight,
          },
        };

        addNode(newInputNode);
        selectNode(newInputNodeId);
      }

      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 如果是对话节点,显示用户消息和AI回复
  if (isConversation) {
    const hasAssistant = node.assistantMessage !== undefined && node.assistantMessage !== '';

    // 判断消息是否过长（超过300字符）
    const isUserMessageLong = (node.userMessage || '').length > 300;
    const isAssistantMessageLong = (node.assistantMessage || '').length > 300;

    return (
      <div
        className="relative"
        ref={nodeRef}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={`
            rounded-lg shadow-md cursor-default transition-all
            w-[600px]
            bg-white border-2 border-gray-300
            ${isSelected ? 'ring-2 ring-blue-500' : ''}
            hover:shadow-lg
          `}
        >
          <Handle type="target" position={Position.Top} />

          {/* 可拖动的标题栏 */}
          <div className="bg-gray-50 px-4 py-2 rounded-t-lg border-b border-gray-200 flex items-center justify-between cursor-move drag-handle">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <GripVertical size={14} />
              <span>{new Date(node.timestamp).toLocaleString()}</span>
            </div>
            {node.model && (
              <span className="text-xs text-gray-400">{node.model}</span>
            )}
          </div>

          {/* 引用内容显示 */}
          {node.quotedContent && (
            <div className="bg-gray-100 p-3 mx-4 mt-3 rounded-lg border-l-4 border-blue-400">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Quote size={12} />
                <span>引用内容</span>
              </div>
              <div className="text-xs text-gray-700 italic">
                "{node.quotedContent.text}"
              </div>
            </div>
          )}

          {/* 用户消息 */}
          <div className="bg-blue-50 p-4 border-b border-gray-200">
            <div className="text-xs text-blue-600 font-medium mb-2 flex items-center justify-between">
              <span>👤 你</span>
              {isUserMessageLong && (
                <button
                  onClick={() => setIsUserMessageCollapsed(!isUserMessageCollapsed)}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${isUserMessageCollapsed ? '' : 'rotate-180'}`}
                  />
                  {isUserMessageCollapsed ? '展开' : '折叠'}
                </button>
              )}
            </div>
            <div className={`text-sm text-gray-800 prose prose-sm max-w-none select-text ${isUserMessageCollapsed ? 'line-clamp-3' : ''}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {node.userMessage || ''}
              </ReactMarkdown>
            </div>
          </div>

          {/* 思考过程 */}
          {node.thinkingContent && (
            <div className="bg-amber-50 border-b border-amber-200">
              <button
                onClick={() => setShowThinking(!showThinking)}
                className="w-full px-4 py-2 flex items-center justify-between hover:bg-amber-100 transition-colors"
              >
                <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
                  <span>💭 思考过程</span>
                  {isThinkingInProgress && (
                    <span className="text-xs text-amber-600">(思考中...)</span>
                  )}
                </div>
                <ChevronDown
                  size={14}
                  className={`text-amber-600 transition-transform ${showThinking || isThinkingInProgress ? 'rotate-180' : ''}`}
                />
              </button>
              {(showThinking || isThinkingInProgress) && (
                <div className="px-4 pb-4">
                  <div className="text-sm text-gray-700 prose prose-sm max-w-none select-text bg-white p-3 rounded border border-amber-200">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {node.thinkingContent}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI回复 */}
          <div className="bg-white p-4 rounded-b-lg">
            <div className="text-xs text-gray-600 font-medium mb-2 flex items-center justify-between">
              <span>🤖 {node.model || 'AI'}</span>
              <div className="flex items-center gap-2">
                {isAssistantMessageLong && hasAssistant && (
                  <button
                    onClick={() => setIsAssistantMessageCollapsed(!isAssistantMessageCollapsed)}
                    className="text-xs text-gray-600 hover:text-gray-700 flex items-center gap-1"
                  >
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${isAssistantMessageCollapsed ? '' : 'rotate-180'}`}
                    />
                    {isAssistantMessageCollapsed ? '展开' : '折叠'}
                  </button>
                )}
                {/* 停止按钮 - 在生成过程中显示 */}
                {isSending && (
                  <button
                    onClick={handleStop}
                    className="px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors flex items-center gap-1.5 text-xs font-medium"
                  >
                    <StopCircle size={14} />
                    停止生成
                  </button>
                )}
              </div>
            </div>
            {hasAssistant ? (
              <div className={`text-sm text-gray-800 prose prose-sm max-w-none select-text ${isAssistantMessageCollapsed ? 'line-clamp-5' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {node.assistantMessage || ''}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span>正在思考中...</span>
              </div>
            )}
          </div>

          <Handle type="source" position={Position.Bottom} />
        </div>

        {/* 悬停时显示的添加分支按钮 */}
        {isHovering && shouldShowAddButton && hasAssistant && (
          <button
            onClick={createBranchNode}
            className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white p-2 rounded-full shadow-lg hover:bg-green-600 hover:shadow-xl transition-all z-[9999] animate-fadeIn"
            title="添加新分支"
          >
            <Plus size={16} />
          </button>
        )}

        {/* 文本选择后的按钮组 */}
        {showQuoteButton && (
          <div
            className="absolute flex gap-2 z-[9999] animate-fadeIn"
            style={{
              left: `${quoteButtonPosition.x}px`,
              top: `${quoteButtonPosition.y}px`,
              transform: 'translate(-50%, -100%)',
              marginTop: '-8px',
            }}
          >
            <button
              onClick={handleQuote}
              className="quote-button bg-blue-500 text-white px-3 py-1.5 rounded-md shadow-xl hover:bg-blue-600 hover:shadow-2xl transition-all flex items-center gap-1.5 text-xs font-medium"
            >
              <Quote size={14} />
              引用
            </button>
            {hasMultipleChildren && (
              <button
                onClick={handleAddBranchFromSelection}
                className="quote-button bg-green-500 text-white px-3 py-1.5 rounded-md shadow-xl hover:bg-green-600 hover:shadow-2xl transition-all flex items-center gap-1.5 text-xs font-medium"
              >
                <GitBranch size={14} />
                新分支
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 如果是加载节点，显示加载动画
  if (isLoadingNode) {
    return (
      <div className="relative">
        <div className="px-4 py-3 rounded-lg shadow-md min-w-[200px] max-w-[300px] bg-gray-50 border-2 border-gray-300 animate-pulse">
          <Handle type="target" position={Position.Top} />

          <div className="text-xs text-gray-500 mb-1">
            🤖 {node.model || 'AI'}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span>正在思考中...</span>
          </div>

          <Handle type="source" position={Position.Bottom} />
        </div>
      </div>
    );
  }

  // 如果是输入节点，直接显示输入框
  if (isInput) {
    const currentModel = selectedModel || inputNodeDefaultModel;

    return (
      <div className="relative">
        <div
          className="bg-white rounded-lg shadow-lg border-2 border-blue-500 w-[600px]"
          onClick={(e) => e.stopPropagation()}
        >
          <Handle type="target" position={Position.Top} />
          <Handle type="source" position={Position.Bottom} />

          {/* 可拖动的标题栏 */}
          <div className="bg-blue-50 px-4 py-2 rounded-t-lg border-b border-blue-200 flex items-center justify-between cursor-move drag-handle">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <GripVertical size={14} />
              💬 继续对话
            </div>
            {/* 关闭按钮 - 只有非root节点才显示 */}
            {node.id !== 'root' && (
              <button
                onClick={handleCloseInputNode}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="关闭输入框"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="p-4">
            {/* 输入框容器 - 使用相对定位 */}
            <div className="relative">
              {/* 模型选择器 - 定位在输入框左上角 */}
              <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-gray-50 rounded transition-colors text-xs text-gray-600"
                    disabled={isSending}
                    title={currentModel ? currentModel.name : '未选择模型'}
                  >
                    <span className="font-medium max-w-[120px] truncate">
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
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 min-w-[250px] max-h-[200px] overflow-y-auto">
                        {modelConfigs.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 text-center">
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
                              className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${currentModel?.id === config.id ? 'bg-blue-50' : ''
                                }`}
                            >
                              <div className="font-medium text-xs">{config.name}</div>
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
                {currentModel && currentModel.id !== inputNodeDefaultModel?.id && (
                  <button
                    onClick={() => setSelectedModel(inputNodeDefaultModel)}
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
                placeholder="输入你的消息... (Enter发送, Shift+Enter换行)"
                disabled={isSending}
                autoFocus
                className="w-full px-3 py-2 pt-7 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
                rows={4}
              />
            </div>

            {/* 引用内容预览 - 显示在输入框下方 */}
            {quotedContent && (
              <div className="mt-2 bg-gray-50 p-2 rounded-md border border-gray-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Quote size={12} />
                      <span>引用的内容</span>
                    </div>
                    <div className="text-xs text-gray-700 line-clamp-3 italic">
                      "{quotedContent.text}"
                    </div>
                  </div>
                  <button
                    onClick={() => setQuotedContent(null)}
                    className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    title="取消引用"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="w-full mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Send size={16} />
              {isSending ? '发送中...' : '发送消息'}
            </button>

            {/* 停止按钮 */}
            {isSending && (
              <button
                onClick={handleStop}
                className="w-full mt-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <StopCircle size={16} />
                停止生成
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative"
      ref={nodeRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`
          px-4 py-3 rounded-lg shadow-md cursor-pointer transition-all
          min-w-[200px] max-w-[300px]
          ${isSelected ? 'ring-2 ring-blue-500' : ''}
          ${isUser ? 'bg-blue-100 border-2 border-blue-300' : ''}
          ${node.type === 'assistant' ? 'bg-gray-100 border-2 border-gray-300' : ''}
          ${isSystem ? 'bg-green-100 border-2 border-green-300' : ''}
          hover:shadow-lg
        `}
      >
        {!isSystem && <Handle type="target" position={Position.Top} />}

        <div className="text-xs text-gray-500 mb-1">
          {isUser ? '👤 用户' : isSystem ? '🤖 系统' : `🤖 ${node.model || 'AI'}`}
        </div>

        <div className="text-sm text-gray-800 prose prose-sm max-w-none select-text">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {node.content}
          </ReactMarkdown>
        </div>

        <div className="text-xs text-gray-400 mt-2">
          {new Date(node.timestamp).toLocaleTimeString()}
        </div>

        {!isSystem && <Handle type="source" position={Position.Bottom} />}
      </div>

      {/* 悬停时显示的添加分支按钮 */}
      {isHovering && shouldShowAddButton && !isSystem && (
        <button
          onClick={createBranchNode}
          className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white p-2 rounded-full shadow-lg hover:bg-green-600 hover:shadow-xl transition-all z-[9999] animate-fadeIn"
          title="添加新分支"
        >
          <Plus size={16} />
        </button>
      )}

      {/* 文本选择后的按钮组 */}
      {showQuoteButton && (
        <div
          className="absolute flex gap-2 z-[9999] animate-fadeIn"
          style={{
            left: `${quoteButtonPosition.x}px`,
            top: `${quoteButtonPosition.y}px`,
            transform: 'translate(-50%, -100%)',
            marginTop: '-8px',
          }}
        >
          <button
            onClick={handleQuote}
            className="quote-button bg-blue-500 text-white px-3 py-1.5 rounded-md shadow-xl hover:bg-blue-600 hover:shadow-2xl transition-all flex items-center gap-1.5 text-xs font-medium"
          >
            <Quote size={14} />
            引用
          </button>
          {hasMultipleChildren && (
            <button
              onClick={handleAddBranchFromSelection}
              className="quote-button bg-green-500 text-white px-3 py-1.5 rounded-md shadow-xl hover:bg-green-600 hover:shadow-2xl transition-all flex items-center gap-1.5 text-xs font-medium"
            >
              <GitBranch size={14} />
              新分支
            </button>
          )}
        </div>
      )}
    </div>
  );
});

ChatNodeComponent.displayName = 'ChatNode';
