import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial,
} from "three";
import source from "./data/mitteGardenRoutesV362.json";
import { districtStreetTerrainSampler } from "./DistrictStreets";
import { worldGroundSampler, type VoxelPayload } from "./terrainPayload";

type Cut<T> = { index: number; original: T; outside: T[] };

/** Each guard touches only the original rows which the orthophoto supersedes. */
export function correctedSchlossRowsV362<T extends number[] | number[][]>(
  rows: T[], cuts: readonly Cut<T>[],
): T[] {
  if (!cuts.every(c => JSON.stringify(rows[c.index]) === JSON.stringify(c.original))) return rows;
  const result = rows.slice();
  for (let i = cuts.length - 1; i >= 0; i--) {
    const cut = cuts[i];
    result.splice(cut.index, 1, ...cut.outside);
  }
  return result;
}

export const drawnCurbCutsV362 = source.drawnCurbCuts;
export const nativeCurbCutsV362 = source.nativeCurbCuts;

const PAVING = 0xb0aaa1;
const PAINT = { pavedVerge: 0xd4d0c3, paving: PAVING, raisedPaving: PAVING, asphalt: 0x777c7b, paint: 0xe1ded1 };

/** The surveyed walk and traffic paint are thin surfaces with no collision body. */
export function createMitteGardenRoutesV362(ground: VoxelPayload, native: boolean): Mesh {
  const positions: number[] = [], indices: number[] = [], colors: number[] = [];
  const tint = new Color();
  const terrainAt = native ? worldGroundSampler(ground) : districtStreetTerrainSampler(ground);
  for (const surface of source.surfaces) {
    tint.setHex(PAINT[surface.name as keyof typeof PAINT]);
    const lift = native ? surface.nativeLift : surface.drawnLift;
    const vertex = (x: number, z: number): void => {
      positions.push(x, (terrainAt(x, z) ?? ground.water_top_y_m) + lift, z);
      colors.push(tint.r, tint.g, tint.b);
    };
    if (native) {
      for (const [i, j, w, h] of surface.runs) {
        const start = positions.length / 3, cell = surface.cell;
        const x = i * cell, z = j * cell, right = (i + w) * cell, bottom = (j + h) * cell;
        vertex(x, z); vertex(x, bottom); vertex(right, bottom); vertex(right, z);
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    } else {
      const start = positions.length / 3;
      for (const [x, z] of surface.points) vertex(x / 100, z / 100);
      for (const i of surface.indices) indices.push(start + i);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshBasicMaterial({ vertexColors: true, color: 0x4e5863, side: DoubleSide });
  const mesh = new Mesh(geometry, day);
  mesh.name = "Lustgarten forecourt, cross paths and Schloßplatz paint";
  mesh.userData = {
    dayMaterial: day, nightMaterial: night, staticAntiFlicker: true, textureFree: true,
    blockNative: native, keepInMinecraft: native, fullStaticDetailOnTouch: true,
  };
  return mesh;
}
