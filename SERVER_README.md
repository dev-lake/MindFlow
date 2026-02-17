# MindChat 后端数据库集成

## 功能说明

已将会话数据从浏览器 localStorage 迁移到后端 SQLite 数据库，实现真正的数据持久化。

## 技术栈

- **后端框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **语言**: TypeScript
- **API**: RESTful API

## 启动说明

### 1. 同时启动前端和后端（推荐）
```bash
npm run dev:all
```

### 2. 单独启动后端
```bash
npm run dev:server
```

### 3. 单独启动前端
```bash
npm run dev
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 获取所有会话 |
| GET | `/api/sessions/:id` | 获取单个会话 |
| POST | `/api/sessions` | 创建新会话 |
| PUT | `/api/sessions/:id` | 更新会话 |
| DELETE | `/api/sessions/:id` | 删除会话 |
| GET | `/api/health` | 健康检查 |

## 数据库

- **类型**: SQLite
- **文件**: `mindchat.db`
- **位置**: 项目根目录
- **表结构**:
  ```sql
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    nodes TEXT NOT NULL,
    rootNodeId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )
  ```

## 端口配置

- **前端**: http://localhost:5174
- **后端**: http://localhost:3001

## 文件结构

```
MindChat/
├── server/
│   ├── index.ts          # Express 服务器
│   └── database.ts       # 数据库操作
├── src/
│   ├── services/
│   │   └── api.ts        # API 客户端
│   └── stores/
│       └── chatStore.ts  # 状态管理（已更新为使用 API）
└── mindchat.db           # SQLite 数据库文件
```

## 注意事项

1. 数据库文件 `mindchat.db` 会自动创建
2. 首次启动时会自动初始化数据库表
3. 所有会话数据都保存在数据库中，不再使用 localStorage
4. 后端使用 nodemon 监听文件变化，修改代码后会自动重启

## 开发提示

- 修改后端代码后，nodemon 会自动重新编译和重启服务器
- 修改前端代码后，Vite 会自动热更新
- 数据库文件已添加到 `.gitignore`，不会提交到版本控制

