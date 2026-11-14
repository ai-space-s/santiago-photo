/* global console, Buffer, URL, document */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { _electron as electron } from "playwright";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "camino-slideshow-e2e-"));
const artifacts = path.join(root, "artifacts", "slideshow");
await fs.mkdir(artifacts, { recursive: true });
let app;
let page;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

try {
  const originals = [];
  for (let i = 0; i < 3; i++) {
    const file = path.join(temp, `${["morning", "friends", "rest"][i]}.png`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="${["#b6c9c0", "#d4b291", "#829a94"][i]}"/><circle cx="920" cy="180" r="70" fill="#f1dbad"/><path d="M0 600L350 180L760 700L970 460L1200 750V800H0Z" fill="#436655"/><path d="M300 800L480 540L570 590L510 800Z" fill="#d9c4a2"/><text x="60" y="740" font-size="32" fill="white">CAMINO · TEST IMAGE ${i + 1}</text></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(file);
    originals.push({ file, hash: hash(await fs.readFile(file)) });
  }
  const schedule = [
    {
      day: 1,
      date: "2026-02-12",
      dateRaw: "02월 12일",
      routeText: "바욘-생장-발카로스",
      dayType: "walking",
      startPlace: "바욘",
      endPlace: "발카로스",
      viaPlaces: ["생장"],
      displayTitle: "바욘 → 발카로스",
      distanceKm: 11,
      accommodation: "Alb. muncipale Valcarios"
    },
    {
      day: 2,
      date: "2026-02-13",
      dateRaw: "02월 13일",
      routeText: "연박",
      dayType: "rest",
      startPlace: "발카로스",
      endPlace: "발카로스",
      viaPlaces: [],
      displayTitle: "발카로스 연박"
    }
  ];
  const photos = [
    ...originals.map(({ file }, i) => ({
      id: `photo-${i}`,
      originalPath: file,
      fileName: path.basename(file),
      extension: ".png",
      fileSize: 100,
      fileModifiedAt: "2026-02-12T00:00:00",
      dateTimeOriginal: `2026-02-${i === 2 ? "13" : "12"}T${String(i + 8).padStart(2, "0")}:00:00`,
      assignedDay: i === 2 ? 2 : 1,
      selected: i !== 1,
      manualOrder: i === 0 ? 2 : 1,
      category: ["landscape", "people", "food"][i],
      matchSource: "manual"
    })),
    {
      id: "broken",
      originalPath: path.join(temp, "unreadable.png"),
      fileName: "unreadable.png",
      extension: ".png",
      fileSize: 1,
      fileModifiedAt: "2026-02-12T00:00:00",
      assignedDay: 1,
      selected: true,
      category: "other",
      matchSource: "manual"
    }
  ];
  const project = {
    schemaVersion: "1.0.0",
    projectName: "Camino Slideshow Test",
    projectYear: 2026,
    routeName: "프랑스길",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    sourcePhotoDir: temp,
    outputDir: path.join(temp, "output"),
    filenamePattern: "",
    timezoneOffsetHours: 0,
    dayBoundaryTime: "04:00",
    thumbnailCacheDir: path.join(temp, "cache"),
    schedule,
    photos,
    summary: {}
  };
  await fs.writeFile(path.join(temp, "fixture.json"), JSON.stringify(project));
  // Real production renderer + preload, with isolated IPC/project storage and read-only photo protocol.
  const harness = `const { app, BrowserWindow, ipcMain, protocol, net, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
app.setPath('userData', path.join(__dirname, 'user-data'));
protocol.registerSchemesAsPrivileged([{ scheme: 'camino-thumbnail', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }));
  protocol.handle('camino-thumbnail', async (request) => {
    const file = Buffer.from(new URL(request.url).pathname.slice(1), 'base64url').toString('utf8');
    try { return await net.fetch(pathToFileURL(file).toString()); } catch { return new Response('', { status: 404 }); }
  });
  const store = await import(${JSON.stringify(pathToFileURL(path.join(root, "dist/main/projectStore.js")).href)});
  ipcMain.handle('project:last-opened', async () => {
    try { await fs.access(path.join(__dirname, 'saved.json')); return store.loadProject(path.join(__dirname, 'saved.json')); }
    catch { return JSON.parse(await fs.readFile(path.join(__dirname, 'fixture.json'), 'utf8')); }
  });
  ipcMain.handle('project:save', async (_event, project) => store.saveProject(project, path.join(__dirname, 'saved.json')));
  const win = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { preload: ${JSON.stringify(path.join(root, "src/main/preload.cjs"))}, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } });
  await win.loadFile(${JSON.stringify(path.join(root, "dist/renderer/index.html"))});
});`;
  const harnessPath = path.join(temp, "harness.cjs");
  await fs.writeFile(harnessPath, harness);
  app = await electron.launch({ args: [harnessPath], cwd: root });
  page = await app.firstWindow();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByText("Camino Slideshow Test", { exact: true }).waitFor();
  const counter = page.locator(".slideshow-counter");
  const counterIs = async (text) =>
    page.waitForFunction(
      (value) => document.querySelector(".slideshow-counter")?.textContent === value,
      text
    );
  const configure = () => page.getByRole("button", { name: "구성 변경", exact: true }).click();
  const start = () => page.getByRole("button", { name: "▶ 자동 재생 시작", exact: true }).click();

  // Manual category assignment is a project edit only.
  await page.locator(".thumbnail-card").filter({ hasText: "morning.png" }).click();
  await page.getByLabel("사진 유형", { exact: true }).selectOption("trail");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "▶ 슬라이드쇼", exact: true }).click();
  await page.getByLabel("사진 표시 시간", { exact: true }).selectOption("2");
  await page.getByLabel("표지 표시 시간", { exact: true }).selectOption("2");
  await page.screenshot({ path: path.join(artifacts, "setup.png"), animations: "disabled" });
  await page.getByRole("button", { name: "모두 해제", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "▶ 자동 재생 시작", exact: true }).isDisabled(),
    true
  );
  await page.getByRole("button", { name: "전체 Day", exact: true }).click();
  await page.getByLabel("사진 범위", { exact: true }).selectOption("selected");
  await page.getByRole("checkbox", { name: /Day 02/ }).uncheck();
  await page.getByText("1개 Day · 사진 2장", { exact: true }).waitFor();
  await page.getByRole("button", { name: "전체 Day", exact: true }).click();
  await page.getByLabel("사진 범위", { exact: true }).selectOption("all");
  await start();
  await counterIs("1 / 6");
  await page.getByRole("button", { name: "Ⅱ 일시정지", exact: true }).click();
  await page.screenshot({ path: path.join(artifacts, "cover.png"), animations: "disabled" });
  // Waiting longer than the configured interval verifies the timer was canceled.
  await page.waitForTimeout(2300);
  assert.equal(await counter.textContent(), "1 / 6");
  await page.keyboard.press("Space");
  await counterIs("2 / 6");
  await page.getByRole("button", { name: "Ⅱ 일시정지", exact: true }).click();
  assert.equal(await page.locator(".slideshow-photo").getAttribute("alt"), "morning.png");
  await page.waitForFunction(() => document.querySelector(".slideshow-photo")?.naturalWidth > 0);
  const seek = page.getByRole("slider", { name: "슬라이드 이동", exact: true });
  // Native range keyboard navigation must seek once, without the global arrow handler firing too.
  await seek.press("End");
  await counterIs("6 / 6");
  await page.waitForTimeout(2300);
  assert.equal(await counter.textContent(), "6 / 6");
  assert.equal(await page.locator(".slideshow-end").count(), 0);
  await seek.press("Home");
  await counterIs("1 / 6");
  await seek.press("ArrowRight");
  await counterIs("2 / 6");
  const seekBounds = await seek.boundingBox();
  assert.ok(seekBounds);
  const seekX = (value) => seekBounds.x + 8 + ((seekBounds.width - 16) * (value - 1)) / 5;
  const seekY = seekBounds.y + seekBounds.height / 2;
  await page.mouse.click(seekX(5), seekY);
  await counterIs("5 / 6");
  assert.equal(await page.getByRole("button", { name: "▶ 재생", exact: true }).isVisible(), true);
  await page.getByRole("button", { name: "▶ 재생", exact: true }).click();
  await page.mouse.move(seekX(5), seekY);
  await page.mouse.down();
  // Holding the thumb suspends automatic advancement, even past the cover interval.
  await page.waitForTimeout(2300);
  assert.equal(await counter.textContent(), "5 / 6");
  await page.mouse.move(seekX(2), seekY, { steps: 5 });
  await counterIs("2 / 6");
  await page.mouse.up();
  await counterIs("3 / 6");
  await page.getByRole("button", { name: "Ⅱ 일시정지", exact: true }).click();
  await seek.press("ArrowLeft");
  await counterIs("2 / 6");
  await page.waitForFunction(() => document.querySelector(".slideshow-photo")?.naturalWidth > 0);
  await page.screenshot({ path: path.join(artifacts, "photo.png"), animations: "disabled" });
  await page.getByRole("button", { name: "전체 화면", exact: true }).click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.getByRole("button", { name: "전체 화면 해제", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await counterIs("3 / 6");
  assert.equal(await page.locator(".slideshow-photo").getAttribute("alt"), "friends.png");
  await page.keyboard.press("ArrowLeft");
  await counterIs("2 / 6");
  await page.getByRole("button", { name: "▶ 재생", exact: true }).click();
  await page
    .getByRole("heading", { name: "순례의 기억을 모두 보았습니다" })
    .waitFor({ timeout: 15000 });
  assert.match(await page.locator(".slideshow-hints").textContent(), /읽기 실패 1장/);
  await seek.press("Home");
  await counterIs("1 / 6");
  assert.equal(await page.locator(".slideshow-end").count(), 0);
  assert.equal(await page.getByRole("button", { name: "▶ 재생", exact: true }).isVisible(), true);

  // Saved manual order is honored; a restart removes the old playback timer.
  await configure();
  await page.getByLabel("Day 안의 사진 순서").selectOption("manual");
  await start();
  await counterIs("2 / 6");
  await page.getByRole("button", { name: "Ⅱ 일시정지", exact: true }).click();
  assert.equal(await page.locator(".slideshow-photo").getAttribute("alt"), "friends.png");

  // One-photo repeat, no covers; category filtering does not change export selections.
  await configure();
  await page.getByLabel("음식", { exact: true }).check();
  await page.getByLabel("Day별 표지 넣기", { exact: true }).uncheck();
  await page.getByLabel("끝나면 처음부터 반복", { exact: true }).check();
  await start();
  await counterIs("1 / 1");
  assert.equal(await seek.isDisabled(), true);
  await page.waitForTimeout(4500);
  assert.equal(
    await page.getByRole("button", { name: "Ⅱ 일시정지", exact: true }).isVisible(),
    true
  );
  assert.equal(await page.locator(".slideshow-end").count(), 0);

  // Broken-only repeat terminates rather than endlessly looping.
  await configure();
  await page.getByLabel("음식", { exact: true }).uncheck();
  await page.getByLabel("기타", { exact: true }).check();
  await start();
  await page.getByRole("heading", { name: "재생할 수 있는 사진이 없습니다" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog", { name: "슬라이드쇼 재생" }).count(), 0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Project saved", { exact: true }).waitFor();
  const saved = JSON.parse(await fs.readFile(path.join(temp, "saved.json"), "utf8"));
  assert.equal(saved.photos[0].category, "trail");
  assert.deepEqual(
    saved.photos.map(({ selected, assignedDay }) => ({ selected, assignedDay })),
    photos.map(({ selected, assignedDay }) => ({ selected, assignedDay }))
  );
  assert.deepEqual(saved.slideshowSettings.categories, ["other"]);
  assert.equal(saved.slideshowSettings.loop, true);
  await page.reload();
  await page.getByText("Camino Slideshow Test", { exact: true }).waitFor();
  await page.getByRole("button", { name: "▶ 슬라이드쇼", exact: true }).click();
  assert.equal(await page.getByLabel("기타", { exact: true }).isChecked(), true);
  assert.equal(await page.getByLabel("끝나면 처음부터 반복", { exact: true }).isChecked(), true);
  assert.equal(
    await page.getByRole("button", { name: "▶ 자동 재생 시작", exact: true }).isDisabled(),
    true
  );
  for (const original of originals)
    assert.equal(hash(await fs.readFile(original.file)), original.hash);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: automatic playback, covers, chronological/manual order, pause, slider click/drag/keyboard seeking and playback preservation, fullscreen, category/selection/Day filtering, loop, read failures, save/reload and unchanged original hashes."
  );
  console.log(`Screenshots: ${artifacts}`);
} catch (error) {
  console.error(error);
  if (page) {
    console.error(await page.locator("body").innerText());
    await page
      .screenshot({ path: path.join(artifacts, "failure.png"), timeout: 3000 })
      .catch(() => undefined);
  }
  throw error;
} finally {
  if (app) await app.close();
  // Only remove the exact temporary test directory created above.
  if (
    path.dirname(temp) === path.resolve(os.tmpdir()) &&
    path.basename(temp).startsWith("camino-slideshow-e2e-")
  ) {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
