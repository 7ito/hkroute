import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EtaDb, Company } from "hk-bus-eta";
import { matchStop, mapAgency } from "./matcher.js";

// ── Fixture: snapshot subset of hk-bus-eta DB with real HK routes ──

function makeFixtureDb(): EtaDb {
  return {
    holidays: [],
    routeList: {
      // CTB 6X: Star Ferry → Stanley (outbound)
      "6X+1+STAR FERRY+STANLEY MARKET": {
        route: "6X",
        co: ["ctb" as Company],
        orig: { en: "STAR FERRY", zh: "天星碼頭" },
        dest: { en: "STANLEY MARKET", zh: "赤柱市場" },
        fares: null,
        faresHoliday: null,
        freq: null,
        jt: null,
        seq: 1,
        serviceType: "1",
        stops: { ctb: ["15212", "15213", "15214"] } as any,
        bound: { ctb: "O" } as any,
        gtfsId: "",
        nlbId: "",
      } as any,
      // CTB 6X: Stanley → Star Ferry (inbound, different stops)
      "6X+2+STANLEY MARKET+STAR FERRY": {
        route: "6X",
        co: ["ctb" as Company],
        orig: { en: "STANLEY MARKET", zh: "赤柱市場" },
        dest: { en: "STAR FERRY", zh: "天星碼頭" },
        fares: null,
        faresHoliday: null,
        freq: null,
        jt: null,
        seq: 2,
        serviceType: "1",
        stops: { ctb: ["15300", "15301", "15302"] } as any,
        bound: { ctb: "I" } as any,
        gtfsId: "",
        nlbId: "",
      } as any,
      // KMB 65: Tin Hau area route
      "65+1+YUEN LONG (EAST)+TIN SHUI WAI": {
        route: "65",
        co: ["kmb" as Company],
        orig: { en: "YUEN LONG (EAST)", zh: "元朗(東)" },
        dest: { en: "TIN SHUI WAI", zh: "天水圍" },
        fares: null,
        faresHoliday: null,
        freq: null,
        jt: null,
        seq: 1,
        serviceType: "1",
        stops: { kmb: ["YL-0001", "YL-0002", "YL-0003"] } as any,
        bound: { kmb: "O" } as any,
        gtfsId: "",
        nlbId: "",
      } as any,
      // Joint-operation route: KMB + CTB route 307
      "307+1+TAI PO+CENTRAL": {
        route: "307",
        co: ["kmb" as Company, "ctb" as Company],
        orig: { en: "TAI PO", zh: "大埔" },
        dest: { en: "CENTRAL", zh: "中環" },
        fares: null,
        faresHoliday: null,
        freq: null,
        jt: null,
        seq: 1,
        serviceType: "1",
        stops: {
          kmb: ["TP-001", "TP-002"],
          ctb: ["TP-101", "TP-102"],
        } as any,
        bound: { kmb: "O", ctb: "O" } as any,
        gtfsId: "",
        nlbId: "",
      } as any,
      // NLB route 11: Tung Chung → Tai O
      "11+1+TUNG CHUNG+TAI O": {
        route: "11",
        co: ["nlb" as Company],
        orig: { en: "TUNG CHUNG", zh: "東涌" },
        dest: { en: "TAI O", zh: "大澳" },
        fares: null,
        faresHoliday: null,
        freq: null,
        jt: null,
        seq: 1,
        serviceType: "1",
        stops: { nlb: ["NLB-001", "NLB-002"] } as any,
        bound: { nlb: "O" } as any,
        gtfsId: "",
        nlbId: "",
      } as any,
    },
    stopList: {
      // CTB 6X outbound stops
      "15212": { location: { lat: 22.2819, lng: 114.1592 }, name: { en: "Star Ferry", zh: "天星碼頭" } },
      "15213": { location: { lat: 22.2650, lng: 114.1810 }, name: { en: "Happy Valley", zh: "跑馬地" } },
      "15214": { location: { lat: 22.2180, lng: 114.2112 }, name: { en: "Stanley Market", zh: "赤柱市場" } },
      // CTB 6X inbound stops
      "15300": { location: { lat: 22.2182, lng: 114.2115 }, name: { en: "Stanley Market", zh: "赤柱市場" } },
      "15301": { location: { lat: 22.2655, lng: 114.1815 }, name: { en: "Happy Valley", zh: "跑馬地" } },
      "15302": { location: { lat: 22.2822, lng: 114.1595 }, name: { en: "Star Ferry", zh: "天星碼頭" } },
      // KMB 65 stops
      "YL-0001": { location: { lat: 22.4445, lng: 114.0223 }, name: { en: "Yuen Long East", zh: "元朗東" } },
      "YL-0002": { location: { lat: 22.4500, lng: 114.0100 }, name: { en: "Fung Kam Street", zh: "鳳琴街" } },
      "YL-0003": { location: { lat: 22.4620, lng: 113.9980 }, name: { en: "Tin Shui Wai", zh: "天水圍" } },
      // Joint 307 stops (KMB variant)
      "TP-001": { location: { lat: 22.4510, lng: 114.1650 }, name: { en: "Tai Po Centre", zh: "大埔中心" } },
      "TP-002": { location: { lat: 22.2820, lng: 114.1580 }, name: { en: "Central", zh: "中環" } },
      // Joint 307 stops (CTB variant — slightly different stop positions)
      "TP-101": { location: { lat: 22.4515, lng: 114.1655 }, name: { en: "Tai Po Centre", zh: "大埔中心" } },
      "TP-102": { location: { lat: 22.2825, lng: 114.1585 }, name: { en: "Central", zh: "中環" } },
      // NLB 11 stops
      "NLB-001": { location: { lat: 22.2890, lng: 113.9410 }, name: { en: "Tung Chung", zh: "東涌" } },
      "NLB-002": { location: { lat: 22.2530, lng: 113.8640 }, name: { en: "Tai O", zh: "大澳" } },
    },
    stopMap: {} as any,
    serviceDayMap: {},
  } as EtaDb;
}

// ── Tests: Agency mapping ──

describe("mapAgency", () => {
  it("maps known Google agency names to hk-bus-eta company codes", () => {
    assert.equal(mapAgency("KMB"), "kmb");
    assert.equal(mapAgency("Kowloon Motor Bus"), "kmb");
    assert.equal(mapAgency("Citybus"), "ctb");
    assert.equal(mapAgency("New Lantao Bus"), "nlb");
    assert.equal(mapAgency("MTR"), "mtr");
    assert.equal(mapAgency("Sun Ferry"), "sunferry");
    assert.equal(mapAgency("HKKF"), "hkkf");
    assert.equal(mapAgency("Fortune Ferry"), "fortuneferry");
    assert.equal(mapAgency("Light Rail"), "lightRail");
    assert.equal(mapAgency("GMB"), "gmb");
    assert.equal(mapAgency("LRT Feeder Bus"), "lrtfeeder");
  });

  it("handles case-insensitive matching", () => {
    assert.equal(mapAgency("kmb"), "kmb");
    assert.equal(mapAgency("citybus"), "ctb");
    assert.equal(mapAgency("CITYBUS"), "ctb");
  });

  it("returns null for unknown agencies", () => {
    assert.equal(mapAgency("Hong Kong Tram"), null);
    assert.equal(mapAgency("Unknown Operator"), null);
    assert.equal(mapAgency(""), null);
  });
});

// ── Tests: Stop matching ──

describe("matchStop", () => {
  it("matches a known route + coordinates to the correct stop", () => {
    const db = makeFixtureDb();
    // Coords very close to Star Ferry stop (15212)
    const result = matchStop(db, "6X", "Citybus", 22.2820, 114.1593);
    assert.notEqual(result, null);
    assert.equal(result!.stopId, "15212");
    assert.equal(result!.stopName, "Star Ferry");
    assert.ok(result!.distance < 50, `Expected distance < 50m, got ${result!.distance}m`);
  });

  it("matches the closest stop when multiple stops on the route", () => {
    const db = makeFixtureDb();
    // Coords close to Happy Valley stop (15213)
    const result = matchStop(db, "6X", "Citybus", 22.2651, 114.1811);
    assert.notEqual(result, null);
    assert.equal(result!.stopId, "15213");
    assert.equal(result!.stopName, "Happy Valley");
  });

  it("collects stops from both inbound and outbound variants", () => {
    const db = makeFixtureDb();
    // Coords near the inbound Star Ferry stop (15302), not outbound (15212)
    // 15302 is at 22.2822, 114.1595 — slightly different from 15212 at 22.2819, 114.1592
    const result = matchStop(db, "6X", "Citybus", 22.2822, 114.1595);
    assert.notEqual(result, null);
    // Should match one of the Star Ferry stops (either 15212 or 15302)
    assert.ok(
      result!.stopName === "Star Ferry",
      `Expected Star Ferry, got ${result!.stopName}`,
    );
  });

  it("handles joint-operation routes — matches KMB variant stops", () => {
    const db = makeFixtureDb();
    // Coords near KMB Tai Po Centre stop (TP-001)
    const result = matchStop(db, "307", "KMB", 22.4511, 114.1651);
    assert.notEqual(result, null);
    assert.equal(result!.stopId, "TP-001");
    assert.equal(result!.stopName, "Tai Po Centre");
  });

  it("handles joint-operation routes — matches CTB variant stops", () => {
    const db = makeFixtureDb();
    // Coords near CTB Tai Po Centre stop (TP-101)
    const result = matchStop(db, "307", "Citybus", 22.4516, 114.1656);
    assert.notEqual(result, null);
    assert.equal(result!.stopId, "TP-101");
    assert.equal(result!.stopName, "Tai Po Centre");
  });

  it("returns null when coordinates are far from any stop on the route", () => {
    const db = makeFixtureDb();
    // Coords in Kowloon — far from any 6X stop
    const result = matchStop(db, "6X", "Citybus", 22.3200, 114.1700);
    assert.equal(result, null);
  });

  it("returns null for unknown operator", () => {
    const db = makeFixtureDb();
    const result = matchStop(db, "6X", "Hong Kong Tram", 22.2819, 114.1592);
    assert.equal(result, null);
  });

  it("returns null when route number doesn't exist", () => {
    const db = makeFixtureDb();
    const result = matchStop(db, "999X", "Citybus", 22.2819, 114.1592);
    assert.equal(result, null);
  });

  it("returns null when route exists but operator doesn't serve it", () => {
    const db = makeFixtureDb();
    // Route 65 is KMB only, not CTB
    const result = matchStop(db, "65", "Citybus", 22.4445, 114.0223);
    assert.equal(result, null);
  });

  it("matches NLB route correctly", () => {
    const db = makeFixtureDb();
    const result = matchStop(db, "11", "New Lantao Bus", 22.2891, 113.9411);
    assert.notEqual(result, null);
    assert.equal(result!.stopId, "NLB-001");
    assert.equal(result!.stopName, "Tung Chung");
  });
});
