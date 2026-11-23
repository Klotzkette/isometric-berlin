import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import type { LineSegments, Mesh } from "three";
import { createStreamedSurroundingCityChunkV255 } from "../src/SurroundingCity";
import { surroundingBuildingSolidAt, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import { admitSurveyedShellsV377, type ShellDataV377 } from "../src/surveyedBuildingShellsV377";
import shells from "../src/data/surveyedBuildingShellsV377.json";
import retirements from "../src/data/surveyedShellRetirementsV377.json";

const source = { shells, retirements } as ShellDataV377;
const directory = resolve(import.meta.dir, "../public/mesh/surrounding-berlin-v159");
const manifest: { chunks: { id: string; drawn: { url: string } }[] } = JSON.parse(readFileSync(resolve(directory, "manifest.json"), "utf8"));
function loadPacket(id: string): SurroundingCityChunk {
  const url = manifest.chunks.find(chunk => chunk.id === id)!.drawn.url;
  return JSON.parse(gunzipSync(readFileSync(resolve(directory, url))).toString("utf8"));
}

test("all four stepped buildings retire only their proved source faces and ink; camera collision follows low wings", async () => {
  const clearedWings = new Set<string>();
  const tops = new Map<string, number>();
  const lows = new Map<string, number>();
  let removedFaces = 0, removedInk = 0, roofFaces = 0;
  for (const [id, receipt] of Object.entries(source.retirements.packets)) {
    const packet = loadPacket(id);
    const result = await createStreamedSurroundingCityChunkV255(packet, id, false, { yield: async () => undefined });
    const group = result.root;
    try {
      expect(group.userData.surveyedShellOwnersV377).toEqual(receipt.owners);
      const body = group.children.find(child => child.name.endsWith("mapped surfaces and massing")) as Mesh;
      const ink = group.children.find(child => child.name.endsWith("ink lines")) as LineSegments;
      const index = body.geometry.index!;
      for (const record of receipt.records) {
        const offset = packet.meshes.slice(0, record.mesh).reduce((count, part) => count + Buffer.from(part.indices, "base64").byteLength / 4, 0);
        for (const face of record.triangles) {
          const p = offset + face * 3;
          expect(index.getX(p + 1)).toBe(index.getX(p));
          expect(index.getX(p + 2)).toBe(index.getX(p));
          removedFaces++;
        }
      }
      const ends = ink.geometry.getAttribute("position");
      for (const segment of receipt.segments) {
        const a = segment * 2, b = a + 1;
        expect([ends.getX(b), ends.getY(b), ends.getZ(b)]).toEqual([ends.getX(a), ends.getY(a), ends.getZ(a)]);
        removedInk++;
      }
      for (const range of group.userData.surveyedShellIndexRangesV377) {
        expect(range.count).toBeGreaterThan(range.roofIndexStart);
        const faces = (range.count - range.roofIndexStart) / 3;
        roofFaces += faces;
        const blocks = result.nav.buildings.filter(row => row.sourceId === range.owner);
        expect(blocks.every(row => row.roofTriangles?.length === faces)).toBe(true);
        const baseline = { ...packet.nav, buildings: packet.nav.buildings.filter(row => row.sourceId === range.owner) };
        const revised = { ...result.nav, buildings: blocks };
        const block = blocks[0], ground = result.nav.groundY + (block.groundOffset ?? 0);
        for (const [a, b, c] of block.roofTriangles!) {
          const x = (a[0] + b[0] + c[0]) / 3, z = (a[2] + b[2] + c[2]) / 3;
          const y = ground + (a[1] + b[1] + c[1]) / 3;
          tops.set(range.owner, Math.max(tops.get(range.owner) ?? -Infinity, y));
          lows.set(range.owner, Math.min(lows.get(range.owner) ?? Infinity, y));
          if (!clearedWings.has(range.owner) && surroundingBuildingSolidAt(revised, x, y - .2, z) &&
              !surroundingBuildingSolidAt(revised, x, y + 5, z) && surroundingBuildingSolidAt(baseline, x, y + 5, z)) {
            clearedWings.add(range.owner);
          }
        }
      }
    } finally { disposeSurroundingCityRoot(group); }
  }
  expect([removedFaces, removedInk, roofFaces]).toEqual([1776, 590, 1558]);
  expect(tops.size).toBe(4);
  expect([...clearedWings].sort()).toEqual([...tops.keys()].sort());
  for (const [id, high] of tops) expect(high - lows.get(id)!).toBeGreaterThan(10);
}, 30_000);

test("a changed body, changed ink or absent navigation owner preserves the old tile atomically", () => {
  const id = "4_5", packet = loadPacket(id), receipt = source.retirements.packets[id];
  const admitted = (chunk: SurroundingCityChunk) => {
    const steps = admitSurveyedShellsV377(chunk, id, source);
    for (;;) { const next = steps.next(); if (next.done) return next.value !== undefined; }
  };
  const change = (value: string) => (value[0] === "A" ? "B" : "A") + value.slice(1);
  expect(admitted(packet)).toBe(true);
  const changed = packet.meshes.map((part, index) => index === receipt.records[0].mesh ? { ...part, colors: change(part.colors) } : part);
  expect(admitted({ ...packet, meshes: changed })).toBe(false);
  expect(admitted({ ...packet, lines: { ...packet.lines!, positions: change(packet.lines!.positions) } })).toBe(false);
  expect(admitted({ ...packet, nav: { ...packet.nav, buildings: [] } })).toBe(false);
});
