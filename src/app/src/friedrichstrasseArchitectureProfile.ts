import source from "./friedrichstrasseArchitectureSource.json";
export const FRIEDRICHSTRASSE_ARCHITECTURE_SOURCE = source;
export const FRIEDRICHSTRASSE_ARCHITECTURE_IDS: ReadonlySet<string> = new Set(source.prisms.map(p => p.id));
export const ADMIRALSPALAST_IDS: ReadonlySet<string> = new Set(source.profiles[0].ids);
export const FRIEDRICHSTRASSE_ARCHITECTURE_GROUP = "Friedrichstrasse and Schiffbauerdamm architecture";
export const MINECRAFT_FRIEDRICHSTRASSE_ARCHITECTURE_GROUP = "Minecraft Friedrichstrasse and Schiffbauerdamm architecture";
export const FRIEDRICHSTRASSE_ARCHITECTURE_TONES: Readonly<Record<string, number>> = Object.fromEntries(source.profiles.flatMap(p => p.ids.map(id => [id, p.tone])));
export const FRIEDRICHSTRASSE_ARCHITECTURE_EVIDENCE = {
  geometry: "52 exact delivered LoD2 prisms. Admiralspalast additionally uses its three official March 2026 wall and roof surfaces, translated only to each committed ground datum. Other source bodies and roofs remain unchanged.",
  detail: "Source-bound facade recognition: granite Doric half-columns and limestone relief registers, terracotta court, SpreeDreieck vertical double facade, Melia punched stone facade, individual Schiffbauerdamm plaster and historic frontages. Local bay sizes and relief silhouettes are non-surveyed estimates.",
  sources: [source.source_url, "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065048", "https://www.reckersarchitekten.de/referenzen/kulturbauten/admiralspalast.html", "https://feldhaus.de/en/projekte/spree-dreieck/", "https://www.mbbm-bso.com/de/projekt/?id=M66484", "https://www.berliner-ensemble.de/node/386"],
} as const;
export function friedrichstrasseInRing(ring: readonly (readonly number[])[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
const roofs = source.admiralParts.flatMap(part => part.surfaces.filter(s => s.kind === "RoofSurface").map(s => {
  const r = s.rings[0], n = [0, 0, 0];
  r.forEach((a, i) => { const b = r[(i + 1) % r.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); });
  return { id: part.id.slice(-8), ring: r.map(p => [p[0], p[2]]), a: r[0], n, offset: part.offset_y_m };
}));
export function admiralspalastRoofAt(x: number, z: number, id?: string): number | null {
  if (x < 1148 || x > 1243 || z < -239 || z > -165) return null;
  let top: number | null = null;
  for (const p of roofs) if ((!id || p.id === id) && Math.abs(p.n[1]) > 1e-6 && friedrichstrasseInRing(p.ring, x, z)) {
    const y = p.a[1] + p.offset - (p.n[0] * (x - p.a[0]) + p.n[2] * (z - p.a[2])) / p.n[1]; top = Math.max(top ?? -Infinity, y);
  }
  return top;
}
/** Ownership uses the original coarse envelope; never remove a neighbouring column. */
export function admiralspalastSourceColumnAt(x: number, z: number, lowY?: number, highY?: number): boolean {
  if (x < 1148 || x > 1243 || z < -239 || z > -165) return false;
  return source.prisms.some(p => ADMIRALSPALAST_IDS.has(p.id) && friedrichstrasseInRing(p.ring, x * 10, z * 10) &&
    (lowY === undefined || lowY <= (p.y0_dm + p.h_dm) / 10 + .5) && (highY === undefined || highY >= p.y0_dm / 10 - .5));
}
