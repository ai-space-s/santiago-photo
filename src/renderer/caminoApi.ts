import type { AutoAssignResult } from "../shared/autoAssigner.js";
import type { ScheduleParseResult } from "../shared/scheduleParser.js";
import type { FileScanIssue, PhotoItem, Project } from "../shared/types.js";

export type PhotoFolderSelectionResult = {
  sourcePhotoDir: string;
  photos: PhotoItem[];
  unsupportedFiles: FileScanIssue[];
  errors: FileScanIssue[];
  totalFilesVisited: number;
};

export type ScanProgress = {
  phase: "scanning" | "exif" | "thumbnails";
  completed: number;
  total: number;
};

export type ExportProgress = {
  completed: number;
  total: number;
};

export type CaminoApi = {
  platform: NodeJS.Platform;
  onMenuCommand?: (callback: (command: string) => void) => () => void;
  onProjectLoadedFromMenu?: (callback: (project: Project) => void) => () => void;
  onMenuStatus?: (callback: (message: string) => void) => () => void;
  onScanProgress?: (callback: (progress: ScanProgress) => void) => () => void;
  onExportProgress?: (callback: (progress: ExportProgress) => void) => () => void;
  getLastOpenedProject?: () => Promise<Project | undefined>;
  newProject: () => Promise<Project | undefined>;
  openProject: () => Promise<Project | undefined>;
  saveProject: (project: Project) => Promise<Project | undefined>;
  importSchedule: (projectYear: number) => Promise<ScheduleParseResult | undefined>;
  selectPhotoFolder: (project: Project) => Promise<PhotoFolderSelectionResult | undefined>;
  selectOutputFolder: () => Promise<string | undefined>;
  autoAssignPhotos: (project: Project) => Promise<AutoAssignResult>;
  previewExport: (project: Project) => Promise<import("../shared/types.js").ExportPreviewResult>;
  exportSelectedPhotos: (
    project: Project
  ) => Promise<{
    copiedCount: number;
    failedCount: number;
    manifestPath: string;
    items: import("../shared/types.js").ExportPlanItem[];
  }>;
};

declare global {
  interface Window {
    camino: CaminoApi;
  }
}
