import fs from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { inspectExport } from "./exportPreflight.js";
import { buildManifestRow, writeManifestCsv } from "../shared/manifestWriter.js";
import type { ExportPlanItem, ExportPreviewResult, ManifestRow, Project } from "../shared/types.js";

export type ExportRunResult = {
  items: ExportPlanItem[];
  manifestRows: ManifestRow[];
  manifestPath: string;
  copiedCount: number;
  failedCount: number;
  savedProject?: Project;
};

const normalizeOutputPath = (filePath: string) => path.normalize(filePath);

export const exportSelectedPhotos = async (
  project: Project,
  preview: ExportPreviewResult,
  options: {
    saveProjectFile?: boolean;
    projectFilePath?: string;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<ExportRunResult> => {
  if (!preview.canExport) {
    throw new Error("Export preview contains blocking issues.");
  }

  const checked = await inspectExport(project);
  if (!checked.canExport) throw new Error(checked.issues.map((issue) => issue.message).join("\n"));
  // Never trust a stale or caller-supplied plan.
  preview = checked;

  await fs.mkdir(project.outputDir, { recursive: true });

  const photosById = new Map(project.photos.map((photo) => [photo.id, photo]));
  const scheduleByDay = new Map(
    project.schedule.map((scheduleDay) => [scheduleDay.day, scheduleDay])
  );
  const exportedItems: ExportPlanItem[] = [];
  const total = preview.items.length;

  for (const item of preview.items) {
    const outputPath = normalizeOutputPath(item.outputPath);

    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.copyFile(item.originalPath, outputPath, constants.COPYFILE_EXCL);
      exportedItems.push({
        ...item,
        outputPath,
        status: "copied"
      });
    } catch (error) {
      exportedItems.push({
        ...item,
        outputPath,
        status:
          (error as NodeJS.ErrnoException).code === "EEXIST"
            ? "collision"
            : (error as NodeJS.ErrnoException).code === "ENOENT"
              ? "missing"
              : "failed",
        error: error instanceof Error ? error.message : "Could not copy file."
      });
    }

    options.onProgress?.(exportedItems.length, total);
  }

  const manifestRows = exportedItems.flatMap((item) => {
    const photo = photosById.get(item.photoId);
    const scheduleDay = scheduleByDay.get(item.day);

    if (!photo || !scheduleDay) {
      return [];
    }

    return [buildManifestRow(item, photo, scheduleDay)];
  });
  const manifestPath = path.join(project.outputDir, "manifest.csv");
  await fs.writeFile(manifestPath, writeManifestCsv(manifestRows), {
    encoding: "utf8",
    flag: "wx"
  });

  const savedProject = { ...project, updatedAt: new Date().toISOString() };
  await fs.writeFile(
    path.join(project.outputDir, "camino_project.json"),
    `${JSON.stringify(savedProject, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" }
  );

  return {
    items: exportedItems,
    manifestRows,
    manifestPath,
    copiedCount: exportedItems.filter((item) => item.status === "copied").length,
    failedCount: exportedItems.filter((item) => item.status !== "copied").length,
    savedProject
  };
};
