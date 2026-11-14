import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../main/projectStore";
import { updateProjectSettings } from "../shared/projectSettings";
import { manuallyAssignPhotos } from "../shared/autoAssigner";
import type { PhotoItem } from "../shared/types";

const fixture = () => {
  const project = createEmptyProject({
    projectName: "test",
    projectYear: 2026,
    projectFilePath: "test.json"
  });
  project.schedule = [1, 2].map((day) => ({
    day,
    date: `2026-02-${11 + day}`,
    dateRaw: `02월 ${11 + day}일`,
    routeText: "A → B",
    dayType: "walking",
    viaPlaces: [],
    displayTitle: "A → B"
  }));
  const photo: PhotoItem = {
    id: "auto",
    originalPath: "photo.jpg",
    fileName: "photo.jpg",
    extension: ".jpg",
    fileSize: 1,
    fileModifiedAt: "2026-02-12T23:30:00",
    dateTimeOriginal: "2026-02-12T23:30:00",
    selected: true,
    assignedDay: 1,
    matchSource: "DateTimeOriginal"
  };
  project.photos = [photo, { ...photo, id: "manual", matchSource: "manual" }];
  return project;
};

describe("project settings", () => {
  it("updates timezone assignments and preserves manual choices and selections", () => {
    const project = fixture();
    const next = updateProjectSettings(project, {
      timezoneOffsetHours: 1,
      dayBoundaryTime: "00:00"
    });
    expect(next.photos.map((photo) => photo.assignedDay)).toEqual([2, 1]);
    expect(next.photos.every((photo) => photo.selected)).toBe(true);
    expect(project.photos[0].assignedDay).toBe(1);
  });
  it("renormalizes schedule dates and rejects invalid leap dates atomically", () => {
    const project = fixture();
    expect(updateProjectSettings(project, { projectYear: 2027 }).schedule[0].date).toBe(
      "2027-02-12"
    );
    project.schedule[0].dateRaw = "02월 29일";
    expect(() => updateProjectSettings(project, { projectYear: 2027 })).toThrow();
    expect(project.projectYear).toBe(2026);
  });
  it("preserves manual moves to Unmatched through settings changes", () => {
    const project = fixture();
    project.photos = manuallyAssignPhotos(project.photos, ["auto", "manual"], undefined);
    const next = updateProjectSettings(project, { timezoneOffsetHours: 1 });
    expect(
      next.photos.every(
        (photo) => photo.assignedDay === undefined && photo.matchSource === "manual"
      )
    ).toBe(true);
  });
  it("changes thumbnail size without altering assignment", () => {
    const project = fixture();
    const next = updateProjectSettings(project, { thumbnailSize: 320 });
    expect(next.thumbnailSize).toBe(320);
    expect(next.photos).toBe(project.photos);
  });
});
