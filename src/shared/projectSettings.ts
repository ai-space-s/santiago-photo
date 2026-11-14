import { autoAssignPhotos } from "./autoAssigner.js";
import { parseScheduleDate } from "./dateParser.js";
import type { Project } from "./types.js";

export type ProjectSettings = Pick<
  Project,
  "projectYear" | "timezoneOffsetHours" | "dayBoundaryTime" | "thumbnailSize"
>;

export const updateProjectSettings = (
  project: Project,
  values: Partial<ProjectSettings>
): Project => {
  const next = { ...project, ...values };
  if (!Number.isInteger(next.projectYear) || next.projectYear < 1900 || next.projectYear > 9999)
    throw new Error("연도는 1900~9999 사이의 정수여야 합니다.");
  if (!Number.isFinite(next.timezoneOffsetHours) || Math.abs(next.timezoneOffsetHours) > 24)
    throw new Error("시간 보정값은 -24~24 사이여야 합니다.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.dayBoundaryTime))
    throw new Error("하루 경계 시각을 확인하세요.");
  if (values.projectYear !== undefined)
    next.schedule = project.schedule.map((day) => ({
      ...day,
      date: parseScheduleDate(day.dateRaw, next.projectYear).date
    }));
  if (
    values.projectYear !== undefined ||
    values.timezoneOffsetHours !== undefined ||
    values.dayBoundaryTime !== undefined
  ) {
    next.photos = autoAssignPhotos(project.photos, next.schedule, next).photos;
  }
  return next;
};
