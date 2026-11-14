import { useEffect, useMemo, useRef, useState } from "react";
import { manuallyAssignPhotos } from "../shared/autoAssigner.js";
import { buildExportPreview } from "../shared/exportValidator.js";
import { updateProjectSettings } from "../shared/projectSettings.js";
import type { ProjectSettings } from "../shared/projectSettings.js";
import { sortPhotosForDisplay } from "../shared/filenameBuilder.js";
import { DaySidebar } from "./components/DaySidebar";
import type { PhotoViewFilter } from "./components/DaySidebar";
import { ExportPreview } from "./components/ExportPreview";
import { FloatingProgress } from "./components/FloatingProgress";
import { PhotoDetailPanel } from "./components/PhotoDetailPanel";
import { PhotoGrid } from "./components/PhotoGrid";
import { ProgressBar } from "./components/ProgressBar";
import { Toolbar } from "./components/Toolbar";
import { Slideshow } from "./components/Slideshow";
import type { ScanProgress } from "./caminoApi";
import type {
  CsvValidationIssue,
  ExportPreviewResult,
  PhotoItem,
  Project,
  ProjectSummary,
  ScheduleDay
} from "../shared/types.js";

const sampleSchedule: ScheduleDay[] = [
  {
    day: 1,
    dateRaw: "02월 12일",
    date: "2026-02-12",
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
    day: 4,
    dateRaw: "02월 15일",
    date: "2026-02-15",
    routeText: "수비리 → Pamplona",
    dayType: "walking",
    startPlace: "수비리",
    endPlace: "Pamplona",
    viaPlaces: [],
    displayTitle: "수비리 → Pamplona",
    distanceKm: 21.8,
    accommodation: "Alb. jesus y Maria"
  },
  {
    day: 5,
    dateRaw: "02월 16일",
    date: "2026-02-16",
    routeText: "연박",
    dayType: "rest",
    startPlace: "Pamplona",
    endPlace: "Pamplona",
    viaPlaces: [],
    displayTitle: "Pamplona 연박",
    accommodation: "Alb. jesus y Maria"
  }
];

const MIN_PROGRESS_VISIBLE_MS = 700;

const SCAN_PHASE_LABELS: Record<ScanProgress["phase"], string> = {
  scanning: "사진 파일 검색 중",
  exif: "사진 정보 읽는 중",
  thumbnails: "썸네일 생성 중"
};

const samplePhotos: PhotoItem[] = [
  {
    id: "photo-1",
    originalPath: "C:/Photos/IMG_1032.jpg",
    fileName: "IMG_1032.jpg",
    extension: ".jpg",
    fileSize: 3_482_112,
    fileModifiedAt: "2026-02-15T18:31:00",
    dateTimeOriginal: "2026-02-15T14:22:00",
    effectiveDateTime: "2026-02-15T14:22:00",
    assignedDay: 4,
    selected: true,
    sequence: 1,
    matchSource: "DateTimeOriginal"
  },
  {
    id: "photo-2",
    originalPath: "C:/Photos/IMG_1033.jpg",
    fileName: "IMG_1033.jpg",
    extension: ".jpg",
    fileSize: 2_918_400,
    fileModifiedAt: "2026-02-16T01:30:00",
    dateTimeOriginal: "2026-02-16T02:30:00",
    effectiveDateTime: "2026-02-16T02:30:00",
    assignedDay: 4,
    selected: false,
    sequence: 2,
    matchSource: "DateTimeOriginal"
  },
  {
    id: "photo-3",
    originalPath: "C:/Photos/map.png",
    fileName: "map.png",
    extension: ".png",
    fileSize: 614_400,
    fileModifiedAt: "2026-02-16T10:10:00",
    selected: false,
    matchSource: "unmatched",
    needsUserReview: true,
    reviewReason: "missing_exif"
  }
];

const createProjectSummary = (schedule: ScheduleDay[], photos: PhotoItem[]): ProjectSummary => ({
  totalPhotosScanned: photos.length,
  totalPhotosAssignedAutomatically: photos.filter(
    (photo) => photo.assignedDay !== undefined && photo.matchSource !== "manual"
  ).length,
  totalPhotosAssignedManually: photos.filter((photo) => photo.matchSource === "manual").length,
  totalUnmatchedPhotos: photos.filter((photo) => photo.assignedDay === undefined).length,
  totalSelectedPhotos: photos.filter((photo) => photo.selected).length,
  totalDays: schedule.length,
  totalMissingExifPhotos: photos.filter((photo) => photo.reviewReason === "missing_exif").length,
  totalMissingFiles: photos.filter((photo) => photo.missing).length,
  totalUnsupportedFiles: 0,
  firstStartPlace: schedule[0]?.startPlace,
  lastEndPlace: schedule[schedule.length - 1]?.endPlace
});

const initialProject: Project = {
  schemaVersion: "1.0.0",
  projectName: "Camino 2026",
  routeName: "프랑스길",
  projectYear: 2026,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sourcePhotoDir: "",
  outputDir: "C:/Output",
  filenamePattern: "D{day:02d}_{start}_to_{end}_{seq:03d}.{ext}",
  timezoneOffsetHours: 0,
  dayBoundaryTime: "04:00",
  thumbnailCacheDir: "",
  schedule: sampleSchedule,
  photos: samplePhotos,
  summary: createProjectSummary(sampleSchedule, samplePhotos)
};

const getCaminoApi = () => {
  if (!window.camino) {
    throw new Error("Electron API is not available. Run the app with npm run dev, not Vite only.");
  }

  return window.camino;
};

const filterPhotos = (photos: PhotoItem[], view: PhotoViewFilter, schedule: ScheduleDay[]) => {
  if (view === "rest" || view === "walking") {
    const days = new Set(schedule.filter((day) => day.dayType === view).map((day) => day.day));
    return photos.filter((photo) => photo.assignedDay !== undefined && days.has(photo.assignedDay));
  }
  if (view.startsWith("day:")) {
    const day = Number(view.split(":")[1]);
    return photos.filter((photo) => photo.assignedDay === day);
  }

  switch (view) {
    case "unmatched":
      return photos.filter((photo) => photo.assignedDay === undefined);
    case "selected":
      return photos.filter((photo) => photo.selected);
    case "unselected":
      return photos.filter((photo) => !photo.selected);
    case "manual":
      return photos.filter((photo) => photo.matchSource === "manual");
    case "exif":
      return photos.filter(
        (photo) => photo.assignedDay !== undefined && photo.matchSource !== "manual"
      );
    case "missing-exif":
      return photos.filter((photo) => photo.reviewReason === "missing_exif");
    default:
      return photos;
  }
};

const normalizeManualOrder = (photos: PhotoItem[], targetDay: number | undefined) => {
  if (targetDay === undefined) {
    return photos;
  }

  const dayPhotos = photos
    .filter((photo) => photo.assignedDay === targetDay)
    .sort((left, right) => {
      const leftOrder = left.manualOrder ?? Number.POSITIVE_INFINITY;
      const rightOrder = right.manualOrder ?? Number.POSITIVE_INFINITY;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.fileName.localeCompare(right.fileName);
    });
  const orderById = new Map(dayPhotos.map((photo, index) => [photo.id, index + 1]));

  return photos.map((photo) =>
    photo.assignedDay === targetDay ? { ...photo, manualOrder: orderById.get(photo.id) } : photo
  );
};

const App = () => {
  const [project, setProject] = useState<Project>(initialProject);
  const [schedule, setSchedule] = useState<ScheduleDay[]>(initialProject.schedule);
  const [photos, setPhotos] = useState(samplePhotos);
  const [activeView, setActiveView] = useState<PhotoViewFilter>("all");
  const [focusedPhotoId, setFocusedPhotoId] = useState(samplePhotos[0]?.id);
  const [modalPhotoId, setModalPhotoId] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [activeOperationPercent, setActiveOperationPercent] = useState<number | undefined>();
  const progressStartedAtRef = useRef<number | undefined>(undefined);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [checkedPreview, setCheckedPreview] = useState<ExportPreviewResult>();
  const [csvIssues, setCsvIssues] = useState<CsvValidationIssue[]>([]);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const exportPreviewRef = useRef<HTMLDivElement | null>(null);
  const currentProject = useMemo<Project>(
    () => ({
      ...project,
      schedule,
      photos,
      summary: createProjectSummary(schedule, photos)
    }),
    [photos, project, schedule]
  );
  const visiblePhotos = useMemo(
    () => sortPhotosForDisplay(filterPhotos(photos, activeView, schedule)),
    [activeView, photos, schedule]
  );
  const photoGridTitle = useMemo(() => {
    if (!activeView.startsWith("day:")) {
      return "Photos";
    }

    const selectedDayNumber = Number(activeView.slice("day:".length));
    const selectedDay = schedule.find((day) => day.day === selectedDayNumber);
    const dayLabel = `Day ${selectedDayNumber.toString().padStart(2, "0")}`;

    return selectedDay
      ? `Photos (${dayLabel} - ${selectedDay.displayTitle})`
      : `Photos (${dayLabel})`;
  }, [activeView, schedule]);
  const exportPreview = useMemo(
    () =>
      buildExportPreview(photos, schedule, {
        outputDir: currentProject.outputDir
      }),
    [currentProject.outputDir, photos, schedule]
  );
  useEffect(() => {
    setCheckedPreview(undefined);
    setShowExportPreview(false);
  }, [currentProject]);
  const changeSettings = (values: Partial<ProjectSettings>) => {
    try {
      const next = updateProjectSettings(currentProject, values);
      setProject(next);
      setSchedule(next.schedule);
      setPhotos(next.photos);
      setStatusMessage(
        "설정 적용 완료 · 수동 Day 배정을 유지하고 자동 배정을 갱신했습니다. Save로 저장하세요."
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "설정 오류");
    }
  };
  const focusedPhoto =
    photos.find((photo) => photo.id === focusedPhotoId) ?? visiblePhotos[0] ?? photos[0];
  const modalPhoto = modalPhotoId ? photos.find((photo) => photo.id === modalPhotoId) : undefined;
  const modalPhotoIndex = modalPhotoId
    ? visiblePhotos.findIndex((photo) => photo.id === modalPhotoId)
    : -1;
  const canGoPreviousPhoto = modalPhotoIndex > 0;
  const canGoNextPhoto = modalPhotoIndex >= 0 && modalPhotoIndex < visiblePhotos.length - 1;

  const showModalPhotoAt = (index: number) => {
    const nextPhoto = visiblePhotos[index];

    if (!nextPhoto) {
      return;
    }

    setFocusedPhotoId(nextPhoto.id);
    setModalPhotoId(nextPhoto.id);
  };

  const showPreviousModalPhoto = () => {
    if (canGoPreviousPhoto) {
      showModalPhotoAt(modalPhotoIndex - 1);
    }
  };

  const showNextModalPhoto = () => {
    if (canGoNextPhoto) {
      showModalPhotoAt(modalPhotoIndex + 1);
    }
  };

  const updatePhotoSelection = (photoIds: string[], selected: boolean) => {
    const targetIds = new Set(photoIds);
    setPhotos((currentPhotos) =>
      currentPhotos.map((photo) => (targetIds.has(photo.id) ? { ...photo, selected } : photo))
    );
  };

  const togglePhotoSelection = (photoId: string) => {
    setPhotos((currentPhotos) =>
      currentPhotos.map((photo) =>
        photo.id === photoId ? { ...photo, selected: !photo.selected } : photo
      )
    );
  };

  const movePhoto = (photoId: string, assignedDay: number | undefined) => {
    setPhotos((currentPhotos) =>
      normalizeManualOrder(manuallyAssignPhotos(currentPhotos, [photoId], assignedDay), assignedDay)
    );
  };

  const movePhotoOrder = (photoId: string, direction: "up" | "down") => {
    setPhotos((currentPhotos) => {
      const targetPhoto = currentPhotos.find((photo) => photo.id === photoId);

      if (!targetPhoto || targetPhoto.assignedDay === undefined) {
        return currentPhotos;
      }

      const ordered = normalizeManualOrder(currentPhotos, targetPhoto.assignedDay)
        .filter((photo) => photo.assignedDay === targetPhoto.assignedDay)
        .sort((left, right) => (left.manualOrder ?? 0) - (right.manualOrder ?? 0));
      const index = ordered.findIndex((photo) => photo.id === photoId);
      const nextIndex = direction === "up" ? index - 1 : index + 1;

      if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) {
        return currentPhotos;
      }

      const currentOrder = ordered[index].manualOrder;
      const nextOrder = ordered[nextIndex].manualOrder;

      return currentPhotos.map((photo) => {
        if (photo.id === ordered[index].id) {
          return { ...photo, manualOrder: nextOrder };
        }

        if (photo.id === ordered[nextIndex].id) {
          return { ...photo, manualOrder: currentOrder };
        }

        return photo;
      });
    });
  };

  const applyProject = (nextProject: Project) => {
    setCsvIssues([]);
    setShowExportPreview(false);
    setShowSlideshow(false);
    setProject(nextProject);
    setSchedule(nextProject.schedule);
    setPhotos(nextProject.photos);
    setFocusedPhotoId(nextProject.photos[0]?.id);
    setModalPhotoId(undefined);
    setActiveView("all");
  };

  const showProgress = (percent: number) => {
    if (progressStartedAtRef.current === undefined) {
      progressStartedAtRef.current = Date.now();
    }

    setActiveOperationPercent(percent);
  };

  const hideProgress = async () => {
    const startedAt = progressStartedAtRef.current;

    if (startedAt !== undefined) {
      const remainingMs = MIN_PROGRESS_VISIBLE_MS - (Date.now() - startedAt);

      if (remainingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingMs));
      }
    }

    progressStartedAtRef.current = undefined;
    setActiveOperationPercent(undefined);
  };

  const runAction = async (message: string, action: () => Promise<void>) => {
    try {
      setStatusMessage(message);
      await action();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      await hideProgress();
    }
  };

  const handleNewProject = () =>
    runAction("Creating project...", async () => {
      const nextProject = await getCaminoApi().newProject();

      if (nextProject) {
        applyProject(nextProject);
        setStatusMessage(`Created ${nextProject.projectName}`);
      } else {
        setStatusMessage("New project canceled");
      }
    });

  const handleOpenProject = () =>
    runAction("Opening project...", async () => {
      const nextProject = await getCaminoApi().openProject();

      if (nextProject) {
        applyProject(nextProject);
        setStatusMessage(`Opened ${nextProject.projectName}`);
      } else {
        setStatusMessage("Open project canceled");
      }
    });

  const handleSaveProject = () =>
    runAction("Saving project...", async () => {
      const savedProject = await getCaminoApi().saveProject(currentProject);

      if (savedProject) {
        applyProject(savedProject);
        setStatusMessage("Project saved");
      } else {
        setStatusMessage("Save project canceled");
      }
    });

  const handleImportSchedule = () =>
    runAction("Importing schedule...", async () => {
      const result = await getCaminoApi().importSchedule(currentProject.projectYear);

      if (result) {
        setCsvIssues(result.issues);
        setSchedule(result.schedule);
        setProject((current) => ({
          ...current,
          routeName: result.routeName,
          schedule: result.schedule
        }));
        setStatusMessage(
          `Imported ${result.schedule.length} days${
            result.issues.length ? ` with ${result.issues.length} issues` : ""
          }`
        );
      } else {
        setStatusMessage("Import schedule canceled");
      }
    });

  const handleSelectPhotoFolder = () =>
    runAction("Scanning photo folder...", async () => {
      const result = await getCaminoApi().selectPhotoFolder(currentProject);

      if (result) {
        const assignedAutomatically = result.photos.filter(
          (photo) => photo.assignedDay !== undefined && photo.matchSource !== "manual"
        ).length;
        const unmatched = result.photos.filter((photo) => photo.matchSource === "unmatched").length;
        const missingExif = result.photos.filter(
          (photo) => photo.reviewReason === "missing_exif"
        ).length;

        setPhotos(result.photos);
        setProject((current) => ({
          ...current,
          sourcePhotoDir: result.sourcePhotoDir,
          photos: result.photos,
          summary: {
            ...current.summary,
            totalPhotosScanned: result.photos.length,
            totalPhotosAssignedAutomatically: assignedAutomatically,
            totalUnmatchedPhotos: unmatched,
            totalMissingExifPhotos: missingExif,
            totalUnsupportedFiles: result.unsupportedFiles.length
          }
        }));
        setFocusedPhotoId(result.photos[0]?.id);
        setStatusMessage(
          `Scanned ${result.photos.length} photos, auto assigned ${assignedAutomatically}, unmatched ${unmatched}, ${result.unsupportedFiles.length} unsupported`
        );
      } else {
        setStatusMessage("Select photo folder canceled");
      }
    });

  const handleSelectOutputFolder = () =>
    runAction("Selecting output folder...", async () => {
      const outputDir = await getCaminoApi().selectOutputFolder();

      if (outputDir) {
        setProject((current) => ({ ...current, outputDir }));
        setStatusMessage(`Output folder selected: ${outputDir}`);
      } else {
        setStatusMessage("Select output folder canceled");
      }
    });

  const handleAutoAssign = () =>
    runAction("Auto assigning photos...", async () => {
      const result = await getCaminoApi().autoAssignPhotos(currentProject);
      setPhotos(result.photos);
      setStatusMessage(
        `Auto assigned ${result.totalAssignedAutomatically}, unmatched ${result.totalUnmatched}`
      );
    });

  const handleShowExportPreview = () =>
    runAction("출력 경로 검사 중...", async () => {
      const checked = await getCaminoApi().previewExport(currentProject);
      setCheckedPreview(checked);
      setShowExportPreview(true);
      setStatusMessage(
        checked.canExport
          ? `Export preview ready: ${checked.items.length} planned files`
          : `Export preview blocked: ${checked.issues.length} issues`
      );
      window.requestAnimationFrame(() => {
        exportPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

  const handleExportSelected = () =>
    runAction("Exporting selected photos...", async () => {
      const checked = await getCaminoApi().previewExport(currentProject);
      setCheckedPreview(checked);
      if (!checked.canExport) {
        setShowExportPreview(true);
        window.requestAnimationFrame(() => {
          exportPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        setStatusMessage("Export blocked. Review the export preview issues.");
        return;
      }

      const result = await getCaminoApi().exportSelectedPhotos(currentProject);
      setCheckedPreview({ items: result.items, issues: [], canExport: false });
      setShowExportPreview(true);
      setStatusMessage(
        `내보내기 ${result.failedCount ? "일부 실패" : "완료"}: 복사 ${result.copiedCount}개, 실패 ${result.failedCount}개 · 기록: ${result.manifestPath}`
      );
    });

  const menuActionsRef = useRef({
    saveProject: handleSaveProject,
    importSchedule: handleImportSchedule,
    selectPhotoFolder: handleSelectPhotoFolder,
    selectOutputFolder: handleSelectOutputFolder,
    autoAssign: handleAutoAssign,
    showExportPreview: handleShowExportPreview,
    exportSelected: handleExportSelected
  });

  menuActionsRef.current = {
    saveProject: handleSaveProject,
    importSchedule: handleImportSchedule,
    selectPhotoFolder: handleSelectPhotoFolder,
    selectOutputFolder: handleSelectOutputFolder,
    autoAssign: handleAutoAssign,
    showExportPreview: handleShowExportPreview,
    exportSelected: handleExportSelected
  };

  useEffect(() => {
    if (!window.camino) {
      return undefined;
    }

    const removeMenuCommandListener = window.camino.onMenuCommand?.((command) => {
      switch (command) {
        case "save-project":
          menuActionsRef.current.saveProject();
          break;
        case "import-schedule":
          menuActionsRef.current.importSchedule();
          break;
        case "select-photo-folder":
          menuActionsRef.current.selectPhotoFolder();
          break;
        case "select-output-folder":
          menuActionsRef.current.selectOutputFolder();
          break;
        case "auto-assign":
          menuActionsRef.current.autoAssign();
          break;
        case "export-preview":
          menuActionsRef.current.showExportPreview();
          break;
        case "export-selected":
          menuActionsRef.current.exportSelected();
          break;
      }
    });
    const removeProjectLoadedListener = window.camino.onProjectLoadedFromMenu?.((nextProject) => {
      applyProject(nextProject);
      setStatusMessage(`Opened ${nextProject.projectName}`);
    });
    const removeMenuStatusListener = window.camino.onMenuStatus?.(setStatusMessage);
    const removeScanProgressListener = window.camino.onScanProgress?.(
      ({ phase, completed, total }) => {
        const phaseLabel = SCAN_PHASE_LABELS[phase];
        setStatusMessage(total ? `${phaseLabel}... (${completed}/${total})` : `${phaseLabel}...`);
        showProgress(total ? Math.round((completed / total) * 100) : 0);
      }
    );
    const removeExportProgressListener = window.camino.onExportProgress?.(
      ({ completed, total }) => {
        setStatusMessage(`내보내는 중... (${completed}/${total})`);
        showProgress(total ? Math.round((completed / total) * 100) : 0);
      }
    );

    return () => {
      removeMenuCommandListener?.();
      removeExportProgressListener?.();
      removeProjectLoadedListener?.();
      removeMenuStatusListener?.();
      removeScanProgressListener?.();
    };
  }, []);

  useEffect(() => {
    if (!window.camino?.getLastOpenedProject) {
      return undefined;
    }

    let canceled = false;

    window.camino
      .getLastOpenedProject()
      .then((lastProject) => {
        if (!lastProject || canceled) {
          return;
        }

        setProject(lastProject);
        setSchedule(lastProject.schedule);
        setPhotos(lastProject.photos);
        setFocusedPhotoId(lastProject.photos[0]?.id);
        setModalPhotoId(undefined);
        setActiveView("all");
        setStatusMessage(`Opened ${lastProject.projectName}`);
      })
      .catch((error: unknown) => {
        if (!canceled) {
          setStatusMessage(
            error instanceof Error ? error.message : "Could not open recent project."
          );
        }
      });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!modalPhotoId) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalPhotoId(undefined);
      } else if (event.key === "ArrowLeft") {
        const currentIndex = visiblePhotos.findIndex((photo) => photo.id === modalPhotoId);
        const previousPhoto = visiblePhotos[currentIndex - 1];

        if (previousPhoto) {
          setFocusedPhotoId(previousPhoto.id);
          setModalPhotoId(previousPhoto.id);
        }
      } else if (event.key === "ArrowRight") {
        const currentIndex = visiblePhotos.findIndex((photo) => photo.id === modalPhotoId);
        const nextPhoto = visiblePhotos[currentIndex + 1];

        if (nextPhoto) {
          setFocusedPhotoId(nextPhoto.id);
          setModalPhotoId(nextPhoto.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalPhotoId, visiblePhotos]);

  return (
    <main className="app-shell">
      <Toolbar
        projectName={currentProject.projectName}
        sourcePhotoDir={currentProject.sourcePhotoDir}
        outputDir={currentProject.outputDir}
        projectYear={currentProject.projectYear}
        timezoneOffsetHours={currentProject.timezoneOffsetHours}
        dayBoundaryTime={currentProject.dayBoundaryTime}
        thumbnailSize={currentProject.thumbnailSize ?? 240}
        onSettingsChange={changeSettings}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onImportSchedule={handleImportSchedule}
        onSelectPhotoFolder={handleSelectPhotoFolder}
        onSelectOutputFolder={handleSelectOutputFolder}
        onAutoAssign={handleAutoAssign}
        onShowExportPreview={handleShowExportPreview}
        onExportSelected={handleExportSelected}
        onSlideshow={() => {
          setModalPhotoId(undefined);
          setShowSlideshow(true);
        }}
      />
      {csvIssues.length > 0 && (
        <section className="export-preview" aria-label="CSV 오류 검토">
          <h2>일정 CSV 검토 · {csvIssues.length}건</h2>
          <button type="button" onClick={() => setCsvIssues([])}>
            닫기
          </button>
          <table>
            <thead>
              <tr>
                <th>행</th>
                <th>열</th>
                <th>입력값</th>
                <th>문제</th>
              </tr>
            </thead>
            <tbody>
              {csvIssues.map((issue, index) => (
                <tr key={index}>
                  <td>{issue.rowNumber}</td>
                  <td>{issue.columnName ?? "헤더"}</td>
                  <td>{issue.value}</td>
                  <td>{issue.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>CSV 원본을 수정한 뒤 다시 가져오세요.</p>
        </section>
      )}
      <section className="workspace">
        <DaySidebar
          schedule={schedule}
          photos={photos}
          activeView={activeView}
          onViewChange={setActiveView}
        />
        <PhotoGrid
          schedule={schedule}
          thumbnailSize={currentProject.thumbnailSize ?? 240}
          onMoveSelected={(day) => {
            const ids = visiblePhotos.filter((photo) => photo.selected).map((photo) => photo.id);
            setPhotos((current) =>
              normalizeManualOrder(manuallyAssignPhotos(current, ids, day), day)
            );
            setStatusMessage(
              `${ids.length}개 사진을 ${day === undefined ? "Unmatched" : `Day ${day}`}로 이동했습니다.`
            );
          }}
          title={photoGridTitle}
          photos={visiblePhotos}
          selectedPhotoId={focusedPhoto?.id}
          onPhotoFocus={(photoId) => {
            setFocusedPhotoId(photoId);
            setModalPhotoId(photoId);
          }}
          onToggleSelected={togglePhotoSelection}
          onSelectAllVisible={() =>
            updatePhotoSelection(
              visiblePhotos.map((photo) => photo.id),
              true
            )
          }
          onDeselectAllVisible={() =>
            updatePhotoSelection(
              visiblePhotos.map((photo) => photo.id),
              false
            )
          }
        />
      </section>
      <PhotoDetailPanel
        photo={modalPhoto}
        schedule={schedule}
        canGoPrevious={canGoPreviousPhoto}
        canGoNext={canGoNextPhoto}
        onClose={() => setModalPhotoId(undefined)}
        onPrevious={showPreviousModalPhoto}
        onNext={showNextModalPhoto}
        onMovePhoto={movePhoto}
        onMoveOrder={movePhotoOrder}
        onCategoryChange={(photoId, category) =>
          setPhotos((current) =>
            current.map((photo) => (photo.id === photoId ? { ...photo, category } : photo))
          )
        }
      />
      {showSlideshow && (
        <Slideshow
          photos={photos}
          schedule={schedule}
          projectName={project.projectName}
          settings={project.slideshowSettings}
          currentDay={activeView.startsWith("day:") ? Number(activeView.slice(4)) : undefined}
          onSettingsChange={(slideshowSettings) =>
            setProject((current) => ({ ...current, slideshowSettings }))
          }
          onClose={() => setShowSlideshow(false)}
        />
      )}
      {showExportPreview ? (
        <div ref={exportPreviewRef}>
          <ExportPreview
            preview={checkedPreview ?? exportPreview}
            onClose={() => setShowExportPreview(false)}
          />
        </div>
      ) : null}
      <ProgressBar
        label={statusMessage}
        value={
          photos.length
            ? Math.round((photos.filter((photo) => photo.selected).length / photos.length) * 100)
            : 0
        }
        message={`${visiblePhotos.length} 표시중 / ${photos.length} 전체 · 선택 ${photos.filter((photo) => photo.selected).length}`}
      />
      {activeOperationPercent !== undefined ? (
        <FloatingProgress label={statusMessage} percent={activeOperationPercent} />
      ) : null}
    </main>
  );
};

export default App;
