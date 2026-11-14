import { describe, expect, it } from "vitest";
import { buildManifestRow, writeManifestCsv } from "../shared/manifestWriter";
import type { ExportPlanItem, PhotoItem, ScheduleDay } from "../shared/types";

const scheduleDay: ScheduleDay = {
  day: 4,
  dateRaw: "02월 15일",
  date: "2026-02-15",
  routeText: "수비리 → Pamplona",
  dayType: "walking",
  startPlace: "수비리",
  endPlace: "Pamplona",
  viaPlaces: [],
  displayTitle: "수비리 → Pamplona",
  distanceKm: 21.8,
  accommodation: "Alb. jesus y Maria"
};

const photo: PhotoItem = {
  id: "photo-1",
  originalPath: "C:/Photos/IMG_1032.jpg",
  fileName: "IMG_1032.jpg",
  extension: ".jpg",
  fileSize: 1,
  fileModifiedAt: "2026-02-16T10:01:00",
  dateTimeOriginal: "2026-02-15T14:22:00",
  effectiveDateTime: "2026-02-15T14:22:00",
  assignedDay: 4,
  selected: true,
  matchSource: "DateTimeOriginal"
};

const item: ExportPlanItem = {
  photoId: "photo-1",
  originalPath: photo.originalPath,
  outputPath: "C:/Output/D04_수비리_to_Pamplona/D04_수비리_to_Pamplona_001.jpg",
  originalFileName: photo.fileName,
  newFileName: "D04_수비리_to_Pamplona_001.jpg",
  folderName: "D04_수비리_to_Pamplona",
  day: 4,
  date: "2026-02-15",
  routeText: scheduleDay.routeText,
  accommodation: scheduleDay.accommodation,
  sequence: 1,
  willOverwrite: false,
  hasCollision: false,
  status: "copied"
};

describe("manifestWriter", () => {
  it("builds manifest rows from export items, photos, and schedule days", () => {
    expect(buildManifestRow(item, photo, scheduleDay)).toMatchObject({
      original_path: photo.originalPath,
      new_path: item.outputPath,
      day: 4,
      date: "2026-02-15",
      selected: true,
      match_source: "DateTimeOriginal",
      status: "copied"
    });
  });

  it("writes manifest CSV with required columns and escaping", () => {
    const csv = writeManifestCsv([
      {
        ...buildManifestRow(item, photo, {
          ...scheduleDay,
          routeText: "수비리, Pamplona"
        })
      }
    ]);

    expect(csv.split("\n")[0]).toBe(
      "original_path,new_path,day,date,date_raw,day_type,route_text,start_place,end_place,via_places,distance_km,accommodation,sequence,selected,match_source,effective_datetime,date_time_original,create_date,file_modify_date,status"
    );
    expect(csv).toContain('"수비리, Pamplona"');
  });
});
