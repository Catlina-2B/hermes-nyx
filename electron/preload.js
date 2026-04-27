const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hermesDesktop", {
  // Window controls
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),

  // Companion controls (Phase 2+)
  onCompanionMessage: (callback) => {
    ipcRenderer.on("companion:message", (_event, data) => callback(data));
  },

  // Platform info
  platform: process.platform,
});
