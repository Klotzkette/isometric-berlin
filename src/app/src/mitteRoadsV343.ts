import {
  BufferAttribute, BufferGeometry, DoubleSide, Group, LineBasicMaterial,
  LineSegments, Mesh, MeshBasicMaterial,
} from "three";
import data from "./data/mitteRoadsV343.json";
import canonicalStreets from "./data/districtStreets.json";
import realm from "./data/reichstagPublicRealmV256.json";
import type { StreetSource } from "./DistrictStreets";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number];
type Kind = StreetSource["surfaces"][number]["kind"];
type EncodedSurface = { positions_cm_b64: string; indices_b64: string };
type Receipt = [number, number[], number[][]];
type Payload = {
  schemaVersion: number;
  sourceSha256: string;
  surfacePatches: { kind: Kind; positionLength: number; indexLength: number; faces: Receipt[] }[];
  curbReplacements: { index: number; original: Point[]; replacement: Point[][] }[];
  supplement: StreetSource;
  surfaces: (EncodedSurface & { layer: string; material: string; color: number; lift: number })[];
  seams: Point[][];
  kerbSeams: Point[][];
  jointReplacements: { index: number; original: number[] }[];
};

export type MitteRoadTransactionV343 = {
  surfaceRemovals: Map<Kind, ReadonlySet<number>>;
  curbReplacements: Map<number, Point[][]>;
  supplement: StreetSource;
  payload: Payload;
  jointRemovals: ReadonlySet<number>;
};

function wordAt(bytes: string, offset: number): number {
  return bytes.charCodeAt(offset) | bytes.charCodeAt(offset + 1) << 8 |
    bytes.charCodeAt(offset + 2) << 16 | bytes.charCodeAt(offset + 3) << 24;
}

/**
 * Admit only complete, unchanged indexed faces and kerb owners. All their
 * outside fragments are already compiled in the supplement. A stale or
 * partial owner rejects the entire transaction, retaining the old streets.
 * Decoded original strings are temporary, never cached alongside the city.
 */
export function getMitteRoadTransactionV343(
  streets: StreetSource, candidate: unknown = data,
): MitteRoadTransactionV343 | null {
  try {
    const payload = candidate as Payload;
    if (payload.schemaVersion !== 1 || !payload.surfacePatches.length || !payload.surfaces.length ||
        !payload.supplement?.surfaces.length || !payload.supplement.curbs_m.length) return null;
    const surfaceRemovals = new Map<Kind, ReadonlySet<number>>();
    for (const patch of payload.surfacePatches) {
      if (surfaceRemovals.has(patch.kind) || !patch.faces.length) return null;
      const originals = streets.surfaces.filter(surface => surface.kind === patch.kind);
      if (originals.length !== 1) return null;
      const original = originals[0];
      if (original.positions_cm_b64.length !== patch.positionLength ||
          original.indices_b64.length !== patch.indexLength) return null;
      const positions = atob(original.positions_cm_b64), indices = atob(original.indices_b64);
      const ordinals = new Set<number>();
      for (const [ordinal, ids, points] of patch.faces) {
        if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal * 12 + 12 > indices.length ||
            ordinals.has(ordinal) || ids.length !== 3 || points.length !== 3) return null;
        for (let vertex = 0; vertex < 3; vertex++) {
          const id = wordAt(indices, ordinal * 12 + vertex * 4) >>> 0;
          if (id !== ids[vertex] || id * 8 + 8 > positions.length || points[vertex].length !== 2 ||
              wordAt(positions, id * 8) !== points[vertex][0] ||
              wordAt(positions, id * 8 + 4) !== points[vertex][1]) return null;
        }
        ordinals.add(ordinal);
      }
      surfaceRemovals.set(patch.kind, ordinals);
    }
    const curbReplacements = new Map<number, Point[][]>();
    for (const row of payload.curbReplacements) {
      if (curbReplacements.has(row.index)) return null;
      const original = streets.curbs_m[row.index];
      if (!original || original.length !== row.original.length) return null;
      if (!original.every((p, n) => p.length === 2 &&
          p[0] === row.original[n][0] && p[1] === row.original[n][1])) return null;
      curbReplacements.set(row.index, row.replacement);
    }
    const jointRemovals = new Set<number>();
    for (const row of payload.jointReplacements) {
      const original = realm.boxes[row.index];
      if (row.index < realm.counts.drawnFountainMembers || jointRemovals.has(row.index) ||
          !original || original.length !== row.original.length ||
          !original.every((v, n) => v === row.original[n])) return null;
      jointRemovals.add(row.index);
    }
    return { surfaceRemovals, curbReplacements, supplement: payload.supplement, payload, jointRemovals };
  } catch {
    return null;
  }
}

// Both the earlier Hbf batch and later street mesh use this one decision.
// Generic callers and tests use the pure guard above.
let canonicalTransaction: MitteRoadTransactionV343 | null | undefined;
export function canonicalMitteRoadTransactionV343(): MitteRoadTransactionV343 | null {
  if (canonicalTransaction === undefined) {
    canonicalTransaction = getMitteRoadTransactionV343(canonicalStreets as unknown as StreetSource);
  }
  return canonicalTransaction;
}

function surfaceGeometry(surface: EncodedSurface, terrainAt: (x: number, z: number) => number,
  lift: number): BufferGeometry {
  const packed = atob(surface.positions_cm_b64);
  const positions = new Float32Array(packed.length / 8 * 3);
  for (let offset = 0, n = 0; offset < packed.length; offset += 8) {
    const x = wordAt(packed, offset) / 100, z = wordAt(packed, offset + 4) / 100;
    positions[n++] = x; positions[n++] = terrainAt(x, z) + lift; positions[n++] = z;
  }
  const packedIndices = atob(surface.indices_b64);
  const indices = new Uint32Array(packedIndices.length / 4);
  for (let offset = 0; offset < packedIndices.length; offset += 4) {
    indices[offset / 4] = wordAt(packedIndices, offset) >>> 0;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Surveyed asphalt/cobble/stone/gravel distinction; no texture downloads. */
export function createMitteRoadDetailsV343(
  terrainAt: (x: number, z: number) => number, transaction: MitteRoadTransactionV343,
): Group {
  const group = new Group();
  group.name = "Surveyed Paul-Löbe and Heinrich-von-Gagern streets v343";
  group.userData.sourceGeometry = { sourceSha256: transaction.payload.sourceSha256,
    surface: "Geoportal Berlin street survey; 2025 orthophoto / owner-photo comparison" };
  for (const surface of transaction.payload.surfaces) {
    const day = new MeshBasicMaterial({ color: surface.color, side: DoubleSide });
    const night = new MeshBasicMaterial({ color: surface.layer === "road" ? 0x171c22 : 0x252932, side: DoubleSide });
    const mesh = new Mesh(surfaceGeometry(surface, terrainAt, surface.lift), day);
    mesh.name = `Mitte surveyed ${surface.layer} material ${surface.material}`;
    mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
    mesh.userData.staticAntiFlicker = true;
    group.add(mesh);
  }
  let count = 0;
  const jointLines = [...transaction.payload.seams.map(line => ({ line, lift: .325 })),
    ...transaction.payload.kerbSeams.map(line => ({ line, lift: .323 }))];
  for (const { line } of jointLines) count += Math.max(0, line.length - 1) * 6;
  const positions = new Float32Array(count);
  let cursor = 0;
  for (const { line, lift } of jointLines) for (let i = 1; i < line.length; i++) {
    for (const [x, z] of [line[i - 1], line[i]]) {
      positions[cursor++] = x; positions[cursor++] = terrainAt(x, z) + lift; positions[cursor++] = z;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new LineBasicMaterial({ color: 0x928f85, transparent: true, opacity: .4 });
  const night = new LineBasicMaterial({ color: 0x171c22, transparent: true, opacity: .4 });
  const seams = new LineSegments(geometry, day);
  seams.name = "Natural-stone slab and surveyed kerb joints";
  seams.userData.dayMaterial = day; seams.userData.nightMaterial = night;
  seams.userData.staticAntiFlicker = true;
  group.add(seams);
  freezeStaticSceneTransforms(group);
  return group;
}
