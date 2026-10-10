import source from "./data/uraniaArcV206Navigation.json";

type Ring = readonly (readonly number[])[];
function inside(x: number, z: number, ring: Ring): boolean {
  let result = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if ((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) result=!result;
  }
  return result;
}

export const URANIA_ARC_V206_PRISM_ID = source.sourceOwner;
export const URANIA_ARC_V206_NAVIGATION_PARTS = source.parts;
const oldColumns = new Map(source.legacyVoxelColumns.map(row => [`${row[0]},${row[1]}`, row]));

/** Only the 86 documented coarse columns belonging to source prism 11687794. */
export function uraniaArcV206SourceColumn(x: number, z: number, bottomY: number, topY: number): boolean {
  const cell = source.legacyVoxelCellM;
  const xi = Math.round((x-cell/2)/cell), zi = Math.round((z-cell/2)/cell);
  const row = oldColumns.get(`${xi},${zi}`);
  return row !== undefined && Math.abs(x-(xi+.5)*cell)<1e-5 && Math.abs(z-(zi+.5)*cell)<1e-5 &&
    Math.abs(bottomY-row[2]/10)<1e-5 && Math.abs(topY-row[3]/10)<1e-5;
}

/** Flat official roof planes; the entrance recess never deletes roof collision. */
export function uraniaArcV206RoofAt(x: number, z: number): number | null {
  let top: number | null = null;
  for (const p of source.roofPlanes) {
    if (inside(x,z,p.ring) && !p.holes.some(h => inside(x,z,h))) top=Math.max(top??-Infinity,p.topY);
  }
  return top;
}

/** Bounded same-datum source interior, upper slab, rear wing and 13 pale posts. */
export function uraniaArcV206SolidAt(x: number, y: number, z: number): boolean {
  return source.parts.some(p => y>=p.groundY && y<=p.topY && inside(x,z,p.ring) && !p.holes.some(h=>inside(x,z,h)));
}
