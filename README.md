# Camino Photo Organizer

Camino Photo Organizer is a local-first desktop app for organizing Camino de Santiago
photos by itinerary day. It imports a schedule CSV, scans a local photo folder, assigns
photos by capture time, lets the user manually review the result, and exports only selected
photos into day-based folders.

Original photo files must never be renamed, moved, deleted, overwritten, recompressed,
converted, or have metadata written back to them.

## Tech Stack

- Electron
- React
- TypeScript
- Vite
- Vitest
- Playwright

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Supported CSV Format

The app targets the itinerary CSV shape used by this project:

```csv
프랑스길,날짜,구간 (출발지 → 도착지),거리 (km),알베르게
1,02월 12일,바욘-생장-발카로스,11,Alb. muncipale Valcarios
2,02월 13일,Valcarlos- Roncevalles,16,collegiate 성당부속알베
```

The first row may be empty. The app detects the actual header row and maps:

- `프랑스길` to `day`
- `날짜` to `dateRaw`
- `구간 (출발지 → 도착지)` to `routeText`
- `거리 (km)` to `distanceKm`
- `알베르게` to `accommodation`

A fictional sample is provided at `examples/sample-schedule.csv`. Personal photos,
itineraries, saved project JSON, exports, caches, and generated screenshots are excluded
from this repository. The optional 38-day local-itinerary test is skipped when the user's
`프랑스길-일정-csv.csv` is absent; all distributable fixtures run without personal files.

## Supported Image Formats

- `.jpg`
- `.jpeg`
- `.png`

HEIC, RAW, and video files are excluded from this version.

The selected photo folder is scanned recursively, so photos organized into subfolders
(for example one subfolder per contributor, `김명숙-photo/`, `이충일-photo/`) are all picked
up and merged into a single photo list, matched to schedule days by capture time regardless
of which subfolder they came from.

## Export Structure

Walking day:

```text
D01_바욘_to_발카로스/
  D01_바욘_to_발카로스_001.jpg
```

Rest day:

```text
D05_Pamplona_Rest/
  D05_Pamplona_Rest_001.jpg
```

Each export also writes:

- `manifest.csv`
- `camino_project.json`

## UI Overview

The main window has three parts:

- **Toolbar** — project actions (New / Open / Save), import and scan actions (Import
  Schedule CSV / Select Photo Folder / Select Output Folder / Run Auto Assignment), and
  export actions (Export Preview / Export Scheduled Photo), plus the current source/output
  folder paths and Year/TZ/Boundary readouts.
- **Workspace** — a left sidebar with status filters (전체 사진, Unmatched, 선택됨, 선택
  안됨, 수동 배정, EXIF 자동 배정, EXIF 누락 검토) and a Day-by-Day list, next to a photo
  grid. The grid always displays photos ordered by assigned Day first, then by capture time
  within the same Day (manual re-ordering takes priority when set), so the order on screen
  matches the order photos will be exported in.
- **Status bar** — current status message, a selection-progress bar, and a visible/total/
  selected count.

Clicking a photo card opens a detail view with three parts stacked vertically:

1. **Header** — the assigned Day and route (e.g. `Day 04 · 수비리 → Pamplona`) with the
   photo's full original file path underneath.
2. **Photo** — shown at its original resolution (not the small grid thumbnail), with
   previous/next navigation arrows overlaid on the image, filling as much of the modal as
   possible.
3. **Detail bar** — a horizontal strip below the photo with file name, file size, capture
   time (DateTimeOriginal), and the time-zone/boundary-corrected assignment time, followed
   by a "Day 이동" dropdown to reassign the photo and "순서 앞으로 / 순서 뒤로" buttons to
   reorder it within its Day. Selecting/deselecting a photo is done from the grid (click the
   dot on the thumbnail), not from this panel.

Export Preview checks disk state and shows the exact files that will be written (original/new filename, Day,
date, route, sequence, and a New/Collision status pill) before you commit to
exporting.

## Current Status

Core models, parsers, EXIF-based photo assignment, thumbnail generation, export logic, and
the main UI (toolbar, sidebar filters, photo grid, photo detail view, export preview) are
implemented and covered by tests.

## Known Limitations

This version will not include GPS matching, AI place recognition, face recognition, cloud
upload, login, mobile apps, HEIC/RAW/video support, automatic place-name correction, or
automatic translation.

## 한국어 사용법

### 실행

```bash
npm run dev
```

한 번 프로젝트를 열거나 저장하면, 다음 실행 시 마지막으로 사용한 프로젝트가 자동으로 열립니다.

### 기본 작업 순서

1. `New` 버튼 또는 `File > New Project`로 새 프로젝트를 만들거나, `Open` 또는 `File > Open Project`로 기존 프로젝트를 엽니다.
2. `Import Schedule CSV`로 일정 CSV를 가져옵니다.
3. `Select Photo Folder`로 원본 사진 폴더를 선택합니다. 이 폴더 아래 하위 폴더(예: 인물별 `김명숙-photo/`, `이충일-photo/` 폴더)까지 전부 재귀적으로 스캔하므로, 여러 사람 사진을 하위 폴더로 나눠 담아도 한 번에 인식됩니다.
4. 앱이 사진을 스캔하고 썸네일을 생성한 뒤, 촬영 시각 기준으로 Day를 자동 배정합니다(`Run Auto Assignment`로 다시 실행 가능).
5. 좌측 사이드바의 상태별 필터(전체 사진/Unmatched/선택됨/선택 안됨/수동 배정/EXIF 자동 배정/EXIF 누락 검토) 또는 Day별 목록에서 사진을 검토합니다.
6. 사진 카드를 클릭하면 상세 화면이 열립니다. 상단에는 배정된 Day와 구간(예: `Day 04 · 수비리 → Pamplona`)과 원본 경로, 가운데는 원본 해상도 사진, 하단에는 파일명·크기·촬영 시각·보정된 배정 시각과 함께 Day 이동, 순서 앞으로/뒤로 조정이 가로로 배치되어 있습니다. 사진 선택/해제는 그리드 카드의 동그란 점을 클릭해서 합니다.
7. 필요한 사진을 선택하고, 필요하면 Day 이동이나 같은 Day 안의 순서를 수동으로 조정합니다. 그리드 상단의 "모두 선택" / "모두 선택 해제"로 현재 보이는 사진을 한 번에 선택/해제할 수 있습니다.
8. `Select Output Folder`로 내보낼 폴더를 지정합니다.
9. `Export Preview`로 내보내기 전 파일 목록과 New/Collision 상태를 확인합니다. 기존 파일이 있으면 차단합니다.
10. 상단 `Export Scheduled Photo` 또는 `File > Export Selected Photos`로 선택한 사진을 내보냅니다. 문제가 있으면 Export Preview가 자동으로 열리고 내보내기가 차단됩니다.

### 프로젝트와 폴더

- 프로젝트 파일 위치는 사용자가 지정할 수 있습니다.
- 썸네일 캐시는 프로젝트별 `.camino_cache/thumbnails` 폴더에 저장됩니다.
- 원본 사진은 수정하지 않습니다.
- 기존 출력 사진·`manifest.csv`·`camino_project.json`이 있으면 내보내기를 차단합니다. 재실행할 때는 새 출력 폴더를 선택하세요. 복사는 덮어쓰기 금지 모드를 사용합니다.

### 설정과 검토

- 상단 Year, TZ, Boundary를 직접 변경할 수 있습니다. 연도를 변경하면 CSV의 월·일로 일정 날짜를 다시 만들고 자동 배정을 갱신합니다. 시간 보정·경계 변경도 자동 배정을 갱신하며, 수동으로 지정한 Day와 Unmatched는 유지합니다. 윤년 등 유효하지 않은 날짜가 생기면 변경을 적용하지 않고 상태줄에 오류를 표시합니다.
- 썸네일 크기는 작게/보통/크게로 변경할 수 있으며 설정은 프로젝트 Save로 저장합니다.
- CSV 문제는 검토 표에 행·열·입력값·원인을 표시합니다. CSV를 수정한 뒤 다시 가져오세요.
- 그리드의 `선택한 표시 사진 이동`은 현재 표시 중이며 선택된 사진만 지정 Day 또는 Unmatched로 이동합니다. 전체 선택은 내보낼 사진 선택과 같은 상태를 사용합니다.
- Rest Days / Walking Days 필터를 제공합니다. 순서만 변경한 사진은 원래의 EXIF/수동 Day 배정 출처를 유지합니다.
- 내보내기 미리보기와 실행 직전에 원본 존재·읽기 가능 여부, 출력 경로 쓰기 권한, 기존 파일·폴더, 원본 경로 중복을 검사합니다. 출력 경로의 심볼릭 링크·Windows junction은 차단합니다. 실행 중 발생한 개별 복사 오류는 manifest와 결과 표에 기록하며 성공·실패 건수를 표시합니다.
- 내보내기는 출력 폴더에 프로젝트 스냅샷을 저장합니다. 편집 중인 프로젝트 파일은 Save로 별도 저장하세요. 내보내기는 기존 프로젝트 파일을 덮어쓰지 않습니다.

수정 사항 회귀 검증: `npm run test:review-fixes`는 실제 렌더러와 preload, 임시 프로젝트, 격리된 IPC 테스트 환경에서 설정 저장·일괄 이동·필터·순서 변경 출처 유지·CSV 검토·복사 실패 표시·충돌 차단을 검증합니다. `npm test`에는 실제 파일 복사, 동시 파일 생성 충돌, 출력 권한 실패, junction 차단 테스트가 포함됩니다.

### 자동 슬라이드쇼

1. 상단 `▶ 슬라이드쇼`를 엽니다. 기본 구성은 전체 사진, Day 순서, Day 안에서는 시간순이며 각 Day 앞에 표지가 들어갑니다.
2. `전체 사진` 또는 `선택한 사진만`을 고르고 포함할 Day를 체크합니다. 사이드바에서 Day를 보고 있었다면 `현재 Day만` 버튼도 사용할 수 있습니다.
3. 필요하면 사진 상세 화면의 `사진 유형`에서 **풍경 / 인물 / 음식 / 숙소 / 길·표지 / 기타**를 직접 지정한 뒤 해당 유형만 재생합니다. 지정하지 않은 사진은 `미분류`입니다. 여러 유형을 체크하면 그중 하나에 해당하는 사진을 모두 포함하고, 유형을 체크하지 않으면 전체 유형을 포함합니다. 자동 이미지 분석은 하지 않습니다.
4. 사진 순서는 **시간순 / 사용자 지정 순서 / 무작위 순서** 중에서 고릅니다. 시간순은 보정 시각 → DateTimeOriginal → CreateDate → FileModifyDate 순으로 시각을 찾으며, 알 수 없는 시각은 마지막에 놓습니다. 사용자 지정 순서는 상세 화면의 `순서 앞으로 / 뒤로`로 정한 Day 내부 순서입니다. 무작위도 Day별 묶음은 유지하며, 한 번 시작한 재생에서는 순서가 고정됩니다.
5. 사진 표시 시간(기본 5초), 표지 표시 시간(기본 3초), 표지·설명 표시와 반복 재생을 설정합니다. 사진 수, 표지 포함 슬라이드 수, 예상 재생 시간을 확인하고 `자동 재생 시작`을 누릅니다.

표지에는 `Day nn`, 구간명 또는 연박 장소, 날짜, 거리, 경유지, 숙소와 사진 수가 표시됩니다. 원래 일정에 입력한 표기를 유지합니다. 조건에 맞는 사진이 없는 Day는 생략합니다. Day 미배정·누락·손상 사진은 제외하고, 실행 중 원본을 읽지 못하거나 12초 동안 로딩이 끝나지 않으면 건너뜁니다. 모든 사진을 읽을 수 없으면 반복 설정과 관계없이 종료합니다.

재생은 자동으로 진행됩니다. `Space`는 일시정지/재개, `← / →`는 이전/다음, `F`는 전체 화면, `Esc`는 닫기입니다(전체 화면에서는 먼저 전체 화면이 해제될 수 있습니다). 일시정지 후 재개하면 현재 사진의 표시 시간을 다시 셉니다. 반복을 끄면 마지막 슬라이드 뒤에 완료 화면이 나오며, `다시 재생`으로 처음부터 볼 수 있습니다. `구성 변경`은 재생을 끝내고 설정으로 돌아갑니다.

하단 슬라이드바를 **클릭하거나 손잡이를 드래그**하면 표지를 포함한 원하는 슬라이드로 바로 이동합니다. 드래그 중에는 자동 전환을 잠시 멈추고, 놓으면 기존 재생/일시정지 상태를 유지하며 해당 슬라이드의 표시 시간을 다시 셉니다. 슬라이드바에 초점을 두고 `← / →`로 한 장씩, `Home / End`로 처음/마지막으로 이동할 수도 있습니다. 완료 화면에서 이동하면 일시정지 상태로 감상할 수 있습니다.

설정과 사진 유형은 **프로젝트의 `Save`를 눌러 JSON에 저장**하고 다시 열 때 복원합니다. 슬라이드쇼를 열거나 재생해도 사진의 선택·Day 배정·원본 파일은 변경되지 않습니다. 화면에는 현재 원본 한 장만 불러오고 사진 전체를 미리 디코딩하지 않습니다. 사진은 잘리지 않도록 화면 안에 맞춰 표시합니다. 이 기능은 앱 안에서 감상하는 슬라이드쇼이며 동영상 파일 내보내기는 지원하지 않습니다.

슬라이드쇼 회귀 검증: `npm test` (구성 및 저장/복원), `npm run test:slideshow` (빌드 후 Playwright로 별도 Electron 테스트 창에서 자동 재생·정지·반복·실패 처리를 검증). 후자는 실제 프로젝트 대신 임시 사진과 프로젝트를 사용합니다.

### 사진 정렬과 매칭

- 사진 그리드는 기본적으로 배정된 Day(=날짜) 순으로 정렬되고, 같은 Day 안에서는 촬영 시각순으로 정렬됩니다. 같은 Day 안에서 수동으로 순서를 바꾼 경우 그 순서가 우선 적용됩니다.
- 이 화면 순서는 실제 내보내기 시 파일 순번(seq)과 동일한 기준을 사용합니다.
- Unmatched(배정 안 됨) 사진은 목록 맨 뒤에 표시됩니다.
- JPG/JPEG는 EXIF 촬영 시각을 우선 사용합니다.
- PNG처럼 EXIF 촬영 시각이 없는 사진은 별도 검토 대상("EXIF 누락 검토")으로 표시됩니다.
- Unmatched 사진이 선택되어 있으면 내보내기가 차단됩니다.

## TZ 설정

GUI 우측 상단의 `TZ`는 사진 촬영 시각을 일정 날짜에 맞추기 위한 시간대 보정값입니다.

- 단위: 시간
- 기본값: `0`
- 일반적인 값의 범위: `-12`부터 `+14`
- `TZ = 0`: 사진 시간을 그대로 사용
- `TZ = 1`: 촬영 시간을 1시간 뒤로 보정
- `TZ = -1`: 촬영 시간을 1시간 앞으로 보정

예를 들어 사진 EXIF 시간이 `2026-02-12 23:30`이고 `TZ`가 `1`이면, 앱은 이를 `2026-02-13 00:30`으로 보정해서 Day 배정에 사용합니다.

### 언제 조정하나요?

- 카메라 시간이 이미 현지 시간으로 맞춰져 있었다면 보통 `TZ = 0`을 사용합니다.
- 카메라 시간이 한국 시간으로 남아 있고 일정은 유럽 현지 날짜 기준이라면 음수 보정이 필요할 수 있습니다.
- 자동 배정 결과가 하루씩 밀리면 `TZ` 값을 조정한 뒤 `Run Auto Assignment`를 다시 실행해 확인합니다.

### Boundary와의 관계

`Boundary`는 하루가 바뀌는 기준 시각입니다. 기본값은 `04:00`입니다.

예를 들어 `Boundary = 04:00`이면 `2026-02-13 03:30` 사진은 `2026-02-12` 일정 Day로 배정됩니다. 순례 중 자정 이후에 찍은 사진을 전날 일정에 포함하기 위한 설정입니다.
