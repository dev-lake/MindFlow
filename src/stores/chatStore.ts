import { create } from 'zustand';
import { ChatSession, ChatNode, QuotedContent } from '../types';
import { sessionAPI } from '../services/api';
import { useSettingsStore } from './settingsStore';
import { autoLayout } from '../utils/layoutUtils';

interface ChatStore {
  sessions: Record<string, ChatSession>;
  currentSessionId: string | null;
  currentSession: ChatSession | null;
  selectedNodeId: string | null;
  quotedContent: QuotedContent | null;
  isLoading: boolean;

  // 会话管理
  loadSessions: () => Promise<void>;
  createSession: () => Promise<void>;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
  updateSessionDefaultModel: (sessionId: string, modelId: string) => Promise<void>;

  // 初始化新会话（保留向后兼容）
  initSession: () => Promise<void>;

  // 添加节点
  addNode: (node: ChatNode) => Promise<void>;

  // 更新节点
  updateNode: (nodeId: string, updates: Partial<ChatNode>, saveToDb?: boolean) => Promise<void>;

  // 删除节点
  deleteNode: (nodeId: string) => Promise<void>;

  // 保存当前会话到数据库
  saveCurrentSession: () => Promise<void>;

  // 选择节点
  selectNode: (nodeId: string) => void;

  // 设置引用内容
  setQuotedContent: (content: QuotedContent | null) => void;

  // 获取从根到选中节点的路径
  getConversationPath: () => ChatNode[];

  // 重新排列节点
  rearrangeNodes: () => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: {},
  currentSessionId: null,
  currentSession: null,
  selectedNodeId: null,
  quotedContent: null,
  isLoading: false,

  loadSessions: async () => {
    try {
      set({ isLoading: true });
      const sessions = await sessionAPI.getAllSessions();
      const sessionsMap = sessions.reduce((acc, session) => {
        acc[session.id] = session;
        return acc;
      }, {} as Record<string, ChatSession>);

      set({ sessions: sessionsMap, isLoading: false });

      // 如果有会话但没有当前会话，选择最新的
      if (sessions.length > 0 && !get().currentSessionId) {
        const latestSession = sessions[0];
        set({
          currentSessionId: latestSession.id,
          currentSession: latestSession,
          selectedNodeId: latestSession.rootNodeId,
        });
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      set({ isLoading: false });
    }
  },

  createSession: async () => {
    const rootNode: ChatNode = {
      id: 'root',
      type: 'input',
      content: '',
      parentId: null,
      children: [],
      model: '',
      timestamp: Date.now(),
      position: { x: 250, y: 50 },
    };

    const sessionId = `session-${Date.now()}`;

    // 获取全局默认模型
    const defaultModelConfig = useSettingsStore.getState().defaultModelConfig;

    const session: ChatSession = {
      id: sessionId,
      title: '新对话',
      nodes: { root: rootNode },
      rootNodeId: 'root',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      defaultModelId: defaultModelConfig?.id, // 设置会话默认模型为全局默认模型
    };

    try {
      await sessionAPI.createSession(session);
      set({
        sessions: { ...get().sessions, [sessionId]: session },
        currentSessionId: sessionId,
        currentSession: session,
        selectedNodeId: 'root',
      });
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  },

  switchSession: (sessionId: string) => {
    const { sessions } = get();
    const session = sessions[sessionId];
    if (session) {
      set({
        currentSessionId: sessionId,
        currentSession: session,
        selectedNodeId: session.rootNodeId,
        quotedContent: null,
      });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await sessionAPI.deleteSession(sessionId);

      const { sessions, currentSessionId } = get();
      const newSessions = { ...sessions };
      delete newSessions[sessionId];

      // 如果删除的是当前会话，切换到其他会话或创建新会话
      if (currentSessionId === sessionId) {
        const remainingSessions = Object.keys(newSessions);
        if (remainingSessions.length > 0) {
          const nextSessionId = remainingSessions[0];
          set({
            sessions: newSessions,
            currentSessionId: nextSessionId,
            currentSession: newSessions[nextSessionId],
            selectedNodeId: newSessions[nextSessionId].rootNodeId,
          });
        } else {
          // 没有剩余会话，创建新会话
          set({ sessions: newSessions });
          await get().createSession();
        }
      } else {
        set({ sessions: newSessions });
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  },

  updateSessionTitle: async (sessionId: string, title: string) => {
    const { sessions, currentSessionId } = get();
    const session = sessions[sessionId];
    if (session) {
      const updatedSession = { ...session, title, updatedAt: Date.now() };

      try {
        await sessionAPI.updateSession(updatedSession);
        const newSessions = { ...sessions, [sessionId]: updatedSession };

        set({
          sessions: newSessions,
          currentSession: currentSessionId === sessionId ? updatedSession : get().currentSession,
        });
      } catch (error) {
        console.error('Failed to update session title:', error);
      }
    }
  },

  updateSessionDefaultModel: async (sessionId: string, modelId: string) => {
    const { sessions, currentSessionId } = get();
    const session = sessions[sessionId];
    if (session) {
      const updatedSession = { ...session, defaultModelId: modelId, updatedAt: Date.now() };

      try {
        await sessionAPI.updateSession(updatedSession);
        const newSessions = { ...sessions, [sessionId]: updatedSession };

        set({
          sessions: newSessions,
          currentSession: currentSessionId === sessionId ? updatedSession : get().currentSession,
        });
      } catch (error) {
        console.error('Failed to update session default model:', error);
      }
    }
  },

  initSession: async () => {
    // 加载所有会话
    await get().loadSessions();

    // 如果没有会话，创建一个
    const { sessions } = get();
    if (Object.keys(sessions).length === 0) {
      await get().createSession();
    }
  },

  addNode: async (node: ChatNode) => {
    const { currentSession, currentSessionId, sessions } = get();
    if (!currentSession || !currentSessionId) return;

    const updatedNodes = { ...currentSession.nodes, [node.id]: node };

    // 更新父节点的children
    if (node.parentId && updatedNodes[node.parentId]) {
      updatedNodes[node.parentId] = {
        ...updatedNodes[node.parentId],
        children: [...updatedNodes[node.parentId].children, node.id],
      };
    }

    const updatedSession = {
      ...currentSession,
      nodes: updatedNodes,
      updatedAt: Date.now(),
    };

    try {
      await sessionAPI.updateSession(updatedSession);
      set({
        sessions: { ...sessions, [currentSessionId]: updatedSession },
        currentSession: updatedSession,
      });
    } catch (error) {
      console.error('Failed to add node:', error);
    }
  },

  updateNode: async (nodeId: string, updates: Partial<ChatNode>, saveToDb: boolean = true) => {
    const { currentSession, currentSessionId, sessions } = get();
    if (!currentSession || !currentSessionId || !currentSession.nodes[nodeId]) return;

    const updatedNodes = {
      ...currentSession.nodes,
      [nodeId]: {
        ...currentSession.nodes[nodeId],
        ...updates,
      },
    };

    const updatedSession = {
      ...currentSession,
      nodes: updatedNodes,
      updatedAt: Date.now(),
    };

    // 立即更新本地状态
    set({
      sessions: { ...sessions, [currentSessionId]: updatedSession },
      currentSession: updatedSession,
    });

    // 可选：保存到数据库
    if (saveToDb) {
      try {
        await sessionAPI.updateSession(updatedSession);
      } catch (error) {
        console.error('Failed to update node in database:', error);
      }
    }
  },

  deleteNode: async (nodeId: string) => {
    const { currentSession, currentSessionId, sessions } = get();
    if (!currentSession || !currentSessionId || !currentSession.nodes[nodeId]) return;

    const nodeToDelete = currentSession.nodes[nodeId];
    const updatedNodes = { ...currentSession.nodes };

    // 从父节点的children中移除
    if (nodeToDelete.parentId && updatedNodes[nodeToDelete.parentId]) {
      updatedNodes[nodeToDelete.parentId] = {
        ...updatedNodes[nodeToDelete.parentId],
        children: updatedNodes[nodeToDelete.parentId].children.filter(id => id !== nodeId),
      };
    }

    // 删除节点本身
    delete updatedNodes[nodeId];

    // 递归删除所有子节点
    const deleteChildren = (id: string) => {
      const node = updatedNodes[id];
      if (node && node.children) {
        node.children.forEach(childId => {
          deleteChildren(childId);
          delete updatedNodes[childId];
        });
      }
    };
    nodeToDelete.children.forEach(childId => deleteChildren(childId));

    const updatedSession = {
      ...currentSession,
      nodes: updatedNodes,
      updatedAt: Date.now(),
    };

    try {
      await sessionAPI.updateSession(updatedSession);
      set({
        sessions: { ...sessions, [currentSessionId]: updatedSession },
        currentSession: updatedSession,
        selectedNodeId: nodeToDelete.parentId || currentSession.rootNodeId,
      });
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  },

  saveCurrentSession: async () => {
    const { currentSession, currentSessionId } = get();
    if (!currentSession || !currentSessionId) return;

    try {
      await sessionAPI.updateSession(currentSession);
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  },

  selectNode: (nodeId: string) => {
    set({ selectedNodeId: nodeId });
  },

  setQuotedContent: (content: QuotedContent | null) => {
    set({ quotedContent: content });
  },

  getConversationPath: () => {
    const { currentSession, selectedNodeId } = get();
    if (!currentSession || !selectedNodeId) return [];

    const path: ChatNode[] = [];
    let currentId: string | null = selectedNodeId;

    while (currentId) {
      const node: ChatNode | undefined = currentSession.nodes[currentId];
      if (!node) break;

      // 对于conversation类型的节点，需要展开为用户和助手消息
      if (node.type === 'conversation' && node.userMessage && node.assistantMessage) {
        // 添加用户消息
        const userNode: ChatNode = {
          ...node,
          type: 'user',
          content: node.userMessage,
        };
        path.unshift(userNode);

        // 添加助手消息
        const assistantNode: ChatNode = {
          ...node,
          type: 'assistant',
          content: node.assistantMessage,
        };
        path.unshift(assistantNode);
      } else if (node.type !== 'system' && node.type !== 'input') {
        path.unshift(node);
      }

      currentId = node.parentId;
    }

    return path.filter(node => node.type === 'user' || node.type === 'assistant');
  },

  rearrangeNodes: async () => {
    const { currentSession, currentSessionId, sessions } = get();
    if (!currentSession || !currentSessionId) return;

    // 使用自动布局算法计算新位置
    const newPositions = autoLayout(currentSession.nodes, currentSession.rootNodeId);

    // 更新所有节点的位置
    const updatedNodes = { ...currentSession.nodes };
    Object.keys(newPositions).forEach(nodeId => {
      if (updatedNodes[nodeId]) {
        updatedNodes[nodeId] = {
          ...updatedNodes[nodeId],
          position: newPositions[nodeId],
        };
      }
    });

    const updatedSession = {
      ...currentSession,
      nodes: updatedNodes,
      updatedAt: Date.now(),
    };

    try {
      await sessionAPI.updateSession(updatedSession);
      set({
        sessions: { ...sessions, [currentSessionId]: updatedSession },
        currentSession: updatedSession,
      });
    } catch (error) {
      console.error('Failed to rearrange nodes:', error);
    }
  },
}));
