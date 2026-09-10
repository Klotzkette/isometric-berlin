import source from "./tipiSiteSource.json";

export type TipiSitePart = typeof source.parts[number];
export const TIPI_SITE_PARTS: readonly TipiSitePart[] = source.parts;
export const TIPI_SITE_PRISM_IDS: ReadonlySet<string> = new Set(
  TIPI_SITE_PARTS.map((part) => part.prismId),
);
export const TIPI_SITE_GEOMETRY_STATUS = source.source.geometryStatus;

export function tipiSitePartContains(part: TipiSitePart, x: number, z: number): boolean {
  let inside = false;
  const ring = part.ringDm;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i].map((v) => v / 10);
    const [bx, bz] = ring[j].map((v) => v / 10);
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

export function isTipiSourceReplacementAt(x: number, z: number): boolean {
  // Broad rejection only; replacement always requires a retained source ring.
  if (x < -319 || x > -254 || z < 12 || z > 90) return false;
  return TIPI_SITE_PARTS.some((part) => tipiSitePartContains(part, x, z));
}

export function tipiSiteEnvelope(part: TipiSitePart): { eaves: number; peak: number } {
  if (part.role === "turret") return { eaves: 5.6, peak: 9.0 };
  if (part.role === "foyer") return { eaves: 3.2, peak: 6.2 };
  if (part.role === "service") return { eaves: 3.2, peak: 3.45 };
  return { eaves: 2.5, peak: 5.2 };
}
