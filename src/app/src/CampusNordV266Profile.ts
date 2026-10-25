import data from './data/campusNordV266.json';
import previous from './data/campusNordV266AltMittePrevious.json';
import { transferExactPacketLines, transferExactPacketTriangles } from './exactPacketTransfer';
import type { SurroundingPackedLines, SurroundingPackedMesh } from './SurroundingCityGeometry';

type Source={id?:unknown;ring?:unknown;holes?:unknown;y0_dm?:unknown;h_dm?:unknown;class?:unknown;roof?:unknown;tone?:unknown};
const fingerprint=(p:Source)=>JSON.stringify([p.id,p.ring,p.holes,p.y0_dm,p.h_dm,p.class,p.roof,p.tone]);
const knownNeighbours=new Map(data.neighbours.map(p=>[p.id,fingerprint(p)]));
export function isCampusCanopySourceV266(value:unknown):boolean{
  return !!value&&typeof value==='object'&&fingerprint(value as Source)===fingerprint(data.canopy.previousPrism);
}
export function campusCanopyContainsV266(x:number,z:number):boolean{
  const ring=data.canopy.ring;let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function createCampusCanopyColumnTesterV266(prisms:readonly unknown[]|undefined,cell:number){
  const no=(_x:number,_z:number,_lo:number,_hi:number,_kind:number)=>false;
  if(cell!==data.canopy.cellM||!prisms?.some(isCampusCanopySourceV266))return no;
  const candidates=data.canopy.columns.filter(c=>!prisms.some(raw=>{
    const p=raw as Source;if(isCampusCanopySourceV266(p)||!Array.isArray(p?.ring))return false;
    // These exact neighbours were checked by polygon intersection in the receipt.
    // Their oblique bounding boxes overlap safe corner cells; changed/new owners
    // still use the deliberately conservative test below.
    if(typeof p.id==='string'&&knownNeighbours.get(p.id)===fingerprint(p))return false;
    const ring=p.ring as number[][],x0=c[0]*cell*10,z0=c[1]*cell*10,x1=x0+cell*10,z1=z0+cell*10;
    return !(ring.every(p=>p[0]<x0)||ring.every(p=>p[0]>x1)||ring.every(p=>p[1]<z0)||ring.every(p=>p[1]>z1));
  }));
  const keys=new Set(candidates.map(c=>c.join('/')));
  return(x:number,z:number,lo:number,hi:number,kind:number)=>keys.has([x,z,lo,hi,kind].join('/'));
}
/** The canopy is cantilevered from the retained glazed foyer, not a ground wall. */
export function campusCanopySolidsV266(native=false){
  const common={holes:[] as number[][][],minY:data.canopy.topY-.14,maxY:data.canopy.topY+.02,sourceId:'K0001xN5'};
  if(!native)return[{ring:data.canopy.ring,...common}];
  const ring=data.canopy.ring,cell=.5,minX=Math.min(...ring.map(p=>p[0])),maxX=Math.max(...ring.map(p=>p[0])),minZ=Math.min(...ring.map(p=>p[1])),maxZ=Math.max(...ring.map(p=>p[1]));
  const solids:{ring:number[][];holes:number[][][];minY:number;maxY:number;sourceId:string}[]=[];
  for(let ix=Math.floor(minX/cell);ix<=Math.ceil(maxX/cell);ix++)for(let iz=Math.floor(minZ/cell);iz<=Math.ceil(maxZ/cell);iz++){
    const x=(ix+.5)*cell,z=(iz+.5)*cell;if(!campusCanopyContainsV266(x,z))continue;
    solids.push({ring:[[x-.25,z-.25],[x+.25,z-.25],[x+.25,z+.25],[x-.25,z+.25]],...common});
  }
  return solids;
}
export function* transferCampusCanopyTrianglesV266(enabled:boolean,tile:string,native:boolean,part:SurroundingPackedMesh,indices:Uint16Array|Uint32Array,offset:number):Generator<void,number>{
  if(!enabled||part.kind!=='alt-mitte-v169'||!previous.records.some(r=>r.tile===tile))return 0;
  return yield* transferExactPacketTriangles(previous.records,tile,native,part,indices,offset);
}
export function* transferCampusCanopyLinesV266(enabled:boolean,tile:string,part:SurroundingPackedLines,values:Uint16Array,stride:number):Generator<void,number>{
  if(!enabled||!previous.lineRecords.some(r=>r.tile===tile))return 0;
  return yield* transferExactPacketLines(previous.lineRecords,tile,part,values,stride);
}
type Part={id:string;sourceId?:string;ring:readonly (readonly number[])[];holes:readonly (readonly (readonly number[])[])[];groundY:number;topY:number};
const navFingerprint=(p:Part)=>JSON.stringify([p.id,p.sourceId,p.ring,p.holes,p.groundY,p.topY]);
export function isCampusCanopyPreviousPartV266(part:Part):boolean{
  return previous.previousNavigationParts.some(p=>p.id===part.id&&navFingerprint(p)===navFingerprint(part));
}
