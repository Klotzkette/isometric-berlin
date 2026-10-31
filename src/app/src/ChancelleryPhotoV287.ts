import { CHANCELLERY_ENTRANCE_PROFILE } from "./ChancelleryEntranceProfile";
import nativeFaces from "./data/chancelleryNativeFacesV287.json";

export const CHANCELLERY_NATIVE_FACES_V287 = nativeFaces;

/** Admit only the frozen, bounded delivered column inventory. Unrelated cells
 * outside these two facade/support corridors have no ownership here. Selected
 * compact rows are read through data descriptors, never coordinate getters. */
export function matchesNativeChancellerySourceV287(payload: unknown): boolean {
  const absent = Symbol("missing native source data");
  const data = (object: unknown, key: PropertyKey): unknown => {
    if (!object || typeof object !== "object") return absent;
    const d = Object.getOwnPropertyDescriptor(object, key);
    return d?.enumerable === true && "value" in d ? d.value : absent;
  };
  const array = (value: unknown): unknown[] | undefined => {
    if (!Array.isArray(value)) return;
    const d = Object.getOwnPropertyDescriptor(value, "length");
    if (!d || !("value" in d) || !Number.isInteger(d.value) || d.value < 0 || d.value > 10000 || Reflect.ownKeys(value).length !== d.value + 1) return;
    const values = Array.from({ length: d.value }, (_, i) => data(value, String(i)));
    return values.includes(absent) ? undefined : values;
  };
  try {
    if (data(payload, "cell_m") !== nativeFaces.cellM || data(payload, "schema_version") !== nativeFaces.sourceSchema) return false;
    const grid = data(payload, "grid");
    if (data(grid, "min_x_idx") !== nativeFaces.gridOrigin[0] || data(grid, "min_z_idx") !== nativeFaces.gridOrigin[1]) return false;
    const classes = array(data(payload, "classes"));
    if (!classes || classes.length !== nativeFaces.classes.length || classes.some((v, i) => v !== nativeFaces.classes[i])) return false;
    const rows = data(payload, "building_rows");
    if (!Array.isArray(rows)) return false;
    const found: number[][] = [], bounds = nativeFaces.bounds;
    for (let iz = bounds.minZIdx; iz <= bounds.maxZIdx; iz++) {
      const row = array(data(rows, String(iz - nativeFaces.gridOrigin[1]))); if (!row) return false;
      for (const value of row) {
        const run = array(value);
        if (!run || run.length !== 5 || !run.every(v => typeof v === "number" && Number.isInteger(v))) return false;
        const [offset, length, bottom, top, kind] = run as number[];
        if (length <= 0 || length > 10000 || kind < 0 || kind >= classes.length || top < bottom) return false;
        const start = nativeFaces.gridOrigin[0] + offset;
        for (let ix = Math.max(bounds.minXIdx, start); ix < Math.min(bounds.maxXIdx + 1, start + length); ix++) found.push([ix, iz, bottom, top, kind]);
      }
    }
    return found.length === nativeFaces.sourceColumns.length && found.every((row, i) => row.every((v, j) => v === nativeFaces.sourceColumns[i][j]));
  } catch { return false; }
}

type Vec = [number, number, number];
export type ChancelleryPhotoSignatureV287 = {
  anchor_world: readonly number[];
  rotation_y_degrees: number;
  cube_width_m: number;
  cube_offset_world: readonly number[];
  forecourt_offset_world?: readonly number[] | null;
  office_segments: readonly { width_m: number; depth_m: number; height_m: number; offset_world: readonly number[] }[];
};
export type ChancelleryPhotoPartsV287 = {
  native: boolean;
  /** World coordinates. Native members always pass yaw=0. */
  box(position: Vec, size: Vec, tint: number, yaw?: number): void;
};
export type ChancelleryPhotoReceiptV287 = {
  count: number; wallCount: number; openingCount: number; leafCount: number; stemCount: number; pierCount: number;
};
export type ChancelleryPhotoOpeningV287 = {
  kind: "louvred-window" | "slit";
  minX: number; maxX: number; minY: number; maxY: number;
};
export type ChancelleryPhotoPlaneV287 = {
  segmentIndex: number; sourceZ: number; towardCourt: number;
  minX: number; maxX: number; minY: number; maxY: number;
  openings: ChancelleryPhotoOpeningV287[];
};

export const CHANCELLERY_PHOTO_V287 = {
  photoEvidenceId: "chancellery-owner-photos-v287",
  sourcePhotoNumbers: [2, 5, 6, 7, 8],
  geometryStatus: "Retained office-segment planes, source rotation, roof/end bounds and two existing colonnade-end anchors; facade fitting dimensions and irregular climbing cover are owner-photo display estimates, not a survey. Summer green follows the owner's explicit request.",
  interpretedSeason: "green foliage by explicit owner request",
  sourceGeometryRetained: true,
  fullStaticDetailOnTouch: true,
  textureFree: true,
  automaticOldGeometryRetirement: false,
  nativeDisplayFit: "Facade courses follow the frozen retained 4 m column exterior; two low green strips clad existing native front-support inner faces. This support mapping is a block recognition interpretation, not an identification of the photographed planted shafts with the full leadership pylons.",
  minLocalXM: 104,
  wallFaceOffsetM: .32,
  wallThicknessM: .10,
  maxWallSkinOffsetM: .35,
  mainOpeningWidthM: 5.8,
  mainOpeningBottomM: 4.5,
  mainOpeningTopM: 14.4,
  lowerGlazingTopM: 7.45,
  slitWidthM: .65,
  slitOffsetXM: 5.3,
  slitTopM: 15.1,
  climbingCoverTopM: 16.55,
  colonnadeEndOffsetsM: [-23, 23],
  colonnadeForwardM: 27.2,
  colonnadeCoverTopM: 15.15,
  maxInstancesPerMode: 3000,
  tint: { stone: 0xe9e9e1, reveal: 0x646f68, glazing: 0x809e9c, frame: 0xa0aaa2, louvre: 0x3e5552, stem: 0x5d6250, leaves: [0x436641, 0x557b47, 0x668750, 0x3c5f3c] },
} as const;
const P = CHANCELLERY_PHOTO_V287;

/** This finite owner inventory is deliberately narrower than a generic wall
 * generator. Changed source frames keep their earlier complete host fallback. */
export function matchesChancelleryPhotoV287(s: ChancelleryPhotoSignatureV287): boolean {
  const absent = Symbol("missing data descriptor");
  const data = (object: unknown, key: PropertyKey): unknown => {
    if (typeof object !== "object" || object === null) return absent;
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor?.enumerable === true && "value" in descriptor ? descriptor.value : absent;
  };
  const array = (value: unknown, length: number): unknown[] | undefined => {
    if (!Array.isArray(value)) return;
    const descriptor = Object.getOwnPropertyDescriptor(value, "length"), keys = Reflect.ownKeys(value);
    if (!descriptor || !("value" in descriptor) || descriptor.value !== length || keys.length !== length + 1 || keys.some(key => key !== "length" && (typeof key !== "string" || !Array.from({ length }, (_, i) => String(i)).includes(key)))) return;
    const values = Array.from({ length }, (_, i) => data(value, String(i)));
    return values.includes(absent) ? undefined : values;
  };
  const same = (value: unknown, expected: readonly number[]): boolean => {
    const values = array(value, expected.length);
    return !!values && expected.every((v, i) => values[i] === v);
  };
  try {
    const segments = array(data(s, "office_segments"), 3);
    return same(data(s, "anchor_world"), [-220.236, 1.554, -145.806]) && data(s, "rotation_y_degrees") === -1.337 && data(s, "cube_width_m") === 55.211 &&
      same(data(s, "cube_offset_world"), [66.373, 0, .042]) && same(data(s, "forecourt_offset_world"), [158.413, 0, -7.51]) && !!segments &&
      segments.every((segment, i) => {
        const expected = [[219.532, 23.463, 61.563, 39.306], [203.2, 23.536, 69.738, -39.269], [135.151, 21.027, -103.762, 40.523]][i];
        return data(segment, "width_m") === expected[0] && data(segment, "depth_m") === expected[1] && data(segment, "height_m") === 18 && same(data(segment, "offset_world"), [expected[2], 0, expected[3]]);
      });
  } catch {
    return false;
  }
}

/** Only the two photographed east Ehrenhof inner faces. Four large openings
 * and their narrow companion slits are a bounded recognition fitting; their
 * spacing is not claimed as LoD2 opening data. */
export function chancelleryPhotoPlanesV287(s: ChancelleryPhotoSignatureV287): ChancelleryPhotoPlaneV287[] {
  if (!matchesChancelleryPhotoV287(s)) throw new Error("Chancellery photo detail requires its retained metric owner frame");
  return s.office_segments.slice(0, 2).map((segment, segmentIndex) => {
    const side = Math.sign(segment.offset_world[2]), minX = P.minLocalXM;
    const maxX = segment.offset_world[0] + segment.width_m / 2 - .7;
    const openings: ChancelleryPhotoOpeningV287[] = [];
    for (let bay = 0; bay < 4; bay++) {
      const x = minX + (bay + .5) * (maxX - minX) / 4;
      openings.push({ kind: "louvred-window", minX: x - P.mainOpeningWidthM / 2, maxX: x + P.mainOpeningWidthM / 2, minY: P.mainOpeningBottomM, maxY: P.mainOpeningTopM });
      openings.push({ kind: "slit", minX: x + P.slitOffsetXM - P.slitWidthM / 2, maxX: x + P.slitOffsetXM + P.slitWidthM / 2, minY: P.mainOpeningBottomM, maxY: P.slitTopM });
    }
    return { segmentIndex, sourceZ: segment.offset_world[2] - side * segment.depth_m / 2, towardCourt: -side, minX, maxX, minY: CHANCELLERY_ENTRANCE_PROFILE.groundWorldY - s.anchor_world[1], maxY: 16.7, openings };
  });
}

type Rect = { minX: number; maxX: number; minY: number; maxY: number };
function intersect(a: Rect, b: Rect): Rect | undefined {
  const r = { minX: Math.max(a.minX, b.minX), maxX: Math.min(a.maxX, b.maxX), minY: Math.max(a.minY, b.minY), maxY: Math.min(a.maxY, b.maxY) };
  return r.maxX - r.minX > .00001 && r.maxY - r.minY > .00001 ? r : undefined;
}
function cut(rect: Rect, holes: readonly Rect[]): Rect[] {
  let pieces = [rect];
  for (const hole of holes) pieces = pieces.flatMap(p => {
    const h = intersect(p, hole); if (!h) return [p];
    return [
      { minX: p.minX, maxX: h.minX, minY: p.minY, maxY: p.maxY },
      { minX: h.maxX, maxX: p.maxX, minY: p.minY, maxY: p.maxY },
      { minX: h.minX, maxX: h.maxX, minY: p.minY, maxY: h.minY },
      { minX: h.minX, maxX: h.maxX, minY: h.maxY, maxY: p.maxY },
    ].filter(r => r.maxX - r.minX > .025 && r.maxY - r.minY > .025);
  });
  return pieces;
}
const lobes = [[3, 3, 3.9, 4.2], [8, 8, 2.2, 5.4], [15, 2, 4.2, 2.8], [22, 6, 3.9, 5], [29, 9, 2.4, 4], [35, 3.1, 4.8, 3.5], [43, 7.5, 3.7, 5.1], [51, 2.7, 4.8, 3.2], [57, 7, 3.1, 5.2], [64, 10.3, 2.5, 3.7]];
function coverAt(u: number, v: number, side: number): boolean {
  return lobes.some(([x, y, rx, ry], i) => {
    const dx = u - x - (side ? Math.sin(i * 2.1) * 1.1 : 0), dy = v - y;
    // A second harmonic gives each lobe an uneven climbing edge, independent
    // of the sampling grid and without a rectangular green underlay.
    const edge = 1 + .17 * Math.sin(u * 2.1 + v * 1.7 + i) + .12 * Math.cos(v * 3.2 - i);
    return dx * dx / (rx * rx) + dy * dy / (ry * ry) < edge;
  });
}

/** Append one complete, texture-free face inventory. The function cannot
 * remove old furniture or facades. The host retires an exact old owner only
 * after this complete bounded receipt has been admitted.
 *
 * Native uses separate coarse leaf courses, stepped stem paths and short
 * cardinal wall slices. It never rotates a smooth wall/plant mesh.
 */
export function appendChancelleryPhotoV287(parts: ChancelleryPhotoPartsV287, s: ChancelleryPhotoSignatureV287): ChancelleryPhotoReceiptV287 {
  const planes = chancelleryPhotoPlanesV287(s);
  const receipt: ChancelleryPhotoReceiptV287 = { count: 0, wallCount: 0, openingCount: 0, leafCount: 0, stemCount: 0, pierCount: 0 };
  const pending: { position: Vec; size: Vec; tint: number; yaw: number; category: keyof Omit<ChancelleryPhotoReceiptV287, "count"> }[] = [];
  const yaw = s.rotation_y_degrees * Math.PI / 180, c = Math.cos(yaw), sn = Math.sin(yaw);
  function at(x: number, y: number, z: number): Vec { return [s.anchor_world[0] + x * c + z * sn, s.anchor_world[1] + y, s.anchor_world[2] - x * sn + z * c]; }
  function emit(x: number, y: number, z: number, width: number, height: number, depth: number, tint: number, category: keyof Omit<ChancelleryPhotoReceiptV287, "count">): void {
    const size: Vec = parts.native ? [Math.abs(c) * width + Math.abs(sn) * depth, height, Math.abs(sn) * width + Math.abs(c) * depth] : [width, height, depth];
    pending.push({ position: at(x, y, z), size, tint, yaw: parts.native ? 0 : yaw, category });
  }
  function wallRect(plane: ChancelleryPhotoPlaneV287, rect: Rect, offset: number, depth: number, tint: number, category: keyof Omit<ChancelleryPhotoReceiptV287, "count">): void {
    const width = rect.maxX - rect.minX, height = rect.maxY - rect.minY;
    // Short separately authored cardinal slices follow the source plane;
    // their tiny stair margins stay inside the .35 m recognition skin.
    const slices = parts.native ? Math.ceil(width / 1.1) : 1;
    for (let i = 0; i < slices; i++) emit(rect.minX + (i + .5) * width / slices, (rect.minY + rect.maxY) / 2, plane.sourceZ + plane.towardCourt * offset, width / slices, height, depth, tint, category);
  }
  for (const plane of planes) {
    // The prior procedural curtain-wall buffers survive behind this bounded
    // recognition skin. The photographed tall openings are real holes in it.
    for (const rect of cut(plane, plane.openings)) wallRect(plane, rect, .27, .10, P.tint.stone, "wallCount");
    for (const opening of plane.openings) {
      const midX = (opening.minX + opening.maxX) / 2, width = opening.maxX - opening.minX;
      wallRect(plane, { ...opening, minY: opening.kind === "slit" ? opening.minY : P.lowerGlazingTopM }, .285, .055, opening.kind === "slit" ? P.tint.glazing : P.tint.reveal, "openingCount");
      if (opening.kind === "slit") {
        wallRect(plane, { ...opening, minX: midX - .045, maxX: midX + .045 }, .335, .055, P.tint.frame, "openingCount");
        continue;
      }
      wallRect(plane, { ...opening, minY: opening.minY + .1, maxY: P.lowerGlazingTopM }, .315, .045, P.tint.glazing, "openingCount");
      for (const x of [opening.minX + .06, midX, opening.maxX - .06]) wallRect(plane, { ...opening, minX: x - .055, maxX: x + .055 }, .35, .065, P.tint.frame, "openingCount");
      for (const y of [opening.minY + .06, P.lowerGlazingTopM, opening.maxY - .06]) wallRect(plane, { minX: opening.minX, maxX: opening.maxX, minY: y - .055, maxY: y + .055 }, .35, .065, P.tint.frame, "openingCount");
      const courses = parts.native ? 11 : 22;
      for (let row = 0; row < courses; row++) {
        const y = P.lowerGlazingTopM + .15 + row * (opening.maxY - P.lowerGlazingTopM - .3) / (courses - 1);
        // Native retains obvious separate shutter courses rather than a dark
        // filled pane; drawn keeps the finer horizontal slat read.
        wallRect(plane, { minX: midX - width / 2 + .16, maxX: midX + width / 2 - .16, minY: y - (parts.native ? .13 : .065), maxY: y + (parts.native ? .13 : .065) }, .36, parts.native ? .14 : .09, P.tint.louvre, "openingCount");
      }
    }
    // Keep every new opening completely free of stems and leaves, including
    // the companion slit and a narrow white reveal all around each opening.
    const holes = plane.openings.map(o => ({ minX: o.minX - .16, maxX: o.maxX + .16, minY: o.minY - .16, maxY: o.maxY + .16 }));
    const clip = (rect: Rect) => { const bounded = intersect(rect, { ...plane, maxY: P.climbingCoverTopM }); return bounded ? cut(bounded, holes) : []; };
    const step = parts.native ? 1.05 : .76;
    for (let row = 0; row < 18 / step; row++) for (let col = 0; col < (plane.maxX - plane.minX) / step; col++) {
      const x = plane.minX + (col + .5) * step + Math.sin(row * 2.7 + col * .8) * step * .17;
      const y = plane.minY + (row + .5) * step + Math.cos(col * 1.8 + row) * step * .13;
      if (!coverAt(x - plane.minX, y - plane.minY, plane.segmentIndex)) continue;
      const w = step * (parts.native ? .93 : .98 + .16 * Math.sin(row + col)), h = step * (parts.native ? .88 : .86 + .2 * Math.cos(col * 1.7));
      const tint = P.tint.leaves[(row * 7 + col * 3 + plane.segmentIndex) % P.tint.leaves.length];
      for (const rect of clip({ minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2 })) wallRect(plane, rect, .43 + ((row + col) % 3) * .025, parts.native ? .22 : .12, tint, "leafCount");
    }
    for (let root = 0; root < 10; root++) {
      const baseX = plane.minX + 2.6 + root * 6.5, top = 11.9 + (root % 4) * 1.45;
      const stemStep = parts.native ? 1.2 : .8;
      for (let y = plane.minY + .2; y < Math.min(top, P.climbingCoverTopM - .2); y += stemStep) {
        const x = baseX + Math.sin(y * .7 + root) * .32;
        for (const rect of clip({ minX: x - .035, maxX: x + .035, minY: y, maxY: y + stemStep + .03 })) wallRect(plane, rect, .39, .055, P.tint.stem, "stemCount");
        if (Math.round(y / stemStep) % 3 === 0) for (const rect of clip({ minX: x - .7, maxX: x + .6, minY: y + .2, maxY: y + .26 })) wallRect(plane, rect, .39, .055, P.tint.stem, "stemCount");
      }
    }
  }
  // These are the TWO existing 15.4 m colonnade end anchors, not all four
  // 36 m leadership pylons. Cover fits around their exposed shafts; the
  // botanical outline is a labelled estimate and adds no new stone column.
  const cube = s.cube_offset_world, court = s.forecourt_offset_world!;
  const dx = court[0] - cube[0], dz = court[2] - cube[2], length = Math.hypot(dx, dz), fx = dx / length, fz = dz / length;
  for (const [endIndex, lateral] of P.colonnadeEndOffsetsM.entries()) {
    const x = cube[0] + fx * P.colonnadeForwardM - fz * lateral, z = cube[2] + fz * P.colonnadeForwardM + fx * lateral;
    const bottom = planes[0].minY + .08, step = parts.native ? 1.0 : .72, count = Math.ceil((P.colonnadeCoverTopM - bottom) / step);
    for (let row = 0; row < count; row++) {
      const y = bottom + (row + .5) * (P.colonnadeCoverTopM - bottom) / count;
      const radius = .74 + .1 * Math.sin(row * 1.9 + endIndex) - (row === count - 1 ? .14 : 0);
      if (parts.native) {
        // Native has broad pre-existing front supports, not the fine drawn
        // colonnade shafts. Four low foliage lobes per course clad their INNER
        // block faces; no floating substitute pillar or stone core is added.
        const support = nativeFaces.frontPylons[endIndex], h = (P.colonnadeCoverTopM - bottom) / count;
        const normal = endIndex === 0 ? 1 : -1, face = normal > 0 ? support.maxZ : support.minZ;
        for (let lobe = 0; lobe < 4; lobe++) {
          pending.push({ position: [(support.minX + support.maxX) / 2 + (lobe - 1.5) * .47 + Math.sin(row * 1.6 + lobe) * .04, s.anchor_world[1] + y, face + normal * .20], size: [.49 + .035 * Math.sin(row + lobe), h, .28], tint: P.tint.leaves[(row + lobe + endIndex) % 4], yaw: 0, category: "pierCount" });
        }
      } else {
        for (let face = 0; face < 8; face++) {
          const angle = face * Math.PI / 4, leafX = x + Math.cos(angle) * radius, leafZ = z + Math.sin(angle) * radius;
          emit(leafX, y, leafZ, .58 + .10 * Math.sin(row + face), (P.colonnadeCoverTopM - bottom) / count * .92, .42, P.tint.leaves[(row + face + endIndex) % 4], "pierCount");
        }
      }
    }
  }
  if (parts.native) {
    const columns = nativeFaces.retainedIndices.map(i => nativeFaces.sourceColumns[i]);
    for (const box of pending) {
      // The 4 m source representation can extend almost 2 m beyond the exact
      // metric plane. Decorating that hidden plane would bury the new facade.
      // Keep its X/Y fitting and place cardinal courses on the retained outer
      // block face instead. Every original source column remains untouched.
      const north = box.position[2] < s.anchor_world[2], normal = north ? 1 : -1;
      let face = box.category === "pierCount" ? (north ? nativeFaces.frontPylons[0].maxZ : nativeFaces.frontPylons[1].minZ) : undefined;
      for (const column of columns) {
        const [ix, iz, y0, y1] = column;
        // Lower source entrance-canopy cells in the middle of the court are
        // separate obstacles, not the office facade's supporting wall.
        if (((iz + .5) * 4 < s.anchor_world[2]) !== north || y1 / 10 < s.anchor_world[1] + planes[0].maxY || ix * 4 >= box.position[0] + box.size[0] / 2 - 1e-8 || (ix + 1) * 4 <= box.position[0] - box.size[0] / 2 + 1e-8 || y0 / 10 >= box.position[1] + box.size[1] / 2 || y1 / 10 <= box.position[1] - box.size[1] / 2) continue;
        const surface = (north ? iz + 1 : iz) * 4;
        face = face === undefined ? surface : north ? Math.max(face, surface) : Math.min(face, surface);
      }
      if (face === undefined) throw new Error("Native Chancellery fitting has no retained source exterior support");
      const offset = box.category === "wallCount" ? .015 : box.category === "leafCount" || box.category === "pierCount" ? .19 : box.category === "stemCount" ? .13 : box.tint === P.tint.frame ? .11 : box.tint === P.tint.louvre ? .16 : .025;
      box.position[2] = face + normal * (box.size[2] / 2 + offset);
    }
  }
  if (pending.length > P.maxInstancesPerMode || pending.some(b => !b.position.every(Number.isFinite) || !b.size.every(v => Number.isFinite(v) && v > 0))) throw new Error("Chancellery photo inventory exceeded its complete finite append budget");
  // Validate/build the complete finite inventory before any shared host write.
  for (const box of pending) { parts.box(box.position, box.size, box.tint, box.yaw); receipt.count++; receipt[box.category]++; }
  return receipt;
}
