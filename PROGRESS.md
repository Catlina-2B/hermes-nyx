# Hermes Desktop Companion — Progress

> 本文件由 AI agent 持续更新。每个会话开始时先读此文件了解进度，结束时更新。

## 当前状���

- **阶段**: Phase 1 进行中 (1/4 完成)
- **下一步**: F002 — Python 后端生命周期管理
- **分支**: `feat/electron-shell` (完成后合并到 main)
- **最后更新**: 2026-04-27

## 已完成的功能

| ID | 功能 | 完成日期 | Commit |
|----|------|---------|--------|
| — | hermes-webui 前端完成 (chat, log, todo, VRM avatar) | 2026-04-27 | 67fe7f2 |
| — | Canvas ��拽特效 + 流式布局 | 2026-04-27 | ae159bb |
| — | 流式布局 bug 修复（todo 溢出） | 2026-04-27 | 7f7e479 |
| F001 | Electron 项目��手架 | 2026-04-27 | b09c4b9 |

## 未完成的功能

按优先级排序，每次会话选��高优先级的 **一个** 功能完成：

~~1. **F001** — Electron 项目脚手架~~ ✅
2. **F002** — Python 后端生命周期管理
3. **F003** — 主 WebUI 窗口
4. **F004** — 系统托盘
5. **F005** — 透明悬浮窗口
6. **F006** — Vite 多页面 + Companion 入口
7. **F007** — 悬浮窗拖拽
8. **F008** — 对话气泡
9. **F009** — 全局快捷键
10. **F010** — Spotlight 窗口
11. **F011** — Spotlight UI
12. **F012** — 屏幕截图服务
13. **F013** — 后端截图分析 API
14. **F014** — 定时截屏循环
15. **F015** — macOS .app 打包

## 项目结构

```
hermes-webui/
├── backend/           # Python FastAPI 后端
│   ├── main.py        # FastAPI 入口，uvicorn 8081 端口
│   ├── chat_manager.py
│   ├── log_monitor.py
│   ├── todo_store.py
│   └── requirements.txt
├── frontend/          # Vite + React + TypeScript 前端
│   ├── src/
│   │   ├── App.tsx            # 主布局（流式布局 + Canvas 特效）
│   │   ├── components/        # ChatPanel, LogPanel, TodoPanel, etc.
│   │   ├── hooks/             # useChat, useLogs, useFreeDrag, etc.
│   │   ├── plugins/           # VRM digital human 插件
│   │   └── lib/               # fluid-layout, drag-effects
│   ├── public/models/         # VRM 模型文件
│   └── dist/                  # Build 产物
├── electron/          # [待创建] Electron 主进程
├── features.json      # 功能清单 + 通过状态追踪
├── PROGRESS.md        # 本文件 — 进度追踪
├── init.sh            # [待创建] 一键环境恢复脚本
└── start.sh           # 开发模式启动脚本
```

## 关键技术决策

- **Electron** 作为桌面壳（需要 desktopCapturer、globalShortcut、透明窗口）
- **Python child_process** — Electron spawn uvicorn，依赖系统 Python 3.10+
- **Vite 多页面** — main WebUI + companion.html + spotlight.html
- **3 个窗口**: 主窗口、AI 人物悬浮窗、Spotlight 输入框
- 详细设计见 `docs/superpowers/specs/2026-04-27-electron-companion-design.md`

## 接手说明

新 AI agent 接手时：

1. 运行 `cat PROGRESS.md` 了解当前进度
2. 运行 `cat features.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(f['id'],f['name'],'✅' if f['passes'] else '❌') for p in d['phases'] for f in p['features']]"` 查看功能状态
3. 运行 `bash init.sh`（如存在）恢复开发环境
4. 查看 git log 了解最近改动
5. 从"未完成的功能"列表中选最高优先级的 **一个** 开始
6. 完成后更新本文件和 features.json，提交
