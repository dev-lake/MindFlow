import Database from 'better-sqlite3';
import { ChatSession, ModelConfig } from '../src/types/index.js';

const db = new Database('mindchat.db');

// 初始化数据库表
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    nodes TEXT NOT NULL,
    rootNodeId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS model_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    apiKey TEXT,
    baseURL TEXT,
    temperature REAL NOT NULL,
    maxTokens INTEGER NOT NULL,
    isDefault INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL
  )
`);

// 检查并添加缺失的列（用于数据库迁移）
try {
  // 检查 model_configs 表是否存在
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='model_configs'").all() as any[];

  if (tables.length > 0) {
    // 表存在，检查列
    const tableInfo = db.prepare("PRAGMA table_info(model_configs)").all() as any[];
    const columnNames = tableInfo.map((col: any) => col.name);

    const requiredColumns = ['id', 'name', 'provider', 'model', 'apiKey', 'baseURL', 'temperature', 'maxTokens', 'isDefault', 'createdAt'];
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));

    if (missingColumns.length > 0) {
      console.log('Migrating model_configs table: recreating with all columns');

      // 备份现有数据
      const existingData = db.prepare('SELECT * FROM model_configs').all();

      // 删除旧表
      db.exec('DROP TABLE model_configs');

      // 重新创建表
      db.exec(`
        CREATE TABLE model_configs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          apiKey TEXT,
          baseURL TEXT,
          temperature REAL NOT NULL,
          maxTokens INTEGER NOT NULL,
          isDefault INTEGER NOT NULL DEFAULT 0,
          createdAt INTEGER NOT NULL
        )
      `);

      // 恢复数据（如果有）
      if (existingData.length > 0) {
        const insertStmt = db.prepare(`
          INSERT INTO model_configs (id, name, provider, model, apiKey, baseURL, temperature, maxTokens, isDefault, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const row of existingData as any[]) {
          insertStmt.run(
            row.id,
            row.name || 'Unnamed Model',
            row.provider,
            row.model,
            row.apiKey || null,
            row.baseURL || null,
            row.temperature,
            row.maxTokens,
            row.isDefault || 0,
            row.createdAt || Date.now()
          );
        }
      }
    }
  }
} catch (error) {
  console.error('Migration error:', error);
}

export interface SessionRow {
  id: string;
  title: string;
  nodes: string;
  rootNodeId: string;
  createdAt: number;
  updatedAt: number;
}

// 获取所有会话
export function getAllSessions(): ChatSession[] {
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY updatedAt DESC');
  const rows = stmt.all() as SessionRow[];

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    nodes: JSON.parse(row.nodes),
    rootNodeId: row.rootNodeId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

// 获取单个会话
export function getSession(id: string): ChatSession | null {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  const row = stmt.get(id) as SessionRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    nodes: JSON.parse(row.nodes),
    rootNodeId: row.rootNodeId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// 创建会话
export function createSession(session: ChatSession): void {
  const stmt = db.prepare(`
    INSERT INTO sessions (id, title, nodes, rootNodeId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    session.id,
    session.title,
    JSON.stringify(session.nodes),
    session.rootNodeId,
    session.createdAt,
    session.updatedAt
  );
}

// 更新会话
export function updateSession(session: ChatSession): void {
  const stmt = db.prepare(`
    UPDATE sessions
    SET title = ?, nodes = ?, rootNodeId = ?, updatedAt = ?
    WHERE id = ?
  `);

  stmt.run(
    session.title,
    JSON.stringify(session.nodes),
    session.rootNodeId,
    session.updatedAt,
    session.id
  );
}

// 删除会话
export function deleteSession(id: string): void {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  stmt.run(id);
}

// ========== 模型配置相关 ==========

export interface ModelConfigRow {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string | null;
  baseURL: string | null;
  temperature: number;
  maxTokens: number;
  isDefault: number;
  createdAt: number;
}

// 获取所有模型配置
export function getAllModelConfigs(): ModelConfig[] {
  const stmt = db.prepare('SELECT * FROM model_configs ORDER BY createdAt DESC');
  const rows = stmt.all() as ModelConfigRow[];

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    provider: row.provider as ModelConfig['provider'],
    model: row.model,
    apiKey: row.apiKey || undefined,
    baseURL: row.baseURL || undefined,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    isDefault: row.isDefault === 1,
    createdAt: row.createdAt,
  }));
}

// 获取单个模型配置
export function getModelConfig(id: string): ModelConfig | null {
  const stmt = db.prepare('SELECT * FROM model_configs WHERE id = ?');
  const row = stmt.get(id) as ModelConfigRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    provider: row.provider as ModelConfig['provider'],
    model: row.model,
    apiKey: row.apiKey || undefined,
    baseURL: row.baseURL || undefined,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    isDefault: row.isDefault === 1,
    createdAt: row.createdAt,
  };
}

// 获取默认模型配置
export function getDefaultModelConfig(): ModelConfig | null {
  const stmt = db.prepare('SELECT * FROM model_configs WHERE isDefault = 1 LIMIT 1');
  const row = stmt.get() as ModelConfigRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    provider: row.provider as ModelConfig['provider'],
    model: row.model,
    apiKey: row.apiKey || undefined,
    baseURL: row.baseURL || undefined,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    isDefault: row.isDefault === 1,
    createdAt: row.createdAt,
  };
}

// 创建模型配置
export function createModelConfig(config: ModelConfig): void {
  const stmt = db.prepare(`
    INSERT INTO model_configs (id, name, provider, model, apiKey, baseURL, temperature, maxTokens, isDefault, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    config.id,
    config.name,
    config.provider,
    config.model,
    config.apiKey || null,
    config.baseURL || null,
    config.temperature,
    config.maxTokens,
    config.isDefault ? 1 : 0,
    config.createdAt
  );
}

// 更新模型配置
export function updateModelConfig(config: ModelConfig): void {
  const stmt = db.prepare(`
    UPDATE model_configs
    SET name = ?, provider = ?, model = ?, apiKey = ?, baseURL = ?, temperature = ?, maxTokens = ?, isDefault = ?
    WHERE id = ?
  `);

  stmt.run(
    config.name,
    config.provider,
    config.model,
    config.apiKey || null,
    config.baseURL || null,
    config.temperature,
    config.maxTokens,
    config.isDefault ? 1 : 0,
    config.id
  );
}

// 设置默认模型
export function setDefaultModelConfig(id: string): void {
  // 先取消所有默认设置
  db.prepare('UPDATE model_configs SET isDefault = 0').run();
  // 设置新的默认模型
  db.prepare('UPDATE model_configs SET isDefault = 1 WHERE id = ?').run(id);
}

// 删除模型配置
export function deleteModelConfig(id: string): void {
  const stmt = db.prepare('DELETE FROM model_configs WHERE id = ?');
  stmt.run(id);
}

export default db;
