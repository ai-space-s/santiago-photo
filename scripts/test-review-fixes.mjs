/* global console, document, URL, global */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron as electron } from "playwright";
import { createEmptyProject } from "../dist/main/projectStore.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "camino-review-fixes-"));
let app;
try {
  const project = createEmptyProject({
    projectName: "Review Fixes",
    projectYear: 2026,
    projectFilePath: path.join(temp, "project.json"),
    outputDir: path.join(temp, "output")
  });
  project.schedule = [1, 2].map((day) => ({
    day,
    dateRaw: `02월 ${11 + day}일`,
    date: `2026-02-${11 + day}`,
    routeText: day === 1 ? "A → B" : "연박",
    dayType: day === 1 ? "walking" : "rest",
    startPlace: "A",
    endPlace: "B",
    viaPlaces: [],
    displayTitle: day === 1 ? "A → B" : "B 연박"
  }));
  for (const id of ["one", "two"]) {
    const originalPath = path.join(temp, `${id}.jpg`);
    await fs.writeFile(originalPath, `original-${id}`);
    project.photos.push({
      id,
      originalPath,
      fileName: `${id}.jpg`,
      extension: ".jpg",
      fileSize: 12,
      fileModifiedAt: "2026-02-12T12:00:00",
      dateTimeOriginal: "2026-02-12T12:00:00",
      assignedDay: 1,
      selected: true,
      matchSource: "DateTimeOriginal"
    });
  }
  await fs.writeFile(path.join(temp, "fixture.json"), JSON.stringify(project));
  const moduleUrl = (name) =>
    JSON.stringify(pathToFileURL(path.join(root, `dist/${name}.js`)).href);
  const harness = `const {app,BrowserWindow,ipcMain,session}=require('electron');
const fs=require('node:fs/promises'); const path=require('node:path');
app.setPath('userData',path.join(__dirname,'user-data'));
app.whenReady().then(async()=>{
session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>cb({cancel:true}));
const store=await import(${moduleUrl("main/projectStore")});
const {inspectExport}=await import(${moduleUrl("main/exportPreflight")});
const {exportSelectedPhotos}=await import(${moduleUrl("main/exporter")});
ipcMain.handle('project:last-opened',()=>store.loadProject(path.join(__dirname,'fixture.json')));
ipcMain.handle('project:save',(_e,p)=>store.saveProject(p,path.join(__dirname,'saved.json')));
ipcMain.handle('export:preview',(_e,p)=>inspectExport(p));
ipcMain.handle('export:selected',async(_e,p)=>{
 if(global.failCopies){const copy=fs.copyFile; fs.copyFile=async()=>{throw new Error('Simulated copy failure')};try{return await exportSelectedPhotos(p,await inspectExport(p))}finally{fs.copyFile=copy}}
 return exportSelectedPhotos(p,await inspectExport(p));
});
ipcMain.handle('schedule:import',()=>({schedule:${JSON.stringify(project.schedule)},routeName:'프랑스길',issues:[{rowNumber:4,columnName:'날짜',code:'invalid_date',value:'02월 30일',message:'Invalid date'}]}));
const win=new BrowserWindow({width:1600,height:1000,show:false,webPreferences:{preload:${JSON.stringify(path.join(root, "src/main/preload.cjs"))},contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});
await win.loadFile(${JSON.stringify(path.join(root, "dist/renderer/index.html"))});
});`;
  const harnessPath = path.join(temp, "harness.cjs");
  await fs.writeFile(harnessPath, harness);
  app = await electron.launch({ args: [harnessPath], cwd: root });
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByText("Review Fixes", { exact: true }).waitFor();
  await page.getByLabel("Project Year", { exact: true }).fill("2027");
  await page.getByLabel("Timezone Correction", { exact: true }).fill("1");
  await page.getByLabel("Day Boundary Time", { exact: true }).fill("03:00");
  await page.getByLabel("Thumbnail Size", { exact: true }).selectOption("320");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes("Project saved"));
  let saved = JSON.parse(await fs.readFile(path.join(temp, "saved.json"), "utf8"));
  assert.equal(saved.schedule[0].date, "2027-02-12");
  assert.equal(saved.timezoneOffsetHours, 1);
  assert.equal(saved.dayBoundaryTime, "03:00");
  assert.equal(saved.thumbnailSize, 320);
  await page.getByLabel("선택한 표시 사진 이동", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: "Rest Days", exact: false }).click();
  assert.equal(await page.locator(".thumbnail-card").count(), 2);
  await page.locator(".thumbnail-card").first().click();
  await page.getByRole("button", { name: "순서 뒤로", exact: false }).click();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByLabel("선택한 표시 사진 이동", { exact: true }).selectOption("unmatched");
  await page.getByRole("button", { name: "전체 사진", exact: false }).click();
  await page.getByLabel("선택한 표시 사진 이동", { exact: true }).selectOption("1");
  // Restore automatic provenance through a fresh fixture, then reorder only.
  await app.evaluate(
    ({ BrowserWindow }, fixture) =>
      BrowserWindow.getAllWindows()[0].webContents.send("project:loaded-from-menu", fixture),
    project
  );
  await page.locator(".thumbnail-card").first().click();
  await page.getByRole("button", { name: "순서 뒤로", exact: false }).click();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes("Project saved"));
  saved = JSON.parse(await fs.readFile(path.join(temp, "saved.json"), "utf8"));
  assert(saved.photos.every((photo) => photo.matchSource === "DateTimeOriginal"));
  assert(saved.photos.every((photo) => photo.manualOrder !== undefined));
  await page.getByRole("button", { name: "Import Schedule CSV", exact: true }).click();
  await page.getByRole("region", { name: "CSV 오류 검토" }).waitFor();
  assert(
    (await page.getByRole("region", { name: "CSV 오류 검토" }).textContent()).includes("02월 30일")
  );
  await page.getByRole("button", { name: "Export Preview", exact: true }).click();
  await page.getByText("Ready", { exact: true }).waitFor();
  await app.evaluate(() => {
    global.failCopies = true;
  });
  await page.getByRole("button", { name: "Export Scheduled Photo", exact: true }).click();
  await page.waitForFunction(() => document.body.textContent.includes("복사 0개, 실패 2개"));
  assert(
    (await fs.readFile(path.join(project.outputDir, "manifest.csv"), "utf8")).includes("failed")
  );
  await page.getByRole("button", { name: "Export Preview", exact: true }).click();
  await page.getByText("Blocked", { exact: true }).waitFor();
  for (const photo of project.photos)
    assert.equal(await fs.readFile(photo.originalPath, "utf8"), `original-${photo.id}`);
  assert.deepEqual(errors, []);
  console.log(
    "Review fixes E2E passed: settings/save, bulk move, filters, reorder provenance, CSV review, failure summary, collision preview, original preservation."
  );
} finally {
  if (app) await app.close();
  await fs.rm(temp, { recursive: true, force: true });
}
