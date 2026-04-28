import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { OperationLog } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface CommandHistoryRecord {
  id: number;
  command: string;
  args: string | null;
  result_summary: string | null;
  status: string;
  executed_at: string;
  execution_time_ms: number | null;
}

export interface CommandFavoriteRecord {
  id: number;
  command: string;
  alias: string | null;
  created_at: string;
}

export interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: number;
  agent: string | null;
  service: string | null;
}

export class DbService {
  private db: Database.Database;

  getDb(): Database.Database {
    return this.db;
  }

  constructor() {
    // 确保 data 目录存在
    const dataDir = join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = join(dataDir, 'openclaw-manager.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.initializeTables();
  }

  private initializeTables() {
    const schemaPath = join(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
  }

  /**
   * 记录操作日志
   */
  logOperation(operation: Omit<OperationLog, 'id' | 'timestamp'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO operations (operation_type, service_name, status, message, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      operation.operationType,
      operation.serviceName,
      operation.status,
      operation.message,
      operation.metadata || null
    );
    return Number(result.lastInsertRowid);
  }

  /**
   * 获取操作历史
   */
  getOperations(limit: number = 50): OperationLog[] {
    const stmt = this.db.prepare(`
      SELECT id, operation_type as operationType, service_name as serviceName,
             status, message, timestamp, metadata
      FROM operations
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as OperationLog[];
    return rows.map(row => ({
      id: row.id,
      operationType: row.operationType,
      serviceName: row.serviceName,
      status: row.status,
      message: row.message,
      timestamp: row.timestamp,
      metadata: row.metadata
    }));
  }

  /**
   * 获取单条操作记录
   */
  getOperationById(id: number): OperationLog | null {
    const stmt = this.db.prepare(`
      SELECT id, operation_type as operationType, service_name as serviceName,
             status, message, timestamp, metadata
      FROM operations
      WHERE id = ?
    `);
    const row = stmt.get(id) as OperationLog | undefined;
    if (!row) return null;
    return {
      id: row.id,
      operationType: row.operationType,
      serviceName: row.serviceName,
      status: row.status,
      message: row.message,
      timestamp: row.timestamp,
      metadata: row.metadata
    };
  }

  /**
   * 关闭数据库连接
   */
  close() {
    this.db.close();
  }

  addCommandHistory(command: string, args?: string, resultSummary?: string, status: string = 'success', executionTimeMs?: number): number {
    const stmt = this.db.prepare(
      `INSERT INTO command_history (command, args, result_summary, status, execution_time_ms) VALUES (?, ?, ?, ?, ?)`
    );
    const result = stmt.run(command, args || null, resultSummary || null, status, executionTimeMs || null);
    return Number(result.lastInsertRowid);
  }

  getCommandHistory(limit: number = 50): CommandHistoryRecord[] {
    const stmt = this.db.prepare(
      `SELECT * FROM command_history ORDER BY executed_at DESC LIMIT ?`
    );
    return stmt.all(limit) as CommandHistoryRecord[];
  }

  clearCommandHistory(): number {
    const result = this.db.prepare(`DELETE FROM command_history`).run();
    return result.changes;
  }

  addCommandFavorite(command: string, alias?: string): boolean {
    try {
      this.db.prepare(`INSERT INTO command_favorites (command, alias) VALUES (?, ?)`).run(command, alias || null);
      return true;
    } catch {
      return false;
    }
  }

  removeCommandFavorite(command: string): boolean {
    const result = this.db.prepare(`DELETE FROM command_favorites WHERE command = ?`).run(command);
    return result.changes > 0;
  }

  getCommandFavorites(): CommandFavoriteRecord[] {
    return this.db.prepare(`SELECT * FROM command_favorites ORDER BY created_at DESC`).all() as CommandFavoriteRecord[];
  }

  saveNotification(n: { id: string; type: string; title: string; message: string; timestamp: string; read: number; agent?: string; service?: string }): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO notifications (id, type, title, message, timestamp, read, agent, service) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(n.id, n.type, n.title, n.message, n.timestamp, n.read, n.agent || null, n.service || null);
  }

  getNotifications(limit: number = 50): NotificationRecord[] {
    return this.db.prepare(`SELECT * FROM notifications ORDER BY timestamp DESC LIMIT ?`).all(limit) as NotificationRecord[];
  }

  markNotificationRead(id: string): boolean {
    const result = this.db.prepare(`UPDATE notifications SET read = 1 WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  markAllNotificationsRead(): void {
    this.db.prepare(`UPDATE notifications SET read = 1`).run();
  }

  getUnreadNotificationCount(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE read = 0`).get() as { count: number };
    return row.count;
  }

  clearNotifications(): void {
    this.db.prepare(`DELETE FROM notifications`).run();
  }
}

export const dbService = new DbService();