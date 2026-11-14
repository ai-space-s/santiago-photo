import type { PhotoCategory, PhotoItem, ScheduleDay, SlideshowSettings } from "./types.js";

export const PHOTO_CATEGORIES: Record<PhotoCategory | "uncategorized", string> = {
  landscape: "풍경",
  people: "인물",
  food: "음식",
  lodging: "숙소",
  trail: "길 / 표지",
  other: "기타",
  uncategorized: "미분류"
};

export const DEFAULT_SLIDESHOW_SETTINGS: SlideshowSettings = {
  source: "all",
  dayNumbers: null,
  categories: [],
  order: "chronological",
  photoSeconds: 5,
  coverSeconds: 3,
  showCovers: true,
  showCaptions: true,
  loop: false
};

export type SlideshowSlide =
  | { kind: "cover"; day: ScheduleDay; photoCount: number }
  | { kind: "photo"; day: ScheduleDay; photo: PhotoItem };

const seconds = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(60, Math.max(1, value)) : fallback;

// Old projects need no migration. Bound persisted settings before they reach timers.
export const normalizeSlideshowSettings = (
  value?: Partial<SlideshowSettings>
): SlideshowSettings => ({
  source: value?.source === "selected" ? "selected" : "all",
  dayNumbers: Array.isArray(value?.dayNumbers)
    ? [...new Set(value.dayNumbers.filter(Number.isInteger))]
    : null,
  categories: Array.isArray(value?.categories)
    ? [...new Set(value.categories.filter((category) => Object.hasOwn(PHOTO_CATEGORIES, category)))]
    : [],
  order: value?.order === "manual" || value?.order === "shuffle" ? value.order : "chronological",
  photoSeconds: seconds(value?.photoSeconds, 5),
  coverSeconds: seconds(value?.coverSeconds, 3),
  showCovers: value?.showCovers !== false,
  showCaptions: value?.showCaptions !== false,
  loop: value?.loop === true
});

export const slideshowTimestamp = (photo: PhotoItem) =>
  photo.effectiveDateTime || photo.dateTimeOriginal || photo.createDate || photo.fileModifyDate;

const timestampValue = (photo: PhotoItem) => {
  const value = slideshowTimestamp(photo);
  if (!value) return Infinity;
  // EXIF wall-clock values have no zone; do not make ordering depend on the host timezone.
  const normalized = value.replace(" ", "T");
  const time = Date.parse(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`
  );
  return Number.isFinite(time) ? time : Infinity;
};

export const buildSlideshow = (
  photos: readonly PhotoItem[],
  schedule: readonly ScheduleDay[],
  input: SlideshowSettings,
  random: () => number = Math.random
) => {
  const settings = normalizeSlideshowSettings(input);
  const days = new Map(schedule.map((day) => [day.day, day]));
  const includedDays = settings.dayNumbers === null ? null : new Set(settings.dayNumbers);
  const groups = new Map<number, PhotoItem[]>();
  let excludedUnavailable = 0;
  let excludedUnassigned = 0;
  for (const photo of photos) {
    if (settings.source === "selected" && !photo.selected) continue;
    if (
      settings.categories.length &&
      !settings.categories.includes(photo.category ?? "uncategorized")
    )
      continue;
    if (photo.assignedDay === undefined || !days.has(photo.assignedDay)) {
      excludedUnassigned++;
      continue;
    }
    if (includedDays && !includedDays.has(photo.assignedDay)) continue;
    if (photo.missing || photo.reviewReason === "damaged_file") {
      excludedUnavailable++;
      continue;
    }
    const group = groups.get(photo.assignedDay) ?? [];
    group.push(photo);
    groups.set(photo.assignedDay, group);
  }
  const slides: SlideshowSlide[] = [];
  const timeById = new Map(photos.map((photo) => [photo.id, timestampValue(photo)]));
  const compareTime = (a: PhotoItem, b: PhotoItem) =>
    timeById.get(a.id)! - timeById.get(b.id)! ||
    a.fileName.localeCompare(b.fileName) ||
    a.id.localeCompare(b.id);
  const orderedDays = [...schedule].sort((a, b) => a.day - b.day);
  for (const day of orderedDays) {
    const group = groups.get(day.day);
    if (!group?.length) continue;
    group.sort(
      settings.order === "manual"
        ? (a, b) => (a.manualOrder ?? Infinity) - (b.manualOrder ?? Infinity) || compareTime(a, b)
        : compareTime
    );
    if (settings.order === "shuffle") {
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
        [group[i], group[j]] = [group[j], group[i]];
      }
    }
    if (settings.showCovers) slides.push({ kind: "cover", day, photoCount: group.length });
    slides.push(...group.map((photo): SlideshowSlide => ({ kind: "photo", day, photo })));
  }
  const photoCount = [...groups.values()].reduce((sum, group) => sum + group.length, 0);
  return {
    slides,
    photoCount,
    dayCount: groups.size,
    excludedUnavailable,
    excludedUnassigned,
    durationSeconds:
      photoCount * settings.photoSeconds +
      (settings.showCovers ? groups.size * settings.coverSeconds : 0)
  };
};
