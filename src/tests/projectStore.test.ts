import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createEmptyProject,
  DEFAULT_PROJECT_FILE_NAME,
  getThumbnailCacheDir,
  loadProject,
  saveProject
} from "../main/projectStore";
import type { PhotoItem } from "../shared/types";
import { DEFAULT_SLIDESHOW_SETTINGS } from "../shared/slideshow";

const tempDirs: string[] = [];

const createTempDir = async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "camino-project-store-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const createPhoto = (originalPath: string, id = "photo-1"): PhotoItem => ({
  id,
  originalPath,
  fileName: path.basename(originalPath),
  extension: path.extname(originalPath),
  fileSize: 1,
  fileModifiedAt: "2026-02-12T00:00:00.000Z",
  selected: true,
  assignedDay: 1,
  matchSource: "manual"
});

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true, force: true }))
  );
});

describe("projectStore", () => {
  it("creates an empty project with a user-selected save path and project-local cache path", async () => {
    const tempDir = await createTempDir();
    const projectFilePath = path.join(tempDir, DEFAULT_PROJECT_FILE_NAME);

    const project = createEmptyProject({
      projectName: "Camino 2026",
      projectYear: 2026,
      projectFilePath
    });

    expect(project.projectFilePath).toBe(projectFilePath);
    expect(project.thumbnailCacheDir).toBe(path.join(tempDir, ".camino_cache", "thumbnails"));
    expect(project.routeName).toBe("프랑스길");
  });

  it("saves and reloads camino_project.json", async () => {
    const tempDir = await createTempDir();
    const projectFilePath = path.join(tempDir, DEFAULT_PROJECT_FILE_NAME);
    const existingPhotoPath = path.join(tempDir, "IMG_0001.jpg");
    await fs.writeFile(existingPhotoPath, "photo");

    const project = createEmptyProject({
      projectName: "Camino 2026",
      projectYear: 2026,
      projectFilePath,
      sourcePhotoDir: tempDir,
      outputDir: path.join(tempDir, "output")
    });
    project.photos = [{ ...createPhoto(existingPhotoPath), category: "landscape", manualOrder: 3 }];
    project.slideshowSettings = {
      ...DEFAULT_SLIDESHOW_SETTINGS,
      source: "selected",
      categories: ["landscape"],
      dayNumbers: [1],
      loop: true
    };
    project.summary.totalPhotosScanned = 1;
    project.summary.totalSelectedPhotos = 1;

    const savedProject = await saveProject(project, projectFilePath);
    const loadedProject = await loadProject(projectFilePath);

    await expect(fs.access(projectFilePath)).resolves.toBeUndefined();
    await expect(fs.access(getThumbnailCacheDir(projectFilePath))).resolves.toBeUndefined();
    expect(savedProject.projectFilePath).toBe(projectFilePath);
    expect(loadedProject.projectName).toBe("Camino 2026");
    expect(loadedProject.slideshowSettings).toEqual(project.slideshowSettings);
    expect(loadedProject.photos[0].category).toBe("landscape");
    expect(loadedProject.photos[0].manualOrder).toBe(3);
    expect(await fs.readFile(existingPhotoPath, "utf8")).toBe("photo");
    expect(loadedProject.photos[0]).toMatchObject({
      originalPath: existingPhotoPath,
      assignedDay: 1,
      selected: true,
      matchSource: "manual",
      missing: false
    });
  });

  it("marks missing original photos when reopening a project", async () => {
    const tempDir = await createTempDir();
    const projectFilePath = path.join(tempDir, DEFAULT_PROJECT_FILE_NAME);
    const missingPhotoPath = path.join(tempDir, "missing.jpg");
    const project = createEmptyProject({
      projectName: "Camino 2026",
      projectYear: 2026,
      projectFilePath
    });

    project.photos = [createPhoto(missingPhotoPath, "missing-photo")];
    project.summary.totalPhotosScanned = 1;

    await saveProject(project, projectFilePath);

    const loadedProject = await loadProject(projectFilePath);

    expect(loadedProject.summary.totalMissingFiles).toBe(1);
    expect(loadedProject.photos[0]).toMatchObject({
      missing: true,
      needsUserReview: true,
      reviewReason: "missing_file"
    });
  });
});
