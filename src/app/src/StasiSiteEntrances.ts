import { ShapeUtils, Vector2 } from "three";

type Point3 = [number, number, number];
type Surface = { color: number; triangles: number[][][] };
type SourceSurface = Surface & { part: string; sheet: number; kind: string };
export type StasiEntranceBox = [number, number, number, number, number, number, number, number];

// Haus 1 entrance canopy, LoD2 parent DEBE11YYI0002Eyq. Its exposed front runs
// between these endpoints. The present-day Bundesarchiv photograph supports
// the openwork and metal surround. The small divisions are display estimates.
const SCREEN = {
  part: "DEBE11YYI0002Eyq",
  start: [7841.803, 663.764],
  end: [7844.468, 649.241],
  bottom: 3,
  top: 7.677,
};
const screenLength = Math.hypot(SCREEN.end[0] - SCREEN.start[0], SCREEN.end[1] - SCREEN.start[1]);
const screenX = (SCREEN.end[0] - SCREEN.start[0]) / screenLength;
const screenZ = (SCREEN.end[1] - SCREEN.start[1]) / screenLength;
const concrete = 0xa7a6a1;
const shadow = 0x777972;
const steel = 0x626d71;
const recess = 0x404741;

function screenPoint(u: number, y: number, offset: number): Point3 {
  return [SCREEN.start[0] + screenX * u + screenZ * offset, y,
    SCREEN.start[1] + screenZ * u - screenX * offset];
}

const frontTriangles = [
  [screenPoint(0, SCREEN.top, 0), [SCREEN.end[0], SCREEN.top, SCREEN.end[1]],
    [SCREEN.end[0], SCREEN.bottom, SCREEN.end[1]]],
  [[SCREEN.end[0], SCREEN.bottom, SCREEN.end[1]], screenPoint(0, SCREEN.bottom, 0),
    screenPoint(0, SCREEN.top, 0)],
];

const columns = 20;
const courses = 9;
const innerBottom = SCREEN.bottom + .10;
const innerTop = SCREEN.top - .40;
const innerWidth = screenLength - .32;
const bay = innerWidth / columns;
const course = (innerTop - innerBottom) / courses;

function panelHoles() {
  const holes: Vector2[][] = [];
  for (let row = 0; row < courses; row++) {
    for (let column = 0; column < columns; column++) {
      const centerX = .16 + (column + .5) * bay;
      const centerY = innerBottom + (row + .5) * course;
      const large = (row + column) % 2 === 0;
      const width = bay * (large ? .42 : .32);
      const height = course * (large ? .42 : .35);
      const corners = large
        ? [[-.40, -1], [.40, -1], [1, -.24], [1, .24], [.40, 1], [-.40, 1], [-1, .24], [-1, -.24]]
        : [[0, -1], [1, 0], [0, 1], [-1, 0]];
      holes.push(corners.map(([u, v]) => new Vector2(centerX + u * width, centerY + v * height)));
    }
  }
  return holes;
}

function rectangle(x0: number, y0: number, x1: number, y1: number, offset: number): number[][][] {
  const a = screenPoint(x0, y0, offset), b = screenPoint(x1, y0, offset);
  const c = screenPoint(x1, y1, offset), d = screenPoint(x0, y1, offset);
  return [[a, b, c], [a, c, d]];
}

/** Admit just the exact closed source face. The adjoining wall and roof keep
 * their original sheets. Every aperture goes through the new concrete web. */
export function refineStasiEntranceScreen(surface: SourceSurface): Surface[] {
  if (surface.part !== SCREEN.part || surface.sheet !== 4 || surface.kind !== "WallSurface" ||
    JSON.stringify(surface.triangles) !== JSON.stringify(frontTriangles)) return [surface];
  const outline = [
    new Vector2(.16, innerBottom), new Vector2(.16 + innerWidth, innerBottom),
    new Vector2(.16 + innerWidth, innerTop), new Vector2(.16, innerTop),
  ];
  const holes = panelHoles();
  const points = [...outline, ...holes.flat()];
  const triangulation = ShapeUtils.triangulateShape(outline, holes);
  if (triangulation.length === 0) return [surface];
  const faces = triangulation.map(triangle =>
    triangle.map(i => screenPoint(points[i].x, points[i].y, 0)));
  // A single dark facet at the top of each opening reads as a deep reveal
  // without replicating a second 180-hole mesh behind the visible web.
  const reveals = holes.map(ring => {
    const top = ring.reduce((a, b) => a.y >= b.y ? a : b);
    const next = ring[(ring.indexOf(top) + 1) % ring.length];
    return [screenPoint(top.x, top.y, 0), screenPoint(next.x, next.y, 0),
      screenPoint((top.x + next.x) / 2, (top.y + next.y) / 2 - .025, -.16)];
  });
  return [
    { color: concrete, triangles: faces },
    { color: shadow, triangles: reveals },
    { color: steel, triangles: [
      ...rectangle(0, innerTop, screenLength, SCREEN.top, .035),
      ...rectangle(0, SCREEN.bottom, .16, innerTop, .035),
      ...rectangle(screenLength - .16, SCREEN.bottom, screenLength, innerTop, .035),
      ...rectangle(.16, SCREEN.bottom, screenLength - .16, innerBottom, .035),
    ] },
  ];
}

// The retained native screen is a one-metre wall skin. Individual shallow
// recesses step along it in world axes. They need no transparent face or map.
export function nativeStasiEntranceScreen(): StasiEntranceBox[] {
  const boxes: StasiEntranceBox[] = [];
  for (let row = 0; row < courses; row++) {
    for (let column = 0; column < columns; column++) {
      const u = .16 + (column + .5) * bay;
      const y = innerBottom + (row + .5) * course;
      const offset = nativeScreenOffset(u);
      const large = (row + column) % 2 === 0;
      for (const [lift, width] of [[-.12, large ? .34 : .21], [0, large ? .42 : .30], [.12, large ? .34 : .21]]) {
        boxes.push([...screenPoint(u, y + lift, offset), .06, .12, width, 0, recess]);
      }
    }
  }
  for (let column = 0; column < columns; column++) {
    const u = .16 + (column + .5) * bay;
    boxes.push([...screenPoint(u, (innerTop + SCREEN.top) / 2, nativeScreenOffset(u)),
      .12, SCREEN.top - innerTop, bay, 0, steel]);
  }
  return boxes;
}

function nativeScreenOffset(u: number): number {
  const [x] = screenPoint(u, 0, 0);
  // Move just to the west face of the source's one-metre skin, plus 3 cm.
  const xFace = Math.floor(x - .20);
  return (x - xFace + .03) / -screenZ;
}

// Gedenkstätte Hohenschönhausen, OSM node/492400221 and way/40560203.
// The mapped width is 4 m. The press photograph shows a straight concrete
// lintel with flanking jambs and the marked 3.3 m clearance.
export const HSH_GATE_CENTER = [8786.851211258443, -2366.707340583205] as const;
const gateYaw = -Math.atan2(-2372.1304999543354 + 2362.843831558712,
  8788.252919162274 - 8785.895752089098);
const gateX = Math.cos(gateYaw), gateZ = -Math.sin(gateYaw);
const gateGround = 3;
const gateOpeningHeight = 3.3;
const gateStone = 0x9d9880;

function gatePoint(along: number, y: number, inset = 0): Point3 {
  return [HSH_GATE_CENTER[0] + along * gateX - inset * gateZ, y,
    HSH_GATE_CENTER[1] + along * gateZ + inset * gateX];
}

function gateRows(native: boolean): StasiEntranceBox[] {
  const boxes: StasiEntranceBox[] = [];
  const add = (u: number, y: number, width: number, height: number, depth: number, color: number, inset = 0) => {
    if (!native) {
      boxes.push([...gatePoint(u, y, inset), width, height, depth, gateYaw, color]);
      return;
    }
    const count = Math.ceil(width / .35);
    for (let i = 0; i < count; i++) {
      const along = u - width / 2 + (i + .5) * width / count;
      boxes.push([...gatePoint(along, y, inset),
        Math.max(depth * Math.abs(gateZ), width / count * Math.abs(gateX)),
        height, Math.max(depth * Math.abs(gateX), width / count * Math.abs(gateZ)), 0, color]);
    }
  };
  for (const side of [-1, 1]) add(side * 2.40, gateGround + gateOpeningHeight / 2, .80, gateOpeningHeight, .66, gateStone);
  add(0, gateGround + gateOpeningHeight + .43, 5.60, .86, .66, gateStone);
  add(0, gateGround + gateOpeningHeight + .77, 5.62, .08, .70, shadow);
  return boxes;
}

const drawnGate = gateRows(false);
const nativeGate = gateRows(true);

export function hohenschoenhausenEntranceGate(native: boolean): readonly StasiEntranceBox[] {
  return native ? nativeGate : drawnGate;
}

/** Use the same displayed concrete as collision, including the lintel. */
export function hohenschoenhausenEntranceSolidAt(x: number, y: number, z: number, radius: number, native: boolean): boolean {
  if (Math.abs(x - HSH_GATE_CENTER[0]) > 4 + radius ||
    Math.abs(z - HSH_GATE_CENTER[1]) > 4 + radius || y < gateGround || y > gateGround + 4.16) return false;
  return hohenschoenhausenEntranceGate(native).some(([cx, cy, cz, width, height, depth, yaw]) => {
    if (Math.abs(y - cy) > height / 2) return false;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const dx = x - cx, dz = z - cz;
    return Math.abs(dx * cos - dz * sin) <= width / 2 + radius &&
      Math.abs(dx * sin + dz * cos) <= depth / 2 + radius;
  });
}
