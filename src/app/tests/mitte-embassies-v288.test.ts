import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Color, InstancedMesh, Mesh } from "three";
import payload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import evidence from "../../../geo_data/regierungsviertel/mitte-embassies-v288-evidence.json";
import { bakeEmbassyFittingsV288, createDprkEmbassyV288, embassyBoxBoundsV288, embassyBoxesOverlapV288, matchesDprkEmbassySourceV288, MITTE_EMBASSIES_V288_PROFILE as profile, packChinaEmbassyFittingsV288, prepareChinaEmbassyV288 } from "../src/MitteEmbassiesV288";

const rootPath = new URL("../../../", import.meta.url);
const sha = (v: Uint8Array) => new Bun.CryptoHasher("sha256").update(v).digest("hex");
const packet = (id: string, native: boolean) => JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${native ? "minecraft" : "drawn"}.json.gz`, import.meta.url))).toString());
function finish<T>(generator: Generator<void, T>): T {
  let result = generator.next(); while (!result.done) result = generator.next(); return result.value;
}

test("both complete source families, all38parts, original sheets and source hashes remain independently retained", () => {
  expect(evidence.completeOriginalFamilies.map(f => f.parts.length)).toEqual([30, 8]);
  for (const rec of evidence.sourceFiles) expect(sha(readFileSync(new URL(rec.path, rootPath)))).toBe(rec.sha256);
  for (const family of evidence.completeOriginalFamilies) {
    const src = JSON.parse(gunzipSync(readFileSync(new URL(`geo_data/regierungsviertel/alt-mitte-v169/source-${family.tile}-00.json.gz`, rootPath))).toString());
    expect(src.buildings.find((f: any) => f.id === family.id)).toEqual(family);
  }
  expect(profile.sourceGeometryRetained).toBeTrue();
  expect(profile.automaticRetirement).toBeFalse();
  expect(evidence.photographicPixelsBundled).toBeFalse();
});

test("all95 fitting runs use actual source-wall endpoints; old aperture axes and new central glass estimates remain distinct", () => {
  expect(profile.runs).toHaveLength(95);
  let estimated = 0, retainedAxes = 0;
  for (const r of profile.runs) {
    const family = evidence.completeOriginalFamilies.find(f => f.id === r.parentId)!;
    const part = family.parts.find(p => p.id === r.partId)!;
    const surface = part.surfaces.find(s => s.sourcePolygonId === r.sourcePolygonId)!;
    expect(surface.kind).toBe("WallSurface");
    for (const point of [r.start, r.end]) expect(surface.rings[0].some(p => Math.abs(p[0] - point[0]) < .001 && Math.abs(p[2] - point[1]) < .001)).toBeTrue();
    expect(r.groundY).toBeGreaterThanOrEqual(part.groundY - .001);
    expect(r.topY).toBeLessThanOrEqual(part.topY + .001);
    for (const [u, y] of r.apertures) {
      const margin = r.newPhotographedGlazing ? r.glassWidthM / 2 : .6; expect(u).toBeGreaterThan(margin); expect(u).toBeLessThan(Math.hypot(r.end[0] - r.start[0], r.end[1] - r.start[1]) - margin);
      expect(y).toBeGreaterThan(r.groundY + 1); expect(y).toBeLessThan(r.topY - 1);
    }
    if (r.newPhotographedGlazing) { estimated += r.apertures.length; expect(r.newPhotographedGlazing).toBeTrue(); }
    else retainedAxes += r.apertures.length;
  }
  expect(estimated).toBe(322); expect(retainedAxes).toBeGreaterThanOrEqual(306);
});

test("independent native fittings clear every exact retained native occupied-cell blocker without changing the source", () => {
  expect(evidence.native.blockers).toHaveLength(2336);
  let collisions = 0;
  for (const site of ["china", "dprk"] as const) {
    const baked = bakeEmbassyFittingsV288(site, true);
    expect(baked.faces).toHaveLength(0);
    expect(baked.boxes).toHaveLength(site === "china" ? 3829 : 2474);
    for (const b of baked.boxes) {
      expect(b.yaw).toBe(0);
      expect(b.size.every(n => Number.isFinite(n) && n > 0 && n <= 2.1)).toBeTrue();
      const a = embassyBoxBoundsV288(b);
      for (const source of evidence.native.blockers) if (embassyBoxesOverlapV288(a, source)) collisions++;
    }
    expect(profile.native.componentFits[site].every(n => n === null || n >= 0 && n <= profile.limits.maxNativeProjectionM)).toBeTrue();
  }
  expect(collisions).toBe(0);
  expect(profile.native.componentFits.china.filter(n => n === null)).toHaveLength(1295);
  expect(profile.native.componentFits.dprk.filter(n => n === null)).toHaveLength(0);
  for (const w of profile.native.sourceWindows) for (const [x, z, low, top] of w.columns) expect(evidence.native.blockers.some(b => b[0] === x * 4 && b[2] === z * 4 && b[3] === x * 4 + 4 && b[5] === z * 4 + 4 && b[1] === low / 10 && b[4] === top / 10)).toBeTrue();
});

test("the photographed NE front owns silver skins,39 measured short bay planes and the actual raised stack; unsupported rear glass is absent", () => {
  expect(profile.chinaFrontAudit.cameraWorldXZ).toEqual([3211.429, 514.308]);
  expect(profile.runs.some(r => r.sourcePolygonId === "UUID_7d5cf707-3cc4-4d8f-b9af-49fd96efd560")).toBeFalse();
  const facets = profile.runs.filter(r => r.style === "china-facet"), stack = profile.runs.filter(r => r.style === "china-front-stack");
  expect(facets).toHaveLength(39); expect(stack).toHaveLength(3);
  expect(facets.every(r => r.partId === "DEBE3DK3aPPX5UVQ" && r.apertures.length === 7)).toBeTrue();
  expect(stack.every(r => r.partId === "DEBE3DDkWe53IE8v")).toBeTrue();
  expect(stack.reduce((n, r) => n + r.apertures.length, 0)).toBe(49);
  expect(profile.chinaSkins).toHaveLength(82);
  const area = (points: number[][]) => Math.abs(points.reduce((sum, a, i) => { const b = points[(i + 1) % points.length]; return sum + a[0] * b[1] - a[1] * b[0]; }, 0)) / 2;
  for (const skin of profile.chinaSkins) {
    const r = profile.runs[skin.run];
    expect(r.sourcePolygonId).toBe(skin.sourcePolygonId); expect(r.partId).toBe(skin.partId);
    expect(skin.normalCameraDot).toBeGreaterThan(.25);
    const sourceArea = area(r.wallRingsLocal[0]) - r.wallRingsLocal.slice(1).reduce((sum, ring) => sum + area(ring), 0);
    expect(Math.abs(skin.triangles.reduce((sum, tri) => sum + area(tri), 0) - sourceArea)).toBeLessThan(1e-5);
  }
  expect(profile.chinaFrontAudit.skinOffsetM).toBeLessThan(.055);
  expect(new Bun.CryptoHasher("sha256").update(JSON.stringify(bakeEmbassyFittingsV288("dprk", true))).digest("hex")).toBe("139b150b1eefaed0e2df776f5039ebb628636e5ec18e85f3d847ac32611d9d2e");
});

test("DPRK native addition admits only the original bounded payload and does not invoke adversarial descriptors", () => {
  expect(matchesDprkEmbassySourceV288(payload)).toBeTrue();
  expect(createDprkEmbassyV288({ native: true })).toBeNull();
  const w = profile.native.sourceWindows[0], [x, z] = w.columns[0], rowIndex = z - payload.grid.min_z_idx;
  const copy = () => ({ ...payload, building_rows: payload.building_rows.map((r, i) => i === rowIndex ? r.map(v => [...v]) : r) });
  const changed = copy();
  changed.building_rows[rowIndex].find(r => x >= payload.grid.min_x_idx + r[0] && x < payload.grid.min_x_idx + r[0] + r[1])![3]++;
  expect(matchesDprkEmbassySourceV288(changed)).toBeFalse();
  expect(createDprkEmbassyV288({ native: true, payload: changed })).toBeNull();
  let reads = 0;
  for (const mode of ["getter", "hidden", "sparse", "symbol"]) {
    const bad = copy(), value = bad.building_rows[rowIndex][0][0];
    if (mode === "getter") Object.defineProperty(bad.building_rows[rowIndex][0], "0", { enumerable: true, get() { reads++; return value; } });
    if (mode === "hidden") Object.defineProperty(bad.building_rows[rowIndex][0], "0", { enumerable: false, value });
    if (mode === "sparse") delete bad.building_rows[rowIndex][0][0];
    if (mode === "symbol") Object.defineProperty(bad.building_rows[rowIndex][0], Symbol(), { value: 1 });
    expect(matchesDprkEmbassySourceV288(bad)).toBeFalse();
  }
  expect(reads).toBe(0);
});

test("China fittings append only inside the exact streamed source contract in both families and tiles", () => {
  for (const native of [false, true]) for (const id of ["5_1", "6_1"]) {
    const original = packet(id, native), before = JSON.stringify(original);
    const result = finish(prepareChinaEmbassyV288(original, id, native));
    expect(result).not.toBe(original); expect(result.meshes).toHaveLength(original.meshes.length + 1);
    expect(result.nav).toBe(original.nav); expect(result.lines).toBe(original.lines); expect(result.origin).toBe(original.origin);
    original.meshes.forEach((m: any, i: number) => expect(result.meshes[i]).toBe(m));
    expect(JSON.stringify(original)).toBe(before);
    expect(finish(prepareChinaEmbassyV288(result, id, native))).toBe(result);
    const added = result.meshes.at(-1)!;
    const positions = Buffer.from(added.positions, "base64");
    for (let i = 0; i < positions.byteLength; i += 6) for (const axis of [0, 2]) {
      const v = positions.readUInt16LE(i + axis * 2) / 100 + result.origin[axis], index = Number(id.split("_")[axis === 0 ? 0 : 1]);
      expect(v).toBeGreaterThanOrEqual(index * 512); expect(v).toBeLessThanOrEqual((index + 1) * 512);
    }
    expect(result.meshes.length).toBeLessThanOrEqual(16);
    expect(result.meshes.reduce((n: number, m: any) => n + Buffer.from(m.positions, "base64").length / 6, 0)).toBeLessThanOrEqual(400000);
  }
});

test("changed China source/binding and getter owners retain the original packet; cancelled preparation never publishes", () => {
  const id = "5_1", original = packet(id, true), rec = profile.chinaPackets.find(r => r.key === "minecraft:5_1")!;
  const sourceChanged = structuredClone(original); sourceChanged.meshes[rec.meshes[0].index].positions += "A";
  expect(finish(prepareChinaEmbassyV288(sourceChanged, id, true))).toBe(sourceChanged);
  const bindingChanged = structuredClone(original); bindingChanged.nav.buildings.find((b: any) => b.sourceId === "DEBE01YYK000095y").ring[0][0] += .01;
  expect(finish(prepareChinaEmbassyV288(bindingChanged, id, true))).toBe(bindingChanged);
  const missing = structuredClone(original); missing.nav.buildings = missing.nav.buildings.filter((b: any) => b.sourceId !== "DEBE01YYK000095y");
  expect(finish(prepareChinaEmbassyV288(missing, id, true))).toBe(missing);
  let reads = 0;
  const getter = structuredClone(original); Object.defineProperty(getter.meshes[0], "kind", { enumerable: true, get() { reads++; throw Error("must not read"); } });
  expect(finish(prepareChinaEmbassyV288(getter, id, true))).toBe(getter);
  const topGetter = structuredClone(original); Object.defineProperty(topGetter, "meshes", { enumerable: true, get() { reads++; throw Error("must not read"); } });
  expect(finish(prepareChinaEmbassyV288(topGetter, id, true))).toBe(topGetter);
  expect(reads).toBe(0);
  const before = JSON.stringify(original), g = prepareChinaEmbassyV288(original, id, true);
  expect(g.next().done).toBeFalse(); g.return(original); expect(JSON.stringify(original)).toBe(before);
});

test("new DPRK batches keep day/night materials, full touch detail and strict finite buffer allowances", () => {
  const before = JSON.stringify(profile);
  for (const native of [false, true]) {
    const root = createDprkEmbassyV288({ native, payload })!; let bytes = 0, renders = 0;
    root.traverse(o => {
      if (!(o instanceof Mesh)) return; renders++;
      for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
      bytes += o.geometry.index?.array.byteLength ?? 0;
      if (o instanceof InstancedMesh) bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
      expect(o.userData.dayMaterial).toBeDefined(); expect(o.userData.nightMaterial).toBeDefined();
    });
    expect(renders).toBe(native ? 1 : 2); expect(bytes).toBeLessThanOrEqual(profile.limits.bufferBytes);
    expect(root.userData.fullStaticDetailOnTouch).toBeTrue(); expect(root.userData.automaticRetirement).toBeFalse();
  }
  for (const native of [false, true]) {
    let bytes = 0;
    for (const id of ["5_1", "6_1"]) { const r = profile.chinaPackets.find(r => r.key === `${native ? "minecraft" : "drawn"}:${id}`)!; const p = packChinaEmbassyFittingsV288(id, native, r.origin)!; for (const v of [p.positions, p.colors, p.indices]) bytes += Buffer.from(v, "base64").length; }
    expect(bytes).toBeLessThanOrEqual(profile.limits.bufferBytes);
  }
  expect(JSON.stringify(profile)).toBe(before);
});


test("new China packet colours match authored sRGB tints in the decoder linear space, with exact geometry and all original strings preserved", () => {
  const geometryReceipts = [
  {
    "key": "drawn:5_1",
    "positionsSHA": "6ebf6d3845e9d2eb69a10f8d06a0ce24dc9aa6510bc9e74473f899d4528e70ef",
    "indicesSHA": "96310ed0e36978e1ecacdb964846482ee9db873db844eba1ad6431445e19df7f",
    "colorsByteLength": 33438
  },
  {
    "key": "drawn:6_1",
    "positionsSHA": "64bbdad3f0b585353c84ea9a031c4978fb9ba83a15a774f37f16691bec795444",
    "indicesSHA": "560cfb2c15ef0f3c046a90ea5f11abb69b6b857c7bf6c7558ea94c80912d7723",
    "colorsByteLength": 57033
  },
  {
    "key": "minecraft:5_1",
    "positionsSHA": "aa3b20ced11af36a424730df532dbab832f4fd4ce4d8a9676433a6487ced6098",
    "indicesSHA": "9c8c2a92ee9d119f396cd0ba7669e815518323219e961aa86c616139517d286d",
    "colorsByteLength": 27192
  },
  {
    "key": "minecraft:6_1",
    "positionsSHA": "a07d2088c4e0442321e95e640bb6bc7aab46f96eb7823d68414cd7ccc9f3b9e8",
    "indicesSHA": "96b3a439ad6160307ac3ee3daa1c2feb41dccdf3eed634ea7b9d79f9f87de3c7",
    "colorsByteLength": 49518
  }
];
  const seen = new Set<string>();
  for (const receipt of geometryReceipts) {
    const [mode, id] = receipt.key.split(":"), native = mode === "minecraft", original = packet(id, native);
    const sourceStrings = original.meshes.map((m: any) => ({ positions: m.positions, colors: m.colors, indices: m.indices }));
    const result = finish(prepareChinaEmbassyV288(original, id, native));
    expect(result === original).toBeFalse();
    const added = result.meshes.at(-1)!;
    expect(sha(Buffer.from(added.positions, "utf8"))).toBe(receipt.positionsSHA);
    expect(sha(Buffer.from(added.indices, "utf8"))).toBe(receipt.indicesSHA);
    const colors = Buffer.from(added.colors, "base64"); expect(colors.length).toBe(receipt.colorsByteLength);
    const baked = bakeEmbassyFittingsV288("china", native);
    const expected = new Set([...baked.boxes, ...baked.faces].map(f => {
      const c = new Color().setHex(f.tint); return [c.r, c.g, c.b].map(n => Math.round(n * 255)).join(",");
    }));
    const actual = new Set<string>(); for (let i = 0; i < colors.length; i += 3) actual.add(`${colors[i]},${colors[i + 1]},${colors[i + 2]}`);
    for (const color of actual) { expect(expected.has(color)).toBeTrue(); seen.add(color); }
    sourceStrings.forEach((before: any, i: number) => {
      expect(result.meshes[i].positions === before.positions).toBeTrue();
      expect(result.meshes[i].colors === before.colors).toBeTrue();
      expect(result.meshes[i].indices === before.indices).toBeTrue();
      expect(original.meshes[i].positions === before.positions).toBeTrue();
      expect(original.meshes[i].colors === before.colors).toBeTrue();
      expect(original.meshes[i].indices === before.indices).toBeTrue();
    });
  }
  // Independently pinned main silver, portal-blue, glazing and dark-rail tones.
  for (const triplet of ["124,139,142", "70,101,116", "62,96,111", "25,38,45"]) expect(seen.has(triplet)).toBeTrue();
  expect(seen.has("185,195,197")).toBeFalse();
});
