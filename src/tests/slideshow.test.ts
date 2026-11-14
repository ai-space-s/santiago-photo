import { describe, expect, it } from "vitest";
import {
  buildSlideshow,
  DEFAULT_SLIDESHOW_SETTINGS as defaults,
  normalizeSlideshowSettings
} from "../shared/slideshow";
import type { PhotoItem, ScheduleDay } from "../shared/types";

const day = (n: number): ScheduleDay => ({
  day: n,
  dateRaw: "02월 12일",
  date: "2026-02-12",
  routeText: "바욘-생장-발카로스",
  dayType: "walking",
  startPlace: "바욘",
  endPlace: "발카로스",
  viaPlaces: ["생장"],
  displayTitle: "바욘 → 발카로스"
});
const photo = (id: string, overrides: Partial<PhotoItem> = {}): PhotoItem => ({
  id,
  fileName: `${id}.jpg`,
  originalPath: `D:/photos/${id}.jpg`,
  extension: ".jpg",
  fileSize: 1,
  fileModifiedAt: "2026-02-12T00:00:00",
  assignedDay: 1,
  selected: false,
  matchSource: "DateTimeOriginal",
  ...overrides
});
const photoIds = (result: ReturnType<typeof buildSlideshow>) =>
  result.slides.flatMap((slide) => (slide.kind === "photo" ? [slide.photo.id] : []));

describe("slideshow planning", () => {
  it("inserts covers before each nonempty Day in itinerary order and preserves rest-day text", () => {
    const rest = {
      ...day(2),
      dayType: "rest" as const,
      displayTitle: "발카로스 연박",
      routeText: "연박"
    };
    const result = buildSlideshow(
      [photo("rest", { assignedDay: 2 }), photo("walk")],
      [rest, day(3), day(1)],
      defaults
    );
    expect(result.slides.map((slide) => [slide.kind, slide.day.day])).toEqual([
      ["cover", 1],
      ["photo", 1],
      ["cover", 2],
      ["photo", 2]
    ]);
    expect(result.slides[2].day).toEqual(rest);
    expect(result.durationSeconds).toBe(16);
  });
  it("sorts by corrected/capture timestamps, puts unknown times last and breaks ties deterministically", () => {
    const result = buildSlideshow(
      [
        photo("unknown"),
        photo("late", { dateTimeOriginal: "2026-02-12T23:00:00" }),
        photo("early", {
          effectiveDateTime: "2026-02-12T01:00:00",
          dateTimeOriginal: "2026-02-13T00:00:00"
        }),
        photo("b", { createDate: "2026-02-12T12:00:00" }),
        photo("a", { fileModifyDate: "2026-02-12T12:00:00" }),
        photo("invalid", { dateTimeOriginal: "bad" })
      ],
      [day(1)],
      defaults
    );
    expect(photoIds(result)).toEqual(["early", "a", "b", "late", "invalid", "unknown"]);
  });
  it("combines selection, Day and category filters (categories are OR, filters are AND)", () => {
    const photos = [
      photo("yes", { selected: true, category: "people" }),
      photo("no-selection", { category: "people" }),
      photo("wrong-category", { selected: true, category: "food" }),
      photo("wrong-day", { selected: true, category: "people", assignedDay: 2 }),
      photo("untagged", { selected: true })
    ];
    expect(
      photoIds(
        buildSlideshow(photos, [day(1), day(2)], {
          ...defaults,
          source: "selected",
          dayNumbers: [1],
          categories: ["people", "uncategorized"]
        })
      )
    ).toEqual(["untagged", "yes"]);
  });
  it("honors manual order without changing photos, assignments or selections", () => {
    const photos = [photo("a", { manualOrder: 2 }), photo("b", { manualOrder: 1 }), photo("c")];
    const before = structuredClone(photos);
    expect(photoIds(buildSlideshow(photos, [day(1)], { ...defaults, order: "manual" }))).toEqual([
      "b",
      "a",
      "c"
    ]);
    expect(photos).toEqual(before);
  });
  it("shuffles within each Day while keeping covers and all photos exactly once", () => {
    const photos = [photo("a"), photo("b"), photo("c", { assignedDay: 2 })];
    const result = buildSlideshow(
      photos,
      [day(1), day(2)],
      { ...defaults, order: "shuffle" },
      () => 0
    );
    expect(photoIds(result)).toEqual(["b", "a", "c"]);
    expect(result.slides[3].kind).toBe("cover");
  });
  it("excludes missing/damaged/unassigned photos, but does not reject an EXIF-only error", () => {
    const result = buildSlideshow(
      [
        photo("missing", { missing: true }),
        photo("bad", { reviewReason: "damaged_file" }),
        photo("none", { assignedDay: undefined }),
        photo("orphan", { assignedDay: 99 }),
        photo("valid", { error: "EXIF read error" })
      ],
      [day(1)],
      defaults
    );
    expect(photoIds(result)).toEqual(["valid"]);
    expect(result.excludedUnavailable).toBe(2);
    expect(result.excludedUnassigned).toBe(2);
  });
  it("supports no covers, no chosen Days and empty results", () => {
    expect(buildSlideshow([photo("a")], [day(1)], { ...defaults, dayNumbers: [] }).slides).toEqual(
      []
    );
    const result = buildSlideshow([photo("a")], [day(1)], { ...defaults, showCovers: false });
    expect(result.slides[0].kind).toBe("photo");
    expect(result.durationSeconds).toBe(5);
  });
  it("supplies backward-compatible defaults and clamps invalid persisted timer values", () => {
    expect(normalizeSlideshowSettings()).toEqual(defaults);
    expect(normalizeSlideshowSettings({ photoSeconds: NaN, coverSeconds: -9 })).toMatchObject({
      photoSeconds: 5,
      coverSeconds: 1
    });
    expect(normalizeSlideshowSettings({ photoSeconds: 999 }).photoSeconds).toBe(60);
  });
  it("plans 2,000 photos without dropping or duplicating them", () => {
    const photos = Array.from({ length: 2000 }, (_, i) =>
      photo(`${i}`, { assignedDay: (i % 30) + 1 })
    );
    const result = buildSlideshow(
      photos,
      Array.from({ length: 30 }, (_, i) => day(i + 1)),
      defaults
    );
    expect(result.slides).toHaveLength(2030);
    expect(new Set(photoIds(result)).size).toBe(2000);
  });
});
