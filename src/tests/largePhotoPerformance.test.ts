import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { scanPhotoDirectory } from "../main/fileSystem";
import { generateThumbnail } from "../main/thumbnailGenerator";
import { autoAssignPhotos } from "../shared/autoAssigner";
import { buildExportPreview } from "../shared/exportValidator";
import type { PhotoItem, ScheduleDay } from "../shared/types";

const PHOTO_COUNT = 2_000;
const tempDirs: string[] = [];

const createTempDir = async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "camino-large-photo-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const createSchedule = (): ScheduleDay[] =>
  Array.from({ length: 40 }, (_, index) => {
    const day = index + 1;
    const date = new Date(Date.UTC(2026, 1, 11 + day));
    const isoDate = date.toISOString().slice(0, 10);

    return {
      day,
      dateRaw: `02월 ${String(11 + day).padStart(2, "0")}일`,
      date: isoDate,
      routeText: `Start ${day} → End ${day}`,
      dayType: "walking",
      startPlace: `Start ${day}`,
      endPlace: `End ${day}`,
      viaPlaces: [],
      displayTitle: `Start ${day} → End ${day}`
    };
  });

const createPhotoItems = (count: number): PhotoItem[] =>
  Array.from({ length: count }, (_, index) => {
    const day = (index % 40) + 1;
    const date = new Date(Date.UTC(2026, 1, 11 + day, 12, index % 60, 0));
    const id = `photo-${String(index + 1).padStart(4, "0")}`;

    return {
      id,
      originalPath: `C:/Photos/${id}.jpg`,
      fileName: `${id}.jpg`,
      extension: ".jpg",
      fileSize: 1024 + index,
      fileModifiedAt: date.toISOString().replace("Z", ""),
      dateTimeOriginal: date.toISOString().replace("Z", ""),
      selected: index < 250,
      matchSource: "unmatched"
    };
  });

const measure = async <T>(work: () => Promise<T> | T) => {
  const startedAt = performance.now();
  const result = await work();
  const durationMs = performance.now() - startedAt;

  return { result, durationMs };
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true, force: true }))
  );
});

describe("large photo performance", () => {
  it(
    "scans at least 2,000 JPG files without blocking the async scanner path",
    async () => {
      const tempDir = await createTempDir();

      await Promise.all(
        Array.from({ length: PHOTO_COUNT }, (_, index) =>
          fs.writeFile(path.join(tempDir, `IMG_${String(index + 1).padStart(4, "0")}.jpg`), "x")
        )
      );

      const { result, durationMs } = await measure(() => scanPhotoDirectory(tempDir));

      expect(result.photos).toHaveLength(PHOTO_COUNT);
      expect(result.errors).toEqual([]);
      expect(durationMs).toBeLessThan(15_000);
    },
    30_000
  );

  it("auto-assigns and builds export preview for 2,000 photo records quickly", async () => {
    const schedule = createSchedule();
    const photos = createPhotoItems(PHOTO_COUNT);

    const assignment = await measure(() =>
      autoAssignPhotos(photos, schedule, {
        timezoneOffsetHours: 0,
        dayBoundaryTime: "04:00"
      })
    );
    const preview = await measure(() =>
      buildExportPreview(assignment.result.photos, schedule, {
        outputDir: "C:/Output"
      })
    );

    expect(assignment.result.photos).toHaveLength(PHOTO_COUNT);
    expect(assignment.result.totalAssignedAutomatically).toBe(PHOTO_COUNT);
    expect(preview.result.items).toHaveLength(250);
    expect(preview.result.canExport).toBe(true);
    expect(assignment.durationMs + preview.durationMs).toBeLessThan(5_000);
  });

  it("reuses thumbnail cache on repeated generation", async () => {
    const tempDir = await createTempDir();
    const imagePath = path.join(tempDir, "IMG_0001.jpg");
    const cacheDir = path.join(tempDir, ".camino_cache", "thumbnails");

    await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: "#4f7cff"
      }
    })
      .jpeg()
      .toFile(imagePath);

    const stats = await fs.stat(imagePath);
    const photo: PhotoItem = {
      id: "photo-1",
      originalPath: imagePath,
      fileName: "IMG_0001.jpg",
      extension: ".jpg",
      fileSize: stats.size,
      fileModifiedAt: stats.mtime.toISOString(),
      selected: false,
      matchSource: "unmatched"
    };

    const first = await generateThumbnail(photo, cacheDir);
    const cached = await measure(async () => {
      for (let index = 0; index < 100; index += 1) {
        const result = await generateThumbnail(photo, cacheDir);
        expect(result.cacheHit).toBe(true);
      }
    });

    expect(first.cacheHit).toBe(false);
    expect(first.photo.thumbnailPath).toBeDefined();
    expect(cached.durationMs).toBeLessThan(2_000);
  });
});
