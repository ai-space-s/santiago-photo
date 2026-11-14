import type { ExportPlanItem, ManifestRow, PhotoItem, ScheduleDay } from "./types.js";

const MANIFEST_COLUMNS: (keyof ManifestRow)[] = [
  "original_path",
  "new_path",
  "day",
  "date",
  "date_raw",
  "day_type",
  "route_text",
  "start_place",
  "end_place",
  "via_places",
  "distance_km",
  "accommodation",
  "sequence",
  "selected",
  "match_source",
  "effective_datetime",
  "date_time_original",
  "create_date",
  "file_modify_date",
  "status"
];

const escapeCsvValue = (value: string | number | boolean) => {
  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

export const buildManifestRow = (
  item: ExportPlanItem,
  photo: PhotoItem,
  scheduleDay: ScheduleDay
): ManifestRow => ({
  original_path: item.originalPath,
  new_path: item.outputPath,
  day: scheduleDay.day,
  date: scheduleDay.date,
  date_raw: scheduleDay.dateRaw,
  day_type: scheduleDay.dayType,
  route_text: scheduleDay.routeText,
  start_place: scheduleDay.startPlace ?? "",
  end_place: scheduleDay.endPlace ?? "",
  via_places: scheduleDay.viaPlaces.join("|"),
  distance_km: scheduleDay.distanceKm === undefined ? "" : String(scheduleDay.distanceKm),
  accommodation: scheduleDay.accommodation ?? "",
  sequence: item.sequence,
  selected: photo.selected,
  match_source: photo.matchSource,
  effective_datetime: photo.effectiveDateTime ?? "",
  date_time_original: photo.dateTimeOriginal ?? "",
  create_date: photo.createDate ?? "",
  file_modify_date: photo.fileModifyDate ?? "",
  status: item.status
});

export const writeManifestCsv = (rows: ManifestRow[]) => {
  const header = MANIFEST_COLUMNS.join(",");
  const body = rows.map((row) =>
    MANIFEST_COLUMNS.map((column) => escapeCsvValue(row[column])).join(",")
  );

  return [header, ...body].join("\n") + "\n";
};
