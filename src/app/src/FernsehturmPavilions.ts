import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { sourceMesh } from "./BebelplatzBuildingShells";
import { bebelplatzPartBounds, bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { FERNSEHTURM_PAVILION_SOURCE as S, FERNSEHTURM_PAVILION_PROFILE as P, FERNSEHTURM_PAVILION_ENCLOSED as ENCLOSED, FERNSEHTURM_PAVILION_ROOFS as ROOFS, FERNSEHTURM_PAVILION_GALLERY as GALLERY, FERNSEHTURM_PAVILION_STAIRS as STAIRS } from "./fernsehturmPavilionProfile";

type Point=[number,number,number];
type Row={matrix:number[];color:number};
const PALE=0xd4d2bf,EDGE=0xebe9d8,FRAME=0x667d7d,GLASS=0x63898d,DARK=0x344c4e;
const UP=new Vector3(0,1,0);
class DetailBuilder {
  rows:Row[]=[];
  add(p:Point,size:Point,color:number,quaternion=new Quaternion()):void {this.rows.push({matrix:new Matrix4().compose(new Vector3(...p),quaternion,new Vector3(...size)).toArray(),color});}
  box(p:Point,size:Point,color:number,yaw=0):void {this.add(p,size,color,new Quaternion().setFromAxisAngle(UP,yaw));}
  beam(a:Point,b:Point,width:number,color:number):void {const d=new Vector3(...b).sub(new Vector3(...a)),length=d.length();if(length<.001)return;this.add(a.map((v,i)=>(v+b[i])/2) as Point,[width,length,width],color,new Quaternion().setFromUnitVectors(UP,d.multiplyScalar(1/length)));}
  finish(native:boolean):Mesh {
    const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
    const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.76});
    const m=new InstancedMesh(geometry,day,0),matrices=new Float32Array(this.rows.length*16),colors=new Float32Array(this.rows.length*3),tint=new Color();
    this.rows.forEach((r,i)=>{matrices.set(r.matrix,i*16);tint.setHex(r.color).toArray(colors,i*3);});m.instanceMatrix=new InstancedBufferAttribute(matrices,16);m.instanceColor=new InstancedBufferAttribute(colors,3);m.count=this.rows.length;
    m.name=native?"Fernsehturm pavilion separate native surfaces":"Fernsehturm pavilion glazing, frames, gallery rails and steps";
    m.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:native,surfaceOnly:true,hiddenSolidInfill:false};m.computeBoundingBox();m.computeBoundingSphere();return m;
  }
}
function displayPart(p:BebelplatzSourcePart):BebelplatzSourcePart {
  // Source bridge has a closed ground hull, though its passage is overhead.
  if(p.id!=="DEBE3DltuFr02ehH")return p;
  return {...p,ground_y_m:11.85,surfaces:p.surfaces.map(s=>s.kind!=="WallSurface"?s:{...s,rings:s.rings.map(r=>r.map(([x,y,z])=>[x,Math.max(y,11.85),z]))})};
}
function bodyFacades(b:DetailBuilder):void {
  for(const original of ENCLOSED){
    const p=displayPart(original);
    for(let i=0;i<p.ring.length;i++){
      const a=p.ring[i],q=p.ring[(i+1)%p.ring.length],dx=q[0]-a[0],dz=q[1]-a[1],l=Math.hypot(dx,dz);if(l<2.5)continue;
      let nx=dz/l,nz=-dx/l;if(bebelplatzPartContains(p,(a[0]+q[0])/2+nx*.2,(a[1]+q[1])/2+nz*.2)){nx=-nx;nz=-nz;}
      const yaw=-Math.atan2(dz,dx),at=(u:number,y:number,out=.12):Point=>[a[0]+dx*u/l+nx*out,y,a[1]+dz*u/l+nz*out];
      const n=Math.max(1,Math.round(l/P.glazingPitchM)),pitch=l/n;
      for(let k=0;k<n;k++){
        const u=(k+.5)*pitch,pt=at(u,0,.25);
        // No glazing or fake doors on an internal joint between source parts.
        if(ENCLOSED.some(other=>other!==original&&bebelplatzPartContains(other,pt[0],pt[2])))continue;
        const roof=bebelplatzPartRoofAt(p,...([at(u,0,-.08)[0],at(u,0,-.08)[2]] as [number,number]))??p.top_y_m;
        const levels=p.id==="DEBE3DltuFr02ehH"?[[12.05,15.45]]:[[5.52,11.75],[12.48,Math.min(16.7,roof-.35)]];
        for(const [low,top]of levels){if(top-low<.8)continue;const high=Math.min(top,roof-.35);if(high<=low)continue;
          b.box(at(u,(low+high)/2),[pitch-.18,high-low,.10],(k+i)%4===0?0x779b9d:GLASS,yaw);
          b.box(at(u-pitch/2+.035,(low+high)/2,.23),[.12,high-low+.12,.14],FRAME,yaw);
          for(const h of[low,high,low+(high-low)*.78])b.box(at(u,h,.25),[pitch,.11,.17],FRAME,yaw);
          if(k%5===0&&low<6){for(const side of[-.28,.28])b.box(at(u+side,7.12,.31),[.045,.7,.05],EDGE,yaw);}
        }
      }
      // Low source-ground offset is closed by a narrow exterior plinth; source data stay unchanged.
      if(p.ground_y_m>5.22&&p.id!=="DEBE3DltuFr02ehH")b.box(at(l/2,(5.2+p.ground_y_m)/2,.02),[l,p.ground_y_m-5.2,.24],0xb6b3a5,yaw);
      for(const h of[12.08,12.31])b.box(at(l/2,h,.32),[l,.15,.42],EDGE,yaw);
    }
  }
}
function gallery(b:DetailBuilder):void {
  // The exact narrow source footprint surrounds the two wings. Its top hull
  // is not drawn as a 13 m solid wall; the first-floor terrace remains open.
  for(let i=0;i<GALLERY.ring.length;i++){
    const a=GALLERY.ring[i],q=GALLERY.ring[(i+1)%GALLERY.ring.length],l=Math.hypot(q[0]-a[0],q[1]-a[1]);if(l<1)continue;
    const midpoint=[(a[0]+q[0])/2,(a[1]+q[1])/2];
    // Retain only exposed gallery edge, not a duplicated inner wall railing.
    if(ENCLOSED.some(p=>bebelplatzPartContains(p,...midpoint as [number,number])))continue;
    const at=(t:number,y:number):Point=>[a[0]+(q[0]-a[0])*t,y,a[1]+(q[1]-a[1])*t];
    for(const h of[P.galleryY+.1,P.galleryY+.58,P.galleryY+1.07])b.beam(at(0,h),at(1,h),h<P.galleryY+.2?.22:.10,EDGE);
    const n=Math.ceil(l/2);for(let j=0;j<=n;j++)b.beam(at(j/n,P.galleryY),at(j/n,P.galleryY+1.1),.075,FRAME);
    for(let j=0;j<n;j++){const t=(j+.5)/n;b.box(at(t,P.galleryY-.42),[.22,.32,.22],0xb66d62);}
  }
}
function stairs(b:DetailBuilder):void {
  for(const s of STAIRS){
    const n=Math.ceil((s.top-s.bottom)/.18),yaw=-Math.atan2(s.b[1]-s.a[1],s.b[0]-s.a[0]);
    const pos=(t:number,side:number,y:number):Point=>{
      const left=[s.a[0]+(s.d[0]-s.a[0])*t,s.a[1]+(s.d[1]-s.a[1])*t],right=[s.b[0]+(s.c[0]-s.b[0])*t,s.b[1]+(s.c[1]-s.b[1])*t];
      return[left[0]+(right[0]-left[0])*side,y,left[1]+(right[1]-left[1])*side];
    };
    for(let i=0;i<n;i++){const t=(i+.5)/n,h=s.top-i*(s.top-s.bottom)/n;b.box(pos(t,.5,h-.11),[s.width,.22,s.length/n+.012],PALE,yaw);
      for(const side of[0,1])b.box(pos(t,side,h+.42),[.22,1.12,s.length/n+.012],EDGE,yaw);}
    for(const side of[.02,.5,.98]){
      b.beam(pos(.02,side,s.top+1),pos(.98,side,s.bottom+1.12),.065,FRAME);
      for(let j=0;j<=8;j++){const t=j/8,h=s.top+(s.bottom-s.top)*t;b.beam(pos(t,side,h+.1),pos(t,side,h+1.06),.055,FRAME);}
    }
  }
}
function roofs(b:DetailBuilder):void {
  for(const part of ROOFS)for(const surface of part.surfaces){if(surface.kind!=="RoofSurface")continue;
    const r=surface.rings[0];for(let i=0;i<r.length;i++){const a=r[i] as Point,q=r[(i+1)%r.length] as Point;b.beam(a,q,.18,EDGE);}
  }
}
function appendNativeRoof(p:BebelplatzSourcePart,b:DetailBuilder,color:number,step=1):void {
  const [minX,minZ,maxX,maxZ]=bebelplatzPartBounds(p);
  for(let x=Math.floor(minX)+.5;x<maxX;x+=step)for(let z=Math.floor(minZ)+.5;z<maxZ;z+=step){const h=bebelplatzPartRoofAt(p,x,z);if(h!==null)b.box([x,h-.14,z],[step,.28,step],color);}
}
function appendNativeBody(p:BebelplatzSourcePart,b:DetailBuilder):void {
  appendNativeRoof(p,b,0xc3c4ba,2);
  for(let i=0;i<p.ring.length;i++){
    const a=p.ring[i],q=p.ring[(i+1)%p.ring.length],dx=q[0]-a[0],dz=q[1]-a[1],length=Math.hypot(dx,dz);if(length<.01)continue;
    let nx=dz/length,nz=-dx/length;
    if(bebelplatzPartContains(p,(a[0]+q[0])/2+nx*.2,(a[1]+q[1])/2+nz*.2)){nx=-nx;nz=-nz;}
    const n=Math.ceil(length/2.25),yaw=-Math.atan2(dz,dx),base=Math.max(5.2,p.ground_y_m);
    for(let j=0;j<n;j++){
      const t=(j+.5)/n,x=a[0]+dx*t-nx*.10,z=a[1]+dz*t-nz*.10;
      const top=bebelplatzPartRoofAt(p,x,z)??p.top_y_m,height=top-base,rows=Math.max(1,Math.ceil(height/3.8));
      for(let k=0;k<rows;k++)b.box([x,base+(k+.5)*height/rows,z],[length/n+.006,height/rows,.18],PALE,yaw);
    }
  }
}
function create(native:boolean):Group {
  const root=new Group();root.name=(native?"Minecraft ":"")+P.name;
  root.userData={textureFree:true,sourceBound:true,sourceParents:S.profiles.map(p=>p.parent_id),sourcePartCount:S.profiles.reduce((n,p)=>n+p.parts.length,0),keepInMinecraft:native,blockNative:native,fullStaticDetailOnTouch:true,hiddenSolidInfill:false,proceduralDimensions:true};
  const b=new DetailBuilder(),body=ENCLOSED.map(displayPart),folded=ROOFS.map(p=>({...p,surfaces:p.surfaces.filter(s=>s.kind==="RoofSurface")}));
  const galleryPart={...GALLERY,ground_y_m:P.galleryY-.28,top_y_m:P.galleryY,surfaces:GALLERY.surfaces.filter(s=>s.kind==="RoofSurface").map(s=>({...s,rings:s.rings.map(r=>r.map(([x,,z])=>[x,P.galleryY,z]))}))};
  if(native){for(const p of body)appendNativeBody(p,b);for(const p of[...folded,GALLERY,galleryPart])appendNativeRoof(p,b,PALE);}
  else root.add(sourceMesh([...body,...folded,{...GALLERY,surfaces:GALLERY.surfaces.filter(s=>s.kind==="RoofSurface")},galleryPart],{wall:PALE,roof:0xdedecb,name:"Fernsehturm measured pavilion shells and folded roofs"}));
  bodyFacades(b);gallery(b);stairs(b);roofs(b);root.add(b.finish(native));
  return freezeStaticSceneTransforms(root);
}
export function createFernsehturmPavilions(_mobileLike=false):Group{return create(false);}
export function createMinecraftFernsehturmPavilions(_mobileLike=false):Group{return create(true);}
