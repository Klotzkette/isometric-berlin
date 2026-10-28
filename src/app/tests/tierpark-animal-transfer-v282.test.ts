import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import receipt from '../src/data/tierparkAnimalTransferV282.json';
import source from '../src/data/tierparkV276.json';
import { transferTierparkAnimalsV282 } from '../src/tierparkAnimalTransferV282';
import type { SurroundingCityChunk, SurroundingPackedMesh } from '../src/SurroundingCityGeometry';

type EvidenceAnimal = { kind: string; sourceId: string; species: string; point: number[]; triangleRange: number[] };
const evidenceBytes = fs.readFileSync(new URL('../../../' + receipt.sourceEvidence, import.meta.url));
const evidence = JSON.parse(zlib.gunzipSync(evidenceBytes).toString()) as {
  records: { key: string; records: EvidenceAnimal[] }[];
};
const hash = (value: crypto.BinaryLike): string => crypto.createHash('sha256').update(value).digest('hex');
const id = 'outer187-20_4';
const fixture = (native: boolean): SurroundingCityChunk => {
  const packet = source.packets[(native ? 'minecraft:' : 'drawn:') + id as keyof typeof source.packets];
  return {
    schemaVersion: 1, origin: [...packet.origin],
    meshes: [{ kind: 'untouched-before', positionType: 'u16cm', positions: '', colors: '', indices: '' },
      { ...packet.mesh }, { kind: 'untouched-after', positionType: 'u16cm', positions: '', colors: '', indices: '' }],
    lines: { positions: '' },
    nav: { groundY: 3, ground: [], water: [], buildings: [], roads: [], bridges: [] },
  } as SurroundingCityChunk;
};
const records = (native: boolean): EvidenceAnimal[] => evidence.records
  .find(entry => entry.key === (native ? 'minecraft:' : 'drawn:') + id)!.records.filter(row => row.kind === 'animal');
const decoded = new WeakMap<SurroundingPackedMesh, { indices: Buffer; positions: Buffer; colors: Buffer }>();
const sourceTriangle = (mesh: SurroundingPackedMesh, origin: number[], triangle: number): { color: number; points: number[][] } => {
  let buffers = decoded.get(mesh);
  if (!buffers) {
    buffers = { indices: Buffer.from(mesh.indices, 'base64'), positions: Buffer.from(mesh.positions, 'base64'), colors: Buffer.from(mesh.colors, 'base64') };
    decoded.set(mesh, buffers);
  }
  const { indices, positions, colors } = buffers;
  const vertices = [0, 1, 2].map(corner => indices.readUInt32LE((triangle * 3 + corner) * 4));
  const color = colors.readUIntBE(vertices[0] * 3, 3);
  const points = vertices.map(vertex => [0, 1, 2].map(axis => origin[axis] + positions.readUInt16LE((vertex * 3 + axis) * 2) / 100));
  // Multiplication by .01 in the renderer can differ by one double ULP from /100.
  for (const point of points) for (let axis = 0; axis < 3; axis++) point[axis] = Math.round(point[axis] * 100) / 100;
  return { color, points };
};
const normalized = (color: number, points: number[][]): string => JSON.stringify({ color,
  points: points.map(point => point.map(value => Math.round(value * 100) / 100)) });

describe('exact Tierpark v282 animal-owner transfer', () => {
  test('receipt is bound to existing v276 sources and stays below 50 KB', () => {
    expect(hash(evidenceBytes)).toBe(receipt.sourceEvidenceSha256);
    expect(hash(fs.readFileSync(new URL('../src/data/tierparkV276.json', import.meta.url)))).toBe(receipt.sourceJsonSha256);
    expect(fs.statSync(new URL('../src/data/tierparkAnimalTransferV282.json', import.meta.url)).size).toBeLessThan(50_000);
    for (const native of [false, true]) {
      const family = native ? 'minecraft' : 'drawn', plan = receipt.families[family], old = fixture(native);
      expect(hash(JSON.stringify(old.meshes[1]))).toBe(plan.meshSha256);
      expect(plan.animals.map(row => ({ sourceId: row.sourceId, species: row.species, point: [row.anchor[0], row.anchor[2]], triangleRange: row.triangleRange })))
        .toEqual(records(native).map(({ sourceId, species, point, triangleRange }) => ({ sourceId, species, point, triangleRange })));
    }
  });

  test('both families partition all original triangle indices exactly, with no source mutation', () => {
    for (const native of [false, true]) {
      const old = fixture(native), before = JSON.stringify(old), rows = records(native);
      const result = transferTierparkAnimalsV282(old, id, native);
      expect(result.animals.length).toBe(47); expect(result.chunk).not.toBe(old);
      expect(result.chunk.origin).toBe(old.origin); expect(result.chunk.nav).toBe(old.nav);
      expect(result.chunk.lines).toBe(old.lines); expect(result.chunk.meshes[0]).toBe(old.meshes[0]);
      expect(result.chunk.meshes[2]).toBe(old.meshes[2]);
      const mesh = old.meshes[1], next = result.chunk.meshes[1];
      expect(next.positions).toBe(mesh.positions); expect(next.colors).toBe(mesh.colors);
      expect(next.kind).toBe(mesh.kind); expect(next.positionType).toBe(mesh.positionType);
      const original = Buffer.from(mesh.indices, 'base64'), remaining: Buffer[] = [], removed: Buffer[] = [];
      for (let triangle = 0; triangle < original.length / 12; triangle++) {
        const owned = rows.some(row => triangle >= row.triangleRange[0] && triangle < row.triangleRange[1]);
        (owned ? removed : remaining).push(original.subarray(triangle * 12, triangle * 12 + 12));
      }
      expect(Buffer.from(next.indices, 'base64')).toEqual(Buffer.concat(remaining));
      expect(removed.length + remaining.length).toBe(original.length / 12);
      expect(result.animals.reduce((n, animal) => n + animal.surfaces.reduce((m, surface) => m + surface.triangles.length, 0), 0)).toBe(removed.length);
      expect(JSON.stringify(old)).toBe(before);
      expect(transferTierparkAnimalsV282(result.chunk, id, native)).toEqual({ chunk: result.chunk, animals: [] });
    }
  });

  test('every transferred face retains exact source centimetres, order, winding and linear colour', () => {
    for (const native of [false, true]) {
      const old = fixture(native), rows = records(native), result = transferTierparkAnimalsV282(old, id, native);
      const counts = new Map<string, number>();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], animal = result.animals[i], ordinal = counts.get(row.species) ?? 0;
        counts.set(row.species, ordinal + 1);
        expect(animal.id).toBe(`tierpark-v276-${row.species}-${ordinal}`);
        expect(animal.anchor).toEqual([row.point[0], 3.12, row.point[1]]);
        expect(animal.heading).toBe(-(ordinal % 4) * Math.PI / 2);
        expect(animal.boxes).toEqual([]); expect(animal.linearColors).toBe(true);
        const expected: string[] = [];
        for (let t = row.triangleRange[0]; t < row.triangleRange[1]; t++) {
          const { color, points } = sourceTriangle(old.meshes[1], old.origin, t); expected.push(normalized(color, points));
        }
        const actual = animal.surfaces.flatMap(surface => surface.triangles.map(points => normalized(surface.color, points)));
        expect(actual.sort()).toEqual(expected.sort());
      }
      expect(Object.fromEntries(counts)).toEqual({ 'wood-bison': 7, 'bactrian-camel': 6, dromedary: 6, flamingo: 28 });
    }
  });

  test('wrong family, origin, bytes, topology and packet identity fail closed', () => {
    for (const native of [false, true]) {
      for (const field of ['kind', 'positionType', 'positions', 'colors', 'indices'] as const) {
        const old = fixture(native), mesh = old.meshes[1];
        (mesh as Record<string, string>)[field] = 'A' + mesh[field];
        const before = JSON.stringify(old), result = transferTierparkAnimalsV282(old, id, native);
        expect(result.chunk).toBe(old); expect(result.animals).toEqual([]); expect(JSON.stringify(old)).toBe(before);
      }
      for (const change of ['origin', 'ground', 'duplicate', 'missing', 'family', 'id', 'schema']) {
        const old = fixture(native);
        if (change === 'origin') old.origin[0] += .01;
        if (change === 'ground') old.nav.groundY += .01;
        if (change === 'duplicate') old.meshes.push(old.meshes[1]);
        if (change === 'missing') old.meshes.splice(1, 1);
        if (change === 'schema') (old as { schemaVersion: number }).schemaVersion = 2;
        const result = transferTierparkAnimalsV282(old, change === 'id' ? 'outer187-20_3' : id, change === 'family' ? !native : native);
        expect(result.chunk).toBe(old); expect(result.animals).toEqual([]);
      }
    }
  });
});
