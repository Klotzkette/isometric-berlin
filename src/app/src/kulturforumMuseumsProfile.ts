import navigation from "./kulturforumMuseumsNavigation.json";

export const KULTURFORUM_MUSEUM_IDS: ReadonlySet<string> = new Set(navigation.map(b => b.id));
export const KULTURFORUM_MUSEUM_PROFILE = {
  sharedPiazzettaEntrance: {
    sourcePartId: "DEBE3DUxjfT1esZV", sourceParentId: "DEBE01YYK0002SFk",
    sourceEdgeWorldM: [[-381.5, 1102.1], [-388.3, 1124.5]] as const,
    groundY: 4.6,
    status: "Facade-only register on retained shared foyer; no source-body or native-column replacement",
  },
  sourceBodies: 3, sourcePolygons: 234, roofPolygons: 10,
  sourceStatus: "All source polygons retained. Absolute NHN roofs; basement walls clipped at existing street ground. Kunstgewerbemuseum's single flat source roof is coarse, not a terrace survey. Facade subdivisions are bounded display estimates.",
  sources: [
    "https://www.smb.museum/museen-einrichtungen/gemaeldegalerie/ueber-uns/profil/",
    "https://kaiser-friedrich-museumsverein.de/sammlung/museen/gemaeldegalerie-kulturforum/",
    "https://www.smb.museum/fileadmin/website/Institute/Institut_fuer_Museumsforschung/Publikationen/Mitteilungen/MIT039.pdf",
    "https://www.smb.museum/museen-einrichtungen/kulturforum/besuch-planen/lageplan/",
    "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
  ],
  referenceUrls: [
    "https://commons.wikimedia.org/wiki/File:Kunstgewerbemuseum_Berlin_Kulturforum_entrance.jpg",
    "https://commons.wikimedia.org/wiki/File:Gem%C3%A4ldegalerie_am_Kulturforum_Berlin.JPG",
    "https://commons.wikimedia.org/wiki/File:TiergartenSigismundstra%C3%9Fe-2.jpg",
  ],
} as const;

type Ring = readonly (readonly number[])[];
export function kulturforumMuseumInside(ring: Ring, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function kulturforumMuseumRoofHeightAt(id: string, x: number, z: number, minecraft = false): number | null {
  const body = navigation.find(b => b.id === id);
  if (!body) return null;
  if (minecraft) { x = Math.floor(x / 2) * 2 + 1; z = Math.floor(z / 2) * 2 + 1; }
  let highest: number | null = null;
  for (const rings of body.roofs) {
    if (!kulturforumMuseumInside(rings[0].map(p => [p[0], p[2]]), x, z) || rings.slice(1).some(r => kulturforumMuseumInside(r.map(p => [p[0], p[2]]), x, z))) continue;
    let nx = 0, ny = 0, nz = 0;
    const ring = rings[0];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    if (Math.abs(ny) < 1e-8) continue;
    const a = ring[0], y = a[1] - (nx * (x - a[0]) + nz * (z - a[2])) / ny;
    highest = Math.max(highest ?? -Infinity, minecraft ? Math.round(y * 2) / 2 : y);
  }
  return highest;
}
/** Match actual source quantisation, never claim a neighbouring taller column. */
export function kulturforumMuseumReplacementColumn(x: number, z: number, lowY: number, highY: number, cell = 4): boolean {
  // This predicate also visits distant city columns during native construction.
  // Rounded outward bounds avoid polygon work for everything outside the museum block.
  if (x < -540 - cell || x > -252 + cell || z < 970 - cell || z > 1200 + cell) return false;
  return navigation.some(({ sourcePrism: p }) => {
    if (Math.abs(highY - lowY - Math.ceil(p.h_dm / 10 / cell) * cell) > .11 || lowY > p.y0_dm / 10 + .51) return false;
    const ring = p.ring, h = cell / 2 - .001;
    const owns = (xx: number, zz: number) => kulturforumMuseumInside(ring, xx * 10, zz * 10) && !p.holes.some(r => kulturforumMuseumInside(r, xx * 10, zz * 10));
    if ([[0, 0], [-h, -h], [h, -h], [h, h], [-h, h]].some(([dx, dz]) => owns(x + dx, z + dz))) return true;
    // Thin concave façade returns can cross a source cell without owning a corner.
    return ring.some((a, i) => {
      const b = ring[(i + 1) % ring.length]; let lo = 0, hi = 1;
      for (const [start, end, min, max] of [[a[0] / 10, b[0] / 10, x - h, x + h], [a[1] / 10, b[1] / 10, z - h, z + h]]) {
        const d = end - start;
        if (Math.abs(d) < 1e-9) { if (start < min || start > max) return false; }
        else { const p = (min - start) / d, q = (max - start) / d; lo = Math.max(lo, Math.min(p, q)); hi = Math.min(hi, Math.max(p, q)); }
      }
      return lo <= hi;
    });
  });
}
