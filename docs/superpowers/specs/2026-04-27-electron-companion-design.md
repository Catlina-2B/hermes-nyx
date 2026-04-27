# Hermes Desktop Companion — Design Spec

## Goal

将 hermes-webui 打包为 macOS Electron 桌面应用，具备：AI 人物屏幕悬浮、实时陪伴（定时截屏+AI分析）、Spotlight 式快捷输入框。

## Architecture

```
Electron Main Process
├── Python Backend Manager (child_process → uvicorn)
├── Window Manager (3 windows)
├── Screen Capture Service (desktopCapturer)
├── Global Shortcut (Cmd+Shift+H)
└── Tray Icon

Window 1: Main WebUI
  └── 现有 hermes-webui 前端 (served by FastAPI static)

Window 2: Spotlight Input
  └── 透明无边框居中窗口，快捷键唤出/隐藏

Window 3: AI Companion (floating)
  └── 透明无边框置顶窗口，VRM 人物 + 对话气泡，可拖拽

Python FastAPI Backend (child process)
├── 现有 endpoints (/api/chat, /ws/chat, /api/todos, etc.)
├── NEW: POST /api/companion/analyze (接收截图 base64 → vision model 分析)
└── NEW: GET /api/companion/status (陪伴模式状态)
```

## Phases

### Phase 1: Electron Shell + Backend Spawning

**目标：** Electron 启动 → 自动启动 Python 后端 → 加载主 WebUI

- `electron/` 目录放在项目根目录
- `electron/main.js` — Electron 主进程入口
- `electron/preload.js` — 预加载脚本
- 启动时创建 venv（如不存在）、pip install、启动 uvicorn
- 等待后端 health check 通过后加载前端
- 退出时 kill 后端进程
- 系统托盘图标（显示/隐藏/退出）

### Phase 2: AI 人物悬浮窗

**目标：** 透明无边框置顶窗口，VRM 人物可拖拽到屏幕任意位置

- `Window 3` — transparent, frameless, alwaysOnTop, resizable: false
- 加载独立的 `/companion.html` 页面（只渲染 VRM 人物 + 对话气泡）
- 前端新增 `src/companion/` 目录：
  - `CompanionApp.tsx` — 轻量入口，只有 VRM 人物 + 气泡
  - `companion-entry.tsx` — Vite 多页面入口
- 窗口拖拽：通过 `-webkit-app-region: drag` 或 pointer event + IPC
- 对话气泡：AI 主动说话时显示，几秒后自动消失
- 通过 WebSocket 连接后端，接收 AI 主动消息

### Phase 3: Spotlight 输入框

**目标：** `Cmd+Shift+H` 唤出悬浮输入框，输入后发送给 AI

- `Window 2` — transparent, frameless, 居中显示，宽 600px 高 60px
- 快捷键切换显示/隐藏
- 输入框样式：毛玻璃背景 + 赛博朋克风格
- 回车发送消息到 `/api/chat`
- AI 回复展示在输入框下方（临时展开）
- 点击其他地方或 ESC 隐藏
- 发送的消息同步到主窗口聊天历史

### Phase 4: 实时陪伴（截屏 + AI 分析）

**目标：** 定时截屏 → AI 分析用户在做什么 → 根据情况主动交流

- Electron main process 使用 `desktopCapturer` 获取屏幕截图
- 首次使用时请求 macOS Screen Recording 权限
- 用户在 AI 人物右键菜单中开启/关闭陪伴模式
- 间隔可配置（默认 5 分钟）
- 截图缩放为合理分辨率（如 1280px 宽）后转 base64
- 发送到 `POST /api/companion/analyze`
- 后端调用 vision model（OpenAI gpt-4o / Claude）分析截图
- AI 决定是否主动说话 → 推送到 WebSocket → 悬浮窗显示气泡
- 用户也可以快捷键触发立即截屏分析

## Tech Decisions

- **Electron** — 提供 desktopCapturer、globalShortcut、透明窗口等原生能力
- **electron-builder** — 打包为 .app
- **Vite 多页面** — 主 WebUI + companion 页面共享组件
- **Python child_process** — Electron 启动时 spawn uvicorn，依赖系统 Python
- **IPC** — Electron main ↔ renderer 通信（截屏、快捷键、窗口控制）

## 打包产物

```
Hermes.app/
├── Contents/
│   ├── MacOS/Hermes (Electron binary)
│   ├── Resources/
│   │   ├── app/ (Electron + built frontend)
│   │   ├── backend/ (Python source)
│   │   ├── requirements.txt
│   │   └── models/ (VRM files)
│   └── Info.plist (含 Screen Recording 权限声明)
```

用户需要系统已安装 Python 3.10+。首次启动自动创建 venv 并安装依赖。
