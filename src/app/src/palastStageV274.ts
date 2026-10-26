import { Quaternion, Vector3 } from "three";
import source from "./data/centralTheatresV274.json";

type P3 = readonly [number, number, number];
export type PalastStageBoxV274 = { position: P3; size: P3; rotation: Quaternion; color: number; role: string };
type Plan = { stone: PalastStageBoxV274[]; glass: PalastStageBoxV274[]; sign: PalastStageBoxV274[] };
type Receipt = { position: number[]; size: number[]; rotation: number[]; color: number; role: string };
const families = ["stone", "glass", "sign"] as const;
const axisLength = Math.hypot(3.713, 49.535), ax = 3.713 / axisLength, az = 49.535 / axisLength;
const up = new Vector3(0, 1, 0);

/** Construction-only decoding, no persistent decoded copies or descriptors. */
export function centralTheatreRowsV274(native: boolean, family: "palast" | "other"): Float32Array {
  const text = atob((native ? source.native : source.drawn)[family]);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  const rows = new Float32Array(bytes.buffer), expected = source.counts[native ? "native" : "drawn"][family];
  if (rows.length !== expected * 8) throw new Error("v274 theatre packed row count changed");
  for (let i = 0; i < rows.length; i += 8) {
    for (let j = 0; j < 8; j++) if (!Number.isFinite(rows[i + j])) throw new Error("v274 theatre row is not finite");
    if (rows[i + 3] <= 0 || rows[i + 4] <= 0 || rows[i + 5] <= 0 || (native && rows[i + 6] !== 0))
      throw new Error("v274 theatre dimensions/native axes changed");
  }
  return rows;
}

function identical(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => Number.isFinite(v) && Math.abs(v - b[i]) <= 1e-9);
}
function matches(box: PalastStageBoxV274, receipt: Receipt): boolean {
  return box.role === receipt.role && box.color === receipt.color &&
    identical(box.position, receipt.position) && identical(box.size, receipt.size) &&
    identical(box.rotation.toArray(), receipt.rotation);
}

/** Replace only the complete, exactly receipted obsolete stage recipe.
 * Validate every bucket before creating a new plan; caller/source are immutable.
 * New or edited stage details fail closed and must be reconciled explicitly. */
export function replacePalastStageV274<T extends Plan>(plan: T, detailProfile: "full" | "mobile", native: boolean): T {
  const key = `${detailProfile}:${native}` as keyof typeof source.palastPrevious;
  const receipt = source.palastPrevious[key];
  for (const family of families) {
    const previous = plan[family].filter(b => b.role.startsWith("stage-") || b.role.startsWith("v274 stage"));
    const expected = receipt[family];
    if (previous.length !== expected.length || previous.some((b, i) => !matches(b, expected[i])))
      throw new Error(`v274 Palast stage source receipt mismatch: ${key}/${family}`);
  }
  const rows = centralTheatreRowsV274(native, "palast"), boxes: PalastStageBoxV274[] = [];
  for (let i = 0; i < rows.length; i += 8) boxes.push({
    position: [rows[i], rows[i + 1], rows[i + 2]], size: [rows[i + 3], rows[i + 4], rows[i + 5]],
    rotation: new Quaternion().setFromAxisAngle(up, rows[i + 6]), color: rows[i + 7],
    role: "v274 stage corrected upper shell and roof architecture",
  });
  return { ...plan, stone: [...plan.stone.filter(b => !b.role.startsWith("stage-")), ...boxes],
    glass: plan.glass.filter(b => !b.role.startsWith("stage-")), sign: plan.sign };
}

/** Same stage footprint and roof surfaces as the replacement.
 * The main-body footprint/height guard remains in FriedrichstadtPalastDetails. */
export function palastStageV274TopAt(x: number, z: number): number | null {
  const dx = x - 1135.4015, dz = z + 535.6215;
  const u = dx * ax + dz * az, out = -dx * az + dz * ax, s = source.stage;
  if (!Number.isFinite(u) || !Number.isFinite(out)) return null;
  const a = u - s.u, b = out - s.out;
  if (Math.abs(a) > s.width / 2 || Math.abs(b) > s.depth / 2) return null;
  if (Math.abs(a) >= s.width / 2 - .3 || Math.abs(b) >= s.depth / 2 - .3) return s.capY;
  let top = s.topY;
  for (const [x, z, w, d] of [[-8, 0, 4.2, 2.1], [0, -3.8, 6.4, 2.3], [8.2, 4, 3.8, 1.8]]) {
    if (Math.abs(a-x) <= w/2 && Math.abs(b-z) <= d/2) top = Math.max(top, s.topY + .12);
    if (Math.abs(a-x) <= (w-.2)/2 && Math.abs(b-z) <= (d-.2)/2) top = Math.max(top, s.topY + .16);
  }
  for (const x of [-14, -10, -6, -2, 2, 6, 10, 14])
    if (Math.abs(a-x) <= .0175 && Math.abs(b) <= s.depth/2-.3) top = Math.max(top, s.topY + .0375);
  return top;
}

export const CENTRAL_THEATRES_V274_COUNTS = Object.freeze({ drawn: Object.freeze({ ...source.counts.drawn }), native: Object.freeze({ ...source.counts.native }) });
