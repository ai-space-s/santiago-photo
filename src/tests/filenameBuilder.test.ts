import { describe, expect, it } from "vitest";
import {
  assignSequencesForDay,
  buildDayFolderName,
  buildFileNameParts,
  buildPhotoFileName,
  sanitizeFileNamePart,
  sortPhotosForDisplay,
  sortPhotosForSequence
} from "../shared/filenameBuilder";
import type { PhotoItem, ScheduleDay } from "../shared/types";

const walkingDay: ScheduleDay = {
  day: 1,
  dateRaw: "02월 12일",
  date: "2026-02-12",
  routeText: "바욘-생장-발카로스",
  dayType: "walking",
  startPlace: "바욘",
  endPlace: "발카로스",
  viaPlaces: ["생장"],
  displayTitle: "바욘 → 발카로스",
  distanceKm: 11
};

const restDay: ScheduleDay = {
  day: 5,
  dateRaw: "02월 16일",
  date: "2026-02-16",
  routeText: "연박",
  dayType: "rest",
  startPlace: "Pamplona",
  endPlace: "Pamplona",
  viaPlaces: [],
  displayTitle: "Pamplona 연박"
};

const photo = (id: string, values: Partial<PhotoItem>): PhotoItem => ({
  id,
  originalPath: `C:/Photos/${id}.jpg`,
  fileName: `${id}.jpg`,
  extension: ".jpg",
  fileSize: 1,
  fileModifiedAt: "2026-02-12T00:00:00.000Z",
  selected: true,
  matchSource: "DateTimeOriginal",
  assignedDay: 1,
  ...values
});

describe("filename sanitization", () => {
  it("removes unsafe filesystem characters and preserves Korean text", () => {
    expect(sanitizeFileNamePart(' 산티아고/데:콤포스텔라? "Final"* ')).toBe(
      "산티아고데콤포스텔라_Final"
    );
  });

  it("uses a fallback when the value becomes empty", () => {
    expect(sanitizeFileNamePart("////", "Rest-Day")).toBe("Rest-Day");
  });
});

describe("folder and filename generation", () => {
  it("generates walking-day folder and file names", () => {
    expect(buildDayFolderName(walkingDay)).toBe("D01_바욘_to_발카로스");
    expect(buildPhotoFileName(walkingDay, 1, ".JPG")).toBe("D01_바욘_to_발카로스_001.jpg");
  });

  it("generates rest-day folder and file names", () => {
    expect(buildDayFolderName(restDay)).toBe("D05_Pamplona_Rest");
    expect(buildPhotoFileName(restDay, 1, "jpeg")).toBe("D05_Pamplona_Rest_001.jpeg");
  });

  it("returns folder and file name together", () => {
    expect(buildFileNameParts(restDay, 12, ".png")).toEqual({
      folderName: "D05_Pamplona_Rest",
      fileName: "D05_Pamplona_Rest_012.png"
    });
  });
});

describe("sequence ordering", () => {
  it("sorts by capture time when manual order is absent", () => {
    const sorted = sortPhotosForSequence([
      photo("late", { dateTimeOriginal: "2026-02-12T11:00:00.000Z" }),
      photo("early", { dateTimeOriginal: "2026-02-12T09:00:00.000Z" })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["early", "late"]);
  });

  it("prefers manual order over capture time inside the same Day", () => {
    const sorted = sortPhotosForSequence([
      photo("first-by-time", {
        dateTimeOriginal: "2026-02-12T09:00:00.000Z",
        manualOrder: 2
      }),
      photo("first-by-manual", {
        dateTimeOriginal: "2026-02-12T11:00:00.000Z",
        manualOrder: 1
      })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["first-by-manual", "first-by-time"]);
  });

  it("assigns one-based sequence numbers", () => {
    const sequenced = assignSequencesForDay([
      photo("two", { dateTimeOriginal: "2026-02-12T11:00:00.000Z" }),
      photo("one", { dateTimeOriginal: "2026-02-12T09:00:00.000Z" })
    ]);

    expect(sequenced.map((item) => [item.id, item.sequence])).toEqual([
      ["one", 1],
      ["two", 2]
    ]);
  });
});

describe("display ordering", () => {
  it("orders photos by assigned day first, regardless of original array order", () => {
    const sorted = sortPhotosForDisplay([
      photo("day3", { assignedDay: 3, dateTimeOriginal: "2026-02-14T09:00:00.000Z" }),
      photo("day1", { assignedDay: 1, dateTimeOriginal: "2026-02-12T09:00:00.000Z" }),
      photo("day2", { assignedDay: 2, dateTimeOriginal: "2026-02-13T09:00:00.000Z" })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["day1", "day2", "day3"]);
  });

  it("orders photos within the same day by capture time", () => {
    const sorted = sortPhotosForDisplay([
      photo("late", { assignedDay: 4, dateTimeOriginal: "2026-02-15T17:00:00.000Z" }),
      photo("early", { assignedDay: 4, dateTimeOriginal: "2026-02-15T08:00:00.000Z" }),
      photo("mid", { assignedDay: 4, dateTimeOriginal: "2026-02-15T12:00:00.000Z" })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["early", "mid", "late"]);
  });

  it("respects manual order within a day before falling back to capture time", () => {
    const sorted = sortPhotosForDisplay([
      photo("first-by-time", {
        assignedDay: 4,
        dateTimeOriginal: "2026-02-15T08:00:00.000Z",
        manualOrder: 2
      }),
      photo("first-by-manual", {
        assignedDay: 4,
        dateTimeOriginal: "2026-02-15T17:00:00.000Z",
        manualOrder: 1
      })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["first-by-manual", "first-by-time"]);
  });

  it("places unmatched (no assigned day) photos after all dated photos", () => {
    const sorted = sortPhotosForDisplay([
      photo("unmatched", { assignedDay: undefined, fileName: "z_unmatched.jpg" }),
      photo("day1", { assignedDay: 1, dateTimeOriginal: "2026-02-12T09:00:00.000Z" })
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["day1", "unmatched"]);
  });
});
