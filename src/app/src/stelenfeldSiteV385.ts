import owners from "./data/stelenfeldV385/owners.json";
import { decodeBase64Bytes } from "./decodeBase64Bytes";

/** Cadastral memorial site DEBE00YYGu00005X, EPSG:25833 in viewer metres. */
export const STELENFELD_RING = [
  [397.094,646.486], [567.051,596.003], [553.704,551.213], [533.946,484.942],
  [512.016,491.344], [414.620,499.451], [407.128,548.424], [391.905,648.027],
] as const;

export const STELENFELD_ANCHOR = [462.88128157681786, 557.3677023872733] as const;
export const STELENFELD_BASE = 4.61;
export const HOLOCAUST_MINECRAFT_PROTECTION = {
  centreWorldM: STELENFELD_ANCHOR, edgeClearanceM: 8,
} as const;

export function inStelenfeldSite(x: number, z: number): boolean {
  if (x < 391.9 || x > 567.06 || z < 484.94 || z > 648.03) return false;
  let inside = false;
  for (let i = 0, j = STELENFELD_RING.length - 1; i < STELENFELD_RING.length; j = i++) {
    const [a,b] = STELENFELD_RING[i], [c,d] = STELENFELD_RING[j];
    if ((b > z) !== (d > z) && x < (c-a) * (z-b) / (d-b) + a) inside = !inside;
  }
  return inside;
}

/** The drawn and block worlds keep complete original 4 m cells at the rim.
 * The measured pavement meets those cells over its narrow outside margin. */
export function stelenfeldOwnsGroundCell(x: number, z: number): boolean {
  if (x < 392 || x > 567 || z < 485 || z > 648) return false;
  return inStelenfeldSite(x-2,z-2) && inStelenfeldSite(x+2,z-2) &&
    inStelenfeldSite(x+2,z+2) && inStelenfeldSite(x-2,z+2);
}

export function isHolocaustMinecraftProtectedAt(x: number, z: number, extraClearanceM = 0): boolean {
  const gap = 8 + Math.max(0, extraClearanceM);
  if (x < 391-gap || x > 568+gap || z < 484-gap || z > 649+gap) return false;
  if (inStelenfeldSite(x,z)) return true;
  return STELENFELD_RING.some(([ax,az], i) => {
    const [bx,bz] = STELENFELD_RING[(i+1)%STELENFELD_RING.length], dx=bx-ax, dz=bz-az;
    const t=Math.max(0, Math.min(1, ((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    return (x-ax-t*dx)**2 + (z-az-t*dz)**2 <= gap*gap;
  });
}

type OldPrism = {id:string; y0_dm:number; h_dm:number; class:number; ring:number[][]; holes?:number[][][]};
let signatures: Set<number> | undefined;

/** Admit only exact source IDs, footprint, material, elevations and holes. */
export function replacesStelePrism(building: OldPrism): boolean {
  const pt=building.ring[0];
  if (!pt || pt[0]<3890 || pt[0]>5685 || pt[1]<4830 || pt[1]>6495) return false;
  signatures ??= new Set(new Uint32Array(decodeBase64Bytes(owners.prisms).buffer));
  let hash=2166136261;
  const add=(v:number) => { hash=Math.imul(hash^v,16777619); };
  for (let i=0;i<building.id.length;i++) add(building.id.charCodeAt(i));
  add(building.y0_dm); add(building.h_dm); add(building.class);
  for (const ring of [building.ring,...(building.holes??[])]) {
    add(ring.length);
    for (const [x,z] of ring) { add(x); add(z); }
  }
  return signatures.has(hash>>>0);
}

let columnLevels: Map<number,number> | undefined;
export function replacesSteleColumn(x: number, z: number, low: number, high: number, cls: number): boolean {
  const span = high - low;
  if (x<97 || x>142 || z<119 || z>164 || cls!==3 || (span!==40 && span!==80)) return false;
  if (!columnLevels) {
    columnLevels = new Map();
    for (const [height, runs] of [[40, owners.columns], [80, owners.tallColumns]] as const) {
      for (const [row,start,end,level] of runs) {
        for (let i=start;i<end;i++) columnLevels.set(row*256+i, 128*level + height);
      }
    }
  }
  return columnLevels.get(z*256+x) === 128*low + span;
}
