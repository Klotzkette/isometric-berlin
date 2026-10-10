import {
  BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments,
} from "three";
import drawn from "./data/regionOutlinesV200.json";
import nativeSource from "./data/regionOutlinesV200Native.json";
import navigation from "./data/regionOutlinesV200Navigation.json";
import type { SurroundingNavigationTile } from "./SurroundingCity";
import { surroundingBuildingSolidAt, surroundingPolygonContains } from "./SurroundingCityGeometry";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { createBerAirportV205 } from "./BerAirportV205";

/** Stable borrowed cells; scope and camera imports do not eagerly load this layer. */
export const regionalV200NavigationTiles = navigation.tiles as unknown as readonly SurroundingNavigationTile[];

function bytes(encoded: string): Uint8Array {
  const decoded = atob(encoded);
  const result = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) result[i] = decoded.charCodeAt(i);
  return result;
}

/** Centimetre quantization happened at generation, not during runtime budgeting. */
function positions(encoded: string): Float32Array {
  const packed = bytes(encoded);
  const input = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
  const result = new Float32Array(packed.byteLength / 4);
  for (let i = 0; i < result.length; i++) result[i] = input.getInt32(i * 4, true) / 100;
  return result;
}

/** Fourteen immutable regional batches; no animation, textures, lights or timers. */
export function createRegionOutlinesV200(native = false): Group {
  const root = new Group();
  root.name = `Regional outlines v200: ${native ? "independent orthogonal buildings" : "mapped building envelopes"}`;
  root.userData = {
    regionOutlinesV200: true, textureFree: true, fullStaticDetailOnTouch: true,
    blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
  };
  // Only the selected family's construction field is materialized. No closure
  // or userData keeps this data alive after the immutable GPU buffers are built.
  const groups = (native ? nativeSource : drawn).groups;
  for (const batch of groups) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions(batch.positionsCm), 3));
    geometry.setAttribute("color", new BufferAttribute(bytes(batch.colorsU8), 3, true));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const day = new LineBasicMaterial({ vertexColors: true, fog: false });
    const night = new LineBasicMaterial({ vertexColors: true, color: 0xb8c9d4, fog: false });
    const lines = new LineSegments(geometry, day);
    lines.name = `Regional v200: ${batch.key}`;
    lines.userData = {
      dayMaterial: day, nightMaterial: night, textureFree: true,
      regionOutlinesV200: true, blockNative: native,
    };
    root.add(lines);
  }
  root.add(createBerAirportV205(native));
  return freezeStaticSceneTransforms(root);
}

function tileContains(tile: SurroundingNavigationTile, x: number, z: number, radius = 0): boolean {
  const b = tile.bounds;
  return x >= b[0] - radius && x <= b[2] + radius && z >= b[1] - radius && z <= b[3] + radius;
}

/** Collision follows authoritative source envelopes in both outline readings. */
export function regionalV200SolidAt(x: number, y: number, z: number, radius = 0): boolean {
  if (![x, y, z, radius].every(Number.isFinite)) return false;
  radius = Math.max(0, radius);
  return regionalV200NavigationTiles.some(tile => tileContains(tile, x, z, radius) &&
    surroundingBuildingSolidAt(tile.nav, x, y, z, radius));
}

/** Mapped shores and island holes remain exact; regional water is a hairline. */
export function regionalV200WaterAt(x: number, z: number): boolean {
  if (![x, z].every(Number.isFinite)) return false;
  return regionalV200NavigationTiles.some(tile => tileContains(tile, x, z) &&
    tile.nav.water.some(polygon => surroundingPolygonContains(polygon, x, z)));
}
