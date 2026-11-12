import { BufferAttribute, BufferGeometry, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { hbfBoxFragmentsV291, hbfPolygonComplementV291, type HbfBoxV291, type HbfOpeningV291 } from "./HbfGeometryOpeningsV291";
import { WATERFRONT_GROUND_OPENINGS_V296 } from "./waterfrontV296Profile";
import { DINING_GROUND_OPENINGS_V296 } from "./parliamentaryDiningV296Profile";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { parliamentClipGeometryV295 } from "./ParliamentRetainedEnvelopeV295";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export type GroundAdmissionV296 = { dining?: boolean; waterfront?: boolean; native?: boolean };
export function fidelityGroundOpeningsV296(admission:GroundAdmissionV296={}):readonly HbfOpeningV291[]{
  return [...(admission.dining?DINING_GROUND_OPENINGS_V296:[]),...(admission.waterfront?WATERFRONT_GROUND_OPENINGS_V296:[])];
}
/** Keep every outside indexed vertex/triangle byte. Only locally intersecting
 * triangles gain interpolated boundary vertices; never expand a city plate. */
export function clipFidelityGroundSurfaceV296(source:BufferGeometry,admission:GroundAdmissionV296={}):BufferGeometry{
  return clipGroundSurfaceThroughOpenings(source, fidelityGroundOpeningsV296(admission));
}

export function clipGroundSurfaceThroughOpenings(source:BufferGeometry,cuts:readonly HbfOpeningV291[]):BufferGeometry{
  if(!cuts.length)return source;
  const pos=source.getAttribute("position"),index=source.getIndex(),count=index?.count??pos.count;
  const names=["position",...Object.keys(source.attributes).filter(n=>n!=="position")],attrs=names.map(n=>source.getAttribute(n)),offsets:number[]=[];
  // Unknown packed formats fail closed rather than changing source values.
  if(attrs.some(a=>(a as BufferAttribute & {isFloat16BufferAttribute?:boolean}).isFloat16BufferAttribute)||source.groups.some(g=>g.start%3!==0||g.count%3!==0)||source.drawRange.start%3!==0||(Number.isFinite(source.drawRange.count)&&source.drawRange.count%3!==0))return source;
  let width=0;for(const a of attrs){offsets.push(width);width+=a.itemSize;}
  const changes=new Map<number,number[][]>();let added=0;
  for(let i=0;i<count;i+=3){
    const ix=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    const x=ix.map(k=>pos.getX(k)),y=ix.map(k=>pos.getY(k)),z=ix.map(k=>pos.getZ(k));
    const local=cuts.filter(c=>Math.max(...x)>=c.bounds.min[0]&&Math.min(...x)<=c.bounds.max[0]&&Math.max(...y)>=c.bounds.min[1]&&Math.min(...y)<=c.bounds.max[1]&&Math.max(...z)>=c.bounds.min[2]&&Math.min(...z)<=c.bounds.max[2]);
    if(!local.length)continue;
    const tri=ix.map(k=>attrs.flatMap(a=>Array.from({length:a.itemSize},(_,j)=>a.getComponent(k,j))));
    const pieces=hbfPolygonComplementV291(tri,local);if(!pieces)continue;
    const vertices:number[][]=[];for(const p of pieces)for(let j=1;j+1<p.length;j++)vertices.push(p[0],p[j],p[j+1]);
    changes.set(i,vertices);added+=vertices.length;
  }
  if(!changes.size)return source;
  type ArrayCtor = new(length:number)=>BufferAttribute["array"];
  const values=attrs.map(a=>{
    const Typed=a.array.constructor as ArrayCtor,output=new BufferAttribute(new Typed((a.count+added)*a.itemSize),a.itemSize,a.normalized);
    if(a instanceof BufferAttribute){output.array.set(a.array);output.setUsage(a.usage);output.gpuType=a.gpuType;output.name=a.name;}
    else for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++)output.setComponent(i,j,a.getComponent(i,j));
    return output;
  });
  const IndexArray=index?.array instanceof Uint32Array||pos.count+added>65535?Uint32Array:index?.array instanceof Uint8Array&&pos.count+added<256?Uint8Array:Uint16Array;
  const indices=new IndexArray(count-changes.size*3+added),boundary=new Map<number,number>();
  const wanted=new Set([0,count,source.drawRange.start,...source.groups.flatMap(g=>[g.start,g.start+g.count])]);
  if(Number.isFinite(source.drawRange.count))wanted.add(source.drawRange.start+source.drawRange.count);
  let vertex=pos.count,cursor=0;
  for(let i=0;i<count;i+=3){
    if(wanted.has(i))boundary.set(i,cursor);const replacement=changes.get(i);
    if(replacement===undefined){for(let j=0;j<3;j++)indices[cursor++]=index?index.getX(i+j):i+j;continue;}
    for(const v of replacement){attrs.forEach((a,k)=>{for(let j=0;j<a.itemSize;j++)values[k].setComponent(vertex,j,v[offsets[k]+j]);});indices[cursor++]=vertex++;}
  }
  boundary.set(count,cursor);
  const at=(i:number)=>boundary.get(Math.min(count,Math.max(0,i)))??cursor;
  const out=new BufferGeometry();attrs.forEach((_,k)=>out.setAttribute(names[k],values[k]));out.setIndex(new BufferAttribute(indices,1));
  for(const g of source.groups)out.addGroup(at(g.start),at(g.start+g.count)-at(g.start),g.materialIndex);
  out.setDrawRange(at(source.drawRange.start),Number.isFinite(source.drawRange.count)?at(source.drawRange.start+source.drawRange.count)-at(source.drawRange.start):Infinity);
  out.userData={...source.userData,fidelityGroundV296:true,changedTriangles:changes.size};out.computeBoundingBox();out.computeBoundingSphere();return out;
}
/** Exact bounded ground complement before first world admission. Unaffected
 * original matrices/paint and all pre-existing children retain their bytes.
 * The replacement is independent cardinal boxes in both terrain families. */
export function restoreFidelityGroundSlabsV296(slabs:InstancedMesh,admission:GroundAdmissionV296={}):void{
  if (clipGroundSlabsThroughOpenings(slabs, fidelityGroundOpeningsV296(admission), admission.native === true,
    "Complete original ground fragments outside admitted public rooms and waterfront routes v296")) slabs.userData.fidelityGroundV296 = true;
}

export function clipGroundSlabsThroughOpenings(
  slabs: InstancedMesh,
  cuts: readonly HbfOpeningV291[],
  native: boolean,
  name: string,
): boolean {
  if(!cuts.length)return false;
  const old=slabs.instanceMatrix.array,oldColors=slabs.instanceColor?.array;
  const changed=new Map<number,HbfBoxV291[]|BufferGeometry>();let total=0;
  for(let i=0;i<slabs.count;i++){
    const at=i*16,x=old[at+12],y=old[at+13],z=old[at+14],hx=old[at]/2,hy=old[at+5]/2,hz=old[at+10]/2;
    const local=cuts.filter(c=>x+hx>c.bounds.min[0]&&x-hx<c.bounds.max[0]&&y+hy>c.bounds.min[1]&&y-hy<c.bounds.max[1]&&z+hz>c.bounds.min[2]&&z-hz<c.bounds.max[2]);
    if(!local.length)continue;
    if(native){
      const box:HbfBoxV291={min:[x-hx,y-hy,z-hz],max:[x+hx,y+hy,z+hz]},pieces=hbfBoxFragmentsV291(box,local);
      if(pieces.length===1&&pieces[0]===box)continue;
      changed.set(i,pieces);total+=pieces.length;
    }else{
      const geometry=slabs.geometry.clone().applyMatrix4(new Matrix4().fromArray(old,i*16)),opened=parliamentClipGeometryV295(geometry,local);
      if(opened===geometry){geometry.dispose();continue;}
      geometry.dispose();const color=oldColors?oldColors.subarray(i*3,i*3+3):[1,1,1],paint=new Float32Array(opened.getAttribute("position").count*3);
      for(let v=0;v<paint.length;v+=3)paint.set(color,v);opened.setAttribute("color",new BufferAttribute(paint,3));opened.deleteAttribute("uv");changed.set(i,opened);
    }
  }
  if(!changed.size)return false;
  const kept=new Float32Array((slabs.count-changed.size)*16),paints=oldColors?new Float32Array((slabs.count-changed.size)*3):null;
  const day=((slabs.userData.dayMaterial??slabs.material) as MeshBasicMaterial).clone(),night=((slabs.userData.nightMaterial??slabs.material) as MeshStandardMaterial).clone();
  let mesh:Mesh;
  if(native){
    const native=new InstancedMesh(slabs.geometry,day,0),matrices=new Float32Array(total*16),colors=new Float32Array(total*3),m=new Matrix4(),white=new Color(0xffffff);let n=0;
    for(const[i,pieces]of changed)for(const b of pieces as HbfBoxV291[]){m.makeScale(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2]);m.setPosition((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);m.toArray(matrices,n*16);if(oldColors)colors.set(oldColors.subarray(i*3,i*3+3),n*3);else white.toArray(colors,n*3);n++;}
    native.instanceMatrix=new InstancedBufferAttribute(matrices,16);native.instanceColor=new InstancedBufferAttribute(colors,3);native.count=n;native.computeBoundingBox();native.computeBoundingSphere();mesh=native;
  }else{
    const pieces=[...changed.values()] as BufferGeometry[],geometry=mergeGeometries(pieces,false)!;pieces.forEach(p=>p.dispose());day.vertexColors=true;night.vertexColors=true;mesh=new Mesh(geometry,day);
  }
  let k=0;for(let i=0;i<slabs.count;i++)if(!changed.has(i)){kept.set(old.subarray(i*16,i*16+16),k*16);if(paints&&oldColors)paints.set(oldColors.subarray(i*3,i*3+3),k*3);k++;}
  slabs.instanceMatrix=new InstancedBufferAttribute(kept,16);if(paints)slabs.instanceColor=new InstancedBufferAttribute(paints,3);slabs.count=k;slabs.boundingBox=null;slabs.boundingSphere=null;
  mesh.name=name;
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,sourceOutsideFragmentsRetained:true,nativeMinecraft:native,affectedRuns:changed.size};
  if(mesh instanceof InstancedMesh?mesh.count>0:mesh.geometry.getAttribute("position").count>0)slabs.add(freezeStaticSceneTransforms(mesh));
  else{day.dispose();night.dispose();if(!(mesh instanceof InstancedMesh))mesh.geometry.dispose();}
  return true;
}
