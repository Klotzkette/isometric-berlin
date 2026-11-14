import { Group } from "three";
import { GendarmenmarktFacadeBuilder, perimeterEdgeLength, type PerimeterFacadeEdge } from "./GendarmenmarktFacadeBuilder";
import { createSourceWallHostVerifierV344 } from "./sourceWallHostV344";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import source from "./data/schlossplatzContextV344.json";

type Front = typeof source.fronts[number];
const STONE = 0xC1B8A2, DARK = 0x424A49, GLASS = 0x607D83;

function opening(b: GendarmenmarktFacadeBuilder, edge: PerimeterFacadeEdge, u: number, y: number,
  w: number, h: number, trim: number, pair = false, arch = false): void {
  if (y - h / 2 < edge.wallBaseY + .05 || y + h / 2 > edge.wallTopY - .04) return;
  // Native uses cardinal, stepped arches rather than diagonal trim beams.
  b.window(edge, u, y, w, h, trim, DARK, GLASS, arch && !b.minecraft, .29);
  b.face(edge, u, y, .065, h, .10, DARK, .40);
  b.face(edge, u, y + h * .16, w, .065, .10, DARK, .40);
  if (pair) for (const sign of [-1, 1]) b.face(edge, u + sign * w / 4, y, .06, h, .10, DARK, .40);
  if (arch && b.minecraft) {
    for (let i = 0; i < 5; i++) {
      const width = w * (1 - i * .13);
      b.face(edge, u, y + h / 2 - i * .11, width, .11, .12, trim, .42);
    }
  }
}

function projectedU(edge: PerimeterFacadeEdge, x: number, z: number): number {
  const len = perimeterEdgeLength(edge);
  return ((x - edge.startXZ[0]) * (edge.endXZ[0] - edge.startXZ[0]) +
    (z - edge.startXZ[1]) * (edge.endXZ[1] - edge.startXZ[1])) / len;
}

function targetU(front: Front, edge: PerimeterFacadeEdge, fraction: number): number | undefined {
  const x = front.edge.startXZ[0] + (front.edge.endXZ[0] - front.edge.startXZ[0]) * fraction;
  const z = front.edge.startXZ[1] + (front.edge.endXZ[1] - front.edge.startXZ[1]) * fraction;
  const u = projectedU(edge, x, z), length = perimeterEdgeLength(edge);
  return u >= .1 && u < length - .1 ? u : undefined;
}

function finishWall(b: GendarmenmarktFacadeBuilder, f: Front, e: PerimeterFacadeEdge): void {
  const length = perimeterEdgeLength(e), height = e.wallTopY - e.wallBaseY;
  b.face(e, length / 2, (e.wallTopY + e.wallBaseY) / 2, length - .012, height - .015, .18, f.wall, .105);
  if (e.wallBaseY <= f.edge.wallBaseY + .05) {
    b.face(e, length / 2, e.wallBaseY + .22, length - .025, .4, .23,
      f.style === "ochre" ? 0x826E60 : 0xA39D8E, .15);
  }
  if (e.wallTopY >= f.edge.wallTopY - .1)
    b.face(e, length / 2, e.wallTopY - .17, length - .025, .24, .29, STONE, .17);
}

function historic(b: GendarmenmarktFacadeBuilder, f: Front, e: PerimeterFacadeEdge): void {
  const length = perimeterEdgeLength(e), sourceLength = perimeterEdgeLength(f.edge);
  const floors = f.floors, pitch = (f.edge.wallTopY - f.edge.wallBaseY - .7) / floors;
  const bays = b.minecraft ? Math.max(1, Math.round(length / sourceLength * f.bays)) : f.bays;
  for (let floor = 0; floor < floors; floor++) {
    const y = f.edge.wallBaseY + pitch * (floor + .53);
    const h = floor === 2 && f.style === "ribbeck" ? 1.85 : 2.25;
    if (y - h / 2 < e.wallBaseY || y + h / 2 > e.wallTopY) continue;
    if (f.style === "ribbeck" && floor === 2 && !b.minecraft) {
      for (let group = 0; group < 4; group++) for (let col = -1; col <= 1; col++)
        opening(b, e, length * (group + .5) / 4 + col * 1.3, y, .92, h, STONE);
    } else {
      for (let col = 0; col < bays; col++) {
        const u = length * (col + .5) / bays;
        const width = Math.min(b.minecraft ? 1.36 : 2.38, length / bays * .67);
        opening(b, e, u, y, width, h, STONE, !b.minecraft);
        if (floor === 0) {
          for (let bar = -1; bar <= 1; bar++) b.face(e, u + bar * width / 3, y, .045, h, .09, 0x5A5B51, .45);
        }
      }
    }
    const band = f.edge.wallBaseY + pitch * (floor + 1);
    if (band > e.wallBaseY + .2 && band < e.wallTopY - .2)
      b.face(e, length / 2, band, length - .03, .14, .26, STONE, .17);
  }
  // The central portal belongs to its source elevation once, including Native.
  if (f.style === "ribbeck" || f.style === "marstall-centre") {
    const u = targetU(f, e, .52);
    if (u !== undefined) {
      const width = Math.min(2.35, length - .3);
      opening(b, e, u, f.edge.wallBaseY + 1.8, width, 3.3, 0xA69B81, false, true);
      b.face(e, u, f.edge.wallBaseY + 3.65, width + .4, .20, .43, STONE, .30);
    }
  }
  if (f.style !== "ribbeck") return;
  // Four Renaissance gables: all elevations stay within the measured roof
  // maximum (25.8 m). These are small facade reliefs; no roof is replaced.
  if (e.wallTopY < f.edge.wallTopY - .1) return;
  for (let g = 0; g < 4; g++) {
    const u = targetU(f, e, (g + .5) / 4);
    if (u === undefined) continue;
    const width = b.minecraft ? Math.min(1.7, length - .15) : 4.9;
    const y = f.edge.wallTopY;
    for (const [dy, h, factor] of [[.7, 1.4, 1], [1.8, .8, .74], [2.5, .6, .49], [3.05, .5, .32]] as const)
      b.face(e, u, y + dy, width * factor, h, .34, f.wall, .16);
    for (const [dy, factor] of [[1.42, 1.04], [2.22, .8], [2.82, .56], [3.33, .38]] as const)
      b.face(e, u, y + dy, width * factor, .13, .45, STONE, .21);
    b.face(e, u, y + 3.60, .20, .48, .20, STONE, .23);
    if (!b.minecraft) {
      for (const sign of [-1, 1]) {
        b.face(e, u + sign * 1.03, y + .67, .86, 1.0, .10, 0x969184, .36);
        // Scrolls are an explicit small simplification of the stone carving.
        for (let step = 0; step < 7; step++) {
          const a = step * Math.PI / 6, c = (step + 1) * Math.PI / 6;
          b.beam(b.point(e, u + sign * (1.85 + .30 * Math.cos(a)), y + 1.52 + .30 * Math.sin(a), .33),
            b.point(e, u + sign * (1.85 + .30 * Math.cos(c)), y + 1.52 + .30 * Math.sin(c), .33), .105, STONE);
        }
      }
    }
  }
}

function modern(b: GendarmenmarktFacadeBuilder, f: Front, e: PerimeterFacadeEdge): void {
  const length = perimeterEdgeLength(e), whole = perimeterEdgeLength(f.edge);
  const pitch = (f.edge.wallTopY - f.edge.wallBaseY - .25) / f.floors;
  const bays = b.minecraft ? Math.max(1, Math.round(length / whole * f.bays)) : f.bays;
  for (let floor = 0; floor < f.floors; floor++) {
    const y = f.edge.wallBaseY + pitch * (floor + .5);
    const height = pitch * (f.style === "office" ? .52 : .80);
    if (y - height / 2 < e.wallBaseY || y + height / 2 > e.wallTopY) continue;
    const floorY = f.edge.wallBaseY + pitch * floor;
    if (floorY > e.wallBaseY + .05 && floorY < e.wallTopY - .05)
      b.face(e, length / 2, floorY, length - .03, f.style === "office" ? .28 : .12, .24, STONE, .18);
    for (let col = 0; col < bays; col++) {
      const u = length * (col + .5) / bays, bay = length / bays;
      const width = Math.min(b.minecraft ? 1.35 : f.style === "ochre" ? 1.1 : 2.9,
        bay * (f.style === "office" ? .70 : .67));
      opening(b, e, u, y, width, height, f.style === "ochre" ? 0xA18768 : STONE, f.style !== "ochre");
      if (f.style === "office") {
        b.face(e, u, y - height / 2 - .35, width, .55, .10, 0xB0AE9F, .23);
      } else if ((f.style === "stone" || f.style === "loggia") && floor > 0) {
        const balcony = f.style === "loggia" && (b.minecraft || col % 2 === 0);
        const depth = balcony ? .78 : .43;
        b.face(e, u, y - height / 2 - .04, width + .26, .15, depth, STONE, depth / 2 + .15);
        b.rail(e, u, y - height / 2 + .90, width + .1, depth + .10, 0x8C897C);
        if (!b.minecraft) {
          // The observed perforated geometric metalwork is represented by
          // repeating small cross members, never a photo or opaque texture.
          for (let k = 0; k < 4; k++) b.face(e, u - width * .36 + k * width * .24,
            y - height / 2 + .48, .23, .055, .07, 0x8C897C, depth + .11);
        }
      }
    }
  }
}

function library(b: GendarmenmarktFacadeBuilder, f: Front, e: PerimeterFacadeEdge): void {
  const length = perimeterEdgeLength(e), pitch = (f.edge.wallTopY - f.edge.wallBaseY) / 3;
  const bays = b.minecraft ? Math.max(1, Math.round(length / 2.6)) : 14;
  for (let floor = 0; floor < 3; floor++) {
    const y = f.edge.wallBaseY + pitch * (floor + .5);
    for (let col = 0; col < bays; col++) opening(b, e, length * (col + .5) / bays,
      y, length / bays - .22, pitch - .55, 0xB8B9AF, false);
    const band = f.edge.wallBaseY + pitch * floor;
    if (band > e.wallBaseY + .1 && band < e.wallTopY - .1)
      b.face(e, length / 2, band, length - .02, .38, .36, 0x9D9D92, .23);
  }
  // The A-portal remains a small, non-photographic relief in its entrance bay.
  const gate = targetU(f, e, .16);
  if (gate === undefined || e.wallBaseY > f.edge.wallBaseY + .1) return;
  const width = Math.min(4.8, length - .2), height = 3.6, cy = f.edge.wallBaseY + 2.2;
  b.face(e, gate, cy, width, height, .14, DARK, .45);
  const columns = b.minecraft ? Math.max(2, Math.round(width / .38)) : 13;
  for (let row = 0; row < 9; row++) for (let col = 0; col < columns; col++) {
    const u = gate + width * ((col + .5) / columns - .5), y = cy + height * ((row + .5) / 9 - .5);
    b.face(e, u, y, width / columns * .62, height / 9 * .70, .08,
      [0x8B8170, 0x978C79, 0xA49982][(row + col) % 3], .55);
    if (!b.minecraft) {
      const w = width / columns * .18, h = height / 9 * .23;
      b.beam(b.point(e, u - w, y - h, .61), b.point(e, u, y + h, .61), .025, 0xBCB096);
      b.beam(b.point(e, u, y + h, .61), b.point(e, u + w, y - h, .61), .025, 0xBCB096);
      b.face(e, u, y - .015, w * 1.1, .025, .025, 0xBCB096, .61);
    }
  }
}

/** Complete source owners remain untouched; only verified street elevations
 * receive this bounded relief. Call after the resident Alt-Mitte publication
 * and before static batching/CPU-buffer parking. */
export function createSchlossplatzContextV344(world: Group, native = false): Group {
  const verify = createSourceWallHostVerifierV344(world, native);
  const builder = new GendarmenmarktFacadeBuilder(native, false, 0);
  const admitted: string[] = [], skipped: string[] = [];
  let nativeFaces = 0;
  for (const front of source.fronts) {
    if (!verify(native ? front.nativeHosts : front.drawnHosts)) { skipped.push(front.name); continue; }
    admitted.push(front.name);
    const edges = native ? front.nativeEdges : [front.edge];
    for (const edge of edges) {
      finishWall(builder, front, edge);
      if (front.style === "library") library(builder, front, edge);
      else if (["ribbeck", "marstall", "marstall-centre"].includes(front.style)) historic(builder, front, edge);
      else modern(builder, front, edge);
    }
    nativeFaces += native ? edges.length : 0;
  }
  const root = builder.finish("Schlossplatz and Breite Straße source-bound context v344");
  Object.assign(root.userData, { schlossplatzContextV344: true, textureFree: true,
    sourcePreserved: true, fullMobileIdentical: true, nativeFaces, admitted, skipped,
    sourceFamilies: [...new Set(source.fronts.filter(f => admitted.includes(f.name)).map(f => f.family))] });
  return freezeStaticSceneTransforms(root);
}
