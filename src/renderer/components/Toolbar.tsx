type ToolbarProps = {
  projectName: string;
  sourcePhotoDir: string;
  outputDir: string;
  projectYear: number;
  timezoneOffsetHours: number;
  dayBoundaryTime: string;
  thumbnailSize: number;
  onSettingsChange: (values: {
    projectYear?: number;
    timezoneOffsetHours?: number;
    dayBoundaryTime?: string;
    thumbnailSize?: number;
  }) => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onImportSchedule: () => void;
  onSelectPhotoFolder: () => void;
  onSelectOutputFolder: () => void;
  onAutoAssign: () => void;
  onShowExportPreview: () => void;
  onExportSelected: () => void;
  onSlideshow: () => void;
};

export const Toolbar = ({
  projectName,
  sourcePhotoDir,
  outputDir,
  projectYear,
  timezoneOffsetHours,
  dayBoundaryTime,
  thumbnailSize,
  onSettingsChange,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onImportSchedule,
  onSelectPhotoFolder,
  onSelectOutputFolder,
  onAutoAssign,
  onShowExportPreview,
  onExportSelected,
  onSlideshow
}: ToolbarProps) => (
  <header className="toolbar">
    <div className="toolbar-row">
      <div className="toolbar-title">
        <h1>Camino Photo Organizer</h1>
        <span>{projectName}</span>
      </div>
      <nav className="toolbar-actions" aria-label="Project actions">
        <button className="btn" type="button" onClick={onNewProject}>
          New
        </button>
        <button className="btn" type="button" onClick={onOpenProject}>
          Open
        </button>
        <button className="btn" type="button" onClick={onSaveProject}>
          Save
        </button>
        <span className="toolbar-divider" aria-hidden="true" />
        <button className="btn" type="button" onClick={onImportSchedule}>
          Import Schedule CSV
        </button>
        <button className="btn" type="button" onClick={onSelectPhotoFolder}>
          Select Photo Folder
        </button>
        <button className="btn" type="button" onClick={onSelectOutputFolder}>
          Select Output Folder
        </button>
        <button className="btn" type="button" onClick={onAutoAssign}>
          Run Auto Assignment
        </button>
        <span className="toolbar-divider" aria-hidden="true" />
        <button className="btn btn-accent-outline" type="button" onClick={onSlideshow}>
          ▶ 슬라이드쇼
        </button>
        <button className="btn btn-accent-outline" type="button" onClick={onShowExportPreview}>
          Export Preview
        </button>
        <button className="btn btn-accent-filled" type="button" onClick={onExportSelected}>
          Export Scheduled Photo
        </button>
      </nav>
    </div>
    <div className="toolbar-row">
      <div className="toolbar-paths" aria-label="Project folders">
        <div className="toolbar-field path">
          <span>입력 사진 폴더</span>
          <strong title={sourcePhotoDir}>{sourcePhotoDir || "-"}</strong>
        </div>
        <div className="toolbar-field path">
          <span>출력 폴더</span>
          <strong title={outputDir}>{outputDir || "-"}</strong>
        </div>
      </div>
      <div className="toolbar-settings" aria-label="Project settings">
        <div className="toolbar-field align-end">
          <span>Year</span>
          <input
            aria-label="Project Year"
            type="number"
            min="1900"
            max="9999"
            value={projectYear}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isInteger(value) && value >= 1900 && value <= 9999)
                onSettingsChange({ projectYear: value });
            }}
          />
        </div>
        <div className="toolbar-field align-end">
          <span>TZ</span>
          <input
            aria-label="Timezone Correction"
            type="number"
            min="-24"
            max="24"
            step="0.25"
            value={timezoneOffsetHours}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value) && value >= -24 && value <= 24)
                onSettingsChange({ timezoneOffsetHours: value });
            }}
          />
        </div>
        <div className="toolbar-field align-end">
          <span>Boundary</span>
          <input
            aria-label="Day Boundary Time"
            type="time"
            value={dayBoundaryTime}
            onChange={(e) => {
              if (e.target.value) onSettingsChange({ dayBoundaryTime: e.target.value });
            }}
          />
        </div>
        <label>
          썸네일 크기
          <select
            aria-label="Thumbnail Size"
            value={thumbnailSize}
            onChange={(e) => onSettingsChange({ thumbnailSize: Number(e.target.value) })}
          >
            <option value={160}>작게</option>
            <option value={240}>보통</option>
            <option value={320}>크게</option>
          </select>
        </label>
      </div>
    </div>
  </header>
);
