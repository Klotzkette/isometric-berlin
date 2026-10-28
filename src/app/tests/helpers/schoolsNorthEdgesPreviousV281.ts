import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { Group, InstancedBufferAttribute, InstancedMesh, type Object3D } from "three";
import proof from "../fixtures/schools-north-edges-v281-replay.json";
import schools from "../../src/data/schoolsV185.json";
import places from "../../src/data/schoolsPlacesV205.json";
import north from "../../src/data/northV185.json";
import edges from "../../src/data/altMitteEdgesV186.json";
import { createSchoolsV185 } from "../../src/SchoolsV185";
import { createNorthV185 } from "../../src/NorthV185";
import { appendSchoolPlaceV205 } from "../../src/schoolsPlacesV205Batches";
import { altMitteEdgesV186Batches } from "../../src/altMitteEdgesV186Batches";
import { justicePalaceV183Boxes } from "../../src/justicePalaceV183Batches";
import { letteringStrokePaths } from "../../src/drawnLettering";
import { freezeStaticSceneTransforms } from "../../src/staticSceneTransforms";
import { buildingTerrainOffset, terrainGroundAt } from "../../src/weinbergTerrainV176";
import { geometryPreservationV206 } from "./geometryPreservationV206";
import { disposeStaticAudit, staticGeometryAudit } from "./staticGeometryAudit";

const sha = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
function previousPlanners() {
  expect(proof.releasedBase).toBe("54990de80b75317612b069f974ba753008b54b3d");
  for (const [path, expected] of Object.entries({ ...proof.retainedSourceSha256, ...proof.currentDependencySha256 })) {
    expect(sha(readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8")), path).toBe(expected);
  }
  const previous = new Map<string, string>();
  for (const record of proof.sourceReplay) {
    let source = readFileSync(new URL(`../../../../${record.path}`, import.meta.url), "utf8");
    expect(sha(source), record.path).toBe(record.currentSha256);
    for (const replacement of record.replacements) {
      expect(source.split(replacement.current), record.path).toHaveLength(2);
      source = source.replace(replacement.current, replacement.before);
    }
    expect(sha(source), record.path).toBe(record.beforeSha256);
    previous.set(record.path.split("/").at(-1)!, source);
  }
  const common = { ...THREE, justicePalaceV183Boxes, letteringStrokePaths,
    freezeStaticSceneTransforms, buildingTerrainOffset, terrainGroundAt };
  const compile = (file: string, exported: string, bindings: Record<string, unknown>) => {
    const source = previous.get(file)!.replace(/^import[^\n]*\n/gm, "").replace(/^export /gm, "");
    const code = new Bun.Transpiler({ loader: "ts" }).transformSync(source);
    const context = { ...common, ...bindings };
    return new Function(...Object.keys(context), `${code}\nreturn ${exported};`)(...Object.values(context));
  };
  const append = compile("schoolsPlacesV205Batches.ts", "appendSchoolPlaceV205", { source: places }) as typeof appendSchoolPlaceV205;
  return {
    schools: compile("SchoolsV185.ts", "createSchoolsV185", { source: schools, appendSchoolPlaceV205: append }) as typeof createSchoolsV185,
    north: compile("NorthV185.ts", "createNorthV185", { source: north }) as typeof createNorthV185,
    edges: compile("altMitteEdgesV186Batches.ts", "altMitteEdgesV186Batches", {}) as typeof altMitteEdgesV186Batches,
    append,
  };
}
function sameObject(actual: Object3D, expected: Object3D): void {
  expect(geometryPreservationV206(actual), actual.name).toEqual(geometryPreservationV206(expected));
  expect(staticGeometryAudit(actual), actual.name).toEqual(staticGeometryAudit(expected));
}
const rowKey = (mesh: InstancedMesh, index: number) => {
  const m = mesh.instanceMatrix.array, c = mesh.instanceColor!.array;
  return Buffer.from(m.buffer, m.byteOffset + index * 64, 64).toString("base64") +
    Buffer.from(c.buffer, c.byteOffset + index * 12, 12).toString("base64");
};

/** Use actual retained matrix/colour bytes whenever the old row survives. The
 * independent old source planner supplies only superseded rows; the complete
 * current comparison has already checked every removed/new row as well. */
function restoreInstances(live: InstancedMesh, before: InstancedMesh): () => void {
  expect(Object.keys(live.geometry.attributes)).toEqual(Object.keys(before.geometry.attributes));
  for (const name of Object.keys(live.geometry.attributes)) {
    const a = live.geometry.getAttribute(name), b = before.geometry.getAttribute(name);
    expect(a.array).toEqual(b.array); expect(a.itemSize).toBe(b.itemSize); expect(a.normalized).toBe(b.normalized);
  }
  expect(live.geometry.index?.array).toEqual(before.geometry.index?.array);
  const matrix = live.instanceMatrix, color = live.instanceColor!, count = live.count;
  const rows = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const key = rowKey(live, i), candidates = rows.get(key) ?? [];
    candidates.push(i); rows.set(key, candidates);
  }
  const matrices = new Float32Array(before.instanceMatrix.array), colors = new Float32Array(before.instanceColor!.array);
  for (let i = 0; i < before.count; i++) {
    const index = rows.get(rowKey(before, i))?.pop();
    if (index === undefined) continue;
    matrices.set(matrix.array.subarray(index * 16, index * 16 + 16), i * 16);
    colors.set(color.array.subarray(index * 3, index * 3 + 3), i * 3);
  }
  live.instanceMatrix = new InstancedBufferAttribute(matrices, 16, before.instanceMatrix.normalized);
  live.instanceColor = new InstancedBufferAttribute(colors, 3, before.instanceColor!.normalized);
  live.count = before.count;
  const restore = () => { live.instanceMatrix = matrix; live.instanceColor = color; live.count = count; };
  try { sameObject(live, before); } catch (error) { restore(); throw error; }
  return restore;
}

/** Narrow v230–v274 projection for the old whole-outline contract. No current
 * source/model is omitted: all selected current objects are verified in full,
 * unchanged nodes/geometry/materials remain live, and every original final
 * byte is still checked by the caller's frozen v220/v206 whole-tree hashes. */
export function restoreSchoolsNorthEdgesPreviousV281(root: Group, mode: "day" | "minecraft"): () => void {
  const native = mode === "minecraft", old = previousPlanners();
  const owned: Group[] = [], undo: (() => void)[] = [];
  const keep = (group: Group) => { owned.push(group); return group; };
  const find = (name: string) => {
    const found = root.children.filter(child => child.name === name);
    expect(found, name).toHaveLength(1); expect(found[0]).toBeInstanceOf(Group); return found[0] as Group;
  };
  const project = (parent: Group, before: Group, current: Group, changed: string[], missing: string[] = [], added: string[] = [], subset = false) => {
    const original = [...parent.children], currentNames = current.children.map(child => child.name);
    const selected = subset ? original.filter(child => currentNames.includes(child.name)) : original;
    expect(selected.map(child => child.name)).toEqual(currentNames);
    const byName = new Map(selected.map(child => [child.name, child]));
    expect(byName.size).toBe(selected.length);
    current.children.forEach((expected, i) => sameObject(selected[i], expected));
    expect(currentNames.filter(name => !before.children.some(child => child.name === name)).sort()).toEqual([...added].sort());
    expect(before.children.filter(child => !byName.has(child.name)).map(child => child.name).sort()).toEqual([...missing].sort());
    const actuallyChanged: string[] = [], borrowed: Object3D[] = [];
    const restored = before.children.map(previous => {
      const live = byName.get(previous.name);
      if (!live) { borrowed.push(previous); return previous; }
      if (JSON.stringify(geometryPreservationV206(live)) === JSON.stringify(geometryPreservationV206(previous))) {
        sameObject(live, previous); return live;
      }
      actuallyChanged.push(previous.name);
      expect(live).toBeInstanceOf(InstancedMesh); expect(previous).toBeInstanceOf(InstancedMesh);
      undo.push(restoreInstances(live as InstancedMesh, previous as InstancedMesh));
      return live;
    });
    expect(actuallyChanged.sort()).toEqual([...changed].sort());
    for (const child of borrowed) child.parent = parent;
    parent.children = [...(subset ? original.filter(child => !currentNames.includes(child.name)) : []), ...restored];
    undo.push(() => { parent.children = original; for (const child of borrowed) child.parent = before; });
  };
  const restore = () => { for (const action of undo.reverse()) action(); for (const group of owned) disposeStaticAudit(group); };
  try {
    const schoolBefore = keep(old.schools(native)), schoolCurrent = keep(createSchoolsV185(native));
    project(find(schoolCurrent.name), schoolBefore, schoolCurrent, [
      "Kastanienbaum Grundschule main: source-bound window heads and material profiles v205",
      "Gymnasium Steglitz: source-bound window heads and material profiles v205",
    ], [
      "John-Lennon-Gymnasium: eave, corner and console course",
      "John-Lennon-Gymnasium: source-bound window heads and material profiles v205",
    ], ["John-Lennon-Gymnasium: four-storey plaster street front v250", "Schools and courtyards v274"]);
    const placesBefore = keep(new Group()), placesCurrent = keep(new Group());
    old.append(placesBefore, "places", native); appendSchoolPlaceV205(placesCurrent, "places", native);
    project(find("Ackerhalle, Rosenthaler Platz and Otto-Weidt-Platz refinements v185"), placesBefore, placesCurrent, [],
      ["Choriner Höfe – street fronts: source-bound window heads and material profiles v205"], [], true);
    const northBefore = keep(old.north(native)), northCurrent = keep(createNorthV185(native));
    project(find(northCurrent.name), northBefore, northCurrent,
      ["kulturbrauerei", "hagenauer", "choriner"].map(kind => `North v185 ${kind}: source-bound shallow additions`));
    const edgesBefore = keep(old.edges(edges.cells, native)), edgesCurrent = keep(altMitteEdgesV186Batches(edges.cells, native));
    project(find(edgesCurrent.name), edgesBefore, edgesCurrent,
      ["1:1", "2:1", "2:2", "3:1", "3:2", "4:0", "6:-1"].map(cell => `Alt-Mitte source wall edge cell ${cell}`));
    return restore;
  } catch (error) { restore(); throw error; }
}
