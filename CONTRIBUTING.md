# 贡献指南

感谢你的关注！欢迎为 OpenClaw Manager 贡献代码。

## 开发环境

1. Node.js >= 18
2. WSL (Windows Subsystem for Linux)
3. Python 3

## 开发流程

1. Fork 本仓库
2. 创建分支: `git checkout -b feature/your-feature`
3. 安装依赖: `npm install`
4. 开发调试: `npm run dev`
5. 提交代码: `git commit -m 'feat: 添加新功能'`
6. 推送分支: `git push origin feature/your-feature`
7. 创建 Pull Request

## 代码规范

- 使用 TypeScript
- 遵循现有的代码风格
- 添加适当的类型注解
- 为新功能添加测试（如有）

## 提交信息格式

```
<type>: <subject>

<body>
```

类型 (type):
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具
