import {
  BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Group,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
} from "three";
import source from "./data/districtStreets.json";
import { smoothGroundTopSampler, type VoxelPayload } from "./MinecraftVoxelWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number];
const SURFACE_STYLES = {
  asphalt: { name: "District asphalt carriageways", day: 0x858d89, night: 0x171c22, lift: 0.18 },
  paving: { name: "District mapped paved walkways", day: 0xd4d0c3, night: 0x252932, lift: 0.1 },
  sidewalk: { name: "Brandenburg approach raised sidewalks", day: 0xd4d0c3, night: 0x252932, lift: 0.32 },
  gravel: { name: "Unter den Linden mapped gravel promenade", day: 0xd9c9a6, night: 0x241f19, lift: 0.3 },
  // The plaza's authored flowerbeds/lawn plates already stand above this base.
  grass: { name: "Brandenburg approach mapped lawns", day: 0x8eab79, night: 0x24352b, lift: 0.035 },
} as const;
export type StreetSource = {
  source: Record<string, unknown>;
  surfaces: { kind: keyof typeof SURFACE_STYLES; positions_cm_b64: string; indices_b64: string }[];
  curbs_m: Point[][];
  elevated_path_ids: string[];
  markings_m: { points: Point[]; width_m: number; lanes?: number | null }[];
};

const streets = source as unknown as StreetSource;
// Keep source ownership lazy: helpers used by the building Worker must not
// instantiate and retain this main-scene street payload in a second realm.
let elevatedPaths: Set<string> | undefined;

export function districtPathMayFollowTerrain(id: string): boolean {
  elevatedPaths ??= new Set(streets.elevated_path_ids);
  return !elevatedPaths.has(id.replace(/^way[/:]/, "").split(":")[0]);
}
export const DISTRICT_STREET_LIFT_M = 0.18;
export const DISTRICT_KERB_RISE_M = 0.14;
const KERB_HALF_WIDTH_M = 0.11;

export function districtStreetTerrainSampler(ground: VoxelPayload): (x: number, z: number) => number {
  const sample = smoothGroundTopSampler(ground);
  const { cell_m: cell, grid: { min_x_idx: minX, min_z_idx: minZ } } = ground;
  return (x, z) => sample(
    x / cell - minX,
    z / cell - minZ,
  );
}

type StreetIndexArray = Uint16Array | Uint32Array;

/** Decode directly from the byte string; do not retain a second byte buffer. */
function wordAt(text: string, offset: number): number {
  return (text.charCodeAt(offset) | text.charCodeAt(offset + 1) << 8 |
    text.charCodeAt(offset + 2) << 16 | text.charCodeAt(offset + 3) << 24);
}

function decodeSurfacePositions(
  base64: string, terrainAt: (x: number, z: number) => number, lift: number,
): Float32Array {
  const text = atob(base64);
  if (text.length % 8 !== 0) throw new Error("Invalid district street position payload");
  const result = new Float32Array(text.length / 8 * 3);
  for (let offset = 0, target = 0; offset < text.length; offset += 8) {
    // Keep centimetres as doubles until terrain sampling has finished. Rounding
    // x/z to float32 first would subtly change the road's sampled height.
    const x = wordAt(text, offset) / 100;
    const z = wordAt(text, offset + 4) / 100;
    result[target++] = x;
    result[target++] = terrainAt(x, z) + lift;
    result[target++] = z;
  }
  return result;
}

function decodeSurfaceIndices(base64: string): StreetIndexArray {
  const text = atob(base64);
  if (text.length % 4 !== 0) throw new Error("Invalid district street index payload");
  let wide = false;
  for (let offset = 0; offset < text.length; offset += 4) {
    // Match BufferGeometry.setIndex, including WebGL's reserved restart index.
    if ((wordAt(text, offset) >>> 0) >= 65535) { wide = true; break; }
  }
  const result = wide ? new Uint32Array(text.length / 4) : new Uint16Array(text.length / 4);
  for (let offset = 0; offset < text.length; offset += 4) {
    result[offset / 4] = wordAt(text, offset) >>> 0;
  }
  return result;
}

function geometry(positions: number[] | Float32Array): BufferGeometry {
  const result = new BufferGeometry();
  result.setAttribute("position", positions instanceof Float32Array
    ? new BufferAttribute(positions, 3) : new Float32BufferAttribute(positions, 3));
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

/**
 * Small, offline-triangulated OSM street network, resident in the first frame
 * on both pointer profiles. No whole-city polygon union, Worker round trip,
 * lower-detail replacement or camera-dependent disappearance is necessary.
 */
export function createDistrictStreets(ground: VoxelPayload, excludedMarkings: ReadonlySet<number> = new Set()): Group {
  return createSourceStreetSurfaces(ground, streets, "District streets and roadside paths", excludedMarkings);
}

export function createSourceStreetSurfaces(ground: VoxelPayload, streets: StreetSource, name: string, excludedMarkings: ReadonlySet<number> = new Set()): Group {
  const group = new Group();
  group.name = name;
  group.userData.sourceGeometry = streets.source;
  const terrainAt = districtStreetTerrainSampler(ground);
  const addSurface = (name: string, positions: Float32Array, day: number, night: number, indices?: StreetIndexArray): void => {
    if (!positions.length) return;
    const dayMaterial = new MeshBasicMaterial({ color: day, side: DoubleSide });
    const nightMaterial = new MeshBasicMaterial({ color: night, side: DoubleSide });
    const mesh = new Mesh(geometry(positions), dayMaterial);
    if (indices) mesh.geometry.setIndex(new BufferAttribute(indices, 1));
    mesh.name = name;
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.userData.staticAntiFlicker = true;
    group.add(mesh);
  };
  for (const surface of streets.surfaces) {
    const style = SURFACE_STYLES[surface.kind];
    addSurface(
      style.name, decodeSurfacePositions(surface.positions_cm_b64, terrainAt, style.lift),
      style.day, style.night, decodeSurfaceIndices(surface.indices_b64),
    );
  }

  // The complete offline path inventory gives exact capacities. Writing its
  // final attributes directly avoids millions of temporary boxed numbers and
  // oversized growing arrays during the mobile startup peak.
  let pointCount = 0, segmentCount = 0, maxCurbIndex = 0;
  for (const line of streets.curbs_m) {
    pointCount += line.length;
    segmentCount += Math.max(0, line.length - 1);
    if (line.length >= 2) maxCurbIndex = pointCount * 4 - 1;
  }
  const curbs = new Float32Array(pointCount * 12);
  const curbIndices = maxCurbIndex >= 65535
    ? new Uint32Array(segmentCount * 18) : new Uint16Array(segmentCount * 18);
  const ink = new Float32Array(segmentCount * 6);
  let curbCursor = 0, indexCursor = 0, inkCursor = 0;
  // Four shared vertices per boundary point, instead of eighteen duplicated
  // vertices per segment. Real 22cm kerb top and both upstand faces remain.
  for (const line of streets.curbs_m) {
    const offset = curbCursor / 3;
    for (let i = 0; i < line.length; i += 1) {
      const [x, z] = line[i];
      const [ax, az] = line[Math.max(0, i - 1)];
      const [bx, bz] = line[Math.min(line.length - 1, i + 1)];
      const length = Math.hypot(bx - ax, bz - az) || 1;
      const nx = -(bz - az) / length * KERB_HALF_WIDTH_M;
      const nz = (bx - ax) / length * KERB_HALF_WIDTH_M;
      const base = terrainAt(x, z) + DISTRICT_STREET_LIFT_M;
      const top = base + DISTRICT_KERB_RISE_M;
      curbs.set([x-nx, base, z-nz, x+nx, base, z+nz,
        x-nx, top, z-nz, x+nx, top, z+nz], curbCursor);
      curbCursor += 12;
      if (i === 0) continue;
      const a = offset + (i - 1) * 4, b = offset + i * 4;
      curbIndices.set([a,b,b+2, a,b+2,a+2, a+3,b+3,b+1, a+3,b+1,a+1,
        a+2,b+2,b+3, a+2,b+3,a+3], indexCursor);
      indexCursor += 18;
      ink.set([ax, terrainAt(ax, az) + DISTRICT_STREET_LIFT_M + DISTRICT_KERB_RISE_M + 0.008, az,
        x, top + 0.008, z], inkCursor);
      inkCursor += 6;
    }
  }
  addSurface("District raised kerbstones", curbs, 0xd8d5c9, 0x30343b, curbIndices);
  const addLines = (name: string, positions: number[] | Float32Array, day: number, night: number): void => {
    if (!positions.length) return;
    const dayMaterial = new LineBasicMaterial({ color: day });
    const nightMaterial = new LineBasicMaterial({ color: night });
    const lines = new LineSegments(geometry(positions), dayMaterial);
    lines.name = name;
    lines.userData.dayMaterial = dayMaterial;
    lines.userData.nightMaterial = nightMaterial;
    lines.userData.staticAntiFlicker = true;
    lines.renderOrder = 2;
    group.add(lines);
  };
  addLines("District kerb ink", ink, 0x6d756b, 0x11171c);
  const markings: number[] = [];
  for (const [markingIndex, marking] of streets.markings_m.entries()) {
    if (excludedMarkings.has(markingIndex)) continue;
    const line = marking.points;
    const lanes = Math.round(marking.lanes ?? 2);
    if (lanes < 2) continue;
    for (let lane = 1; lane < lanes; lane += 1) {
      const offset = marking.width_m * (lane / lanes - 0.5);
      // Shared offset vertices keep dividers joined around the Großer Stern;
      // independent segment normals leave a comb of short disconnected dashes.
      const shifted: Point[] = line.map(([x, z], i) => {
        const prev = line[Math.max(0, i - 1)], next = line[Math.min(line.length - 1, i + 1)];
        const before = Math.hypot(x - prev[0], z - prev[1]) || 1;
        const after = Math.hypot(next[0] - x, next[1] - z) || 1;
        let nx = -(z - prev[1]) / before - (next[1] - z) / after;
        let nz = (x - prev[0]) / before + (next[0] - x) / after;
        const length = Math.hypot(nx, nz) || 1;
        nx /= length; nz /= length;
        const dx = i + 1 < line.length ? (next[0] - x) / after : (x - prev[0]) / before;
        const dz = i + 1 < line.length ? (next[1] - z) / after : (z - prev[1]) / before;
        const miter = offset / Math.max(0.5, Math.abs(nx * -dz + nz * dx));
        return [x + nx * miter, z + nz * miter];
      });
      let carried = 0;
      for (let i = 0; i + 1 < shifted.length; i += 1) {
        const [ax, az] = shifted[i], [bx, bz] = shifted[i + 1];
        const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
        if (length < 0.01) continue;
        for (let at = -carried; at < length; at += 10) {
          const start = Math.max(0, at), end = Math.min(length, at + 4);
          if (end <= start) continue;
          const sx = ax + dx * start / length, sz = az + dz * start / length;
          const ex = ax + dx * end / length, ez = az + dz * end / length;
          markings.push(sx, terrainAt(sx, sz) + 0.24, sz, ex, terrainAt(ex, ez) + 0.24, ez);
        }
        carried = (carried + length) % 10;
      }
    }
  }
  addLines("District lane markings", markings, 0xf2f0e8, 0x929793);
  return freezeStaticSceneTransforms(group);
}
