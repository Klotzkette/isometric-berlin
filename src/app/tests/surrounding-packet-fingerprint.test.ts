import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { surroundingPacketFingerprint } from "../src/surroundingPacketFingerprint";
import { applyOuterMaterialsV232 } from "../src/outerMaterialsV232";
import type { AltMitteAppearanceSourceV213 } from "../src/altMitteAppearanceV213";

type Part = { positions: string; colors: string; indices: string };
function reference(part: Part): number {
  let value = 2166136261;
  for (const text of [part.positions, part.colors, part.indices])
    for (let at = 0; at < text.length; at++)
      value = Math.imul(value ^ text.charCodeAt(at), 16777619) >>> 0;
  return value;
}
function finish(iterator: Generator<void, number>): { value: number; yields: number } {
  let yields = 0, next = iterator.next();
  while (!next.done) { yields++; next = iterator.next(); }
  return { value: next.value, yields };
}

test("exact FNV receipt and cold checkpoints match the former guards", () => {
  for (const part of [
    { positions: "", colors: "", indices: "" },
    { positions: "AAECAw==", colors: "AP8A", indices: "AAAAAA==" },
    { positions: "ä𐀀".repeat(35_000), colors: "x".repeat(65_537), indices: "\u0000\uffff" },
  ]) {
    const cold = finish(surroundingPacketFingerprint(part));
    expect(cold.value).toBe(reference(part));
    expect(cold.yields).toBe([part.positions, part.colors, part.indices]
      .reduce((sum, text) => sum + Math.ceil(text.length / 65_536), 0));
    expect(finish(surroundingPacketFingerprint(part))).toEqual({ value: cold.value, yields: 0 });
    // Equal bytes in a new packet have a separate lifetime and do their own work.
    expect(finish(surroundingPacketFingerprint({ ...part })).yields).toBe(cold.yields);
  }
});

test("every changed source string invalidates a warm receipt", () => {
  const part = { positions: "positions", colors: "colors", indices: "indices" };
  finish(surroundingPacketFingerprint(part));
  for (const field of ["positions", "colors", "indices"] as const) {
    part[field] += "changed";
    const result = finish(surroundingPacketFingerprint(part));
    expect(result.yields).toBe(3);
    expect(result.value).toBe(reference(part));
  }
});

test("real drawn and native packet receipts retain the former hash values", () => {
  for (const id of ["3_-4", "8_-1", "outer187--22_-5"]) {
    for (const family of ["drawn", "minecraft"]) {
      const chunk = JSON.parse(gunzipSync(readFileSync(new URL(
        `../public/mesh/surrounding-berlin-v159/${id}.${family}.json.gz`, import.meta.url,
      ))).toString()) as { meshes: Part[] };
      for (const part of chunk.meshes) {
        const expected = reference(part);
        expect(finish(surroundingPacketFingerprint(part)).value).toBe(expected);
        expect(finish(surroundingPacketFingerprint(part))).toEqual({ value: expected, yields: 0 });
      }
    }
  }
});

test("cancellation and a mutation during a checkpoint cannot cache a partial or wrong receipt", () => {
  const part = { positions: "a".repeat(100_000), colors: "colors", indices: "indices" };
  const cancelled = surroundingPacketFingerprint(part);
  expect(cancelled.next().done).toBeFalse();
  cancelled.return(undefined as never);
  expect(finish(surroundingPacketFingerprint(part)).yields).toBe(4);

  part.colors = "new colors";
  const captured = { ...part };
  const pending = surroundingPacketFingerprint(part);
  expect(pending.next().done).toBeFalse();
  part.positions = "b".repeat(100_000);
  expect(finish(pending).value).toBe(reference(captured));
  const current = finish(surroundingPacketFingerprint(part));
  expect(current.yields).toBe(4);
  expect(current.value).toBe(reference(part));
});

test("a temporary kind adapter shares only the exact original encoded inputs", () => {
  const source = { positions: "AAAA", colors: "AAAA", indices: "AAAA" };
  finish(surroundingPacketFingerprint(source));
  const adapter = { ...source, kind: "alt-mitte-v169" };
  expect(finish(surroundingPacketFingerprint(adapter, source)).yields).toBe(0);
  adapter.colors = "AQAA";
  const changed = finish(surroundingPacketFingerprint(adapter, source));
  expect(changed.yields).toBe(3);
  expect(changed.value).toBe(reference(adapter));
  expect(finish(surroundingPacketFingerprint(source)).yields).toBe(3);
});

test("the real outer-material adapter keeps receipt rejection and colour output after source mutation", () => {
  const part = { kind: "city", positionType: "u16cm" as const,
    positions: "AAAA", colors: "AAAA", indices: "AAAA" };
  const runs = Buffer.from(new Uint32Array([0, 1, 0]).buffer).toString("base64");
  const evidence: AltMitteAppearanceSourceV213 = {
    schemaVersion: 1, palette: [0x123456],
    packets: { "drawn:probe": [{ mesh: 0, fingerprint: reference(part), runs }] },
  };
  finish(surroundingPacketFingerprint(part));
  const vertices = new Uint16Array([1, 2, 3, 0, 0, 0]);
  expect(finish(applyOuterMaterialsV232("probe", false, part, 0, vertices, 0, 1, evidence)).value).toBe(1);
  expect(Array.from(vertices)).toEqual([1, 2, 3, 0x12 * 257, 0x34 * 257, 0x56 * 257]);
  for (const field of ["positions", "colors", "indices"] as const) {
    const previous = part[field];
    part[field] = "AQAA";
    vertices.fill(0, 3);
    expect(finish(applyOuterMaterialsV232("probe", false, part, 0, vertices, 0, 1, evidence)).value).toBe(0);
    expect(Array.from(vertices.subarray(3))).toEqual([0, 0, 0]);
    part[field] = previous;
    expect(finish(applyOuterMaterialsV232("probe", false, part, 0, vertices, 0, 1, evidence)).value).toBe(1);
  }
});
