import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import { autoAssignPhotos } from "../shared/autoAssigner.js";
import { inspectExport } from "./exportPreflight.js";
import type { Project } from "../shared/types.js";
import { enrichPhotosWithExif } from "./exifReader.js";
import { exportSelectedPhotos } from "./exporter.js";
import { scanPhotoDirectory } from "./fileSystem.js";
import { createEmptyProject, loadProject, saveProject } from "./projectStore.js";
import { createThumbnailUrl, generateThumbnails } from "./thumbnailGenerator.js";
import { parseScheduleCsv } from "../shared/scheduleParser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type RecentProjectState = {
  lastProjectFilePath?: string;
};

const getRecentProjectStatePath = () => path.join(app.getPath("userData"), "recent-project.json");

const readRecentProjectState = async (): Promise<RecentProjectState> => {
  try {
    return JSON.parse(await fs.readFile(getRecentProjectStatePath(), "utf8")) as RecentProjectState;
  } catch {
    return {};
  }
};

const writeRecentProjectState = async (state: RecentProjectState) => {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(getRecentProjectStatePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const rememberProject = async (project: Project) => {
  if (project.projectFilePath) {
    await writeRecentProjectState({ lastProjectFilePath: project.projectFilePath });
  }
};

const loadProjectAndRemember = async (projectFilePath: string) => {
  const project = withThumbnailUrls(await loadProject(projectFilePath));
  await rememberProject(project);
  return project;
};

const saveProjectAndRemember = async (project: Project, projectFilePath: string) => {
  const savedProject = withThumbnailUrls(await saveProject(project, projectFilePath));
  await rememberProject(savedProject);
  return savedProject;
};

const loadLastOpenedProject = async () => {
  const { lastProjectFilePath } = await readRecentProjectState();

  if (!lastProjectFilePath) {
    return undefined;
  }

  try {
    return loadProjectAndRemember(lastProjectFilePath);
  } catch (error) {
    console.error("Could not load last opened project", error);
    return undefined;
  }
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: "camino-thumbnail",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

const THUMBNAIL_PROTOCOL_HOSTS = new Set(["thumb", "original"]);

const registerThumbnailProtocol = () => {
  protocol.handle("camino-thumbnail", async (request) => {
    const url = new URL(request.url);

    if (!THUMBNAIL_PROTOCOL_HOSTS.has(url.hostname) || !url.pathname.slice(1)) {
      return new Response("Invalid thumbnail URL", { status: 400 });
    }

    const filePath = Buffer.from(url.pathname.slice(1), "base64url").toString("utf8");
    return net.fetch(pathToFileURL(filePath).toString());
  });
};

const withThumbnailUrls = (project: Project): Project => ({
  ...project,
  photos: project.photos.map((photo) => ({
    ...photo,
    thumbnailUrl: photo.thumbnailPath ? createThumbnailUrl(photo.thumbnailPath) : photo.thumbnailUrl
  }))
});

const createMainWindow = () => {
  const preloadPath = path.join(app.getAppPath(), "src/main/preload.cjs");
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    title: "Camino Photo Organizer",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    console.error("Renderer failed to load", { errorCode, errorDescription, validatedUrl });
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone", details);
  });
  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.log("Renderer console", { level, message, line, sourceId });
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    void window.loadURL(devServerUrl).catch((error: unknown) => {
      console.error("Renderer loadURL failed", error);
    });
  } else {
    void window.loadFile(path.join(__dirname, "../renderer/index.html")).catch((error: unknown) => {
      console.error("Renderer loadFile failed", error);
    });
  }
};

const getFocusedWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

const sendMenuCommand = (command: string) => {
  const window = getFocusedWindow();
  window?.webContents.send("menu:command", command);
};

const createProjectWithDialog = async () => {
  const result = await dialog.showSaveDialog(getFocusedWindow(), {
    title: "Create Camino Project",
    defaultPath: "camino_project.json",
    filters: [{ name: "Camino Project", extensions: ["json"] }]
  });

  if (result.canceled || !result.filePath) {
    return undefined;
  }

  const project = createEmptyProject({
    projectName: path.basename(result.filePath, path.extname(result.filePath)) || "Camino Project",
    projectYear: new Date().getFullYear(),
    projectFilePath: result.filePath
  });

  return saveProjectAndRemember(project, result.filePath);
};

const openProjectWithDialog = async () => {
  const result = await dialog.showOpenDialog(getFocusedWindow(), {
    title: "Open Camino Project",
    properties: ["openFile"],
    filters: [{ name: "Camino Project", extensions: ["json"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return undefined;
  }

  return loadProjectAndRemember(result.filePaths[0]);
};

const sendProjectToRenderer = (project: Project | undefined, canceledMessage: string) => {
  const window = getFocusedWindow();

  if (project) {
    window?.webContents.send("project:loaded-from-menu", project);
  } else {
    window?.webContents.send("menu:status", canceledMessage);
  }
};

const createApplicationMenu = () => {
  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: async () =>
            sendProjectToRenderer(await createProjectWithDialog(), "New project canceled")
        },
        {
          label: "Open Project...",
          accelerator: "CmdOrCtrl+O",
          click: async () =>
            sendProjectToRenderer(await openProjectWithDialog(), "Open project canceled")
        },
        {
          label: "Save Project",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuCommand("save-project")
        },
        { type: "separator" },
        {
          label: "Import Schedule CSV...",
          click: () => sendMenuCommand("import-schedule")
        },
        {
          label: "Select Photo Folder...",
          click: () => sendMenuCommand("select-photo-folder")
        },
        {
          label: "Select Output Folder...",
          click: () => sendMenuCommand("select-output-folder")
        },
        { type: "separator" },
        {
          label: "Run Auto Assignment",
          click: () => sendMenuCommand("auto-assign")
        },
        {
          label: "Export Preview",
          click: () => sendMenuCommand("export-preview")
        },
        {
          label: "Export Selected Photos",
          accelerator: "CmdOrCtrl+E",
          click: () => sendMenuCommand("export-selected")
        },
        { type: "separator" },
        {
          role: "quit"
        }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);
};

const registerIpcHandlers = () => {
  ipcMain.handle("export:preview", (_event, project: Project) => inspectExport(project));
  ipcMain.handle("project:last-opened", loadLastOpenedProject);

  ipcMain.handle("project:new", createProjectWithDialog);

  ipcMain.handle("project:open", openProjectWithDialog);

  ipcMain.handle("project:save", async (_event, project: Project) => {
    if (project.projectFilePath) {
      return saveProjectAndRemember(project, project.projectFilePath);
    }

    const result = await dialog.showSaveDialog(getFocusedWindow(), {
      title: "Save Camino Project",
      defaultPath: "camino_project.json",
      filters: [{ name: "Camino Project", extensions: ["json"] }]
    });

    if (result.canceled || !result.filePath) {
      return undefined;
    }

    return saveProjectAndRemember(project, result.filePath);
  });

  ipcMain.handle("schedule:import", async (_event, projectYear: number) => {
    const result = await dialog.showOpenDialog(getFocusedWindow(), {
      title: "Import Schedule CSV",
      properties: ["openFile"],
      filters: [{ name: "CSV", extensions: ["csv"] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return undefined;
    }

    const csvText = await fs.readFile(result.filePaths[0], "utf8");
    return parseScheduleCsv(csvText, projectYear);
  });

  ipcMain.handle("photos:select-folder", async (event, project: Project) => {
    const result = await dialog.showOpenDialog(getFocusedWindow(), {
      title: "Select Photo Folder",
      properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return undefined;
    }

    const sourcePhotoDir = result.filePaths[0];
    event.sender.send("photos:scan-progress", { phase: "scanning", completed: 0, total: 0 });

    const scanResult = await scanPhotoDirectory(sourcePhotoDir, { includeSubdirectories: true });
    const progressStep = Math.max(1, Math.ceil(scanResult.photos.length / 200));
    const sendProgress = (phase: "exif" | "thumbnails", completed: number, total: number) => {
      if (completed % progressStep === 0 || completed === total) {
        event.sender.send("photos:scan-progress", { phase, completed, total });
      }
    };

    const withExif = await enrichPhotosWithExif(scanResult.photos, undefined, {
      onProgress: (completed, total) => sendProgress("exif", completed, total)
    });
    const withThumbnails = project.thumbnailCacheDir
      ? await generateThumbnails(withExif, project.thumbnailCacheDir, {
          onProgress: (completed, total) => sendProgress("thumbnails", completed, total)
        })
      : withExif.map((photo) => ({ photo, cacheHit: false }));
    const assigned = autoAssignPhotos(
      withThumbnails.map((resultItem) => resultItem.photo),
      project.schedule,
      {
        timezoneOffsetHours: project.timezoneOffsetHours,
        dayBoundaryTime: project.dayBoundaryTime
      }
    );

    return {
      sourcePhotoDir,
      photos: assigned.photos,
      unsupportedFiles: scanResult.unsupportedFiles,
      errors: scanResult.errors,
      totalFilesVisited: scanResult.totalFilesVisited
    };
  });

  ipcMain.handle("output:select-folder", async () => {
    const result = await dialog.showOpenDialog(getFocusedWindow(), {
      title: "Select Output Folder",
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return undefined;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("photos:auto-assign", async (_event, project: Project) =>
    autoAssignPhotos(project.photos, project.schedule, {
      timezoneOffsetHours: project.timezoneOffsetHours,
      dayBoundaryTime: project.dayBoundaryTime
    })
  );

  ipcMain.handle("export:selected", async (event, project: Project) => {
    const preview = await inspectExport(project);
    const progressStep = Math.max(1, Math.ceil(preview.items.length / 200));

    return exportSelectedPhotos(project, preview, {
      saveProjectFile: Boolean(project.projectFilePath),
      onProgress: (completed, total) => {
        if (completed % progressStep === 0 || completed === total) {
          event.sender.send("export:progress", { completed, total });
        }
      }
    });
  });
};

app.whenReady().then(() => {
  registerThumbnailProtocol();
  registerIpcHandlers();
  createApplicationMenu();
  createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
