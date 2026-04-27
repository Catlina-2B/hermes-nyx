# Hermes Desktop Companion — Progress

> 本文件由 AI agent 持续更新。每个会话开始时先读此文件了解进度，结束时更新。

## 当前状态

- **阶段**: 全部 4 个阶段完成 ✅
- **下一步**: 无 — 所有 15 个功能已实现
- **分支**: `feat/electron-shell` (待合并到 main)
- **最后更新**: 2026-04-27

## 已完成的功能

| ID | 功能 | 完成日期 | Commit |
|----|------|---------|--------|
| — | hermes-webui 前端完成 | 2026-04-27 | 67fe7f2 |
| — | Canvas 拖拽特效 + 流式布局 | 2026-04-27 | ae159bb |
| F001 | Electron 项目脚手架 | 2026-04-27 | b09c4b9 |
| F002 | Python 后端生命周期管理 | 2026-04-27 | 1b33d08 |
| F003 | 主 WebUI 窗口 | 2026-04-27 | 1b33d08 |
| F004 | 系统托盘 | 2026-04-27 | 1b33d08 |
| F005 | 透明悬浮窗口 | 2026-04-27 | 8b171a1 |
| F006 | Vite 多页面 + Companion 入口 | 2026-04-27 | 8b171a1 |
| F007 | 悬浮窗拖拽 | 2026-04-27 | 8b171a1 |
| F008 | 对话气泡 | 2026-04-27 | 8b171a1 |
| F009 | 全局快捷键 | 2026-04-27 | 2f72549 |
| F010 | Spotlight 窗口 | 2026-04-27 | 2f72549 |
| F011 | Spotlight UI | 2026-04-27 | 2f72549 |
| F012 | 屏幕截图服务 | 2026-04-27 | ddd469b |
| F013 | 后端截图分析 API | 2026-04-27 | ddd469b |
| F014 | 定时截屏循环 | 2026-04-27 | ddd469b |
| F015 | macOS .app 打包 | 2026-04-27 | ddd469b |

## 测试

- **后端**: 13 tests passing (companion module + API endpoints)
- **前端**: 20 tests passing (fluid-layout + drag-effects)
- **总计**: 33 tests, all passing

运行测试:
```bash
# Backend
cd backend && source venv/bin/activate && python -m pytest tests/ -v

# Frontend
cd frontend && npx vitest run
```

## 打包

```bash
# 构建前端
cd frontend && npx vite build

# 打包 .app
cd electron && npx electron-builder --dir

# 产出
electron/dist/mac-arm64/Hermes.app
```

## 项目结构

```
hermes-webui/
├── backend/                # Python FastAPI 后端
│   ├── main.py             # FastAPI 入口 + companion API endpoints
│   ├── companion.py        # 截图分析 (vision model)
│   ├── chat_manager.py
│   ├── tests/              # pytest 测试
│   └── requirements.txt
├── frontend/               # Vite + React + TypeScript
│   ├── index.html          # 主 WebUI 入口
│   ├── companion.html      # AI 人物悬浮窗入口
│   ├── spotlight.html      # Spotlight 输入框入口
│   ├── src/
│   │   ├── App.tsx         # 主布局 (流式 + Canvas 特效)
│   │   ├── companion/      # CompanionApp (VRM 人物 + 气泡)
│   │   ├── spotlight/      # SpotlightApp (输入框)
│   │   ├── __tests__/      # vitest 测试
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── plugins/        # VRM digital human
│   │   └── lib/            # fluid-layout, drag-effects
│   └── dist/               # Build 产物
├── electron/               # Electron 主进程
│   ├── main.js             # 窗口管理 + 后端 spawn + 截屏 + 快捷键
│   ├── preload.js          # IPC bridge
│   └── package.json        # electron-builder 配置
├── features.json           # 功能追踪 (15/15 ✅)
├── PROGRESS.md             # 本文件
└── init.sh                 # 环境恢复脚本
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Cmd+Shift+H | 唤出/隐藏 Spotlight 输入框 |
| Cmd+Shift+S | 立即截屏分析 |

## 接手说明

所有功能已完成。后续可优化:
- 应用图标 (.icns)
- 代码签名
- 自动更新
- 更多 AI 表情/动画联动
- 截屏隐私控制
