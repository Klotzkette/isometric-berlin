import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial } from "three";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { surroundingPolygonBounds, surroundingPolygonContains, type SurroundingChunkGeometry, type SurroundingPolygon } from "./SurroundingCityGeometry";
import { kreuzbergPlaetzeIdsV380 } from "./kreuzbergPlaetzeIndexV380";

type Packed = {origin:number[]; n:number; f:number; p:string; c:string; i:string; palette:number[][]};
type Survey = {mesh:Packed; floors:(SurroundingPolygon & {y:number})[]};

function inflate(field:string,length:number) {
  const bytes=gunzipSync(decodeBase64Bytes(field),{out:new Uint8Array(length)});
  if (bytes.length!==length) throw new RangeError("Unvollständiges Kreuzberger Geometriepaket");
  return bytes;
}

function restore(field:string,count:number) {
  const data=inflate(field,count*2),words=new Uint16Array(count);
  let last=0;
  for (let i=0;i<count;i++) {
    last=(last+data[i]+256*data[count+i])&65535;
    words[i]=last;
  }
  return words;
}

function geometry(packet:Packed) {
  const {n,f}=packet;
  if (!Number.isInteger(n)||n<1||n>65535||!Number.isInteger(f)||f<1||f>100000) throw new RangeError("Ungültiger Platzumfang");
  const words=restore(packet.p,n*3), xyz=new Int16Array(n*3);
  for (let i=0;i<n;i++) for (let axis=0;axis<3;axis++) xyz[3*i+axis]=words[n*axis+i];
  const colors=packet.palette.length>256?restore(packet.c,n):inflate(packet.c,n);
  const rgb=new Uint8Array(n*3);
  const palette=packet.palette.map(([r,g,b])=>{
    const color=new Color((r<<16)|(g<<8)|b);
    return [color.r,color.g,color.b].map(c=>Math.round(255*c));
  });
  for (let i=0;i<n;i++) rgb.set(palette[colors[i]],3*i);
  const indices=restore(packet.i,3*f);
  for (const index of indices) if (index>=n) throw new RangeError("Ungültiger Platzindex");
  const g=new BufferGeometry();
  g.setAttribute("position",new BufferAttribute(xyz,3));
  g.setAttribute("color",new BufferAttribute(rgb,3,true));
  g.setIndex(new BufferAttribute(indices,1));
  g.computeBoundingBox();g.computeBoundingSphere();
  return g;
}

export async function attachKreuzbergPlaetzeV380(entry:SurroundingChunkGeometry,id:string,native:boolean,signal:AbortSignal):Promise<void> {
  if (!kreuzbergPlaetzeIdsV380.has(id)||signal.aborted||entry.root.userData.kreuzbergPlaetzeFloorV380) return;
  const site=id.slice("kreuzberg380-".length);
  const file=native?"native":"drawn";
  const [survey,detail]:[Survey,Packed]=await Promise.all([
    import(`./data/kreuzbergPlaetzeV380/${site}_ground.json`).then(m=>m.default),
    import(`./data/kreuzbergPlaetzeV380/${site}_${file}.json`).then(m=>m.default),
  ]);
  if (signal.aborted||entry.root.userData.kreuzbergPlaetzeFloorV380) return;
  const group=new Group();
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night=day.clone();night.color.setHex(0x898f9b);
  for (const [name,packet] of [["Straßenbefahrung",survey.mesh],["Platzfassaden und Stadtbäume",detail]] as const) {
    const mesh=new Mesh(geometry(packet),day);
    mesh.name=name;
    mesh.scale.setScalar(.01);
    mesh.position.fromArray(packet.origin);
    mesh.userData={dayMaterial:day,nightMaterial:night,nativeMinecraft:native,keepInMinecraft:native};
    group.add(mesh);
  }
  group.name=site==="moritz"?"Moritzplatz":"Rio-Reiser-Platz";
  attachWorldSpaceDetail(entry,group);
  const surfaces=survey.floors.map(poly=>({poly,bounds:surroundingPolygonBounds(poly)})).sort((a,b)=>b.poly.y-a.poly.y);
  entry.root.userData.kreuzbergPlaetzeFloorV380=(x:number,z:number)=>{
    for (const {bounds:[x0,z0,x1,z1],poly} of surfaces) {
      if (x>=x0&&x<=x1&&z>=z0&&z<=z1&&surroundingPolygonContains(poly,x,z)) return poly.y;
    }
    return null;
  };
}
