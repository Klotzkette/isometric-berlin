import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import {
  createAltMitteV169NavigationIndex,
  type AltMitteV169Navigation,
} from "../src/altMitteV169NavigationIndex";

test("drawn preparation never reads native data and native queries never prepare drawn roofs", () => {
  let legacyReads = 0,
    nativeReads = 0,
    drawnReads = 0;
  const data: AltMitteV169Navigation = {
    parts: [],
    get legacyPrisms() {
      legacyReads++;
      return [];
    },
    get roofTriangles() {
      drawnReads++;
      return [
        [
          [0, 3, 0],
          [8, 5, 0],
          [0, 3, 8],
        ],
      ];
    },
    get nativeRoofCells() {
      nativeReads++;
      return [[0, 0, 6]];
    },
    get nativeRoofSpans() {
      nativeReads++;
      return [[-2, -2, 2, 2, 5]];
    },
  };
  const drawn = createAltMitteV169NavigationIndex(data, { lazy: true });
  expect([legacyReads, nativeReads, drawnReads]).toEqual([0, 0, 0]);
  drawn.prepareDrawnRoofs();
  expect(drawn.roofAt(2, 2)).toBe(3.5);
  expect([legacyReads, nativeReads, drawnReads]).toEqual([0, 0, 1]);
  // No rebuilding while travelling; the prebuilt representation is reused.
  drawn.prepareDrawnRoofs();
  expect([legacyReads, nativeReads, drawnReads]).toEqual([0, 0, 1]);
  const native = createAltMitteV169NavigationIndex(data, { lazy: true });
  native.prepareNative();
  expect(native.roofAt(0, 0, true)).toBe(6);
  expect(native.roofAt(-1.5, -1.5, true)).toBe(5);
  expect(native.roofAt(2, 2, true)).toBeNull();
  expect(drawnReads).toBe(1);
  const prepared = [legacyReads, nativeReads];
  native.prepareNative();
  expect([legacyReads, nativeReads]).toEqual(prepared);
});

test("Day module evaluation and preparation cannot import native navigation packets", () => {
  const profile = fileURLToPath(
    new URL("../src/altMitteV169Profile.ts", import.meta.url),
  );
  const script = `
    import { plugin } from "bun";
    plugin({name:"reject-day-native-navigation",setup(build){
      build.onLoad({filter:/altMitteV169NativeNavigationData|altMitteV169Navigation.packet-00[067]\\.json$/},()=>{
        throw new Error("Day loaded native-only navigation data");
      });
    }});
    const profile=await import(${JSON.stringify(profile)});
    profile.prepareAltMitteV169Navigation();
    profile.altMitteV169RoofAt(0,0);
    let guarded=false;
    try{profile.altMitteV169SourceColumn(0,0,0,4);}catch(error){guarded=error.message.includes("Preload");}
    if(!guarded)throw new Error("Native source use was not guarded");
    console.log("drawn-only navigation prepared");
  `;
  const result = Bun.spawnSync([process.execPath, "--eval", script]);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("drawn-only navigation prepared");
});

test("all source roof and column queries match the published v1.0.71 fingerprint", async () => {
  const { default: source } =
    await import("../src/data/altMitteV169NavigationData");
  const index = createAltMitteV169NavigationIndex(source, { lazy: true });
  const results: (number | boolean | null)[] = [];
  // Published eager-index reference: sample throughout every packet, at roof
  // vertices/centroids and native negative/exclusive cell boundaries.
  for (let i = 0; i < source.roofTriangles.length; i += 11) {
    const t = source.roofTriangles[i];
    results.push(
      index.roofAt(
        (t[0][0] + t[1][0] + t[2][0]) / 3,
        (t[0][2] + t[1][2] + t[2][2]) / 3,
      ),
      index.roofAt(t[0][0], t[0][2]),
    );
  }
  for (let i = 0; i < source.nativeRoofSpans.length; i += 37) {
    const [x0, z0, x1, z1] = source.nativeRoofSpans[i];
    results.push(
      index.roofAt(x0, z0, true),
      index.roofAt(x1 - 0.001, z1 - 0.001, true),
      index.roofAt(x1, z1, true),
    );
  }
  for (let i = 0; i < source.legacyPrisms.length; i += 7) {
    const p = source.legacyPrisms[i];
    const x = p.ring.reduce((n, p) => n + p[0], 0) / p.ring.length / 10;
    const z = p.ring.reduce((n, p) => n + p[1], 0) / p.ring.length / 10;
    const base = p.y0_dm / 10,
      top = base + Math.ceil(p.h_dm / 40) * 4;
    results.push(
      index.sourceColumn(x, z, base, top),
      index.sourceColumn(x, z, top, top + 4),
    );
  }
  expect(results).toHaveLength(28037);
  expect(
    new Bun.CryptoHasher("sha256")
      .update(JSON.stringify(results))
      .digest("hex"),
  ).toBe("d6add6ab8741307aafbae161f86002633dd973cd2527c5bcf13905179c7f026e");
});
