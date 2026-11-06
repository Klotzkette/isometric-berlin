import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {Group,InstancedMesh,Mesh} from "three";
import {FEDERAL_STATE_REPRESENTATIONS,createFederalStateRepresentations} from "../src/FederalStateRepresentations";
import {STATE_REPRESENTATIONS_V321 as profiles,type StatePrismV321} from "../src/stateRepresentationsV321Profile";
import {createStateRepresentationFittingsV321,createNativeStateRepresentationsV321,stateRepresentationAdmissionV321,STATE_REPRESENTATIONS_V321_CAPS as caps} from "../src/StateRepresentationsV321";

const read=(name:string)=>JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/"+name,import.meta.url),"utf8"));
const prisms=read("lod2-prisms.json").buildings as StatePrismV321[];
const voxels=read("minecraft-voxels.json");
const digest=(x:unknown)=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
type Box={position:[number,number,number];size:[number,number,number];quaternion:number[];color:number;role:string;run:number};
type Col={lo:number;hi:number};
const filled=(g:Group)=>g.userData.boxes as Box[];
const panes=(g:Group)=>filled(g).filter(b=>b.color===0x445e65);
function inRing(ring:readonly (readonly number[])[],x:number,z:number,scale=1):boolean{
 let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j],ax=a[0]/scale,az=a[1]/scale,bx=b[0]/scale,bz=b[1]/scale;
  if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)yes=!yes;
 }return yes;
}
function dispose(g:Group){g.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();const materials=[o.userData.dayMaterial,o.userData.nightMaterial];for(const m of new Set(materials))m?.dispose();}});}
function localColumns(cx:number,cz:number,radius:number):Map<string,Col>{
 const result=new Map<string,Col>(),cell=voxels.cell_m;
 const add=(x:number,z:number,lo:number,hi:number)=>{if(Math.abs((x+.5)*cell-cx)<radius&&Math.abs((z+.5)*cell-cz)<radius)result.set(`${x},${z}`,{lo:lo/10,hi:hi/10})};
 voxels.building_rows?.forEach((rows:number[][],zi:number)=>{const z=voxels.grid.min_z_idx+zi;if(Math.abs((z+.5)*cell-cz)>radius)return;for(const[x,n,lo,hi]of rows)for(let i=0;i<n;i++)add(voxels.grid.min_x_idx+x+i,z,lo,hi)});
 for(const[x,z,lo,hi]of voxels.buildings??[])add(x,z,lo,hi);return result;
}
function volumeIntersectsBox(box:Box,x0:number,x1:number,z0:number,z1:number,lo:number,hi:number):boolean{
 const p=box.position,s=box.size,eps=1e-5;return p[0]+s[0]/2>x0+eps&&p[0]-s[0]/2<x1-eps&&p[2]+s[2]/2>z0+eps&&p[2]-s[2]/2<z1-eps&&p[1]+s[1]/2>lo+eps&&p[1]-s[1]/2<hi-eps;
}
type Point=readonly number[];
function cross(a:Point,b:Point,c:Point){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function strictlyInside(ring:readonly Point[],p:Point):boolean{
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(Math.abs(cross(a,b,p))<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7)return false;}
 return inRing(ring,p[0],p[1]);
}
function footprintsIntersect(rect:readonly Point[],ring:readonly Point[],holes:readonly (readonly Point[])[]=[]):boolean{
 if(rect.some(p=>strictlyInside(ring,p)&&!holes.some(h=>inRing(h,p[0],p[1]))))return true;
 for(const boundary of[ring,...holes]){
  if(boundary.some(p=>strictlyInside(rect,p)))return true;
  for(let i=0;i<rect.length;i++)for(let j=0;j<boundary.length;j++){
   const a=rect[i],b=rect[(i+1)%rect.length],c=boundary[j],d=boundary[(j+1)%boundary.length];
   if(cross(a,b,c)*cross(a,b,d)<-1e-10&&cross(c,d,a)*cross(c,d,b)<-1e-10)return true;
  }
 }
 return false;
}
function footprint(b:Box):Point[]{const[x,,z]=b.position,[w,,d]=b.size,qy=b.quaternion[1],qw=b.quaternion[3],c=1-2*qy*qy,s=2*qy*qw;return[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+c*u+s*v,z-s*u+c*v]);}

test("twelve refined houses account for fourteen Länder; Berlin and Sachsen-Anhalt retain separate authored owners",()=>{
 expect(profiles).toHaveLength(12);expect(new Set(profiles.flatMap(p=>p.site.stateCodes)).size).toBe(14);
 expect(new Set([...profiles.flatMap(p=>p.site.stateCodes),"BE","ST"]).size).toBe(16);
 expect(profiles.some(p=>p.site.id==="sachsen-anhalt")).toBeFalse();
 expect(profiles.reduce((n,p)=>n+p.sourceRecords.length,0)).toBe(60);
 const stylesSource=readFileSync(new URL("../src/FederalStateRepresentations.ts",import.meta.url),"utf8").match(/const SITE_STYLES: Record<string, SiteStyle> = (\{[\s\S]*?\n\});/)?.[1];
 expect(stylesSource).toBeDefined();const styles=new Function("return "+stylesSource)();
 for(const p of profiles){expect(p.site).toEqual(FEDERAL_STATE_REPRESENTATIONS.find(s=>s.id===p.site.id));expect(styles[p.site.id]).toEqual(p.legacyStyle);expect(stateRepresentationAdmissionV321(p.site,prisms,p.legacyStyle).admitted).toBeTrue();expect(Object.isFrozen(p.sourceRecords)).toBeTrue();}
 const sax=profiles.find(p=>p.site.id==="sachsen")!;expect(sax.streetRuns).toEqual([5]);expect(sax.extraRuns[0].startWorldM).toEqual([2106.3,550.7]);expect(sax.extraRuns[0].endWorldM).toEqual([2121,568.1]);
 expect(profiles.find(p=>p.site.id==="baden-wuerttemberg")!.streetRuns).toEqual([3]);
});

test("each transfer rejects changed geometry, style, missing/duplicate/foreign owners and protects the old default",()=>{
 for(const p of profiles){
  const source=structuredClone(p.sourceRecords) as StatePrismV321[];
  expect(createStateRepresentationFittingsV321(p.site,[],p.legacyStyle)).toBeNull();
  expect(createStateRepresentationFittingsV321(p.site,[...source,source[0]],p.legacyStyle)).toBeNull();
  expect(createStateRepresentationFittingsV321(p.site,source.slice(1),p.legacyStyle)).toBeNull();
  const changed=structuredClone(source);(changed[0].ring[0]as number[])[0]+=.01;expect(createStateRepresentationFittingsV321(p.site,changed,p.legacyStyle)).toBeNull();
  const foreign=structuredClone(source);foreign[0].id="foreign-owner";expect(createStateRepresentationFittingsV321(p.site,foreign,p.legacyStyle)).toBeNull();
  expect(createStateRepresentationFittingsV321(p.site,source,{...p.legacyStyle,accent:p.legacyStyle.accent+1})).toBeNull();
  expect(createStateRepresentationFittingsV321({...p.site,address:"foreign-house"},source,p.legacyStyle)).toBeNull();
 }
 const st=FEDERAL_STATE_REPRESENTATIONS.find(p=>p.id==="sachsen-anhalt")!;
 expect(stateRepresentationAdmissionV321(st,prisms,profiles[0].legacyStyle).admitted).toBeFalse();
});

test("drawn factories produce complete distinct texture-free full-detail fittings without changing a source",()=>{
 const before=digest(prisms),signatures=new Set<string>();let members=0,gpu=0;
 for(const p of profiles){
  const g=createStateRepresentationFittingsV321(p.site,prisms,p.legacyStyle,{diagnostics:true})!;expect(g).toBeInstanceOf(Group);signatures.add(g.userData.signature);
  expect(g.userData.fullStaticDetailOnTouch).toBeTrue();expect(g.userData.sourceGeometryChanged).toBeFalse();expect(g.userData.detailCounts.glazing).toBeGreaterThan(0);
  expect(filled(g).length).toBeLessThanOrEqual(caps.drawnMembersPerHouse);expect(g.userData.gpuBytes).toBeLessThan(80_000);
  expect(filled(g).every(b=>[...b.position,...b.size,...b.quaternion].every(Number.isFinite)&&b.size.every(n=>n>0))).toBeTrue();
  const mesh=g.children[0]as InstancedMesh;expect(mesh.geometry.getAttribute("uv")).toBeUndefined();expect(mesh.count).toBe(filled(g).length);
  if(p.site.id==="baden-wuerttemberg"){
   const r=p.site.facadeRuns[3],dx=r.endWorldM[0]-r.startWorldM[0],dz=r.endWorldM[1]-r.startWorldM[1],l=Math.hypot(dx,dz);
   expect(filled(g).some(b=>b.run===3&&b.role==="window reveal"&&Math.abs((b.position[0]-r.startWorldM[0])*dx/l+(b.position[2]-r.startWorldM[1])*dz/l-l/2)<l*.30)).toBeFalse();
  }
  if(p.site.id==="sachsen")expect(filled(g).filter(b=>b.run===5&&b.role==="evidenced outer-axis portal")).toHaveLength(2);
  members+=filled(g).length;gpu+=g.userData.gpuBytes;dispose(g);
 }
 expect(signatures.size).toBe(12);expect(digest(prisms)).toBe(before);console.log({stateRepresentationsDrawnV321:{members,gpuBytes:gpu}});
});

test("every complete drawn glass prism clears all retained source solids and the actual old manual wall thickness",()=>{
 const failures:string[]=[];let checked=0;
 for(const p of profiles){
  const g=createStateRepresentationFittingsV321(p.site,prisms,p.legacyStyle,{diagnostics:true})!;
  const solids:{name:string;ring:readonly Point[];holes:readonly (readonly Point[])[];lo:number;hi:number}[]=p.sourceRecords.map(r=>({name:r.id,ring:r.ring.map(v=>[v[0]/10,v[1]/10]),holes:(r.holes??[]).map(h=>h.map(v=>[v[0]/10,v[1]/10])),lo:r.y0_dm/10,hi:(r.y0_dm+r.h_dm)/10}));
  for(const zone of p.site.manualMassing?.zones??[]){
   solids.push({name:zone.id,ring:zone.ringWorldM,holes:[],lo:zone.bottomYM,hi:zone.topYM});
   // Original addClosedMassingZone uses 0.30 m walls and extends each end 0.04 m.
   for(let i=0;i<zone.ringWorldM.length;i++){
    const a=zone.ringWorldM[i],b=zone.ringWorldM[(i+1)%zone.ringWorldM.length],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),ux=dx/l,uz=dz/l;
    solids.push({name:zone.id+":wall",ring:[[-.04,-.15],[l+.04,-.15],[l+.04,.15],[-.04,.15]].map(([u,v])=>[a[0]+ux*u-uz*v,a[1]+uz*u+ux*v]),holes:[],lo:zone.bottomYM,hi:zone.topYM});
   }
  }
  for(const b of panes(g)){checked++;const rect=footprint(b);for(const s of solids)if(b.position[1]+b.size[1]/2>s.lo+1e-7&&b.position[1]-b.size[1]/2<s.hi-1e-7&&footprintsIntersect(rect,s.ring,s.holes))failures.push(`${p.site.id}: ${b.role}, run ${b.run}, ${s.name}`);}
  if(p.site.id==="bayern"){expect(p.fittedRuns?.[0].startWorldM).toEqual([1072.2,408.6]);expect(p.fittedRuns?.[0].endWorldM).toEqual([1102.3,406.1]);expect(panes(g).filter(b=>b.run===3&&b.role==="historic divided sash")).toHaveLength(20);expect(panes(g).filter(b=>b.role==="Bavaria roof dormer glazing")).toHaveLength(7);expect(panes(g).filter(b=>b.role==="Bavaria evidenced central rectangular portal")).toHaveLength(1);}
  if(p.site.id==="bremen")expect(p.fittedRuns?.[0].startWorldM).toEqual(p.site.manualMassing!.footprintRingWorldM[5]);
  dispose(g);
 }
 expect(checked).toBeGreaterThan(1300);expect(failures).toEqual([]);
});

test("all twelve native houses attach independently cardinal surfaces; original payload bytes remain unchanged",()=>{
 const before=digest(voxels),sourceBefore=digest(prisms),g=createNativeStateRepresentationsV321(prisms,voxels,{diagnostics:true});
 expect(g.children).toHaveLength(12);expect(g.userData.admissions.every((a:{admitted:boolean})=>a.admitted)).toBeTrue();
 let members=0,gpu=0;
 for(const object of g.children){const h=object as Group;expect(h.userData.detailCounts.glazing).toBeGreaterThan(0);expect(h.userData.sourceGeometryChanged).toBeFalse();expect(h.userData.fullStaticDetailOnTouch).toBeTrue();expect(h.userData.detailCounts.members).toBeLessThanOrEqual(caps.nativeMembersPerHouse);expect(h.userData.nativeShellMembers).toBeLessThanOrEqual(caps.nativeShellMembersPerHouse);expect(filled(h).every(b=>b.quaternion.every((n,i)=>n===[0,0,0,1][i]))).toBeTrue();members+=h.userData.detailCounts.members;gpu+=h.userData.gpuBytes;}
 expect(digest(voxels)).toBe(before);expect(digest(prisms)).toBe(sourceBefore);console.log({stateRepresentationsNativeV321:{members,gpuBytes:gpu}});dispose(g);
 const changed=structuredClone(prisms);const target=changed.find(p=>p.id===profiles[0].sourceRecords[0].id)!;target.h_dm++;
 const rejected=createNativeStateRepresentationsV321(changed,voxels);expect(rejected.children).toHaveLength(11);expect(rejected.userData.admissions[0].admitted).toBeFalse();dispose(rejected);
});

test("complete native glass prisms remain outside source columns and are backed over their whole window rectangles",()=>{
 const g=createNativeStateRepresentationsV321(prisms,voxels,{diagnostics:true});let checked=0;const failures:string[]=[];
 for(const object of g.children){
  const h=object as Group,p=profiles.find(p=>p.site.id===h.userData.admission.id)!,cols=localColumns(...p.site.centerWorldM,100),cell=voxels.cell_m,step=h.userData.nativeStepM;
  const manual=new Map((h.userData.manualColumns as{key:string;lo:number;hi:number}[]).map(c=>[c.key,c]));
  const occupied=(x:number,y:number,z:number)=>{
   const old=cols.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`);if(old&&y>old.lo&&y<old.hi)return true;
   const extra=manual.get(`${Math.floor(x/step)},${Math.floor(z/step)}`);return!!extra&&y>extra.lo&&y<extra.hi;
  };
  for(const b of panes(h)){
   checked++;
   for(const[key,c]of cols){const[x,z]=key.split(",").map(Number);if(volumeIntersectsBox(b,x*cell,(x+1)*cell,z*cell,(z+1)*cell,c.lo,c.hi))failures.push(`${p.site.id}: source-column overlap ${key}`);}
   for(const[key,c]of manual){const[x,z]=key.split(",").map(Number);if(volumeIntersectsBox(b,x*step,(x+1)*step,z*step,(z+1)*step,c.lo,c.hi))failures.push(`${p.site.id}: manual-shell overlap ${key}`);}
   const candidateAxes=[0,2].filter(axis=>Math.abs(b.size[axis]-.08)<1e-6);
   const supported=candidateAxes.some(axis=>[-1,1].some(sign=>{
    const tangent=axis===0?2:0;
    for(const t of[-.49,0,.49])for(const y of[-.49,0,.49]){
     const at=[...b.position];at[axis]-=sign*.65;at[tangent]+=b.size[tangent]*t;at[1]+=b.size[1]*y;
     if(!occupied(at[0],at[1],at[2]))return false;
    }return true;
   }));if(!supported)failures.push(`${p.site.id}: unsupported complete window ${checked}`);
  }
 }
 expect(checked).toBeGreaterThan(800);expect(failures).toEqual([]);dispose(g);
});

test("the actual legacy callback retains exact manual-body prefixes and restores every old fitting on failed admission",()=>{
 const baseline=createFederalStateRepresentations(),fallback=createFederalStateRepresentations({fittingsFactoryV321:()=>null});let callbacks=0;
 const current=createFederalStateRepresentations({fittingsFactoryV321:(site,style)=>{callbacks++;return createStateRepresentationFittingsV321(site,prisms,style)}});
 expect(callbacks).toBe(12);expect(current.children).toHaveLength(13);
 const geometry=(root:Group,id:string)=>{const house=root.children.find(g=>g.name===`Federal state representation ${id}`)!;return house.children.filter(c=>c instanceof Mesh).map(c=>({name:c.name,position:Array.from((c as Mesh).geometry.getAttribute("position").array),index:Array.from((c as Mesh).geometry.index?.array??[]),color:Array.from((c as Mesh).geometry.getAttribute("color")?.array??[])}));};
 for(const site of FEDERAL_STATE_REPRESENTATIONS)expect(geometry(fallback,site.id)).toEqual(geometry(baseline,site.id));
 for(const id of["bremen","sachsen"]){const old=geometry(baseline,id)[0],body=geometry(current,id)[0];expect(body.position.length).toBeGreaterThan(0);expect(body.position).toEqual(old.position.slice(0,body.position.length));expect(body.color).toEqual(old.color.slice(0,body.color.length));expect(body.index).toEqual(old.index.slice(0,body.index.length));}
 expect(geometry(current,"sachsen-anhalt")).toEqual(geometry(baseline,"sachsen-anhalt"));
 const damaged=prisms.filter(q=>q.id!==profiles[0].sourceRecords[0].id),rejected=createFederalStateRepresentations({fittingsFactoryV321:(site,style)=>createStateRepresentationFittingsV321(site,damaged,style)});
 expect(geometry(rejected,profiles[0].site.id)).toEqual(geometry(baseline,profiles[0].site.id));
 dispose(rejected);dispose(current);dispose(fallback);dispose(baseline);
});

test("Bremen/Saxony native shells use only exterior surfaces wholly inside their original manual zones and heights",()=>{
 const g=createNativeStateRepresentationsV321(prisms,voxels,{diagnostics:true});
 for(const object of g.children){const h=object as Group,p=profiles.find(p=>p.site.id===h.userData.admission.id)!;
  const shell=filled(h).filter(b=>b.run===-1);
  if(!p.site.manualMassing){expect(shell).toHaveLength(0);continue;}
  expect(shell.length).toBeGreaterThan(100);
  for(const b of shell){expect(b.role).toMatch(/native manual (roof surface|exterior wall)/);expect(Math.min(...b.size)).toBeLessThanOrEqual(.13+1e-6);
   for(const dx of[-.49999,.49999])for(const dz of[-.49999,.49999])for(const dy of[-.49999,.49999]){
    const x=b.position[0]+dx*b.size[0],y=b.position[1]+dy*b.size[1],z=b.position[2]+dz*b.size[2];
    expect(p.site.manualMassing.zones.some(zone=>y>=zone.bottomYM-1e-5&&y<=zone.topYM+1e-5&&inRing(zone.ringWorldM,x,z))).toBeTrue();
   }
  }
 }
 dispose(g);
});
