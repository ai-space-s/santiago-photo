export type DayType = "walking" | "rest" | "unknown";

export type PhotoCategory = "landscape" | "people" | "food" | "lodging" | "trail" | "other";
export type SlideshowSettings = {
  source: "all" | "selected";
  dayNumbers: number[] | null;
  categories: (PhotoCategory | "uncategorized")[];
  order: "chronological" | "manual" | "shuffle";
  photoSeconds: number;
  coverSeconds: number;
  showCovers: boolean;
  showCaptions: boolean;
  loop: boolean;
};

export type MatchSource =
  "manual" | "DateTimeOriginal" | "CreateDate" | "FileModifyDate" | "unmatched";

export type ReviewReason = "missing_exif" | "unmatched" | "missing_file" | "damaged_file";

export type ExportStatus = "pending" | "copied" | "failed" | "skipped" | "missing" | "collision";

export type ScheduleDay = {
  day: number;
  dateRaw: string;
  date: string;
  routeText: string;
  dayType: DayType;
  startPlace?: string;
  endPlace?: string;
  viaPlaces: string[];
  displayTitle: string;
  distanceKm?: number;
  accommodation?: string;
  memo?: string;
};

export type CsvValidationIssue = {
  rowNumber: number;
  columnName?: string;
  code:
    | "missing_header"
    | "invalid_day"
    | "invalid_date"
    | "invalid_distance"
    | "invalid_route"
    | "empty_row";
  message: string;
  value?: string;
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
  manualOrder?: number;
  category?: PhotoCategory;
  matchSource: MatchSource;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  missing?: boolean;
  needsUserReview?: boolean;
  reviewReason?: ReviewReason;
  error?: string;
};

export type FileScanIssue = {
  path: string;
  fileName: string;
  extension: string;
  reason: "unsupported_file_type" | "read_error" | "stat_error";
  message: string;
};

export type PhotoScanResult = {
  photos: PhotoItem[];
  unsupportedFiles: FileScanIssue[];
  errors: FileScanIssue[];
  totalFilesVisited: number;
};

export type ProjectSummary = {
  totalPhotosScanned: number;
  totalPhotosAssignedAutomatically: number;
  totalPhotosAssignedManually: number;
  totalUnmatchedPhotos: number;
  totalSelectedPhotos: number;
  totalDays: number;
  totalMissingExifPhotos: number;
  totalMissingFiles: number;
  totalUnsupportedFiles: number;
  firstStartPlace?: string;
  lastEndPlace?: string;
};

export type Project = {
  schemaVersion: string;
  projectName: string;
  routeName: string;
  projectYear: number;
  projectFilePath?: string;
  createdAt: string;
  updatedAt: string;
  sourcePhotoDir: string;
  outputDir: string;
  filenamePattern: string;
  timezoneOffsetHours: number;
  dayBoundaryTime: string;
  thumbnailCacheDir: string;
  slideshowSettings?: SlideshowSettings;
  thumbnailSize?: number;
  schedule: ScheduleDay[];
  photos: PhotoItem[];
  summary: ProjectSummary;
};

export type ExportPlanItem = {
  photoId: string;
  originalPath: string;
  outputPath: string;
  originalFileName: string;
  newFileName: string;
  folderName: string;
  day: number;
  date: string;
  routeText: string;
  accommodation?: string;
  sequence: number;
  willOverwrite: boolean;
  hasCollision: boolean;
  status: ExportStatus;
  error?: string;
};

export type ExportValidationIssue = {
  code:
    | "no_selected_photos"
    | "selected_photo_unmatched"
    | "selected_photo_missing"
    | "schedule_day_missing"
    | "output_dir_missing"
    | "output_not_writable"
    | "unsafe_output_path"
    | "filename_collision";
  message: string;
  photoId?: string;
  path?: string;
};

export type ExportPreviewResult = {
  items: ExportPlanItem[];
  issues: ExportValidationIssue[];
  canExport: boolean;
};

export type ManifestRow = {
  original_path: string;
  new_path: string;
  day: number;
  date: string;
  date_raw: string;
  day_type: DayType;
  route_text: string;
  start_place: string;
  end_place: string;
  via_places: string;
  distance_km: string;
  accommodation: string;
  sequence: number;
  selected: boolean;
  match_source: MatchSource;
  effective_datetime: string;
  date_time_original: string;
  create_date: string;
  file_modify_date: string;
  status: ExportStatus;
};
