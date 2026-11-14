import { describe, expect, it } from "vitest";
import { buildRestDayRoute, parseRouteText } from "../shared/routeParser";

describe("parseRouteText", () => {
  it("parses arrow-separated walking routes", () => {
    expect(parseRouteText("수비리 → Pamplona")).toMatchObject({
      dayType: "walking",
      startPlace: "수비리",
      endPlace: "Pamplona",
      viaPlaces: [],
      displayTitle: "수비리 → Pamplona"
    });
  });

  it("parses hyphen-separated walking routes with via places", () => {
    expect(parseRouteText("바욘-생장-발카로스")).toMatchObject({
      dayType: "walking",
      startPlace: "바욘",
      endPlace: "발카로스",
      viaPlaces: ["생장"]
    });
  });

  it("parses multi-arrow walking routes with via places", () => {
    expect(parseRouteText("라바꼬야 → 산티아고 데 콤포스텔라→묵시아")).toMatchObject({
      dayType: "walking",
      startPlace: "라바꼬야",
      endPlace: "묵시아",
      viaPlaces: ["산티아고 데 콤포스텔라"]
    });
  });

  it("marks unparseable routes as unknown", () => {
    expect(parseRouteText("어딘가")).toMatchObject({
      dayType: "unknown",
      needsManualReview: true
    });
  });
});

describe("buildRestDayRoute", () => {
  it("uses the previous walking end place for rest days", () => {
    expect(buildRestDayRoute("연박", "Pamplona")).toMatchObject({
      dayType: "rest",
      startPlace: "Pamplona",
      endPlace: "Pamplona",
      displayTitle: "Pamplona 연박"
    });
  });

  it("uses Rest-Day when no previous end place exists", () => {
    expect(buildRestDayRoute("연박")).toMatchObject({
      dayType: "rest",
      startPlace: "Rest-Day",
      endPlace: "Rest-Day",
      displayTitle: "Rest-Day 연박"
    });
  });
});
