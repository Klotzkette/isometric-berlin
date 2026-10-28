import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { InstancedBufferAttribute, InstancedMesh, type Group } from "three";
import { preparePrismContainment } from "../src/preparedPrismContainment";
import { createEuropacityArchitecture, planEuropacityArchitecture } from "../src/EuropacityArchitecture";
import { createRohwedderHausArchitecture, planRohwedderHaus } from "../src/RohwedderHausArchitecture";
import { EUROPACITY_ARCHITECTURE_SOURCE } from "../src/europacityArchitectureProfile";
import { ROHWEDDER_HAUS_SOURCE } from "../src/rohwedderHausProfile";
import { geometryHash } from "../scripts/benchmark-facade-occlusion-v177";
import fingerprints from "./facade-occlusion-v176-fingerprints.json";
import coreAudit from "./fixtures/core-material-native-v281-audit.json";
import { replaySourceV281 } from "./helpers/coreMaterialV281";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxels from "../public/mesh/regierungsviertel/minecraft-voxels.json";

type Outline = { ring: number[][]; holes?: number[][][] };

// Geometry hashing below retains its original v176 byte contract, including
// complete ArrayBuffers. Compact only the actual retained rows into test buffers;
// do not rebuild their matrices from the planner or change the production root.
function retainedRohwedderView(root: Group, keep: readonly boolean[]): Group {
  expect(root.children).toHaveLength(1);
  const mesh = root.children[0] as InstancedMesh;
  expect(mesh).toBeInstanceOf(InstancedMesh); expect(mesh.count).toBe(keep.length);
  const count = keep.filter(Boolean).length, matrices = new Float32Array(count * 16), colours = new Float32Array(count * 3);
  let cursor = 0;
  keep.forEach((retained, i) => {
    if (!retained) return;
    matrices.set(mesh.instanceMatrix.array.subarray(i * 16, i * 16 + 16), cursor * 16);
    colours.set(mesh.instanceColor!.array.subarray(i * 3, i * 3 + 3), cursor * 3); cursor++;
  });
  const view = Object.create(mesh) as InstancedMesh;
  view.count = count; view.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  view.instanceColor = new InstancedBufferAttribute(colours, 3);
  return { traverse: (visit: (object: unknown) => void) => root.traverse(object => visit(object === mesh ? view : object)) } as unknown as Group;
}
// The v1.0.76 predicate is retained as an independent boundary oracle.
function legacyContains(part: Outline, x: number, z: number) {
  function inRing(ring: number[][], x: number, z: number): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, az] = ring[i], [bx, bz] = ring[j];
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    }
    return inside;
  }
  return inRing(part.ring, x * 10, z * 10) && !(part.holes ?? []).some(h => inRing(h, x * 10, z * 10));
}

describe("construction-scoped facade containment", () => {
  test("v281 screen fittings retain the complete independently audited older Rohwedder source", () => {
    const receipt = coreAudit.sourceReplay.find(r => r.path === "src/app/src/RohwedderHausArchitecture.ts")!;
    expect(receipt).toBeDefined();
    expect(() => replaySourceV281(readFileSync(new URL(`../../../${receipt.path}`, import.meta.url), "utf8"), receipt)).not.toThrow();
  });
  test("preserves source vertices, edge midpoints, nearby points and courtyard holes", () => {
    const parts: Outline[] = [...EUROPACITY_ARCHITECTURE_SOURCE.prisms, ...ROHWEDDER_HAUS_SOURCE.buildings, ...ROHWEDDER_HAUS_SOURCE.occluders];
    let samples = 0;
    for (const part of parts) {
      const prepared = preparePrismContainment(part);
      for (const ring of [part.ring, ...(part.holes ?? [])]) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        for (const t of [0, .5, 1]) for (const delta of [-1e-9, 0, 1e-9]) {
          const x = (a[0] + (b[0] - a[0]) * t) / 10 + delta;
          const z = (a[1] + (b[1] - a[1]) * t) / 10 + delta;
          expect(prepared(x, z)).toBe(legacyContains(part, x, z));
          samples++;
        }
      }
    }
    expect(samples).toBeGreaterThan(10000);
  });

  test("preserves concave, reversed, repeated-vertex and empty rings", () => {
    const ring = [[0, 0], [120, 0], [120, 90], [50, 30], [0, 90], [0, 0]];
    const hole = [[20, 20], [40, 20], [40, 40], [20, 40]];
    for (const part of [{ring, holes: [hole]}, {ring: ring.toReversed(), holes: [hole.toReversed()]}, {ring: []}]) {
      const prepared = preparePrismContainment(part);
      for (let x = -1; x <= 13; x += .25) for (let z = -1; z <= 10; z += .25) expect(prepared(x, z)).toBe(legacyContains(part, x, z));
    }
  });

  // Frozen before the optimization: this covers every block's full-precision
  // placement/role/colour and every final geometry, instance and material byte.
  for (const expected of fingerprints) test(`${expected.name} minecraft=${expected.minecraft} mobile=${expected.mobileLike} exactly preserves v1.0.76`, () => {
    const options = { minecraft: expected.minecraft, mobileLike: expected.mobileLike, voxels, sourcePrisms: prisms.buildings };
    const plan = expected.name === "europacity" ? planEuropacityArchitecture(options) : planRohwedderHaus(prisms, options);
    const keep = plan.map(row => expected.name !== "rohwedder" ||
      !(row.sourceId === ROHWEDDER_HAUS_SOURCE.entranceFence.osm && ["v281 screen metal edge", "v281 lower gate medallion"].includes(row.role)));
    const retained = plan.filter((_, i) => keep[i]);
    expect(plan.length - retained.length).toBe(expected.name === "rohwedder" ? expected.minecraft ? 99 : 348 : 0);
    expect(retained.length).toBe(expected.count);
    expect(createHash("sha256").update(JSON.stringify(retained)).digest("hex")).toBe(expected.blockHash);
    const root = expected.name === "europacity" ? createEuropacityArchitecture(options) : createRohwedderHausArchitecture(prisms, options);
    expect(geometryHash(expected.name === "rohwedder" ? retainedRohwedderView(root, keep) : root)).toBe(expected.geometryHash);
  });
});
