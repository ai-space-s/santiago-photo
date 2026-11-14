const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("camino", {
  platform: process.platform,
  onMenuCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on("menu:command", listener);
    return () => ipcRenderer.removeListener("menu:command", listener);
  },
  onProjectLoadedFromMenu: (callback) => {
    const listener = (_event, project) => callback(project);
    ipcRenderer.on("project:loaded-from-menu", listener);
    return () => ipcRenderer.removeListener("project:loaded-from-menu", listener);
  },
  onMenuStatus: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("menu:status", listener);
    return () => ipcRenderer.removeListener("menu:status", listener);
  },
  onScanProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("photos:scan-progress", listener);
    return () => ipcRenderer.removeListener("photos:scan-progress", listener);
  },
  onExportProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("export:progress", listener);
    return () => ipcRenderer.removeListener("export:progress", listener);
  },
  getLastOpenedProject: () => ipcRenderer.invoke("project:last-opened"),
  newProject: () => ipcRenderer.invoke("project:new"),
  openProject: () => ipcRenderer.invoke("project:open"),
  saveProject: (project) => ipcRenderer.invoke("project:save", project),
  importSchedule: (projectYear) => ipcRenderer.invoke("schedule:import", projectYear),
  selectPhotoFolder: (project) => ipcRenderer.invoke("photos:select-folder", project),
  selectOutputFolder: () => ipcRenderer.invoke("output:select-folder"),
  autoAssignPhotos: (project) => ipcRenderer.invoke("photos:auto-assign", project),
  previewExport: (project) => ipcRenderer.invoke("export:preview", project),
  exportSelectedPhotos: (project) => ipcRenderer.invoke("export:selected", project)
});
