import { describe, expect, it } from "vitest";
import {
  applyExifMetadataToPhoto,
  enrichPhotoWithExif,
  enrichPhotosWithExif,
  type ExifReader
} from "../main/exifReader";
import type { PhotoItem } from "../shared/types";

const photo = (values: Partial<PhotoItem>): PhotoItem => ({
  id: "photo-1",
  originalPath: "C:/Photos/IMG_0001.jpg",
  fileName: "IMG_0001.jpg",
  extension: ".jpg",
  fileSize: 1,
  fileModifiedAt: "2026-02-16T10:01:00",
  selected: false,
  matchSource: "unmatched",
  ...values
});

describe("applyExifMetadataToPhoto", () => {
  it("adds EXIF date fields to a photo item", () => {
    expect(
      applyExifMetadataToPhoto(photo({}), {
        dateTimeOriginal: "2026-02-15T14:22:00",
        createDate: "2026-02-15T14:22:01",
        fileModifyDate: "2026-02-16T10:01:00"
      })
    ).toMatchObject({
      dateTimeOriginal: "2026-02-15T14:22:00",
      createDate: "2026-02-15T14:22:01",
      fileModifyDate: "2026-02-16T10:01:00"
    });
  });

  it("marks PNG files without EXIF capture time for user review", () => {
    expect(applyExifMetadataToPhoto(photo({ extension: ".png" }), {})).toMatchObject({
      fileModifyDate: "2026-02-16T10:01:00",
      needsUserReview: true,
      reviewReason: "missing_exif"
    });
  });

  it("does not mark JPG files with FileModifyDate fallback as missing EXIF review", () => {
    expect(applyExifMetadataToPhoto(photo({ extension: ".jpg" }), {})).toMatchObject({
      fileModifyDate: "2026-02-16T10:01:00",
      needsUserReview: undefined
    });
  });
});

describe("enrichPhotoWithExif", () => {
  it("uses an injected reader to enrich photo metadata", async () => {
    const reader: ExifReader = async () => ({
      dateTimeOriginal: "2026-02-15T14:22:00"
    });

    await expect(enrichPhotoWithExif(photo({}), reader)).resolves.toMatchObject({
      dateTimeOriginal: "2026-02-15T14:22:00"
    });
  });

  it("records reader errors without throwing", async () => {
    const reader: ExifReader = async () => {
      throw new Error("bad image");
    };

    await expect(enrichPhotoWithExif(photo({}), reader)).resolves.toMatchObject({
      error: "bad image"
    });
  });
});

describe("enrichPhotosWithExif", () => {
  it("preserves input order and reports progress up to the total", async () => {
    const photos = [photo({ id: "p1" }), photo({ id: "p2" }), photo({ id: "p3" })];
    const reader: ExifReader = async () => ({ dateTimeOriginal: "2026-02-15T14:22:00" });
    const progressUpdates: Array<{ completed: number; total: number }> = [];

    const results = await enrichPhotosWithExif(photos, reader, {
      concurrency: 2,
      onProgress: (completed, total) => progressUpdates.push({ completed, total })
    });

    expect(results.map((item) => item.id)).toEqual(["p1", "p2", "p3"]);
    expect(progressUpdates).toHaveLength(3);
    expect(progressUpdates[progressUpdates.length - 1]).toEqual({ completed: 3, total: 3 });
    expect(progressUpdates.every(({ total }) => total === 3)).toBe(true);
  });
});
