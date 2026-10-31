import data from "./data/eastStadtbahnV288.json";
import type { SurroundingCityChunk, SurroundingNavigation } from "./SurroundingCityGeometry";
export const EAST_STADTBAHN_V288_KIND = "east-stadtbahn-raised-v288";
export const EAST_STADTBAHN_V288_PROFILE = data;
type Packet = typeof data.packets[keyof typeof data.packets];
const bytes = (s: string) => s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
const encoded = (values: ArrayBufferView) => {
  const b = new Uint8Array(values.buffer, values.byteOffset, values.byteLength); let out = "";
  for (let i=0;i<b.length;i+=8192) out += String.fromCharCode(...b.subarray(i,i+8192));
  return btoa(out);
};
export function eastStadtbahnRailYV288(z: number, native=false): number {
  const f=data.heightFit, t=Math.max(0,Math.min(1,(z-f.alexanderZ)/(f.jannowitzZ-f.alexanderZ)));
  const y=f.alexanderRailY+(f.jannowitzRailY-f.alexanderRailY)*t;
  return native ? Math.max(f.nativeMinimumY,Math.round(y*4)/4) : y;
}
/** Clip at existing packet boundaries; every interior mapped course vertex stays. */
export function clipEastRailSegmentV288(a: number[],b: number[],bounds: number[]): number[][] | null {
  let lo=0,hi=1; const dx=b[0]-a[0],dz=b[1]-a[1];
  for (const [p,q] of [[-dx,a[0]-bounds[0]],[dx,bounds[2]-a[0]],[-dz,a[1]-bounds[1]],[dz,bounds[3]-a[1]]]) {
    if (Math.abs(p)<1e-12) { if(q<0)return null; continue; }
    const r=q/p;if(p<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);if(lo>=hi)return null;
  }
  return [[a[0]+lo*dx,a[1]+lo*dz],[a[0]+hi*dx,a[1]+hi*dz]];
}
/** One bounded packet-owned rail/deck mesh. Original viaduct sheets, occupied
 * arches, road gaps, buildings and navigation objects remain unchanged. */
export function* prepareEastStadtbahnV288(chunk: SurroundingCityChunk,id: string,native=false): Generator<void,SurroundingCityChunk> {
  const key=`${native?"minecraft":"drawn"}:${id}`;
  if(!Object.prototype.hasOwnProperty.call(data.packets,key)||chunk.meshes.some(m=>m.kind===EAST_STADTBAHN_V288_KIND))return chunk;
  const p=data.packets[key as keyof typeof data.packets] as Packet;
  if(chunk.meshes.length>=16||chunk.origin.some((v,i)=>v!==p.origin[i])||!p.records.length)return chunk;
  for(const owner of p.owners)if(!chunk.nav.buildings.some(b=>JSON.stringify(b)===JSON.stringify(owner)))return chunk;
  for(const r of p.records){const m=chunk.meshes[r.mesh];if(!m||m.kind!=="alt-mitte-v169")return chunk;
    let h=2166136261;for(const text of [m.positions,m.colors,m.indices])for(let at=0;at<text.length;at+=65536){for(let i=at;i<Math.min(at+65536,text.length);i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;yield;}
    if(h!==r.fingerprint)return chunk;
  }
  const position:number[]=[],rgb:number[]=[],indices:number[]=[];
  const floors: NonNullable<SurroundingNavigation['spreeBridgesV242']>['floors']=[];
  const linear=(n:number)=>Math.round((n<=10.31475?n/255/12.92:((n/255+.055)/1.055)**2.4)*255);
  const putBox=(x:number,y:number,z:number,w:number,h:number,d:number,dx:number,dz:number,hex:number)=>{
    const base=position.length/3, c=[linear((hex>>16)&255),linear((hex>>8)&255),linear(hex&255)];
    for(const [u,v,t] of [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]){
      const q=[x+dx*u*w/2-dz*t*d/2,y+v*h/2,z+dz*u*w/2+dx*t*d/2];
      for(let k=0;k<3;k++){const n=Math.round((k===1?q[k]-chunk.origin[k]:Math.max(0,Math.min(512,q[k]-chunk.origin[k])))*100);if(n<0||n>65535)throw new Error("East rail packet overflow");position.push(n);rgb.push(c[k]);}
    }
    for(const i of [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,1,2,6,1,6,5,0,4,7,0,7,3])indices.push(base+i);
  };
  const bounds=[chunk.origin[0],chunk.origin[2],chunk.origin[0]+512,chunk.origin[2]+512];
  // The old outer buildings were individually normalized to ground=3 m.
  // Preserve their complete sheets; connect only their existing top perimeter
  // to the coherent station-fit deck. Never fill a mapped street-bridge gap.
  for(const body of data.viaducts)for(let i=0;i<body.ring.length;i++){
    const clipped=clipEastRailSegmentV288(body.ring[i],body.ring[(i+1)%body.ring.length],bounds);if(!clipped)continue;
    const [a,b]=clipped,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.02)continue;
    const tx=dx/len,tz=dz/len,steps=Math.ceil(len/(native?1.4:4));
    for(let j=0;j<steps;j++){
      const t=(j+.5)/steps,x=a[0]+dx*t,z=a[1]+dz*t,low=native?11:body.topY,top=eastStadtbahnRailYV288(z,native)-.18,h=top-low;
      if(h<=.02)continue;const run=len/steps;
      if(native)putBox(x,low+h/2,z,Math.abs(tx)*run+.4,h,Math.abs(tz)*run+.4,1,0,0x9e9684);
      else putBox(x,low+h/2,z,run+.02,h,.4,tx,tz,0xb8ab92);
    }
    yield;
  }
  for(const track of data.tracks)for(let i=1;i<track.points.length;i++){
    const clipped=clipEastRailSegmentV288(track.points[i-1],track.points[i],bounds);if(!clipped)continue;
    const [a,b]=clipped,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.02)continue;
    const tx=dx/len,tz=dz/len,steps=Math.ceil(len/(native?1.4:5));
    for(let j=0;j<steps;j++){
      const t=(j+.5)/steps,x=a[0]+dx*t,z=a[1]+dz*t,y=eastStadtbahnRailYV288(z,native),run=len/steps;
      if(native){
        putBox(x,y-.36,z,Math.abs(tx)*run+Math.abs(tz)*3.05,.35,Math.abs(tz)*run+Math.abs(tx)*3.05,1,0,0xa5a499);
        for(const side of [-1,1])putBox(x-tz*side*.7175,y,z+tx*side*.7175,Math.abs(tx)*run+.14,.14,Math.abs(tz)*run+.14,1,0,0x596264);
      }else{
        putBox(x,y-.36,z,run+.025,.35,3.05,tx,tz,0xaaa89b);
        for(const side of [-1,1])putBox(x-tz*side*.7175,y,z+tx*side*.7175,run+.025,.13,.13,tx,tz,0x596264);
      }
      const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[x+tx*u*run/2-tz*v*1.525-chunk.origin[0],z+tz*u*run/2+tx*v*1.525-chunk.origin[2]]);
      floors.push({ring:corners,holes:[],y:y-.185});
    }
    yield;
  }
  if(!position.length||chunk.meshes.reduce((n,m)=>n+bytes(m.positions)/6,position.length/3)>400000||chunk.meshes.reduce((n,m)=>n+bytes(m.indices)/4,indices.length)>2400000)return chunk;
  const m={kind:EAST_STADTBAHN_V288_KIND,positionType:"u16cm" as const,positions:encoded(new Uint16Array(position)),colors:encoded(new Uint8Array(rgb)),indices:encoded(new Uint32Array(indices))};
  return {...chunk,meshes:[...chunk.meshes,m],nav:{...chunk.nav,spreeBridgesV242:{floors:[...(chunk.nav.spreeBridgesV242?.floors??[]),...floors],solids:chunk.nav.spreeBridgesV242?.solids??[]}}};
}
