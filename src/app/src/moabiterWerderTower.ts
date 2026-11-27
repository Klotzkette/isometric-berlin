/** Bauteil C at Ingeborg-Drewitz-Allee. ALKIS DEBE01AL27w00003 minus its
 * one-storey part DEBE01AL27w0000B. Three measured corners give the slant
 * of the tower independently of the adjoining low building. */
import type { DeutschesTheaterVoxelPayload } from "./DeutschesTheater";
type Point = readonly [number, number];
export type MinistryBox = { p: number[]; s: number[]; yaw: number; color: number; role: string; roofBasis?: number[] };
const origin: Point = [-707.442, -290.022];
const across: Point = [25.213, .487];
const side: Point = [-13.894, 36.025];
const det = across[0] * side[1] - across[1] * side[0];
const surfaceY = 4.3;
// The core prism already models the low predecessor. The supplement begins at its roof.
export const moabiterTowerBase = 15.3;
export const moabiterTowerRoof = 53.89;
const stone = 0xcac8bc, glass = 0x52636a, steel = 0x888d88;
export const precedingTowerPrism = {
  id:"52954762", ring:[[-7135,-2540],[-7215,-2541],[-7078,-2906],[-6988,-2905],[-6987,-2937],
    [-6858,-2935],[-6859,-2903],[-6818,-2902],[-6958,-2516],[-7135,-2520]],
  holes:[], y0_dm:43, h_dm:110, class:0, roof:9999, tone:[159,173,170],
};
// Base elevations (dm) of the original four-metre columns below the new
// tower. A zero denotes open air; entries outside its footprint are skipped.
const previousColumns = [
  [-1,-1,-1,50,48,48,47,47,47,46], [-1,-1,0,48,47,47,46,45,44,-1],
  [-1,-1,47,46,45,44,43,43,42,-1], [-1,-1,45,44,43,43,43,43,0,-1],
  [-1,43,43,43,43,43,43,43,-1,-1], [-1,43,43,43,43,43,43,43,-1,-1],
  [43,43,43,43,43,43,43,0,-1,-1], [43,43,43,43,43,43,43,-1,-1,-1],
  [43,43,43,43,43,43,43,-1,-1,-1], [0,43,43,43,43,43,-1,-1,-1,-1],
];
export function moabiterTowerColumnsMatch(voxels: DeutschesTheaterVoxelPayload | undefined): boolean {
  if (!voxels || voxels.cell_m !== 4) return false;
  const {min_x_idx, min_z_idx}=voxels.grid;
  const rows=voxels.building_rows;
  const sparse=rows ? undefined : voxels.buildings?.filter(([x,z])=>x>=-180&&x<=-171&&z>=-73&&z<=-64);
  if (!rows && !sparse) return false;
  return previousColumns.every((expected,j)=>expected.every((floor,i)=>{
    if (floor<0) return true;
    const x=i-180,z=j-73;
    const found = rows ? rows[z-min_z_idx]?.filter(([start,n])=>x-min_x_idx>=start && x-min_x_idx<start+n)
      : sparse!.filter(([ix,iz])=>ix===x&&iz===z);
    return !!found && (floor===0 ? found.length===0 : found.length===1 &&
      found[0][2]===floor && found[0][3]===floor+120 && found[0][4]===3);
  }));
}

export function insideMoabiterTower(x: number, z: number, native: boolean): boolean {
  if (x < -724 || x > -680 || z < -293 || z > -251) return false;
  if (native) { x = Math.floor(x / 2) * 2 + 1; z = Math.floor(z / 2) * 2 + 1; }
  x -= origin[0]; z -= origin[1];
  const u = (x * side[1] - z * side[0]) / det;
  const v = (across[0] * z - across[1] * x) / det;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

type Wall = { a: Point; b: Point };
const point = (u: number, v: number): Point =>
  [origin[0] + u * across[0] + v * side[0], origin[1] + u * across[1] + v * side[1]];

export function* moabiterTowerRows(native: boolean): Generator<void, MinistryBox[]> {
  const rows: MinistryBox[] = [];
  const walls: Wall[] = [];
  const height = moabiterTowerRoof - moabiterTowerBase;
  const mid = moabiterTowerBase + height / 2;
  if (native) {
    // Merge occupied two-metre cells along each row. Only the exposed
    // cardinal edges receive windows, including the short returns at steps.
    let previous: [number, number] | undefined;
    const horizontal = (range: [number, number], next: [number, number] | undefined, z: number, north: boolean) => {
      for (const [left, right] of next ? [[range[0], Math.min(range[1], next[0])],
        [Math.max(range[0], next[1]), range[1]]] : [range]) {
        if (right > left) walls.push(north ? {a:[left,z], b:[right,z]} : {a:[right,z], b:[left,z]});
      }
    };
    for (let z = -292; z <= -250; z += 2) {
      let first = Infinity, end = -Infinity;
      for (let x = -724; x < -680; x += 2) if (insideMoabiterTower(x + 1, z + 1, true)) {
        first = Math.min(first, x); end = x + 2;
      }
      const range: [number,number] | undefined = end > first ? [first,end] : undefined;
      if (previous) horizontal(previous, range, z, false);
      if (range) {
        horizontal(range, previous, z, true);
        rows.push({p:[(first+end)/2,mid,z+1], s:[end-first,height,2], yaw:0, color:stone, role:"C tower stepped stone"});
        walls.push({a:[first,z+2],b:[first,z]}, {a:[end,z],b:[end,z+2]});
      }
      previous = range;
    }
  } else {
    const centre = point(.5, .5);
    rows.push({p:[centre[0],mid,centre[1]], s:[1,height,1], yaw:0, color:stone, role:"C tower limestone",
      roofBasis:[...across,...side]});
    const corners = [point(0,0), point(1,0), point(1,1), point(0,1)];
    for (let i=0; i<4; i++) walls.push({a:corners[i], b:corners[(i+1)%4]});
  }
  const storey = (moabiterTowerRoof - surfaceY) / 13;
  for (const {a,b} of walls) {
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]), dx=(b[0]-a[0])/length, dz=(b[1]-a[1])/length;
    const count=Math.max(1, Math.round(length/2.75)), pitch=length/count;
    const add=(u:number,y:number,width:number,h:number,depth:number,out:number,color:number,role:string) => {
      const transverse = native && Math.abs(dz)>.5;
      rows.push({p:[a[0]+dx*u+dz*out,y,a[1]+dz*u-dx*out],
        s:transverse?[depth,h,width]:[width,h,depth],yaw:native?0:-Math.atan2(dz,dx),color,role});
    };
    for (let floor=3; floor<13; floor++) {
      const y=surfaceY+(floor+.5)*storey, h=storey*.79, w=pitch*.64;
      for (let bay=0;bay<count;bay++) {
        const u=(bay+.5)*pitch;
        add(u,y,w,h,.075,.07,glass,"glazing");
        add(u,y,.075,h,.10,.13,steel,"C tower glazing bar");
        add(u-w/2-.075,y,.15,h,.34,.20,stone,"C tower reveal");
        add(u,y+h/2+.08,w+.30,.16,.41,.235,stone,"C tower projecting lintel");
      }
    }
    yield;
  }
  return rows;
}
