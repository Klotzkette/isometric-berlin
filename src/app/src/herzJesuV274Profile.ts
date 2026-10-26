import source from "./data/northCultureV274Source.json";
const s = source.herzJesu;
const dx=s.b[0]-s.a[0], dz=s.b[1]-s.a[1], length=Math.hypot(dx,dz);
const tx=dx/length, tz=dz/length, nx=-tz, nz=tx;
export const HERZ_JESU_V274_ID = "DEBE03YY6000006I:restored-campanile";
export const HERZ_JESU_V274_BASE = 25;
export const HERZ_JESU_V274_CELL = .65;
// Same finite horizontal sections as the renderer, including roof/eave courses.
export const HERZ_JESU_V274_SECTIONS = [
  {width:s.towerWidth,depth:s.towerDepth,y:36.55,height:23.1,color:0xb4ac94,role:"55m-campanile"},
  ...[28.7,36.5,41.2,47.9].map(y=>({width:9.02,depth:8.72,y,height:.28,color:0xd0c2a0,role:"tower-stringcourse"})),
  ...Array.from({length:28},(_,k)=>({width:Math.max(.24,9.4*(1-k/28)),depth:Math.max(.24,9.1*(1-k/28)),
    y:48.15+k*.30,height:.32,color:k%4?0x8f5444:0xa6654d,role:"tower-pyramid-roof"})),
];
export const HERZ_JESU_V274_RING = [[-4.7,-4.55],[4.7,-4.55],[4.7,4.55],[-4.7,4.55]].map(([u,v])=>
  [s.towerCenter[0]+tx*u+nx*v,s.towerCenter[1]+tz*u+nz*v]);
// Native sections are explicitly occupied .65m cells. The smaller roof crown
// follows the same short-member stepping rule used by NorthCulturePlanV274.
export function herzJesuV274RoofAt(x:number,z:number,native=false):number|null {
  if(!Number.isFinite(x)||!Number.isFinite(z))return null;
  if(Math.abs(x-s.towerCenter[0])>8||Math.abs(z-s.towerCenter[1])>8)return null;
  let top:number|null=null;
  for(const q of HERZ_JESU_V274_SECTIONS){
    let occupied=false;
    if(native&&q.width*q.depth>6){
      const cx=(Math.floor(x/HERZ_JESU_V274_CELL)+.5)*HERZ_JESU_V274_CELL-s.towerCenter[0];
      const cz=(Math.floor(z/HERZ_JESU_V274_CELL)+.5)*HERZ_JESU_V274_CELL-s.towerCenter[1];
      occupied=Math.abs(cx*tx+cz*tz)<=q.width/2&&Math.abs(cx*nx+cz*nz)<=q.depth/2;
    }else if(native){
      const n=Math.max(1,Math.ceil(q.width/.45)), w=Math.max(.06,Math.abs(tx)*q.width/n+Math.abs(nx)*q.depth),d=Math.max(.06,Math.abs(tz)*q.width/n+Math.abs(nz)*q.depth);
      for(let i=0;i<n&&!occupied;i++){const u=(i+.5)*q.width/n-q.width/2;
        occupied=Math.abs(x-s.towerCenter[0]-tx*u)<=w/2&&Math.abs(z-s.towerCenter[1]-tz*u)<=d/2;}
    }else{const cx=x-s.towerCenter[0],cz=z-s.towerCenter[1];occupied=Math.abs(cx*tx+cz*tz)<=q.width/2&&Math.abs(cx*nx+cz*nz)<=q.depth/2;}
    if(occupied)top=Math.max(top??-Infinity,q.y+q.height/2);
  }
  return top;
}
export const HERZ_JESU_V274_NATIVE_RING = (()=>{
  const xs=HERZ_JESU_V274_RING.map(p=>p[0]),zs=HERZ_JESU_V274_RING.map(p=>p[1]),m=HERZ_JESU_V274_CELL/2;
  return [[Math.min(...xs)-m,Math.min(...zs)-m],[Math.max(...xs)+m,Math.min(...zs)-m],[Math.max(...xs)+m,Math.max(...zs)+m],[Math.min(...xs)-m,Math.max(...zs)+m]];
})();

export type HerzJesuSolidV274 = {
  ring: number[][]; minY: number; maxY: number; sourceId: string;
};

/** Exact constructed sections, with native cells merged only along a row.
 * In particular the corners of the rotated tower's AABB remain empty, and
 * projecting eaves do not acquire an invented solid wall beneath them. */
export function herzJesuV274Solids(native = false): HerzJesuSolidV274[] {
  const result: HerzJesuSolidV274[] = [];
  function add(x: number, z: number, width: number, depth: number,
    q: typeof HERZ_JESU_V274_SECTIONS[number], index: number, rotated = false): void {
    const ring = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v]) => {
      const a=u*width/2, b=v*depth/2;
      return rotated ? [x+tx*a+nx*b,z+tz*a+nz*b] : [x+a,z+b];
    });
    result.push({ring, minY:q.y-q.height/2, maxY:q.y+q.height/2,
      sourceId:`${HERZ_JESU_V274_ID}:${native ? "native" : "drawn"}:${index}:${result.length}`});
  }
  HERZ_JESU_V274_SECTIONS.forEach((q,index) => {
    const [x,z]=s.towerCenter;
    if(!native){add(x,z,q.width,q.depth,q,index,true);return;}
    if(q.width*q.depth<=6){
      const n=Math.max(1,Math.ceil(q.width/.45));
      for(let i=0;i<n;i++){
        const u=(i+.5)*q.width/n-q.width/2;
        add(x+tx*u,z+tz*u,Math.max(.06,Math.abs(tx)*q.width/n+Math.abs(nx)*q.depth),
          Math.max(.06,Math.abs(tz)*q.width/n+Math.abs(nz)*q.depth),q,index);
      }
      return;
    }
    const cell=HERZ_JESU_V274_CELL, ex=Math.abs(tx*q.width/2)+Math.abs(nx*q.depth/2),
      ez=Math.abs(tz*q.width/2)+Math.abs(nz*q.depth/2);
    for(let iz=Math.floor((z-ez)/cell);(iz+.5)*cell<z+ez;iz++){
      let first:number|null=null,last:number|null=null;
      for(let ix=Math.floor((x-ex)/cell);(ix+.5)*cell<x+ex;ix++){
        const dx=(ix+.5)*cell-x,dz=(iz+.5)*cell-z;
        if(Math.abs(dx*tx+dz*tz)<=q.width/2&&Math.abs(dx*nx+dz*nz)<=q.depth/2){
          first??=ix;last=ix;
        }
      }
      if(first!==null&&last!==null)add((first+last+1)*cell/2,(iz+.5)*cell,
        (last-first+1)*cell,cell,q,index);
    }
  });
  return result;
}
