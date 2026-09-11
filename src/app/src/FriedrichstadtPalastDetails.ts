import {
  BoxGeometry, Color, ExtrudeGeometry, Group, InstancedMesh, Matrix4,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, Shape, Vector3,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createBuilder, finishDrawnGroup, paintGeometry } from "./drawnKit";

export type PalaceDetailProfile = "full" | "mobile";
type P2 = readonly [number, number];
type P3 = readonly [number, number, number];
export const FRIEDRICHSTADT_PALAST_ROOT_NAME = "Friedrichstadt-Palast source-bound recognition model";
export const FRIEDRICHSTADT_PALAST_MINECRAFT_NAME = "Friedrichstadt-Palast block-native recognition model";
export const FRIEDRICHSTADT_PALAST_GLASS_LAYER_NAME = "Friedrichstadt-Palast arched concrete-glass fields";
export const FRIEDRICHSTADT_PALAST_SIGN_LAYER_NAME = "Friedrichstadt-Palast procedural facade lettering";
export const FRIEDRICHSTADT_PALAST_PRISM_ID = "24314976";

// Exact projected OSM way 24314976. The source's generic twelve-metre context
// height remains in the data; LDA's published envelope governs this display.
export const FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD = [
  [1133.545, -560.389], [1152.209, -562.175], [1151.621, -568.375],
  [1233.239, -574.198], [1236.941, -531.73], [1242.173, -532.014],
  [1245.097, -495.417], [1187.054, -490.358], [1186.71, -496.542],
  [1156.48, -494.457], [1155.626, -504.569], [1155.005, -511.983],
  [1137.258, -510.854], [1135.462, -532.26], [1133.608, -533.102],
  [1133.409, -535.165], [1133.202, -537.418], [1134.921, -539.037],
] as const;

const BASE = 5.2;
const CENTRE: P2 = [1135.4015, -535.6215];
const LENGTH = Math.hypot(3.713, 49.535);
// Positive local u goes right when looking at the entrance from Friedrichstrasse.
const AXIS: P2 = [3.713 / LENGTH, 49.535 / LENGTH];
const OUT: P2 = [-AXIS[1], AXIS[0]];
const YAW = -Math.atan2(AXIS[1], AXIS[0]);
const C = { stone: 0xbebcb0, light: 0xd7d4c7, seam: 0x96968c,
  dark: 0x373f3e, glass: 0x3c5156, metal: 0x7f8a87, roof: 0x848780,
  white: 0xedece0, red: 0x91463e, gold: 0xb19c73 };

export const FRIEDRICHSTADT_PALAST_PROFILE = Object.freeze({
  baseY: BASE, name: "Friedrichstadt-Palast", osmWayId: FRIEDRICHSTADT_PALAST_PRISM_ID,
  shippedContextPrismId: FRIEDRICHSTADT_PALAST_PRISM_ID,
  footprintWorld: FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD,
  facade: Object.freeze({ fieldCounts: Object.freeze({ full: 9, mobile: 9 }),
    officialGlassBlockCount: 22_500, structuralGridM: 6,
    form: "nine retained foyer axes, central glazed display, faceted two-storey bays with narrow concrete-glass strips, nested arch relief and rooftop lettering" }),
  officialEnvelopeM: Object.freeze({ height: 20, length: 110, width: 80, stageTowerHeight: 32, stageTowerWidth: 23 }),
  sourceUrls: [
    "https://www.openstreetmap.org/way/24314976",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065000",
    "https://www.berlin.de/landesdenkmalamt/_assets/pdf-und-zip/aktuelles/kurzmeldungen/efriedrichstrasse-107.pdf",
    "https://www.palast.berlin/news/der-neue-palast-feiert-40-jahre/",
    "https://commons.wikimedia.org/wiki/File:Exterior_view_of_Friedrichstadtpalast,_Berlin_02.jpg",
    "https://commons.wikimedia.org/wiki/File:Exterior_view_of_Friedrichstadtpalast,_Berlin_04.jpg",
  ] as const,
  geometryStatus: "Exact projected OSM outline; LDA published 20 m main and 32 m stage height. Local bays, stage position/depth, glass aggregates, reliefs and roof subdivision are non-surveyed display reconstructions. Source twelve-metre fallback remains recorded.",
  texturePolicy: "Code-built geometry only, no photograph, logo file, font, poster artwork or runtime texture",
  runtimeAssets: [] as const,
});

export function palastFacadePoint(u: number, y: number, out: number): P3 {
  return [CENTRE[0] + AXIS[0] * u + OUT[0] * out, y, CENTRE[1] + AXIS[1] * u + OUT[1] * out];
}
function localAt(x: number, z: number): P2 {
  const dx = x - CENTRE[0], dz = z - CENTRE[1];
  return [dx * AXIS[0] + dz * AXIS[1], dx * OUT[0] + dz * OUT[1]];
}
export function friedrichstadtPalastContains(x: number, z: number): boolean {
  if (x < 1133 || x > 1246 || z < -575 || z > -490) return false;
  const r = FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD;
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [ax, az] = r[i], [bx, bz] = r[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function friedrichstadtPalastTopAt(x: number, z: number, sourceId = FRIEDRICHSTADT_PALAST_PRISM_ID): number | null {
  if (sourceId !== FRIEDRICHSTADT_PALAST_PRISM_ID || !friedrichstadtPalastContains(x, z)) return null;
  const [u, out] = localAt(x, z);
  if (Math.abs(u + 1.5) <= 11.85 && Math.abs(out + 62) <= 15.85) return BASE + 32.24;
  return BASE + 20.2;
}
export function friedrichstadtPalastSolidAt(x: number, z: number, footY: number, height = 1.8): boolean {
  const top = friedrichstadtPalastTopAt(x, z);
  return top !== null && footY < top - 0.05 && footY + height > BASE;
}

export type PalastBox = { position: P3; size: P3; rotation: Quaternion; color: number; role: string; outward?: P2 };
type Plans = { stone: PalastBox[]; glass: PalastBox[]; sign: PalastBox[] };
const Y_AXIS = new Vector3(0, 1, 0);
function box(list: PalastBox[], u: number, y: number, out: number, w: number, h: number, d: number, color: number, role: string): void {
  list.push({ position: palastFacadePoint(u, y, out), size: [w, h, d], rotation: new Quaternion().setFromAxisAngle(Y_AXIS, YAW), color, role });
}
function line(list: PalastBox[], a: P3, b: P3, width: number, color: number, role: string): void {
  const va = new Vector3(...a), vb = new Vector3(...b), delta = vb.clone().sub(va);
  list.push({ position: va.add(vb).multiplyScalar(.5).toArray() as unknown as P3,
    size: [width, delta.length(), width], rotation: new Quaternion().setFromUnitVectors(Y_AXIS, delta.normalize()), color, role });
}
function facadeLine(list: PalastBox[], u0: number, y0: number, u1: number, y1: number, out: number, width: number, color: number, role: string): void {
  line(list, palastFacadePoint(u0, y0, out), palastFacadePoint(u1, y1, out), width, color, role);
}
function arch(list: PalastBox[], u: number, y: number, rx: number, ry: number, out: number, width: number, color: number, segments: number, role: string): void {
  for (let i = 0; i < segments; i++) {
    const a = i * Math.PI / segments, b = (i + 1) * Math.PI / segments;
    facadeLine(list, u + Math.cos(a) * rx, y + Math.sin(a) * ry,
      u + Math.cos(b) * rx, y + Math.sin(b) * ry, out, width, color, role);
  }
}

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  " ": ["00000","00000","00000","00000","00000","00000","00000"],
  A: ["01110","10001","10001","11111","10001","10001","10001"],
  C: ["01111","10000","10000","10000","10000","10000","01111"],
  D: ["11110","10001","10001","10001","10001","10001","11110"],
  E: ["11111","10000","10000","11110","10000","10000","11111"],
  F: ["11111","10000","10000","11110","10000","10000","10000"],
  H: ["10001","10001","10001","11111","10001","10001","10001"],
  I: ["11111","00100","00100","00100","00100","00100","11111"],
  L: ["10000","10000","10000","10000","10000","10000","11111"],
  P: ["11110","10001","10001","11110","10000","10000","10000"],
  R: ["11110","10001","10001","11110","10100","10010","10001"],
  S: ["01111","10000","10000","01110","00001","00001","11110"],
  T: ["11111","00100","00100","00100","00100","00100","00100"],
};
function lettering(p: Plans): void {
  const text = "FRIEDRICHSTADT PALAST", pixel = .31, columns = text.length * 6 - 1;
  for (let index = 0; index < text.length; index++) {
    const glyph = GLYPHS[text[index]];
    for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) {
      if (glyph[row][col] !== "1") continue;
      const u = (index * 6 + col - (columns - 1) / 2) * pixel;
      // Red side depth and light face reproduce the photographed built letters.
      box(p.sign, u, BASE + 20.7 + (6 - row) * pixel, .25, .24, .24, .25, C.red, "roof-letter-return");
      box(p.sign, u, BASE + 20.7 + (6 - row) * pixel, .41, .19, .19, .08, C.white, "roof-letter-face");
    }
  }
  for (const u of [-18, -12, -6, 0, 6, 12, 18]) {
    box(p.stone, u, BASE + 21.1, -.1, .055, 2.2, .055, C.metal, "roof-sign-support");
    line(p.stone, palastFacadePoint(u, BASE + 21.8, -.1), palastFacadePoint(u, BASE + 20.2, -1.25), .07, C.metal, "roof-sign-brace");
  }
  // Code-authored fan/flower silhouette between words; no supplied logo art.
  const fanU = 7.2;
  for (let rib = 0; rib < 7; rib++) {
    const theta = -.8 + rib * .2;
    const u = fanU + Math.sin(theta) * 2.3, y = BASE + 23.25 + Math.cos(theta) * 2.8;
    facadeLine(p.sign, fanU - .25, BASE + 21.1, u, y, .42, .14, C.red, "roof-fan-outline");
    facadeLine(p.sign, fanU - .25, BASE + 21.1, u, y - .12, .52, .075, C.white, "roof-fan-face");
  }
}

export function planFriedrichstadtPalast(detailProfile: PalaceDetailProfile = "full", minecraft = false): Plans {
  const p: Plans = { stone: [], glass: [], sign: [] };
  const mobile = minecraft && detailProfile === "mobile";
  const subdivisions = mobile ? 6 : 10;
  for (let axis = -4; axis <= 4; axis++) {
    const u = axis * 5.28;
    // Broad shallow nested concrete arches above fine keyhole-topped bay heads.
    for (const off of [-2.49, 2.49]) {
      box(p.stone, u + off, BASE + 9.8, .24, .22, 18.8, .28, C.light, "foyer-pilaster");
    }
    for (const [rx, ry, y] of [[2.47, 2.7, 15.7], [2.19, 2.35, 15.7], [1.6, 1.75, 13.7]] as const) {
      arch(p.stone, u, BASE + y, rx, ry, .33, .13, C.light, subdivisions, "nested-concrete-arch");
    }
    box(p.stone, u, BASE + 19.3, .16, 5.28, .2, .25, C.light, "foyer-attic-course");
    if (axis === 0) {
      // The central promotional vitrine is real, but no transient show artwork.
      box(p.glass, u, BASE + 9.75, 1.63, 3.4, 12.0, .12, C.glass, "central-glazed-vitrine");
      for (const side of [-1, 1]) box(p.stone, side * 1.84, BASE + 9.75, 1.56, .25, 12.4, .46, C.gold, "vitrine-upright");
      box(p.stone, 0, BASE + 16.2, 1.5, 4.05, .45, .65, C.gold, "vitrine-crown");
      for (const y of [4, 8, 12, 15.8]) box(p.stone, 0, BASE + y, 1.75, 3.5, .12, .14, C.metal, "vitrine-transom");
      for (let y = 0; y < 4; y++) box(p.stone, 0, BASE + 16.8 + y * .2, .36, 3.7 - y * .2, .08, .1, C.dark, "central-extract-louvre");
    } else {
      box(p.glass, u, BASE + 9.3, .5, 3.8, 10.5, .12, C.dark, "foyer-recess-shadow");
      // Clear tall centre and narrow glass-block stripes both sides, two storeys.
      for (const side of [-1, 1]) {
        box(p.glass, u + side * .56, BASE + 9.3, .8, .89, 10.1, .13, C.glass, "faceted-foyer-pane");
        box(p.stone, u + side * 1.07, BASE + 9.3, .94, .16, 10.2, .26, C.light, "concrete-bay-mullion");
        box(p.stone, u + side * 1.91, BASE + 9.3, .68, .14, 10.3, .2, C.light, "glass-strip-border");
        const rows = mobile ? 10 : 20, cols = mobile ? 2 : 3;
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
          const y = BASE + 4.47 + row * 9.62 / (rows - 1);
          if (Math.abs(y - (BASE + 8.9)) < .32) continue;
          const palette = [0xbbcfcc, 0x839eab, 0xd9d8cb, 0xa49fae, 0xc2ba9e];
          box(p.glass, u + side * (1.25 + col * .22), y, .8,
            mobile ? .25 : .16, 9.62 / rows * .72, .12, palette[(row * 3 + col + axis + 20) % palette.length], "concrete-glass-aggregate");
        }
      }
      for (const y of [4.0, 8.9, 14.6]) box(p.stone, u, BASE + y, .84, 3.95, .27, .32, C.light, "foyer-storey-transom");
      box(p.stone, u, BASE + 9.3, 1.08, .13, 10.1, .18, C.light, "projecting-bay-centre");
      arch(p.stone, u, BASE + 14.65, 1.05, 1.08, .9, .19, C.light, subdivisions, "glass-keyhole-head");
      for (const side of [-1, 1]) {
        facadeLine(p.stone, u + side * 1.03, BASE + 14.65, u, BASE + 13.43, .99, .17, C.light, "glass-keyhole-tail");
        facadeLine(p.glass, u + side * .6, BASE + 14.93, u, BASE + 14.13, .86, .22, 0x9eafb2, "keyhole-coloured-glass");
      }
    }
    // Repeated dark advertising cases and doors at the actual ground storey.
    box(p.glass, u, BASE + 1.8, .6, 3.9, 3.1, .17, C.dark, "street-display-case");
    box(p.stone, u, BASE + 3.5, .68, 4.18, .2, .23, C.light, "display-case-lintel");
    if (Math.abs(axis) <= 1) {
      for (const side of [-1, 1]) box(p.stone, u + side * .76, BASE + 1.7, .77, .065, 3.0, .1, C.metal, "entrance-door-mullion");
      box(p.stone, u, BASE + 1.7, .77, 3.7, .065, .1, C.metal, "entrance-door-transom");
    }
  }
  // Front ground reliefs use small generic geometric performer cues; the full
  // Emilia Nikolowa-Bayer compositions are not falsely reproduced as scans.
  for (const side of [-1, 1]) for (let field = 0; field < 2; field++) {
    const u = side * (16 + field * 5.28);
    box(p.stone, u, BASE + 1.75, .75, 3.3, 2.8, .17, C.stone, "relief-field");
    for (const k of [-1, 0, 1]) {
      box(p.stone, u + k * .78, BASE + 2.5, .94, .3, .35, .1, C.light, "relief-head");
      facadeLine(p.stone, u + k * .78, BASE + 2.27, u + k * .78 + .23, BASE + .65, .97, .19, C.light, "relief-body");
      facadeLine(p.stone, u + k * .78 - .32, BASE + 1.64, u + k * .78 + .35, BASE + 1.94, .99, .13, C.light, "relief-arms");
    }
  }
  // Published 2 m panel rhythm, window groups and darker geometric spandrels
  // on the less decorated function wings, using every actual exterior edge.
  const ring = FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < 8 || Math.max(a[0], b[0]) < 1140) continue;
    const nx = dz / length, nz = -dx / length; // clockwise ring outward
    const yaw = -Math.atan2(dz, dx), q = new Quaternion().setFromAxisAngle(Y_AXIS, yaw);
    const emit = (u: number, y: number, out: number, w: number, h: number, d: number, color: number, role: string, list = p.stone) => {
      list.push({ position: [a[0] + dx * u / length + nx * out, y, a[1] + dz * u / length + nz * out], size: [w, h, d], rotation: q.clone(), color, role, outward: [nx, nz] });
    };
    if (i === 0 || i === 11) {
      // Both projecting foyer returns continue the double-height glass and
      // moulded arch language, rather than receiving office-storey windows.
      const at = (u: number, y: number, out: number): P3 => [a[0] + dx * u / length + nx * out, y, a[1] + dz * u / length + nz * out];
      for (let bay = 0; bay < 3; bay++) {
        const u = (bay + .5) * length / 3;
        emit(u, BASE + 9.3, .36, 3.9, 10.5, .12, C.dark, "foyer-return-recess", p.glass);
        for (const side of [-1, 1]) {
          emit(u + side * .55, BASE + 9.3, .65, .9, 10.1, .12, C.glass, "foyer-return-pane", p.glass);
          emit(u + side * 1.06, BASE + 9.3, .76, .16, 10.5, .24, C.light, "foyer-return-mullion");
          emit(u + side * 2.5, BASE + 9.9, .18, .22, 19.1, .22, C.light, "foyer-return-pilaster");
          const rows = mobile ? 10 : 20, cols = mobile ? 2 : 3;
          for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
            const y = BASE + 4.47 + row * 9.62 / (rows - 1);
            if (Math.abs(y - (BASE + 8.9)) < .32) continue;
            emit(u + side * (1.25 + col * .22), y, .65,
              mobile ? .25 : .16, 9.62 / rows * .72, .12, [0xbecbc3, 0x96a9b1, 0xc4bca9][(row + col) % 3], "foyer-return-glass-aggregate", p.glass);
          }
        }
        for (const [rx, ry, y] of [[2.48, 2.7, 15.7], [2.2, 2.35, 15.7], [1.05, 1.08, 14.65]] as const) for (let k = 0; k < subdivisions; k++) {
          const start = k * Math.PI / subdivisions, end = (k + 1) * Math.PI / subdivisions;
          line(p.stone, at(u + rx * Math.cos(start), BASE + y + ry * Math.sin(start), .42), at(u + rx * Math.cos(end), BASE + y + ry * Math.sin(end), .42), .13, C.light, "foyer-return-arch");
          p.stone.at(-1)!.outward = [nx, nz];
        }
        for (const y of [4, 8.9, 14.6]) emit(u, BASE + y, .75, 4.05, .28, .28, C.light, "foyer-return-transom");
        emit(u, BASE + 1.8, .46, 3.9, 3.1, .15, C.dark, "foyer-return-display", p.glass);
      }
      continue;
    }
    const bays = Math.max(1, Math.round(length / 2));
    for (let bay = 0; bay < bays; bay++) {
      const u = (bay + .5) * length / bays;
      emit(u, BASE + 10, .15, .06, 19.8, .06, C.seam, "two-metre-panel-joint");
      for (let row = 0; row < 4; row++) {
        emit(u, BASE + 3 + row * 4.1, .24, 1.14, 2.55, .12, C.glass, "function-wing-window", p.glass);
        emit(u, BASE + 1.51 + row * 4.1, .26, 1.36, .2, .21, C.light, "function-window-sill");
        if (!mobile) emit(u, BASE + 3 + row * 4.1, .34, .075, 2.55, .08, C.light, "function-window-mullion");
      }
    }
    for (const y of [4.5, 8.6, 12.7, 16.8, 19.5]) emit(length / 2, BASE + y, .14, length, .16, .17, C.seam, "function-wing-course");
  }
  // Stage tower stands within its unchanged published height. Local depth and
  // arrangement follow the prior model, not newly asserted survey evidence.
  box(p.stone, -1.5, BASE + 26, -62, 23, 12, 31, C.stone, "stage-tower-body");
  box(p.stone, -1.5, BASE + 32.12, -62, 23.7, .24, 31.7, C.light, "stage-tower-coping");
  for (let u = -12; u <= 9; u += 2) {
    box(p.stone, u, BASE + 26, -46.42, .075, 11.8, .065, C.seam, "stage-tower-panel-joint");
    box(p.glass, u, BASE + 23.9, -46.37, 1.23, 1.7, .1, C.dark, "stage-ventilation");
  }
  for (let out = -73; out <= -50; out += mobile ? 8 : 4) box(p.stone, -1.5, BASE + 32.25, out, 22.8, .035, .06, C.seam, "stage-roof-seam");
  for (let step = 0; step < 4; step++) box(p.stone, 0, BASE + .045 + step * .055, 3.2 + (3 - step) * .45, 17.5, .09 + step * .11, .85, C.light, "entrance-stair");
  lettering(p);
  // The exact source includes a shallow central vestibule projection. Place
  // its glazing and entrance on the exterior of that actual source skin.
  for (const b of [...p.stone, ...p.glass]) {
    if (b.outward || b.position[1] > BASE + 20) continue;
    const [u, out] = localAt(b.position[0], b.position[2]);
    if (Math.abs(u) <= 2.5 && out > 0 && out < 2) {
      const shift = b.role.includes("vitrine") ? 1.15 : 2.05;
      b.position = palastFacadePoint(u, b.position[1], out + shift);
    }
  }
  if (minecraft) {
    // Small decorative diagonal strokes become axis-aligned blocks. Keep the
    // same bay count and lettering, even in the mobile profile.
    for (const list of [p.stone, p.glass, p.sign]) for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (b.role === "stage-tower-body") continue;
      if (b.role.includes("arch") || b.role.includes("keyhole-tail") || b.role.includes("relief-") || b.role.includes("fan-") || b.role === "roof-sign-brace") {
        // Connected small cubes retain the actual line endpoints; a whole
        // line's bounding rectangle would incorrectly fill the roof fan.
        const direction = new Vector3(0, 1, 0).applyQuaternion(b.rotation);
        const cell = Math.max(.16, Math.min(.42, b.size[0] * 1.5));
        const count = Math.max(1, Math.ceil(b.size[1] / cell));
        list.splice(i, 1);
        for (let j = 0; j < count; j++) {
          const offset = ((j + .5) / count - .5) * b.size[1];
          list.push({ ...b, position: [b.position[0] + direction.x * offset, b.position[1] + direction.y * offset, b.position[2] + direction.z * offset],
            size: [cell, cell, cell], rotation: new Quaternion() });
        }
      }
    }
  }
  return p;
}

function batch(boxes: PalastBox[], name: string, emissive = false): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .78 });
  if (emissive) { night.userData.nightEmissive = 0xbcd1be; night.userData.nightEmissiveIntensity = .28; }
  const mesh = new InstancedMesh(geometry, day, boxes.length);
  const m = new Matrix4(), c = new Color(), v = new Vector3(), scale = new Vector3();
  boxes.forEach((b, i) => { m.compose(v.set(...b.position), b.rotation, scale.set(...b.size)); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.setHex(b.color)); });
  mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.name = name; mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  return mesh;
}
function mainBody(): Group {
  const shape = new Shape();
  FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  const builder = createBuilder();
  for (const [y, height, color] of [[BASE, 20, C.stone], [BASE + 20, .2, C.roof]]) {
    const raw = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    raw.rotateX(-Math.PI / 2); raw.translate(0, y, 0); raw.deleteAttribute("uv");
    const geometry = mergeVertices(raw); raw.dispose(); paintGeometry(geometry, color); builder.parts.push(geometry);
  }
  return finishDrawnGroup(builder, { name: "Friedrichstadt-Palast exact OSM main envelope" })!;
}
export function createFriedrichstadtPalast(detailProfile: PalaceDetailProfile = "full"): Group {
  const root = new Group(), p = planFriedrichstadtPalast(detailProfile);
  root.name = FRIEDRICHSTADT_PALAST_ROOT_NAME;
  root.userData = { detailProfile, geometryStatus: FRIEDRICHSTADT_PALAST_PROFILE.geometryStatus, objectProfile: FRIEDRICHSTADT_PALAST_PROFILE, sourceBound: true, textureFree: true, runtimeAssets: [], sourceUrls: FRIEDRICHSTADT_PALAST_PROFILE.sourceUrls };
  root.add(mainBody(), batch(p.stone, "Friedrichstadt-Palast concrete frames and roof"));
  const glass = batch(p.glass, FRIEDRICHSTADT_PALAST_GLASS_LAYER_NAME, true);
  glass.userData = { ...glass.userData, officialGlassBlockCount: 22_500, proceduralAggregate: true, facadeAxes: 9 };
  const sign = batch(p.sign, FRIEDRICHSTADT_PALAST_SIGN_LAYER_NAME, true);
  sign.userData = { ...sign.userData, text: "FRIEDRICHSTADT PALAST", proceduralGlyphGrid: [5, 7], readingDirection: "southward, left to right viewed from Friedrichstrasse" };
  root.add(glass, sign); return root;
}
function minecraftBody(): PalastBox[] {
  const list: PalastBox[] = [], occupied = new Set<string>();
  const emit = (x: number, z: number, y: number, size: P3, color: number, role: string) => list.push({ position: [x, y, z], size, rotation: new Quaternion(), color, role });
  // One-cell perimeter shell and roof tiles only: no hidden interior fill.
  const ring = FRIEDRICHSTADT_PALAST_FOOTPRINT_WORLD;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.ceil(length * 1.5);
    for (let j = 0; j <= n; j++) {
      const x = Math.floor(a[0] + (b[0] - a[0]) * j / n) + .5;
      const z = Math.floor(a[1] + (b[1] - a[1]) * j / n) + .5;
      const key = `${x}:${z}`; if (occupied.has(key)) continue; occupied.add(key);
      for (let y = 0; y < 10; y++) emit(x, z, BASE + y * 2 + 1, [1, 2, 1], y % 2 ? C.stone : 0xbab9ad, "block-perimeter-shell");
    }
  }
  for (let x = 1133; x < 1246; x += 2) for (let z = -575; z < -490; z += 2) {
    if (friedrichstadtPalastContains(x + 1, z + 1)) emit(x + 1, z + 1, BASE + 20.1, [2, .2, 2], C.roof, "block-roof-surface");
  }
  return list;
}
export function createMinecraftFriedrichstadtPalast(detailProfile: PalaceDetailProfile = "full"): Group {
  const root = new Group(), p = planFriedrichstadtPalast(detailProfile, true);
  root.name = FRIEDRICHSTADT_PALAST_MINECRAFT_NAME;
  root.userData = { detailProfile, sourceBound: true, textureFree: true, runtimeAssets: [], minecraftNative: true };
  // Move front details beyond the one-metre source-aligned block skin.
  for (const b of [...p.stone, ...p.glass, ...p.sign]) {
    if (b.outward) {
      b.position = [b.position[0] + b.outward[0] * .82, b.position[1], b.position[2] + b.outward[1] * .82];
      continue;
    }
    const [u, out] = localAt(b.position[0], b.position[2]);
    if (Math.abs(u) < 25 && out >= 0) b.position = palastFacadePoint(u, b.position[1], out + .8);
  }
  const blocks = [...minecraftBody(), ...p.stone, ...p.glass, ...p.sign];
  root.add(batch(blocks, "Friedrichstadt-Palast Minecraft surface blocks"));
  root.userData.blockCount = blocks.length;
  return root;
}
export function setFriedrichstadtMinecraftPresentation(root: Object3D, minecraft: boolean): void {
  const smooth = root.getObjectByName(FRIEDRICHSTADT_PALAST_ROOT_NAME);
  const blocks = root.getObjectByName(FRIEDRICHSTADT_PALAST_MINECRAFT_NAME);
  if (smooth) smooth.visible = !minecraft;
  if (blocks) blocks.visible = minecraft;
}
