import { describe, expect, it } from "vitest";
import { autoAssignPhoto, autoAssignPhotos, manuallyAssignPhotos } from "../shared/autoAssigner";
import type { PhotoItem, ScheduleDay } from "../shared/types";

const schedule: ScheduleDay[] = [
  {
    day: 1,
    dateRaw: "02월 12일",
    date: "2026-02-12",
    routeText: "바욘-생장-발카로스",
    dayType: "walking",
    startPlace: "바욘",
    endPlace: "발카로스",
    viaPlaces: ["생장"],
    displayTitle: "바욘 → 발카로스"
  },
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
  selected: false,
  matchSource: "unmatched",
  ...values
});

const options = {
  timezoneOffsetHours: 0,
  dayBoundaryTime: "00:00"
};

describe("autoAssignPhoto", () => {
  it("assigns a photo to the matching schedule Day using DateTimeOriginal", () => {
    expect(
      autoAssignPhoto(photo("p1", { dateTimeOriginal: "2026-02-15T14:22:00" }), schedule, options)
    ).toMatchObject({
      assignedDay: 4,
      matchSource: "DateTimeOriginal",
      effectiveDateTime: "2026-02-15T14:22:00",
      needsUserReview: false
    });
  });

  it("applies timezone correction before matching schedule date", () => {
    expect(
      autoAssignPhoto(photo("p1", { dateTimeOriginal: "2026-02-13T01:30:00" }), schedule, {
        timezoneOffsetHours: -7,
        dayBoundaryTime: "00:00"
      })
    ).toMatchObject({
      assignedDay: 1,
      effectiveDateTime: "2026-02-12T18:30:00"
    });
  });

  it("applies day-boundary correction before matching schedule date", () => {
    expect(
      autoAssignPhoto(photo("p1", { dateTimeOriginal: "2026-02-16T02:30:00" }), schedule, {
        timezoneOffsetHours: 0,
        dayBoundaryTime: "04:00"
      })
    ).toMatchObject({
      assignedDay: 4,
      effectiveDateTime: "2026-02-16T02:30:00"
    });
  });

  it("places photos without usable timestamps into Unmatched", () => {
    expect(autoAssignPhoto(photo("p1", {}), schedule, options)).toMatchObject({
      assignedDay: undefined,
      matchSource: "unmatched",
      needsUserReview: true,
      reviewReason: "unmatched"
    });
  });

  it("places photos outside schedule dates into Unmatched", () => {
    expect(
      autoAssignPhoto(photo("p1", { dateTimeOriginal: "2026-04-01T10:00:00" }), schedule, options)
    ).toMatchObject({
      assignedDay: undefined,
      matchSource: "unmatched",
      effectiveDateTime: "2026-04-01T10:00:00"
    });
  });

  it("preserves manual assignments by default", () => {
    expect(
      autoAssignPhoto(
        photo("p1", {
          dateTimeOriginal: "2026-02-15T14:22:00",
          assignedDay: 1,
          matchSource: "manual"
        }),
        schedule,
        options
      )
    ).toMatchObject({
      assignedDay: 1,
      matchSource: "manual"
    });
  });

  it("can overwrite manual assignments when requested", () => {
    expect(
      autoAssignPhoto(
        photo("p1", {
          dateTimeOriginal: "2026-02-15T14:22:00",
          assignedDay: 1,
          matchSource: "manual"
        }),
        schedule,
        {
          ...options,
          preserveManualAssignments: false
        }
      )
    ).toMatchObject({
      assignedDay: 4,
      matchSource: "DateTimeOriginal"
    });
  });
});

describe("autoAssignPhotos", () => {
  it("returns assignment summary counts", () => {
    const result = autoAssignPhotos(
      [
        photo("assigned", { dateTimeOriginal: "2026-02-15T14:22:00" }),
        photo("unmatched", { dateTimeOriginal: "2026-04-01T10:00:00" })
      ],
      schedule,
      options
    );

    expect(result.totalAssignedAutomatically).toBe(1);
    expect(result.totalUnmatched).toBe(1);
  });
});

describe("manuallyAssignPhotos", () => {
  it("moves selected photos to a target Day", () => {
    const [moved] = manuallyAssignPhotos([photo("p1", {})], ["p1"], 5);

    expect(moved).toMatchObject({
      assignedDay: 5,
      matchSource: "manual"
    });
  });

  it("moves selected photos back to Unmatched", () => {
    const [moved] = manuallyAssignPhotos(
      [photo("p1", { assignedDay: 5, matchSource: "manual" })],
      ["p1"],
      undefined
    );

    expect(moved).toMatchObject({
      assignedDay: undefined,
      matchSource: "manual",
      needsUserReview: true,
      reviewReason: "unmatched"
    });
  });
});
