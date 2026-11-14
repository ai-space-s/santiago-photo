import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import type { PhotoItem, Project } from "../shared/types.js";

export const PROJECT_SCHEMA_VERSION = "1.0.0";
export const DEFAULT_PROJECT_FILE_NAME = "camino_project.json";
export const PROJECT_CACHE_DIR_NAME = ".camino_cache";
export const THUMBNAIL_CACHE_DIR_NAME = "thumbnails";

export const getProjectDirectory = (projectFilePath: string) => path.dirname(projectFilePath);

export const getThumbnailCacheDir = (projectFilePath: string) =>
  path.join(getProjectDirectory(projectFilePath), PROJECT_CACHE_DIR_NAME, THUMBNAIL_CACHE_DIR_NAME);

export const ensureProjectDirectories = async (projectFilePath: string) => {
  await fs.mkdir(getProjectDirectory(projectFilePath), { recursive: true });
  await fs.mkdir(getThumbnailCacheDir(projectFilePath), { recursive: true });
};

export const createEmptyProject = (values: {
  projectName: string;
  routeName?: string;
  projectYear: number;
  projectFilePath: string;
  sourcePhotoDir?: string;
  outputDir?: string;
}): Project => {
  const now = new Date().toISOString();

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectName: values.projectName,
    routeName: values.routeName ?? "프랑스길",
    projectYear: values.projectYear,
    projectFilePath: values.projectFilePath,
    createdAt: now,
    updatedAt: now,
    sourcePhotoDir: values.sourcePhotoDir ?? "",
    outputDir: values.outputDir ?? "",
    filenamePattern: "D{day:02d}_{start}_to_{end}_{seq:03d}.{ext}",
    timezoneOffsetHours: 0,
    dayBoundaryTime: "04:00",
    thumbnailCacheDir: getThumbnailCacheDir(values.projectFilePath),
    schedule: [],
    photos: [],
    summary: {
      totalPhotosScanned: 0,
      totalPhotosAssignedAutomatically: 0,
      totalPhotosAssignedManually: 0,
      totalUnmatchedPhotos: 0,
      totalSelectedPhotos: 0,
      totalDays: 0,
      totalMissingExifPhotos: 0,
      totalMissingFiles: 0,
      totalUnsupportedFiles: 0
    }
  };
};

const markMissingPhoto = (photo: PhotoItem): PhotoItem => {
  if (fsSync.existsSync(photo.originalPath)) {
    return { ...photo, missing: false };
  }

  return {
    ...photo,
    missing: true,
    needsUserReview: true,
    reviewReason: "missing_file"
  };
};

export const refreshMissingPhotoState = (project: Project): Project => {
  const photos = project.photos.map(markMissingPhoto);
  const totalMissingFiles = photos.filter((photo) => photo.missing).length;

  return {
    ...project,
    photos,
    summary: {
      ...project.summary,
      totalMissingFiles
    }
  };
};

export const saveProject = async (project: Project, projectFilePath: string) => {
  await ensureProjectDirectories(projectFilePath);

  const projectToSave: Project = {
    ...project,
    schemaVersion: project.schemaVersion || PROJECT_SCHEMA_VERSION,
    projectFilePath,
    thumbnailCacheDir: getThumbnailCacheDir(projectFilePath),
    updatedAt: new Date().toISOString()
  };

  await fs.writeFile(projectFilePath, `${JSON.stringify(projectToSave, null, 2)}\n`, "utf8");

  return projectToSave;
};

export const loadProject = async (projectFilePath: string) => {
  const rawProject = await fs.readFile(projectFilePath, "utf8");
  const parsed = JSON.parse(rawProject) as Project;

  await ensureProjectDirectories(projectFilePath);

  return refreshMissingPhotoState({
    ...parsed,
    projectFilePath,
    thumbnailCacheDir: getThumbnailCacheDir(projectFilePath)
  });
};
