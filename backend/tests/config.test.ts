import { describe, it, expect } from 'vitest';
import { appConfig } from '../src/config.js';

describe('App Config', () => {
  it('should have openclawPath defined', () => {
    expect(appConfig.openclawPath).toBeDefined();
    expect(appConfig.openclawPath).toContain('.openclaw');
  });

  it('should have workspacesPath defined', () => {
    expect(appConfig.workspacesPath).toBeDefined();
  });

  it('should generate correct agent directory paths', () => {
    const agentDir = appConfig.getAgentDir('test-agent');
    expect(agentDir).toContain('test-agent');
    expect(agentDir).toContain('agents');
  });

  it('should generate correct session directory paths', () => {
    const sessionsDir = appConfig.getAgentSessionsDir('my-agent');
    expect(sessionsDir).toContain('my-agent');
    expect(sessionsDir).toContain('sessions');
  });

  it('should generate correct memory directory paths', () => {
    const memDir = appConfig.getAgentMemoryDir('my-agent');
    expect(memDir).toContain('my-agent');
    expect(memDir).toContain('memory');
  });

  it('should generate correct skill directory paths', () => {
    const skillDir = appConfig.getSkillDir('my-skill');
    expect(skillDir).toContain('my-skill');
    expect(skillDir).toContain('skills');
  });

  it('should have configJson path', () => {
    expect(appConfig.configJson).toContain('openclaw.json');
  });

  it('should have backup directory path', () => {
    expect(appConfig.getBackupDir()).toContain('backups');
  });
});
