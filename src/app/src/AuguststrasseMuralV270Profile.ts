import data from './data/auguststrasseMuralV270Profile.json';

type Source = { id?: unknown; ring?: unknown; holes?: unknown; y0_dm?: unknown; h_dm?: unknown; class?: unknown; roof?: unknown; tone?: unknown };
const fingerprint = (p: Source) => JSON.stringify([p.id, p.ring, p.holes, p.y0_dm, p.h_dm, p.class, p.roof, p.tone]);
const original = fingerprint(data.previousPrism);

/** Only the exact west-wall estimate at the superseded flat-roof datum yields.
 * The complete measured upper gable must already be ready at the caller. */
export function isAuguststrasseOldGableRimV270(
  prism: unknown, ax: number, az: number, bx: number, bz: number,
  bodyHeight: number, corniceHeight: number, corniceDepth: number,
): boolean {
  if (!prism || typeof prism !== 'object' || (prism as Source).id !== data.prism || fingerprint(prism as Source) !== original ||
      bodyHeight !== 15 || corniceHeight !== .22 || corniceDepth !== .48) return false;
  const a = [1288.3, -760.8], b = [1291.9, -746.7];
  const same = (x: number, z: number, p: number[]) => Math.abs(x-p[0]) < 1e-8 && Math.abs(z-p[1]) < 1e-8;
  return same(ax,az,a) && same(bx,bz,b) || same(ax,az,b) && same(bx,bz,a);
}

export const AUGUSTSTRASSE_MURAL_V270_PROFILE = {
  owner: data.owner, prism: data.prism, address: data.address, artist: data.artist,
  text: data.text, groundY: data.groundY, topY: data.topY, camera: data.camera,
  sourceSheetsRetained: true, additiveSourceComplement: true, exactSupersededCornice: true, fullStaticDetailOnTouch: true,
  independentlyOrthogonalNative: true,
} as const;

/** Small roof-only profile. No mesh, vector artwork or encoded geometry is imported. */
export function auguststrasseRoofAtV270(x: number, z: number, native = false): number | null {
  if (native) {
    const cell = data.nativeCellM;
    x = (Math.floor(x / cell) + .5) * cell;
    z = (Math.floor(z / cell) + .5) * cell;
  }
  let top = -Infinity;
  for (const [a, b, c] of data.roofTriangles) {
    const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(den) < 1e-10) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
    if (Math.min(u, v, 1 - u - v) >= -1e-7) top = Math.max(top, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return !Number.isFinite(top) ? null : native ? Math.ceil(top / data.nativeCellM) * data.nativeCellM : top;
}

/** Append this measured upper complement. The original full-height core owner stays. */
export function auguststrasseUpperSolidsV270(native = false) {
  return (native ? data.nativeFootprints : data.drawnFootprints).map(p => ({
    ...p, sourceId: data.prism, minY: native ? data.nativeCutY : data.drawnCutY, maxY: data.topY,
    topAt: (x: number, z: number) => auguststrasseRoofAtV270(x, z, native),
  }));
}
