import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { detectScheduleHeader, parseScheduleCsv } from "../shared/scheduleParser";

const sampleCsv = `,,,,
프랑스길,날짜,구간 (출발지 → 도착지),거리 (km),알베르게
1,02월 12일,바욘-생장-발카로스,11,Alb. muncipale Valcarios
2,02월 13일,Valcarlos- Roncevalles,16,collegiate 성당부속알베
3,02월 14일,론세스바예스 - Zubirl,21.7,Alb. RioArga ibaia
4,02월 15일,수비리 → Pamplona,21.8,Alb. jesus y Maria
5,02월 16일,연박,,Alb. jesus y Maria
`;

const readProjectCsv = () => {
  return fs.readFileSync(path.join(process.cwd(), "프랑스길-일정-csv.csv"), "utf8");
};

describe("detectScheduleHeader", () => {
  it("detects the actual header after an empty first row", () => {
    const rows = [
      ["", "", "", "", ""],
      ["프랑스길", "날짜", "구간 (출발지 → 도착지)", "거리 (km)", "알베르게"]
    ];

    const header = detectScheduleHeader(rows);

    expect(header?.headerRowIndex).toBe(1);
    expect(header?.mapping).toMatchObject({
      day: 0,
      dateRaw: 1,
      routeText: 2,
      distanceKm: 3,
      accommodation: 4
    });
  });
});

describe("parseScheduleCsv", () => {
  it("parses the schedule CSV shape required by the PRD", () => {
    const result = parseScheduleCsv(sampleCsv, 2026);

    expect(result.headerRowIndex).toBe(1);
    expect(result.routeName).toBe("프랑스길");
    expect(result.issues).toEqual([]);
    expect(result.schedule).toHaveLength(5);
    expect(result.schedule[0]).toMatchObject({
      day: 1,
      dateRaw: "02월 12일",
      date: "2026-02-12",
      routeText: "바욘-생장-발카로스",
      dayType: "walking",
      startPlace: "바욘",
      endPlace: "발카로스",
      viaPlaces: ["생장"],
      distanceKm: 11
    });
    expect(result.schedule[4]).toMatchObject({
      day: 5,
      dayType: "rest",
      startPlace: "Pamplona",
      endPlace: "Pamplona",
      displayTitle: "Pamplona 연박",
      distanceKm: undefined
    });
  });

  it("parses the distributable sample without personal itinerary files", () => {
    const csv = fs.readFileSync(path.join(process.cwd(), "examples/sample-schedule.csv"), "utf8");
    const result = parseScheduleCsv(csv, 2026);
    expect(result.issues).toEqual([]);
    expect(result.schedule).toHaveLength(3);
    expect(result.schedule[1].dayType).toBe("rest");
    expect(result.schedule[0].viaPlaces).toEqual(["경유지"]);
  });

  it.skipIf(!fs.existsSync(path.join(process.cwd(), "프랑스길-일정-csv.csv")))(
    "parses the optional local itinerary into 38 schedule days",
    () => {
      const result = parseScheduleCsv(readProjectCsv(), 2026);
      const restDays = result.schedule.filter((day) => day.dayType === "rest");
      const totalWalkingDistance = result.schedule.reduce(
        (total, day) => total + (day.distanceKm ?? 0),
        0
      );

      expect(result.issues).toEqual([]);
      expect(result.schedule).toHaveLength(38);
      expect(restDays.map((day) => day.day)).toEqual([5, 16, 25]);
      expect(totalWalkingDistance).toBeCloseTo(783.3);
      expect(result.schedule[37]).toMatchObject({
        day: 38,
        startPlace: "라바꼬야",
        viaPlaces: ["산티아고 데 콤포스텔라"],
        endPlace: "묵시아"
      });
    }
  );

  it("returns validation issues for missing headers and invalid rows", () => {
    const missingHeader = parseScheduleCsv("a,b,c\n1,2,3", 2026);
    const invalidRow = parseScheduleCsv(
      "프랑스길,날짜,구간 (출발지 → 도착지),거리 (km),알베르게\nx,wrong,어딘가,abc,",
      2026
    );

    expect(missingHeader.issues[0].code).toBe("missing_header");
    expect(invalidRow.issues.map((issue) => issue.code)).toEqual(["invalid_day"]);
    expect(invalidRow.schedule).toHaveLength(0);
  });
});
