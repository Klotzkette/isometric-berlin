import { expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createBndHeadquartersV174, createMinecraftBndHeadquartersV174 } from "../src/BndHeadquartersV174";
import { BND_HEADQUARTERS_V174_PARTS, BND_HEADQUARTERS_V174_PROFILE, bndHeadquartersV174RoofAt, bndHeadquartersV174SolidAt } from "../src/bndHeadquartersV174Profile";
import source from "../src/data/bndHeadquartersV174Source.json";
import evidence from "../src/data/bndHeadquartersV174Evidence.json";

function bytes(mesh: Mesh): number {
  return Object.values(mesh.geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0) +
    (mesh.geometry.index?.array.byteLength ?? 0) + (mesh instanceof InstancedMesh ?
      mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0) : 0);
}

test("BND keeps original measured owners and source holes", () => {
  expect(BND_HEADQUARTERS_V174_PROFILE.newReplacedOwners).toEqual([]);
  expect(BND_HEADQUARTERS_V174_PROFILE.preservedOwners).toHaveLength(4);
  expect(BND_HEADQUARTERS_V174_PROFILE.originalMainTopY).toBe(18.286);
  expect(BND_HEADQUARTERS_V174_PARTS).toHaveLength(5);
  const main = evidence.sourceParents.find(p => p.id === "DEBE00YY1tw0009x")!;
  for (const hole of main.footprintPolygons[0].holes) {
    // Probe many points and retain only those the original hole actually owns.
    const centre = hole.reduce((q, p) => [q[0] + p[0]/hole.length, q[1] + p[1]/hole.length], [0,0]);
    // The concave gatehouse connector court is tested by a known interior point.
    if (hole.length > 20) continue;
    expect(bndHeadquartersV174RoofAt(centre[0], centre[1])).toBeNull();
    expect(bndHeadquartersV174SolidAt(centre[0], centre[1], 24)).toBe(false);
  }
});

test("BND full and touch draw the identical static exterior", () => {
  const a = createBndHeadquartersV174(), b = createBndHeadquartersV174({mobileLike:true});
  expect(a.children).toHaveLength(2);
  let total = 0;
  for(let i=0; i<a.children.length; i++) {
    const x = a.children[i] as Mesh, y = b.children[i] as Mesh;
    expect(x.geometry.getAttribute("position").array).toEqual(y.geometry.getAttribute("position").array);
    expect(x.matrixAutoUpdate).toBe(false);
    expect(x.geometry.getAttribute("uv")).toBeUndefined();
    if(x instanceof InstancedMesh && y instanceof InstancedMesh) {
      expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
      expect(x.instanceColor!.array).toEqual(y.instanceColor!.array);
      expect(x.count).toBeGreaterThan(source.boxes.length);
    }
    total += bytes(x);
  }
  expect(total).toBeLessThan(4200000);
  console.log({bndDrawnBytes:total,batches:2});
});

test("BND native branch uses one orthogonal surface batch", () => {
  const a = createMinecraftBndHeadquartersV174(), b = createMinecraftBndHeadquartersV174({mobileLike:true});
  expect(a.children).toHaveLength(1);
  const x = a.children[0] as InstancedMesh, y = b.children[0] as InstancedMesh;
  expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
  expect(x.instanceColor!.array).toEqual(y.instanceColor!.array);
  expect(x.count).toBeGreaterThan(source.nativeBoxes.length);
  expect(a.userData.publicExteriorOnly).toBe(true);
  expect(a.userData.noHiddenSolidInfill).toBe(true);
  const m = x.instanceMatrix.array;
  for(let i=0; i<x.count; i++) expect([m[i*16+1],m[i*16+2],m[i*16+4],m[i*16+6],m[i*16+8],m[i*16+9]]).toEqual([0,0,0,0,0,0]);
  expect(bytes(x)).toBeLessThan(2000000);
  console.log({bndNativeBytes:bytes(x),instances:x.count});
});

test("BND upper support follows mapped steps and preserves the original base", () => {
  expect(bndHeadquartersV174RoofAt(356,-1640)).toBe(35.2);
  expect(bndHeadquartersV174RoofAt(356,-1640,true)).toBe(36);
  expect(bndHeadquartersV174SolidAt(356,-1640,24)).toBe(true);
  expect(bndHeadquartersV174SolidAt(356,-1640,10)).toBe(false);
  expect(bndHeadquartersV174RoofAt(50,-1600)).toBeNull();
  expect(bndHeadquartersV174SolidAt(50,-1600,24)).toBe(false);
});

test("BND import and metadata decode neither mode; each factory reads only its own arrays", async () => {
  const dataPath = new URL("../src/data/bndHeadquartersV174Source.json", import.meta.url).pathname;
  const modulePath = new URL("../src/BndHeadquartersV174.ts", import.meta.url).pathname;
  for (const native of [false, true]) {
    const script = `
      import { plugin } from "bun";
      import { readFileSync } from "node:fs";
      const data = JSON.parse(readFileSync(${JSON.stringify(decodeURI(dataPath))}, "utf8"));
      const body = "const source="+JSON.stringify(data)+";"+
        "for(const field of ['boxes','surfaces','nativeBoxes']) { const rows=source[field]; Object.defineProperty(source,field,{get(){globalThis.bndReads[field]++;return rows;}}); } export const renderBudget=source.renderBudget; export default source;";
      globalThis.bndReads={boxes:0,surfaces:0,nativeBoxes:0};
      plugin({name:"bnd-lazy-mode-audit",setup(build){build.onLoad({filter:/bndHeadquartersV174Source\\.json$/},()=>({loader:"js",contents:body}));}});
      const model=await import(${JSON.stringify(decodeURI(modulePath))});
      const budget=model.BND_HEADQUARTERS_V174_RENDER_BUDGET;
      if(budget.facadeInstances!==50410||budget.nativeInstances!==23194||budget.surfaceTriangles!==1335)throw new Error("Incorrect offline metadata");
      if(Object.values(globalThis.bndReads).some(n=>n!==0))throw new Error("Import or metadata eagerly read render arrays");
      const root=model[${JSON.stringify(native ? "createMinecraftBndHeadquartersV174" : "createBndHeadquartersV174")} ]();
      const r=globalThis.bndReads;
      if(${native} ? r.boxes!==0||r.surfaces!==0||r.nativeBoxes===0 : r.nativeBoxes!==0||r.boxes===0||r.surfaces===0)throw new Error("Factory decoded another mode");
      if(root.userData.renderBudget!==budget)throw new Error("Budget metadata identity changed");
      root.traverse(o=>{o.geometry?.dispose();for(const m of new Set([o.material,o.userData.dayMaterial,o.userData.nightMaterial]))if(m&&!Array.isArray(m))m.dispose();});
      console.log("BND mode isolation verified");
    `;
    const result = Bun.spawnSync([process.execPath, "--eval", script]);
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("BND mode isolation verified");
  }
});

test("the production bundler removes unused BND render payloads from worker-style imports", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { build } = await import("vite");
  const { losslessJsonData } = await import("../losslessJsonData");
  const directory = await mkdtemp(join(tmpdir(), "bnd-worker-side-effects-"));
  try {
    const entry = join(directory, "entry.js");
    const model = fileURLToPath(new URL("../src/BndHeadquartersV174.ts", import.meta.url));
    await writeFile(entry, `import ${JSON.stringify(model)}; globalThis.bndWorkerAudit = 174;`);
    const result = await build({
      configFile: false, root: directory, publicDir: false, logLevel: "silent",
      plugins: [losslessJsonData()],
      build: { write: false, minify: true, rolldownOptions: { input: entry } },
    });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one bundle");
    const code = result.output.filter(o => o.type === "chunk").map(o => o.code).join("\n");
    expect(code).toContain("bndWorkerAudit");
    // The existing shared lettering table remains a small module side effect.
    expect(code.length).toBeLessThan(8 * 1024);
    expect(code).not.toContain("JSON.parse");
    expect(code).not.toContain("vertical-glazing");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
