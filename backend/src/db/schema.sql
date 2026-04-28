-- OpenClaw Manager Database Schema

CREATE TABLE IF NOT EXISTS operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_operations_timestamp ON operations(timestamp);
CREATE INDEX IF NOT EXISTS idx_operations_service ON operations(service_name);

CREATE TABLE IF NOT EXISTS command_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,
  args TEXT,
  result_summary TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INTEGER
);

CREATE TABLE IF NOT EXISTS command_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL UNIQUE,
  alias TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  agent TEXT,
  service TEXT
);

CREATE INDEX IF NOT EXISTS idx_command_history_time ON command_history(executed_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

CREATE TABLE IF NOT EXISTS automation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  trigger_type TEXT NOT NULL,
  trigger_config TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_config TEXT NOT NULL,
  last_triggered TEXT,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  rule_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  result TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (rule_id) REFERENCES automation_rules(id)
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_time ON automation_logs(started_at);

CREATE TABLE IF NOT EXISTS agent_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  steps TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  agent_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS task_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  input_data TEXT,
  result TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (workflow_id) REFERENCES agent_workflows(id)
);

CREATE TABLE IF NOT EXISTS workspace_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace TEXT NOT NULL UNIQUE,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_access DATETIME,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  avg_session_duration_seconds INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  size_bytes INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skill_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill TEXT NOT NULL UNIQUE,
  use_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  avg_execution_time_ms INTEGER,
  last_used DATETIME,
  rating REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_status ON agent_workflows(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_priority ON task_queue(priority, status);
CREATE INDEX IF NOT EXISTS idx_workspace_stats_access ON workspace_stats(access_count);
CREATE INDEX IF NOT EXISTS idx_workspace_backups_workspace ON workspace_backups(workspace);
CREATE INDEX IF NOT EXISTS idx_skill_stats_use_count ON skill_stats(use_count);
CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp);
CREATE INDEX IF NOT EXISTS idx_command_history_status ON command_history(status);
CREATE INDEX IF NOT EXISTS idx_operations_type ON operations(operation_type);

CREATE TABLE IF NOT EXISTS health_check_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  config_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS health_check_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT NOT NULL,
  healthy INTEGER NOT NULL,
  response_time_ms INTEGER,
  details TEXT,
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_history_service ON health_check_history(service_name);
CREATE INDEX IF NOT EXISTS idx_health_history_time ON health_check_history(checked_at);