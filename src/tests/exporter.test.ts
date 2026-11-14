import { afterEach, describe, expect, it, vi } from "vitest";
import { constants } from "node:fs";
import { inspectExport } from "../main/exportPreflight";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exportSelectedPhotos } from "../main/exporter";
import { createEmptyProject, DEFAULT_PROJECT_FILE_NAME } from "../main/projectStore";
import { buildExportPreview } from "../shared/exportValidator";
import type { PhotoItem, Project, ScheduleDay } from "../shared/types";

const tempDirs: string[] = [];

const createTempDir = async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "camino-export-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const schedule: ScheduleDay[] = [
  {
    day: 4,
    dateRaw: "02월 15일",
    date: "2026-02-15",
    routeText: "수비리 → Pamplona",
    dayType: "walking",
    startPlace: "수비리",
    endPlace: "Pamplona",
    viaPlaces: [],
    displayTitle: "수비리 → Pamplona",
    accommodation: "Alb. jesus y Maria"
  }
];

const makePhoto = async (filePath: string, id = "photo-1"): Promise<PhotoItem> => {
  const stats = await fs.stat(filePath);

  return {
    id,
    originalPath: filePath,
    fileName: path.basename(filePath),
    extension: path.extname(filePath),
    fileSize: stats.size,
    fileModifiedAt: stats.mtime.toISOString(),
    dateTimeOriginal: "2026-02-15T14:22:00",
    effectiveDateTime: "2026-02-15T14:22:00",
    assignedDay: 4,
    selected: true,
    matchSource: "DateTimeOriginal"
  };
};

const makeProject = (projectDir: string, outputDir: string, photos: PhotoItem[]): Project => ({
  ...createEmptyProject({
    projectName: "Camino 2026",
    projectYear: 2026,
    projectFilePath: path.join(projectDir, DEFAULT_PROJECT_FILE_NAME),
    outputDir,
    sourcePhotoDir: projectDir
  }),
  schedule,
  photos,
  summary: {
    totalPhotosScanned: photos.length,
    totalPhotosAssignedAutomatically: photos.length,
    totalPhotosAssignedManually: 0,
    totalUnmatchedPhotos: 0,
    totalSelectedPhotos: photos.filter((photo) => photo.selected).length,
    totalDays: schedule.length,
    totalMissingExifPhotos: 0,
    totalMissingFiles: 0,
    totalUnsupportedFiles: 0
  }
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true, force: true }))
  );
});

describe("exportSelectedPhotos", () => {
  it("rejects malformed project extensions that escape the output directory", async () => {
    const tempDir = await createTempDir();
    const source = path.join(tempDir, "source.jpg");
    await fs.writeFile(source, "source");
    const photo = { ...(await makePhoto(source)), extension: ".jpg/../../../../escaped.jpg" };
    const project = makeProject(tempDir, path.join(tempDir, "out"), [photo]);
    const checked = await inspectExport(project);
    expect(checked.canExport).toBe(false);
    expect(checked.issues.some((issue) => issue.code === "unsafe_output_path")).toBe(true);
  });
  it("blocks an existing destination and preserves all source bytes", async () => {
    const tempDir = await createTempDir();
    const source = path.join(tempDir, "source.jpg");
    await fs.writeFile(source, "source bytes");
    const project = makeProject(tempDir, path.join(tempDir, "out"), [await makePhoto(source)]);
    const preview = buildExportPreview(project.photos, schedule, { outputDir: project.outputDir });
    const target = preview.items[0].outputPath;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, "existing original bytes");
    // The target is another original, even though it is not selected.
    project.photos.push({ ...(await makePhoto(target, "other")), selected: false });
    const checked = await inspectExport(project);
    expect(checked.canExport).toBe(false);
    expect(checked.issues.some((issue) => issue.code === "unsafe_output_path")).toBe(true);
    expect(checked.items[0].status).toBe("collision");
    await expect(exportSelectedPhotos(project, preview)).rejects.toThrow();
    expect(await fs.readFile(target, "utf8")).toBe("existing original bytes");
    expect(await fs.readFile(source, "utf8")).toBe("source bytes");
  });

  it("uses exclusive copies even when a destination appears after preflight", async () => {
    const tempDir = await createTempDir();
    const source = path.join(tempDir, "source.jpg");
    await fs.writeFile(source, "source bytes");
    const project = makeProject(tempDir, path.join(tempDir, "out"), [await makePhoto(source)]);
    const preview = buildExportPreview(project.photos, schedule, { outputDir: project.outputDir });
    const copyFile = fs.copyFile.bind(fs);
    vi.spyOn(fs, "copyFile").mockImplementationOnce(async (from, to, flags) => {
      expect(flags).toBe(constants.COPYFILE_EXCL);
      await fs.writeFile(to, "concurrent bytes");
      return copyFile(from, to, flags);
    });
    const result = await exportSelectedPhotos(project, preview);
    expect(result.failedCount).toBe(1);
    expect(result.items[0].status).toBe("collision");
    expect(await fs.readFile(preview.items[0].outputPath, "utf8")).toBe("concurrent bytes");
    expect(await fs.readFile(result.manifestPath, "utf8")).toContain("collision");
  });

  it("blocks existing manifest and snapshot files", async () => {
    const tempDir = await createTempDir();
    const source = path.join(tempDir, "source.jpg");
    await fs.writeFile(source, "source");
    const project = makeProject(tempDir, path.join(tempDir, "out"), [await makePhoto(source)]);
    await fs.mkdir(project.outputDir);
    for (const name of ["manifest.csv", "camino_project.json"]) {
      await fs.writeFile(path.join(project.outputDir, name), "keep");
    }
    const result = await inspectExport(project);
    expect(result.canExport).toBe(false);
    expect(result.issues.filter((issue) => issue.code === "filename_collision")).toHaveLength(2);
  });

  it("blocks unwritable output directories before copying", async () => {
    const tempDir = await createTempDir();
    const source = path.join(tempDir, "source.jpg");
    await fs.writeFile(source, "source");
    const project = makeProject(tempDir, path.join(tempDir, "out"), [await makePhoto(source)]);
    await fs.mkdir(project.outputDir);
    const access = fs.access.bind(fs);
    vi.spyOn(fs, "access").mockImplementation(async (target, mode) => {
      if (
        path.resolve(String(target)) === path.resolve(project.outputDir) &&
        mode === constants.W_OK
      ) {
        throw Object.assign(new Error("Denied"), { code: "EACCES" });
      }
      return access(target, mode);
    });
    expect(
      (await inspectExport(project)).issues.some((issue) => issue.code === "output_not_writable")
    ).toBe(true);
  });

  it("blocks directory junctions in the output path", async () => {
    const tempDir = await createTempDir();
    const source = path.join(tempDir, "source.jpg");
    await fs.writeFile(source, "source");
    const realDir = path.join(tempDir, "real");
    await fs.mkdir(realDir);
    const link = path.join(tempDir, "link");
    try {
      await fs.symlink(realDir, link, "junction");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
      // Restricted Windows accounts may not create junctions. Still exercise the
      // rejection branch using the same lstat information a junction would return.
      const lstat = fs.lstat.bind(fs);
      const stat = await lstat(realDir);
      vi.spyOn(fs, "lstat").mockImplementation((async (target: Parameters<typeof fs.lstat>[0]) => {
        if (String(target) === link) return Object.assign(stat, { isSymbolicLink: () => true });
        return lstat(target);
      }) as typeof fs.lstat);
    }
    const project = makeProject(tempDir, link, [await makePhoto(source)]);
    expect(
      (await inspectExport(project)).issues.some((issue) => issue.code === "unsafe_output_path")
    ).toBe(true);
  });
  it("copies selected photos without changing originals and saves an output snapshot", async () => {
    const tempDir = await createTempDir();
    const sourcePath = path.join(tempDir, "IMG_1032.jpg");
    const outputDir = path.join(tempDir, "output");
    await fs.writeFile(sourcePath, "original photo");
    const photo = await makePhoto(sourcePath);
    const project = makeProject(tempDir, outputDir, [photo]);
    const preview = buildExportPreview(project.photos, project.schedule, { outputDir });
    const plannedPath = preview.items[0].outputPath;

    const result = await exportSelectedPhotos(project, preview, {
      saveProjectFile: true
    });

    await expect(fs.readFile(sourcePath, "utf8")).resolves.toBe("original photo");
    await expect(fs.readFile(plannedPath, "utf8")).resolves.toBe("original photo");
    await expect(fs.access(path.join(outputDir, "manifest.csv"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(outputDir, "camino_project.json"))).resolves.toBeUndefined();
    expect(result.copiedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.manifestRows[0]).toMatchObject({
      original_path: sourcePath,
      status: "copied"
    });
  });

  it("blocks missing sources before writing output", async () => {
    const tempDir = await createTempDir();
    const sourcePath = path.join(tempDir, "missing.jpg");
    const outputDir = path.join(tempDir, "output");
    const photo: PhotoItem = {
      id: "missing",
      originalPath: sourcePath,
      fileName: "missing.jpg",
      extension: ".jpg",
      fileSize: 1,
      fileModifiedAt: "2026-02-15T00:00:00",
      dateTimeOriginal: "2026-02-15T14:22:00",
      assignedDay: 4,
      selected: true,
      matchSource: "DateTimeOriginal"
    };
    const project = makeProject(tempDir, outputDir, [photo]);
    const preview = buildExportPreview(project.photos, project.schedule, { outputDir });

    await expect(exportSelectedPhotos(project, preview)).rejects.toThrow("missing");
    await expect(fs.access(outputDir)).rejects.toThrow();
  });

  it("reports progress after each processed item", async () => {
    const tempDir = await createTempDir();
    const firstPath = path.join(tempDir, "IMG_1032.jpg");
    const secondPath = path.join(tempDir, "IMG_1033.jpg");
    const outputDir = path.join(tempDir, "output");
    await fs.writeFile(firstPath, "one");
    await fs.writeFile(secondPath, "two");
    const photos = [await makePhoto(firstPath, "photo-1"), await makePhoto(secondPath, "photo-2")];
    const project = makeProject(tempDir, outputDir, photos);
    const preview = buildExportPreview(project.photos, project.schedule, { outputDir });
    const progressUpdates: Array<{ completed: number; total: number }> = [];

    await exportSelectedPhotos(project, preview, {
      onProgress: (completed, total) => progressUpdates.push({ completed, total })
    });

    expect(progressUpdates).toEqual([
      { completed: 1, total: 2 },
      { completed: 2, total: 2 }
    ]);
  });

  it("rejects blocked export previews", async () => {
    const tempDir = await createTempDir();
    const project = makeProject(tempDir, path.join(tempDir, "output"), []);
    const preview = buildExportPreview(project.photos, project.schedule, {
      outputDir: project.outputDir
    });

    await expect(exportSelectedPhotos(project, preview)).rejects.toThrow(
      "Export preview contains blocking issues."
    );
  });
});
