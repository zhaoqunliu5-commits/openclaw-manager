# OpenClaw Manager

> OpenClaw 智能体管理效率平台 - Web 可视化管理界面

[English](./README.en.md) | 中文

## 项目简介

OpenClaw Manager 是一个基于 Web 的可视化管理系统，用于管理和监控 WSL 环境中的 OpenClaw 智能体系统。

## 功能特性

### 核心功能
- **概览仪表盘** - 系统状态总览、关键指标统计
- **服务管理** - OpenClaw 服务启停、状态监控
- **代理管理** - 代理列表、详情、模型配置
- **技能管理** - 技能列表、执行、搜索
- **配置管理** - 配置文件编辑、备份、恢复、差异对比
- **模型管理** - 模型提供商、代理模型分配
- **日志监控** - 系统日志、实时通知推送 (SSE)
- **工作区管理** - 工作区扫描、切换、备份恢复
- **监控面板** - 系统资源、代理活动、会话追踪

### 增强功能
- **自动化引擎** - 定时/事件触发的规则执行
- **技能评估** - 技能使用统计、成功率分析
- **GitHub 技能推荐** - 基于用户数据智能推荐
- **命令面板** - 快捷命令搜索与执行
- **记忆管理** - 代理记忆条目、会话列表

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + TanStack Query |
| UI | Tailwind CSS + Framer Motion |
| 后端 | Express.js + TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| 集成 | WSL + Python 3 |

## 快速开始

### 前置条件
- Node.js >= 18
- WSL (Windows Subsystem for Linux)
- Python 3

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

创建 `backend/.env`:
```env
PORT=3001
API_KEY=openclaw-manager-2026
OPENCLAW_PATH=/home/用户名/.openclaw
WORKSPACES_PATH=/home/用户名/workspaces
```

创建 `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:3001/api
```

### 启动

```bash
# 终端 1: 启动后端
cd backend
npm run build
node dist/index.js

# 终端 2: 启动前端
cd frontend
npm run dev
```

访问 http://localhost:5173

## 项目结构

```
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── routes/         # API 路由 (22个)
│   │   ├── services/        # 业务逻辑 (18个)
│   │   ├── middleware/      # 中间件
│   │   └── db/              # 数据库 Schema
│   └── tests/               # 测试文件
├── frontend/                 # 前端应用
│   ├── src/
│   │   ├── components/      # React 组件 (20个)
│   │   ├── api/             # API 服务层
│   │   └── hooks/           # 自定义 Hooks
│   └── dist/                # 构建输出
├── ecosystem.config.json    # PM2 配置
└── start.ps1               # Windows 启动脚本
```

## API 认证

所有 API 请求需要携带 Header:
```
x-api-key: openclaw-manager-2026
```

## 性能优化

- **缓存层** - 内存缓存，TTL 120 秒
- **请求去重** - 防止并发重复请求
- **前端优化** - 30-60 秒轮询间隔

## License

MIT License - see [LICENSE](LICENSE) 文件
