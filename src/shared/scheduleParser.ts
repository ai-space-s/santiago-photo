import Papa from "papaparse";
import { parseScheduleDate } from "./dateParser.js";
import { buildRestDayRoute, parseRouteText } from "./routeParser.js";
import type { CsvValidationIssue, ScheduleDay } from "./types.js";

type HeaderMapping = {
  day: number;
  dateRaw: number;
  routeText: number;
  distanceKm: number;
  accommodation: number;
};

export type ScheduleParseResult = {
  schedule: ScheduleDay[];
  issues: CsvValidationIssue[];
  headerRowIndex: number;
  routeName: string;
};

const REQUIRED_HEADER_ERROR: CsvValidationIssue = {
  rowNumber: 0,
  code: "missing_header",
  message: "Could not find a schedule header row with 날짜, 구간, 거리, and 알베르게 columns."
};

const trimBom = (value: string) => value.replace(/^\uFEFF/, "");

const normalizeCell = (value: unknown) => trimBom(String(value ?? "")).trim();

const normalizeRow = (row: unknown[]): string[] => row.map(normalizeCell);

const isEmptyRow = (row: string[]) => row.every((cell) => cell.length === 0);

const findColumn = (row: string[], matcher: (cell: string) => boolean) =>
  row.findIndex((cell) => matcher(cell));

export const detectScheduleHeader = (rows: string[][]) => {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const dateRaw = findColumn(row, (cell) => cell === "날짜");
    const routeText = findColumn(row, (cell) => cell.includes("구간"));
    const distanceKm = findColumn(row, (cell) => cell.includes("거리"));
    const accommodation = findColumn(row, (cell) => cell === "알베르게");

    if (dateRaw >= 0 && routeText >= 0 && distanceKm >= 0 && accommodation >= 0) {
      const day = findColumn(row, (cell) => cell === "프랑스길");

      return {
        headerRowIndex: rowIndex,
        mapping: {
          day: day >= 0 ? day : 0,
          dateRaw,
          routeText,
          distanceKm,
          accommodation
        } satisfies HeaderMapping,
        routeName: day >= 0 ? row[day] : "프랑스길"
      };
    }
  }

  return undefined;
};

const parseDistance = (value: string, rowNumber: number, issues: CsvValidationIssue[]) => {
  if (!value) {
    return undefined;
  }

  const distance = Number(value);

  if (Number.isNaN(distance)) {
    issues.push({
      rowNumber,
      columnName: "거리 (km)",
      code: "invalid_distance",
      message: "Distance must be a number.",
      value
    });
    return undefined;
  }

  return distance;
};

export const parseScheduleCsv = (csvText: string, projectYear: number): ScheduleParseResult => {
  const parsed = Papa.parse<unknown[]>(csvText, {
    skipEmptyLines: false
  });
  const rows = parsed.data.map(normalizeRow);
  const header = detectScheduleHeader(rows);

  if (!header) {
    return {
      schedule: [],
      issues: [REQUIRED_HEADER_ERROR],
      headerRowIndex: -1,
      routeName: "프랑스길"
    };
  }

  const issues: CsvValidationIssue[] = [];
  const schedule: ScheduleDay[] = [];
  let previousWalkingEndPlace: string | undefined;

  for (let rowIndex = header.headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rowNumber = rowIndex + 1;

    if (isEmptyRow(row)) {
      continue;
    }

    const dayRaw = row[header.mapping.day] ?? "";
    const dateRaw = row[header.mapping.dateRaw] ?? "";
    const routeText = row[header.mapping.routeText] ?? "";
    const distanceRaw = row[header.mapping.distanceKm] ?? "";
    const accommodation = row[header.mapping.accommodation] || undefined;
    const day = Number(dayRaw);

    if (!Number.isInteger(day) || day <= 0) {
      issues.push({
        rowNumber,
        columnName: "프랑스길",
        code: "invalid_day",
        message: "Day must be a positive integer.",
        value: dayRaw
      });
      continue;
    }

    let date: string;
    try {
      date = parseScheduleDate(dateRaw, projectYear).date;
    } catch {
      issues.push({
        rowNumber,
        columnName: "날짜",
        code: "invalid_date",
        message: "Date must match the format '02월 12일'.",
        value: dateRaw
      });
      date = "";
    }

    const baseRoute = parseRouteText(routeText);
    const route = baseRoute.dayType === "rest" ? buildRestDayRoute(routeText, previousWalkingEndPlace) : baseRoute;

    if (route.dayType === "unknown") {
      issues.push({
        rowNumber,
        columnName: "구간 (출발지 → 도착지)",
        code: "invalid_route",
        message: "Route could not be parsed and needs manual review.",
        value: routeText
      });
    }

    const scheduleDay: ScheduleDay = {
      day,
      dateRaw,
      date,
      routeText,
      dayType: route.dayType,
      startPlace: route.startPlace,
      endPlace: route.endPlace,
      viaPlaces: route.viaPlaces,
      displayTitle: route.displayTitle,
      distanceKm: parseDistance(distanceRaw, rowNumber, issues),
      accommodation
    };

    schedule.push(scheduleDay);

    if (scheduleDay.dayType === "walking" && scheduleDay.endPlace) {
      previousWalkingEndPlace = scheduleDay.endPlace;
    }
  }

  return {
    schedule,
    issues,
    headerRowIndex: header.headerRowIndex,
    routeName: header.routeName
  };
};
