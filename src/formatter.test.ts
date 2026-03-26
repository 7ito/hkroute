import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { DirectionsRoute } from "./directions.js";
import type { RouteLeg, SuccessOutput, ErrorOutput } from "./types.js";
import { formatRoutes } from "./formatter.js";

// ── Helpers ──

function makeBusLeg(overrides: Partial<RouteLeg> = {}): RouteLeg {
  return {
    type: "bus",
    route_number: "6X",
    operator: "Citybus",
    departure_stop: "Star Ferry",
    arrival_stop: "Stanley Market",
    departure_location: { lat: 22.2819, lng: 114.1592 },
    arrival_location: { lat: 22.2180, lng: 114.2112 },
    duration_seconds: 1800,
    num_stops: 12,
    instructions: "Stanley Market",
    eta_source: "schedule",
    actionable: false,
    etas: null,
    ...overrides,
  };
}

function makeWalkLeg(overrides: Partial<RouteLeg> = {}): RouteLeg {
  return {
    type: "walk",
    route_number: null,
    operator: null,
    departure_stop: null,
    arrival_stop: null,
    departure_location: null,
    arrival_location: null,
    duration_seconds: 300,
    num_stops: null,
    instructions: "Walk to bus stop",
    eta_source: "schedule",
    actionable: false,
    etas: null,
    ...overrides,
  };
}

function makeMtrLeg(overrides: Partial<RouteLeg> = {}): RouteLeg {
  return {
    type: "mtr",
    route_number: "Island Line",
    operator: "MTR",
    departure_stop: "Causeway Bay",
    arrival_stop: "Central",
    departure_location: { lat: 22.2801, lng: 114.1840 },
    arrival_location: { lat: 22.2820, lng: 114.1580 },
    duration_seconds: 600,
    num_stops: 4,
    instructions: "Central",
    eta_source: "schedule",
    actionable: false,
    etas: null,
    ...overrides,
  };
}

function makeRoute(legs: RouteLeg[], totalSeconds: number): DirectionsRoute {
  return {
    total_duration_seconds: totalSeconds,
    departure_time: "10:00 AM",
    arrival_time: "10:30 AM",
    legs,
  };
}

// ── Tests: Empty routes → error ──

describe("formatRoutes", () => {
  it("returns NO_TRANSIT_ROUTES error when no routes provided", () => {
    const result = formatRoutes([], "A", "B");
    assert.equal(result.error, true);
    assert.equal((result as ErrorOutput).code, "NO_TRANSIT_ROUTES");
  });

  // ── Tests: Ranking ──

  it("ranks routes by effective_total_min (shortest first)", () => {
    const routes: DirectionsRoute[] = [
      makeRoute([makeBusLeg({ route_number: "6X", duration_seconds: 2400 })], 2400), // 40 min
      makeRoute([makeBusLeg({ route_number: "14", duration_seconds: 1200 })], 1200), // 20 min
      makeRoute([makeBusLeg({ route_number: "260", duration_seconds: 1800 })], 1800), // 30 min
    ];

    const result = formatRoutes(routes, "A", "B") as SuccessOutput;
    assert.equal(result.error, false);
    assert.equal(result.routes.length, 3);
    assert.equal(result.routes[0].rank, 1);
    assert.equal(result.routes[0].effective_total_min, 20);
    assert.equal(result.routes[1].rank, 2);
    assert.equal(result.routes[1].effective_total_min, 30);
    assert.equal(result.routes[2].rank, 3);
    assert.equal(result.routes[2].effective_total_min, 40);
  });

  it("includes real-time wait time in effective_total_min for ranking", () => {
    const now = Date.now();
    // Route A: 20 min travel, 15 min real-time wait → 35 min effective
    const routeA = makeRoute(
      [makeBusLeg({
        route_number: "6X",
        eta_source: "realtime",
        etas: [new Date(now + 15 * 60000).toISOString()],
        duration_seconds: 1200,
      })],
      1200,
    );
    // Route B: 30 min travel, 0 wait (schedule) → 30 min effective
    const routeB = makeRoute(
      [makeBusLeg({ route_number: "14", duration_seconds: 1800 })],
      1800,
    );

    const result = formatRoutes([routeA, routeB], "A", "B") as SuccessOutput;
    // Route B should rank first (30 min < 35 min)
    assert.equal(result.routes[0].effective_total_min, 30);
    assert.equal(result.routes[1].effective_total_min, 35);
  });

  it("caps output at 4 routes", () => {
    const routeNumbers = ["6X", "14", "260", "307", "968", "A11"];
    const routes = Array.from({ length: 6 }, (_, i) =>
      makeRoute([makeBusLeg({ route_number: routeNumbers[i], duration_seconds: (i + 1) * 600 })], (i + 1) * 600),
    );

    const result = formatRoutes(routes, "A", "B") as SuccessOutput;
    assert.equal(result.routes.length, 4);
    // Should keep the 4 shortest
    assert.equal(result.routes[0].effective_total_min, 10);
    assert.equal(result.routes[3].effective_total_min, 40);
  });

  // ── Tests: Recommended flag ──

  it("marks only the first-ranked route as recommended", () => {
    const routes = [
      makeRoute([makeBusLeg({ route_number: "6X", duration_seconds: 1200 })], 1200),
      makeRoute([makeBusLeg({ route_number: "14", duration_seconds: 1800 })], 1800),
    ];

    const result = formatRoutes(routes, "A", "B") as SuccessOutput;
    assert.equal(result.routes[0].recommended, true);
    assert.equal(result.routes[1].recommended, false);
  });

  // ── Tests: Actionable flag ──

  it("marks first bus leg as actionable on each route", () => {
    const route = makeRoute(
      [makeWalkLeg(), makeBusLeg({ route_number: "6X" }), makeBusLeg({ route_number: "14" })],
      2400,
    );

    const result = formatRoutes([route], "A", "B") as SuccessOutput;
    const legs = result.routes[0].legs;
    assert.equal(legs[0].actionable, false); // walk
    assert.equal(legs[1].actionable, true);  // first bus → actionable
    assert.equal(legs[2].actionable, false); // second bus → not actionable
  });

  it("does not mark any leg as actionable when route has no bus legs", () => {
    const route = makeRoute([makeWalkLeg(), makeMtrLeg()], 900);

    const result = formatRoutes([route], "A", "B") as SuccessOutput;
    const legs = result.routes[0].legs;
    assert.ok(legs.every((l) => l.actionable === false));
  });

  // ── Tests: Wait time calculation ──

  it("calculates wait_time_min from real-time ETA", () => {
    const now = Date.now();
    const route = makeRoute(
      [makeBusLeg({
        eta_source: "realtime",
        etas: [new Date(now + 8 * 60000).toISOString()],
        duration_seconds: 1200,
      })],
      1200,
    );

    const result = formatRoutes([route], "A", "B") as SuccessOutput;
    assert.equal(result.routes[0].wait_time_min, 8);
  });

  it("sets wait_time_min to 0 when no real-time ETAs available", () => {
    const route = makeRoute(
      [makeBusLeg({ eta_source: "schedule", etas: null })],
      1800,
    );

    const result = formatRoutes([route], "A", "B") as SuccessOutput;
    assert.equal(result.routes[0].wait_time_min, 0);
  });

  it("sets wait_time_min to 0 when first leg is walk/MTR", () => {
    const route = makeRoute([makeMtrLeg(), makeBusLeg()], 2400);

    const result = formatRoutes([route], "A", "B") as SuccessOutput;
    // First *bus* leg has no realtime ETA, so wait = 0
    assert.equal(result.routes[0].wait_time_min, 0);
  });

  // ── Tests: Output structure ──

  it("includes origin, destination, and queried_at in success output", () => {
    const route = makeRoute([makeBusLeg()], 1800);
    const result = formatRoutes([route], "Tin Hau", "Stanley") as SuccessOutput;

    assert.equal(result.origin, "Tin Hau");
    assert.equal(result.destination, "Stanley");
    assert.ok(result.queried_at); // ISO string
    assert.ok(new Date(result.queried_at).getTime() > 0);
  });

  // ── Tests: Deduplication ──

  it("deduplicates routes with identical leg structure", () => {
    // Two routes with same legs but different departure times (Google schedule variants)
    const legs = [makeWalkLeg(), makeBusLeg({ route_number: "58" }), makeMtrLeg()];
    const routeA = makeRoute(legs, 2400);
    const routeB: DirectionsRoute = { ...makeRoute(legs, 2400), departure_time: "11:00 AM", arrival_time: "11:40 AM" };

    const result = formatRoutes([routeA, routeB], "A", "B") as SuccessOutput;
    assert.equal(result.routes.length, 1); // collapsed to one
  });

  it("keeps distinct routes that share some legs but differ in others", () => {
    const routeA = makeRoute(
      [makeBusLeg({ route_number: "6X" }), makeMtrLeg({ route_number: "Island Line" })],
      2400,
    );
    const routeB = makeRoute(
      [makeBusLeg({ route_number: "260" }), makeMtrLeg({ route_number: "Island Line" })],
      2400,
    );

    const result = formatRoutes([routeA, routeB], "A", "B") as SuccessOutput;
    assert.equal(result.routes.length, 2); // different bus routes → kept
  });

  it("keeps the best-ranked variant when deduplicating", () => {
    const now = Date.now();
    const legs = [makeBusLeg({ route_number: "58", eta_source: "schedule", etas: null })];
    // Route A: 30 min travel, 0 wait → 30 min effective
    const routeA = makeRoute(legs, 1800);
    // Route B: same legs, 35 min travel → 35 min effective
    const routeB = makeRoute(legs, 2100);

    const result = formatRoutes([routeB, routeA], "A", "B") as SuccessOutput;
    assert.equal(result.routes.length, 1);
    assert.equal(result.routes[0].effective_total_min, 30); // kept the faster one
  });

  it("preserves departure_time and arrival_time from directions", () => {
    const route: DirectionsRoute = {
      total_duration_seconds: 1800,
      departure_time: "2:15 PM",
      arrival_time: "2:45 PM",
      legs: [makeBusLeg()],
    };

    const result = formatRoutes([route], "A", "B") as SuccessOutput;
    assert.equal(result.routes[0].departure_time, "2:15 PM");
    assert.equal(result.routes[0].arrival_time, "2:45 PM");
  });
});
