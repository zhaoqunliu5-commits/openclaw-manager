import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class WslService {
  /**
   * 在 WSL 中执行命令（通过 bash -c 包裹，确保重定向等 shell 语法在 WSL 内解析）
   */
  static async execCommand(command: string, timeout: number = 30000): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(
        `wsl -- bash -c "${command.replace(/"/g, '\\"')}"`,
        { timeout }
      );
      return stdout + stderr;
    } catch (error: any) {
      if (error.stdout || error.stderr) {
        return (error.stdout || '') + (error.stderr || '');
      }
      console.error('WSL command error:', error);
      throw new Error(`WSL command failed: ${error.message}`);
    }
  }

  /**
   * 在 WSL 中启动后台守护进程
   */
  static async execDaemon(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const escapedCmd = command.replace(/"/g, '\\"');
      const fullCommand = `wsl -- bash -c "setsid ${escapedCmd} >/dev/null 2>&1 &"`;
      console.log('🚀 Launching daemon:', fullCommand);

      const child = spawn('cmd.exe', ['/c', fullCommand], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });

      child.unref();

      child.on('error', (err) => {
        console.error('❌ Daemon spawn error:', err);
        reject(err);
      });

      setTimeout(() => {
        resolve();
      }, 1000);
    });
  }

  /**
   * 检查 WSL 是否可用
   */
  static async isWslAvailable(): Promise<boolean> {
    try {
      await this.execCommand('echo test');
      return true;
    } catch {
      return false;
    }
  }

  static async writeFile(path: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('wsl', ['--', 'bash', '-c', `cat > "${path}"`], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`WSL write file failed: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`WSL write file failed with code ${code}: ${stderr}`));
        }
      });

      child.stdin?.write(content);
      child.stdin?.end();
    });
  }

  /**
   * 列出目录内容
   */
  static async listDirectory(path: string): Promise<string[]> {
    try {
      const output = await this.execCommand(`ls -1 "${path}" 2>/dev/null`);
      const lines = output.trim().split('\n').filter(line => line.trim());
      return lines;
    } catch {
      return [];
    }
  }

  /**
   * 读取文件内容
   */
  static async readFile(path: string): Promise<string> {
    try {
      const output = await this.execCommand(`cat "${path}" 2>/dev/null`);
      return output;
    } catch {
      return '';
    }
  }

  /**
   * 检查 systemd 服务是否活跃
   */
  static async isSystemdServiceActive(serviceName: string): Promise<boolean> {
    try {
      const output = await this.execCommand(`systemctl --user is-active ${serviceName} 2>/dev/null || true`);
      return output.trim() === 'active';
    } catch {
      return false;
    }
  }

  /**
   * 检查进程是否运行（使用 ps + grep，排除 grep 自身）
   */
  static async isProcessRunning(processName: string): Promise<{ isRunning: boolean; pid?: number; memory?: string; uptime?: string }> {
    try {
      const psOutput = await this.execCommand(
        `ps aux | grep -E '${processName}' | grep -v grep | head -1 || true`
      );
      if (!psOutput.trim()) {
        return { isRunning: false };
      }

      const parts = psOutput.trim().split(/\s+/);
      if (parts.length < 2) {
        return { isRunning: false };
      }

      const pid = parseInt(parts[1]);
      if (isNaN(pid)) {
        return { isRunning: false };
      }

      try {
        const detailOutput = await this.execCommand(`ps -p ${pid} -o pid=,rss=,etime= 2>/dev/null || true`);
        if (detailOutput.trim()) {
          const detailParts = detailOutput.trim().split(/\s+/);
          if (detailParts.length >= 3) {
            const rss = parseInt(detailParts[1]) || 0;
            const memory = `${(rss / 1024).toFixed(1)} MB`;
            const uptime = detailParts[2];
            return { isRunning: true, pid, memory, uptime };
          }
        }
      } catch {
        // 忽略详情获取错误
      }

      return { isRunning: true, pid };
    } catch {
      return { isRunning: false };
    }
  }

  /**
   * 停止进程
   */
  static async killProcess(processName: string): Promise<boolean> {
    try {
      try {
        await this.execCommand(`pkill -f '${processName}' || true`);
      } catch {
        // pkill 可能返回非零退出码（如信号杀掉自身），这是正常的
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      const result = await this.isProcessRunning(processName);
      return !result.isRunning;
    } catch {
      return false;
    }
  }
}