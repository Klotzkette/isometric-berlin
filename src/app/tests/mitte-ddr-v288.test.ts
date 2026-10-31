import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { InstancedMesh, Mesh, MeshPhysicalMaterial } from "three";
import payload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import evidence from "../../../geo_data/regierungsviertel/mitte-ddr-v288-evidence.json";
import { bakeMitteDdrV288, createMitteDdrV288, matchesMitteDdrNativeSourceV288, MITTE_DDR_V288_PROFILE as profile, mitteDdrNativeBoxBoundsV288, mitteDdrNativeOverlapsV288 } from "../src/MitteDdrV288";

const rootPath = new URL("../../../", import.meta.url);
const sha = (value: Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const native = bakeMitteDdrV288(true), drawn = bakeMitteDdrV288(false);

test("all four complete selected source families and unchanged source hashes are independently retained", () => {
  for (const receipt of evidence.sourceFiles) expect(sha(readFileSync(new URL(receipt.path, rootPath)))).toBe(receipt.sha256);
  const files = new Map<string, any>();
  for (const family of evidence.completeOriginalFamilies) {
    const rel = `geo_data/regierungsviertel/alt-mitte-v169/source-${family.tile}-00.json.gz`;
    if (!files.has(rel)) files.set(rel, JSON.parse(gunzipSync(readFileSync(new URL(rel, rootPath))).toString()));
    const original = files.get(rel).buildings.find((r: any) => r.id === family.id);
    expect(family).toEqual(original);
  }
  expect(evidence.completeOriginalFamilies).toHaveLength(4);
  expect(profile.automaticRetirement).toBeFalse();
  expect(profile.photoPixelsBundled).toBeFalse();
  expect(profile.sourceGeometryRetained).toBeTrue();
});

test("seven real exterior planes belong to the three 1988 DDR owners and the exact Schwalbennest lower band", () => {
  expect(profile.runs).toHaveLength(7);
  for (const run of profile.runs) {
    const family = evidence.completeOriginalFamilies.find(f => f.id === run.parentId)!;
    const part = family.parts.find(p => p.id === run.partId)!;
    const surface = part.surfaces.find(s => s.sourcePolygonId === run.sourcePolygonId)!;
    expect(surface.kind).toBe("WallSurface");
    for (const point of [run.start, run.end]) expect(surface.rings[0].some(p => Math.abs(p[0] - point[0]) < .001 && Math.abs(p[2] - point[1]) < .001)).toBeTrue();
    expect(run.groundY).toBeGreaterThanOrEqual(part.groundY - .001);
    expect(run.topY).toBeLessThanOrEqual(part.topY + .001);
    if (run.style === "memorial-east-slab") expect(family.osmTags.start_date).toBe("1988");
  }
  expect(profile.runs.some(r => r.parentId === "DEBE01AL1H500002")).toBeFalse();
});

test("six oriels have a photographic 4+1+1 plan and separate glazed bands, without pretending the six curves are LoD2 data", () => {
  const oriels = profile.runs.filter(r => r.style === "schwalbennest");
  expect(oriels.map(r => r.orielCount)).toEqual([4, 1, 1]);
  expect(oriels.reduce((n, r) => n + r.orielCount!, 0)).toBe(6);
  expect(drawn.sheets.filter(s => s.glass)).toHaveLength(6 * 18);
  expect(native.boxes.filter(b => b.kind === "native-oriel-glazing")).toHaveLength(6 * 12 * 3);
  expect(profile.estimateStatus).toContain("material is unconfirmed");
  expect(evidence.identityLimits.cafe).toContain("Ngon");
});

test("every independent native fitting is entirely outside all retained coarse source-solid envelopes", () => {
  let collisions = 0;
  for (const b of native.boxes) {
    const bounds = mitteDdrNativeBoxBoundsV288(b);
    for (const source of profile.native.blockers) if (mitteDdrNativeOverlapsV288(bounds, source)) collisions++;
    expect(b.yaw).toBe(0);
    expect(b.size.every(v => Number.isFinite(v) && v > 0 && v <= 2.01)).toBeTrue();
  }
  expect(collisions).toBe(0);
  expect(native.projections).toEqual(profile.native.projectionM);
  expect(native.projections.every(n => n >= 0 && n <= profile.limits.maxNativeProjectionM)).toBeTrue();
  expect(drawn.sheets.length).toBeGreaterThan(0);
  expect(native.sheets).toHaveLength(0);
});

test("all source four-metre columns in the two finite windows are included verbatim in the native blocker proof", () => {
  for (const w of profile.native.sourceWindows) for (const [x, z, low, top] of w.columns) {
    expect(profile.native.blockers.some(b => b[0] === x * 4 && b[2] === z * 4 && b[3] === x * 4 + 4 && b[5] === z * 4 + 4 && b[1] === low / 10 && b[4] === top / 10)).toBeTrue();
  }
  expect(matchesMitteDdrNativeSourceV288(payload)).toBeTrue();
});

test("changed/missing native source rejects globally; unrelated out-of-window changes do not claim new ownership", () => {
  const [x, z] = profile.native.sourceWindows[0].columns[0];
  const rowIndex = z - payload.grid.min_z_idx;
  const copy = () => ({ ...payload, building_rows: payload.building_rows.map((r, i) => i === rowIndex ? r.map(v => [...v]) : r) });
  const changed = copy();
  const run = changed.building_rows[rowIndex].find(r => x >= payload.grid.min_x_idx + r[0] && x < payload.grid.min_x_idx + r[0] + r[1])!;
  run[3]++;
  expect(matchesMitteDdrNativeSourceV288(changed)).toBeFalse();
  expect(createMitteDdrV288({ native: true, payload: changed })).toBeNull();
  expect(createMitteDdrV288({ native: true })).toBeNull();
  const outside = { ...payload, building_rows: [...payload.building_rows] };
  outside.building_rows[0] = [];
  expect(matchesMitteDdrNativeSourceV288(outside)).toBeTrue();
});

test("native guard rejects sparse/extra/accessor coordinate receipts without invoking getters", () => {
  let reads = 0;
  const top = { ...payload };
  Object.defineProperty(top, "cell_m", { enumerable: true, get() { reads++; return 4; } });
  expect(matchesMitteDdrNativeSourceV288(top)).toBeFalse();
  const rowIndex = profile.native.sourceWindows[0].bounds[1] - payload.grid.min_z_idx;
  for (const variant of ["accessor", "sparse", "hidden", "symbol"]) {
    const rows = [...payload.building_rows], row = payload.building_rows[rowIndex].map(r => [...r]); rows[rowIndex] = row;
    const original = row[0][0];
    if (variant === "accessor") Object.defineProperty(row[0], "0", { enumerable: true, get() { reads++; return original; } });
    if (variant === "sparse") delete row[0][0];
    if (variant === "hidden") Object.defineProperty(row[0], "0", { enumerable: false, value: original });
    if (variant === "symbol") Object.defineProperty(row[0], Symbol("foreign"), { value: 1 });
    expect(matchesMitteDdrNativeSourceV288({ ...payload, building_rows: rows })).toBeFalse();
  }
  expect(reads).toBe(0);
});

test("both bounded constructors have no media, animation, source retirement or extra native smooth shell", () => {
  const before = JSON.stringify(profile);
  for (const isNative of [false, true]) {
    const root = createMitteDdrV288({ native: isNative, payload })!;
    let bytes = 0, renderables = 0;
    root.traverse(o => {
      if (!(o instanceof Mesh)) return;
      renderables++;
      for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
      if (o.geometry.index) bytes += o.geometry.index.array.byteLength;
      if (o instanceof InstancedMesh) { bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0); expect(isNative).toBeTrue(); }
      expect(o.userData.dayMaterial).toBeDefined(); expect(o.userData.nightMaterial).toBeDefined();
      if (o.material instanceof MeshPhysicalMaterial) { expect(isNative).toBeFalse(); expect(o.material.depthWrite).toBeFalse(); }
    });
    expect(renderables).toBeLessThanOrEqual(profile.limits.renderables);
    expect(bytes).toBeLessThanOrEqual(profile.limits.bufferBytes);
    expect(root.userData.fullStaticDetailOnTouch).toBeTrue();
    expect(root.userData.automaticRetirement).toBeFalse();
  }
  expect(JSON.stringify(profile)).toBe(before);
  const code = readFileSync(new URL("../src/MitteDdrV288.ts", import.meta.url), "utf8");
  for (const token of ["TextureLoader", "requestAnimationFrame", "PointLight", "setInterval", ".jpg", "fetch("]) expect(code.includes(token)).toBeFalse();
});
