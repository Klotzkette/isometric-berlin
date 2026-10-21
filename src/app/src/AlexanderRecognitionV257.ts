import source from "./data/alexanderRecognitionV257.json";
import { letteringStrokePaths } from "./drawnLettering";
import { FERNSEHTURM_PAVILION_ROOFS, FERNSEHTURM_PAVILION_ENCLOSED } from "./fernsehturmPavilionProfile";

type Vec = [number, number, number];
type Face = { a: number[]; b: number[]; normal: number[]; bottom: number; top: number };
interface Parts {
  minecraft: boolean;
  box(p: Vec, size: Vec, tint: number, yaw?: number): void;
  line(a: Vec, b: Vec, diameter: number, tint?: number): void;
}
const C = { stone: 0x53585a, joint: 0x41494a, glass: 0x829b9e, darkGlass: 0x536a71,
  silver: 0xc8cfca, brown: 0x94745c, warm: 0xad9274, cream: 0xd9d1ba, dark: 0x3e5054, red: 0xda5042 };
export const ALEXANDER_RECOGNITION_V257 = source;

function length(f: Face) { return Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); }
function at(f: Face, u: number, y: number, out = 0): Vec {
  const l = length(f);
  return [f.a[0] + (f.b[0] - f.a[0]) * u / l + f.normal[0] * out, y,
    f.a[1] + (f.b[1] - f.a[1]) * u / l + f.normal[1] * out];
}

/** Independent orthogonal surface strips; never rotate drawn boxes into native mode. */
function facade(b: Parts, f: Face, u: number, y: number, w: number, h: number, tint: number, out = .4, depth = .09) {
  const l = length(f), dx = (f.b[0] - f.a[0]) / l, dz = (f.b[1] - f.a[1]) / l;
  if (!b.minecraft) { b.box(at(f, u, y, out), [w, h, depth], tint, -Math.atan2(dz, dx)); return; }
  const count = Math.max(1, Math.ceil(w / 1.0));
  for (let i = 0; i < count; i++) b.box(at(f, u - w / 2 + (i + .5) * w / count, y, out + 1.1),
    [Math.max(.075, Math.abs(dx) * w / count + Math.abs(f.normal[0]) * depth), h,
      Math.max(.075, Math.abs(dz) * w / count + Math.abs(f.normal[1]) * depth)], tint);
}
function segment(b: Parts, a: Vec, c: Vec, width: number, tint: number) {
  if (!b.minecraft) { b.line(a, c, width, tint); return; }
  const n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) / Math.max(width, .16)));
  for (let i = 0; i < n; i++) b.box(a.map((v, k) => v + (c[k] - v) * (i + .5) / n) as Vec,
    [Math.max(width, Math.abs(c[0] - a[0]) / n), Math.max(width, Math.abs(c[1] - a[1]) / n),
      Math.max(width, Math.abs(c[2] - a[2]) / n)], tint);
}
function label(b: Parts, f: Face, text: string, u: number, y: number, height: number, tint: number, out = .7) {
  const paths = letteringStrokePaths(text, height), points = paths.flat();
  const mid = (Math.min(...points.map(p => p[0])) + Math.max(...points.map(p => p[0]))) / 2;
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    segment(b, at(f, u + path[i - 1][0] - mid, y + path[i - 1][1], out + (b.minecraft ? 1.1 : 0)),
      at(f, u + path[i][0] - mid, y + path[i][1], out + (b.minecraft ? 1.1 : 0)), height * .105, tint);
  }
}
function bay(b: Parts, f: Face, u: number, bottom: number, w: number, h: number, tint: number, out: number) {
  facade(b, f, u, bottom + h / 2, w, h, tint, out);
  for (const y of [bottom, bottom + h]) facade(b, f, u, y, w + .15, .14, C.silver, out + .12, .16);
  for (const x of [-w / 2, w / 2]) facade(b, f, u + x, bottom + h / 2, .13, h, C.silver, out + .12, .16);
  const n = Math.ceil(w / 3.6);
  for (let i = 1; i < n; i++) facade(b, f, u - w / 2 + w * i / n, bottom + h / 2, .075, h, C.silver, out + .13);
  facade(b, f, u, bottom + h * .55, w, .075, C.silver, out + .13);
  facade(b, f, u, bottom - .22, w + .25, .25, C.joint, out - .05, .44);
}

function cubix(b: Parts) {
  // Every cladding backing is bounded by an actual retained vertical source face.
  for (const f of source.sites.cubix.faces) {
    const lo = Math.max(5.45, f.bottom + .03), hi = f.top - .05, l = length(f);
    if (hi <= lo) continue;
    facade(b, f, l / 2, (lo + hi) / 2, l - .04, hi - lo, C.stone, .32, .08);
    for (let y = lo + 1.45; y < hi; y += 1.45) facade(b, f, l / 2, y, l - .08, .025, C.joint, .38, .035);
  }
  // Measured front perimeter endpoints. Bay divisions/projections are photo fits.
  const front: Face = { a: [2768.343, -114.478], b: [2730.605, -86.038], normal: [-.6019, -.7986], bottom: 5.2, top: 34.727 };
  const side: Face = { a: [2790.845, -83.834], b: [2768.343, -114.478], normal: [.806, -.592], bottom: 5.2, top: 34.727 };
  // Three long projecting foyers, three short right-hand bays and three return bays.
  for (const [row, bottom, h] of [[0, 13.0, 4.5], [1, 18.2, 4.5], [2, 23.5, 7.0]]) {
    bay(b, front, 17.8, bottom, 32.8, h, row === 1 ? C.darkGlass : C.glass, 1.02);
    bay(b, front, 44, bottom, 5.7, h, 0xa1b5b2, .85);
    bay(b, side, 22.0, bottom, 31, h, row === 1 ? 0x718e96 : 0x91a7aa, .93);
  }
  bay(b, front, 9.0, 5.65, 15.4, 6.6, C.darkGlass, .8);
  bay(b, front, 28.4, 5.65, 18.1, 6.6, C.darkGlass, .8);
  for (const u of [25.4, 27.4, 29.4, 31.4]) {
    facade(b, front, u, 7.0, 1.72, 2.7, 0x829e9c, 1.06);
    facade(b, front, u + .70, 6.95, .06, .55, C.silver, 1.18);
  }
  // Poster frames use original abstract coloured fields, no film artwork/photos.
  for (const [y, tint] of [[15.8, 0xb18b58], [23.4, 0x7b8797]]) {
    facade(b, front, 38.4, y, 3.4, 6.4, C.joint, .75, .25);
    facade(b, front, 38.4, y, 2.95, 5.85, tint, .91);
    facade(b, front, 38.4, y - 2.1, 2.6, .25, C.cream, .99);
  }
  label(b, front, "CUBIX", 16.5, 31.65, 1.45, C.red, .64);
  label(b, side, "CUBIX", 27.0, 31.65, 1.45, C.red, .64);
}

function rathauspassagen(b: Parts) {
  for (const f of source.sites.rathauspassagen.faces) {
    const l = length(f), residential = f.part === "DEBE3DVE8ksXnT9L";
    if (residential) {
      // Ten repeated residential storeys above the low retail podium.
      const low = 18.8, high = 47.6;
      facade(b, f, l / 2, (low + high) / 2, l - .05, high - low, C.brown, .32, .08);
      if (l < 20) {
        for (let y = low + 1.8; y < high; y += 1.8) facade(b, f, l / 2, y, l - .1, .035, 0x705c4b, .4);
        for (let u = 2.1; u < l; u += 2.1) facade(b, f, u, (low + high) / 2, .035, high - low, 0x705c4b, .4);
        if (f.index === 37) for (const [i, letter] of Array.from("RATHAUS PASSAGEN").entries()) {
          if (letter !== " ") label(b, f, letter, l * .23, 45.7 - i * 1.56, 1.04, C.cream, .61);
        }
        continue;
      }
      const n = Math.round(l / 3.22), pitch = (l - .8) / n;
      for (let row = 0; row < 10; row++) {
        const y = 20.18 + row * 2.78;
        facade(b, f, l / 2, y - 1.2, l - .08, .15, C.warm, .46);
        for (let i = 0; i < n; i++) {
          const u = .4 + (i + .5) * pitch, w = pitch - .49;
          facade(b, f, u, y, w + .17, 1.92, C.cream, .52);
          facade(b, f, u, y + .04, w - .05, 1.64, (i + row) % 5 === 0 ? 0x9aaca7 : C.dark, .69);
          facade(b, f, u + w * .12, y + .04, .09, 1.65, C.cream, .82);
          facade(b, f, u, y - .9, w + .23, .16, C.silver, .83, .27);
        }
      }
      facade(b, f, l / 2, 47.85, l - .05, .24, C.cream, .45, .23);
    } else {
      facade(b, f, l / 2, 11.0, l - .06, 10.7, 0xbcb7a8, .32);
      for (const y of [8.9, 12.45, 16.25]) facade(b, f, l / 2, y, l - .08, .25, C.cream, .56, .32);
      const n = Math.max(1, Math.round(l / 4.0)), pitch = l / n;
      for (let i = 0; i < n; i++) {
        const u = (i + .5) * pitch;
        facade(b, f, u, 7.1, pitch - .25, 3.0, i % 4 === 0 ? 0x819c99 : C.darkGlass, .62);
        facade(b, f, u, 10.7, pitch - .3, 2.75, C.glass, .62);
        facade(b, f, u, 14.15, pitch - .35, 2.7, 0x879b99, .62);
        facade(b, f, u, 7.1, .09, 3.0, C.silver, .78);
      }
      facade(b, f, l / 2, 8.72, l - .08, .16, C.silver, .92, .75);
    }
  }
}

function televisionEntrance(b: Parts) {
  // Accent measured folds rather than filling the open roof cantilevers.
  for (const part of FERNSEHTURM_PAVILION_ROOFS) for (const surface of part.surfaces) {
    if (surface.kind !== "RoofSurface") continue;
    const ring = surface.rings[0];
    if (ring.length < 3) continue;
    const c = ring.reduce((p, q) => p.map((v, k) => v + q[k] / ring.length), [0, 0, 0]);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], d = ring[(i + 1) % ring.length];
      if (Math.hypot(d[0] - a[0], d[2] - a[2]) < 6) continue;
      // Raised roof seam follows the original triangular plane exactly.
      segment(b, [c[0], c[1] + .13, c[2]], [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2 + .13, (a[2] + d[2]) / 2], .10, 0xaaa997);
    }
  }
  const part = FERNSEHTURM_PAVILION_ENCLOSED.find(p => p.id === "DEBE3DRdWybib9cr")!;
  const ring = part.surfaces[6].rings[0];
  const f: Face = { a: [ring[0][0], ring[0][2]], b: [ring[1][0], ring[1][2]], normal: [.9931, -.1174], bottom: 5.2, top: 17.317 };
  // Operator confirms the entrance opposite Alexanderplatz station. Keep doors
  // and the broad existing stair route open; lettering sits in the upper fascia.
  facade(b, f, length(f) / 2, 16.65, length(f) - .35, .82, 0xcbd0c5, .35);
  label(b, f, "BERLINER FERNSEHTURM", length(f) / 2, 16.39, .49, 0x475653, .49);
}

/** One existing block batch; identical full drawn detail on touch and desktop. */
export function appendAlexanderRecognitionV257(b: Parts) {
  cubix(b); rathauspassagen(b); televisionEntrance(b);
  return { ownerIds: Object.values(source.sites).map(s => s.parent), measuredEnvelopesRetained: true,
    fullStaticDetailOnTouch: true, nativeOrthogonal: b.minecraft, descriptorCountAdded: 0, drawCallsAdded: 0 };
}
