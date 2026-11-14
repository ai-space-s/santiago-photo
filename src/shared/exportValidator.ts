import { assignSequencesForDay, buildFileNameParts } from "./filenameBuilder.js";
import type {
  ExportPlanItem,
  ExportPreviewResult,
  ExportValidationIssue,
  PhotoItem,
  ScheduleDay
} from "./types.js";

export type BuildExportPreviewOptions = {
  outputDir: string;
  existingOutputPaths?: string[];
};

const joinOutputPath = (outputDir: string, folderName: string, fileName: string) =>
  [outputDir.replace(/[\\/]+$/, ""), folderName, fileName].filter(Boolean).join("/");

const getScheduleByDay = (schedule: ScheduleDay[]) =>
  new Map(schedule.map((scheduleDay) => [scheduleDay.day, scheduleDay]));

const buildCollisionCounts = (items: Pick<ExportPlanItem, "outputPath">[]) =>
  items.reduce((counts, item) => {
    counts.set(item.outputPath, (counts.get(item.outputPath) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

export const findOutputPathCollisions = (items: Pick<ExportPlanItem, "outputPath">[]) => {
  const collisionCounts = buildCollisionCounts(items);

  return new Set(
    [...collisionCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([outputPath]) => outputPath)
  );
};

const addIssue = (issues: ExportValidationIssue[], issue: ExportValidationIssue) => {
  issues.push(issue);
};

export const buildExportPreview = (
  photos: PhotoItem[],
  schedule: ScheduleDay[],
  options: BuildExportPreviewOptions
): ExportPreviewResult => {
  const issues: ExportValidationIssue[] = [];
  const selectedPhotos = photos.filter((photo) => photo.selected);
  const scheduleByDay = getScheduleByDay(schedule);
  const existingOutputPaths = new Set(options.existingOutputPaths ?? []);

  if (!options.outputDir.trim()) {
    addIssue(issues, {
      code: "output_dir_missing",
      message: "Output directory is required."
    });
  }

  if (selectedPhotos.length === 0) {
    addIssue(issues, {
      code: "no_selected_photos",
      message: "Select at least one photo before export."
    });
  }

  const selectedByDay = new Map<number, PhotoItem[]>();

  for (const photo of selectedPhotos) {
    if (photo.missing) {
      addIssue(issues, {
        code: "selected_photo_missing",
        message: "Selected photo is missing from disk.",
        photoId: photo.id,
        path: photo.originalPath
      });
      continue;
    }

    if (photo.assignedDay === undefined || photo.matchSource === "unmatched") {
      addIssue(issues, {
        code: "selected_photo_unmatched",
        message: "Selected photo must be assigned to a Day before export.",
        photoId: photo.id,
        path: photo.originalPath
      });
      continue;
    }

    if (!scheduleByDay.has(photo.assignedDay)) {
      addIssue(issues, {
        code: "schedule_day_missing",
        message: "Assigned Day does not exist in the schedule.",
        photoId: photo.id,
        path: photo.originalPath
      });
      continue;
    }

    selectedByDay.set(photo.assignedDay, [...(selectedByDay.get(photo.assignedDay) ?? []), photo]);
  }

  const items = [...selectedByDay.entries()].flatMap(([day, dayPhotos]) => {
    const scheduleDay = scheduleByDay.get(day);

    if (!scheduleDay) {
      return [];
    }

    return assignSequencesForDay(dayPhotos).map((photo) => {
      const { folderName, fileName } = buildFileNameParts(
        scheduleDay,
        photo.sequence ?? 1,
        photo.extension
      );
      const outputPath = joinOutputPath(options.outputDir, folderName, fileName);

      return {
        photoId: photo.id,
        originalPath: photo.originalPath,
        outputPath,
        originalFileName: photo.fileName,
        newFileName: fileName,
        folderName,
        day: scheduleDay.day,
        date: scheduleDay.date,
        routeText: scheduleDay.routeText,
        accommodation: scheduleDay.accommodation,
        sequence: photo.sequence ?? 1,
        willOverwrite: existingOutputPaths.has(outputPath),
        hasCollision: false,
        status: "pending"
      } satisfies ExportPlanItem;
    });
  });

  const collisionPaths = findOutputPathCollisions(items);
  const itemsWithCollisions = items.map((item) => {
    const hasCollision = collisionPaths.has(item.outputPath) || item.willOverwrite;

    if (hasCollision) {
      addIssue(issues, {
        code: "filename_collision",
        message: "Two or more selected photos produce the same output path.",
        photoId: item.photoId,
        path: item.outputPath
      });
    }

    return {
      ...item,
      hasCollision,
      status: hasCollision ? "collision" : item.status
    } satisfies ExportPlanItem;
  });

  return {
    items: itemsWithCollisions,
    issues,
    canExport: issues.length === 0
  };
};
