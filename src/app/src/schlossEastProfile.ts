import source from "./schlossEastSource.json";

/** Shared source contracts contain no renderer, geometry constructors or native cache. */
export const SCHLOSS_EAST_SOURCE = source;
export const SCHLOSS_EAST_GROUP_NAME = "Alexanderplatz station, Fernsehturm and Rathaus source outlines";
export const SCHLOSS_EAST_PROFILE_KEYS = ["rathaus", "stationBase", "stationHall", "fernsehturm"] as const;
export const SCHLOSS_EAST_PARTS = SCHLOSS_EAST_PROFILE_KEYS.flatMap(key => source.profiles[key].parts);
const towerRing = source.profiles.fernsehturm.parts[0].ring;
const towerX = (Math.min(...towerRing.map(p => p[0])) + Math.max(...towerRing.map(p => p[0]))) / 2;
const towerZ = (Math.min(...towerRing.map(p => p[1])) + Math.max(...towerRing.map(p => p[1]))) / 2;
export const FERNSEHTURM_PROFILE = {
  x: towerX, z: towerZ, groundY: 4.63,
  totalHeight: 368, sphereRadius: 16, sphereCenterHeight: 212,
  footRadius: 16, shaftBottomRadius: 8, shaftTopRadius: 4.5,
  footFlareHeight: 20, shaftTopHeight: 250, antennaHeight: 118,
  sourcePartIds: source.profiles.fernsehturm.parts.map(p => p.id),
  sourceConflict: "LoD2 extrudes the 36 m sphere/foot envelope through the full tower height; retain original sheets as evidence and display a separately labelled narrow shaft and sphere.",
  referenceUrls: [
    "https://www.berlin.de/ost-west-ost-kulturbahnhoefe/history-walk/artikel.1558558.php",
    "https://www.bpb.de/system/files/dokument_pdf/MuM_10_Berliner%20Fernsehturm.pdf",
    "https://convention.visitberlin.de/sites/default/files/2021-10/BANKETTMAPPE-2021-BERLINER-FERNSEHTURM_7.pdf",
  ],
} as const;
export const FERNSEHTURM_ANTENNA = { x: towerX, z: towerZ, base: 254.63, top: 372.63 } as const;

/** The illustrated TV tower replaces only its two generalized source collision prisms. */
export function fernsehturmOutlineSolidAt(x: number, z: number, y: number, radius = 0): boolean {
  const p = FERNSEHTURM_PROFILE, h = y - p.groundY;
  if (h < -radius || h > p.totalHeight + radius) return false;
  const distance = Math.hypot(x - p.x, z - p.z);
  let wallRadius = 0;
  if (h <= p.footFlareHeight) wallRadius = p.footRadius +
    (p.shaftBottomRadius - p.footRadius) * Math.max(0, h) / p.footFlareHeight;
  else if (h <= p.shaftTopHeight) wallRadius = p.shaftBottomRadius +
    (p.shaftTopRadius - p.shaftBottomRadius) * (h - p.footFlareHeight) / (p.shaftTopHeight - p.footFlareHeight);
  else wallRadius = 1.45 - Math.min(1, (h - p.shaftTopHeight) / p.antennaHeight) * 1.05;
  const dy = h - p.sphereCenterHeight;
  if (Math.abs(dy) <= p.sphereRadius) wallRadius = Math.max(wallRadius, Math.sqrt(p.sphereRadius ** 2 - dy ** 2));
  return distance <= wallRadius + radius;
}
export const SCHLOSS_EAST_TONES = {
  rathaus: { name: "Rotes Rathaus outline", wall: 0xb97557, roof: 0x766d65 },
  stationBase: { name: "Alexanderplatz station base outline", wall: 0xb6b0a0, roof: 0x919894 },
  stationHall: { name: "Alexanderplatz station arched hall outline", wall: 0xa6bdc0, roof: 0x8eaaa9 },
  fernsehturm: { name: "Fernsehturm shaft and sphere outline", wall: 0xc5cbca, roof: 0xa2afb2 },
} as const;
