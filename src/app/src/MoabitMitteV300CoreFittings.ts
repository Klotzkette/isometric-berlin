/** Actual-constructor predecessor receipts. No guessed grid or spatial blanket. */
import { BufferAttribute, Group, InstancedMesh, LineSegments } from "three";
import data from "./data/moabitMitteV300CoreFittingReceipts.json";
import { isMoabitMitteV300RetainedCore } from "./MoabitMitteV300Ownership";
type Batch = { kind: string; name: string; records: number[][] };
type Family = { kind: string; receipts: { owner: string; sourceRetired: boolean; batches: Batch[] }[] };
const source = data as { schemaVersion: number; families: Family[] };
const key = (a: ArrayLike<number>, start: number, length: number) => Array.from({ length }, (_, i) => a[start + i]).join(",");
type Options = { sourceBodiesFiltered?: boolean; buildings?: readonly unknown[] };
export type CoreFittingRetirementV300 = { lineSegments: number; instances: number; apply: () => boolean };
/** Source body filtering already prevents every old fallback's own fittings.
 * Only exact remaining fronts on retained measured bodies need a transaction. */
export function prepareMoabitMitteV300CoreFittingRetirement(root: Group, options: Options = {}): CoreFittingRetirementV300 | undefined {
  return prepare(root, "moabit-mitte-v300", options.sourceBodiesFiltered === true, options.buildings);
}
export function prepareWestKiezV302CoreFittingRetirement(root: Group, options: Options = {}): CoreFittingRetirementV300 | undefined {
  return prepare(root, "west-kiez-v302", options.sourceBodiesFiltered === true, options.buildings);
}
function prepare(root: Group, family: string, filtered: boolean, buildings?: readonly unknown[]): CoreFittingRetirementV300 | undefined {
  if (source.schemaVersion !== 1 || !filtered) return undefined;
  const selected = source.families.find(f => f.kind === family); if (!selected) return undefined;
  let active: Set<string> | undefined;
  if (buildings) {
    const targetIds = new Set(selected.receipts.map(r => r.owner)); active = new Set();
    for (const part of buildings) {
      if (!part || typeof part !== "object") continue;
      const descriptor = Object.getOwnPropertyDescriptor(part, "id"), id = descriptor && "value" in descriptor ? descriptor.value : undefined;
      if (typeof id !== "string" || !targetIds.has(id)) continue;
      if (active.has(id) || !isMoabitMitteV300RetainedCore(part)) return undefined;
      active.add(id);
    }
  }
  const wanted = new Map<string, { kind: string; records: Map<string, number> }>();
  for (const receipt of selected.receipts) {
    if (active && !active.has(receipt.owner)) continue;
    if (filtered && receipt.sourceRetired) continue;
    for (const batch of receipt.batches) {
      const state = wanted.get(batch.name) ?? { kind: batch.kind, records: new Map<string, number>() };
      if (state.kind !== batch.kind) return undefined;
      for (const record of batch.records) { const k = record.join(","); state.records.set(k, (state.records.get(k) ?? 0) + 1); }
      wanted.set(batch.name, state);
    }
  }
  let lines = 0, instances = 0;
  const guards: (() => boolean)[] = [], edits: (() => void)[] = [];
  const objects = new Map<string, (LineSegments | InstancedMesh)[]>();
  root.traverse(o => { if (wanted.has(o.name) && (o instanceof LineSegments || o instanceof InstancedMesh)) { const list = objects.get(o.name) ?? []; list.push(o); objects.set(o.name, list); } });
  for (const [name, state] of wanted) {
    const total = [...state.records.values()].reduce((n, count) => n + count, 0); if (!total) continue;
    const choices = objects.get(name); if (!choices || choices.length !== 1) return undefined;
    const object = choices[0], geometry = object.geometry;
    if (state.kind === "lines") {
      if (!(object instanceof LineSegments)) return undefined;
      const position = geometry.getAttribute("position") as BufferAttribute, distance = geometry.getAttribute("lineDistance") as BufferAttribute;
      if (!position || !distance || position.count % 2 || distance.count !== position.count || geometry.index) return undefined;
      const p = position.array, d = distance.array, found: number[] = [];
      for (let at = 0; at < position.count; at += 2) { const k = key(p, at * 3, 6) + "," + d[at] + "," + d[at + 1]; const need = state.records.get(k) ?? 0; if (need) { state.records.set(k, need - 1); found.push(at); } }
      if (state.records.size && [...state.records.values()].some(n => n !== 0) || found.length !== total) return undefined;
      guards.push(() => object.geometry === geometry && geometry.getAttribute("position") === position && geometry.getAttribute("lineDistance") === distance && position.array === p && distance.array === d && found.every(at => key(p, at * 3, 6) + "," + d[at] + "," + d[at + 1] === snapshots.get(at)));
      const snapshots = new Map(found.map(at => [at, key(p, at * 3, 6) + "," + d[at] + "," + d[at + 1]]));
      edits.push(() => { for (const at of found) { for (let axis = 0; axis < 3; axis++) position.setComponent(at + 1, axis, position.getComponent(at, axis)); } position.needsUpdate = true; }); lines += found.length;
    } else if (state.kind === "instances") {
      if (!(object instanceof InstancedMesh)) return undefined;
      const attribute = object.instanceMatrix, matrix = attribute.array, count = object.count, found: number[] = [];
      for (let at = 0; at < count; at++) { const k = key(matrix, at * 16, 16), need = state.records.get(k) ?? 0; if (need) { state.records.set(k, need - 1); found.push(at); } }
      if ([...state.records.values()].some(n => n !== 0) || found.length !== total) return undefined;
      const snapshots = new Map(found.map(at => [at, key(matrix, at * 16, 16)]));
      guards.push(() => object.geometry === geometry && object.instanceMatrix === attribute && attribute.array === matrix && object.count === count && found.every(at => key(matrix, at * 16, 16) === snapshots.get(at)));
      // A zero basis leaves the source translation and every unrelated matrix
      // byte intact. No material, shared primitive or instance colour changes.
      edits.push(() => { for (const at of found) for (let axis = 0; axis < 12; axis++) matrix[at * 16 + axis] = 0; attribute.needsUpdate = true; }); instances += found.length;
    } else return undefined;
  }
  let applied = false;
  return { lineSegments: lines, instances, apply: () => { if (applied || !guards.every(g => g())) return false; for (const edit of edits) edit(); applied = true; return true; } };
}
