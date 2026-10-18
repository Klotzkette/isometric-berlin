import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, Shape, ShapeGeometry, Vector2, Color, Group, InstancedBufferAttribute, Matrix4, Quaternion, Vector3 } from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
import { inWeddingRingV229, weddingMoabitGroundV229, weddingMoabitSourceV229, weddingStairsV229, weddingRoofV229, weddingFootprintContainsV229, WEDDING_ROOF_BOTTOM_Y_V229, WEDDING_ROOF_TOP_Y_V229, weddingPlatformTransitionCellsV229, WEDDING_PLATFORM_Y_V229, weddingRoofsV229, weddingRoofTopV229 } from "./weddingMoabitV229Profile";
type P=number[];
/** Static final-count boxes and rods, spatially culled by named feature. */
class Batch {
 rows:number[][]=[];rods:number[][]=[];
 constructor(readonly native:boolean){}
 box(x:number,y:number,z:number,w:number,h:number,d:number,yaw:number,color:number){
  if(!this.native){this.rows.push([x,y,z,w,h,d,yaw,color]);return;}
  const ux=Math.cos(yaw),uz=-Math.sin(yaw),nx=-uz,nz=ux,along=Math.max(1,Math.ceil(w/.65)),across=Math.max(1,Math.ceil(d/.65));
  for(let i=0;i<along;i++)for(let j=0;j<across;j++){const u=-w/2+(i+.5)*w/along,v=-d/2+(j+.5)*d/across;this.rows.push([x+ux*u+nx*v,y,z+uz*u+nz*v,Math.abs(ux)*w/along+Math.abs(nx)*d/across,h,Math.abs(uz)*w/along+Math.abs(nz)*d/across,color]);}
 }
 line(a:P,b:P,width:number,color:number){
  const length=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);if(length<.0001)return;
  if(!this.native){this.rods.push([...a,...b,width,color]);return;}
  const count=Math.ceil(length/.45);for(let i=0;i<count;i++){const t=(i+.5)/count;this.rows.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,Math.max(width,Math.abs(b[0]-a[0])/count),Math.max(width,Math.abs(b[1]-a[1])/count),Math.max(width,Math.abs(b[2]-a[2])/count),color]);}
 }
 label(text:string,base:P,ux:number,uz:number,height:number,color:number){for(const path of letteringStrokePaths(text,height))for(let i=1;i<path.length;i++){const at=(p:P)=>[base[0]+ux*p[0],base[1]+p[1],base[2]+uz*p[0]];this.line(at(path[i-1]),at(path[i]),.045,color);}}
 finish(root:Group,name:string){
  if(!this.rows.length&&!this.rods.length)return;
  const mesh=justicePalaceV183Boxes(this.rows,this.native);
  if(this.rods.length){const n=this.rows.length,m=new Float32Array((n+this.rods.length)*16),c=new Float32Array((n+this.rods.length)*3);m.set(mesh.instanceMatrix.array);c.set(mesh.instanceColor!.array);const a=new Vector3(),b=new Vector3(),d=new Vector3(),q=new Quaternion(),up=new Vector3(0,1,0),scale=new Vector3(),matrix=new Matrix4(),paint=new Color();this.rods.forEach((r,i)=>{a.fromArray(r);b.fromArray(r,3);d.subVectors(b,a);const length=d.length();q.setFromUnitVectors(up,d.normalize());matrix.compose(a.add(b).multiplyScalar(.5),q,scale.set(r[6],length,r[6]));matrix.toArray(m,(n+i)*16);paint.setHex(r[7]).toArray(c,(n+i)*3);});mesh.instanceMatrix=new InstancedBufferAttribute(m,16);mesh.instanceColor=new InstancedBufferAttribute(c,3);mesh.count=n+this.rods.length;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
  mesh.name=name;mesh.userData.fullStaticDetailOnTouch=true;root.add(mesh);
 }
}
export function createWeddingMoabitV229(native=false):Group {
 const source=weddingMoabitSourceV229(),root=new Group();root.name="Wedding and Moabit source details v229";root.userData={fullStaticDetailOnTouch:true,textureFree:true,nativeMinecraft:native,keepInMinecraft:native,sourceGeometryRetained:true};
 for(const p of source.pitches){
  const b=new Batch(native),[x,z,ux,uz,length,width]=p.frame,at=(u:number,v:number,dy=0):P=>{const px=x+ux*u-uz*v,pz=z+uz*u+ux*v;return[px,weddingMoabitGroundV229(px,pz,native)+.13+dy,pz];};
  const line=(a:P,c:P)=>{const steps=Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/2);for(let i=0;i<steps;i++){const aa=[a[0]+(c[0]-a[0])*i/steps,a[1]+(c[1]-a[1])*i/steps],cc=[a[0]+(c[0]-a[0])*(i+1)/steps,a[1]+(c[1]-a[1])*(i+1)/steps];const pa=at(...aa as [number,number]),pc=at(...cc as [number,number]);if(inWeddingRingV229(p.ring,pa[0],pa[2])&&inWeddingRingV229(p.ring,pc[0],pc[2]))b.line(pa,pc,.085,0xe8e5d5);}};
  const halfL=length/2-1.6,halfW=width/2-1.6;for(const sign of [-1,1]){line([-halfL,sign*halfW],[halfL,sign*halfW]);line([sign*halfL,-halfW],[sign*halfL,halfW]);}line([0,-halfW],[0,halfW]);
  if(p.sport==="soccer"){
   const radius=Math.min(9.15,halfW*.27);for(let i=0;i<48;i++)line([Math.cos(i*Math.PI/24)*radius,Math.sin(i*Math.PI/24)*radius],[Math.cos((i+1)*Math.PI/24)*radius,Math.sin((i+1)*Math.PI/24)*radius]);
   for(const sign of [-1,1]){const goalW=Math.min(7.32,width*.18),boxW=Math.min(40.3,width*.65),depth=Math.min(16.5,length*.16),goal=sign*halfL;line([goal,-boxW/2],[goal-sign*depth,-boxW/2]);line([goal,boxW/2],[goal-sign*depth,boxW/2]);line([goal-sign*depth,-boxW/2],[goal-sign*depth,boxW/2]);
    for(const side of [-1,1])b.line(at(goal,side*goalW/2),at(goal,side*goalW/2,2.44),.095,0xe8e5d5);b.line(at(goal,-goalW/2,2.44),at(goal,goalW/2,2.44),.095,0xe8e5d5);
    // Open goal backs; only sparse net cues, no opaque wall or field carpet.
    for(let i=0;i<=8;i++){const v=-goalW/2+i*goalW/8;b.line(at(goal,v,2.44),at(goal+sign*1.7,v,.12),.018,0xa6aaa0);}b.line(at(goal+sign*1.7,-goalW/2,.12),at(goal+sign*1.7,goalW/2,.12),.04,0xb6b6a8);
   }
  }else{
   for(const sign of [-1,1]){line([sign*halfL*.55,-halfW],[sign*halfL*.55,halfW]);line([-halfL,sign*halfW*.76],[halfL,sign*halfW*.76]);}line([-halfL*.55,0],[halfL*.55,0]);
   b.line(at(0,-halfW,.96),at(0,halfW,.96),.06,0xe5e2d2);for(let v=-halfW;v<=halfW;v+=.8)b.line(at(0,v,.10),at(0,v,.94),.022,0x626f64);
  }
  b.finish(root,`${p.name}: mapped ${p.id} field markings and open goals v229`);
 }
 // Source exterior west glass facade and entrance wing. Roof/body stays owned
 // by the existing complete measured LoD2 model; mullion rhythm is illustrative.
 const pool=new Batch(native);
 for(const index of [1,5,6]){
  const w=source.poolWalls[index],r=w.rings[0];let a=r[0],c=r[1],max=0;for(const aa of r)for(const cc of r){const l=Math.hypot(aa[0]-cc[0],aa[2]-cc[2]);if(l>max){max=l;a=aa;c=cc;}}
  const ux=(c[0]-a[0])/max,uz=(c[2]-a[2])/max,mx=(a[0]+c[0])/2,mz=(a[2]+c[2])/2;let nx=-uz,nz=ux;if(nx*(mx+780.21)+nz*(mz+969.72)<0){nx=-nx;nz=-nz;}
  const ymin=Math.min(...r.map(p=>p[1])),ymax=Math.max(...r.map(p=>p[1])),yaw=-Math.atan2(uz,ux),out=native?.8:.17;
  const at=(u:number,y:number)=>[a[0]+ux*u+nx*out,y,a[2]+uz*u+nz*out];
  const uv=r.map(p=>[(p[0]-a[0])*ux+(p[2]-a[2])*uz,p[1]]);
  if(index===5)for(let u=1.4;u<max-1.3;u+=2.8){const low=ymin+.55,high=Math.min(ymax-.45,low+5.55);if([u-1.33,u+1.33].every(v=>[low,high].every(y=>inWeddingRingV229(uv,v,y)))){const p=at(u,(low+high)/2);pool.box(p[0]-nx*.065,p[1],p[2]-nz*.065,2.65,high-low,.065,yaw,0x64858b);}}
  for(let u=.35;u<max-.35;u+=.48){const low=ymin+.35,high=Math.min(ymax-.3,low+5.9),wave=low+.65+Math.sin(u*.26)*.43;
   if(!inWeddingRingV229(uv,u,(low+high)/2))continue;
   if(index===5&&inWeddingRingV229(uv,u,high)){const p=at(u,(low+high)/2);pool.box(p[0],p[1],p[2],.07,high-low,.12,yaw,0x9fa79c);const q=at(u,wave);pool.box(q[0],q[1],q[2],.16,.7+Math.cos(u*.26)*.25,.16,yaw,0xb88c56);}
  }
  for(const y of [ymin+.4,Math.min(ymax-.3,ymin+6.25)])for(let u=.25;u<max-.25;u+=.5){if(inWeddingRingV229(uv,u,y)){const p=at(u,y);pool.box(p[0],p[1],p[2],.5,.09,.13,yaw,0x9caaa1);}}
  if(index===6){const p=at(3,ymin+2.5);pool.label("STADTBAD",p,ux,uz,.52,0x9c493a);}
 }
 pool.finish(root,"Stadtbad Tiergarten: source-bound wood waves and hall mullions v229");
 const f=new Batch(native),[fx,fz]=source.fountain.center,fy=weddingMoabitGroundV229(fx,fz,native)+.15;
 const circle=(radius:number,y:number,w:number,color:number)=>{for(let i=0;i<64;i++){const t=i*Math.PI/32,tt=(i+1)*Math.PI/32;f.line([fx+Math.cos(t)*radius,y,fz+Math.sin(t)*radius],[fx+Math.cos(tt)*radius,y,fz+Math.sin(tt)*radius],w,color);}};
 circle(source.fountain.radius-.2,fy+.24,.26,0xb7b0a0);circle(3.4,fy+.32,.22,0x8d938c);
 for(let i=0;i<7;i++)circle(1.65-i*.16,fy+.34+i*.23,.26,0x555c50);
 // Six abstract bronze figures: two pairs, singer, seated pianist. Their
 // precise poses are estimated recognition geometry, not a copied art model.
 for(let i=0;i<6;i++){const t=i*Math.PI/3,x=fx+Math.cos(t)*1.25,z=fz+Math.sin(t)*1.25,y=fy+(i===5?.4:1.05),h=i===5?.8:1.45;f.box(x,y+h*.5,z,.24,h,.20,0,0x5c6150);f.box(x,y+h+.16,z,.28,.30,.27,0,0x676957);for(const side of [-1,1])f.line([x,y+h*.68,z],[x+side*.42,y+h*.55+(i%2)*.3,z+Math.sin(t)*.2],.11,0x5c6150);}
 f.box(fx+.8,fy+.75,fz-1.4,.9,.6,.65,0,0x52594d);f.finish(root,"Tanz auf dem Vulkan: mapped basin and six bronze silhouettes v229");
 // Exact mapped canopy replaces only the receipt-matched former solid Core
 // roof prism. A thin overhead surface preserves the open platform/access.
 for(const roof of weddingRoofsV229()){
 const roofRings=roof.rings,top=(x:number,z:number)=>weddingRoofTopV229(roof,x,z);
 if(native){
  const b=new Batch(true),ring=roofRings[0],minX=Math.min(...ring.map(p=>p[0])),maxX=Math.max(...ring.map(p=>p[0])),minZ=Math.min(...ring.map(p=>p[1])),maxZ=Math.max(...ring.map(p=>p[1]));
  for(let z=minZ;z<maxZ;z+=1.5)for(let x=minX;x<maxX;x+=1.5){const w=Math.min(1.5,maxX-x),d=Math.min(1.5,maxZ-z),cx=x+w/2,cz=z+d/2;
   if(weddingFootprintContainsV229(roofRings,cx,cz))b.rows.push([cx,top(cx,cz)-.06,cz,w,.12,d,0x58665e]);
  }b.finish(root,"Wedding source-bound elevated canopy v229");
 }else{
  const shape=new Shape(roofRings[0].map(([x,z])=>new Vector2(x,-z)));shape.holes=roofRings.slice(1).map(r=>new Path(r.map(([x,z])=>new Vector2(x,-z))));
  const plane=new ShapeGeometry(shape),flat=plane.toNonIndexed(),uv=flat.getAttribute("position"),positions:number[]=[];
  for(let i=0;i<uv.count;i++)positions.push(uv.getX(i),top(uv.getX(i),-uv.getY(i)),-uv.getY(i));
  for(let i=0;i<uv.count;i+=3)for(const j of [0,2,1])positions.push(uv.getX(i+j),top(uv.getX(i+j),-uv.getY(i+j))-.12,-uv.getY(i+j));
  for(const ring of roofRings)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];for(const p of [[a[0],top(a[0],a[1])-.12,a[1]],[b[0],top(b[0],b[1])-.12,b[1]],[b[0],top(b[0],b[1]),b[1]],[a[0],top(a[0],a[1])-.12,a[1]],[b[0],top(b[0],b[1]),b[1]],[a[0],top(a[0],a[1]),a[1]]])positions.push(...p);}
  flat.dispose();plane.dispose();const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const day=new MeshBasicMaterial({color:0x58665e,side:DoubleSide}),night=new MeshStandardMaterial({color:0x58665e,side:DoubleSide,roughness:.9}),mesh=new Mesh(geometry,day);mesh.name="Wedding source-bound elevated canopy v229";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true};root.add(mesh);
 }
 }
 const access=new Batch(native);
 if(native)for(const [x,z,x1,z1] of weddingPlatformTransitionCellsV229())access.rows.push([(x+x1)/2,WEDDING_PLATFORM_Y_V229-.15,(z+z1)/2,x1-x,.3,z1-z,0xb5b4a8]);
 for(const s of weddingStairsV229()){
  const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,yaw=-Math.atan2(uz,ux),at=(u:number,v:number,y:number)=>[s.a[0]+ux*u-uz*v,y,s.a[1]+uz*u+ux*v];
  for(let i=0;i<s.steps;i++){const top=s.low+(i+1)*(s.high-s.low)/s.steps,p=at((i+.5)*length/s.steps,0,top-.10);access.box(p[0],p[1],p[2],length/s.steps+.005,.20,s.width,yaw,0xb5b5a9);}
  for(const side of [-1,1]){access.line(at(0,side*(s.width/2+.03),s.low+.92),at(length,side*(s.width/2+.03),s.high+.92),.06,0x717e77);for(let i=0;i<=3;i++){const u=i*length/3,y=s.low+(s.high-s.low)*i/3;access.line(at(u,side*(s.width/2+.03),y),at(u,side*(s.width/2+.03),y+.92),.06,0x717e77);}}
 }
 for(const entry of source.entrances){const[x,z]=entry.point;access.box(x,6.6,z,.12,2.8,.12,0,0x717c73);access.box(x,7.9,z,.7,.7,.14,0,0x3d8154);access.label("S",[x-.2,7.68,z+.09],1,0,.45,0xf0ecdb);}
 access.finish(root,"Wedding: mapped eastern and central access stairs and S portals v229");
 return freezeStaticSceneTransforms(root);
}
