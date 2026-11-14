import type { DayType } from "./types.js";

export type ParsedRoute = {
  routeText: string;
  dayType: DayType;
  startPlace?: string;
  endPlace?: string;
  viaPlaces: string[];
  displayTitle: string;
  needsManualReview: boolean;
};

const REST_DAY_TEXT = "연박";

const cleanToken = (value: string) => value.trim().replace(/\s+/g, " ");

const buildWalkingTitle = (startPlace?: string, endPlace?: string, routeText?: string) => {
  if (startPlace && endPlace) {
    return `${startPlace} → ${endPlace}`;
  }

  return routeText?.trim() || "Unknown route";
};

export const parseRouteText = (routeText: string): ParsedRoute => {
  const normalizedRouteText = routeText.trim();

  if (normalizedRouteText === REST_DAY_TEXT) {
    return {
      routeText: normalizedRouteText,
      dayType: "rest",
      viaPlaces: [],
      displayTitle: REST_DAY_TEXT,
      needsManualReview: false
    };
  }

  const separator = normalizedRouteText.includes("→")
    ? "→"
    : normalizedRouteText.includes("-")
      ? "-"
      : undefined;

  if (!separator) {
    return {
      routeText: normalizedRouteText,
      dayType: "unknown",
      viaPlaces: [],
      displayTitle: normalizedRouteText || "Unknown route",
      needsManualReview: true
    };
  }

  const tokens = normalizedRouteText.split(separator).map(cleanToken).filter(Boolean);

  if (tokens.length < 2) {
    return {
      routeText: normalizedRouteText,
      dayType: "unknown",
      viaPlaces: [],
      displayTitle: normalizedRouteText || "Unknown route",
      needsManualReview: true
    };
  }

  const startPlace = tokens[0];
  const endPlace = tokens[tokens.length - 1];
  const viaPlaces = tokens.slice(1, -1);

  return {
    routeText: normalizedRouteText,
    dayType: "walking",
    startPlace,
    endPlace,
    viaPlaces,
    displayTitle: buildWalkingTitle(startPlace, endPlace, normalizedRouteText),
    needsManualReview: false
  };
};

export const buildRestDayRoute = (routeText: string, previousEndPlace?: string): ParsedRoute => {
  const place = previousEndPlace || "Rest-Day";

  return {
    routeText: routeText.trim(),
    dayType: "rest",
    startPlace: place,
    endPlace: place,
    viaPlaces: [],
    displayTitle: `${place} 연박`,
    needsManualReview: false
  };
};
