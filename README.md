# MindFlow - AI思维导图聊天客户端

一个基于React和ReactFlow构建的AI聊天客户端，使用思维导图的形式展示对话分支。

## 功能特性

- 🌳 **思维导图式对话**: 以节点图的形式可视化对话树
- 🔀 **分支对话**: 从任意节点创建新的对话分支
- 🤖 **多模型支持**: 支持OpenAI、Anthropic Claude和本地模型
- 💾 **本地存储**: 配置自动保存到浏览器
- 🎨 **现代化UI**: 基于Tailwind CSS的简洁界面

## 技术栈

- React 18 + TypeScript
- ReactFlow (节点图可视化)
- Zustand (状态管理)
- Tailwind CSS (样式)
- Vite (构建工具)

## 快速开始

### 安装依赖

```bash
npm install
# 或
pnpm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 使用说明

1. **配置AI模型**
   - 点击右上角设置按钮
   - 选择AI服务商（OpenAI/Anthropic/本地模型）
   - 输入API密钥（如需要）
   - 配置模型参数

2. **开始对话**
   - 点击任意节点选中它
   - 在底部输入框输入消息
   - 按Enter发送（Shift+Enter换行）
   - AI回复会自动添加为子节点

3. **创建分支**
   - 点击任意历史节点
   - 输入新消息
   - 从该节点创建新的对话分支

## 项目结构

```
src/
├── components/          # React组件
│   ├── ChatNode/       # 聊天节点组件
│   ├── FlowCanvas/     # ReactFlow画布
│   ├── Sidebar/        # 设置侧边栏
│   └── MessageInput/   # 消息输入框
├── stores/             # Zustand状态管理
│   ├── chatStore.ts    # 聊天状态
│   └── settingsStore.ts # 设置状态
├── services/           # API服务
│   └── ai.ts           # AI服务集成
├── types/              # TypeScript类型
└── App.tsx             # 主应用
```

## 支持的AI模型

### OpenAI
- GPT-4, GPT-3.5-turbo等
- 需要OpenAI API密钥

### Anthropic Claude
- Claude 3系列模型
- 需要Anthropic API密钥

### 本地模型
- 支持Ollama等本地运行的模型
- 默认地址: http://localhost:11434

## 开发计划

详见 [PLAN.md](./PLAN.md)

## License

MIT
