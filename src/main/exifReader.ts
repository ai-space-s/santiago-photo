import exifr from "exifr";
import { mapWithConcurrency } from "./concurrency.js";
import type { PhotoItem } from "../shared/types.js";

export const DEFAULT_EXIF_READ_CONCURRENCY = 8;

export type EnrichPhotosWithExifOptions = {
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
};

export type ExifMetadata = {
  dateTimeOriginal?: string;
  createDate?: string;
  fileModifyDate?: string;
};

export type ExifReader = (filePath: string) => Promise<ExifMetadata>;

const pad2 = (value: number) => value.toString().padStart(2, "0");

const normalizeExifDate = (value: unknown): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}T${pad2(
      value.getHours()
    )}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const exifMatch = trimmed.match(
      /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/
    );

    if (exifMatch) {
      const [, year, month, day, hour, minute, second = "00"] = exifMatch;
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    }

    return trimmed.replace(" ", "T").replace(/\.\d{1,3}Z?$/, "").replace(/Z$/, "");
  }

  return undefined;
};

export const readExifMetadata: ExifReader = async (filePath: string) => {
  const metadata = (await exifr.parse(filePath, {
    pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"]
  })) as Record<string, unknown> | undefined;

  return {
    dateTimeOriginal: normalizeExifDate(metadata?.DateTimeOriginal),
    createDate: normalizeExifDate(metadata?.CreateDate),
    fileModifyDate: normalizeExifDate(metadata?.ModifyDate)
  };
};

export const applyExifMetadataToPhoto = (
  photo: PhotoItem,
  metadata: ExifMetadata,
  error?: string
): PhotoItem => {
  const fileModifyDate = metadata.fileModifyDate ?? photo.fileModifyDate ?? photo.fileModifiedAt;
  const hasExifCaptureTime = Boolean(metadata.dateTimeOriginal || metadata.createDate);
  const needsMissingExifReview = !hasExifCaptureTime && photo.extension.toLowerCase() === ".png";

  return {
    ...photo,
    dateTimeOriginal: metadata.dateTimeOriginal,
    createDate: metadata.createDate,
    fileModifyDate,
    needsUserReview: needsMissingExifReview ? true : photo.needsUserReview,
    reviewReason: needsMissingExifReview ? "missing_exif" : photo.reviewReason,
    error: error ?? photo.error
  };
};

export const enrichPhotoWithExif = async (
  photo: PhotoItem,
  reader: ExifReader = readExifMetadata
): Promise<PhotoItem> => {
  try {
    return applyExifMetadataToPhoto(photo, await reader(photo.originalPath));
  } catch (error) {
    return applyExifMetadataToPhoto(
      photo,
      {},
      error instanceof Error ? error.message : "Could not read EXIF metadata."
    );
  }
};

export const enrichPhotosWithExif = async (
  photos: PhotoItem[],
  reader: ExifReader = readExifMetadata,
  options: EnrichPhotosWithExifOptions = {}
) => {
  const total = photos.length;
  let completed = 0;

  return mapWithConcurrency(
    photos,
    options.concurrency ?? DEFAULT_EXIF_READ_CONCURRENCY,
    async (photo) => {
      const enriched = await enrichPhotoWithExif(photo, reader);
      completed += 1;
      options.onProgress?.(completed, total);
      return enriched;
    }
  );
};
