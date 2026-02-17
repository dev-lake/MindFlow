# MindChat - AI聊天客户端实现计划

## 项目概述
构建一个基于思维导图的AI聊天客户端，支持多模型切换，使用树形结构可视化对话分支。

## 技术栈
- **前端框架**: React 18 + TypeScript
- **可视化**: ReactFlow (节点图编辑器)
- **状态管理**: Zustand (轻量级状态管理)
- **样式**: Tailwind CSS + shadcn/ui (现代化UI组件)
- **构建工具**: Vite
- **AI集成**: 支持多模型 (OpenAI, Anthropic Claude, 本地模型)

## 核心功能模块

### 1. 项目初始化
**文件结构:**
```
MindChat/
├── src/
│   ├── components/          # React组件
│   │   ├── ChatNode/       # 聊天节点组件
│   │   ├── FlowCanvas/     # ReactFlow画布
│   │   ├── Sidebar/        # 侧边栏（模型选择、设置）
│   │   └── MessageInput/   # 消息输入框
│   ├── stores/             # Zustand状态管理
│   │   ├── chatStore.ts    # 聊天状态
│   │   └── settingsStore.ts # 设置状态
│   ├── services/           # API服务
│   │   ├── openai.ts       # OpenAI集成
│   │   ├── anthropic.ts    # Claude集成
│   │   └── local.ts        # 本地模型集成
│   ├── types/              # TypeScript类型定义
│   ├── utils/              # 工具函数
│   └── App.tsx             # 主应用
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

**依赖包:**
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "reactflow": "^11.11.0",
    "zustand": "^4.5.0",
    "openai": "^4.28.0",
    "@anthropic-ai/sdk": "^0.17.0",
    "axios": "^1.6.7"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.1.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

### 2. 数据结构设计

**ChatNode (聊天节点):**
```typescript
interface ChatNode {
  id: string;                    // 唯一标识
  type: 'user' | 'assistant';    // 消息类型
  content: string;               // 消息内容
  parentId: string | null;       // 父节点ID
  children: string[];            // 子节点ID列表
  model: string;                 // 使用的AI模型
  timestamp: number;             // 时间戳
  position: { x: number; y: number }; // ReactFlow位置
}
```

**ChatSession (会话):**
```typescript
interface ChatSession {
  id: string;
  title: string;
  nodes: Map<string, ChatNode>;  // 节点映射
  rootNodeId: string;            // 根节点ID
  createdAt: number;
  updatedAt: number;
}
```

**ModelConfig (模型配置):**
```typescript
interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'local';
  model: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}
```

### 3. ReactFlow集成

**核心实现:**
- 自定义ChatNode组件，显示消息内容
- 从任意节点创建新分支
- 自动布局算法（树形布局）
- 节点拖拽、缩放、平移
- 高亮当前对话路径

**关键功能:**
```typescript
// 从节点创建新分支
function createBranch(parentNodeId: string, userMessage: string) {
  // 1. 创建用户消息节点
  // 2. 调用AI API获取回复
  // 3. 创建AI回复节点
  // 4. 更新ReactFlow布局
}

// 自动布局算法
function autoLayout(nodes: ChatNode[]) {
  // 使用树形布局算法计算节点位置
  // 考虑节点大小、间距、层级
}
```

### 4. 多模型支持

**实现策略:**
- 统一的API接口抽象
- 支持运行时切换模型
- 每个节点记录使用的模型
- 配置管理（API密钥、参数）

**API抽象层:**
```typescript
interface AIProvider {
  sendMessage(
    messages: Array<{role: string; content: string}>,
    config: ModelConfig
  ): Promise<string>;
}

class OpenAIProvider implements AIProvider { ... }
class AnthropicProvider implements AIProvider { ... }
class LocalProvider implements AIProvider { ... }
```

### 5. 状态管理 (Zustand)

**chatStore:**
- 当前会话
- 节点树数据
- 选中的节点
- 对话历史路径

**settingsStore:**
- 模型配置
- UI设置（主题、字体大小）
- API密钥管理

### 6. UI/UX设计

**主界面布局:**
```
┌─────────────────────────────────────────┐
│  [Logo] MindChat    [模型选择] [设置]    │
├─────────────────────────────────────────┤
│                                         │
│         ReactFlow Canvas                │
│      (思维导图式对话树)                  │
│                                         │
│  ┌─────┐     ┌─────┐                   │
│  │User │────▶│ AI  │                   │
│  └─────┘     └─────┘                   │
│                │                        │
│           ┌────┴────┐                  │
│           ▼         ▼                  │
│        ┌─────┐  ┌─────┐               │
│        │ AI  │  │ AI  │               │
│        └─────┘  └─────┘               │
│                                         │
├─────────────────────────────────────────┤
│  [输入框: 输入消息...]        [发送]    │
└─────────────────────────────────────────┘
```

**交互流程:**
1. 点击任意节点激活该节点
2. 在输入框输入消息
3. 点击发送，从该节点创建新分支
4. AI回复自动添加为子节点
5. 可以从任意AI回复继续对话

### 7. 本地存储

**实现方案:**
- 使用IndexedDB存储会话数据
- 支持导出/导入会话（JSON格式）
- 自动保存（防止数据丢失）

### 8. 高级功能（可选）

- **会话管理**: 多会话切换、重命名、删除
- **搜索功能**: 在对话树中搜索内容
- **导出功能**: 导出为Markdown、PNG图片
- **快捷键**: 键盘快捷操作
- **主题切换**: 明暗主题
- **节点编辑**: 编辑历史消息，重新生成回复

## 实现步骤

### Phase 1: 项目搭建 (基础架构)
1. 初始化Vite + React + TypeScript项目
2. 配置Tailwind CSS
3. 安装ReactFlow和Zustand
4. 创建基础文件结构
5. 设置TypeScript类型定义

### Phase 2: 核心功能 (最小可用版本)
1. 实现ChatNode组件
2. 集成ReactFlow画布
3. 实现基础的节点创建和连接
4. 集成OpenAI API（单模型）
5. 实现消息输入和发送
6. 实现简单的树形布局

### Phase 3: 多模型支持
1. 设计API抽象层
2. 集成Anthropic Claude
3. 集成本地模型支持（Ollama）
4. 实现模型选择UI
5. 实现配置管理

### Phase 4: 优化和完善
1. 实现自动布局算法
2. 添加本地存储（IndexedDB）
3. 实现会话管理
4. 优化UI/UX
5. 添加快捷键支持
6. 性能优化

### Phase 5: 高级功能
1. 搜索功能
2. 导出功能
3. 主题切换
4. 节点编辑
5. 更多AI模型支持

## 技术难点和解决方案

### 1. 树形布局算法
**挑战**: 自动计算节点位置，避免重叠
**方案**: 使用Dagre或自定义树形布局算法

### 2. 对话上下文管理
**挑战**: 从任意节点发起对话时，需要构建正确的上下文
**方案**: 从选中节点向上遍历到根节点，构建完整对话历史

### 3. 性能优化
**挑战**: 大量节点时的渲染性能
**方案**:
- ReactFlow内置虚拟化
- 懒加载历史会话
- 节点内容截断显示

### 4. API密钥安全
**挑战**: 前端存储API密钥的安全性
**方案**:
- 本地加密存储
- 建议用户使用环境变量
- 可选：构建Electron版本，更安全的密钥管理

## 预期成果

一个功能完整的AI聊天客户端，具备：
- ✅ 思维导图式的对话可视化
- ✅ 支持从任意节点创建分支对话
- ✅ 多AI模型支持和切换
- ✅ 本地数据持久化
- ✅ 现代化的UI设计
- ✅ 良好的用户体验

## 开发时间估算

- Phase 1: 项目搭建 - 基础架构完成
- Phase 2: 核心功能 - 最小可用版本完成
- Phase 3: 多模型支持 - 完整功能实现
- Phase 4: 优化和完善 - 生产就绪
- Phase 5: 高级功能 - 增强版本

## 后续扩展方向

1. **Electron打包**: 打包为桌面应用
2. **协作功能**: 多人共享对话树
3. **插件系统**: 支持自定义AI模型和功能
4. **移动端适配**: 响应式设计或独立移动应用
5. **云同步**: 跨设备同步会话数据
