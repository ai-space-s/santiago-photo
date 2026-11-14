import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanPhotoDirectory, SUPPORTED_IMAGE_EXTENSIONS } from "../main/fileSystem";

const tempDirs: string[] = [];

const createTempDir = async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "camino-photo-scan-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const writeFile = async (filePath: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, "sample");
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true, force: true }))
  );
});

describe("scanPhotoDirectory", () => {
  it("scans supported JPG, JPEG, and PNG files", async () => {
    const tempDir = await createTempDir();
    await writeFile(path.join(tempDir, "IMG_0001.JPG"));
    await writeFile(path.join(tempDir, "IMG_0002.jpeg"));
    await writeFile(path.join(tempDir, "map.png"));

    const result = await scanPhotoDirectory(tempDir);

    expect(result.photos.map((photo) => photo.extension).sort()).toEqual([
      ".jpeg",
      ".jpg",
      ".png"
    ]);
    expect(result.photos).toHaveLength(3);
    expect(result.photos[0]).toMatchObject({
      selected: false,
      matchSource: "unmatched"
    });
    expect(result.unsupportedFiles).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("includes subdirectories by default", async () => {
    const tempDir = await createTempDir();
    await writeFile(path.join(tempDir, "root.jpg"));
    await writeFile(path.join(tempDir, "nested", "child.jpg"));

    const result = await scanPhotoDirectory(tempDir);

    expect(result.photos.map((photo) => photo.fileName).sort()).toEqual(["child.jpg", "root.jpg"]);
  });

  it("can skip subdirectories", async () => {
    const tempDir = await createTempDir();
    await writeFile(path.join(tempDir, "root.jpg"));
    await writeFile(path.join(tempDir, "nested", "child.jpg"));

    const result = await scanPhotoDirectory(tempDir, { includeSubdirectories: false });

    expect(result.photos.map((photo) => photo.fileName)).toEqual(["root.jpg"]);
  });

  it("records unsupported files separately", async () => {
    const tempDir = await createTempDir();
    await writeFile(path.join(tempDir, "IMG_0001.jpg"));
    await writeFile(path.join(tempDir, "clip.mov"));
    await writeFile(path.join(tempDir, "raw.nef"));

    const result = await scanPhotoDirectory(tempDir);

    expect(result.photos).toHaveLength(1);
    expect(result.unsupportedFiles.map((file) => file.extension).sort()).toEqual([".mov", ".nef"]);
    expect(result.unsupportedFiles.every((file) => file.reason === "unsupported_file_type")).toBe(
      true
    );
  });

  it("returns a read error for a missing source directory", async () => {
    const tempDir = await createTempDir();
    const missingDir = path.join(tempDir, "missing");

    const result = await scanPhotoDirectory(missingDir);

    expect(result.photos).toEqual([]);
    expect(result.errors[0]).toMatchObject({
      path: missingDir,
      reason: "read_error"
    });
  });
});

describe("SUPPORTED_IMAGE_EXTENSIONS", () => {
  it("matches the PRD-supported image types", () => {
    expect([...SUPPORTED_IMAGE_EXTENSIONS].sort()).toEqual([".jpeg", ".jpg", ".png"]);
  });
});
