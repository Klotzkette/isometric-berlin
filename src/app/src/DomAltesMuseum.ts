import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, ShapeUtils, SphereGeometry, TorusGeometry, Vector2, Vector3 } from "three";
import { letteringStrokePaths, letteringLayout } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { ALTES_PROFILE as A, DOM_PROFILE as D, GRANITE_BOWL_PROFILE as B, DOM_ALTES_SOURCE as S, DOM_ALTES_GROUP, MINECRAFT_DOM_ALTES_GROUP, DOM_ALTES_ARCHITECTURE_PROFILE, domWorld, domFrontVAt, domBackVAt, altesWorld, museumDisplayY, museumPartContains, altesRoofAt, type MuseumSourcePart } from "./domAltesMuseumProfile";
type P=[number,number,number]; type Kind="box"|"column"|"sphere"|"arch"|"ring";
const STONE=0xb9ad96,LIGHT=0xd6cab1,DARK=0x897d68,GLASS=0x414c4c,COPPER=0x668d78,PALE=0x8bad90,BRONZE=0x416f5c,GOLD=0xe8bd51;
const UP=new Vector3(0,1,0),IDENTITY=new Quaternion();
class Builder {
 readonly batches=new Map<Kind,{matrix:number[];color:number}[]>(); readonly matrix=new Matrix4();
 constructor(readonly minecraft=false,readonly mobile=false){}
 add(kind:Kind,p:P,size:P,color:number,q=IDENTITY):void {
  if(this.minecraft&&kind!=="box"){
   if(kind==="arch"||kind==="ring") {const n=this.mobile?12:20,arc=kind==="arch"?Math.PI:Math.PI*2;for(let i=0;i<=n;i++){const t=i/n*arc,v=new Vector3(Math.cos(t)*size[0]/2,Math.sin(t)*size[1]/2,0).applyQuaternion(q).add(new Vector3(...p));this.add("box",v.toArray() as P,[Math.max(.2,size[0]/n*.8),Math.max(.2,size[1]/n*.8),Math.max(.15,size[2]*.1)],color,q);}}
   else if(kind==="column"){for(let i=0;i<8;i++){const t=i*Math.PI/4,v=new Vector3(Math.cos(t)*size[0]*.33,0,Math.sin(t)*size[2]*.33).applyQuaternion(q).add(new Vector3(...p));this.add("box",v.toArray() as P,[size[0]*.4,size[1],size[2]*.4],color,q);}}
   else for(let j=0;j<5;j++){const y=(j+.5)/5-.5,r=Math.sqrt(Math.max(0,1-4*y*y)),v=new Vector3(0,y*size[1],0).applyQuaternion(q).add(new Vector3(...p));this.add("box",v.toArray() as P,[size[0]*r,size[1]/5,size[2]*r],color,q);}
   return;
  }
  const a=this.batches.get(kind)??[];this.matrix.compose(new Vector3(...p),q,new Vector3(...size));a.push({matrix:this.matrix.toArray(),color});this.batches.set(kind,a);
 }
 box(p:P,size:P,color:number,yaw=0):void{this.add("box",p,size,color,new Quaternion().setFromAxisAngle(UP,yaw));}
 beam(a:P,b:P,t:number,color:number):void{const d=new Vector3(...b).sub(new Vector3(...a)),l=d.length();if(l<.001)return;this.add("box",a.map((v,i)=>(v+b[i])/2)as P,[t,l,t],color,new Quaternion().setFromUnitVectors(UP,d.multiplyScalar(1/l)));}
}
function materials(vertexColors=false){return [new MeshBasicMaterial({color:0xffffff,vertexColors,side:DoubleSide}),new MeshStandardMaterial({color:0xffffff,vertexColors,side:DoubleSide,roughness:.83,flatShading:true}),new MeshBasicMaterial({color:0xa4b4c5,vertexColors,side:DoubleSide})]as const;}
function attach(m:Mesh,p:ReturnType<typeof materials>):void{m.material=p[0];m.userData.dayMaterial=p[0];m.userData.nightMaterial=p[1];m.userData.moonlitMaterial=p[2];m.userData.textureFree=true;}
function finish(b:Builder,root:Group):void{const pair=materials();for(const[k,a]of b.batches){const g=k==="box"?new BoxGeometry(1,1,1):k==="column"?new CylinderGeometry(.46,.5,1,b.mobile?10:16):k==="sphere"?new SphereGeometry(.5,b.mobile?12:20,b.mobile?8:12):new TorusGeometry(.5,.052,5,b.mobile?18:28,k==="arch"?Math.PI:Math.PI*2);g.deleteAttribute("uv");const m=new InstancedMesh(g,pair[0],0),ms=new Float32Array(a.length*16),cs=new Float32Array(a.length*3),c=new Color();a.forEach((v,i)=>{ms.set(v.matrix,i*16);c.setHex(v.color).toArray(cs,i*3);});m.instanceMatrix=new InstancedBufferAttribute(ms,16);m.instanceColor=new InstancedBufferAttribute(cs,3);m.count=a.length;m.name=`${b.minecraft?"Museum island blocks":"Museum island details"} ${k}`;attach(m,pair);m.computeBoundingBox();m.computeBoundingSphere();root.add(m);}}
function sourceMesh(parts:MuseumSourcePart[],name:string,dom:boolean):Mesh {
 const positions:number[]=[],colors:number[]=[],color=new Color();
 for(const p of parts)for(const s of p.surfaces){const rings=s.rings.map(r=>r.map(v=>[v[0],museumDisplayY(p,v[1]),v[2]])),r=rings[0],n=new Vector3();for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];n.x+=(a[1]-b[1])*(a[2]+b[2]);n.y+=(a[2]-b[2])*(a[0]+b[0]);n.z+=(a[0]-b[0])*(a[1]+b[1]);}n.normalize();const axis=Math.abs(n.y)>Math.abs(n.x)?Math.abs(n.y)>Math.abs(n.z)?1:2:Math.abs(n.x)>Math.abs(n.z)?0:2;const pp=rings.map(rr=>rr.map(v=>axis===1?new Vector2(v[0],v[2]):axis===0?new Vector2(v[2],v[1]):new Vector2(v[0],v[1]))),tris=ShapeUtils.triangulateShape(pp[0],pp.slice(1)),flat=rings.flat();color.setHex(s.kind==="RoofSurface"?(dom?BRONZE:0xa6a59b):dom?STONE:LIGHT);if(s.kind!=="RoofSurface")color.multiplyScalar(.88+.12*Math.abs(n.x));for(const tri of tris)for(const i of tri){positions.push(...flat[i]);colors.push(color.r,color.g,color.b);}}
 const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.setAttribute("color",new Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();const pair=materials(true),m=new Mesh(g,pair[0]);m.name=name;attach(m,pair);return m;
}
/** Exterior wall strips and one thin roof course. No invisible volumetric cube fill. */
function sourceBlocks(b:Builder,parts:MuseumSourcePart[],dom:boolean):void{
 const cell=b.mobile?2.4:1.8;
 for(const p of parts){for(const ring of[p.ring,...p.holes])for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(length/cell));for(let j=0;j<n;j++){const x=a[0]+dx*(j+.5)/n,z=a[1]+dz*(j+.5)/n,top=dom?D.bodyTop:altesRoofAt(x,z,p.id)??museumDisplayY(p,p.top_y_m);if(top>p.ground_y_m)b.box([x,(top+p.ground_y_m)/2,z],[length/n+.025,top-p.ground_y_m,.65],dom?STONE:LIGHT,-Math.atan2(dz,dx));}}
 const minX=Math.min(...p.ring.map(a=>a[0])),maxX=Math.max(...p.ring.map(a=>a[0])),minZ=Math.min(...p.ring.map(a=>a[1])),maxZ=Math.max(...p.ring.map(a=>a[1]));for(let x=minX+cell/2;x<maxX;x+=cell)for(let z=minZ+cell/2;z<maxZ;z+=cell)if(museumPartContains(p,x,z)){const top=dom?D.bodyTop:altesRoofAt(x,z,p.id)??museumDisplayY(p,p.top_y_m);b.box([x,top-.17,z],[cell,.34,cell],dom?BRONZE:0xa6a59b);}}
}
function column(b:Builder,p:P,h:number,r:number,yaw=0,ionic=false):void{b.add("column",[p[0],p[1]+h/2,p[2]],[r*2,h,r*2],STONE);for(const[y,w,t]of[[p[1],r*2.5,.3],[p[1]+.45,r*2.2,.25],[p[1]+h,r*2.55,.42]])b.box([p[0],y,p[2]],[w,t,w],LIGHT,yaw);if(ionic)for(const side of[-1,1]){const q=new Quaternion().setFromAxisAngle(UP,yaw),v=new Vector3(side*r*.95,h-.05,.08).applyQuaternion(q);b.add("ring",[p[0]+v.x,p[1]+v.y,p[2]+v.z],[r*.9,r*.9,.75],LIGHT,q);}if(!b.mobile)for(let i=0;i<12;i++){const t=i*Math.PI/6;b.box([p[0]+Math.cos(t)*r*.96,p[1]+h/2,p[2]+Math.sin(t)*r*.96],[.065,h-.65,.065],DARK);}}
function window(b:Builder,at:(u:number,y:number,v:number)=>P,u:number,y:number,v:number,w:number,h:number,yaw:number,arch=true):void{b.box(at(u,y,v),[w,h,.13],GLASS,yaw);for(const side of[-1,1])b.box(at(u+side*(w/2+.18),y,v+.1),[.22,h+.3,.26],LIGHT,yaw);b.box(at(u,y-h/2-.18,v+.2),[w+.7,.35,.46],LIGHT,yaw);if(arch)b.add("arch",at(u,y+h/2,v+.2),[w+.45,w+.45,2.2],LIGHT,new Quaternion().setFromAxisAngle(UP,yaw));else b.box(at(u,y+h/2+.15,v+.2),[w+.65,.3,.4],LIGHT,yaw);if(!b.mobile){b.box(at(u,y,v+.2),[.09,h,.12],LIGHT,yaw);b.box(at(u,y+.3,v+.2),[w,.09,.12],LIGHT,yaw);}}
function dome(b:Builder,root:Group,p:P,r:number,h:number,name:string):void{
 const steps=b.mobile?12:20;
 if(!b.minecraft){const points=Array.from({length:steps+1},(_,i)=>new Vector2(Math.cos(i/steps*Math.PI/2)*r,Math.sin(i/steps*Math.PI/2)*h)),g=new LatheGeometry(points,b.mobile?32:48);g.deleteAttribute("uv");const pair=materials();pair[0].color.setHex(COPPER);pair[1].color.setHex(COPPER);pair[2].color.setHex(0x436d64);const m=new Mesh(g,pair[0]);m.position.set(...p);m.name=name;attach(m,pair);root.add(m);}else{const step=b.mobile?2:1.5;for(let y=step/2;y<h;y+=step){const radius=r*Math.sqrt(Math.max(0,1-(y/h)**2)),n=Math.max(8,Math.ceil(2*Math.PI*radius/step));for(let i=0;i<n;i++){const t=i/n*Math.PI*2;b.box([p[0]+Math.cos(t)*radius,p[1]+y,p[2]+Math.sin(t)*radius],[step,Math.min(step,h-y+step/2),step],i%5?COPPER:PALE);}}}
 const ribs=b.mobile?16:28;for(let i=0;i<ribs;i++){const t=i/ribs*Math.PI*2;let last:P=[p[0]+r*Math.cos(t),p[1],p[2]+r*Math.sin(t)];for(let j=1;j<=steps;j++){const v=j/steps*Math.PI/2,next:P=[p[0]+r*Math.cos(v)*Math.cos(t),p[1]+h*Math.sin(v),p[2]+r*Math.cos(v)*Math.sin(t)];b.beam(last,next,b.minecraft?.26:.16,PALE);last=next;}}
}
function figure(b:Builder,p:P,h:number,color:number,yaw=0,wings=false):void{b.add("sphere",[p[0],p[1]+h*.85,p[2]],[h*.2,h*.24,h*.21],color);b.add("column",[p[0],p[1]+h*.4,p[2]],[h*.29,h*.7,h*.25],color);for(const side of[-1,1]){const v=new Vector3(side*h*.25,h*.44,.02).applyAxisAngle(UP,yaw);b.beam([p[0],p[1]+h*.63,p[2]],[p[0]+v.x,p[1]+v.y,p[2]+v.z],h*.09,color);}if(wings)for(const side of[-1,1])b.add("sphere",[p[0]+Math.cos(yaw)*side*h*.25,p[1]+h*.66,p[2]-Math.sin(yaw)*side*h*.25],[h*.33,h*.5,h*.08],color,new Quaternion().setFromAxisAngle(new Vector3(0,0,1),side*.5));}
function domDetail(b:Builder,root:Group):void{
 const at=domWorld,front=(u:number,y:number,v:number):P=>domWorld(u,y,domFrontVAt(u)+v-33.8),q=new Quaternion().setFromAxisAngle(UP,D.yaw);
 for(const[y,h]of[[7.3,.5],[17.2,.6],[32.8,.55],[35.4,.6]])for(let i=0;i<S.dom.parts[0].ring.length;i++){const a=S.dom.parts[0].ring[i],c=S.dom.parts[0].ring[(i+1)%S.dom.parts[0].ring.length],dx=c[0]-a[0],dz=c[1]-a[1];b.box([(a[0]+c[0])/2,y,(a[1]+c[1])/2],[Math.hypot(dx,dz)+.12,h,.55],LIGHT,-Math.atan2(dz,dx));}
 for(const u of[-42,-35,-28,-21,-14,7.6,14.6,21.6,28.6,35.6])column(b,front(u,8,33.8),24,.68,D.yaw);
 for(const u of[-37.5,-24.5,-15,9,18.5,31.5])window(b,front,u,23.3,33.9,2.3,6.4,D.yaw);
 for(const u of[-31.5,25.2]){b.box(front(u,9.8,34.7),[7.1,8,.25],GLASS,D.yaw);for(const du of[-4.2,4.2])column(b,front(u+du,5.4,35.2),11.6,.7,D.yaw);b.box(front(u,17.4,35.2),[10.2,.55,1.8],LIGHT,D.yaw);b.beam(front(u-5,17.7,35.7),front(u,21.1,35.7),.48,LIGHT);b.beam(front(u,21.1,35.7),front(u+5,17.7,35.7),.48,LIGHT);}
 b.box(front(-3.2,10.7,34.2),[11.2,10.8,.25],0x5e5442,D.yaw);b.add("arch",front(-3.2,19.4,34.6),[18.8,18.8,7],LIGHT,q);b.add("arch",front(-3.2,19.4,34.72),[16.8,16.8,3],DARK,q);b.box(front(-3.2,22.8,34.1),[13.8,6.2,.23],0xb89e6d,D.yaw);
 for(let i=-2;i<=2;i++)figure(b,front(-3.2+i*2.3,20.3,34.1),3.8,i%2?0xd5c09a:0x927c55,D.yaw);
 for(const u of[-13.5,7.1])figure(b,front(u,18.3,35),4,COPPER,D.yaw,true);figure(b,front(-3.2,36,34.1),5.5,COPPER,D.yaw,true);
 const[du,dv]=D.domeLocal;b.add("column",at(du,(D.drumBase+D.drumTop)/2,dv),[D.domeRadius*2,D.drumTop-D.drumBase,D.domeRadius*2],STONE);
 for(let j=0;j<20;j++){const t=j*Math.PI/10,u=du+Math.cos(t)*21.2,v=dv+Math.sin(t)*21.2,p=at(u,0,v),yaw=D.yaw+Math.PI/2-t;column(b,[p[0],D.drumBase+2,p[2]],13,.52,yaw);b.box(at(du+Math.cos(t+.078)*21.5,44.5,dv+Math.sin(t+.078)*21.5),[2.05,8.5,.16],GLASS,yaw);figure(b,at(du+Math.cos(t)*21.5,D.drumTop-.6,dv+Math.sin(t)*21.5),2.7,COPPER,yaw,true);}
 for(const y of[D.drumBase+.6,D.drumTop-.9,D.drumTop])for(let i=0;i<48;i++){const t=i*Math.PI/24;b.box(at(du+Math.cos(t)*21.7,y,dv+Math.sin(t)*21.7),[2.92,.5,.62],LIGHT,D.yaw+Math.PI/2-t);}
 dome(b,root,at(du,D.drumTop,dv),D.domeRadius,D.domeTop-D.drumTop,"Berliner Dom copper main cupola");
 for(let i=0;i<8;i++){const t=i*Math.PI/4+.2,r=19.6,world=at(du+Math.cos(t)*r,65.5,dv+Math.sin(t)*r),n=new Vector3(Math.cos(t)*Math.cos(D.yaw)+Math.sin(t)*Math.sin(D.yaw),.6,-Math.cos(t)*Math.sin(D.yaw)+Math.sin(t)*Math.cos(D.yaw)).normalize(),rotation=new Quaternion().setFromUnitVectors(new Vector3(0,0,1),n);b.add("sphere",world,[1.6,2.1,.15],BRONZE,rotation);b.add("ring",world,[2,2.5,2],PALE,rotation);}
 for(const[u,v]of D.towers.slice(0,2)){const p=at(u,37.5,v+7.5);b.add("sphere",p,[2.25,2.25,.16],LIGHT,q);b.add("ring",p,[2.45,2.45,1.5],DARK,q);b.beam(at(u,37.5,v+7.65),at(u,38.28,v+7.65),.12,DARK);b.beam(at(u,37.5,v+7.65),at(u+.58,37.3,v+7.65),.12,DARK);}

 // Open octagonal lantern, flared gilded ribs, globe and tall faceted Latin cross.
 for(let i=0;i<8;i++){const t=i*Math.PI/4;b.box(at(du+Math.cos(t)*2.65,84,dv+Math.sin(t)*2.65),[.24,5.6,.24],PALE);const profile=[[2.65,86.5],[1.8,88.2],[.9,90.7],[.65,93.27]];for(let j=1;j<profile.length;j++)b.beam(at(du+Math.cos(t)*profile[j-1][0],profile[j-1][1],dv+Math.sin(t)*profile[j-1][0]),at(du+Math.cos(t)*profile[j][0],profile[j][1],dv+Math.sin(t)*profile[j][0]),.24,GOLD);}
 b.add("column",at(du,81.45,dv),[6,.4,6],BRONZE);b.add("column",at(du,86.65,dv),[5.7,.45,5.7],GOLD);b.add("sphere",at(du,94.12,dv),[1.6,1.6,1.6],GOLD);b.box(at(du,97.5,dv),[.56,5.54,.46],GOLD,D.yaw);b.box(at(du,98.72,dv),[3.2,.55,.46],GOLD,D.yaw);
 if(!b.mobile)for(let i=0;i<12;i++)b.add("sphere",at(du,95.15+i*.42,dv+.28),[.46,.4,.16],0xf3d47a,q);
 for(let tower=0;tower<D.towers.length;tower++){const[u,v]=D.towers[tower],scale=D.towerScales[tower],height=(y:number)=>D.bodyTop+(y-D.bodyTop)*scale,drumTop=height(D.towerDrumTop);b.add("column",at(u,height(45.15),v),[14.5*scale,18.7*scale,14.5*scale],STONE);for(let i=0;i<8;i++){const t=i*Math.PI/4,p=at(u+Math.cos(t)*7.15*scale,height(44.2),v+Math.sin(t)*7.15*scale),yaw=D.yaw+Math.PI/2-t;b.box(p,[2.8*scale,8.2*scale,.16],GLASS,yaw);b.add("arch",[p[0],height(48.3),p[2]],[3*scale,3*scale,2],LIGHT,new Quaternion().setFromAxisAngle(UP,yaw));}for(const y of[36.1,39,51.6,54.5])b.add("column",at(u,height(y),v),[15*scale,.5*scale,15*scale],LIGHT);dome(b,root,at(u,drumTop,v),6.8*scale,(D.towerDomeTop-D.towerDrumTop)*scale,"Berliner Dom corner copper cupola");b.box(at(u,height(66.4),v),[.24,1.6*scale,.24],BRONZE);b.add("sphere",at(u,height(67.4),v),[1.15*scale,1.15*scale,1.15*scale],GOLD);}

 // Four-storey Spree front: normal reversed so the windows sit outside the source wall.
 const rear=(u:number,y:number,v:number):P=>at(-u,y,domBackVAt(-u)-.25-(v-38.85));
 for(let i=0;i<13;i++)for(const y of[8,15.7,23.4,30.4])window(b,rear,-32+i*5.2,y,38.85,1.6,3.7,D.yaw+Math.PI,y>20);
}
function horse(b:Builder,p:P,yaw:number,raised:boolean):void{const q=new Quaternion().setFromAxisAngle(UP,yaw),at=(x:number,y:number,z:number):P=>new Vector3(x,y,z).applyQuaternion(q).add(new Vector3(...p)).toArray()as P;b.add("sphere",at(0,1.55,0),[2.5,1.1,.8],BRONZE,q);b.beam(at(.7,1.6,0),at(1.12,2.8,0),.5,BRONZE);b.add("sphere",at(1.3,2.7,0),[.8,.55,.5],BRONZE,q);for(const x of[-.78,.65])for(const z of[-.3,.3])b.beam(at(x,1.35,z),at(x+(x>0&&raised?.7:0),x>0&&raised?1:.2,z),.23,BRONZE);b.beam(at(-1.1,1.8,0),at(-1.65,.7,0),.22,BRONZE);figure(b,at(-.1,1.9,0),1.7,BRONZE,yaw);b.beam(at(.2,3.2,0),at(1.3,4.1,.1),.11,BRONZE);}
function altesDetail(b:Builder):void{
 const at=altesWorld;for(let i=0;i<A.columns;i++)column(b,at(-39.8+i*79.6/(A.columns-1),A.deck+.35,2.6),A.colonnadeTop-A.deck-.35,.7,A.yaw,true);
 for(const[y,h,w]of[[22.8,.6,85],[23.55,.85,85],[24.3,.45,85.4]])b.box(at(0,y,2.5),[w,h,8.7],LIGHT,A.yaw);
 for(let i=0;i<18;i++){const u=-40+i*80/17;if(Math.abs(u)<8)b.box(at(u,13.7,-3.2),[3.4,12,.15],GLASS,A.yaw);else{b.box(at(u,12,-3.2),[3.4,7.8,.15],0xad654c,A.yaw);b.box(at(u,18.1,-3.15),[3.8,3.3,.15],0xe6dbc1,A.yaw);}}
 for(let i=0;i<21;i++)b.box(at(0,5.22+(21-i)*(A.deck-5.22)/21,4.2+i*.26),[24,.16,.32],LIGHT,A.yaw);
 for(let i=0;i<18;i++)figure(b,at(-40+i*80/17,24.7,2.3),2.4,DARK,A.yaw);
 if(!b.mobile&&!b.minecraft){const text="FRIDERICVS GVILELMVS III STVDIO ANTIQVITATIS OMNIGENAE ET ARTIVM LIBERALIVM MVSEVM CONSTITVIT MDCCCXXVIII",base=text.replaceAll("Q","O"),paths=letteringStrokePaths(base,.65),layout=letteringLayout(base,.65);for(let j=0;j<text.length;j++)if(text[j]==="Q"){const x=layout.glyphs[j].leftM-layout.totalWidthM/2;paths.push([[x+.2,.21],[x+.47,-.05]]);}const points=paths.flat(),width=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));for(const line of paths)for(let i=1;i<line.length;i++)b.beam(at(line[i-1][0]/width*80,23.12+line[i-1][1],6.89),at(line[i][0]/width*80,23.12+line[i][1],6.89),.065,0x897340);}


 for(const[x,z,raised]of[[1860.436566,15.845902,true],[1887.187458,-.040784,false]]as const){b.box([x,7.25,z],[3.5,3.7,2.7],STONE,A.yaw);horse(b,[x,9.1,z],A.yaw,raised);}
 for(const p of S.altes.parts){if(p.top_y_m<20)continue;for(let i=0;i<p.ring.length;i++){const a=p.ring[i],c=p.ring[(i+1)%p.ring.length],dx=c[0]-a[0],dz=c[1]-a[1],l=Math.hypot(dx,dz);if(l<8)continue;const n=Math.floor(l/4.8),yaw=-Math.atan2(dz,dx),edge=(u:number,y:number,v:number):P=>[a[0]+dx*u/l+dz*v/l,y,a[1]+dz*u/l-dx*v/l];for(let j=0;j<n;j++){const t=(j+.5)*l/n,pt=edge(t,15,.45);if(S.altes.parts.some(o=>o.id!==p.id&&museumPartContains(o,pt[0],pt[2])))continue;for(const y of[10.2,18.4])window(b,edge,t,y,.42,1.55,3.7,yaw,false);}}}
 b.add("column",[1856.2,32.45,-20.5],[8.5,.5,8.5],0x7b8986);for(let i=0;i<16;i++){const t=i*Math.PI/8;b.beam([1856.2,32.95,-20.5],[1856.2+Math.cos(t)*4.1,32.7,-20.5+Math.sin(t)*4.1],.11,LIGHT);}
}
function bowl(b:Builder,root:Group):void{
 const[x,z]=B.centre,color=0xa98e7d;
 if(b.minecraft)b.add("column",[x,B.ground+.13,z],[B.plinthRadius*2,.26,B.plinthRadius*2],0xb7a591);
 else {const g=new CylinderGeometry(B.plinthRadius,B.plinthRadius,.26,b.mobile?48:64);g.deleteAttribute("uv");const pair=materials();pair[0].color.setHex(0xb7a591);pair[1].color.setHex(0xb7a591);const m=new Mesh(g,pair[0]);m.position.set(x,B.ground+.13,z);m.name="Granitschale circular granite platform";attach(m,pair);root.add(m);}

 for(let i=0;i<3;i++){const t=i*Math.PI*2/3+.4;b.box([x+Math.cos(t)*1.65,5.79,z+Math.sin(t)*1.65],[.86,.86,1.14],color,t);b.box([x+Math.cos(t)*3.8,5.52,z+Math.sin(t)*3.8],[1.65,.38,.72],0xbaaa98,-t+Math.PI/2);}
 const profile=[[0,6.39],[1.3,6.39],[2.1,6.55],[2.78,6.87],[3.34,7.33],[3.45,7.47],[3.45,7.24],[3.05,6.77],[2.48,6.42],[1.6,6.22],[0,6.22]].map(p=>new Vector2(p[0],p[1]));
 if(!b.minecraft){const g=new LatheGeometry(profile,b.mobile?48:80);g.deleteAttribute("uv");const pair=materials();pair[0].color.setHex(color);pair[1].color.setHex(color);const m=new Mesh(g,pair[0]);m.position.set(x,0,z);m.name="Granitschale hollow polished red-granite basin";attach(m,pair);root.add(m);}else{for(let i=0;i<9;i++){const r=(i+.5)/9*3.45,y=6.39+1.08*(r/3.45)**2.45,n=Math.max(8,Math.ceil(2*Math.PI*r/.36));for(let j=0;j<n;j++){const t=j/n*Math.PI*2;b.box([x+Math.cos(t)*r,y-.13,z+Math.sin(t)*r],[.4,.26,.4],(i+j)%7===0?0xb49a83:color);}}}

}
export function createDomAltesMuseum(options:{mobileLike?:boolean;minecraft?:boolean}={}):Group{
 const root=new Group(),b=new Builder(options.minecraft,options.mobileLike);root.name=options.minecraft?MINECRAFT_DOM_ALTES_GROUP:DOM_ALTES_GROUP;root.userData={...DOM_ALTES_ARCHITECTURE_PROFILE,profile:options.mobileLike?"mobile":"full",nativeMinecraft:!!options.minecraft};
 if(options.minecraft){sourceBlocks(b,S.dom.parts,true);sourceBlocks(b,S.altes.parts,false);}else{root.add(sourceMesh(S.dom.parts,"Berliner Dom retained LoD2 footprint",true));root.add(sourceMesh(S.altes.parts,"Altes Museum retained LoD2 wings and courts",false));}
 domDetail(b,root);altesDetail(b);bowl(b,root);finish(b,root);freezeStaticSceneTransforms(root);return root;
}
export function createMinecraftDomAltesMuseum(options:{mobileLike?:boolean}={}):Group{return createDomAltesMuseum({...options,minecraft:true});}
