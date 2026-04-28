# CLAUDE.md - AI 开发助手指南

## 项目概述

OpenClaw Manager 是一个管理 OpenClaw 智能体的 Web 可视化平台。

## 技术栈

- **前端**: React 18 + TypeScript + TanStack Query + Tailwind CSS + Framer Motion
- **后端**: Express.js + TypeScript + SQLite
- **WSL 集成**: Python 3 脚本通过 Base64 编码执行

## 目录结构

```
backend/src/
├── routes/          # Express 路由 (22个端点)
├── services/        # 业务逻辑 (18个服务)
├── middleware/      # 认证、错误处理
└── db/              # SQLite Schema

frontend/src/
├── components/      # React 组件 (20个)
├── api/             # API 调用层
└── hooks/            # 自定义 Hooks
```

## 关键约定

### API 认证
- 所有请求需要 Header: `x-api-key: openclaw-manager-2026`
- 位于 `backend/src/middleware/auth.ts`

### WSL 集成
- 使用 `WslService.execCommand()` 执行 WSL 命令
- Python 脚本通过 Base64 编码传输：`printf '%s' '${b64}' | base64 -d > /tmp/script.py`
- Python 脚本路径：`/tmp/oc_*.py`

### 数据缓存
- 使用 `DataCache` 服务进行内存缓存
- 默认 TTL: 120 秒
- 位于 `backend/src/services/dataCache.ts`

### 数据库
- SQLite 数据库：`backend/data/openclaw-manager.db`
- Schema: `backend/src/db/schema.sql`
- 使用 `better-sqlite3` 同步 API

### 配置文件路径 (WSL)
- OpenClaw 路径: `/home/afan/.openclaw`
- 工作区路径: `/home/afan/workspaces`

## 开发命令

```bash
# 后端
cd backend
npm run dev      # 开发模式 (tsx watch)
npm run build    # 编译

# 前端
cd frontend
npm run dev      # 开发服务器 (Vite)
npm run build    # 生产构建
```

## 注意事项

1. **Windows/WSL 混合开发**: 命令执行需要通过 WSL
2. **sessions.json 格式**: 是 dict 而非 list，格式为 `{key: {sessionId, ...}}`
3. **Python 脚本超时**: 建议设置 30-60 秒超时
4. **缓存失效**: 修改 WSL 数据后需要清除缓存
