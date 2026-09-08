import source from "./fiftyHertzSource.json";

export const FIFTY_HERTZ_SOURCE = source;
export const FIFTY_HERTZ_IDS: ReadonlySet<string> = new Set([
  ...source.prisms.map((p) => p.id),
  source.extension_source.id,
]);
export const FIFTY_HERTZ_GROUP = "50Hertz complete Netzquartier architecture";
export const MINECRAFT_FIFTY_HERTZ_GROUP =
  "Minecraft 50Hertz complete Netzquartier";
export const FIFTY_HERTZ_PRISM_TONES: Readonly<Record<string, number>> =
  Object.fromEntries(
    [...source.prisms, source.extension_source].map((p) => [p.id, 0x465c6c]),
  );
export const FIFTY_HERTZ_ROOF_SUBDIVISIONS = [
  {
    id: "r4lZjw1O",
    centre: [-38.748, -1037.844],
    width: 11.0,
    depth: 5.0,
    eaves: 55.84,
    top: 59.675,
  },
  {
    id: "J4IVUvmp",
    centre: [-53.093, -1064.489],
    width: 8.0,
    depth: 4.0,
    eaves: 33.02,
    top: 36.427,
  },
] as const;
export const FIFTY_HERTZ_PROFILE = {
  mainOsm: "way/237687109",
  extensionOsm: "way/1224022429",
  extensionFloors: 7,
  towerFloors: 13,
  lowWingFloors: 7,
  sourceUrls: [
    "https://www.kadawittfeldarchitektur.de/en/projekt/50hertz-netzquartier/",
    "https://www.zueblin.de/de/projekte/50hertz",
    "https://www.50hertz.com/Portals/1/Dokumente/Medien/Pressemitteilungen/2024/20240417_Pressemitteilung_50Hertz_feiert_Richtfest_in_Europacity.pdf",
    source.source_url,
  ],
  status:
    "Original five LoD2 parts retain footprints and maximum heights. The source's two coarse pitched roof envelopes are subdivided into photographed flat roof plates and bounded service housings. Facade bands, single-storey diagonal supports, orange core glimpses and loggia bays are reference-bounded subdivisions. The completed 2025 extension retains the shipped OSM-derived identity 24022429 and exact footprint; its earlier 21 m source estimate is preserved separately while the current seven-storey reading uses an explicitly estimated 31 m height. Roof furniture and facade dimensions are not surveyed.",
} as const;

export function fiftyHertzInRing(
  ring: readonly (readonly number[])[],
  x: number,
  z: number,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i],
      [bx, bz] = ring[j];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
      inside = !inside;
  }
  return inside;
}
const planes = source.parts.flatMap((part) => {
  const prism = source.prisms.find((p) => p.id === part.id.slice(-8))!;
  return part.surfaces
    .filter((s) => s.kind === "RoofSurface")
    .map((s) => {
      const r = s.rings[0],
        normal = [0, 0, 0];
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        normal[0] += (a[1] - b[1]) * (a[2] + b[2]);
        normal[1] += (a[2] - b[2]) * (a[0] + b[0]);
        normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
      }
      return {
        id: prism.id,
        a: r[0],
        normal,
        ring: r.map((p) => [p[0], p[2]]),
        offset: prism.y0_dm / 10 - part.ground_y_m,
      };
    });
});
export function fiftyHertzRoofAt(
  x: number,
  z: number,
  id?: string,
): number | null {
  if (x < -95 || x > 8 || z < -1143 || z > -1015) return null;
  const values = planes
    .filter(
      (p) =>
        (!id || p.id === id) &&
        Math.abs(p.normal[1]) > 0.001 &&
        fiftyHertzInRing(p.ring, x, z),
    )
    .map((p) => {
      const roof = FIFTY_HERTZ_ROOF_SUBDIVISIONS.find((r) => r.id === p.id);
      if (!roof)
        return (
          p.a[1] -
          (p.normal[0] * (x - p.a[0]) + p.normal[2] * (z - p.a[2])) /
            p.normal[1] +
          p.offset
        );
      const dx = x - roof.centre[0],
        dz = z - roof.centre[1],
        c = Math.cos(0.372628),
        s = Math.sin(0.372628);
      return Math.abs(dx * c - dz * s) < roof.width / 2 &&
        Math.abs(dx * s + dz * c) < roof.depth / 2
        ? roof.top
        : roof.eaves;
    });
  const ext = source.extension;
  if ((!id || id === ext.id) && fiftyHertzInRing(ext.ring, x * 10, z * 10))
    values.push((ext.y0_dm + ext.h_dm) / 10);
  return values.length ? Math.max(...values) : null;
}
/** Replace only columns owned by the five LoD2 parts or the older extension estimate. */
export function fiftyHertzSourceColumnAt(
  x: number,
  z: number,
  low: number,
  high: number,
  cell = 4,
): boolean {
  if (x < -95 || x > 10 || z < -1143 || z > -1014 || high < low) return false;
  return [...source.prisms, source.extension_source].some(
    (p) =>
      fiftyHertzInRing(p.ring, x * 10, z * 10) &&
      high - low <=
        Math.ceil(p.h_dm / (10 * cell)) * cell +
          (p.roof === 3200 ? cell : 0) +
          0.01,
  );
}
/** The completed extension exceeds its older source height and needs matching collision. */
export function fiftyHertzExtensionSolidAt(
  x: number,
  footY: number,
  z: number,
  height = 1.8,
  radius = 0.25,
): boolean {
  const p = source.extension;
  if (footY >= (p.y0_dm + p.h_dm) / 10 || footY + height <= p.y0_dm / 10)
    return false;
  return [
    [0, 0],
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
  ].some(([dx, dz]) => fiftyHertzInRing(p.ring, (x + dx) * 10, (z + dz) * 10));
}
