const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hermesDesktop", {
  // Window controls
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),

  // Companion window dragging
  moveCompanionWindowStart: () => ipcRenderer.send("companion:drag-start"),
  moveCompanionWindow: (dx, dy) => ipcRenderer.send("companion:drag-move", dx, dy),
  moveCompanionWindowEnd: () => ipcRenderer.send("companion:drag-end"),

  // Companion messages (from main process)
  onCompanionMessage: (callback) => {
    ipcRenderer.on("companion:message", (_event, data) => callback(data));
  },

  // Spotlight controls
  hideSpotlight: () => ipcRenderer.send("spotlight:hide"),
  spotlightExpand: () => ipcRenderer.send("spotlight:expand"),

  // Platform info
  platform: process.platform,
});
