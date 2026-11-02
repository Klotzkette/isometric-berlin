import {BoxGeometry,BufferAttribute,BufferGeometry,Color,DoubleSide,Group,InstancedBufferAttribute,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,MeshStandardMaterial,ShapeUtils,Vector2,Vector3} from 'three';
import data from './data/courtsParkV293.json';
import {letteringStrokePaths} from './drawnLettering';
import {freezeStaticSceneTransforms} from './staticSceneTransforms';
import {COURTS_PARK_V293_PROFILE as P,ROLLERACHT_V293 as R,ROLLERACHT_V293_APPROACHES} from './courtsParkV293Profile';
type Row=[number,number,number,number,number,number,number,number];
const STONE=0xcdbb97,BRICK=0xa46b52,DARK=0x3a4549,TRIM=0xd8cfb9;
class Plan {
 rows:Row[]=[]; roles:Record<string,number>={};
 constructor(readonly native:boolean){}
 box(x:number,y:number,z:number,w:number,h:number,d:number,yaw:number,c:number,role:string):void{
  this.roles[role]=(this.roles[role]??0)+1;
  if(!this.native||Math.abs(Math.sin(yaw))<1e-7){this.rows.push([x,y,z,w,h,d,0,c]);if(!this.native)this.rows[this.rows.length-1][6]=yaw;return;}
  // Independent cardinal construction along the represented axis; no rotated native members.
  const n=Math.max(1,Math.ceil(w/.45)),m=Math.max(1,Math.ceil(d/.45));for(let i=0;i<n;i++)for(let j=0;j<m;j++){const u=(i+.5)*w/n-w/2,v=(j+.5)*d/m-d/2;this.rows.push([x+Math.cos(yaw)*u+Math.sin(yaw)*v,y,z-Math.sin(yaw)*u+Math.cos(yaw)*v,Math.abs(Math.cos(yaw))*w/n+Math.abs(Math.sin(yaw))*d/m,h,Math.abs(Math.sin(yaw))*w/n+Math.abs(Math.cos(yaw))*d/m,0,c]);}
 }
 stroke(a:number[],b:number[],size:number,c:number,role:string):void{
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz),n=Math.max(1,Math.ceil(length/(this.native?.3:.32)));
  for(let i=0;i<n;i++){const t=(i+.5)/n;this.box(a[0]+dx*t,a[1]+dy*t,a[2]+dz*t,Math.abs(dx)/n+size,Math.abs(dy)/n+size,Math.abs(dz)/n+size,0,c,role);}
 }
}
function batch(plan:Plan):InstancedMesh{
 const g=new BoxGeometry(1,1,1);g.deleteAttribute('uv');const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.9});const mesh=new InstancedMesh(g,day,0),m=new Matrix4(),c=new Color(),v=new Vector3();
 const matrices=new Float32Array(plan.rows.length*16),colours=new Float32Array(plan.rows.length*3);
 plan.rows.forEach((r,i)=>{m.makeRotationY(r[6]);m.scale(v.set(r[3],r[4],r[5]));m.setPosition(r[0],r[1],r[2]);m.toArray(matrices,i*16);c.setHex(r[7]).toArray(colours,i*3);});
 mesh.count=plan.rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colours,3);mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,roles:plan.roles};return mesh;
}
function courtFittings(p:Plan):void{
 for(const site of data.sites){
  for(const r of site.panes){const [x,y,z,w,h,yaw,nx,nz]=r,ux=Math.cos(yaw),uz=-Math.sin(yaw);for(const u of [-w/4,w/4])p.box(x+nx*.17+ux*u,y,z+nz*.17+uz*u,.045,h,.07,yaw,TRIM,`${site.key}:four-leaf-window`);
   for(const yy of [-h/3,h/3])p.box(x+nx*.17,y+yy,z+nz*.17,w,.045,.07,yaw,TRIM,`${site.key}:window-light-subdivision`);
   if(y<8){p.box(x+nx*.12,y-h/2-.15,z+nz*.12,w+.28,.12,.32,yaw,STONE,`${site.key}:projecting-stone-sill`);}
  }
  const l=site.label,normal=l.normal,d=l.direction,c=l.center;
  // Small verified service identity plaques beside the existing public entrance.
  const text=site.key==='charlottenburg'?'INSOLVENZGERICHT':'BRUNNENPLATZ 1';
  const center=[c[0]+d[0]*5+normal[0]*.3,c[1]-3.8,c[2]+d[2]*5+normal[2]*.3];
  p.box(center[0],center[1]+.25,center[2],5.2,.85,.12,Math.atan2(-d[2],d[0]),0xddd6c4,`${site.key}:service-plaque`);
  for(const path of letteringStrokePaths(text,.27))for(let i=1;i<path.length;i++)p.stroke([center[0]+d[0]*path[i-1][0]+normal[0]*(p.native?.3:.08),center[1]+path[i-1][1],center[2]+d[2]*path[i-1][0]+normal[2]*(p.native?.3:.08)],[center[0]+d[0]*path[i][0]+normal[0]*(p.native?.3:.08),center[1]+path[i][1],center[2]+d[2]*path[i][0]+normal[2]*(p.native?.3:.08)],.035,0x45514c,`${site.key}:lettering`);
 }
 for(const r of data.moabitRows){if(r[7]!==0x4c616b)continue;const[x,y,z,w,h,,yaw]=r,nx=Math.sin(yaw),nz=Math.cos(yaw);for(const u of[-w/4,w/4])p.box(x+nx*.1+Math.cos(yaw)*u,y,z+nz*.1-Math.sin(yaw)*u,.05,h,.08,yaw,TRIM,'moabit:stone-window-mullion');p.box(x+nx*.1,y+h*.23,z+nz*.1,w,.06,.08,yaw,TRIM,'moabit:transom');}
 // Actual tower anchors/heights are retained v183 official-source readings. Clock-ring and louvre sizes estimated.
 for(const t of data.moabitTowers.slice(0,2)){for(let i=0;i<12;i++){const a=i*Math.PI/6;p.box(t.center[0]+Math.cos(a)*1.35,t.topY-20+Math.sin(a)*1.35,t.center[1]-4.0,.16,.23,.12,0,DARK,'moabit:tower-clock-marks');}p.box(t.center[0],t.topY-20,t.center[1]-4.1,.08,1.15,.1,0,DARK,'moabit:tower-clock-hand');}
}
function neighbourBases(p:Plan):void{
 for(const n of data.neighbours){const r=n.ring;for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<8||length>65)continue;const yaw=Math.atan2(-dz,dx),ux=dx/length,uz=dz/length;
  // A narrow ground-storey course and two quoin stacks on the exact existing wall. No new roof/window or mass.
  for(const y of[.35,1.05,1.75])p.box((a[0]+b[0])/2,n.ground+y,(a[1]+b[1])/2,length,.07,.18,yaw,0xc5b9a4,`${n.site}:existing-neighbour-stone-course`);
  for(const u of[.45,length-.45])for(let k=0;k<6;k++)p.box(a[0]+ux*u,n.ground+.3+k*.43,a[1]+uz*u,.62,.25,.22,yaw,STONE,`${n.site}:existing-neighbour-quoin`);
 }}
}
function rolleracht(p:Plan):void{
 const yaw=Math.atan2(-R.uz,R.ux),n=[-R.uz,R.ux],top=P.groundY+P.bridgeDeckRise;
 p.box(R.cx,top-P.bridgeSlab/2,R.cz,R.length,P.bridgeSlab,P.bridgeWidth,yaw,0x72716c,'rolleracht:open-span');
 // Concrete tube cheeks and rounded portal ring. The body-clear centre is never filled.
 for(const side of[-1,1])p.box(R.cx+R.ux*side*2.75,P.groundY+1.15,R.cz+R.uz*side*2.75,1.5,2.3,P.bridgeWidth,yaw,0xaaa79c,'rolleracht:tube-cheek');
 for(const face of[-1,1])for(let i=0;i<12;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12;const point=(angle:number)=>[R.cx+R.ux*Math.cos(angle)*1.85+n[0]*face*(P.bridgeWidth/2-.06),P.groundY+.72+Math.sin(angle)*1.65,R.cz+R.uz*Math.cos(angle)*1.85+n[1]*face*(P.bridgeWidth/2-.06)];p.stroke(point(a),point(b),.18,0xb8b5aa,'rolleracht:arched-tube-portal');}

 for(const side of[-1,1]){
  for(const yy of[.25,1.0])p.box(R.cx+n[0]*side*(P.bridgeWidth/2-.08),top+yy,R.cz+n[1]*side*(P.bridgeWidth/2-.08),R.length,.09,.09,yaw,0x72766b,'rolleracht:parapet-rail');
  for(let i=0;i<=8;i++){const u=(i/8-.5)*R.length;p.box(R.cx+R.ux*u+n[0]*side*(P.bridgeWidth/2-.08),top+.5,R.cz+R.uz*u+n[1]*side*(P.bridgeWidth/2-.08),.1,1.05,.1,0,0x72766b,'rolleracht:rail-post');}
 }
 // Two approach ramps are sampled along their exact retained track nodes, never a floating access slab.
 for(const segment of ROLLERACHT_V293_APPROACHES){const dx=segment.b[0]-segment.a[0],dz=segment.b[1]-segment.a[1],steps=Math.max(1,Math.ceil(segment.length/.25));for(let j=0;j<steps;j++){const t=(j+.5)/steps,x=segment.a[0]+dx*t,z=segment.a[1]+dz*t;let rise=P.bridgeDeckRise*(1-(segment.run+segment.length*t)/P.rampRun);if(p.native)rise=Math.ceil(rise/.125)*.125;p.box(x,P.groundY+rise-.08,z,segment.length/steps+.04,.16,P.rampWidth,Math.atan2(-dz,dx),0x777872,'rolleracht:connected-approach');}}
 const q=data.track.geometry.coordinates as number[][];
 // Retain the complete figure eight as a thin exact-course overlay, including its lower crossing.
 for(let i=1;i<q.length;i++){const a=q[i-1],b=q[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);p.box((a[0]+b[0])/2,P.groundY-.035,(a[1]+b[1])/2,l,.07,2.5,Math.atan2(-(b[1]-a[1]),b[0]-a[0]),0x777872,'rolleracht:complete-mapped-lower-course');}
}
function church(p:Plan):void{
 for(const part of data.church){const ring=part.ring;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<3)continue;const yaw=Math.atan2(-dz,dx);
   // Lower shell stays intact; this shallow public exterior skin follows its exact measured edge.
   for(const y of[5.8,8.6,11.4,14.2,17.0])p.box((a[0]+b[0])/2,y,(a[1]+b[1])/2,len,.12,.2,yaw,BRICK,'johannis:retained-wall-brick-course');
   if(len>9&&part.owner==='DEBE01YYK0002JWo')for(let k=0;k<Math.floor(len/4);k++){const t=(k+.5)/Math.floor(len/4),x=a[0]+dx*t,z=a[1]+dz*t;p.box(x,12.4,z,1.3,3.2,.22,yaw,DARK,'johannis:arched-window');for(let j=0;j<8;j++){const aa=j*Math.PI/7,bb=(j+1)*Math.PI/7;p.stroke([x+Math.cos(yaw)*Math.cos(aa)*.76,14+Math.sin(aa)*.76,z-Math.sin(yaw)*Math.cos(aa)*.76],[x+Math.cos(yaw)*Math.cos(bb)*.76,14+Math.sin(bb)*.76,z-Math.sin(yaw)*Math.cos(bb)*.76],.1,TRIM,'johannis:round-arch');}}
  }
 }
 // Full measured source roof tops; native uses an independent surface-only cardinal reading.
 if(p.native)for(const part of data.church){
  const low=part.owner==='DEBE01YYK0002MC8'?14.2:19.2;
  for(const s of part.surfaces)for(const ring of s.rings){
   if(s.kind==='WallSurface'){
    const ymin=Math.max(low,Math.min(...ring.map(v=>v[1]))),ymax=Math.max(...ring.map(v=>v[1]));if(ymax<=ymin)continue;
    let bestA=ring[0],bestB=ring[1],length=0;for(const a of ring)for(const b of ring){const l=Math.hypot(b[0]-a[0],b[2]-a[2]);if(l>length){length=l;bestA=a;bestB=b;}}
    if(length>0)p.box((bestA[0]+bestB[0])/2,(ymin+ymax)/2,(bestA[2]+bestB[2])/2,length,ymax-ymin,.25,Math.atan2(-(bestB[2]-bestA[2]),bestB[0]-bestA[0]),BRICK,'johannis:cardinal-upper-wall');
   } else {
    const flat=ring.map(v=>new Vector2(v[0],v[2]));for(const ti of ShapeUtils.triangulateShape(flat,[])){const [a,b,c]=ti.map(i=>ring[i]),den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-8)continue;
     for(let x=Math.min(a[0],b[0],c[0])+.3;x<Math.max(a[0],b[0],c[0]);x+=.6)for(let z=Math.min(a[2],b[2],c[2])+.3;z<Math.max(a[2],b[2],c[2]);z+=.6){const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;if(u<0||v<0||u+v>1)continue;const y=u*a[1]+v*b[1]+(1-u-v)*c[1];if(y>=low)p.box(x,y-.12,z,.6,.24,.6,0,0x8a6b55,'johannis:independent-cardinal-upper-roof');}
    }
   }
  }
 }
 // Heilandskirche's complete measured/tall v269 body is untouched. Add the restored tower's thin clock/horizontal louvre recognisers.
 const cx=-2139.3,cz=-844.6;for(const side of[-1,1])for(let k=0;k<7;k++)p.box(cx+side*4,38+k*.45,cz,.12,.12,2.2,0,0x51483f,'heiland:bell-louvre');
}
function sourceUpperMesh():Mesh {
 const pos:number[]=[],colors:number[]=[],color=new Color();
 for(const part of data.church)for(const s of part.surfaces)for(const r of s.rings){let ring=r.map(p=>[...p]);const cut=part.owner==='DEBE01YYK0002MC8'?14.2:19.2;
  // Clip only new companion surfaces; no previous source vertex or original surface is edited.
  const q:number[][]=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],ia=a[1]>=cut,ib=b[1]>=cut;if(ia)q.push(a);if(ia!==ib){const t=(cut-a[1])/(b[1]-a[1]);q.push([a[0]+(b[0]-a[0])*t,cut,a[2]+(b[2]-a[2])*t]);}}ring=q;if(ring.length<3)continue;
  const ranges=[0,1,2].map(k=>Math.max(...ring.map(x=>x[k]))-Math.min(...ring.map(x=>x[k])));const drop=ranges.indexOf(Math.min(...ranges)),axes=[0,1,2].filter(k=>k!==drop),flat=ring.map(a=>new Vector2(a[axes[0]],a[axes[1]]));color.setHex(s.kind==='RoofSurface'?0x8a6b55:BRICK);
  for(const t of ShapeUtils.triangulateShape(flat,[]))for(const j of t){pos.push(...ring[j]);colors.push(color.r,color.g,color.b);}
 }
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(pos),3));g.setAttribute('color',new BufferAttribute(new Float32Array(colors),3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.9});const mesh=new Mesh(g,day);mesh.name='St Johannis complete retained measured upper wall and roof companion';mesh.userData={dayMaterial:day,nightMaterial:night,sourceSheetsRetained:true,textureFree:true};return mesh;
}
/** Bounded additive models, equal drawn mobile detail and independent cardinal native construction. */
export function createCourtsParkV293(native=false):Group {
 const root=new Group();root.name=`Courts and Kleiner Tiergarten v293${native?' independent native':''}`;const p=new Plan(native);courtFittings(p);neighbourBases(p);rolleracht(p);church(p);
 const mesh=batch(p);mesh.name='Court stonework, public fronts, church recognition and open Rolleracht bridge';root.add(mesh);if(!native)root.add(sourceUpperMesh());
 root.userData={courtsParkV293:true,requiredBeforeNavigation:true,textureFree:true,sourceGeometryRetained:true,sourceSheetsRetained:true,fullStaticDetailOnTouch:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native,instanceCount:p.rows.length,roles:p.roles,estimateStatus:P.verticalStatus};
 return freezeStaticSceneTransforms(root);
}
