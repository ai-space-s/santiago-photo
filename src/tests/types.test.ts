import { describe, expect, it } from "vitest";
import type { ExportPlanItem, ManifestRow, PhotoItem, Project, ScheduleDay } from "../shared/types";

describe("core data model", () => {
  it("supports the Camino schedule, photo, project, export, and manifest shapes", () => {
    const scheduleDay: ScheduleDay = {
      day: 5,
      dateRaw: "02월 16일",
      date: "2026-02-16",
      routeText: "연박",
      dayType: "rest",
      startPlace: "Pamplona",
      endPlace: "Pamplona",
      viaPlaces: [],
      displayTitle: "Pamplona 연박",
      accommodation: "Alb. jesus y Maria"
    };

    const photo: PhotoItem = {
      id: "photo-1",
      originalPath: "C:/Photos/IMG_0001.jpg",
      fileName: "IMG_0001.jpg",
      extension: ".jpg",
      fileSize: 1024,
      fileModifiedAt: "2026-02-16T10:00:00.000Z",
      dateTimeOriginal: "2026-02-16T09:00:00.000Z",
      assignedDay: 5,
      selected: true,
      sequence: 1,
      manualOrder: 1,
      matchSource: "manual"
    };

    const project: Project = {
      schemaVersion: "1.0.0",
      projectName: "Camino 2026",
      routeName: "프랑스길",
      projectYear: 2026,
      projectFilePath: "C:/Projects/camino_project.json",
      createdAt: "2026-06-28T00:00:00.000Z",
      updatedAt: "2026-06-28T00:00:00.000Z",
      sourcePhotoDir: "C:/Photos",
      outputDir: "C:/Output",
      filenamePattern: "D{day:02d}_{start}_to_{end}_{seq:03d}.{ext}",
      timezoneOffsetHours: 0,
      dayBoundaryTime: "04:00",
      thumbnailCacheDir: "C:/Projects/.camino_cache/thumbnails",
      schedule: [scheduleDay],
      photos: [photo],
      summary: {
        totalPhotosScanned: 1,
        totalPhotosAssignedAutomatically: 0,
        totalPhotosAssignedManually: 1,
        totalUnmatchedPhotos: 0,
        totalSelectedPhotos: 1,
        totalDays: 1,
        totalMissingExifPhotos: 0,
        totalMissingFiles: 0,
        totalUnsupportedFiles: 0,
        firstStartPlace: "Pamplona",
        lastEndPlace: "Pamplona"
      }
    };

    const exportPlanItem: ExportPlanItem = {
      photoId: photo.id,
      originalPath: photo.originalPath,
      outputPath: "C:/Output/D05_Pamplona_Rest/D05_Pamplona_Rest_001.jpg",
      originalFileName: photo.fileName,
      newFileName: "D05_Pamplona_Rest_001.jpg",
      folderName: "D05_Pamplona_Rest",
      day: scheduleDay.day,
      date: scheduleDay.date,
      routeText: scheduleDay.routeText,
      accommodation: scheduleDay.accommodation,
      sequence: 1,
      willOverwrite: true,
      hasCollision: false,
      status: "pending"
    };

    const manifestRow: ManifestRow = {
      original_path: exportPlanItem.originalPath,
      new_path: exportPlanItem.outputPath,
      day: scheduleDay.day,
      date: scheduleDay.date,
      date_raw: scheduleDay.dateRaw,
      day_type: scheduleDay.dayType,
      route_text: scheduleDay.routeText,
      start_place: scheduleDay.startPlace ?? "",
      end_place: scheduleDay.endPlace ?? "",
      via_places: scheduleDay.viaPlaces.join("|"),
      distance_km: "",
      accommodation: scheduleDay.accommodation ?? "",
      sequence: exportPlanItem.sequence,
      selected: photo.selected,
      match_source: photo.matchSource,
      effective_datetime: photo.effectiveDateTime ?? "",
      date_time_original: photo.dateTimeOriginal ?? "",
      create_date: photo.createDate ?? "",
      file_modify_date: photo.fileModifyDate ?? "",
      status: "copied"
    };

    expect(project.photos[0].manualOrder).toBe(1);
    expect(exportPlanItem.willOverwrite).toBe(true);
    expect(manifestRow.match_source).toBe("manual");
  });
});
