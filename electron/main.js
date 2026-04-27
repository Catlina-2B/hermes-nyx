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

const FRONTEND_URL = IS_DEV
  ? BACKEND_URL // dev: FastAPI serves built frontend
  : BACKEND_URL;

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
  for (const name of ["venv", ".venv"]) {
    const p = path.join(BACKEND_DIR, name);
    if (fs.existsSync(path.join(p, "bin", "python3"))) return p;
  }
  return path.join(BACKEND_DIR, "venv");
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
    width: 300,
    height: 400,
    x: screenW - 340,
    y: screenH - 440,
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
  const companionURL = IS_DEV
    ? `${BACKEND_URL}/companion.html`
    : `file://${path.join(process.resourcesPath, "frontend-dist", "companion.html")}`;

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
    companionWindow.setPosition(
      companionDragStart.winX + deltaX,
      companionDragStart.winY + deltaY,
    );
  });

  ipcMain.on("companion:drag-end", () => {
    companionDragStart = null;
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

  const spotlightURL = IS_DEV
    ? `${BACKEND_URL}/spotlight.html`
    : `file://${path.join(process.resourcesPath, "frontend-dist", "spotlight.html")}`;

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

  console.log("[shortcuts] Global shortcuts registered");
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

function createTray() {
  // Use a simple template image for the tray
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWElEQVQ4T2NkoBAwUqifgWoG" +
    "/P//n+HVq1cMjIyMDAwMDAzIYsQ6HtkAZMNwuQLdAGTDCbqCbAOQXUFNG0A2ENsVRBuA7Api" +
    "w4VoA4h1BdEGEOsKYsMFABWINxF/8YO6AAAAAElFTkSuQmCC"
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
// App Lifecycle
// ---------------------------------------------------------------------------

app.on("ready", async () => {
  console.log("[app] Hermes starting...");
  console.log(`[app] Dev mode: ${IS_DEV}`);
  console.log(`[app] Backend dir: ${BACKEND_DIR}`);

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
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  stopBackend();
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
