import sourcePrisms from "./museumLennePrisms.json";

export const MUSEUM_LENNE_GROUP = "Museum and Lenne source-bound architecture";
export const MINECRAFT_MUSEUM_LENNE_GROUP = "Minecraft Museum and Lenne architecture";
export const MUSEUM_LENNE_SOURCE_PRISMS = sourcePrisms;
export const MUSEUM_LENNE_IDS: ReadonlySet<string> = new Set(sourcePrisms.map(p => p.id));
export const MUSIC_MUSEUM_IDS: ReadonlySet<string> = new Set([
  "zI19zSfy", "7W5aNmQ5", "rcRSiKl4", "4keChp4s", "HUDk4q9R", "zWi4z8Km", "UJwr9w5r",
  "54DZVHQd", "yISXluRg", "C63xrbXN", "duXXdDCS", "4sEwVreu", "ez443n2q", "Y99y1NiA",
]);
export const MUSIC_MUSEUM_HALL_ID = "C63xrbXN";
export const MUSIC_MUSEUM_HALL_ROOF_RISE = 2.4;
export const MUSIC_MUSEUM_PROFILE = {
  name: "Musikinstrumenten-Museum and Staatliches Institut für Musikforschung",
  osm: "way/22990151", parent: "DEBE01YYK0002Kgr", sourcePartCount: 14,
  sourceUrl: "https://www.simpk.de/museum/sammlung/geschichte.html",
  architects: "Edgar Wisniewski after plans by Hans Scharoun", opened: 1984,
  roofLightCount: 8,
  sourceStatus: "Exact delivered LoD2 footprint and maximum height retained. Museum hall height is divided into wall and rooflight bands; facade and rooflight subdivisions are photo-guided display dimensions, not survey data. Other measured source parts and roof codes remain unchanged.",
  referenceUrls: [
    "https://commons.wikimedia.org/wiki/File:Berlin_Musikinstrumentenmuseum_01.jpg",
    "https://commons.wikimedia.org/wiki/File:State_Institute_for_Music_Research.jpg",
  ],
} as const;

export const LENNE_TOWERS = [
  { number: 11, parent: "DEBE01YYK0002KkP", osm: "way/13760716", addressNode: "node/884695165", floors: 9,
    style: "stone-frame", tone: 0xd9d5c7, ids: ["IQ5AhecB", "7UGSsHsm", "al3juMqO", "kaSatKUT", "9nldpPdl"] },
  { number: 9, parent: "DEBE01YYK0002O4m", osm: "way/13760719", addressNode: "node/884695062", floors: 10,
    style: "stone-bays", tone: 0xd8d6ca, ids: ["4SDa70e1", "e7ZGCP2p", "FwZiNafh", "weDJUBkQ", "6lkBFSf2", "kl2VYSOS", "xGwM0tMA", "NfN5BmKa"],
    sourceUrl: "https://www.bnppre.de/gewerbeimmobilien/berlin/buero-mieten/B13790/" },
  { number: 7, parent: "DEBE01YYK0002N8w", osm: "way/13760721", addressNode: "node/884694986", floors: 10,
    style: "cms-stone", tone: 0xe3dfd1, ids: ["qQB1AGR1", "lxxhZDO8"],
    occupant: "CMS Hasche Sigle", occupantNode: "node/9706958017", sourceUrl: "https://cms.law/de/deu/office/berlin" },
  { number: 5, parent: "DEBE01YYK0002SCQ", osm: "way/13760720", addressNode: "node/884694916", floors: 10,
    style: "silver-frame", tone: 0xb8c4c1, ids: ["XM6avFqL", "FyfS3ijr", "hFNeHzwb", "uBEppUal", "XaqarDMo"],
    sourceUrl: "https://www.collignonarchitektur.com/de/projekte/lennestrasse-5" },
  { number: 3, parent: "DEBE01YYK0002TDz", osm: "way/26741679", addressNode: "node/884694818", floors: 10,
    style: "glass-bands", tone: 0xa7bbba, ids: ["iMW9gUC7", "UPG7jJKm"],
    sourceUrl: "https://www.collignonarchitektur.com/de/projekte/lennestrasse-3" },
] as const;
export const MUSEUM_LENNE_PRISM_TONES: Readonly<Record<string, number>> = Object.fromEntries([
  ...[...MUSIC_MUSEUM_IDS].map(id => [id, 0xb8b7a8]),
  ...LENNE_TOWERS.flatMap(tower => tower.ids.map(id => [id, tower.tone])),
]);
export const MUSEUM_LENNE_ROOF_TONES: Readonly<Record<string, number>> = Object.fromEntries(
  sourcePrisms.map(p => [p.id, MUSIC_MUSEUM_IDS.has(p.id) ? 0xaaa99b : 0x7c8883]),
);
export function musicMuseumBodyHeight(id: string, totalHeight: number): number {
  return id === MUSIC_MUSEUM_HALL_ID ? totalHeight - MUSIC_MUSEUM_HALL_ROOF_RISE : totalHeight;
}

// Derived from the existing prism renderer's fitRectangle/roofRise for these
// exact source parts. Facade strips end at eaves, leaving the retained pitched
// roofs exposed; these are renderer dimensions, not extra surveyed measurements.
export const MUSIC_MUSEUM_SOURCE_ROOF_RISES: Readonly<Record<string, number>> = {
  "7W5aNmQ5": 2.702809653636507,
  "HUDk4q9R": 1.972914382719324,
  "4sEwVreu": 1.9135738271232638,
  "ez443n2q": 1.2,
};
export function musicMuseumFacadeTop(id: string, sourceTop: number): number {
  return musicMuseumBodyHeight(id, sourceTop) - (MUSIC_MUSEUM_SOURCE_ROOF_RISES[id] ?? 0);
}

const hall = sourcePrisms.find(p => p.id === MUSIC_MUSEUM_HALL_ID)!;
const roofBase = (hall.y0_dm + hall.h_dm) / 10 - MUSIC_MUSEUM_HALL_ROOF_RISE;
/** Source-edge anchors shared with the three contiguous rooflight runs. */
export const MUSIC_MUSEUM_ROOF_LIGHT_RUNS = [
  { a: [-51.7, 907.9], b: [-47.3, 917.7], count: 3 },
  { a: [-49.5, 918.6], b: [-45.4, 927.9], count: 2 },
  { a: [-47.5, 928.9], b: [-42.1, 941.7], count: 3 },
] as const;
/** Roof support follows the rendered valleys/slopes instead of a floating flat maximum. */
export function musicMuseumRoofHeightAt(x: number, z: number, minecraft = false): number | null {
  let inside = false;
  for (let i = 0, j = hall.ring.length - 1; i < hall.ring.length; j = i++) {
    const ax = hall.ring[i][0] / 10, az = hall.ring[i][1] / 10;
    const bx = hall.ring[j][0] / 10, bz = hall.ring[j][1] / 10;
    if ((az > z) !== (bz > z) && x < (bx-ax)*(z-az)/(bz-az)+ax) inside = !inside;
  }
  if (!inside) return null;
  for (const run of MUSIC_MUSEUM_ROOF_LIGHT_RUNS) {
    const length = Math.hypot(run.b[0]-run.a[0],run.b[1]-run.a[1]);
    const dx=(run.b[0]-run.a[0])/length,dz=(run.b[1]-run.a[1])/length;
    const u=(x-run.a[0])*dx+(z-run.a[1])*dz, out=(x-run.a[0])*dz-(z-run.a[1])*dx;
    if (u < 0 || u > length || out < -8 || out > -.15) continue;
    const pitch=length/run.count, phase=u%pitch;
    if(phase<.04||phase>pitch-.04)continue;
    const t=(phase-.04)/(pitch-.08);
    return roofBase+(minecraft?Math.min(4,Math.floor(t*4)+1)*.6:.03+2.37*t);
  }
  return roofBase+(minecraft?0:.025);
}
