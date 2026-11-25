/** Separate LoD2 canopy at the Ritz-Carlton's main door, OSM node 7077890144. */
export const ritzCanopyRingV385: [number, number][] = [[240.6,986.4],[242.5,979.5],[250.2,978.8],[253.4,985.1]];
export const ritzCanopyTopV385 = 11.3;
export const ritzCanopySoffitV385 = 10.98;

type Prism = { id:string; ring:readonly (readonly number[])[]; holes?:readonly unknown[]; y0_dm:number; h_dm:number };
export function isRitzCanopyV385(p: Prism) {
  return p.id === 'K0003V2X' && p.y0_dm === 53 && p.h_dm === 60 && !p.holes?.length &&
    p.ring.length === 4 && p.ring.every(([x,z],i) => x === Math.round(10*ritzCanopyRingV385[i][0]) && z === Math.round(10*ritzCanopyRingV385[i][1]));
}

export function isRitzCanopyColumnV385(x: number,z: number,bottom: number,top: number,cls: number) {
  return bottom === 53 && top === 133 && cls === 3 && ((z === 245 && x >= 60 && x <= 62) || (z === 246 && x === 60));
}

/** Each horizontal native strip samples both edges of the retained trapezoid. */
export function nativeRitzCanopyRingsV385(): [number,number][][] {
  const strips: [number,number][][] = [];
  const low = 978.8, high = 986.4, count = 20;
  for (let row=0; row<count; row++) {
    const z0=low+(high-low)*row/count, z1=low+(high-low)*(row+1)/count, mid=(z0+z1)/2;
    const xs:number[]=[];
    for (let j=0;j<4;j++) {
      const a=ritzCanopyRingV385[j],b=ritzCanopyRingV385[(j+1)%4];
      if (mid >= Math.min(a[1],b[1]) && mid < Math.max(a[1],b[1])) xs.push(a[0]+(b[0]-a[0])*(mid-a[1])/(b[1]-a[1]));
    }
    const l=Math.min(...xs),r=Math.max(...xs);
    strips.push([[l,z0],[r,z0],[r,z1],[l,z1]]);
  }
  return strips;
}

/** Verify the original elevated-roof candidate without expanding the packed voxel rows. */
export function hasRitzCanopyColumnsV385(payload: Pick<import('./terrainPayload').VoxelPayload,'buildings'|'building_rows'|'grid'|'cell_m'>) {
  if(payload.cell_m!==4) return false;
  const footprint=[[60,245],[61,245],[62,245],[60,246]];
  if(!payload.building_rows) return footprint.every(([x,z])=>payload.buildings?.some(col=>col[0]===x && col[1]===z && isRitzCanopyColumnV385(...col)));
  return footprint.every(([x,z])=>{
    const ix=x-payload.grid.min_x_idx;
    return payload.building_rows?.[z-payload.grid.min_z_idx]?.some(([i,n,lo,hi,cls])=>i<=ix && ix<i+n && isRitzCanopyColumnV385(x,z,lo,hi,cls));
  });
}
