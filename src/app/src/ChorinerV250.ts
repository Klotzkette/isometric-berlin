import data from "./data/chorinerV250.json";
import north from "./data/northV185.json";
import places from "./data/schoolsPlacesV205.json";
import central from "./data/centralNamedV230.json";

type Face = typeof north.faces[number];
type Members = { owner: string; boxes: number[][]; rods: number[][]; nativeRows: number[][] };
const OWNER = "DEBE01YYK00005YZ";

/** Exact numeric receipts admit only obsolete authored fittings, never shells. */
export function chorinerV250Fingerprint(rows: readonly number[][]): number[] {
  let a=2166136261,b=5381;
  const feed=(s:string)=>{for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619)>>>0;b=(Math.imul(b,33)^s.charCodeAt(i))>>>0;}};
  rows.forEach((r,i)=>{if(i)feed(";");r.forEach((v,j)=>{if(j)feed(",");feed(v.toFixed(6));});});
  return [rows.length,a,b];
}
const same=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const faceRows=(fs:readonly Face[])=>fs.map(f=>[...f.a,...f.b,...f.normal,f.wallBottom,f.wallTop]);
function placeMatches(g:Members|undefined):boolean {
  return !!g&&g.owner===OWNER&&(["boxes","rods","nativeRows"] as const)
    .every(k=>same(chorinerV250Fingerprint(g[k]),data.previous.v205[k]));
}
function centralMatches(g:Members|undefined):boolean {
  return !!g&&g.owner===OWNER&&(["boxes","nativeRows"] as const)
    .every(k=>same(chorinerV250Fingerprint(g[k].slice(0,data.previous.v230[k][0])),data.previous.v230[k]));
}
let ready:boolean|undefined;
export function canRefineChorinerV250():boolean {
  if(ready!==undefined)return ready;
  const fs=north.faces.filter(f=>f.kind==="choriner");
  ready=fs.every(f=>f.id===OWNER)
    &&same(chorinerV250Fingerprint(faceRows(fs)),data.previous.v185)
    &&placeMatches(places.places.find(g=>g.name==="Choriner Höfe – street fronts"))
    &&centralMatches(central.sites.find(g=>g.key==="choriner-hoefe"));
  return ready;
}

/** A changed/unrelated prior feature fails open, preserving its older detail. */
export function replacesChorinerV250Face(f:Face):boolean {
  return canRefineChorinerV250()&&f.id===OWNER&&f.kind==="choriner"
    &&north.faces.some(old=>old===f||old.id===f.id&&JSON.stringify(old)===JSON.stringify(f));
}
export function replacesChorinerV250Place(g:Members):boolean {
  return canRefineChorinerV250()&&placeMatches(g);
}
export function refineChorinerV250Central<T extends Members>(g:T):T {
  if(!canRefineChorinerV250()||!centralMatches(g))return g;
  // The prefix is precisely old window joints/reflections. All later measured
  // stepped-roof copings and all other sites survive bit-for-bit.
  return {...g,boxes:g.boxes.slice(data.previous.v230.boxes[0]),nativeRows:g.nativeRows.slice(data.previous.v230.nativeRows[0])};
}

/** Append compact source-plane recipes to the existing choriner NorthV185 batch.
 * Native blocks are independently axis-aligned, with no yaw or reduced mobile
 * detail. Numeric construction buffers live only as long as the caller needs. */
export function appendChorinerV250(rows:number[][],native:boolean):void {
  if(!canRefineChorinerV250())return;
  for(const f of data.faces){
    const [ax,az]=f.a,[tx,tz]=f.t,[nx,nz]=f.n;
    const yaw=-Math.atan2(tz,tx);
    for(const r of f.members){
      const [u,y,w,h,out,d]=r.slice(0,6).map(v=>v/1000),color=data.colors[r[6]];
      if(!native){rows.push([ax+tx*u+nx*out,y,az+tz*u+nz*out,w,h,d,yaw,color]);continue;}
      const count=Math.max(1,Math.ceil(w/.7)),step=w/count;
      for(let i=0;i<count;i++){
        const at=u-w/2+(i+.5)*step,offset=out+1.06;
        rows.push([ax+tx*at+nx*offset,y,az+tz*at+nz*offset,
          Math.max(.12,Math.abs(tx)*step)+Math.abs(nx)*d,h,
          Math.max(.12,Math.abs(tz)*step)+Math.abs(nz)*d,color]);
      }
    }
  }
}

export const CHORINER_V250_CAMERAS=data.cameras;
export const CHORINER_V250_OWNERS=data.owners;
