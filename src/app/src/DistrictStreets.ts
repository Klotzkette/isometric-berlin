import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Group,
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
type StreetSource = {
  source: Record<string, unknown>;
  surfaces: { kind: keyof typeof SURFACE_STYLES; positions_cm_b64: string; indices_b64: string }[];
  curbs_m: Point[][];
  elevated_path_ids: string[];
  markings_m: { points: Point[]; width_m: number; lanes?: number | null }[];
};

const streets = source as unknown as StreetSource;
const elevatedPaths = new Set(streets.elevated_path_ids);

export function districtPathMayFollowTerrain(id: string): boolean {
  return !elevatedPaths.has(id.replace(/^way[/:]/, "").split(":")[0]);
}
export const DISTRICT_STREET_LIFT_M = 0.18;
export const DISTRICT_KERB_RISE_M = 0.14;
const KERB_HALF_WIDTH_M = 0.11;

export function districtStreetTerrainSampler(ground: VoxelPayload): (x: number, z: number) => number {
  const sample = smoothGroundTopSampler(ground);
  return (x, z) => sample(
    x / ground.cell_m - ground.grid.min_x_idx,
    z / ground.cell_m - ground.grid.min_z_idx,
  );
}

function decodeNumbers(base64: string, signed: boolean): number[] {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const result: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) result.push(signed ? view.getInt32(i, true) / 100 : view.getUint32(i, true));
  return result;
}

function geometry(positions: number[]): BufferGeometry {
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute(positions, 3));
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

/**
 * Small, offline-triangulated OSM street network, resident in the first frame
 * on both pointer profiles. No whole-city polygon union, Worker round trip,
 * lower-detail replacement or camera-dependent disappearance is necessary.
 */
export function createDistrictStreets(ground: VoxelPayload): Group {
  const group = new Group();
  group.name = "District streets and roadside paths";
  group.userData.sourceGeometry = streets.source;
  const terrainAt = districtStreetTerrainSampler(ground);
  const addSurface = (name: string, positions: number[], day: number, night: number, indices?: number[]): void => {
    if (!positions.length) return;
    const dayMaterial = new MeshBasicMaterial({ color: day, side: DoubleSide });
    const nightMaterial = new MeshBasicMaterial({ color: night, side: DoubleSide });
    const mesh = new Mesh(geometry(positions), dayMaterial);
    if (indices) mesh.geometry.setIndex(indices);
    mesh.name = name;
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.userData.staticAntiFlicker = true;
    group.add(mesh);
  };
  for (const surface of streets.surfaces) {
    const style = SURFACE_STYLES[surface.kind];
    const positions: number[] = [];
    const points = decodeNumbers(surface.positions_cm_b64, true);
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const z = points[i + 1];
      positions.push(x, terrainAt(x, z) + style.lift, z);
    }
    addSurface(
      style.name, positions, style.day, style.night, decodeNumbers(surface.indices_b64, false),
    );
  }

  const curbs: number[] = [];
  const curbIndices: number[] = [];
  const ink: number[] = [];
  // Four shared vertices per boundary point, instead of eighteen duplicated
  // vertices per segment. Real 22cm kerb top and both upstand faces remain.
  for (const line of streets.curbs_m) {
    const offset = curbs.length / 3;
    for (let i = 0; i < line.length; i += 1) {
      const [x, z] = line[i];
      const [ax, az] = line[Math.max(0, i - 1)];
      const [bx, bz] = line[Math.min(line.length - 1, i + 1)];
      const length = Math.hypot(bx - ax, bz - az) || 1;
      const nx = -(bz - az) / length * KERB_HALF_WIDTH_M;
      const nz = (bx - ax) / length * KERB_HALF_WIDTH_M;
      const base = terrainAt(x, z) + DISTRICT_STREET_LIFT_M;
      const top = base + DISTRICT_KERB_RISE_M;
      curbs.push(x-nx, base, z-nz, x+nx, base, z+nz,
        x-nx, top, z-nz, x+nx, top, z+nz);
      if (i === 0) continue;
      const a = offset + (i - 1) * 4, b = offset + i * 4;
      curbIndices.push(a,b,b+2, a,b+2,a+2, a+3,b+3,b+1, a+3,b+1,a+1,
        a+2,b+2,b+3, a+2,b+3,a+3);
      ink.push(ax, terrainAt(ax, az) + DISTRICT_STREET_LIFT_M + DISTRICT_KERB_RISE_M + 0.008, az,
        x, top + 0.008, z);
    }
  }
  addSurface("District raised kerbstones", curbs, 0xd8d5c9, 0x30343b, curbIndices);
  const addLines = (name: string, positions: number[], day: number, night: number): void => {
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
  for (const marking of streets.markings_m) {
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
