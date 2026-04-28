# OpenClaw Manager

> OpenClaw 智能体管理效率平台 - Web 可视化管理界面

[English](./README.en.md) | 中文

## 项目简介

OpenClaw Manager 是一个基于 Web 的可视化管理系统，用于管理和监控 WSL 环境中的 OpenClaw 智能体系统。提供直观的仪表盘界面，让你轻松管理 Agent、技能、工作区和自动化规则。

## ✨ 功能特性

### 🖥️ 核心功能

| 功能 | 说明 |
|------|------|
| **概览仪表盘** | 系统状态总览、Agent/Skill/Workspace 统计、快捷导航 |
| **服务管理** | Gateway/Canvas 启停重启、实时状态监控、PID/内存/运行时间 |
| **健康检查** | 自动检测服务存活状态、异常时自动恢复、可配置检查间隔 |
| **Agent 管理** | Agent 列表、详情展开、模型/会话/记忆/技能信息 |
| **技能系统** | 技能市场搜索安装（支持中英文）、GitHub 推荐、热门趋势、技能评估 |
| **配置管理** | 配置文件编辑、备份/还原、差异对比、导入/导出、热重载 |
| **模型管理** | 模型提供商检测、Agent 模型分配、别名管理 |
| **监控面板** | CPU/内存使用率、Agent 活跃度、会话统计、数据导出 |
| **记忆管理** | Agent 记忆条目、短期回忆、跨 Agent 搜索、WSL 诊断 |
| **多 Agent 协作** | Agent 间消息通信、广播、路由绑定、工作流编排 |
| **自动化引擎** | 定时/事件触发规则、预设模板、事件下拉选择、规则可读化 |
| **日志监控** | 操作日志实时推送 (SSE)、CSV 导出、服务状态通知 |
| **工作区管理** | 工作区扫描、切换、备份恢复、使用统计 |
| **命令面板** | Ctrl+K 快捷搜索、命令历史、收藏 |
| **帮助文档** | 11 章节详细文档、操作示例、快捷键 ? 打开 |

### 🌟 亮点功能

- **中文搜索支持** — 技能搜索自动翻译中文关键词为英文（40+ 映射），如输入"代码审查"自动搜索 "code review"
- **服务自动恢复** — 健康检查检测到服务停止时自动重启，支持冷却期和最大重试次数
- **数据导出** — 操作日志导出 CSV、监控数据导出 JSON、记忆数据导出 JSON
- **新手引导** — 首次使用引导 + 详细帮助文档面板，随时按 ? 查看
- **空状态兜底** — 监控数据空值安全处理、WSL 不可用时友好提示、Agent 列表三级降级

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + TanStack Query |
| UI | Tailwind CSS + Framer Motion + Lucide Icons |
| 后端 | Express.js + TypeScript + Helmet + Rate Limiting |
| 数据库 | SQLite (better-sqlite3) + WAL 模式 |
| 集成 | WSL + Python 3 |
| 部署 | PM2 + GitHub Actions CI |

## 🚀 快速开始

### 前置条件

- Node.js >= 18
- WSL (Windows Subsystem for Linux)
- Python 3
- OpenClaw 已安装并初始化

### 安装

```bash
# 克隆仓库
git clone https://github.com/zhaoqunliu5-commits/openclaw-manager.git
cd openclaw-manager

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 配置

创建 `backend/.env`（参考 `backend/.env.example`）:
```env
PORT=3001
API_KEY=openclaw-manager-2026
OPENCLAW_PATH=/home/用户名/.openclaw
WORKSPACES_PATH=/home/用户名/workspaces
```

创建 `frontend/.env`（参考 `frontend/.env.example`）:
```env
VITE_API_BASE_URL=http://localhost:3001/api
```

### 启动

```bash
# 方式一：开发模式（推荐）
# 终端 1: 启动后端
cd backend
npm run dev

# 终端 2: 启动前端
cd frontend
npm run dev

# 方式二：生产模式
cd backend && npm run build && node dist/index.js
cd frontend && npm run build && npx serve dist

# 方式三：PM2 一键启动
npm install -g pm2
pm2 start ecosystem.config.json
```

访问 http://localhost:5177

## 📁 项目结构

```
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── routes/            # API 路由 (23个)
│   │   ├── services/          # 业务逻辑 (19个)
│   │   ├── middleware/        # 中间件 (认证/错误处理)
│   │   ├── db/                # 数据库 Schema
│   │   └── types/             # TypeScript 类型定义
│   ├── tests/                 # 测试文件
│   └── .env.example           # 环境变量示例
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/        # React 组件 (24个)
│   │   ├── api/               # API 服务层
│   │   ├── hooks/             # 自定义 Hooks
│   │   ├── types/             # TypeScript 类型定义
│   │   └── utils/             # 工具函数 (导出等)
│   └── .env.example           # 环境变量示例
├── scripts/                    # 辅助脚本
├── .github/workflows/          # CI/CD
├── ecosystem.config.json       # PM2 配置
└── start.ps1                   # Windows 启动脚本
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+K` | 打开命令面板 |
| `Ctrl+1~9` | 切换功能面板 |
| `Ctrl+R` | 刷新页面 |
| `Esc` | 关闭当前面板 |
| `?` | 打开帮助文档 |

## 🔐 API 认证

所有 API 请求需要携带 Header:
```
x-api-key: your-api-key
```

## 🤝 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 📄 License

[MIT License](LICENSE)
