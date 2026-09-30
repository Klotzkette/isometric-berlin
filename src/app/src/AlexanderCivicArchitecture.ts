import {
  BoxGeometry, Color, CylinderGeometry, Group, InstancedBufferAttribute, InstancedMesh,
  LatheGeometry, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector2, Vector3,
} from "three";
import { sourceMesh } from "./BebelplatzBuildingShells";
import { bebelplatzPartBounds, bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { ALEXANDER_CIVIC_SOURCES as S, ALEXANDER_CIVIC_GROUP_NAME, MINECRAFT_ALEXANDER_CIVIC_GROUP_NAME, MARIEN_TOWER_PART_IDS, MARIEN_TOWER as T, RATHAUS_TOWER_ID, RATHAUS_TOWER_PLATFORM, marienSpireRadius } from "./alexanderCivicProfile";

type P=[number,number,number];
type Axis={a:readonly number[];b:readonly number[];side:number};
type Kind="blocks"|"round"|"balls"|"cones"|"spire";
const UP=new Vector3(0,1,0);
const C={brick:0xac5f42,light:0xc07d52,shade:0x89533e,stone:0xb7aa83,pale:0xd3cbbb,glass:0x3b5258,dark:0x293536,roof:0x696a62,copper:0x7dafa0,copperDark:0x527c6f,gold:0xd3ba69,white:0xdcd8be};
const length=(a:Axis)=>Math.hypot(a.b[0]-a.a[0],a.b[1]-a.a[1]);
const yaw=(a:Axis)=>-Math.atan2(a.b[1]-a.a[1],a.b[0]-a.a[0]);
function point(a:Axis,u:number,y:number,out=.2):P {const l=length(a),dx=(a.b[0]-a.a[0])/l,dz=(a.b[1]-a.a[1])/l;return[a.a[0]+dx*u+dz*out*a.side,y,a.a[1]+dz*u-dx*out*a.side];}
class Builder {
  rows=new Map<Kind,{matrix:number[];color:number}[]>();
  constructor(readonly minecraft:boolean){}
  add(kind:Kind,p:P,size:P,color:number,q=new Quaternion()):void {if(this.minecraft)kind="blocks";const rows=this.rows.get(kind)??[];rows.push({matrix:new Matrix4().compose(new Vector3(...p),q,new Vector3(...size)).toArray(),color});this.rows.set(kind,rows);}
  box(p:P,size:P,color:number,angle=0):void {this.add("blocks",p,size,color,new Quaternion().setFromAxisAngle(UP,angle));}
  beam(a:P,b:P,width:number,color:number):void {const d=new Vector3(...b).sub(new Vector3(...a)),l=d.length();if(l<1e-6)return;this.add("round",a.map((v,i)=>(v+b[i])/2) as P,[width,l,width],color,new Quaternion().setFromUnitVectors(UP,d.multiplyScalar(1/l)));}
  facade(a:Axis,u:number,y:number,w:number,h:number,color:number,out=.24,depth=.16):void {this.box(point(a,u,y,out),[w,h,depth],color,yaw(a));}
  finish(root:Group):void {
    const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.86,flatShading:true});
    for(const[kind,rows]of this.rows){const g=kind==="spire"?new LatheGeometry([[1,0],[.8,.15],[.34,.38],[.24,.85],[.08,1]].map(([r,y])=>new Vector2(r,y)),16):kind==="blocks"?new BoxGeometry(1,1,1):kind==="balls"?new SphereGeometry(.5,12,8):new CylinderGeometry(kind==="cones"?0:.5,.5,1,kind==="cones"?8:12);g.deleteAttribute("uv");const mesh=new InstancedMesh(g,day,0),matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3),color=new Color();rows.forEach((r,i)=>{matrices.set(r.matrix,i*16);color.setHex(r.color).toArray(colors,i*3);});mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.count=rows.length;mesh.name=`${root.name} ${kind}`;mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:this.minecraft,surfaceOnly:true};mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);}
  }
}
function outwardAxis(part:BebelplatzSourcePart,a:readonly number[],b:readonly number[]):Axis {const axis={a,b,side:1},p=point(axis,length(axis)/2,0,.12);if(bebelplatzPartContains(part,p[0],p[2]))axis.side=-1;return axis;}
function circle(b:Builder,a:Axis,u:number,y:number,r:number,width:number,color:number,out=.5,steps=20):void {for(let i=0;i<steps;i++){const t=i*Math.PI*2/steps,q=(i+1)*Math.PI*2/steps;b.beam(point(a,u+Math.cos(t)*r,y+Math.sin(t)*r,out),point(a,u+Math.cos(q)*r,y+Math.sin(q)*r,out),width,color);}}
/** A filled round-headed or pointed window, assembled in one reusable primitive batch. */
function arch(b:Builder,a:Axis,u:number,bottom:number,w:number,h:number,pointed=false,color=C.glass,trim=C.light,out=.35):void {
  const rise=pointed?w*.78:w/2,spring=bottom+h-rise,n=b.minecraft?5:10;
  b.facade(a,u,(bottom+spring)/2,w,spring-bottom,color,out);
  for(let i=0;i<n;i++){const t=(i+.5)/n,xx=w*(t-.5),yy=pointed?rise*(1-Math.abs(2*t-1)**1.5):Math.sqrt(Math.max(0,rise**2-xx**2));b.facade(a,u+xx,spring+yy/2,w/n+.008,yy,color,out);}
  const yAt=(x:number)=>spring+(pointed?rise*(1-(Math.abs(x)/(w/2))**1.5):Math.sqrt(Math.max(0,rise**2-x**2)));
  for(let i=0;i<n*2;i++){const x=-w/2+i*w/(n*2),xx=x+w/(n*2);b.beam(point(a,u+x,yAt(x),out+.14),point(a,u+xx,yAt(xx),out+.14),.18,trim);}
  for(const d of[-w/2,w/2])b.facade(a,u+d,(bottom+spring)/2,.18,spring-bottom,trim,out+.14);
  b.facade(a,u,bottom,w+.4,.2,trim,out+.18,.32);
}
function clock(b:Builder,a:Axis,u:number,y:number,r:number,dark=false):void {
  const normal=new Vector3(point(a,u,0,1)[0]-point(a,u,0,0)[0],0,point(a,u,0,1)[2]-point(a,u,0,0)[2]);
  if(b.minecraft){for(let i=0;i<12;i++){const yy=-r+(i+.5)*r/6,w=2*Math.sqrt(Math.max(0,r*r-yy*yy));b.facade(a,u,y+yy,w,r/6,dark?C.dark:C.white,.70,.13);}}else b.add("round",point(a,u,y,.44),[r*2,.15,r*2],dark?C.dark:C.white,new Quaternion().setFromUnitVectors(UP,normal));
  circle(b,a,u,y,r,.18,dark?C.gold:C.pale,.56,32);
  for(let i=0;i<12;i++){const t=i*Math.PI/6;b.beam(point(a,u+Math.sin(t)*r*.76,y+Math.cos(t)*r*.76,.65),point(a,u+Math.sin(t)*r*.91,y+Math.cos(t)*r*.91,.65),.12,dark?C.gold:C.shade);}
  b.beam(point(a,u,y,.75),point(a,u-.4*r,y+.52*r,.75),.16,C.gold);b.beam(point(a,u,y,.76),point(a,u+.62*r,y+.15*r,.76),.11,C.gold);
}
function ornamentBand(b:Builder,a:Axis,y:number):void {
  const l=length(a);b.facade(a,l/2,y+.62,l,.17,C.pale,.37,.3);b.facade(a,l/2,y-.55,l,.15,C.pale,.37,.3);
  const n=Math.max(1,Math.floor(l/1.5));for(let i=0;i<n;i++){const u=(i+.5)*l/n;arch(b,a,u,y-.4,.66,.9,false,C.shade,C.light,.28);if(!b.minecraft)b.facade(a,u,y-.23,.10,.45,C.light,.47);}
}
function rathaus(b:Builder):void {
  const profile=S[0],main=profile.parts.find(p=>p.holes.length===3)!;
  for(const ring of[main.ring,...main.holes])for(let e=0;e<ring.length;e++){
    const a=outwardAxis(main,ring[e],ring[(e+1)%ring.length]),l=length(a);if(l<4.3)continue;
    const exterior=ring===main.ring,n=Math.max(1,Math.round(l/(exterior?4.8:4.4)));
    for(let i=0;i<n;i++){const u=(i+.5)*l/n;
      const outside=point(a,u,0,.65);if(profile.parts.some(p=>p!==main&&bebelplatzPartContains(p,outside[0],outside[2])&&p.top_y_m>20))continue;
      arch(b,a,u,6.15,2.45,3.35,false,C.dark,C.light);
      arch(b,a,u,12.05,2.55,6.8,false,C.glass,C.light);
      b.facade(a,u,14.45,2.35,.36,C.pale,.56);b.facade(a,u,14.85,2.35,.7,C.pale,.43);b.facade(a,u,15.3,2.35,.20,C.pale,.56);
      arch(b,a,u,21.2,2.25,4.5,false,C.glass,C.light);
      for(const y of[13.1,17.2,22.3,24.05])b.facade(a,u,y,2.08,.09,C.pale,.60);
      for(const y of[15.3,23.1])b.facade(a,u,y,.12,y===15.3?6.15:3.3,C.pale,.60);
      if(exterior){circle(b,a,u,24.67,.36,.095,C.pale,.59,10);b.facade(a,u,10.85,l/n-.25,.9,C.light,.38);for(let k=0;k<3;k++)b.facade(a,u+(k-1)*.5,10.9,.18,.48,C.shade,.51);}
    }
    for(const y of[5.5,10.25,19.3,27.6])b.facade(a,l/2,y,l,.22,y===5.5?C.stone:C.pale,.34,.33);
    ornamentBand(b,a,28.6);
    for(let u=.35;u<l;u+=1.25)b.facade(a,u,26.85,.26,.45,C.light,.40,.27);
  }
  const tower=profile.parts.find(p=>p.id===RATHAUS_TOWER_ID)!;
  // The small collinear footprint break at the rear is not an extra tower face.
  const corners=[tower.ring[0],tower.ring[1],tower.ring[2],tower.ring[5]];
  for(let e=0;e<4;e++){
    const a=outwardAxis(tower,corners[e],corners[(e+1)%4]),l=length(a);
    for(const u of[l*.32,l*.68]){arch(b,a,u,33.0,2.7,18.4);b.facade(a,u,41.3,.13,16.6,C.pale,.65);circle(b,a,u,49.8,.55,.16,C.pale,.64,14);}
    for(const y of[32.3,54.8,72.6,76.8])b.facade(a,l/2,y,l+.7,.42,C.light,.30,.48);
    arch(b,a,l/2,58.2,8.9,12,false,C.brick,C.light,.3);clock(b,a,l/2,64.5,2.45);
    for(const u of[.85,l-.85]){arch(b,a,u,58.2,1.22,12.2,false,C.dark,C.light,.67);b.beam(point(a,u-.6,58.2,.8),point(a,u-.6,69.3,.8),.42,C.stone);b.beam(point(a,u+.6,58.2,.8),point(a,u+.6,69.3,.8),.42,C.stone);}
    ornamentBand(b,a,74.0);
    b.facade(a,l/2,76.75,l,1.4,C.light,.08,.28);
    for(let u=.8;u<l;u+=1.65){b.facade(a,u,76.65,1.20,1.35,C.light,.32,.3);circle(b,a,u,76.65,.35,.10,C.shade,.51,12);}
  }
  // Steel terminal and flagpole: 94 m complete height above the source ground.
  const front:Axis={a:[2488.209,92.509],b:[2491.355,90.041],side:1},mid=length(front)/2;
  arch(b,front,mid,5.2,2.9,8.3,false,C.dark,C.light,.50);
  for(const du of[-.8,0,.8])b.facade(front,mid+du,8.5,.14,6.5,C.light,.8);
  for(const du of[0]){arch(b,front,mid+du,16.2,2.5,5.8);arch(b,front,mid+du,23.8,2.5,4.8);}
  b.facade(front,mid,14.0,4.0,.7,C.light,.8,1.1);
  const cx=2495.891,cz=99.061,base=77.6,top=tower.ground_y_m+94;
  for(const sx of[-1,1])for(const sz of[-1,1])b.beam([cx+sx*1.8,base,cz+sz*1.8],[cx,top-3.1,cz],.20,C.dark);
  b.beam([cx,base,cz],[cx,top,cz],.16,C.dark);
  for(const y of[81.2,86.4,90.4]){const r=(top-3.1-y)/(top-3.1-base)*1.8;for(let i=0;i<4;i++){const t=i*Math.PI/2,q=(i+1)*Math.PI/2;b.beam([cx+Math.cos(t)*r,y,cz+Math.sin(t)*r],[cx+Math.cos(q)*r,y,cz+Math.sin(q)*r],.13,C.dark);}}
  const fY=top-1.6;for(const [dy,h,color]of[[-.62,.42,0xa8463b],[0,.80,0xe5dfcb],[.62,.42,0xa8463b]])b.box([cx+1.7,fY+dy,cz],[3.3,h,.04],color);
}
function towerPoint(u:number,y:number,v:number):P {const c=Math.cos(T.yaw),s=Math.sin(T.yaw);return[T.x+c*u+s*v,y,T.z-s*u+c*v];}
function towerAxis(half:number,e:number):Axis {const points=[[-half,-half],[half,-half],[half,half],[-half,half]],a=towerPoint(points[e][0],0,points[e][1]),q=towerPoint(points[(e+1)%4][0],0,points[(e+1)%4][1]);return {a:[a[0],a[2]],b:[q[0],q[2]],side:1};}
function marienTower(b:Builder):void {
  // The closed LoD2 upper mass is replaced by these explicit surfaces and open supports.
  for(const[y,w,h,color]of[[42.45,13.65,.5,C.pale],[43.1,12.4,.65,C.pale],[54.9,11.1,.8,C.copper],[56.0,10.25,.42,C.copperDark]])b.box(towerPoint(0,y,0),[w,h,w],color,T.yaw);
  arch(b,towerAxis(6.5,3),6.5,5.2,4.6,9.1,true,C.dark,C.brick,.65);
  for(let e=0;e<4;e++){
    const stone=towerAxis(6.5,e),copper=towerAxis(5.1,e);
    arch(b,stone,6.5,26.2,3.9,10.6,true,C.dark,C.brick);for(const u of[5.65,7.35])arch(b,stone,u,26.5,1.35,7.8,false,C.dark,C.light,.55);
    arch(b,stone,6.5,17.0,2.35,6.5,true,C.stone,C.pale);for(const u of[5.9,7.1])arch(b,stone,u,17.2,.65,4.5,false,C.dark,C.pale,.51);
    b.facade(copper,5.1,49.1,10.2,11.6,C.copper,0,.12);
    arch(b,copper,5.1,44.2,3.5,6.2,true,C.dark,C.copperDark,.15);
    for(const u of[3.95,5.1,6.25])b.facade(copper,u,46.5,.12,4.6,C.copper,.42);
    for(const u of[.35,9.85]){b.facade(copper,u,48.7,.42,10.9,C.copper,.3,.48);b.facade(copper,u,54,.70,.48,C.gold,.39,.54);}
    clock(b,copper,5.1,52.1,1.50,true);
    for(const y of[43.6,54.6]){b.facade(copper,5.1,y,10.6,.16,C.copperDark,.55,.4);for(let u=.4;u<10;u+=.65)b.facade(copper,u,y+.46,.07,.87,C.dark,.57);b.facade(copper,5.1,y+.90,10.6,.08,C.dark,.57);}
  }
  for(let i=0;i<8;i++){
    const t=i*Math.PI/4,q=(i+1)*Math.PI/4,pt=(angle:number,y:number,r=T.lanternRadius)=>towerPoint(Math.cos(angle)*r,y,Math.sin(angle)*r);
    b.beam(pt(t,T.lanternBase),pt(t,T.lanternSpring),.42,C.copper);
    const a=pt(t,0),d=pt(q,0),axis:Axis={a:[a[0],a[2]],b:[d[0],d[2]],side:1},l=length(axis);
    // Open lancet arch, deliberately no opaque filling across the opening.
    for(const side of[-1,1])for(let j=0;j<6;j++){const v=j/6,w=(j+1)/6;b.beam(point(axis,l/2+side*l/2*(1-v),T.lanternSpring+v*(T.lanternTop-T.lanternSpring),.02),point(axis,l/2+side*l/2*(1-w),T.lanternSpring+w*(T.lanternTop-T.lanternSpring),.02),.23,C.copper);}
    b.beam(pt(t,T.lanternBase+.6),pt(q,T.lanternBase+.6),.09,C.dark);
    b.add("balls",pt(t,T.lanternTop),[.45,.65,.45],C.gold);
  }
  if(b.minecraft){const n=18;for(let i=0;i<n;i++){const y=T.lanternTop+(i+.5)*(T.spireTop-T.lanternTop)/n,r=marienSpireRadius(y),h=(T.spireTop-T.lanternTop)/n;for(let j=0;j<8;j++){const t=(j+.5)*Math.PI/4;b.box(towerPoint(Math.cos(t)*r,y,Math.sin(t)*r),[Math.max(.3,r*.82),h,.30],C.copper,-t+T.yaw);}}}
  else b.add("spire",towerPoint(0,T.lanternTop,0),[4.8,T.spireTop-T.lanternTop,4.8],C.copper,new Quaternion().setFromAxisAngle(UP,T.yaw));
  for(let i=0;i<8;i++){const t=i*Math.PI/4;for(let j=0;j<4;j++){const ys=[T.lanternTop,T.lanternTop+1.9,T.lanternTop+4.8,T.lanternTop+10.68,T.spireTop],a=ys[j],c=ys[j+1];b.beam(towerPoint(Math.cos(t)*marienSpireRadius(a),a,Math.sin(t)*marienSpireRadius(a)),towerPoint(Math.cos(t)*marienSpireRadius(c),c,Math.sin(t)*marienSpireRadius(c)),.085,C.copperDark);}}
  b.add("balls",towerPoint(0,84.2,0),[1.45,1.7,1.45],C.gold);
  b.beam(towerPoint(0,84.8,0),towerPoint(0,T.finialTop,0),.16,C.gold);b.beam(towerPoint(-.8,86.5,0),towerPoint(.8,86.5,0),.13,C.gold);
}
function marien(b:Builder):void {
  const nave=S[1].parts.find(p=>p.id==="DEBE3DuIzpBLW4yn")!;
  for(const ring of[nave.ring])for(let i=0;i<ring.length;i++){
    const a=outwardAxis(nave,ring[i],ring[(i+1)%ring.length]),l=length(a);if(l<4)continue;
    const middle=point(a,l/2,0),top=bebelplatzPartRoofAt(nave,middle[0],middle[2])??20;
    if(middle[0]<2405)continue;
    const lower=top<15,bottom=lower?5.7:8.0,height=lower?3.45:Math.min(13.2,top-bottom-1.4);
    if(height<2)continue;
    const n=Math.max(1,Math.floor(l/5.9));for(let j=0;j<n;j++){const u=(j+.5)*l/n,w=Math.min(lower?1.4:2.75,l/n*.59);arch(b,a,u,bottom,w,height,true,C.glass,C.light);if(!lower){for(const du of[-w/6,w/6])b.facade(a,u+du,bottom+height*.43,.10,height*.82,C.pale,.62);b.facade(a,u,bottom+height*.45,w,.12,C.pale,.62);}}
    for(const y of[5.6,Math.min(21,top-.55)])b.facade(a,l/2,y,l,.18,C.shade,.31,.25);
  }
  // Low projecting brick buttresses keep the mapped church footprint and roof profile.
  for(const[x,z]of[[2413.6,-144.4],[2421.5,-144.8],[2429.5,-145.2],[2437.5,-145.6],[2445.4,-146]]){
    b.box([x,13.1,z],[.78,16.2,1.7],C.light,.05);b.box([x,21.25,z],[.90,.4,1.9],C.shade,.05);
  }
  const south:Axis={a:[2415.4,-113.0],b:[2446.6,-114.8],side:-1};
  for(let i=0;i<8;i++)arch(b,south,(i+.5)*length(south)/8,5.8,1.55,3.4,true,C.dark,C.light);
  // Source-bound roof ribs and four tiny dormers; the original two broad pitched sheets remain.
  for(let i=0;i<4;i++){const x=2414+i*12.0,z=-124.5,roof=bebelplatzPartRoofAt(nave,x,z);if(roof!==null){b.box([x,roof+.4,z],[1.25,1.1,.55],C.shade,.055);b.box([x,roof+.48,z+.30],[.5,.65,.12],C.dark,.055);}}
  marienTower(b);
}
function clipBelow(ring:number[][],top:number):number[][] {const out:number[][]=[];for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length],da=top-a[1],dc=top-c[1];if(da>=0)out.push(a);if((da<0)!==(dc<0))out.push(a.map((v,j)=>v+(c[j]-v)*da/(da-dc)));}return out;}
function marienMasonry():BebelplatzSourcePart {const part=S[1].parts.find(p=>p.id==="DEBE3DdD31Y72ErY")!;return{...part,top_y_m:T.masonryTop,surfaces:part.surfaces.flatMap(s=>{if(s.kind==="RoofSurface")return[];const ring=clipBelow(s.rings[0],T.masonryTop);return ring.length>=3?[{kind:s.kind,rings:[ring]}]:[];}).concat([{kind:"RoofSurface",rings:[part.ring.map(([x,z])=>[x,T.masonryTop,z])]}])};}
function rathausDisplayPart(part:BebelplatzSourcePart):BebelplatzSourcePart {
  if(part.id!==RATHAUS_TOWER_ID)return part;
  const walls=part.surfaces.filter(s=>s.kind==="WallSurface");
  const topAt=(p:number[])=>Math.max(...walls.flatMap(s=>s.rings.flat()).filter(q=>Math.abs(q[0]-p[0])<.002&&Math.abs(q[2]-p[1])<.002).map(q=>q[1]));
  const sides=part.ring.map((a,i)=>{const c=part.ring[(i+1)%part.ring.length];return {kind:"WallSurface",rings:[[[a[0],topAt(a),a[1]],[c[0],topAt(c),c[1]],[c[0],RATHAUS_TOWER_PLATFORM,c[1]],[a[0],RATHAUS_TOWER_PLATFORM,a[1]]]]};});
  return {...part,top_y_m:RATHAUS_TOWER_PLATFORM,surfaces:[...walls,...sides,{kind:"RoofSurface",rings:[part.ring.map(([x,z])=>[x,RATHAUS_TOWER_PLATFORM,z])]}]};
}
function nativeShell(b:Builder):void {
  const parts=S.flatMap(s=>s.parts).filter(p=>!MARIEN_TOWER_PART_IDS.has(p.id)).map(rathausDisplayPart);parts.push(marienMasonry());
  const cell=1.6,grid=new Map<string,{x:number;z:number;top:number;base:number;wall:number;roof:number}>();
  for(const p of parts){const box=bebelplatzPartBounds(p),isRathaus=S[0].parts.some(q=>q.id===p.id),stone=p.id==="DEBE3DdD31Y72ErY";
    for(let ix=Math.floor(box[0]/cell);ix*cell<box[2];ix++)for(let iz=Math.floor(box[1]/cell);iz*cell<box[3];iz++){const x=(ix+.5)*cell,z=(iz+.5)*cell,top=bebelplatzPartRoofAt(p,x,z);if(top===null)continue;const key=`${ix},${iz}`,old=grid.get(key);if(old&&old.top>=top)continue;grid.set(key,{x,z,top,base:Math.max(5.2,p.ground_y_m),wall:stone?C.stone:C.brick,roof:stone?C.stone:isRathaus?C.roof:0xae6543});}
  }
  for(const[key,v]of grid){b.box([v.x,v.top-.22,v.z],[cell,.44,cell],v.roof);const[ix,iz]=key.split(',').map(Number),near=Math.min(...[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>grid.get(`${ix+dx},${iz+dz}`)?.top??v.base)),base=Math.max(v.base,near),h=v.top-.44-base;if(h>0){const n=Math.ceil(h/2.6);for(let i=0;i<n;i++)b.box([v.x,base+(i+.5)*h/n,v.z],[cell,h/n,cell],v.wall);}}
}
function create(minecraft:boolean):Group {
  const root=new Group();root.name=minecraft?MINECRAFT_ALEXANDER_CIVIC_GROUP_NAME:ALEXANDER_CIVIC_GROUP_NAME;root.userData={textureFree:true,keepInMinecraft:minecraft,blockNative:minecraft,fullStaticDetailOnTouch:true,sourcePartIds:S.flatMap(s=>s.parts.map(p=>p.id)),sourceParents:S.map(s=>s.parent_id),photographsBundled:false,surfaceOnly:true,hiddenSolidInfill:false};
  const b=new Builder(minecraft);
  if(minecraft)nativeShell(b);else{
    const rathaus=sourceMesh(S[0].parts.map(rathausDisplayPart),{wall:C.brick,roof:C.roof,name:"Rotes Rathaus complete source courts and roof"});rathaus.userData.sourceGeometryUnchanged=false;rathaus.userData.displayConflictResolution="Coarse pyramid over clock tower retained in source and displayed as flat platform plus explicit open steel terminal";root.add(rathaus);
    root.add(sourceMesh(S[1].parts.filter(p=>!MARIEN_TOWER_PART_IDS.has(p.id)),{wall:C.brick,roof:0xae6543,name:"Marienkirche complete nave roof and chapels"}));
    const stone=sourceMesh([marienMasonry()],{wall:C.stone,roof:C.pale,name:"Marienkirche source stone tower"});stone.userData.sourceGeometryUnchanged=false;stone.userData.displayConflictResolution="Coarse overlapping tower closures replaced above masonry by copper clock stage and open lantern";root.add(stone);
  }
  rathaus(b);marien(b);b.finish(root);return freezeStaticSceneTransforms(root);
}
export function createAlexanderCivicArchitecture(_mobileLike=false):Group {return create(false);}
export function createMinecraftAlexanderCivicArchitecture(_mobileLike=false):Group {return create(true);}
