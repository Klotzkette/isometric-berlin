import { Group, type Object3D } from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import type { VisualMode } from "./visualMode";

export type CoreBridgeRoadDeckV242 = {
  name: string;
  center: [number, number];
  axis: [number, number];
  halfLength: number;
  baseY: number;
  curveSagitta: number;
  segments: number;
  camber: number;
};

type Box = { x: number; y: number; z: number; length: number; height: number;
  width: number; ax: number; az: number; color: number; walking: boolean };
const NATIVE_CELL = 0.5;
const DRAWN_NAME = "Core bridge road fittings v242 drawn";
const NATIVE_NAME = "Core bridge road fittings v242 native";

// Existing architectural footway bounds remain unchanged. The 12 cm additive
// wearing course and 22 cm inner curb strip are disclosed display estimates.
function footway(name: string): [number, number, number, number, number] | null {
  if (name === "Moltkebrücke") return [8.6, 12.6, .09, .21, 0xd7b7a4];
  if (name === "Hugo-Preuß-Brücke") return [6.775, 11.325, .10, .22, 0xb9b8b1];
  if (name === "Weidendammer Brücke") return [6.8, 10.8, .13, .25, 0xb9b8b1];
  return null;
}

export function isCoreBridgeRoadV242(name: string): boolean {
  return footway(name) !== null || name === "Kronprinzenbrücke";
}

function boxesFor(deck: CoreBridgeRoadDeckV242, markings = true): Box[] {
  const rows: Box[] = [];
  const segmentLength = deck.halfLength * 2 / deck.segments;
  const band = footway(deck.name);
  // Retained osm.gpkg/roads: 6228081, lanes=4 / forward=2 / backward=2;
  // 188240631, lanes=2. Dash dimensions are illustrative, not surveyed paint.
  const separators = deck.name === "Weidendammer Brücke" ? [-3.25, 0, 3.25]
    : deck.name === "Kronprinzenbrücke" ? [0] : [];
  for (let index = 0; index < deck.segments; index++) {
    const u = -deck.halfLength + segmentLength * (index + .5);
    const curve = deck.curveSagitta * Math.max(0, 1 - (u / deck.halfLength) ** 2);
    const slope = -2 * deck.curveSagitta * u / deck.halfLength ** 2;
    const tx = deck.axis[0] - deck.axis[1] * slope;
    const tz = deck.axis[1] + deck.axis[0] * slope;
    const norm = Math.hypot(tx, tz), ax = tx / norm, az = tz / norm;
    const cx = deck.center[0] + deck.axis[0] * u - deck.axis[1] * curve;
    const cz = deck.center[1] + deck.axis[1] * u + deck.axis[0] * curve;
    const y = deck.baseY + deck.camber * Math.cos(u / deck.halfLength * Math.PI / 2) ** 2;
    const add = (v: number, bottom: number, top: number, width: number, color: number,
      length = segmentLength + .05, walking = true) => rows.push({
      x: cx - az * v, z: cz + ax * v, y: y + (bottom + top) / 2,
      length, height: top - bottom, width, color, ax, az, walking,
    });
    if (band) {
      const [inner, outer, oldTop, top, color] = band;
      for (const side of [-1, 1]) {
        // Keep the previous slabs underneath; no historic bridge detail is retired.
        add(side * ((inner + outer) / 2 + .11), oldTop, top, outer - inner - .22, color);
        add(side * (inner + .11), .07, top, .22, 0xd9d5c9);
      }
    }
    if (markings && index % 2 === 0) {
      for (const v of separators) add(v, .075, .095, .14, 0xe9e4d8,
        Math.min(2.4, segmentLength * .64), false);
    }
  }
  return rows;
}

function topAt(rows: readonly Box[], x: number, z: number): { top: number; color: number; bottom: number } | null {
  let result: { top: number; color: number; bottom: number } | null = null;
  for (const row of rows) {
    const dx = x - row.x, dz = z - row.z;
    if (Math.abs(dx * row.ax + dz * row.az) > row.length / 2 ||
      Math.abs(-dx * row.az + dz * row.ax) > row.width / 2) continue;
    const top = row.y + row.height / 2;
    if (!result || top >= result.top) result = { top, color: row.color, bottom: row.y - row.height / 2 };
  }
  return result;
}

function nativeRows(rows: readonly Box[]): number[][] {
  if (!rows.length) return [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const row of rows) {
    const dx = (Math.abs(row.ax) * row.length + Math.abs(row.az) * row.width) / 2;
    const dz = (Math.abs(row.az) * row.length + Math.abs(row.ax) * row.width) / 2;
    minX = Math.min(minX, row.x - dx); maxX = Math.max(maxX, row.x + dx);
    minZ = Math.min(minZ, row.z - dz); maxZ = Math.max(maxZ, row.z + dz);
  }
  const blocks: number[][] = [];
  // Merge adjacent orthogonal cells only when their entire surface record agrees.
  // This retains the full cell interpretation without allocating a voxel volume.
  for (let iz = Math.floor(minZ / NATIVE_CELL); iz <= Math.floor(maxZ / NATIVE_CELL); iz++) {
    let runStart = 0, runEnd = 0;
    let run: ReturnType<typeof topAt> = null;
    const flush = () => {
      if (run) blocks.push([(runStart + runEnd) * NATIVE_CELL / 2,
        (run.bottom + run.top) / 2, (iz + .5) * NATIVE_CELL,
        (runEnd - runStart) * NATIVE_CELL, run.top - run.bottom, NATIVE_CELL, run.color]);
    };
    for (let ix = Math.floor(minX / NATIVE_CELL); ix <= Math.floor(maxX / NATIVE_CELL) + 1; ix++) {
      const cell = topAt(rows, (ix + .5) * NATIVE_CELL, (iz + .5) * NATIVE_CELL);
      if (cell && run && cell.top === run.top && cell.bottom === run.bottom && cell.color === run.color) {
        runEnd = ix + 1;
      } else {
        flush(); run = cell; runStart = ix; runEnd = ix + 1;
      }
    }
    flush();
  }
  return blocks;
}

export function createCoreBridgeRoadDetailsV242(decks: readonly CoreBridgeRoadDeckV242[]): Group {
  const root = new Group();
  root.name = "Core bridge road fittings v242";
  root.userData = { keepInMinecraft: true, fullStaticDetailOnTouch: true, textureFree: true };
  const drawn: number[][] = [], native: number[][] = [];
  for (const deck of decks) {
    const rows = boxesFor(deck);
    for (const row of rows) drawn.push([row.x, row.y, row.z, row.length,
      row.height, row.width, Math.atan2(-row.az, row.ax), row.color]);
    native.push(...nativeRows(rows));
  }
  if (drawn.length) {
    const mesh = justicePalaceV183Boxes(drawn); mesh.name = DRAWN_NAME;
    root.add(mesh);
  }
  if (native.length) {
    const mesh = justicePalaceV183Boxes(native, true); mesh.name = NATIVE_NAME;
    mesh.visible = false; root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}

export function setCoreBridgeRoadPresentationV242(root: Object3D, mode: VisualMode): void {
  const drawn = root.getObjectByName(DRAWN_NAME), native = root.getObjectByName(NATIVE_NAME);
  if (drawn) drawn.visible = mode !== "minecraft";
  if (native) native.visible = mode === "minecraft";
}

/** The same finite curb/paving rectangles drive physical support and both renderings. */
export function createCoreBridgePavingGroundV242(deck: CoreBridgeRoadDeckV242) {
  const rows = boxesFor(deck, false);
  return (x: number, z: number, native: boolean): number | null => {
    if (native) {
      x = (Math.floor(x / NATIVE_CELL) + .5) * NATIVE_CELL;
      z = (Math.floor(z / NATIVE_CELL) + .5) * NATIVE_CELL;
    }
    return topAt(rows, x, z)?.top ?? null;
  };
}
