import { describe, expect, it } from "vitest";
import {
  applyTimeCorrection,
  applyTimezoneOffset,
  getAssignmentDate,
  selectCaptureTimestamp
} from "../shared/timeCorrection";
import type { PhotoItem } from "../shared/types";

const photo = (values: Partial<PhotoItem>): PhotoItem => ({
  id: "photo-1",
  originalPath: "C:/Photos/IMG_0001.jpg",
  fileName: "IMG_0001.jpg",
  extension: ".jpg",
  fileSize: 1,
  fileModifiedAt: "2026-02-13T10:00:00",
  selected: false,
  matchSource: "unmatched",
  ...values
});

describe("selectCaptureTimestamp", () => {
  it("prefers DateTimeOriginal over CreateDate and FileModifyDate", () => {
    expect(
      selectCaptureTimestamp(
        photo({
          dateTimeOriginal: "2026-02-15T14:22:00",
          createDate: "2026-02-15T14:23:00",
          fileModifyDate: "2026-02-16T10:01:00"
        })
      )
    ).toEqual({
      value: "2026-02-15T14:22:00",
      source: "DateTimeOriginal"
    });
  });

  it("uses CreateDate when DateTimeOriginal is missing", () => {
    expect(
      selectCaptureTimestamp(
        photo({
          createDate: "2026-02-15T14:23:00",
          fileModifyDate: "2026-02-16T10:01:00"
        })
      )?.source
    ).toBe("CreateDate");
  });

  it("uses FileModifyDate when EXIF capture timestamps are missing", () => {
    expect(selectCaptureTimestamp(photo({ fileModifyDate: "2026-02-16T10:01:00" }))).toEqual({
      value: "2026-02-16T10:01:00",
      source: "FileModifyDate"
    });
  });

  it("returns undefined when no usable timestamp exists", () => {
    expect(selectCaptureTimestamp(photo({}))).toBeUndefined();
  });
});

describe("time correction", () => {
  it("applies timezone offset without depending on the OS timezone", () => {
    expect(applyTimezoneOffset("2026-02-13T01:30:00", -7)).toBe("2026-02-12T18:30:00");
  });

  it("moves early-morning photos to the previous assignment date using day boundary", () => {
    expect(getAssignmentDate("2026-02-16T02:30:00", "04:00")).toBe("2026-02-15");
  });

  it("returns effective datetime and assignment date together", () => {
    expect(applyTimeCorrection("2026-02-13T01:30:00", -7, "04:00")).toEqual({
      effectiveDateTime: "2026-02-12T18:30:00",
      assignmentDate: "2026-02-12"
    });
  });
});
