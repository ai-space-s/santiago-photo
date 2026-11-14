import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("camino", {
  platform: process.platform,
  getLastOpenedProject: () => ipcRenderer.invoke("project:last-opened"),
  newProject: () => ipcRenderer.invoke("project:new"),
  openProject: () => ipcRenderer.invoke("project:open"),
  saveProject: (project: unknown) => ipcRenderer.invoke("project:save", project),
  importSchedule: (projectYear: number) => ipcRenderer.invoke("schedule:import", projectYear),
  selectPhotoFolder: (project: unknown) => ipcRenderer.invoke("photos:select-folder", project),
  selectOutputFolder: () => ipcRenderer.invoke("output:select-folder"),
  autoAssignPhotos: (project: unknown) => ipcRenderer.invoke("photos:auto-assign", project),
  previewExport: (project: unknown) => ipcRenderer.invoke("export:preview", project),
  exportSelectedPhotos: (project: unknown) => ipcRenderer.invoke("export:selected", project)
});
