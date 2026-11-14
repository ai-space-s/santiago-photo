import type { MatchSource, PhotoItem } from "./types.js";

export type CaptureTimestamp = {
  value: string;
  source: MatchSource;
};

export type CorrectedTimestamp = {
  effectiveDateTime: string;
  assignmentDate: string;
};

const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z)?$/;

const pad2 = (value: number) => value.toString().padStart(2, "0");

const parseDateTimeAsUtcMillis = (timestamp: string) => {
  const match = timestamp.trim().match(DATE_TIME_PATTERN);

  if (!match) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  const [, year, month, day, hour, minute, second = "0"] = match;

  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
};

const formatUtcMillisAsLocalTimestamp = (millis: number) => {
  const date = new Date(millis);

  return [
    date.getUTCFullYear(),
    pad2(date.getUTCMonth() + 1),
    pad2(date.getUTCDate())
  ].join("-") + `T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
};

const formatUtcMillisAsDate = (millis: number) => {
  const date = new Date(millis);

  return [date.getUTCFullYear(), pad2(date.getUTCMonth() + 1), pad2(date.getUTCDate())].join("-");
};

const parseBoundaryMinutes = (dayBoundaryTime: string) => {
  const [hoursRaw, minutesRaw] = dayBoundaryTime.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid day boundary time: ${dayBoundaryTime}`);
  }

  return hours * 60 + minutes;
};

export const selectCaptureTimestamp = (photo: PhotoItem): CaptureTimestamp | undefined => {
  if (photo.dateTimeOriginal) {
    return { value: photo.dateTimeOriginal, source: "DateTimeOriginal" };
  }

  if (photo.createDate) {
    return { value: photo.createDate, source: "CreateDate" };
  }

  if (photo.fileModifyDate) {
    return { value: photo.fileModifyDate, source: "FileModifyDate" };
  }

  return undefined;
};

export const applyTimezoneOffset = (timestamp: string, timezoneOffsetHours: number) => {
  const millis = parseDateTimeAsUtcMillis(timestamp);
  const correctedMillis = millis + timezoneOffsetHours * 60 * 60 * 1000;

  return formatUtcMillisAsLocalTimestamp(correctedMillis);
};

export const getAssignmentDate = (effectiveDateTime: string, dayBoundaryTime: string) => {
  const millis = parseDateTimeAsUtcMillis(effectiveDateTime);
  const date = new Date(millis);
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const boundaryMinutes = parseBoundaryMinutes(dayBoundaryTime);
  const assignmentMillis = minutes < boundaryMinutes ? millis - 24 * 60 * 60 * 1000 : millis;

  return formatUtcMillisAsDate(assignmentMillis);
};

export const applyTimeCorrection = (
  timestamp: string,
  timezoneOffsetHours: number,
  dayBoundaryTime: string
): CorrectedTimestamp => {
  const effectiveDateTime = applyTimezoneOffset(timestamp, timezoneOffsetHours);

  return {
    effectiveDateTime,
    assignmentDate: getAssignmentDate(effectiveDateTime, dayBoundaryTime)
  };
};
