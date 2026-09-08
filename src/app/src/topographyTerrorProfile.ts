import source from "./topographyTerrorSource.json";
export const TOPOGRAPHY_TERROR_SOURCE = source;
export const TOPOGRAPHY_TERROR_GROUP = "Topography of Terror source-bound architecture";
export const MINECRAFT_TOPOGRAPHY_TERROR_GROUP = "Minecraft Topography of Terror architecture";
export const TOPOGRAPHY_TERROR_MUSEUM_ID = "400002h6";
export const TOPOGRAPHY_TERROR_IDS: ReadonlySet<string> = new Set(source.prisms.map(p => p.id));
export const TOPOGRAPHY_TERROR_SITE_IDS: ReadonlySet<string> = new Set(source.prisms.filter(p => p.id !== TOPOGRAPHY_TERROR_MUSEUM_ID).map(p => p.id));
export const TOPOGRAPHY_TERROR_MUSEUM = source.prisms.find(p => p.id === TOPOGRAPHY_TERROR_MUSEUM_ID)!;
export const TOPOGRAPHY_TERROR_BASE = TOPOGRAPHY_TERROR_MUSEUM.y0_dm / 10;
export const TOPOGRAPHY_TERROR_TOP = (TOPOGRAPHY_TERROR_MUSEUM.y0_dm + TOPOGRAPHY_TERROR_MUSEUM.h_dm) / 10;
export const TOPOGRAPHY_TERROR_PROFILE = {
  name: "Topographie des Terrors", address: "Niederkirchnerstraße 8, 10963 Berlin",
  architects: "Ursula Wilms / Heinle, Wischer und Partner; landscape Heinz W. Hallmann",
  museumLod2: "DEBE02YY400002h6", siteLod2: "DEBE02YY4000056X", siteOsm: "way/24368681",
  opened: "2010-05-06", museumTop: TOPOGRAPHY_TERROR_TOP, museumBase: TOPOGRAPHY_TERROR_BASE,
  wallPublishedLengthM: 200, wallDisplayLengthM: source.officialWall.lengthM,
  status: "Exact LoD2 museum ring, courtyard and maximum height; original four site parts retained as open-ground source evidence. Facade screen, entrance, roof-array subdivisions, wall chips, canopy sections and cellar braces are procedural display estimates, not a facade or archaeological survey. No exhibition photographs, quotations or historical plan artwork are reproduced.",
  sourceUrls: ["https://www.topographie.de/ueber-den-ort/geschichte-nach-1945", "https://www.topographie.de/ausstellungen/gelaenderundgang", "https://www.heinlewischer.de/projekte/detail/topographie-des-terrors-berlin-neubau-dokumentations-und-besucherzentrum-und-gestaltung-des-historischen-gelaendes/", "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr"],
} as const;
export const TOPOGRAPHY_TERROR_PRISM_TONES: Readonly<Record<string, number>> = { "400002h6": 0x929da0, EruJoJLU: 0x727771, ZdDl61l8: 0x616764, fxtMHxUV: 0x656b67, G4JuQSIz: 0x77776f };
export const TOPOGRAPHY_TERROR_ROOF_TONES = { ...TOPOGRAPHY_TERROR_PRISM_TONES, "400002h6": 0xb4ad97 };
export type TopographyPoint = readonly [number, number];
export function topographyPointInRing(ring: readonly (readonly number[])[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[i], [bx, bz] = ring[j]; if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside; }
  return inside;
}
export function topographyMuseumContains(x: number, z: number, includeCourt = false): boolean {
  if (x < 770 || x > 832 || z < 1348 || z > 1410) return false;
  return topographyPointInRing(TOPOGRAPHY_TERROR_MUSEUM.ring, x * 10, z * 10) && (includeCourt || !TOPOGRAPHY_TERROR_MUSEUM.holes.some(h => topographyPointInRing(h, x * 10, z * 10)));
}
/** Replace only source-centred museum columns, including the court. */
export function topographyMuseumColumnContains(x: number, z: number): boolean { return topographyMuseumContains(x, z, true); }
export function topographyMuseumTopAt(x: number, z: number): number | null { return topographyMuseumContains(x, z) ? TOPOGRAPHY_TERROR_TOP : null; }
export type TopographySolid = { x: number; y: number; z: number; width: number; height: number; depth: number; yaw: number; role: string };
export function topographySolidContains(s: TopographySolid, x: number, footY: number, z: number, height = 1.8, radius = .25): boolean {
  if (footY >= s.y + s.height / 2 || footY + height <= s.y - s.height / 2) return false;
  const dx = x - s.x, dz = z - s.z, c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
  return Math.abs(c * dx - sn * dz) <= s.width / 2 + radius && Math.abs(sn * dx + c * dz) <= s.depth / 2 + radius;
}

/** Keep unrelated/taller buildings while replacing these exact source columns. */
export function topographySourceColumnContains(x: number, z: number, lowY: number, highY: number, cell = 4): boolean {
  if (x < 700 || x > 960 || z < 1300 || z > 1463 || !Number.isFinite(cell) || cell <= 0 || highY < lowY) return false;
  // Voxelisation rebases every source body on interpolated terrain. Its
  // vertical span, not absolute source roof Y, identifies the quantised body.
  const compatible = (heightDm:number) => highY-lowY <= Math.ceil(heightDm/(10*cell))*cell+.01 && Math.abs(lowY-topographySourceGroundAt(x,z))<=.65;
  if (topographyMuseumColumnContains(x,z)) return compatible(TOPOGRAPHY_TERROR_MUSEUM.h_dm);
  return source.prisms.some(p => p.id !== TOPOGRAPHY_TERROR_MUSEUM_ID && topographyPointInRing(p.ring,x*10,z*10) && compatible(p.h_dm));
}
/** Platform is terrain, never a closed occupied building. Its supplied heights
 * remain metric; mapped museum court and archaeological openings stay free. */
export function topographySiteSurfaceAt(x: number, z: number): number | null {
  if(x<703||x>958||z<1309||z>1462)return null;
  if (topographyMuseumContains(x,z,true) || topographyPointInRing(source.cellar.ring,x,z)) return null;
  let y:number|null=null;
  for(const p of source.prisms)if(p.id!==TOPOGRAPHY_TERROR_MUSEUM_ID&&topographyPointInRing(p.ring,x*10,z*10))y=Math.max(y??-Infinity,(p.y0_dm+p.h_dm)/10);
  return y;
}
/** Frozen local samples from the same committed terrain payload as the city. */
export function topographySourceGroundAt(x: number, z: number): number {
  const g=source.groundGrid, ix=Math.max(0,Math.min(g.values[0].length-1,Math.floor((x-g.minX)/g.cell))), iz=Math.max(0,Math.min(g.values.length-1,Math.floor((z-g.minZ)/g.cell)));
  return g.values[iz][ix] ?? 4.6;
}
