import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  createThumbnailCacheKey,
  generateThumbnail,
  generateThumbnails,
  getThumbnailPath
} from "../main/thumbnailGenerator";
import type { PhotoItem } from "../shared/types";

const tempDirs: string[] = [];

const createTempDir = async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "camino-thumbnails-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const createImage = async (filePath: string, width = 640, height = 480) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#4f7cff"
    }
  })
    .jpeg()
    .toFile(filePath);
};

const createPhoto = async (filePath: string): Promise<PhotoItem> => {
  const stats = await fs.stat(filePath);

  return {
    id: path.basename(filePath),
    originalPath: filePath,
    fileName: path.basename(filePath),
    extension: path.extname(filePath),
    fileSize: stats.size,
    fileModifiedAt: stats.mtime.toISOString(),
    selected: false,
    matchSource: "unmatched"
  };
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true, force: true }))
  );
});

describe("thumbnail cache keys", () => {
  it("uses original path, file size, and modified time", async () => {
    const tempDir = await createTempDir();
    const filePath = path.join(tempDir, "IMG_0001.jpg");
    await createImage(filePath);
    const photo = await createPhoto(filePath);

    expect(createThumbnailCacheKey(photo)).not.toBe(
      createThumbnailCacheKey({
        ...photo,
        fileModifiedAt: "2026-02-12T00:00:00.000Z"
      })
    );
    expect(getThumbnailPath(path.join(tempDir, ".camino_cache", "thumbnails"), photo)).toContain(
      "thumb_"
    );
  });
});

describe("generateThumbnail", () => {
  it("generates a thumbnail in the project-local cache directory", async () => {
    const tempDir = await createTempDir();
    const imagePath = path.join(tempDir, "IMG_0001.jpg");
    const cacheDir = path.join(tempDir, ".camino_cache", "thumbnails");
    await createImage(imagePath);

    const result = await generateThumbnail(await createPhoto(imagePath), cacheDir, { size: 120 });

    expect(result.cacheHit).toBe(false);
    expect(result.photo.thumbnailPath).toBeDefined();
    expect(result.photo.thumbnailUrl).toMatch(/^camino-thumbnail:\/\/thumb\//);
    await expect(fs.access(result.photo.thumbnailPath as string)).resolves.toBeUndefined();

    const metadata = await sharp(result.photo.thumbnailPath as string).metadata();
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(120);
  });

  it("reuses an existing valid cache file", async () => {
    const tempDir = await createTempDir();
    const imagePath = path.join(tempDir, "IMG_0001.jpg");
    const cacheDir = path.join(tempDir, ".camino_cache", "thumbnails");
    await createImage(imagePath);
    const photo = await createPhoto(imagePath);

    const first = await generateThumbnail(photo, cacheDir);
    const second = await generateThumbnail(photo, cacheDir);

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.photo.thumbnailPath).toBe(first.photo.thumbnailPath);
  });

  it("uses a different cache path when the source metadata changes", async () => {
    const tempDir = await createTempDir();
    const imagePath = path.join(tempDir, "IMG_0001.jpg");
    const cacheDir = path.join(tempDir, ".camino_cache", "thumbnails");
    await createImage(imagePath, 640, 480);
    const firstPhoto = await createPhoto(imagePath);
    const first = await generateThumbnail(firstPhoto, cacheDir);
    const changedPhoto = {
      ...firstPhoto,
      fileSize: firstPhoto.fileSize + 1,
      fileModifiedAt: "2026-02-12T00:00:00.000Z"
    };
    const second = await generateThumbnail(changedPhoto, cacheDir);

    expect(second.cacheHit).toBe(false);
    expect(second.photo.thumbnailPath).not.toBe(first.photo.thumbnailPath);
  });

  it("records an error instead of throwing for damaged images", async () => {
    const tempDir = await createTempDir();
    const imagePath = path.join(tempDir, "broken.jpg");
    const cacheDir = path.join(tempDir, ".camino_cache", "thumbnails");
    await fs.writeFile(imagePath, "not an image");

    const result = await generateThumbnail(await createPhoto(imagePath), cacheDir);

    expect(result.photo.thumbnailPath).toBeUndefined();
    expect(result.photo.error).toBeDefined();
  });
});

describe("generateThumbnails", () => {
  it("generates thumbnails for multiple photos", async () => {
    const tempDir = await createTempDir();
    const firstPath = path.join(tempDir, "IMG_0001.jpg");
    const secondPath = path.join(tempDir, "IMG_0002.jpg");
    const cacheDir = path.join(tempDir, ".camino_cache", "thumbnails");
    await createImage(firstPath);
    await createImage(secondPath);

    const results = await generateThumbnails(
      [await createPhoto(firstPath), await createPhoto(secondPath)],
      cacheDir
    );

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.photo.thumbnailPath)).toBe(true);
  });

  it("reports progress up to the total while generating", async () => {
    const tempDir = await createTempDir();
    const firstPath = path.join(tempDir, "IMG_0001.jpg");
    const secondPath = path.join(tempDir, "IMG_0002.jpg");
    const cacheDir = path.join(tempDir, ".camino_cache", "thumbnails");
    await createImage(firstPath);
    await createImage(secondPath);
    const progressUpdates: Array<{ completed: number; total: number }> = [];

    await generateThumbnails(
      [await createPhoto(firstPath), await createPhoto(secondPath)],
      cacheDir,
      { onProgress: (completed, total) => progressUpdates.push({ completed, total }) }
    );

    expect(progressUpdates).toHaveLength(2);
    expect(progressUpdates[progressUpdates.length - 1]).toEqual({ completed: 2, total: 2 });
  });
});
