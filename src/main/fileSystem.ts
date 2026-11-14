import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FileScanIssue, PhotoScanResult } from "../shared/types.js";

export const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

export const DEFAULT_UNSUPPORTED_EXTENSIONS = new Set([
  ".heic",
  ".raw",
  ".cr2",
  ".nef",
  ".mp4",
  ".mov"
]);

export type ScanPhotoDirectoryOptions = {
  includeSubdirectories?: boolean;
};

const toIsoString = (date: Date) => date.toISOString();

const createPhotoId = (filePath: string, fileSize: number, fileModifiedAt: string) =>
  crypto.createHash("sha1").update(`${filePath}:${fileSize}:${fileModifiedAt}`).digest("hex");

const createScanIssue = (
  filePath: string,
  reason: FileScanIssue["reason"],
  message: string
): FileScanIssue => ({
  path: filePath,
  fileName: path.basename(filePath),
  extension: path.extname(filePath).toLowerCase(),
  reason,
  message
});

const scanDirectory = async (
  directoryPath: string,
  includeSubdirectories: boolean,
  result: PhotoScanResult
) => {
  let entries;

  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    result.errors.push(
      createScanIssue(
        directoryPath,
        "read_error",
        error instanceof Error ? error.message : "Could not read directory."
      )
    );
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (includeSubdirectories) {
        await scanDirectory(entryPath, includeSubdirectories, result);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    result.totalFilesVisited += 1;

    const extension = path.extname(entry.name).toLowerCase();

    if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
      result.unsupportedFiles.push(
        createScanIssue(entryPath, "unsupported_file_type", `Unsupported file type: ${extension}`)
      );
      continue;
    }

    try {
      const stats = await fs.stat(entryPath);
      const fileModifiedAt = toIsoString(stats.mtime);

      result.photos.push({
        id: createPhotoId(entryPath, stats.size, fileModifiedAt),
        originalPath: entryPath,
        fileName: entry.name,
        extension,
        fileSize: stats.size,
        fileModifiedAt,
        selected: false,
        matchSource: "unmatched"
      });
    } catch (error) {
      result.errors.push(
        createScanIssue(
          entryPath,
          "stat_error",
          error instanceof Error ? error.message : "Could not read file metadata."
        )
      );
    }
  }
};

export const scanPhotoDirectory = async (
  sourcePhotoDir: string,
  options: ScanPhotoDirectoryOptions = {}
): Promise<PhotoScanResult> => {
  const result: PhotoScanResult = {
    photos: [],
    unsupportedFiles: [],
    errors: [],
    totalFilesVisited: 0
  };

  await scanDirectory(sourcePhotoDir, options.includeSubdirectories ?? true, result);

  result.photos.sort((left, right) => left.originalPath.localeCompare(right.originalPath));
  result.unsupportedFiles.sort((left, right) => left.path.localeCompare(right.path));
  result.errors.sort((left, right) => left.path.localeCompare(right.path));

  return result;
};
