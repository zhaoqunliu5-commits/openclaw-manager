import { useEffect, useCallback } from 'react';

export function useHotkeys(
  activePanel: string | null,
  setActivePanel: React.Dispatch<React.SetStateAction<string | null>>,
  setCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>,
) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setCommandPaletteOpen(true);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      window.location.reload();
      return;
    }

    if (e.key === 'Escape') {
      if (activePanel) {
        setActivePanel(null);
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const PANEL_KEYS: Record<string, string> = {
        '1': 'agents', '2': 'models', '3': 'monitor', '4': 'config-manage',
        '5': 'skill-enhance', '6': 'memory', '7': 'collaboration', '8': 'settings',
        '9': 'automation',
      };
      const panel = PANEL_KEYS[e.key];
      if (panel) {
        e.preventDefault();
        setActivePanel(prev => prev === panel ? null : panel);
      }
    }
  }, [activePanel, setActivePanel, setCommandPaletteOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const HOTKEY_LIST: { keys: string; description: string }[] = [
  { keys: 'Ctrl+K', description: '打开/关闭命令面板' },
  { keys: 'Ctrl+1', description: 'Agent 面板' },
  { keys: 'Ctrl+2', description: '模型面板' },
  { keys: 'Ctrl+3', description: '监控面板' },
  { keys: 'Ctrl+4', description: '配置管理' },
  { keys: 'Ctrl+5', description: '技能增强' },
  { keys: 'Ctrl+6', description: '记忆管理' },
  { keys: 'Ctrl+7', description: '多Agent协作' },
  { keys: 'Ctrl+8', description: '设置中心' },
  { keys: 'Ctrl+R', description: '刷新页面' },
  { keys: 'Esc', description: '关闭当前面板' },
];
