// 引用内容类型
export interface QuotedContent {
  text: string;
  nodeId: string;
  sourceType: 'user' | 'assistant'; // 引用来源类型
  fullContext?: string; // 完整的上下文（整个消息内容）
}

// 聊天节点类型定义
export interface ChatNode {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'input' | 'loading' | 'conversation';
  content: string;
  parentId: string | null;
  children: string[];
  model: string;
  timestamp: number;
  position: { x: number; y: number };
  // 对话节点特有字段
  userMessage?: string;
  assistantMessage?: string;
  // 引用内容
  quotedContent?: QuotedContent;
}

// 聊天会话类型定义
export interface ChatSession {
  id: string;
  title: string;
  nodes: Record<string, ChatNode>;
  rootNodeId: string;
  createdAt: number;
  updatedAt: number;
  defaultModelId?: string; // 会话默认模型ID
}

// AI模型配置
export interface ModelConfig {
  id: string;
  name: string; // 模型显示名称
  provider: 'openai' | 'anthropic' | 'deepseek' | 'local' | 'custom';
  apiProtocol?: 'openai' | 'anthropic' | 'ollama'; // API协议类型（用于自定义服务商）
  model: string;
  apiKey?: string;
  baseURL?: string;
  temperature: number;
  maxTokens: number;
  isDefault?: boolean;
  createdAt: number;
}

// AI消息格式
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
