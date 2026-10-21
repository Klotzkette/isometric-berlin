import source from "./data/eastCinemasV260.json";
import { letteringStrokePaths } from "./drawnLettering";

type Vec = [number, number, number];
type Face = { a: number[]; b: number[]; normal: number[]; bottom?: number; top?: number };
export interface EastCinemaPartsV260 {
  minecraft: boolean;
  box(position: Vec, size: Vec, colour: number, yaw?: number): void;
  line(a: Vec, b: Vec, width: number, colour?: number): void;
  round?(position: Vec, size: Vec, colour?: number): void;
}
const C = { stone: 0xd9d6c9, pale: 0xe1ded2, dark: 0x55605b, glass: 0x6f8c8b,
  glassLight: 0x91a9a4, frame: 0xc9c8b5, gold: 0xbea265, relief: 0xc7c6b8, joint: 0xa6a699,
  mosaic: 0xa9a99a, silver: 0xbbc7c4 };
export const EAST_CINEMAS_V260 = source;
function length(f: Face): number { return Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); }
function point(f: Face, u: number, y: number, out = 0): Vec {
  const l = length(f);
  return [f.a[0] + (f.b[0] - f.a[0]) * u / l + f.normal[0] * out, y,
    f.a[1] + (f.b[1] - f.a[1]) * u / l + f.normal[1] * out];
}
function facade(b: EastCinemaPartsV260, f: Face, u: number, y: number, w: number, h: number,
  colour: number, out = .18, depth = .08): void {
  const l = length(f), dx = (f.b[0] - f.a[0]) / l, dz = (f.b[1] - f.a[1]) / l;
  if (!b.minecraft) { b.box(point(f, u, y, out), [w, h, depth], colour, -Math.atan2(dz, dx)); return; }
  const n = Math.max(1, Math.ceil(w / .8));
  for (let i = 0; i < n; i++) b.box(point(f, u - w / 2 + (i + .5) * w / n, y, out + 1.15),
    [Math.max(.075, Math.abs(dx) * w / n + Math.abs(f.normal[0]) * depth), h,
      Math.max(.075, Math.abs(dz) * w / n + Math.abs(f.normal[1]) * depth)], colour);
}
function segment(b: EastCinemaPartsV260, a: Vec, c: Vec, width: number, colour: number): void {
  if (!b.minecraft) { b.line(a, c, width, colour); return; }
  const n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) / .22));
  for (let i = 0; i < n; i++) b.box(a.map((v, k) => v + (c[k] - v) * (i + .5) / n) as Vec,
    [Math.max(width, Math.abs(c[0] - a[0]) / n), Math.max(width, Math.abs(c[1] - a[1]) / n),
      Math.max(width, Math.abs(c[2] - a[2]) / n)], colour);
}
function stroke(b: EastCinemaPartsV260, f: Face, path: number[][], u: number, y: number,
  scale: number, width: number, colour: number, out = .35): void {
  for (let i = 1; i < path.length; i++) segment(b,
    point(f, u + path[i - 1][0] * scale, y + path[i - 1][1] * scale, out + (b.minecraft ? 1.15 : 0)),
    point(f, u + path[i][0] * scale, y + path[i][1] * scale, out + (b.minecraft ? 1.15 : 0)), width, colour);
}
function label(b: EastCinemaPartsV260, f: Face, text: string, u: number, y: number,
  height: number, colour: number, out = .4): void {
  const paths = letteringStrokePaths(text, height), points = paths.flat();
  const mid = (Math.min(...points.map(p => p[0])) + Math.max(...points.map(p => p[0]))) / 2;
  // Source wall rings can run either way. Viewed from outside, screen-right is
  // (normal.z, -normal.x); keep the glyphs upright in that viewing basis.
  const direction = (f.b[0] - f.a[0]) * f.normal[1] - (f.b[1] - f.a[1]) * f.normal[0] >= 0 ? 1 : -1;
  for (const path of paths) stroke(b, f, path.map(([x, y]) => [direction * (x - mid), y]),
    u, y, 1, height * .09, colour, out);
}
function glass(b: EastCinemaPartsV260, f: Face, lo: number, hi: number, pitch: number): void {
  const l = length(f), n = Math.max(1, Math.round(l / pitch));
  facade(b, f, l / 2, (lo + hi) / 2, l - .16, hi - lo, C.glass);
  for (let i = 0; i <= n; i++) facade(b, f, .12 + (l - .24) * i / n, (lo + hi) / 2,
    .105, hi - lo + .12, C.frame, .3, .14);
  for (const y of [lo, hi]) facade(b, f, l / 2, y, l - .08, .13, C.frame, .31, .14);
  facade(b, f, l / 2, hi - .58, l - .2, .07, C.frame, .3, .1);
}
function cinema(b: EastCinemaPartsV260): void {
  const p = source.sites.international;
  const front: Face = { a: p.frontA, b: p.frontB, normal: p.inward.map(v => -v) };
  const l = length(front), floor = p.soffitY;
  glass(b, front, floor + .48, 17.55, 2.8);
  facade(b, front, l / 2, 18.75, l - .03, 2.05, C.pale, .13, .13);
  facade(b, front, l / 2, floor + .18, l - .02, .35, C.pale, .21, .25);
  facade(b, front, l / 2, 19.93, l + .06, .16, C.dark, .2, .28);
  for (const [i, letter] of Array.from("INTERNATIONAL").entries()) label(b, front, letter,
    l / 2 + (i - 6) * 2.05, 18.35, .9, C.gold, .38);
  // Abstract original poster fields only; no film artwork or current-film claim.
  facade(b, front, 5.1, 13.65, 5.3, 7.7, C.frame, .42, .14);
  facade(b, front, 5.1, 13.65, 4.9, 7.3, 0x536b72, .54);
  facade(b, front, 5.1, 16.6, 4.6, .55, C.pale, .59);
  facade(b, front, 5.1, 10.85, 4.6, .75, 0xb09f73, .59);
  stroke(b, front, [[-1,-1],[.6,1.2],[1.5,-.3]], 5.1, 13.5, 1, .38, 0x829d98, .66);
  // Lower foyer follows the actual cut plane, leaving the entire overhang open.
  const entry: Face = { a: p.frontA.map((v, i) => v + p.inward[i] * p.cantileverM),
    b: p.frontB.map((v, i) => v + p.inward[i] * p.cantileverM), normal: front.normal };
  glass(b, entry, 3.3, floor - .32, 2.95);
  for (const u of [l * .39, l * .47, l * .55, l * .63]) {
    facade(b, entry, u, 4.7, 2.25, 2.75, C.glassLight, .4);
    facade(b, entry, u, 6.28, 2.3, .3, C.pale, .42);
    facade(b, entry, u + .7, 4.6, .06, .7, C.gold, .53);
  }
  // The three unglazed upper sides have fourteen relief fields. Relief motifs
  // are original shallow sculptural impressions, not a tracing of the artworks.
  const sides: [Face, number][] = [
    [{ a: [3497.461, -144.495], b: p.frontA, normal: [-.8881, -.4595] }, 5],
    [{ a: [3528.736, -128.301], b: [3497.461, -144.495], normal: [.4595, -.8881] }, 4],
    [{ a: p.frontB, b: [3528.736, -128.301], normal: [.8881, .4595] }, 5],
  ];
  for (const [f, panels] of sides) {
    const len = length(f), pitch = len / panels;
    facade(b, f, len / 2, 14.5, len - .08, 10.7, C.pale, .11, .1);
    for (let i = 0; i < panels; i++) {
      const u = (i + .5) * pitch;
      facade(b, f, i * pitch, 14.5, .055, 10.6, C.joint, .2, .06);
      for (let k = 0; k < 3; k++) {
        const x = u + (k - 1) * pitch * .22, y = 10.3 + (k % 2) * 1.1;
        // Light angular heads, bent arms, upright and seated silhouettes.
        facade(b, f, x, y + 5.55, .66, .82, C.relief, .31, .16);
        stroke(b, f, [[0,5.1],[.32,3.2],[-.3,2.3],[.12,0]], x, y, 1, .28, C.relief);
        stroke(b, f, [[0,4.8],[-.9,3.6],[-1.2,4.8]], x, y, 1, .22, C.relief);
        stroke(b, f, [[.18,4.5],[1.0,3.8],[1.1,2.4]], x, y, 1, .21, C.relief);
        stroke(b, f, [[.25,2.6],[.85,1.7],[1.25,.4]], x, y, 1, .25, C.relief);
      }
      stroke(b, f, [[-1.4,0],[1.4,.3],[1.8,1.1]], u, 10.0, 1, .16, C.relief);
    }
    facade(b, f, len / 2, 19.98, len, .13, C.dark, .15, .16);
  }
}
function moskau(b: EastCinemaPartsV260): void {
  const p = source.sites.moskau;
  for (const f of p.faces) {
    const l = length(f), top = f.top - .18;
    if (top < 10) continue;
    const exterior = f.normal[1] < -.65 || f.normal[0] < -.7 || f.normal[0] > .7;
    // Atrium glazing stays on existing wall faces: never bridge the source hole.
    glass(b, f, 3.35, 7.25, exterior ? 3.6 : 3.0);
    glass(b, f, 8.05, top - .32, exterior ? 3.6 : 3.0);
    for (const y of [3.15, 7.65, top]) facade(b, f, l / 2, y, l - .03, y === 7.65 ? .63 : .29, C.pale, .34, .32);
    const n = Math.max(1, Math.round(l / 5.2));
    for (let i = 0; i <= n; i++) facade(b, f, .13 + (l - .26) * i / n,
      (3.1 + top) / 2, .22, top - 3.1, C.pale, .33, .24);
  }
  const north = p.faces.find(f => f.part === "DEBE3DUQ9zttyhg5" && f.index === 11)!;
  const west = p.faces.find(f => f.part === "DEBE3DPNUb0lyc6p" && f.index === 10)!;
  // The distinctive open diamond screen is a real relief in front of the glass.
  for (const [f, start, width] of [[north, 10.8, 8.6], [west, 3.0, 8.5]] as [Face, number, number][]) {
    facade(b, f, start + width / 2, 10.15, width, 3.8, C.dark, .42);
    const cols = Math.floor(width / .85);
    for (let row = 0; row < 4; row++) for (let col = 0; col < cols; col++) {
      const u = start + .45 + col * .85, y = 8.4 + row * .88;
      stroke(b, f, [[0,0],[.39,.44],[0,.88],[-.39,.44],[0,0]], u, y, 1, .095, C.pale, .58);
    }
  }
  // Bert Heller's entrance mosaic is indicated by a quiet material field;
  // no copyrighted image or detailed design is traced or sampled.
  facade(b, north, 3.3, 5.2, 6.0, 3.8, C.mosaic, .4);
  for (let i = 0; i < 9; i++) facade(b, north, .7 + i * .64, 4.8 + (i % 3) * .5,
    .38, 1.9, [0x84918a, 0xc7bc9e, 0x9ca798][i % 3], .46);
  label(b, north, "MOSKAU", 7.1, 13.35, 1.22, C.gold, .25);
  label(b, west, "CAFE RESTAURANT", 13.0, 13.05, .62, C.gold, .24);
  // Photograph-aligned corner support. Its position/height and replica diameter
  // are explicitly unmeasured display estimates, separate from LoD2 geometry.
  const mast: Vec = [3476.6, 13.0, -15.9], globe: Vec = [3476.6, 18.0, -15.9];
  segment(b, mast, globe, .085, C.silver);
  if (!b.minecraft && b.round) b.round(globe, [.72, .72, .72], C.silver);
  else {
    b.box(globe, [.55, .7, .55], C.silver);
    b.box(globe, [.7, .42, .7], C.silver);
  }
  for (const [dx, dz] of [[-.62,-.25],[.62,.25],[-.25,.62],[.25,-.62]])
    segment(b, [globe[0] + dx * .4, globe[1] + .1, globe[2] + dz * .4],
      [globe[0] + dx, globe[1] + 1.55, globe[2] + dz], .033, C.silver);
}
/** Existing texture-free batches; every drawn fitting is identical on mobile. */
export function appendEastCinemasV260(builder: EastCinemaPartsV260) {
  cinema(builder); moskau(builder);
  return { owners: [source.sites.international.parent, source.sites.moskau.parent],
    fullStaticDetailOnTouch: true, nativeOrthogonal: builder.minecraft,
    requiredCantileverReplacement: true, descriptorCountAdded: 0, drawCallsAdded: 0 };
}
