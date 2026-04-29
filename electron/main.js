const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, globalShortcut } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BACKEND_PORT = 8081;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const HEALTH_URL = `${BACKEND_URL}/api/health`;
const PROJECT_ROOT = path.resolve(__dirname, "..");
const IS_DEV = !app.isPackaged;

// Paths differ between dev and packaged
const BACKEND_DIR = IS_DEV
  ? path.join(PROJECT_ROOT, "backend")
  : path.join(process.resourcesPath, "backend");

// Writable user data dir for venv + data (packaged .app is read-only)
const USER_DATA_DIR = IS_DEV
  ? BACKEND_DIR
  : path.join(app.getPath("userData"), "backend-runtime");

const FRONTEND_DIST = IS_DEV
  ? path.join(PROJECT_ROOT, "frontend", "dist")
  : path.join(process.resourcesPath, "frontend-dist");

const FRONTEND_URL = BACKEND_URL; // FastAPI serves built frontend

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let mainWindow = null;
let companionWindow = null;
let spotlightWindow = null;
let tray = null;
let backendProcess = null;
let isQuitting = false;
let companionDragStart = null; // { winX, winY } at drag start
let companionTimerId = null;
let companionEnabled = false;
let companionIntervalMs = 1 * 60 * 1000; // 1 minute default
let reminderTimerId = null;
let reminderWindows = new Map(); // todoId -> BrowserWindow

// ---------------------------------------------------------------------------
// Python Backend
// ---------------------------------------------------------------------------

function findPython() {
  const fs = require("fs");
  // Check both venv paths (start.sh uses "venv", init.sh uses ".venv")
  for (const name of ["venv", ".venv"]) {
    const p = path.join(BACKEND_DIR, name, "bin", "python3");
    if (fs.existsSync(p)) return p;
  }
  return "python3"; // fallback to system python
}

function findVenvDir() {
  const fs = require("fs");
  // In dev, check backend dir for existing venv
  if (IS_DEV) {
    for (const name of ["venv", ".venv"]) {
      const p = path.join(BACKEND_DIR, name);
      if (fs.existsSync(path.join(p, "bin", "python3"))) return p;
    }
    return path.join(BACKEND_DIR, "venv");
  }
  // In packaged mode, use writable user data dir
  return path.join(USER_DATA_DIR, "venv");
}

function startBackend() {
  return new Promise((resolve, reject) => {
    // Use bash + source activate to match start.sh behavior
    const venvDir = findVenvDir();
    const activatePath = path.join(venvDir, "bin", "activate");
    const cmd = `source "${activatePath}" && uvicorn main:app --host 0.0.0.0 --port ${BACKEND_PORT}`;

    console.log(`[backend] Starting: bash -c '${cmd}'`);
    console.log(`[backend] CWD: ${BACKEND_DIR}`);

    backendProcess = spawn("bash", ["-c", cmd], {
      cwd: BACKEND_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        HERMES_FRONTEND_DIST: FRONTEND_DIST,
      },
    });

    backendProcess.stdout.on("data", (data) => {
      console.log(`[backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr.on("data", (data) => {
      console.log(`[backend:err] ${data.toString().trim()}`);
    });

    backendProcess.on("error", (err) => {
      console.error("[backend] Failed to start:", err.message);
      reject(err);
    });

    backendProcess.on("exit", (code) => {
      console.log(`[backend] Exited with code ${code}`);
      backendProcess = null;
      if (!isQuitting) {
        console.log("[backend] Unexpected exit, restarting in 2s...");
        setTimeout(() => startBackend().catch(console.error), 2000);
      }
    });

    // Poll health endpoint
    waitForHealth(resolve, reject, 60);
  });
}

function waitForHealth(resolve, reject, retries) {
  if (retries <= 0) {
    reject(new Error("Backend health check timed out"));
    return;
  }

  http.get(HEALTH_URL, (res) => {
    if (res.statusCode === 200) {
      console.log("[backend] Health check passed");
      resolve();
    } else {
      setTimeout(() => waitForHealth(resolve, reject, retries - 1), 500);
    }
  }).on("error", () => {
    setTimeout(() => waitForHealth(resolve, reject, retries - 1), 500);
  });
}

function stopBackend() {
  if (!backendProcess) return;
  console.log("[backend] Stopping...");
  backendProcess.kill("SIGTERM");
  // Force kill after 3s
  setTimeout(() => {
    if (backendProcess) {
      backendProcess.kill("SIGKILL");
      backendProcess = null;
    }
  }, 3000);
}

// ---------------------------------------------------------------------------
// Venv Setup (first run)
// ---------------------------------------------------------------------------

function ensureVenv() {
  return new Promise((resolve, reject) => {
    const venvPath = findVenvDir();
    const fs = require("fs");

    // Ensure writable directory exists
    fs.mkdirSync(path.dirname(venvPath), { recursive: true });

    if (fs.existsSync(path.join(venvPath, "bin", "python3"))) {
      console.log(`[setup] Venv exists at ${venvPath}, checking deps...`);
      installDeps().then(resolve).catch(reject);
      return;
    }

    console.log("[setup] Creating venv...");
    const proc = spawn("python3", ["-m", "venv", venvPath], {
      stdio: "inherit",
    });
    proc.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`venv creation failed with code ${code}`));
        return;
      }
      installDeps().then(resolve).catch(reject);
    });
    proc.on("error", reject);
  });
}

function installDeps() {
  return new Promise((resolve, reject) => {
    const pip = path.join(findVenvDir(), "bin", "pip");
    const reqFile = path.join(BACKEND_DIR, "requirements.txt");
    console.log("[setup] Installing Python dependencies...");

    const proc = spawn(pip, ["install", "-q", "-r", reqFile], {
      cwd: BACKEND_DIR,
      stdio: "inherit",
    });
    proc.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`pip install failed with code ${code}`));
        return;
      }
      console.log("[setup] Dependencies installed");
      resolve();
    });
    proc.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Hermes",
    backgroundColor: "#0a0e17",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 12, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(FRONTEND_URL);

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open DevTools in dev mode
  if (IS_DEV) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

// ---------------------------------------------------------------------------
// Companion Window (AI character floating)
// ---------------------------------------------------------------------------

function createCompanionWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  companionWindow = new BrowserWindow({
    width: 400,
    height: 500,
    x: screenW - 440,
    y: screenH - 540,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load companion page
  const companionURL = `${BACKEND_URL}/companion.html`;

  companionWindow.loadURL(companionURL);
  companionWindow.setVisibleOnAllWorkspaces(true);

  companionWindow.on("closed", () => {
    companionWindow = null;
  });

  console.log("[companion] Window created");
}

// ---------------------------------------------------------------------------
// Companion IPC (window dragging)
// ---------------------------------------------------------------------------

function setupCompanionIPC() {
  ipcMain.on("companion:drag-start", () => {
    if (!companionWindow) return;
    const [x, y] = companionWindow.getPosition();
    companionDragStart = { winX: x, winY: y };
  });

  ipcMain.on("companion:drag-move", (_event, deltaX, deltaY) => {
    if (!companionWindow || !companionDragStart) return;
    if (typeof deltaX !== "number" || typeof deltaY !== "number") return;
    companionWindow.setPosition(
      Math.round(companionDragStart.winX + deltaX),
      Math.round(companionDragStart.winY + deltaY),
    );
  });

  ipcMain.on("companion:drag-end", () => {
    companionDragStart = null;
  });

  // Companion mode IPC
  ipcMain.on("companion:toggle", async () => {
    companionEnabled = !companionEnabled;
    console.log(`[companion] Mode ${companionEnabled ? "enabled" : "disabled"}`);
    if (companionEnabled) {
      startCompanionLoop();
    } else {
      stopCompanionLoop();
    }
    broadcastCompanionState();
  });

  // Update companion interval from WebUI (minutes)
  ipcMain.on("companion:set-interval", (_event, minutes) => {
    const mins = Math.max(1, Math.min(30, Number(minutes) || 1));
    companionIntervalMs = mins * 60 * 1000;
    console.log(`[companion] Interval set to ${mins}min`);
    // Restart loop if active
    if (companionEnabled) {
      startCompanionLoop();
    }
  });

  ipcMain.on("companion:capture-now", async () => {
    console.log("[companion] Manual capture requested");
    await captureAndAnalyze();
  });

  // Forward directives from any window to companion
  ipcMain.on("companion:send-directive", (_event, directive) => {
    if (companionWindow) {
      companionWindow.webContents.send("companion:message", { directive });
    }
  });

  // Avatar location switching: "desktop" or "webui"
  ipcMain.on("avatar:switch", (_event, location) => {
    console.log(`[avatar] Switching to: ${location}`);
    if (location === "desktop") {
      if (!companionWindow) createCompanionWindow();
      else companionWindow.show();
    } else if (location === "webui") {
      if (companionWindow) companionWindow.hide();
    }
    // Notify all windows about the switch
    if (mainWindow) mainWindow.webContents.send("avatar:switched", location);
    if (companionWindow) companionWindow.webContents.send("avatar:switched", location);
  });

  // Capture screen + answer question (for Spotlight context-aware queries)
  ipcMain.handle("companion:capture-and-ask", async (_event, question) => {
    console.log(`[companion] Context query: ${question}`);
    const imageBase64 = await captureScreen();
    if (!imageBase64) return { answer: "无法获取屏幕内容" };

    try {
      const response = await fetch(`${BACKEND_URL}/api/companion/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64, question }),
      });
      if (!response.ok) return { answer: `请求失败: ${response.status}` };
      return await response.json();
    } catch (err) {
      return { answer: `分析失败: ${err.message}` };
    }
  });

  // Spotlight IPC
  ipcMain.on("spotlight:hide", () => {
    if (spotlightWindow) spotlightWindow.hide();
  });

  ipcMain.on("spotlight:expand", () => {
    if (spotlightWindow) {
      spotlightWindow.setSize(600, 420);
    }
  });

  // Reminder dismiss
  ipcMain.on("reminder:dismiss", async (_event, todoId) => {
    console.log(`[reminder] Dismissed: ${todoId}`);
    // Mark as reminded in backend
    try {
      await fetch(`${BACKEND_URL}/api/todos/${todoId}/reminded`, { method: "POST" });
    } catch (e) {
      console.error("[reminder] Failed to mark reminded:", e.message);
    }
    // Close the reminder window
    const win = reminderWindows.get(todoId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    reminderWindows.delete(todoId);
  });
}

// ---------------------------------------------------------------------------
// Screen Capture + Companion Loop
// ---------------------------------------------------------------------------

async function captureScreen() {
  // Use the main window's renderer process to capture via getDisplayMedia
  // This is more reliable than desktopCapturer in Electron 35+
  const win = mainWindow;
  if (!win) {
    console.log("[capture] No main window");
    return null;
  }

  try {
    const base64 = await win.webContents.executeJavaScript(`
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1280, height: 800 },
            audio: false,
          });
          const track = stream.getVideoTracks()[0];
          const imageCapture = new ImageCapture(track);
          const bitmap = await imageCapture.grabFrame();
          track.stop();

          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, 0, 0);
          return canvas.toDataURL('image/png').split(',')[1];
        } catch (e) {
          // Fallback: capture just this window's content
          return null;
        }
      })()
    `);

    if (base64 && base64.length > 1000) {
      console.log(`[capture] getDisplayMedia OK (${Math.round(base64.length / 1024)}KB)`);
      return base64;
    }
  } catch (e) {
    console.log("[capture] getDisplayMedia failed:", e.message);
  }

  // Fallback: capture the app's own window
  try {
    const image = await win.webContents.capturePage();
    const pngBuffer = image.toPNG();
    if (pngBuffer.length > 1000) {
      console.log(`[capture] capturePage fallback OK (${Math.round(pngBuffer.length / 1024)}KB)`);
      return pngBuffer.toString("base64");
    }
  } catch (e) {
    console.log("[capture] capturePage failed:", e.message);
  }

  console.log("[capture] All capture methods failed");
  return null;
}

async function captureAndAnalyze() {
  console.log("[companion] captureAndAnalyze started");

  // Show thinking pose while analyzing
  if (companionWindow) {
    companionWindow.webContents.send("companion:message", {
      directive: { animation: "thinking" },
    });
  }

  const imageBase64 = await captureScreen();
  if (!imageBase64) {
    console.log("[companion] captureScreen returned null");
    if (companionWindow) {
      companionWindow.webContents.send("companion:message", { text: "嗯...看不太清，权限可能有问题" });
    }
    return;
  }

  console.log(`[companion] Got screenshot, sending to analyze (${Math.round(imageBase64.length / 1024)}KB)`);

  try {
    const response = await fetch(`${BACKEND_URL}/api/companion/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageBase64 }),
    });

    if (!response.ok) {
      console.error(`[companion] Analysis failed: HTTP ${response.status}`);
      return;
    }

    const result = await response.json();
    console.log(`[companion] Activity: ${result.activity}`);
    console.log(`[companion] Should speak: ${result.should_speak}`);

    if (companionWindow) {
      // Map mood to pose + expression
      const moodMap = {
        happy:     { pose: "wave", happy: 0.8 },
        curious:   { pose: "cute_tilt", relaxed: 0.5 },
        concerned: { animation: "thinking", sad: 0.3 },
        neutral:   { pose: "hands_behind", relaxed: 0.3 },
      };

      if (result.should_speak && result.message) {
        const directive = moodMap[result.mood] || moodMap.neutral;
        let text = result.message;
        // Append todo notification if any were created
        if (result.todos && result.todos.length > 0) {
          text += `\n📋 已添加 ${result.todos.length} 条待办`;
        }
        companionWindow.webContents.send("companion:message", {
          text,
          directive,
        });
        console.log(`[companion] ${result.mood}: ${result.message}`);
        if (result.todos?.length) console.log(`[companion] Created ${result.todos.length} todos`);
      } else {
        // Return to default pose
        companionWindow.webContents.send("companion:message", {
          directive: { pose: "hands_behind" },
        });
        console.log(`[companion] Not speaking (${result.activity})`);
      }
    }
  } catch (err) {
    console.error("[companion] Analysis error:", err.message);
    if (companionWindow) {
      companionWindow.webContents.send("companion:message", { text: `❌ ${err.message}` });
    }
  }
}

function broadcastCompanionState() {
  const windows = [mainWindow, companionWindow];
  for (const win of windows) {
    if (win) win.webContents.send("companion:state-changed", companionEnabled);
  }
}

function startCompanionLoop() {
  stopCompanionLoop();
  console.log(`[companion] Starting loop (interval: ${companionIntervalMs / 1000}s)`);
  // Capture immediately, then on interval
  captureAndAnalyze();
  companionTimerId = setInterval(() => captureAndAnalyze(), companionIntervalMs);
}

function stopCompanionLoop() {
  if (companionTimerId) {
    clearInterval(companionTimerId);
    companionTimerId = null;
    console.log("[companion] Loop stopped");
  }
}

// ---------------------------------------------------------------------------
// Reminder Window (todo deadline popup)
// ---------------------------------------------------------------------------

function createReminderWindow(todo) {
  if (reminderWindows.has(todo.id)) return; // already showing

  const display = screen.getPrimaryDisplay();
  const { width: screenW } = display.workAreaSize;
  const winWidth = 300;
  const winHeight = 150;
  // Stack reminders vertically from top-right
  const offset = reminderWindows.size * (winHeight + 10);

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenW - winWidth - 20,
    y: 40 + offset,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const reminderURL = `${BACKEND_URL}/reminder.html`;
  win.loadURL(reminderURL);
  win.setVisibleOnAllWorkspaces(true);

  // Send todo data once the page is ready
  win.webContents.on("did-finish-load", () => {
    win.webContents.send("reminder:data", {
      id: todo.id,
      content: todo.content,
      deadline: todo.deadline,
    });
  });

  win.on("closed", () => {
    reminderWindows.delete(todo.id);
  });

  reminderWindows.set(todo.id, win);
  console.log(`[reminder] Window created for: ${todo.content}`);
}

async function pollReminders() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/todos/reminders`);
    if (!response.ok) return;
    const todos = await response.json();
    for (const todo of todos) {
      createReminderWindow(todo);
    }
  } catch (e) {
    // Backend may not be ready yet, ignore
  }
}

function startReminderPolling() {
  if (reminderTimerId) return;
  reminderTimerId = setInterval(pollReminders, 30000); // every 30s
  pollReminders(); // immediate first check
  console.log("[reminder] Polling started (30s interval)");
}

function stopReminderPolling() {
  if (reminderTimerId) {
    clearInterval(reminderTimerId);
    reminderTimerId = null;
  }
}

// ---------------------------------------------------------------------------
// Spotlight Window (Cmd+Shift+H)
// ---------------------------------------------------------------------------

function createSpotlightWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: screenW } = display.workAreaSize;

  spotlightWindow = new BrowserWindow({
    width: 600,
    height: 60,
    x: Math.round((screenW - 600) / 2),
    y: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const spotlightURL = `${BACKEND_URL}/spotlight.html`;

  spotlightWindow.loadURL(spotlightURL);

  spotlightWindow.on("blur", () => {
    spotlightWindow.hide();
    // Reset size for next show
    spotlightWindow.setSize(600, 60);
  });

  spotlightWindow.on("closed", () => {
    spotlightWindow = null;
  });

  console.log("[spotlight] Window created (hidden)");
}

function toggleSpotlight() {
  if (!spotlightWindow) {
    createSpotlightWindow();
    spotlightWindow.show();
    spotlightWindow.focus();
    return;
  }

  if (spotlightWindow.isVisible()) {
    spotlightWindow.hide();
    spotlightWindow.setSize(600, 60);
  } else {
    // Re-center
    const display = screen.getPrimaryDisplay();
    const { width: screenW } = display.workAreaSize;
    spotlightWindow.setPosition(Math.round((screenW - 600) / 2), 200);
    spotlightWindow.setSize(600, 60);
    spotlightWindow.show();
    spotlightWindow.focus();
  }
}

function registerGlobalShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+H", () => {
    console.log("[shortcut] Cmd+Shift+H pressed");
    toggleSpotlight();
  });

  globalShortcut.register("CommandOrControl+Shift+S", () => {
    console.log("[shortcut] Cmd+Shift+S pressed — immediate capture");
    captureAndAnalyze();
  });

  console.log("[shortcuts] Global shortcuts registered (Cmd+Shift+H, Cmd+Shift+S)");
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "icons", "trayTemplate.png"),
  );

  tray = new Tray(icon);
  tray.setToolTip("Hermes");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示主窗口",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "隐藏",
      click: () => {
        if (mainWindow) mainWindow.hide();
      },
    },
    { type: "separator" },
    {
      label: "实时陪伴模式",
      type: "checkbox",
      checked: false,
      click: (menuItem) => {
        companionEnabled = menuItem.checked;
        console.log(`[companion] Mode ${companionEnabled ? "enabled" : "disabled"} via tray`);
        if (companionEnabled) {
          startCompanionLoop();
        } else {
          stopCompanionLoop();
        }
        broadcastCompanionState();
      },
    },
    {
      label: "立即观察 (⌘⇧S)",
      click: () => captureAndAnalyze(),
    },
    { type: "separator" },
    {
      label: "显示/隐藏 AI 伴侣",
      click: () => {
        if (companionWindow) {
          if (companionWindow.isVisible()) {
            companionWindow.hide();
          } else {
            companionWindow.show();
          }
        } else {
          createCompanionWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: "退出 Hermes",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// App Lifecycle — Single Instance Lock
// ---------------------------------------------------------------------------

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log("[app] Another instance is already running — quitting");
  app.quit();
} else {
  app.on("second-instance", () => {
    // Someone tried to launch a second instance — focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.on("ready", async () => {
  console.log("[app] Hermes starting...");
  console.log(`[app] Dev mode: ${IS_DEV}`);
  console.log(`[app] Backend dir: ${BACKEND_DIR}`);

  // Clear cache to ensure fresh frontend assets are loaded
  const { session, desktopCapturer } = require("electron");
  await session.defaultSession.clearCache();
  console.log("[app] Cache cleared");

  // Allow getDisplayMedia to work without system picker dialog
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
      if (sources.length > 0) {
        callback({ video: sources[0] });
      } else {
        callback({});
      }
    }).catch(() => callback({}));
  });

  // Set Dock icon (dev mode uses default Electron icon otherwise)
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(path.join(__dirname, "icons", "icon.png"));
  }

  try {
    await ensureVenv();
    await startBackend();
  } catch (err) {
    console.error("[app] Failed to start backend:", err.message);
    // Continue anyway — user might start backend manually
  }

  createMainWindow();
  createCompanionWindow();
  createSpotlightWindow();
  setupCompanionIPC();
  registerGlobalShortcuts();
  createTray();
  startReminderPolling();
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  stopBackend();
  stopReminderPolling();
});

app.on("window-all-closed", () => {
  // On macOS, keep running in tray
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
});
