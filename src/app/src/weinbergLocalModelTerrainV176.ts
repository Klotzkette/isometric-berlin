import profile from "./data/weinbergTerrainV176.json";
import basinData from "./data/weinbergBasinsV176.json";
import { nativeTerrainOffset } from "./weinbergTerrainV176";

const basins=basinData.basins.map(basin=>({...basin,
  bounds:[Math.min(...basin.ring.map(p=>p[0])),Math.min(...basin.ring.map(p=>p[1])),Math.max(...basin.ring.map(p=>p[0])),Math.max(...basin.ring.map(p=>p[1]))],
}));

function ringRectangleArea(ring:readonly (readonly number[])[],x0:number,z0:number,x1:number,z1:number):number {
  let points=ring.map(p=>[p[0],p[1]]);
  for(const [axis,edge,sign] of [[0,x0,1],[0,x1,-1],[1,z0,1],[1,z1,-1]]){
    const clipped:number[][]=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],da=(a[axis]-edge)*sign,db=(b[axis]-edge)*sign;
      if(da>=0)clipped.push(a);
      if((da<0)!==(db<0)){
        const t=da/(da-db);clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
      }
    }
    points=clipped;
    if(points.length<3)return 0;
  }
  // Translate before the shoelace sum so quarter-cell edge slivers are stable.
  return Math.abs(points.reduce((sum,a,i)=>{
    const b=points[(i+1)%points.length];
    return sum+(a[0]-x0)*(b[1]-z0)-(b[0]-x0)*(a[1]-z0);
  },0))/2;
}

/** Raster boundary cells may straddle the exact basin despite a cut source sheet.
 * Cap only overlapping quarter-metre pieces; retain each rectangle's full
 * footprint, colour and solid volume, and keep every instance axis aligned.
 */
function appendBasinCappedRow(result:number[][],row:number[]):void {
  const [x,y,z,w,h,d,color]=row,x0=x-w/2,z0=z-d/2,x1=x+w/2,z1=z+d/2;
  const relevant=basins.filter(b=>y+h/2>b.floorY&&x1>b.bounds[0]&&x0<b.bounds[2]&&z1>b.bounds[1]&&z0<b.bounds[3]);
  const levelAt=(a:number,c:number,b:number,d:number):number|undefined=>{
    for(const basin of relevant){
      const area=ringRectangleArea(basin.ring,a,c,b,d)-basin.holes.reduce((sum,hole)=>sum+ringRectangleArea(hole,a,c,b,d),0);
      if(area>1e-9)return basin.floorY;
    }
    return undefined;
  };
  if(!relevant.length||levelAt(x0,z0,x1,z1)===undefined){result.push(row);return;}
  for(let a=x0;a<x1-1e-9;){
    const b=Math.min(x1,(Math.floor(a*4+1e-9)+1)/4);
    for(let c=z0;c<z1-1e-9;){
      const d=Math.min(z1,(Math.floor(c*4+1e-9)+1)/4),level=levelAt(a,c,b,d);
      result.push([(a+b)/2,level===undefined?y:Math.min(y,level-h/2),(c+d)/2,b-a,h,d-c,color]);
      c=d;
    }
    a=b;
  }
}

export function localTerrainIntersects(x0: number, z0: number, x1: number, z1: number): boolean {
  const [west, north, east, south] = profile.support;
  return x1 > west && x0 < east && z1 > north && z0 < south;
}

/** Preserve each source rectangle while splitting only local native terraces. */
export function nativeTerrainGroundRows(
  rows: readonly number[][],
  waterLevel?: (x: number, z: number, color: number) => number | undefined,
): number[][] {
  const result: number[][] = [];
  for (const row of rows) {
    const [x, y, z, width, height, depth, color] = row;
    const water = waterLevel?.(x, z, color);
    if (water !== undefined) { result.push([x, water - height / 2, z, width, height, depth, color]); continue; }
    const x0 = x - width / 2, x1 = x + width / 2;
    const z0 = z - depth / 2, z1 = z + depth / 2;
    if (!localTerrainIntersects(x0, z0, x1, z1)) { result.push([...row]); continue; }
    for (let a = x0; a < x1 - 1e-9;) {
      const b = Math.min(x1, (Math.floor(a / 4 + 1e-9) + 1) * 4);
      for (let c = z0; c < z1 - 1e-9;) {
        const d = Math.min(z1, (Math.floor(c / 4 + 1e-9) + 1) * 4);
        const cx = (a + b) / 2, cz = (c + d) / 2;
        appendBasinCappedRow(result,[cx, y + nativeTerrainOffset(cx, cz), cz, b - a, height, d - c, color]);
        c = d;
      }
      a = b;
    }
  }
  return result;
}
