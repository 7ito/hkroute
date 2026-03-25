import type { DirectionsRoute } from "./directions.js";
import type { Route, SuccessOutput, ErrorOutput, Output } from "./types.js";

const MAX_ROUTES = 4;

function markActionableLegs(route: Route): Route {
  let foundFirstBus = false;
  return {
    ...route,
    legs: route.legs.map((leg) => {
      if (!foundFirstBus && leg.type === "bus") {
        foundFirstBus = true;
        return { ...leg, actionable: true };
      }
      return leg;
    }),
  };
}

export function formatRoutes(
  directionsRoutes: DirectionsRoute[],
  origin: string,
  destination: string,
): Output {
  if (directionsRoutes.length === 0) {
    return {
      error: true,
      code: "NO_TRANSIT_ROUTES",
      message:
        "No transit routes found. This may be due to the time of day or the locations provided. Consider trying a different departure time or checking if taxi is an option.",
    } satisfies ErrorOutput;
  }

  // Build Route objects and rank by total duration
  const routes: Route[] = directionsRoutes
    .map((dr) => ({
      rank: 0,
      recommended: false,
      total_duration_seconds: dr.total_duration_seconds,
      // Without real-time ETAs, effective = total (Google's schedule-based estimate)
      effective_duration_seconds: dr.total_duration_seconds,
      departure_time: dr.departure_time,
      arrival_time: dr.arrival_time,
      legs: dr.legs,
    }))
    .sort((a, b) => a.effective_duration_seconds - b.effective_duration_seconds)
    .slice(0, MAX_ROUTES)
    .map((route, i) => markActionableLegs({ ...route, rank: i + 1, recommended: i === 0 }));

  return {
    error: false,
    origin,
    destination,
    queried_at: new Date().toISOString(),
    routes,
  } satisfies SuccessOutput;
}
