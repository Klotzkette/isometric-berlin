import { BufferAttribute, Group, InstancedMesh, LineSegments } from "three";
import { isMoabitMitteV300RetainedCore } from "./MoabitMitteV300Ownership";

/** One independently replayed V8 construction result of the same retained
 * source edge. Both complete Float32 tuples are exact, never a tolerance. */
const original = Object.freeze([-465.9246826171875, 6.400000095367432, -1082.584716796875,
  -465.9246826171875, 21.503223419189453, -1082.584716796875, 0, 0]);
const alternate = Object.freeze([-465.9246826171875, 6.400000095367432, -1082.584716796875,
  -465.9246826171875, 21.50322151184082, -1082.584716796875, 0, 0]);
const originalStrip = Object.freeze([-.2610611617565155,0,.10122779756784439,0,0,15.10322380065918,0,0,
  .36152786016464233,0,.9323613047599792,0,-465.9246826171875,13.951611518859863,-1082.584716796875,1]);
const alternateStrip = Object.freeze([-.2610611617565155,0,.10122779756784439,0,0,15.103221893310547,0,0,
  .36152786016464233,0,.9323613047599792,0,-465.9246826171875,13.951610565185547,-1082.584716796875,1]);
const owner = "sN3KUQ9U", batch = "LoD2 facade axes", stripBatch = "LoD2 facade night strips";
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v,i) => Object.is(v,b[i]));
export type MoabitFittingRecordVariantV319 = (owner: string, kind: string, name: string, record: readonly number[]) => readonly number[];

/** Used only after the unchanged original transaction failed. The exact full
 * old receipt, actual source owner and unique paired alternate rows must survive.
 * The original geometry is never rewritten into another engine's coordinates. */
export function moabitCoreFittingVariantV319(
  root: Group, buildings: readonly unknown[] | undefined, originalReceipts: unknown,
): MoabitFittingRecordVariantV319 | undefined {
  let control = 2166136261;
  for (const byte of new TextEncoder().encode(JSON.stringify(originalReceipts))) control = Math.imul(control ^ byte, 16777619) >>> 0;
  if (control !== 3229484024 || !buildings) return undefined;
  const selected = buildings.filter(p => {
    if (!p || typeof p !== "object") return false;
    const d = Object.getOwnPropertyDescriptor(p,"id");return d && "value" in d && d.value === owner;
  });
  if (selected.length !== 1 || !isMoabitMitteV300RetainedCore(selected[0])) return undefined;
  const choices: LineSegments[] = [], strips: InstancedMesh[] = [];
  root.traverse(o => {
    if (o instanceof LineSegments && o.name === batch) choices.push(o);
    if (o instanceof InstancedMesh && o.name === stripBatch) strips.push(o);
  });
  if (choices.length !== 1 || strips.length !== 1) return undefined;
  const geometry = choices[0].geometry, position = geometry.getAttribute("position"), distance = geometry.getAttribute("lineDistance");
  if (!(position instanceof BufferAttribute) || !(distance instanceof BufferAttribute) ||
    !(position.array instanceof Float32Array) || !(distance.array instanceof Uint16Array) ||
    position.itemSize !== 3 || distance.itemSize !== 1 || position.count % 2 || distance.count !== position.count || geometry.index) return undefined;
  let canonical = 0, alternative = 0;
  for (let i = 0; i < position.count; i += 2) {
    const row = [...position.array.subarray(i*3,i*3+6),distance.getX(i),distance.getX(i+1)];
    if (same(row,original)) canonical++;
    if (same(row,alternate)) alternative++;
  }
  if (canonical !== 0 || alternative !== 1) return undefined;
  const strip = strips[0], matrix = strip.instanceMatrix;
  if (!(matrix.array instanceof Float32Array) || matrix.itemSize !== 16 || matrix.count < strip.count) return undefined;
  let canonicalStrip = 0, alternativeStrip = 0;
  for (let i = 0; i < strip.count; i++) {
    const row = Array.from(matrix.array.subarray(i*16,i*16+16));
    if (same(row,originalStrip)) canonicalStrip++;
    if (same(row,alternateStrip)) alternativeStrip++;
  }
  // Do not admit a synthetic hybrid of the two actual engine constructions.
  if (canonicalStrip !== 0 || alternativeStrip !== 1) return undefined;
  return (sourceOwner,kind,name,record) => {
    if (sourceOwner !== owner) return record;
    if (kind === "lines" && name === batch && same(record,original)) return alternate;
    if (kind === "instances" && name === stripBatch && same(record,originalStrip)) return alternateStrip;
    return record;
  };
}
