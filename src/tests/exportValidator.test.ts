import { describe, expect, it } from "vitest";
import { buildExportPreview, findOutputPathCollisions } from "../shared/exportValidator";
import type { PhotoItem, ScheduleDay } from "../shared/types";

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
    displayTitle: "수비리 → Pamplona"
  },
  {
    day: 5,
    dateRaw: "02월 16일",
    date: "2026-02-16",
    routeText: "연박",
    dayType: "rest",
    startPlace: "Pamplona",
    endPlace: "Pamplona",
    viaPlaces: [],
    displayTitle: "Pamplona 연박"
  }
];

const photo = (id: string, values: Partial<PhotoItem>): PhotoItem => ({
  id,
  originalPath: `C:/Photos/${id}.jpg`,
  fileName: `${id}.jpg`,
  extension: ".jpg",
  fileSize: 1,
  fileModifiedAt: "2026-02-15T00:00:00",
  selected: true,
  assignedDay: 4,
  matchSource: "DateTimeOriginal",
  ...values
});

describe("buildExportPreview", () => {
  it("blocks export when no photos are selected", () => {
    const result = buildExportPreview([photo("p1", { selected: false })], schedule, {
      outputDir: "C:/Output"
    });

    expect(result.canExport).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("no_selected_photos");
  });

  it("creates export plan items for selected assigned photos", () => {
    const result = buildExportPreview(
      [
        photo("late", { dateTimeOriginal: "2026-02-15T11:00:00" }),
        photo("early", { dateTimeOriginal: "2026-02-15T09:00:00" })
      ],
      schedule,
      { outputDir: "C:/Output" }
    );

    expect(result.canExport).toBe(true);
    expect(result.items.map((item) => [item.originalFileName, item.sequence])).toEqual([
      ["early.jpg", 1],
      ["late.jpg", 2]
    ]);
    expect(result.items[0]).toMatchObject({
      folderName: "D04_수비리_to_Pamplona",
      newFileName: "D04_수비리_to_Pamplona_001.jpg",
      outputPath: "C:/Output/D04_수비리_to_Pamplona/D04_수비리_to_Pamplona_001.jpg"
    });
  });

  it("blocks existing output files", () => {
    const outputPath = "C:/Output/D04_수비리_to_Pamplona/D04_수비리_to_Pamplona_001.jpg";
    const result = buildExportPreview(
      [photo("p1", { dateTimeOriginal: "2026-02-15T09:00:00" })],
      schedule,
      {
        outputDir: "C:/Output",
        existingOutputPaths: [outputPath]
      }
    );

    expect(result.canExport).toBe(false);
    expect(result.items[0].hasCollision).toBe(true);
    expect(result.items[0].willOverwrite).toBe(true);
  });

  it("blocks selected Unmatched photos", () => {
    const result = buildExportPreview(
      [photo("p1", { assignedDay: undefined, matchSource: "unmatched" })],
      schedule,
      { outputDir: "C:/Output" }
    );

    expect(result.canExport).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("selected_photo_unmatched");
  });

  it("blocks selected missing photos", () => {
    const result = buildExportPreview([photo("p1", { missing: true })], schedule, {
      outputDir: "C:/Output"
    });

    expect(result.canExport).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("selected_photo_missing");
  });

  it("blocks selected photos assigned to a missing schedule day", () => {
    const result = buildExportPreview([photo("p1", { assignedDay: 99 })], schedule, {
      outputDir: "C:/Output"
    });

    expect(result.canExport).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("schedule_day_missing");
  });

  it("blocks export when output directory is missing", () => {
    const result = buildExportPreview(
      [photo("p1", { dateTimeOriginal: "2026-02-15T09:00:00" })],
      schedule,
      { outputDir: "" }
    );

    expect(result.canExport).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("output_dir_missing");
  });
});

describe("findOutputPathCollisions", () => {
  it("detects duplicate output paths in an export plan", () => {
    expect([
      ...findOutputPathCollisions([
        { outputPath: "C:/Output/a.jpg" },
        { outputPath: "C:/Output/b.jpg" },
        { outputPath: "C:/Output/a.jpg" }
      ])
    ]).toEqual(["C:/Output/a.jpg"]);
  });
});
