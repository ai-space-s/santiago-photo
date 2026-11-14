# AGENTS.md

## Project Name

Camino Photo Organizer

## Project Purpose

Build a local-first desktop application for organizing Camino de Santiago photos using a real itinerary CSV file.

The app imports a Camino itinerary CSV, scans a local photo directory, automatically assigns photos to itinerary days using EXIF timestamps, allows manual correction and photo selection, and exports only selected photos into day-based folders with meaningful filenames.

Original photo files must never be modified.

---

## Primary Product Requirements

Implement the app according to the PRD for:

**산티아고 순례길 일정표 기반 사진 큐레이션 데스크톱 앱**

The app must support the actual CSV structure used by the user.

Actual CSV columns:

```csv
프랑스길,날짜,구간 (출발지 → 도착지),거리 (km),알베르게
```

Column mapping:

```text
프랑스길 -> day
날짜 -> dateRaw
구간 (출발지 → 도착지) -> routeText
거리 (km) -> distanceKm
알베르게 -> accommodation
```

The CSV may contain:

* An empty first row.
* Korean, English, and Spanish place names.
* Dates without years, such as `02월 12일`.
* Route strings using `→`, `-`, or mixed separators.
* Rest-day rows using `연박`.
* Empty distance values.
* User-specific spelling variations or typos.

Do not auto-correct, translate, or normalize place names semantically. Preserve the user’s original route/place/accommodation text except for filesystem-safe filename sanitization.

---

## Required Technology Stack

Default implementation stack:

```text
Electron + React + TypeScript + Vite
```

Recommended libraries:

```text
Electron
React
TypeScript
Vite
exifr
sharp
papaparse
zustand
vitest
playwright
```

If a library choice causes packaging or platform issues, choose a practical equivalent and document the reason in `README.md`.

---

## Non-Negotiable Safety Rules

The app must never modify original photo files.

Forbidden operations on original files:

```text
rename
move
delete
overwrite
metadata write
compression
format conversion
```

All export operations must copy files into the selected output directory.

The app must not upload photos, EXIF metadata, GPS data, filenames, project data, or any user data to external servers.

All processing must be local.

If there is any ambiguity between automation and data safety, choose data safety.

---

## Core Features to Implement

### 1. Project Creation

The user must be able to create a new project with:

```text
project name
actual pilgrimage year
schedule CSV file
source photo directory
output directory
timezone correction
day boundary time
```

Because the CSV date values do not contain a year, the user-provided pilgrimage year is required.

Example:

```text
projectYear = 2026
dateRaw = "02월 12일"
date = "2026-02-12"
```

---

### 2. Schedule CSV Parser

Implement a robust parser for the actual Camino schedule CSV.

Parser requirements:

* Ignore empty leading rows.
* Detect the actual header row.
* Map `프랑스길` to `day`.
* Parse `날짜` values like `02월 12일`.
* Combine parsed month/day with `projectYear`.
* Parse `구간 (출발지 → 도착지)` into:

  * `routeText`
  * `dayType`
  * `startPlace`
  * `endPlace`
  * `viaPlaces`
  * `displayTitle`
* Parse `거리 (km)` as optional number.
* Preserve `알베르게` as optional string.

Route parsing priority:

```text
1. If routeText contains "→", split by "→".
2. Else if routeText contains "-", split by "-".
3. If routeText is "연박", treat as rest day.
4. If parsing fails, preserve routeText and mark dayType as "unknown".
```

For multi-segment routes:

```text
first token -> startPlace
last token -> endPlace
middle tokens -> viaPlaces
```

Example:

```text
routeText = "바욘-생장-발카로스"
startPlace = "바욘"
viaPlaces = ["생장"]
endPlace = "발카로스"
```

Example:

```text
routeText = "라바꼬야 → 산티아고 데 콤포스텔라→묵시아"
startPlace = "라바꼬야"
viaPlaces = ["산티아고 데 콤포스텔라"]
endPlace = "묵시아"
```

Rest-day handling:

```text
routeText = "연박"
dayType = "rest"
startPlace = previous walking day's endPlace
endPlace = previous walking day's endPlace
displayTitle = "{place} 연박"
```

If the previous end place cannot be inferred:

```text
startPlace = "Rest-Day"
endPlace = "Rest-Day"
displayTitle = "Rest-Day 연박"
```

---

### 3. Photo Scanning

The app must scan the selected source photo directory.

Supported file types:

```text
.jpg
.jpeg
.png
```

Unsupported in this version:

```text
.heic
.raw
.cr2
.nef
.mp4
.mov
```

Photo scanning must collect:

```text
originalPath
fileName
extension
fileSize
fileModifiedAt
DateTimeOriginal
CreateDate
FileModifyDate
thumbnailPath
error state if any
```

The default scan mode should include subdirectories.

Corrupted or unsupported files must not crash the app. Record them in an error summary.

---

### 4. EXIF-Based Auto Assignment

Timestamp priority:

```text
1. DateTimeOriginal
2. CreateDate
3. FileModifyDate
```

Auto-assignment algorithm:

```text
for each photo:
  timestamp = DateTimeOriginal || CreateDate || FileModifyDate

  if timestamp does not exist:
    assignedDay = undefined
    matchSource = "unmatched"
    place photo in Unmatched
    continue

  correctedTimestamp = timestamp + timezoneOffsetHours

  if correctedTimestamp.time < dayBoundaryTime:
    assignmentDate = correctedTimestamp.date - 1 day
  else:
    assignmentDate = correctedTimestamp.date

  matchedDay = schedule.find(day.date == assignmentDate)

  if matchedDay exists:
    assignedDay = matchedDay.day
    matchSource = source used
  else:
    assignedDay = undefined
    matchSource = "unmatched"
```

Do not implement confidence scoring. The product intentionally excludes confidence-related UI and data fields.

---

### 5. Manual Assignment

The user must be able to:

```text
move one photo to another Day
move multiple photos to another Day
move a photo to Unmatched
move Unmatched photos to a specific Day
```

When a user manually moves a photo:

```text
assignedDay = destination day
matchSource = "manual"
```

---

### 6. Photo Selection

The user must be able to:

```text
select one photo
deselect one photo
select multiple photos
deselect multiple photos
select all photos in current Day
deselect all photos in current Day
filter selected photos
filter unselected photos
```

Only selected photos are exported.

---

### 7. Export Preview

Before exporting, show a preview table containing:

```text
original file path
output file path
original filename
new filename
day
date
route
accommodation
sequence number
collision status
export status
```

Export must be blocked if:

```text
no photo is selected
a selected photo has no assignedDay
a selected source file is missing
output directory is not writable
there is an output filename collision
```

---

### 8. Export

Export only selected photos.

Export process:

```text
create output directory
create day-based subdirectories
copy selected photos with generated filenames
write manifest.csv
save camino_project.json
show completion summary
```

Walking-day folder pattern:

```text
D{day:02d}_{start}_to_{end}
```

Walking-day filename pattern:

```text
D{day:02d}_{start}_to_{end}_{seq:03d}.{ext}
```

Rest-day folder pattern:

```text
D{day:02d}_{place}_Rest
```

Rest-day filename pattern:

```text
D{day:02d}_{place}_Rest_{seq:03d}.{ext}
```

Examples:

```text
D01_바욘_to_발카로스/D01_바욘_to_발카로스_001.jpg
D04_수비리_to_Pamplona/D04_수비리_to_Pamplona_001.jpg
D05_Pamplona_Rest/D05_Pamplona_Rest_001.jpg
```

Filename sanitization rules:

```text
replace or remove unsafe filesystem characters
remove slash
remove backslash
remove colon
remove quotes
remove question mark
remove asterisk
remove pipe character
trim leading/trailing whitespace
collapse repeated whitespace
preserve Korean and other non-ASCII place names
do not translate place names
do not auto-correct place names
```

---

## Required Data Models

Use these as the base TypeScript types.

```ts
export type ScheduleDay = {
  day: number;

  dateRaw: string;
  date: string;

  routeText: string;
  dayType: "walking" | "rest" | "unknown";

  startPlace?: string;
  endPlace?: string;
  viaPlaces: string[];

  displayTitle: string;

  distanceKm?: number;
  accommodation?: string;
  memo?: string;
};

export type PhotoItem = {
  id: string;
  originalPath: string;
  fileName: string;
  extension: string;
  fileSize: number;
  fileModifiedAt: string;

  dateTimeOriginal?: string;
  createDate?: string;
  fileModifyDate?: string;
  effectiveDateTime?: string;

  assignedDay?: number;
  selected: boolean;
  sequence?: number;

  matchSource:
    | "manual"
    | "DateTimeOriginal"
    | "CreateDate"
    | "FileModifyDate"
    | "unmatched";

  thumbnailPath?: string;
  missing?: boolean;
  error?: string;
};

export type ProjectSummary = {
  totalPhotosScanned: number;
  totalPhotosAssignedAutomatically: number;
  totalPhotosAssignedManually: number;
  totalUnmatchedPhotos: number;
  totalSelectedPhotos: number;
  totalDays: number;
  firstStartPlace?: string;
  lastEndPlace?: string;
};

export type Project = {
  schemaVersion: string;
  projectName: string;
  routeName: string;
  projectYear: number;

  createdAt: string;
  updatedAt: string;

  sourcePhotoDir: string;
  outputDir: string;
  filenamePattern: string;

  timezoneOffsetHours: number;
  dayBoundaryTime: string;

  schedule: ScheduleDay[];
  photos: PhotoItem[];

  summary: ProjectSummary;
};
```

Do not add confidence fields unless explicitly requested later.

---

## Manifest CSV Requirements

After export, generate `manifest.csv`.

Required columns:

```text
original_path
new_path
day
date
date_raw
day_type
route_text
start_place
end_place
via_places
distance_km
accommodation
sequence
selected
match_source
effective_datetime
date_time_original
create_date
file_modify_date
status
```

For `via_places`, join multiple places with `|`.

Export status values:

```text
copied
failed
skipped
missing
collision
```

---

## UI Requirements

The UI must include:

```text
top toolbar
left day sidebar
central photo thumbnail grid
right photo detail panel
bottom status/progress area
export preview screen or modal
```

Top toolbar actions:

```text
New Project
Open Project
Save Project
Import Schedule CSV
Select Photo Folder
Select Output Folder
Run Auto Assignment
Export Preview
Export Selected Photos
```

Settings visible in the UI:

```text
Project Year
Timezone Correction
Day Boundary Time
Thumbnail Size
```

Day sidebar entries:

```text
All Photos
Day 01 — 바욘 → 발카로스
Day 02 — Valcarlos → Roncevalles
...
Unmatched
Selected Photos
Unselected Photos
Manual Assigned
EXIF Assigned
Rest Days
Walking Days
```

Each Day entry should show:

```text
total photo count
selected photo count
route display title
```

Photo grid thumbnail labels:

```text
selection state
filename
assigned Day
EXIF date if available
```

Photo detail panel fields:

```text
preview image
filename
original path
file size
DateTimeOriginal
CreateDate
FileModifyDate
effectiveDateTime
assigned Day
selected state
move to Day control
```

---

## Thumbnail Caching

Cache generated thumbnails.

Recommended cache directory:

```text
.camino_cache/thumbnails/
```

Cache key must depend on:

```text
original file path
file size
file modified time
```

If the cache is valid, reuse the thumbnail.
If missing or stale, regenerate it.

---

## Project Persistence

Save projects as local JSON files.

Recommended filename:

```text
camino_project.json
```

The app must restore the following when reopening a project:

```text
project metadata
route name
project year
schedule
source photo directory
output directory
photo list
photo assignment state
photo selection state
timezone correction
day boundary time
thumbnail cache path
summary
```

If original files are missing after reopening:

```text
mark photo.missing = true
do not crash
exclude missing files from export
show missing file count to the user
```

---

## Progress and Error Handling

Show progress for long-running tasks:

```text
scanning photos
reading EXIF
generating thumbnails
auto assigning photos
saving project
exporting selected photos
```

Error handling rules:

```text
do not crash because of one bad file
record corrupted files
record unsupported files
mark missing files
record export failures in manifest.csv
show CSV parsing errors in the schedule review UI
```

---

## Required Project Structure

Prefer this structure:

```text
src/
  main/
    fileSystem.ts
    exifReader.ts
    thumbnailGenerator.ts
    exporter.ts
    projectStore.ts

  renderer/
    App.tsx
    components/
      Toolbar.tsx
      DaySidebar.tsx
      PhotoGrid.tsx
      PhotoDetailPanel.tsx
      ExportPreview.tsx
      ProgressBar.tsx
    store/
      projectStore.ts
    styles/

  shared/
    types.ts
    scheduleParser.ts
    routeParser.ts
    dateParser.ts
    autoAssigner.ts
    timeCorrection.ts
    filenameBuilder.ts
    manifestWriter.ts
    exportValidator.ts

  tests/
    scheduleParser.test.ts
    routeParser.test.ts
    dateParser.test.ts
    autoAssigner.test.ts
    timeCorrection.test.ts
    filenameBuilder.test.ts
    exportValidator.test.ts
    projectStore.test.ts
```

Keep core logic in `src/shared/` so it can be tested without launching Electron.

---

## Testing Requirements

Use automated tests.

Preferred tools:

```text
vitest
playwright
```

Minimum unit tests:

```text
CSV header detection
empty first row handling
date string parsing
project year date normalization
route string parsing with "→"
route string parsing with "-"
multi-segment route parsing
rest-day parsing
previous end-place inference for rest days
EXIF timestamp priority
timezone correction
day boundary correction
date-to-day matching
auto assignment
manual assignment
walking-day filename generation
rest-day filename generation
filename sanitization
export plan generation
output filename collision detection
project save
project reload
manifest generation
non-destructive export validation
```

Key test cases:

```text
1. CSV first row is empty and second row is the real header.
2. "프랑스길" is mapped to day.
3. "02월 12일" + projectYear 2026 becomes "2026-02-12".
4. "수비리 → Pamplona" parses to startPlace "수비리" and endPlace "Pamplona".
5. "바욘-생장-발카로스" parses to startPlace "바욘", viaPlaces ["생장"], endPlace "발카로스".
6. "라바꼬야 → 산티아고 데 콤포스텔라→묵시아" parses correctly with viaPlaces.
7. "연박" becomes rest day and uses previous walking day's endPlace.
8. DateTimeOriginal is preferred over CreateDate and FileModifyDate.
9. CreateDate is used when DateTimeOriginal is missing.
10. FileModifyDate is used when both DateTimeOriginal and CreateDate are missing.
11. Photos without usable timestamps are assigned to Unmatched.
12. Timezone correction changes assignment date correctly.
13. Day boundary time changes assignment date correctly.
14. Manual assignment updates assignedDay and matchSource.
15. Selected photos export as copies only.
16. Original photos are unchanged after export.
17. Filename collisions block export.
18. Saved project reloads assignments and selection states.
19. Missing original files are marked as missing and excluded from export.
```

---

## Development Workflow Instructions

When implementing:

1. Start with data models and pure parsing functions.
2. Implement tests for parsers before UI.
3. Implement CSV parsing for the actual user-provided schedule format.
4. Implement route and rest-day handling.
5. Implement date normalization with project year.
6. Implement EXIF timestamp extraction.
7. Implement auto-assignment as a pure function.
8. Implement filename generation and export validation.
9. Build the Electron/React UI around tested logic.
10. Add project save/reload.
11. Add thumbnail caching.
12. Add export and manifest generation.
13. Run all tests.
14. Update README.

Do not prioritize UI polish before core parsing, assignment, export safety, and tests.

---

## README Requirements

Create or update `README.md` with:

```text
project overview
installation instructions
development run command
build command
test command
supported CSV format
sample CSV
supported image formats
export folder structure
known limitations
safety guarantee that originals are never modified
```

---

## Known Limitations for This Version

Do not implement:

```text
GPS map matching
AI place recognition
face recognition
photo quality scoring
duplicate photo removal
cloud upload
user login
mobile app
SNS upload
HTML album
PDF travel book
share cards
payment
HEIC support
RAW support
video support
automatic place-name correction
automatic place-name translation
confidence scoring
```

---

## Completion Criteria

The implementation is complete when:

```text
the actual Camino CSV format can be imported
empty leading rows are handled
dates without years are normalized using projectYear
routes are parsed correctly
rest days are handled correctly
photos can be scanned
EXIF timestamps can be read
photos can be auto-assigned by date
photos can be manually moved between Days
photos can be selected and deselected
export preview detects collisions and invalid states
selected photos are copied with generated filenames
original files remain unchanged
manifest.csv is generated
camino_project.json is saved and reloaded
thumbnail caching works
missing and corrupted files are handled safely
at least 2,000 JPG/JPEG photos can be processed without UI freeze
core logic has automated tests
README.md explains how to run, test, and use the app
```

---

## Final Principle

Build a trustworthy local photo organizer, not a cloud photo service.

The app should do the first-pass organization automatically, but the user remains in control of final photo selection and manual correction.

Original photos are sacred. Never modify them.
