import sourcePrisms from "./boellStiftungPrisms.json";

export const BOELL_STIFTUNG_GROUP = "Heinrich Boell Stiftung source-bound architecture";
export const MINECRAFT_BOELL_STIFTUNG_GROUP = "Minecraft Heinrich Boell Stiftung architecture";
export const BOELL_STIFTUNG_SOURCE_PRISMS = sourcePrisms;
export const BOELL_STIFTUNG_IDS: ReadonlySet<string> = new Set(sourcePrisms.map(p => p.id));
export const BOELL_STIFTUNG_LOW_ID = "PZ80obrB";
export const BOELL_STIFTUNG_CORE_ID = "G9NcorMt";
export const BOELL_STIFTUNG_UNDERSIDE = 8.8;
export const BOELL_STIFTUNG_BELETAGE_TOP = 15.8;
export const BOELL_STIFTUNG_TOP = 28.8;
export const BOELL_STIFTUNG_PROFILE = {
  name: "Heinrich-Böll-Stiftung", address: "Schumannstraße 8, 10117 Berlin",
  osm: "node/4597099723", anchor: [791.971, -535.391], parent: "DEBE01YYK00003sO",
  architects: "Piet and Wim Eckert / e2a", opened: 2008,
  aboveGroundFloors: 5, officeRows: 3,
  sourceStatus: "Exact two delivered LoD2 outlines and maximum heights retained. PZ80obrB is an elevated beletage, not a closed ground-level annex. Its 8.8 m viewer underside is a photo-proportioned display estimate. Core G9NcorMt remains unchanged. Facade divisions, roof equipment, closed seasonal atrium cover and sign strokes are procedural recognition details, not a measured facade survey.",
  sourceUrls: [
    "https://www.boell.de/de/das-stiftungshaus-der-schumannstrasse",
    "https://www.boell.de/sites/default/files/hbs_neubau_broschure.pdf",
    "https://www.boell.de/de/presse/neubau-4970.html",
  ],
  referenceUrls: [
    "https://commons.wikimedia.org/wiki/File:Heinrich-Böll-Stiftung_building_Berlin_2024-05-09_01.jpg",
    "https://commons.wikimedia.org/wiki/File:Heinrich-Böll-Stiftung_building_Berlin_2024-05-09_04.jpg",
    "https://commons.wikimedia.org/wiki/File:Eingang_zum_Gebäude_der_Heinrich-Böll-Stiftung,_Berlin.jpg",
  ],
  roofReference: { source: "Geoportal Berlin DOP 2025 spring, dl-de/zero-2-0", service: "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr", bbox: [390260, 5820490, 390330, 5820560], width: 1400, height: 1400, status: "Roof vocabulary only; rectified local arrangement is a display estimate, not surveyed coordinates." },
} as const;
export const BOELL_STIFTUNG_PRISM_TONES: Readonly<Record<string, number>> = {
  [BOELL_STIFTUNG_CORE_ID]: 0xc8d0cf, [BOELL_STIFTUNG_LOW_ID]: 0x437d75,
};
export const BOELL_STIFTUNG_ROOF_TONES: Readonly<Record<string, number>> = {
  [BOELL_STIFTUNG_CORE_ID]: 0xa4a69a, [BOELL_STIFTUNG_LOW_ID]: 0xc2c8bb,
};

type Part = { ring: number[][]; holes?: number[][][] };
function inRing(ring: readonly (readonly number[])[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function boellStiftungPrismContains(part: Part, x: number, z: number): boolean {
  return inRing(part.ring, x * 10, z * 10) && !(part.holes ?? []).some(r => inRing(r, x * 10, z * 10));
}
const low = sourcePrisms.find(p => p.id === BOELL_STIFTUNG_LOW_ID)!;
const core = sourcePrisms.find(p => p.id === BOELL_STIFTUNG_CORE_ID)!;
/**
 * Retain source-centred core columns, but remove their vertical voxel rounding
 * above the exact flat roof. A different taller building is never shortened.
 */
export function boellStiftungCoreColumnTopAt(x: number, z: number, sourceTop: number, cell = 4): number {
  if (x < 774.9 || x > 814 || z < -543.2 || z > -504.3 || !boellStiftungPrismContains(core, x, z)) return sourceTop;
  if (!Number.isFinite(cell) || cell <= 0 || !Number.isFinite(sourceTop)) return sourceTop;
  const roundedSourceTop = core.y0_dm / 10 + Math.ceil(core.h_dm / (10 * cell)) * cell;
  return sourceTop <= roundedSourceTop + 1e-5 ? Math.min(sourceTop, BOELL_STIFTUNG_TOP) : sourceTop;
}
/** Replace only the erroneous closed low-annex voxel mass. */
export function boellStiftungLowColumnContains(x: number, z: number): boolean {
  return x >= 772 && x <= 816 && z >= -545 && z <= -497 && boellStiftungPrismContains(low, x, z);
}
/** The open ground under the cantilever remains walkable. y is the query height. */
export function boellStiftungLowSolidAt(x: number, y: number, z: number): boolean {
  return y >= BOELL_STIFTUNG_UNDERSIDE && y <= BOELL_STIFTUNG_BELETAGE_TOP && boellStiftungLowColumnContains(x, z);
}
export function boellStiftungLowTopAt(x: number, z: number): number | null {
  return boellStiftungLowColumnContains(x, z) ? BOELL_STIFTUNG_BELETAGE_TOP : null;
}
