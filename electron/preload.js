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

  // Companion mode
  toggleCompanion: () => ipcRenderer.send("companion:toggle"),
  captureNow: () => ipcRenderer.send("companion:capture-now"),
  sendToCompanion: (directive) => ipcRenderer.send("companion:send-directive", directive),
  setCompanionInterval: (minutes) => ipcRenderer.send("companion:set-interval", minutes),
  onCompanionMessage: (callback) => {
    ipcRenderer.on("companion:message", (_event, data) => callback(data));
  },
  onCompanionStateChange: (callback) => {
    ipcRenderer.on("companion:state-changed", (_event, enabled) => callback(enabled));
  },

  // Avatar location switching (desktop ↔ webui)
  switchAvatarTo: (location) => ipcRenderer.send("avatar:switch", location),
  onAvatarSwitch: (callback) => {
    ipcRenderer.on("avatar:switched", (_event, location) => callback(location));
  },

  // Spotlight controls
  hideSpotlight: () => ipcRenderer.send("spotlight:hide"),
  spotlightExpand: () => ipcRenderer.send("spotlight:expand"),
  // Capture screen and ask question about it
  captureAndAsk: (question) => ipcRenderer.invoke("companion:capture-and-ask", question),

  // Platform info
  platform: process.platform,
});
