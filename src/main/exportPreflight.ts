import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { buildExportPreview } from "../shared/exportValidator.js";
import type { Project } from "../shared/types.js";

// Inspect the filesystem in the main process, both for preview and immediately before export.
export const inspectExport = async (project: Project) => {
  const photos = await Promise.all(
    project.photos.map(async (photo) => {
      if (!photo.selected) return photo;
      try {
        const stat = await fs.stat(photo.originalPath);
        await fs.access(photo.originalPath, constants.R_OK);
        return { ...photo, missing: !stat.isFile() };
      } catch {
        return { ...photo, missing: true };
      }
    })
  );
  const preview = buildExportPreview(photos, project.schedule, { outputDir: project.outputDir });
  const issue = (
    code: "filename_collision" | "output_not_writable" | "unsafe_output_path",
    message: string,
    filePath: string
  ) => {
    preview.issues.push({ code, message, path: filePath });
  };
  if (project.outputDir.trim()) {
    // Refuse symlink/junction ancestors: output must stay in the directory the user chose.
    const targets = [
      ...preview.items.map((item) => item.outputPath),
      path.join(project.outputDir, "manifest.csv"),
      path.join(project.outputDir, "camino_project.json")
    ];
    for (const target of targets) {
      const relative = path.relative(path.resolve(project.outputDir), path.resolve(target));
      if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        issue("unsafe_output_path", `출력 폴더 밖으로 내보낼 수 없습니다: ${target}`, target);
      }
      let current = path.resolve(target);
      let firstExisting = true;
      while (true) {
        try {
          const stat = await fs.lstat(current);
          if (stat.isSymbolicLink())
            issue("unsafe_output_path", `링크 경로에는 내보낼 수 없습니다: ${current}`, current);
          if (current === path.resolve(target)) {
            issue("filename_collision", `기존 파일 또는 폴더가 있습니다: ${target}`, target);
            const item = preview.items.find((item) => path.resolve(item.outputPath) === current);
            if (item) {
              item.hasCollision = true;
              item.willOverwrite = true;
              item.status = "collision";
            }
          } else if (!stat.isDirectory()) {
            issue("unsafe_output_path", `출력 상위 경로가 폴더가 아닙니다: ${current}`, current);
          }
          if (firstExisting && stat.isDirectory()) await fs.access(current, constants.W_OK);
          firstExisting = false;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            issue("output_not_writable", `출력 경로에 접근할 수 없습니다: ${current}`, current);
          }
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
      }
    }
    const normalize = (value: string) =>
      process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
    const originals = new Set(project.photos.map((photo) => normalize(photo.originalPath)));
    for (const target of targets) {
      if (originals.has(normalize(target)))
        issue("unsafe_output_path", `원본 파일 경로와 겹칩니다: ${target}`, target);
    }
  }
  preview.canExport = preview.issues.length === 0;
  return preview;
};
