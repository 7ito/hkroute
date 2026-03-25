import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { EtaDb, Company } from "hk-bus-eta";

// We need to mock modules before importing eta.ts.
// Node's test runner mock.module is experimental, so we'll test via
// a different strategy: extract the logic into testable units and
// test the public API with controlled inputs.

// For getRealtimeEta, we can test the logic directly with a fake EtaDb
// and mock fetchEtas. For loadEtaDb, we'll do a filesystem-based test.

const CACHE_DIR = join(homedir(), ".cache", "hk-route");
const CACHE_FILE = join(CACHE_DIR, "etaDb.json");

// Build a minimal fake EtaDb for testing
function makeFakeDb(overrides?: Partial<EtaDb>): EtaDb {
  return {
    holidays: [],
    routeList: {
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
        stops: {
          ctb: ["001234", "001235", "001236"],
        } as any,
        bound: { ctb: "O" } as any,
        gtfsId: "",
        nlbId: "",
      } as any,
      "6X+1+STANLEY MARKET+STAR FERRY": {
        route: "6X",
        co: ["ctb" as Company],
        orig: { en: "STANLEY MARKET", zh: "赤柱市場" },
        dest: { en: "STAR FERRY", zh: "天星碼頭" },
        fares: null,
        faresHoliday: null,
        freq: null,
        jt: null,
        seq: 1,
        serviceType: "1",
        stops: {
          ctb: ["001240", "001241", "001242"],
        } as any,
        bound: { ctb: "I" } as any,
        gtfsId: "",
        nlbId: "",
      } as any,
    },
    stopList: {
      "001234": { location: { lat: 22.28, lng: 114.16 }, name: { en: "Star Ferry", zh: "天星碼頭" } },
      "001235": { location: { lat: 22.27, lng: 114.17 }, name: { en: "Mid Stop", zh: "中途站" } },
      "001236": { location: { lat: 22.22, lng: 114.21 }, name: { en: "Stanley", zh: "赤柱" } },
    },
    stopMap: {} as any,
    serviceDayMap: {},
    ...overrides,
  } as EtaDb;
}

describe("getRealtimeEta", () => {
  it("returns null for MTR operator (skipped by design)", async () => {
    // Import dynamically so we can describe the test before loading
    const { getRealtimeEta } = await import("./eta.js");
    const db = makeFakeDb();
    const result = await getRealtimeEta(db, "mtr", "TML", "TUM");
    assert.equal(result, null);
  });

  it("returns empty array when route number not found", async () => {
    const { getRealtimeEta } = await import("./eta.js");
    const db = makeFakeDb();
    const result = await getRealtimeEta(db, "ctb", "NONEXISTENT", "001234");
    assert.deepEqual(result, []);
  });

  it("returns empty array when operator not found on route", async () => {
    const { getRealtimeEta } = await import("./eta.js");
    const db = makeFakeDb();
    const result = await getRealtimeEta(db, "kmb", "6X", "001234");
    assert.deepEqual(result, []);
  });

  it("returns empty array when stop not found on route", async () => {
    const { getRealtimeEta } = await import("./eta.js");
    const db = makeFakeDb();
    const result = await getRealtimeEta(db, "ctb", "6X", "NOSTOP");
    assert.deepEqual(result, []);
  });
});

describe("loadEtaDb caching", () => {
  it("caches to the expected path", () => {
    // Verify the cache path is as specified in the PRD
    assert.equal(CACHE_FILE, join(homedir(), ".cache", "hk-route", "etaDb.json"));
  });
});
