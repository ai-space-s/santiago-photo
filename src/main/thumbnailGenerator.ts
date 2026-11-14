import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { mapWithConcurrency } from "./concurrency.js";
import type { PhotoItem } from "../shared/types.js";

export type ThumbnailOptions = {
  size?: number;
  quality?: number;
};

export const DEFAULT_THUMBNAIL_CONCURRENCY = 8;

export type GenerateThumbnailsOptions = ThumbnailOptions & {
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
};

export type ThumbnailResult = {
  photo: PhotoItem;
  cacheHit: boolean;
};

const DEFAULT_THUMBNAIL_SIZE = 320;
const DEFAULT_THUMBNAIL_QUALITY = 82;

export const createThumbnailCacheKey = (photo: PhotoItem) =>
  crypto
    .createHash("sha1")
    .update(`${photo.originalPath}:${photo.fileSize}:${photo.fileModifiedAt}`)
    .digest("hex");

export const getThumbnailPath = (thumbnailCacheDir: string, photo: PhotoItem) =>
  path.join(thumbnailCacheDir, `thumb_${createThumbnailCacheKey(photo)}.jpg`);

export const createThumbnailUrl = (thumbnailPath: string) =>
  `camino-thumbnail://thumb/${Buffer.from(thumbnailPath, "utf8").toString("base64url")}`;

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const generateThumbnail = async (
  photo: PhotoItem,
  thumbnailCacheDir: string,
  options: ThumbnailOptions = {}
): Promise<ThumbnailResult> => {
  await fs.mkdir(thumbnailCacheDir, { recursive: true });

  const thumbnailPath = getThumbnailPath(thumbnailCacheDir, photo);

  if (await fileExists(thumbnailPath)) {
    return {
      photo: {
        ...photo,
        thumbnailPath,
        thumbnailUrl: createThumbnailUrl(thumbnailPath)
      },
      cacheHit: true
    };
  }

  try {
    await sharp(photo.originalPath, { failOn: "none" })
      .rotate()
      .resize({
        width: options.size ?? DEFAULT_THUMBNAIL_SIZE,
        height: options.size ?? DEFAULT_THUMBNAIL_SIZE,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: options.quality ?? DEFAULT_THUMBNAIL_QUALITY })
      .toFile(thumbnailPath);

    return {
      photo: {
        ...photo,
        thumbnailPath,
        thumbnailUrl: createThumbnailUrl(thumbnailPath)
      },
      cacheHit: false
    };
  } catch (error) {
    return {
      photo: {
        ...photo,
        error: error instanceof Error ? error.message : "Could not generate thumbnail."
      },
      cacheHit: false
    };
  }
};

export const generateThumbnails = async (
  photos: PhotoItem[],
  thumbnailCacheDir: string,
  options: GenerateThumbnailsOptions = {}
) => {
  const total = photos.length;
  let completed = 0;

  return mapWithConcurrency(
    photos,
    options.concurrency ?? DEFAULT_THUMBNAIL_CONCURRENCY,
    async (photo) => {
      const result = await generateThumbnail(photo, thumbnailCacheDir, options);
      completed += 1;
      options.onProgress?.(completed, total);
      return result;
    }
  );
};
