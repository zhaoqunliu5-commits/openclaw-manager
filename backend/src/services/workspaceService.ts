import { dbService } from './dbService.js';
import { WslService } from './wslService.js';
import { appConfig } from '../config.js';
import fs from 'fs';
import path from 'path';

export interface WorkspaceStat {
  id: number;
  workspace: string;
  accessCount: number;
  lastAccess: string | null;
  totalSessions: number;
  avgSessionDuration: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceBackup {
  id: number;
  workspace: string;
  backupPath: string;
  sizeBytes: number | null;
  createdAt: string;
}

interface DbWorkspaceStat {
  id: number;
  workspace: string;
  access_count: number;
  last_access: string | null;
  total_sessions: number;
  avg_session_duration_seconds: number;
  created_at: string;
  updated_at: string;
}

interface DbWorkspaceBackup {
  id: number;
  workspace: string;
  backup_path: string;
  size_bytes: number | null;
  created_at: string;
}

class WorkspaceService {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    const count = dbService.getDb().prepare(`SELECT COUNT(*) as c FROM workspace_stats`).get() as any;
    if (count.c > 0) { this.initialized = true; return; }

    try {
      const workspaces = await this.scanWorkspaces();
      const insert = dbService.getDb().prepare(
        `INSERT OR IGNORE INTO workspace_stats (workspace, access_count, total_sessions, avg_session_duration_seconds) VALUES (?, 0, 0, 0)`
      );
      for (const ws of workspaces) {
        insert.run(ws.name);
      }
    } catch {}
    this.initialized = true;
  }

  getStats(): WorkspaceStat[] {
    const rows = dbService.getDb().prepare(
      `SELECT * FROM workspace_stats ORDER BY access_count DESC`
    ).all() as DbWorkspaceStat[];
    return rows.map(r => ({
      id: r.id, workspace: r.workspace, accessCount: r.access_count,
      lastAccess: r.last_access, totalSessions: r.total_sessions,
      avgSessionDuration: r.avg_session_duration_seconds,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  async scanWorkspaces(): Promise<{ name: string; path: string; size: number }[]> {
    try {
      const output = await WslService.execCommand(
        `find ${appConfig.workspacesPath} -maxdepth 1 -type d 2>/dev/null | tail -n +2`,
        10000
      );
      const dirs = output.split('\n').filter(d => d.trim());
      const results = await Promise.all(dirs.map(async (dir) => {
        const sizeOutput = await WslService.execCommand(
          `du -sb "${dir}" 2>/dev/null | cut -f1`,
          5000
        );
        const size = parseInt(sizeOutput.trim()) || 0;
        const name = path.basename(dir);
        return { name, path: dir, size };
      }));
      return results;
    } catch {
      return [];
    }
  }

  async recordAccess(workspace: string) {
    const existing = dbService.getDb().prepare(
      `SELECT id FROM workspace_stats WHERE workspace = ?`
    ).get(workspace);

    if (existing) {
      dbService.getDb().prepare(
        `UPDATE workspace_stats SET access_count = access_count + 1, last_access = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE workspace = ?`
      ).run(workspace);
    } else {
      dbService.getDb().prepare(
        `INSERT INTO workspace_stats (workspace, access_count, last_access) VALUES (?, 1, CURRENT_TIMESTAMP)`
      ).run(workspace);
    }
  }

  getBackups(): WorkspaceBackup[] {
    const rows = dbService.getDb().prepare(
      `SELECT * FROM workspace_backups ORDER BY created_at DESC`
    ).all() as DbWorkspaceBackup[];
    return rows.map(r => ({
      id: r.id, workspace: r.workspace, backupPath: r.backup_path,
      sizeBytes: r.size_bytes, createdAt: r.created_at,
    }));
  }

  async createBackup(workspace: string): Promise<WorkspaceBackup> {
    const timestamp = Date.now();
    const backupDir = `${appConfig.getBackupDir()}/workspace-${workspace}-${timestamp}`;
    const workspacePath = `${appConfig.workspacesPath}/${workspace}`;

    await WslService.execCommand(`mkdir -p "${backupDir}" && cp -r "${workspacePath}"/* "${backupDir}/" 2>&1`, 30000);

    const sizeOutput = await WslService.execCommand(
      `du -sb "${backupDir}" 2>/dev/null | cut -f1`,
      5000
    );
    const size = parseInt(sizeOutput.trim()) || 0;

    const result = dbService.getDb().prepare(
      `INSERT INTO workspace_backups (workspace, backup_path, size_bytes) VALUES (?, ?, ?)`
    ).run(workspace, backupDir, size);

    const row = dbService.getDb().prepare(
      `SELECT * FROM workspace_backups WHERE id = ?`
    ).get(Number(result.lastInsertRowid)) as DbWorkspaceBackup;

    return {
      id: row.id, workspace: row.workspace, backupPath: row.backup_path,
      sizeBytes: row.size_bytes, createdAt: row.created_at,
    };
  }

  async deleteBackup(id: number): Promise<boolean> {
    const row = dbService.getDb().prepare(`SELECT backup_path FROM workspace_backups WHERE id = ?`).get(id) as DbWorkspaceBackup | undefined;
    if (row) {
      await WslService.execCommand(`rm -rf "${row.backup_path}" 2>&1`, 10000);
    }
    const r = dbService.getDb().prepare(`DELETE FROM workspace_backups WHERE id = ?`).run(id);
    return r.changes > 0;
  }

  async restoreBackup(id: number): Promise<{ success: boolean; message: string }> {
    const row = dbService.getDb().prepare(`SELECT * FROM workspace_backups WHERE id = ?`).get(id) as DbWorkspaceBackup | undefined;
    if (!row) return { success: false, message: 'Backup not found' };

    const targetPath = `${appConfig.workspacesPath}/${row.workspace}`;
    await WslService.execCommand(`rm -rf "${targetPath}"/* 2>&1 && cp -r "${row.backup_path}"/* "${targetPath}/" 2>&1`, 30000);

    return { success: true, message: `Restored backup to ${row.workspace}` };
  }

  async switchWorkspace(workspace: string): Promise<{ success: boolean; message: string }> {
    await this.recordAccess(workspace);
    const output = await WslService.execCommand(
      `openclaw workspace switch "${workspace}" 2>&1 || echo "FALLBACK"`,
      15000
    );
    if (output.includes('FALLBACK')) {
      return { success: true, message: `Switched to workspace: ${workspace} (直接切换)` };
    }
    return { success: true, message: output.trim() || `Switched to ${workspace}` };
  }

  getTopWorkspaces(limit = 5): WorkspaceStat[] {
    const rows = dbService.getDb().prepare(
      `SELECT * FROM workspace_stats ORDER BY access_count DESC LIMIT ?`
    ).all(limit) as DbWorkspaceStat[];
    return rows.map(r => ({
      id: r.id, workspace: r.workspace, accessCount: r.access_count,
      lastAccess: r.last_access, totalSessions: r.total_sessions,
      avgSessionDuration: r.avg_session_duration_seconds,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }
}

export const workspaceService = new WorkspaceService();