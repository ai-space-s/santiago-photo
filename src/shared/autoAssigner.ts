import { applyTimeCorrection, selectCaptureTimestamp } from "./timeCorrection.js";
import type { PhotoItem, ScheduleDay } from "./types.js";

export type AutoAssignOptions = {
  timezoneOffsetHours: number;
  dayBoundaryTime: string;
  preserveManualAssignments?: boolean;
};

export type AutoAssignResult = {
  photos: PhotoItem[];
  totalAssignedAutomatically: number;
  totalUnmatched: number;
};

const buildScheduleDateIndex = (schedule: ScheduleDay[]) =>
  new Map(schedule.map((scheduleDay) => [scheduleDay.date, scheduleDay.day]));

const markUnmatched = (photo: PhotoItem, effectiveDateTime?: string): PhotoItem => ({
  ...photo,
  effectiveDateTime,
  assignedDay: undefined,
  matchSource: "unmatched",
  needsUserReview: true,
  reviewReason: photo.reviewReason ?? "unmatched"
});

export const autoAssignPhoto = (
  photo: PhotoItem,
  schedule: ScheduleDay[],
  options: AutoAssignOptions
): PhotoItem => {
  if (options.preserveManualAssignments !== false && photo.matchSource === "manual") {
    return photo;
  }

  const timestamp = selectCaptureTimestamp(photo);

  if (!timestamp) {
    return markUnmatched(photo);
  }

  try {
    const corrected = applyTimeCorrection(
      timestamp.value,
      options.timezoneOffsetHours,
      options.dayBoundaryTime
    );
    const scheduleDateIndex = buildScheduleDateIndex(schedule);
    const assignedDay = scheduleDateIndex.get(corrected.assignmentDate);

    if (!assignedDay) {
      return markUnmatched(photo, corrected.effectiveDateTime);
    }

    return {
      ...photo,
      effectiveDateTime: corrected.effectiveDateTime,
      assignedDay,
      matchSource: timestamp.source,
      needsUserReview: photo.reviewReason === "missing_exif" ? photo.needsUserReview : false,
      reviewReason: photo.reviewReason === "missing_exif" ? photo.reviewReason : undefined
    };
  } catch (error) {
    return {
      ...markUnmatched(photo),
      error: error instanceof Error ? error.message : "Could not auto assign photo."
    };
  }
};

export const autoAssignPhotos = (
  photos: PhotoItem[],
  schedule: ScheduleDay[],
  options: AutoAssignOptions
): AutoAssignResult => {
  const assignedPhotos = photos.map((photo) => autoAssignPhoto(photo, schedule, options));

  return {
    photos: assignedPhotos,
    totalAssignedAutomatically: assignedPhotos.filter(
      (photo) => photo.assignedDay !== undefined && photo.matchSource !== "manual"
    ).length,
    totalUnmatched: assignedPhotos.filter((photo) => photo.assignedDay === undefined).length
  };
};

export const manuallyAssignPhotos = (
  photos: PhotoItem[],
  photoIds: string[],
  assignedDay: number | undefined
): PhotoItem[] => {
  const targetIds = new Set(photoIds);

  return photos.map((photo) =>
    targetIds.has(photo.id)
      ? {
          ...photo,
          assignedDay,
          matchSource: "manual",
          needsUserReview: assignedDay === undefined ? true : photo.reviewReason === "missing_exif",
          reviewReason: assignedDay === undefined ? "unmatched" : photo.reviewReason
        }
      : photo
  );
};
