# 修复说明：首个节点响应内容显示问题

## 问题描述
首个节点（root节点）在发送消息后，AI的响应内容没有正确显示。

## 问题原因
1. **频繁的数据库写入**：每次流式更新都会调用 `updateNode`，触发数据库保存
2. **竞态条件**：多个异步数据库更新可能导致状态不一致
3. **性能问题**：流式响应时每个 chunk 都写入数据库，造成不必要的开销

## 解决方案

### 1. 修改 `updateNode` 函数
添加可选参数 `saveToDb`，控制是否立即保存到数据库：

```typescript
updateNode: async (nodeId: string, updates: Partial<ChatNode>, saveToDb: boolean = true)
```

- 立即更新本地状态（React 组件立即看到变化）
- 可选择是否保存到数据库

### 2. 添加 `saveCurrentSession` 函数
手动保存当前会话到数据库：

```typescript
saveCurrentSession: async () => Promise<void>
```

### 3. 优化流式更新逻辑
在 ChatNode 组件中：

```typescript
// 流式更新时不保存到数据库
await sendAIMessage(messages, modelConfig, (chunk) => {
  streamedContent += chunk;
  updateNode(conversationNodeId, {
    assistantMessage: streamedContent,
  }, false);  // 不保存到数据库
});

// 完成后一次性保存
await updateNode(conversationNodeId, {
  assistantMessage: streamedContent,
  timestamp: Date.now(),
}, true);  // 保存到数据库
```

### 4. 改进 hasAssistant 判断
```typescript
const hasAssistant = node.assistantMessage !== undefined && node.assistantMessage !== '';
```

## 优势

1. **性能提升**：减少数据库写入次数（从数百次降到1次）
2. **避免竞态**：本地状态立即更新，数据库异步保存
3. **更好的用户体验**：流式响应更流畅，无延迟
4. **数据一致性**：完成后统一保存，避免中间状态

## 测试步骤

1. 创建新会话
2. 在首个输入节点输入消息
3. 发送消息
4. 观察：
   - ✅ 用户消息立即显示
   - ✅ AI响应流式显示（逐字出现）
   - ✅ 完成后内容完整保存
   - ✅ 刷新页面后内容保持

## 文件修改

- `src/stores/chatStore.ts`
  - 修改 `updateNode` 函数签名
  - 添加 `saveCurrentSession` 函数

- `src/components/ChatNode/index.tsx`
  - 修改流式更新逻辑
  - 改进 `hasAssistant` 判断

---

**修复时间**: 2026-02-16
**状态**: ✅ 已修复
