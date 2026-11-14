import type { PhotoItem, ScheduleDay } from "./types.js";

const MAX_NAME_PART_LENGTH = 80;
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*]/g;

export type FileNameParts = {
  folderName: string;
  fileName: string;
};

export const sanitizeFileNamePart = (value: string, fallback = "Untitled") => {
  const sanitized = value
    .trim()
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(UNSAFE_FILENAME_CHARS, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .slice(0, MAX_NAME_PART_LENGTH)
    .trim();

  return sanitized || fallback;
};

const formatDay = (day: number) => `D${day.toString().padStart(2, "0")}`;

const formatSequence = (sequence: number) => sequence.toString().padStart(3, "0");

const normalizeExtension = (extension: string) => {
  const trimmed = extension.trim();
  const withDot = trimmed.startsWith(".") ? trimmed : `.${trimmed}`;

  return withDot.toLowerCase();
};

const getRestPlace = (scheduleDay: ScheduleDay) =>
  scheduleDay.endPlace || scheduleDay.startPlace || "Rest-Day";

export const buildDayFolderName = (scheduleDay: ScheduleDay) => {
  const day = formatDay(scheduleDay.day);

  if (scheduleDay.dayType === "rest") {
    return `${day}_${sanitizeFileNamePart(getRestPlace(scheduleDay))}_Rest`;
  }

  const start = sanitizeFileNamePart(scheduleDay.startPlace || "Unknown-Start");
  const end = sanitizeFileNamePart(scheduleDay.endPlace || "Unknown-End");

  return `${day}_${start}_to_${end}`;
};

export const buildPhotoFileName = (
  scheduleDay: ScheduleDay,
  sequence: number,
  extension: string
) => {
  const folderName = buildDayFolderName(scheduleDay);

  return `${folderName}_${formatSequence(sequence)}${normalizeExtension(extension)}`;
};

export const buildFileNameParts = (
  scheduleDay: ScheduleDay,
  sequence: number,
  extension: string
): FileNameParts => ({
  folderName: buildDayFolderName(scheduleDay),
  fileName: buildPhotoFileName(scheduleDay, sequence, extension)
});

const getSortTimestamp = (photo: PhotoItem) =>
  photo.effectiveDateTime ||
  photo.dateTimeOriginal ||
  photo.createDate ||
  photo.fileModifyDate ||
  photo.fileModifiedAt ||
  "";

const compareWithinDay = (left: PhotoItem, right: PhotoItem) => {
  const leftManualOrder = left.manualOrder ?? Number.POSITIVE_INFINITY;
  const rightManualOrder = right.manualOrder ?? Number.POSITIVE_INFINITY;

  if (leftManualOrder !== rightManualOrder) {
    return leftManualOrder - rightManualOrder;
  }

  const timestampCompare = getSortTimestamp(left).localeCompare(getSortTimestamp(right));

  if (timestampCompare !== 0) {
    return timestampCompare;
  }

  return left.fileName.localeCompare(right.fileName);
};

export const sortPhotosForSequence = (photos: PhotoItem[]) => [...photos].sort(compareWithinDay);

export const sortPhotosForDisplay = (photos: PhotoItem[]) =>
  [...photos].sort((left, right) => {
    const leftDay = left.assignedDay ?? Number.POSITIVE_INFINITY;
    const rightDay = right.assignedDay ?? Number.POSITIVE_INFINITY;

    if (leftDay !== rightDay) {
      return leftDay - rightDay;
    }

    return compareWithinDay(left, right);
  });

export const assignSequencesForDay = (photos: PhotoItem[]) =>
  sortPhotosForSequence(photos).map((photo, index) => ({
    ...photo,
    sequence: index + 1
  }));
