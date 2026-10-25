import {BoxGeometry,BufferAttribute,BufferGeometry,Color,DoubleSide,Group,InstancedBufferAttribute,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,MeshStandardMaterial,Quaternion,ShapeUtils,Vector2,Vector3} from 'three';
import data from './data/technikmuseumV272.json';
import {TECHNIKMUSEUM_V272_PROFILE,technikmuseumContainsV272,technikmuseumRoofV272,technikmuseumRoofHeightV272} from './TechnikmuseumV272Profile';
import {freezeStaticSceneTransforms} from './staticSceneTransforms';
import {letteringStrokePaths} from './drawnLettering';

type Vec=[number,number,number];
type Row={p:Vec;s:Vec;tone:number;yaw:number;glass:boolean;role:string};
type Tri={p:Vec[];tone:number;glass:boolean;role:string};
const BRICK=0x99654e,STONE=0xc8b9a0,GLASS=0x729ca4,FRAME=0xbac7c6,STEEL=0x536d70,ROOF=0x737c78;

/** Complete source-plan architecture plus compact procedural museum exhibits.
 * Unknown small dimensions remain recognition estimates, not a new survey. */
export function technikmuseumGeometryV272(native=false){
 const rows:Row[]=[],triangles:Tri[]=[],roles:Record<string,number>={};
 const raw=(p:Vec,s:Vec,tone:number,role:string,yaw=0,glass=false)=>{if(s.some(v=>v<=0)||![...p,...s,yaw].every(Number.isFinite))throw Error('Invalid museum fitting');rows.push({p,s,tone,yaw,glass,role});roles[role]=(roles[role]??0)+1;};
 const block=(p:Vec,s:Vec,tone:number,role:string,yaw=0,glass=false)=>{
  if(!native||Math.abs(Math.sin(yaw*2))<1e-8){raw(p,native&&Math.abs(Math.sin(yaw))>.5?[s[2],s[1],s[0]]:s,tone,role,native?0:yaw,glass);return;}
  const nx=Math.max(1,Math.ceil(s[0]/.65)),nz=Math.max(1,Math.ceil(s[2]/.65)),c=Math.cos(yaw),a=Math.sin(yaw),w=s[0]/nx,d=s[2]/nz;
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const u=(i+.5)*w-s[0]/2,v=(j+.5)*d-s[2]/2;raw([p[0]+c*u+a*v,p[1],p[2]-a*u+c*v],[Math.abs(c)*w+Math.abs(a)*d,s[1],Math.abs(a)*w+Math.abs(c)*d],tone,role,0,glass);}
 };
 const tri=(a:Vec,b:Vec,c:Vec,tone:number,role:string,glass=false)=>{triangles.push({p:[a,b,c],tone,role,glass});roles[role]=(roles[role]??0)+1;};
 const quad=(a:Vec,b:Vec,c:Vec,d:Vec,tone:number,role:string,glass=false)=>{tri(a,b,c,tone,role,glass);tri(a,c,d,tone,role,glass);};
 const line=(a:Vec,b:Vec,w:number,tone:number,role:string)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz),step=native?.45:.18,n=Math.max(1,Math.ceil(l/step));
  if(Math.abs(dy)<1e-8){block([(a[0]+b[0])/2,a[1],(a[2]+b[2])/2],[l,w,w],tone,role,-Math.atan2(dz,dx));return;}
  for(let i=0;i<n;i++){const t=(i+.5)/n;raw([a[0]+dx*t,a[1]+dy*t,a[2]+dz*t],[Math.max(w,Math.abs(dx)/n),Math.max(w,Math.abs(dy)/n),Math.max(w,Math.abs(dz)/n)],tone,role);}
 };
 const horizontal=(ring:number[][],y:number,tone:number,role:string)=>{
  if(!native){for(const f of ShapeUtils.triangulateShape(ring.map(p=>new Vector2(p[0],p[1])),[]))tri([ring[f[0]][0],y,ring[f[0]][1]],[ring[f[1]][0],y,ring[f[1]][1]],[ring[f[2]][0],y,ring[f[2]][1]],tone,role);}
  else{const cell=.6;for(let x=Math.floor(Math.min(...ring.map(p=>p[0]))/cell)*cell;x<Math.max(...ring.map(p=>p[0]));x+=cell)for(let z=Math.floor(Math.min(...ring.map(p=>p[1]))/cell)*cell;z<Math.max(...ring.map(p=>p[1]));z+=cell)if(technikmuseumContainsV272(ring,x+cell/2,z+cell/2))raw([x+cell/2,y,z+cell/2],[cell,.18,cell],tone,role);}
 };
 // Three exact retained source plans, including every stepped point. The old
 // campus extrusion never raises the distinct historic wing or either shed.
 for(const site of data.sites){
  const ring=site.ring;let area=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];area+=a[0]*b[1]-b[0]*a[1];}const sign=area>0?1:-1;
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.001)continue;
   const dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len,nx=dz*sign,nz=-dx*sign,yaw=-Math.atan2(dz,dx),mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
   const insideFront=!!site.centre&&Math.hypot(mx-site.centre[0],mz-site.centre[1])<29.0;
   const high=site.eaveY,glass=insideFront;
   if(!native)quad([a[0],site.groundY,a[1]],[b[0],site.groundY,b[1]],[b[0],technikmuseumRoofHeightV272(site,b[0],b[1]),b[1]],[a[0],technikmuseumRoofHeightV272(site,a[0],a[1]),a[1]],site.key==='newMuseum'?GLASS:insideFront?0xabc3bf:BRICK,'complete-retained-plan-wall',glass);
   const panel=(u:number,y:number,w:number,h:number,tone:number,role:string,out=.18,d=.10)=>block([a[0]+dx*u+nx*out,y,a[1]+dz*u+nz*out],[w,h,d],tone,role,yaw);
   if(site.key==='newMuseum'){
    if(len<3.5)continue;
    // Four exhibition levels and their exposed steel mullion grid.
    for(const y of [5.45,10.55,15.65,20.75,25.70])panel(len/2,y,len,.19,FRAME,'four-storey-glass-transom',.21,.15);
    const count=Math.max(1,Math.round(len/2.6));for(let j=0;j<=count;j++)panel(j*len/count,15.5,.11,20.2,FRAME,'glass-curtain-mullion',.23,.14);
    if(len>18){line([a[0]+nx*.34,6.1,a[1]+nz*.34],[b[0]+nx*.34,24.9,b[1]+nz*.34],.23,STEEL,'external-diagonal-steel-frame');line([a[0]+nx*.34,24.9,a[1]+nz*.34],[b[0]+nx*.34,6.1,b[1]+nz*.34],.23,STEEL,'external-diagonal-steel-frame');}
   }else{
    if(len<1.7)continue;
    panel(len/2,high-.14,len,.24,STONE,'roundhouse-eave-course',.16,.25);
    for(const u of [.12,len-.12])panel(u,8.15,.28,5.9,BRICK,'roundhouse-door-pier',.20,.35);
    if(insideFront){for(const y of [6.0,8.15,10.25])panel(len/2,y,len,.065,FRAME,'transparent-inner-gallery-transom',.21,.06);if(len>4)panel(len/2,8.15,.08,5.6,FRAME,'transparent-inner-gallery-mullion',.21,.06);}
    else if(len>3.4){const n=Math.max(1,Math.round(len/5));for(let j=0;j<n;j++){panel((j+.5)*len/n,8.5,Math.min(2.6,len/n-.8),2.6,0x465e60,'brick-shed-upper-window');panel((j+.5)*len/n,8.5,.09,2.65,STONE,'brick-shed-window-mullion',.26,.08);}}
   }
  }
  // Native shell uses the identical cardinal source-cell boundary as its roof
  // and walk support. The inner hall fronts are clear glass, not missing walls.
  if(native){const boundary=site.nativeRing;for(let i=0;i<boundary.length;i++){
   const a=boundary[i],b=boundary[(i+1)%boundary.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),n=Math.max(1,Math.round(len/1.2));
   for(let j=0;j<n;j++){const t=(j+.5)/n,x=a[0]+dx*t,z=a[1]+dz*t,cells=[[-.10,0],[.10,0],[0,-.10],[0,.10]].map(([ox,oz])=>technikmuseumRoofV272(site,x+ox,z+oz,true)).filter((y):y is number=>y!==null),high=cells.length?Math.max(...cells):technikmuseumRoofHeightV272(site,x,z,true),glass=!!site.centre&&Math.hypot(x-site.centre[0],z-site.centre[1])<29.0;
    raw([x,(high+site.groundY)/2,z],[Math.abs(dx)/n||.18,high-site.groundY,Math.abs(dz)/n||.18],site.key==='newMuseum'?GLASS:glass?0xabc3bf:BRICK,'native-retained-plan-wall',0,glass);
   }
  }}
  const cell=TECHNIKMUSEUM_V272_PROFILE.nativeCellM;
  if(native){for(let ix=Math.floor(Math.min(...ring.map(p=>p[0]))/cell);ix<=Math.ceil(Math.max(...ring.map(p=>p[0]))/cell);ix++)for(let iz=Math.floor(Math.min(...ring.map(p=>p[1]))/cell);iz<=Math.ceil(Math.max(...ring.map(p=>p[1]))/cell);iz++){const x=(ix+.5)*cell,z=(iz+.5)*cell,y=technikmuseumRoofV272(site,x,z,true);if(y!==null)raw([x,y-.18,z],[cell,.36,cell],ROOF,'native-source-plan-roof');}}
  else if(!site.centre)horizontal(ring,site.roofY,0x899797,'complete-main-museum-roof');
  else{
   // Roof triangles are subdivided so the fan's ridge is visible; no footprint
   // vertex is simplified or replaced with a circular disc.
   const shape=ring.map(p=>new Vector2(p[0],p[1]));
   for(const f of ShapeUtils.triangulateShape(shape,[])){
    const points=f.map(i=>ring[i]),l=Math.max(...points.map((a,i)=>Math.hypot(a[0]-points[(i+1)%3][0],a[1]-points[(i+1)%3][1]))),n=Math.max(1,Math.ceil(l/2.4));
    const at=(i:number,j:number):Vec=>{const u=i/n,v=j/n,x=points[0][0]+(points[1][0]-points[0][0])*u+(points[2][0]-points[0][0])*v,z=points[0][1]+(points[1][1]-points[0][1])*u+(points[2][1]-points[0][1])*v,r=Math.hypot(x-site.centre![0],z-site.centre![1]),inner=site.key==='roundhouse1'?25.4:25.3,outer=site.key==='roundhouse1'?53.8:55,y=site.eaveY+(site.roofY-site.eaveY)*Math.max(0,1-Math.abs((r-(inner+outer)/2)/((outer-inner)/2)));return[x,y,z];};
    for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){tri(at(i,j),at(i+1,j),at(i,j+1),ROOF,'retained-plan-fan-roof');if(i+j<n-1)tri(at(i+1,j),at(i+1,j+1),at(i,j+1),ROOF,'retained-plan-fan-roof');}
   }
  }
 }
 // Historic street entrance and Ladestraße warehouses keep every earlier shell.
 for(const p of data.auxiliaryPrisms){
  const ring=p.ring.map(([x,z])=>[x/10,z/10]),base=p.y0_dm/10,top=base+p.h_dm/10;
  if(['79688332','56247632','02814719'].includes(p.id))continue;
  let area=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];area+=a[0]*b[1]-b[0]*a[1];}const sign=area>0?1:-1;
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<5)continue;const dx=(b[0]-a[0])/l,dz=(b[1]-a[1])/l,nx=dz*sign,nz=-dx*sign,yaw=-Math.atan2(dz,dx),levels=p.id==='on-29177'||p.id==='26491108'?4:1,n=Math.max(1,Math.round(l/(levels>1?3.4:5.5)));
   for(const y of [base+.6,top-.25])block([(a[0]+b[0])/2+nx*.14,y,(a[1]+b[1])/2+nz*.14],[l,.22,.23],STONE,'historic-source-bound-cornice',yaw);
   for(let level=0;level<levels;level++)for(let j=0;j<n;j++){
    const u=(j+.5)*l/n,y=base+2.2+level*5.15,w=Math.min(levels>1?1.7:2.7,l/n-.7),h=levels>1?2.8:3.0;
    block([a[0]+dx*u+nx*.17,y,a[1]+dz*u+nz*.17],[w,h,.10],0x405256,'historic-window-recess',yaw);
    block([a[0]+dx*u+nx*.23,y,a[1]+dz*u+nz*.23],[.08,h,.08],STONE,'historic-window-mullion',yaw);
    block([a[0]+dx*u+nx*.22,y+h/2+.15,a[1]+dz*u+nz*.22],[w+.25,.20,.18],BRICK,'brick-lintel',yaw);
   }
  }
 }
 // Each mapped turntable follows its complete original ring, with two railheads
 // and a central deck. Existing source track/ground remains untouched.
 for(const table of data.turntables){
  const ring=table.ring,[cx,cz]=table.centre;horizontal(ring,5.24,0x666b60,'mapped-turntable-pit');
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];line([a[0],5.34,a[1]],[b[0],5.34,b[1]],.18,0x929d94,'turntable-ring-rail');}
  const r=Math.min(...ring.map(p=>Math.hypot(p[0]-cx,p[1]-cz)))-.2,angle=.25;block([cx,5.48,cz],[r*2,.28,2.5],0x6c7162,'turntable-bridge-deck',angle);
  const d=[Math.cos(angle),-Math.sin(angle)],n=[-d[1],d[0]];for(const v of [-.7175,.7175])line([cx-d[0]*r+n[0]*v,5.69,cz-d[1]*r+n[1]*v],[cx+d[0]*r+n[0]*v,5.69,cz+d[1]*r+n[1]*v],.10,0xb7bbb1,'turntable-1435mm-rail');
 }
 for(const track of data.tracks){const points=track.geometry.coordinates;for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.1)continue;const dx=(b[0]-a[0])/l,dz=(b[1]-a[1])/l;for(const s of [-.7175,.7175])line([a[0]-dz*s,5.29,a[1]+dx*s],[b[0]-dz*s,5.29,b[1]+dx*s],.075,0x899188,'mapped-yard-1435mm-railhead');}}
 // Anonymous illustrative locomotives sit on six actual retained exhibit tracks.
 const locoIds=['way/40985994','way/40985997','way/40985992','way/39093470','way/39093627','way/39093628'];
 for(let li=0;li<locoIds.length;li++){
  const track=data.tracks.find(t=>t.id===locoIds[li]);if(!track)throw Error('Museum railway anchor missing');
  const [a,b]=track.geometry.coordinates,l=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/l,dz=(b[1]-a[1])/l,yaw=-Math.atan2(dz,dx),at=(u:number,y:number,v:number):Vec=>[a[0]+dx*(u+8.1)-dz*v,y,a[1]+dz*(u+8.1)+dx*v];
  const box=(u:number,y:number,v:number,w:number,h:number,d:number,tone:number,role:string)=>block(at(u,y,v),[w,h,d],tone,role,yaw);
  box(0,6.15,0,10.5,.45,2.5,0x343b39,'locomotive-frame');box(-2.4,7.75,0,5.3,2.15,1.9,li===4?0x46534b:0x282d2c,'locomotive-boiler');box(2.6,8.15,0,2.6,2.8,2.6,li===1?0x576247:0x303632,'locomotive-cab');box(2.6,9.68,0,3,.20,2.9,0x242928,'locomotive-cab-roof');box(2.8,8.55,0,1.4,1.05,2.68,0x869a95,'locomotive-cab-glass');box(-3.9,9.35,0,.65,1.0,.65,0x303635,'locomotive-chimney');box(-1,9.05,0,.8,.65,.8,0x353a37,'locomotive-steam-dome');
  for(const u of [-3.4,-1.8,-.2,2.5])for(const side of [-1,1]){
   const radius=u>2?.52:.76;for(let i=0;i<(native?12:20);i++){const angle=i*Math.PI*2/(native?12:20);box(u+Math.cos(angle)*radius,6.20+Math.sin(angle)*radius,side*1.15,.20,.20,.18,0x983c32,'locomotive-red-driving-wheel');}
   box(u,6.20,side*1.15,.24,.24,.24,0xbcae94,'locomotive-wheel-hub');
  }
  for(const side of [-1,1]){line(at(-4.1,6.10,side*1.29),at(.4,6.10,side*1.29),.10,0xc1bba7,'locomotive-coupling-rod');box(-5.25,6.32,side*.85,.23,.33,.40,0xa44e3d,'locomotive-front-buffer');}
  box(5.6,7.05,0,2.5,1.7,2.4,0x353a34,'locomotive-short-tender');
 }
 // Source aircraft plan fixes the 29m span and north-facing 20m silhouette.
 const aircraftRing=data.aircraft.geometry.coordinates[0][0].slice(0,-1),airY=30.4;
 horizontal(aircraftRing,airY,0xcbd1cc,'osm-c47-complete-wing-plan');
 if(!native){horizontal(aircraftRing,airY-.18,0xaeb8b4,'c47-wing-underside');for(let i=0;i<aircraftRing.length;i++){const a=aircraftRing[i],b=aircraftRing[(i+1)%aircraftRing.length];quad([a[0],airY-.18,a[1]],[b[0],airY-.18,b[1]],[b[0],airY,b[1]],[a[0],airY,a[1]],0xa6b0ac,'c47-wing-edge');}}
 for(let i=0;i<21;i++){
  const z=2204.5+i*.90,t=(z-2204.5)/18.9,r=1.15*Math.sin(Math.PI*Math.min(.98,Math.max(.03,t)))**.38;
  block([405.3,airY+.62,z],[r*2,1.45,.95],0xc9d0cb,'c47-rounded-fuselage');
 }
 block([405.35,airY+1.4,2206.7],[1.65,.62,1.8],0x354d57,'c47-cockpit');
 for(const x of [401.4,408.8]){
  block([x,airY+.2,2209.3],[1.55,1.7,3.3],0xa6b0ac,'c47-twin-radial-engine');
  for(const angle of [0,Math.PI*2/3,Math.PI*4/3])line([x,airY+.2,2207.55],[x+Math.cos(angle)*1.65,airY+.2+Math.sin(angle)*1.65,2207.55],.16,0x3c494b,'c47-three-blade-propeller');
  line([x,airY-.55,2210],[x,airY-2.9,2211],.18,0x687878,'c47-landing-gear');block([x,airY-2.95,2211],[.55,.8,.8],0x303837,'c47-wheel');
 }
 block([405.3,airY+1.75,2221.5],[.25,3.3,3.3],0xaebdb8,'c47-tail-fin');
 for(const side of [-1,1])for(let j=0;j<6;j++)block([405.3+side*1.03,airY+.75,2210.7+j*1.65],[.10,.43,.52],0x4c6269,'c47-cabin-window');
 for(const x of [391.1,419.2])line([405.3,24.8,2226.1],[x,airY-.12,2212.2],.12,0x7c9391,'c47-suspension-stay');
 // The upright rotor has the operator's44m length at its mapped base, a tapered
 // asymmetric airfoil and a slight bend; section widths are explicit estimates.
 const blade=data.rotor.geometry.coordinates[0][0],cx=blade.slice(0,-1).reduce((a,p)=>a+p[0],0)/(blade.length-1),cz=blade.slice(0,-1).reduce((a,p)=>a+p[1],0)/(blade.length-1),base=5.2;
 block([cx,base+.2,cz],[3.1,.4,3.1],0xaaa997,'rotor-footing');
 const profile=[[0,1.10,.70,0],[4,1.55,.50,.15],[10,1.75,.35,.50],[22,1.17,.20,1.05],[34,.55,.12,1.55],[44,.04,.03,1.9]];
 const bladeScale=44/profile.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-profile[i][0],p[3]-profile[i][3]),0);for(const p of profile){p[0]*=bladeScale;p[3]*=bladeScale;}
 if(!native){for(let j=1;j<profile.length;j++)for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6,[h0,w0,d0,s0]=profile[j-1],[h1,w1,d1,s1]=profile[j];const at=(h:number,w:number,d:number,s:number,t:number):Vec=>[cx+s+w*Math.cos(t),base+h,cz+d*Math.sin(t)];quad(at(h0,w0,d0,s0,a),at(h0,w0,d0,s0,b),at(h1,w1,d1,s1,b),at(h1,w1,d1,s1,a),i<6?0xf1f0dc:0xcbd3c7,'44m-tapered-rotor-blade');}}
 else for(let j=1;j<profile.length;j++){const a=profile[j-1],b=profile[j],n=Math.ceil((b[0]-a[0])/.6);for(let i=0;i<n;i++){const t=(i+.5)/n,h=a[0]+(b[0]-a[0])*t,w=a[1]+(b[1]-a[1])*t,d=a[2]+(b[2]-a[2])*t,s=a[3]+(b[3]-a[3])*t;raw([cx+s,base+h,cz],[Math.max(.10,w*2),(b[0]-a[0])/n,Math.max(.08,d*2)],0xe8e9d9,'native-44m-rotor-blade');}}
 // A real mapped water tower, the two distinct historic mills and their rotors.
 for(const [id,height,radius] of [['79688332',18.5,5.0],['56247632',13.7,5.6],['02814719',11.6,3.4]] as [string,number,number][]){
  const p=data.auxiliaryPrisms.find(p=>p.id===id)!;const xs=p.ring.map(v=>v[0]/10),zs=p.ring.map(v=>v[1]/10),x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2,oldTop=(p.y0_dm+p.h_dm)/10;
  if(id==='79688332'){block([x,5.2+height-2,z],[radius*1.8,4,radius*1.8],0x6f7868,'water-tower-tank');block([x,5.2+height+.1,z],[radius*1.95,.25,radius*1.95],0x70776d,'water-tower-crown');}
  else{const hub=5.2+height;block([x,Math.max(oldTop,hub-.3),z],[1.1,.7,1.1],0x5b6350,'historic-windmill-cap');for(const angle of [Math.PI/5,Math.PI/5+Math.PI/2,Math.PI/5+Math.PI,Math.PI/5+Math.PI*1.5]){const length=id==='56247632'?8.3:6.4;line([x,hub,z-radius],[x+Math.cos(angle)*length,hub+Math.sin(angle)*length,z-radius],.20,0xb5ad91,'historic-mill-sail-spar');for(let i=1;i<=8;i++){const u=i*length/9,v=.65;line([x+Math.cos(angle)*u-Math.sin(angle)*v,hub+Math.sin(angle)*u+Math.cos(angle)*v,z-radius],[x+Math.cos(angle)*u+Math.sin(angle)*v,hub+Math.sin(angle)*u-Math.cos(angle)*v,z-radius],.08,0xb5ad91,'historic-mill-open-sail-grid');}}}
 }
 const paths=letteringStrokePaths('DEUTSCHES TECHNIKMUSEUM',.65),pts=paths.flat(),mid=(Math.min(...pts.map(p=>p[0]))+Math.max(...pts.map(p=>p[0])))/2;
 for(const path of paths)for(let i=1;i<path.length;i++){const at=(p:number[]):Vec=>[404.5+(p[0]-mid)*.86,25.1+p[1],2206.4+(p[0]-mid)*.5];line(at(path[i-1]),at(path[i]),.055,0xe9e6ca,'museum-geometric-lettering');}
 return{rows,triangles,roles};
}

export function createTechnikmuseumV272(native=false,options:{mobileLike?:boolean;diagnostics?:boolean}={}):Group{
 const root=new Group();root.name='Deutsches Technikmuseum C47 rotor and railway works v272';
 const model=technikmuseumGeometryV272(native),color=new Color();
 for(const glass of [false,true]){
  const rows=model.rows.filter(r=>r.glass===glass),tris=model.triangles.filter(t=>t.glass===glass);
  if(rows.length){
   const boxGeometry=new BoxGeometry(1,1,1);boxGeometry.deleteAttribute('uv');
   const day=new MeshBasicMaterial({color:0xffffff,transparent:glass,opacity:glass?.16:1,depthWrite:!glass}),night=new MeshStandardMaterial({color:0xffffff,roughness:.82,transparent:glass,opacity:glass?.16:1,depthWrite:!glass}),mesh=new InstancedMesh(boxGeometry,day,0),matrices=new Float32Array(rows.length*16),colours=new Float32Array(rows.length*3),matrix=new Matrix4(),q=new Quaternion(),up=new Vector3(0,1,0),p=new Vector3(),s=new Vector3();
   rows.forEach((r,i)=>{matrix.compose(p.set(...r.p),q.setFromAxisAngle(up,r.yaw),s.set(...r.s));matrix.toArray(matrices,i*16);color.setHex(r.tone).toArray(colours,i*3);});
   mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colours,3);mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};root.add(mesh);
  }
  if(tris.length){const positions=new Float32Array(tris.length*9),colors=new Float32Array(positions.length);let offset=0;for(const t of tris){color.setHex(t.tone);for(const p of t.p){positions.set(p,offset);color.toArray(colors,offset);offset+=3;}}const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setAttribute('color',new BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide,transparent:glass,opacity:glass?.16:1,depthWrite:!glass}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.82,transparent:glass,opacity:glass?.16:1,depthWrite:!glass}),mesh=new Mesh(geometry,day);mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};root.add(mesh);}
 }
 root.userData={...TECHNIKMUSEUM_V272_PROFILE,instances:model.rows.length,triangles:model.triangles.length,roles:model.roles,sourcePlansRetained:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};
 if(options.diagnostics)root.userData.records=model;
 return freezeStaticSceneTransforms(root);
}
