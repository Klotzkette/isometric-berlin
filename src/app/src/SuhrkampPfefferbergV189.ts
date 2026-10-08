import { Group } from "three";
import source from "./data/suhrkampPfefferbergV189.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const SUHRKAMP_PFEFFERBERG_V189_GROUP = "Suhrkamp and Pfefferberg source-wall recognition v189";
type Rows = number[][];
type Face = typeof source.faces[number];

/** Native members use short axis-aligned cuboids, with no smooth duplicate. */
function put(rows: Rows, native: boolean, f: Face, u: number, y: number,
  w: number, h: number, d: number, color: number, out = .19): void {
  const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], length = Math.hypot(dx, dz);
  const tx = dx / length, tz = dz / length;
  const x = f.a[0] + tx * u + f.normal[0] * out;
  const z = f.a[1] + tz * u + f.normal[1] * out;
  if (!native) { rows.push([x, y, z, w, h, d, -Math.atan2(tz, tx), color]); return; }
  const count = Math.max(1, Math.ceil(w / .8));
  for (let i = 0; i < count; i++) {
    const along = (i + .5) * w / count - w / 2;
    rows.push([x + tx * along, y, z + tz * along,
      Math.max(.09, Math.abs(tx) * w / count + Math.abs(tz) * d), h,
      Math.max(.09, Math.abs(tz) * w / count + Math.abs(tx) * d), color]);
  }
}

/** The two orientations deliberately have different window proportions. */
function suhrkamp(rows: Rows, native: boolean, f: Face): void {
  const length = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  const height = f.top - f.bottom;
  const residential = f.kind === "suhrkamp-residential";
  const floors = residential ? 4 : height > 22 ? 7 : height > 15 ? 5 : height > 8 ? 3 : 2;
  const floor = height / floors;
  const south = f.normal[1] > .8;
  const core = !residential && f.normal[0] < -.9;
  const metal = 0xc8cfca, dark = 0x45565a, glass = 0x739198, concrete = 0xb5b5a7;
  // The retained generic facade includes projecting windows and cornices.
  // Cover only this measured wall rectangle, with its outward source normal;
  // source sheets and earlier details stay intact behind the local facing.
  put(rows, native, f, length / 2, (f.bottom + f.top) / 2,
    length - .04, height - .04, .10, core ? concrete : metal, .52);
  const member = (u: number, y: number, w: number, h: number, d: number,
    color: number, out: number): void => put(rows, native, f, u, y, w, h, d, color, out + .52);
  if (core) {
    member(length / 2, (f.bottom + f.top) / 2,
      length - .12, height - .12, .055, concrete, .13);
    for (let level = 1; level < floors; level++) {
      member(length / 2, f.bottom + level * floor, length - .1, .045, .08, 0x929c95, .18);
    }
    // The western concrete stair core is flanked by large corner windows.
    member(length * .16, (f.bottom + f.top) / 2,
      Math.min(1.7, length * .26), height - 1.2, .06, glass, .19);
    return;
  }
  const bays = Math.max(1, Math.round(length / (south || residential ? 5.9 : 2.8)));
  const pitch = length / bays;
  for (let level = 0; level < floors; level++) {
    const bottom = f.bottom + level * floor;
    const band = level === 0 ? .20 : .60;
    member(length / 2, bottom + band / 2,
      length - .08, band, .11, metal, .22);
    for (let bay = 0; bay < bays; bay++) {
      const w = pitch - (south ? .26 : residential ? .66 : .93);
      const center = (bay + .5) * pitch;
      member(center, bottom + (floor + band) / 2,
        w, floor - band - .15, .045, (level + bay) % 4 === 0 ? 0x829c9e : glass, .15);
      // North-facing editorial offices have narrow vertical operable panels;
      // broad square-facing panes keep only one fine dark side mullion.
      member(center + w / 2, bottom + (floor + band) / 2,
        south ? .075 : .11, floor - band - .12, .085, dark, .23);
      if (!south && !residential) member(center + w * .2,
        bottom + (floor + band) / 2, .065, floor - band - .12, .07, metal, .23);
      member(bay * pitch + .055, bottom + floor / 2,
        .12, floor - .04, .12, metal, .21);
    }
  }
  member(length / 2, f.top - .10, length - .05, .20, .20, metal, .25);
}

function brewery(rows: Rows, native: boolean, f: Face): void {
  const length = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  const height = f.top - f.bottom;
  const terrace = f.kind === "pfefferberg-terrace";
  const hostel = f.kind === "pfefferberg-hostel";
  const hall = f.kind === "pfefferberg-hall" || f.kind === "pfefferberg-house13";
  const plaster = hall ? 0xd4b8a0 : terrace ? 0xc7c5b6 : 0xc7bd83;
  const frame = hostel ? 0x8f6449 : 0x685143;
  const cornice = hostel ? 0xb08762 : 0xded4b6;
  // The terrace stays an honest shallow relief on its retained source shell.
  // No dark fake sky openings or unsupported upper landing is emitted.
  if (terrace) {
    for (const [y, h, d] of [[f.top - .16, .26, .30], [f.top - .48, .13, .21], [f.bottom + .26, .30, .20]]) {
      put(rows, native, f, length / 2, y, length - .04, h, d, cornice, .20);
    }
    const count = Math.max(1, Math.round(length / 4.4));
    for (let i = 0; i <= count; i++) {
      const u = .24 + (length - .48) * i / count;
      put(rows, native, f, u, (f.bottom + f.top) / 2, .45, height - .60, .17, plaster, .21);
      put(rows, native, f, u, f.top - .75, .73, .22, .27, cornice, .26);
    }
    return;
  }
  // Small upper roof-wall fragments receive only a source-aligned lip.
  if (f.bottom > 8) {
    put(rows, native, f, length / 2, f.bottom + .10, length - .1, .16, .20, cornice, .19);
    return;
  }
  const floors = hostel ? 3 : hall ? 1 : 2;
  const floor = height / floors;
  const bays = Math.max(1, Math.round(length / (hall ? 4.2 : hostel ? 3.8 : 4.6)));
  const pitch = length / bays;
  for (let level = 0; level < floors; level++) {
    const y = f.bottom + level * floor;
    const openingHeight = hall ? Math.min(5.4, floor - 1.6) : Math.min(3.4, floor - 1.3);
    const bottom = y + (hall ? .28 : .95);
    for (let i = 0; i < bays; i++) {
      const u = (i + .5) * pitch, width = Math.min(hall ? 2.4 : 1.75, pitch * .58);
      put(rows, native, f, u, bottom + openingHeight / 2, width + .30, openingHeight + .27, .13, plaster, .18);
      put(rows, native, f, u, bottom + openingHeight / 2, width, openingHeight, .055, 0x526970, .27);
      for (const side of [-1, 1]) put(rows, native, f, u + side * width * .46,
        bottom + openingHeight / 2, .085, openingHeight, .10, frame, .32);
      put(rows, native, f, u, bottom + openingHeight * .69, width, .09, .09, frame, .33);
      put(rows, native, f, u, bottom - .07, width + .34, .13, .30, cornice, .29);
      if (hostel) put(rows, native, f, u, bottom + openingHeight + .15,
        width + .34, .20, .21, 0xa67c56, .24);
    }
    if (level) put(rows, native, f, length / 2, y + .08,
      length - .05, .16, .22, cornice, .24);
  }
  put(rows, native, f, length / 2, f.top - .2, length - .05, .26, .34, cornice, .25);
  put(rows, native, f, length / 2, f.top - .47, length - .1, .12, .23, plaster, .20);
  // Existing stone/plaster volumes remain; narrow brick piers and banding
  // distinguish the former factory hostel from the low peach-coloured hall.
  if (hostel) for (let i = 0; i <= bays; i++) {
    put(rows, native, f, .17 + (length - .34) * i / bays,
      (f.bottom + f.top) / 2, .23, height - .64, .14, 0x9c6b40, .19);
  }
}

/** Two bounded site batches; every drawn device profile receives full detail. */
export function createSuhrkampPfefferbergV189(native = false): Group {
  const root = new Group();
  root.name = SUHRKAMP_PFEFFERBERG_V189_GROUP;
  root.userData = { additiveOnly: true, sourceGeometryRetained: true, textureFree: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
    fullStaticDetailOnTouch: true, sourceSha256: source.sourceSha256,
    sourceParentIds: source.ownerIds, sourcePartCount: source.sourcePartCount,
    sourceSheetCount: source.sourceSheetCount, sourceStatus: source.policy };
  for (const site of ["suhrkamp", "pfefferberg"] as const) {
    const rows: Rows = [];
    const sourceFaceRanges: { faceIndex: number; first: number; skinCount: number; count: number }[] = [];
    for (const [faceIndex, face] of source.faces.entries()) {
      if (!face.kind.startsWith(site)) continue;
      const first = rows.length;
      if (site === "suhrkamp") suhrkamp(rows, native, face); else brewery(rows, native, face);
      if (site === "suhrkamp") sourceFaceRanges.push({ faceIndex, first,
        skinCount: native ? Math.ceil((face.length - .04) / .8) : 1, count: rows.length - first });
    }
    const mesh = justicePalaceV183Boxes(rows, native);
    mesh.name = site === "suhrkamp" ? "Suhrkamp aluminium ribbons, fixed glazing and concrete stair core" : "Pfefferberg hall openings, brick piers and terrace facade profiles";
    mesh.userData.site = site;
    if (site === "suhrkamp") mesh.userData.sourceFaceRanges = sourceFaceRanges;
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
