import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import nav from "../src/data/tuWaterV168Navigation.json";
import {
  tuWaterV168RoofAt,
  tuWaterV168SourceColumn,
  tuWaterV168StructureSolidAt,
} from "../src/tuWaterV168Profile";

test("metadata and drawn queries never construct unused native navigation indexes", () => {
  const profile = fileURLToPath(new URL("../src/tuWaterV168Profile.ts", import.meta.url));
  const fixture = `
    const reads = globalThis.navigationReads = {drawn:0,nativeRoof:0,bands:0,fineBands:0};
    export default {
      parents:[], sourceParts:[], parts:[], legacyPrisms:[],
      get roofTriangles(){reads.drawn++;return [[[0,3,0],[8,5,0],[0,3,8]]];},
      get nativeRoofCells(){reads.nativeRoof++;return [[0,0,6]];},
      get structureNativeBands(){reads.bands++;return [[-2581,650,10,20]];},
      get structureNativeFineBands(){reads.fineBands++;return [];}
    };
  `;
  const script = `
    import { plugin } from "bun";
    plugin({name:"tu-navigation-field-access",setup(build){
      build.onLoad({filter:/tuWaterV168Navigation\\.json$/},()=>({loader:"js",contents:${JSON.stringify(fixture)}}));
    }});
    const profile=await import(${JSON.stringify(profile)});
    const reads=globalThis.navigationReads;
    if(Object.values(reads).some(Boolean))throw new Error("Module import allocated navigation indexes");
    if(profile.tuWaterV168RoofAt(2,2)!==3.5)throw new Error("Incorrect drawn roof");
    profile.tuWaterV168RoofAt(2,2);
    profile.tuWaterV168StructureSolidAt(-2581,650,15);
    profile.tuWaterV168StructureSolidAt(0,0,15,true);
    if(reads.drawn!==1||reads.nativeRoof||reads.bands||reads.fineBands)throw new Error("Drawn or outside query prepared native indexes");
    if(profile.tuWaterV168RoofAt(.5,.5,true)!==6)throw new Error("Incorrect native roof");
    profile.tuWaterV168RoofAt(.5,.5,true);
    if(!profile.tuWaterV168StructureSolidAt(-2580.5,650.5,15,true))throw new Error("Incorrect native structure");
    profile.tuWaterV168StructureSolidAt(-2580.5,650.5,15,true);
    if(Object.values(reads).some(value=>value!==1))throw new Error("Indexes were rebuilt");
    console.log("representation-local indexes reused");
  `;
  const result = Bun.spawnSync([process.execPath, "--eval", script]);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("representation-local indexes reused");
});

test("TU roof, source columns and open UT2 solids match the published query fingerprint", () => {
  const results: (number | boolean | null)[] = [];
  for (const t of nav.roofTriangles) {
    results.push(tuWaterV168RoofAt((t[0][0] + t[1][0] + t[2][0]) / 3,
      (t[0][2] + t[1][2] + t[2][2]) / 3), tuWaterV168RoofAt(t[0][0], t[0][2]));
  }
  for (const [x, z] of nav.nativeRoofCells) {
    results.push(tuWaterV168RoofAt(x + .5, z + .5, true),
      tuWaterV168RoofAt(x - .001, z - .001, true));
  }
  for (const [rows, scale] of [[nav.structureNativeBands, 1], [nav.structureNativeFineBands, .5]] as const) {
    for (const [x, z, lo, hi] of rows) {
      for (const y of [lo + .006, (lo + hi) / 2, hi - .006]) {
        results.push(tuWaterV168StructureSolidAt((x + .5) * scale, (z + .5) * scale, y, true),
          tuWaterV168StructureSolidAt((x + .5) * scale, (z + .5) * scale, y, false));
      }
    }
  }
  for (const p of nav.legacyPrisms) {
    const x = p.ring.reduce((n, p) => n + p[0], 0) / p.ring.length / 10;
    const z = p.ring.reduce((n, p) => n + p[1], 0) / p.ring.length / 10;
    const base = p.y0_dm / 10, top = base + Math.ceil(p.h_dm / 40) * 4;
    results.push(tuWaterV168SourceColumn(x, z, base, top), tuWaterV168SourceColumn(x, z, top, top + 4));
  }
  expect(results).toHaveLength(68060);
  expect(new Bun.CryptoHasher("sha256").update(JSON.stringify(results)).digest("hex"))
    .toBe("99de13e5baf2bc9deb2965479a45fc00c283203766adfc1a1c366884e3ca544b");
});
