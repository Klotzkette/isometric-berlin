import {
  BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import type {FederalStateRepresentationProfile, FederalFacadeRun} from "./FederalStateRepresentations";
import type {DeutschesTheaterVoxelPayload} from "./DeutschesTheater";
import {freezeStaticSceneTransforms} from "./staticSceneTransforms";
import {
  STATE_REPRESENTATIONS_V321, type StateLegacyStyleV321, type StatePrismV321,
  type StateRepresentationProfileV321,
} from "./stateRepresentationsV321Profile";

export const STATE_REPRESENTATIONS_V321_CAPS=Object.freeze({drawnMembersPerHouse:1024,nativeMembersPerHouse:4096,nativeShellMembersPerHouse:1024});
export type {StatePrismV321,StateLegacyStyleV321} from "./stateRepresentationsV321Profile";
type P=[number,number,number];
type Box={position:P;size:P;quaternion:[number,number,number,number];color:number;role:string;run:number;sourcePartId:string};
type Op={run:number;u:number;y:number;w:number;h:number;out:number;d:number;color:number;role:string;end?:[number,number]};
type Frame={a:readonly number[];ux:number;uz:number;nx:number;nz:number;length:number;run:FederalFacadeRun};
type Column={lo:number;hi:number;owners:Set<string>};
type Admission={admitted:boolean;reason:string;id:string;ownerIds:string[]};
type Options={diagnostics?:boolean};
const UP=new Vector3(0,1,0);
const IDENTITY:[number,number,number,number]=[0,0,0,1];
const profiles=new Map(STATE_REPRESENTATIONS_V321.map(p=>[p.site.id,p]));
const short=(id:string)=>id.startsWith("DEBE")?id.slice(-8):id;
const exact=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const finite=(v:number)=>Number.isFinite(v);
function inside(ring:ReadonlyArray<readonly number[]>,x:number,z:number,scale=1):boolean{
  let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j],ax=a[0]/scale,az=a[1]/scale,bx=b[0]/scale,bz=b[1]/scale;
    if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)hit=!hit;
  }return hit;
}
function contains(p:StatePrismV321,x:number,z:number):boolean{return inside(p.ring,x,z,10)&&!(p.holes??[]).some(h=>inside(h,x,z,10));}
function admit(profile:StateRepresentationProfileV321,source:readonly StatePrismV321[]):Admission{
  const wanted=new Map(profile.sourceRecords.map(p=>[p.id,p]));const found=new Set<string>();
  for(const p of source){const expected=wanted.get(p.id);if(!expected)continue;
    if(found.has(p.id)||!exact(p,expected))return{admitted:false,reason:"changed-or-duplicate-source",id:profile.site.id,ownerIds:[...wanted.keys()]};
    found.add(p.id);
  }
  return{admitted:found.size===wanted.size,reason:found.size===wanted.size?"exact-published200-inputs":"missing-source",id:profile.site.id,ownerIds:[...wanted.keys()]};
}
/** A missing or changed source never acquires the old fitting owner. */
export function stateRepresentationAdmissionV321(site:FederalStateRepresentationProfile,source:readonly StatePrismV321[],style:StateLegacyStyleV321):Admission{
  const profile=profiles.get(site.id);if(!profile)return{admitted:false,reason:"unowned-house",id:site.id,ownerIds:[]};
  if(!exact(site,profile.site)||!exact(style,profile.legacyStyle))return{admitted:false,reason:"changed-legacy-inputs",id:site.id,ownerIds:[]};
  return admit(profile,source);
}
function frames(p:StateRepresentationProfileV321):Frame[]{
  return[...p.site.facadeRuns,...p.extraRuns].map((legacy,index)=>{
    // Only the new fittings follow these exact source-vertex corrections. The
    // original admitted registry, bodies and manual zones remain byte-identical.
    const correction=p.fittedRuns?.find(r=>r.index===index),run=correction?{...legacy,...correction}:legacy;
    const dx=run.endWorldM[0]-run.startWorldM[0],dz=run.endWorldM[1]-run.startWorldM[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
    let nx=-uz,nz=ux;const mx=(run.startWorldM[0]+run.endWorldM[0])/2,mz=(run.startWorldM[1]+run.endWorldM[1])/2;
    const record=p.sourceRecords.find(q=>q.id===short(run.sourcePartId))??p.sourceRecords[0];
    if(contains(record,mx+nx*.3,mz+nz*.3)||(!contains(record,mx-nx*.3,mz-nz*.3)&&nx*(mx-p.site.centerWorldM[0])+nz*(mz-p.site.centerWorldM[1])<0)){nx=-nx;nz=-nz;}
    return{a:run.startWorldM,ux,uz,nx,nz,length,run};
  });
}
function plan(p:StateRepresentationProfileV321,ff:Frame[]):Op[]{
  const ops:Op[]=[];
  const box=(run:number,u:number,y:number,w:number,h:number,color:number,role:string,out=.28,d=.1)=>{
    if([u,y,w,h,out,d].every(finite)&&w>0&&h>0&&d>0)ops.push({run,u,y,w,h,out,d,color,role});
  };
  const beam=(run:number,u:number,y:number,v:number,z:number,width:number,color:number,role:string,out=.46)=>ops.push({run,u,y,w:width,h:1,out,d:width,color,role,end:[v,z]});
  for(const [ri,f]of ff.entries()){
    const r=f.run,l=f.length,h=r.measuredHeightM,g=r.groundYM,front=p.streetRuns.includes(ri),s=p.legacyStyle;
    const stone=p.signature==="white-funnel"?0xefeee7:p.signature==="red-villa-and-guesthouse"?0xb35a46:p.signature==="timber-glass-hall"?0xc4ad96:p.signature==="sandstone-slots-and-bands"?0xd4ccb7:s.stone;
    const glass=0x445e65,light=p.signature==="red-villa-and-guesthouse"?0xb86a55:0xd8d7c9,frame=p.signature.includes("historic")||p.signature==="bank-palazzo"||p.signature==="seven-axis-neobaroque"?0xe4e1d3:0x4e5c5c;
    const pane=(u:number,y:number,w:number,hh:number,role:string,mullions=1,transom=true)=>{
      box(ri,u,y,w+.22,hh+.22,frame,"window reveal",.27,.12);box(ri,u,y,w,hh,glass,role,.35,.08);
      for(let m=1;m<=mullions;m++)box(ri,u-w/2+w*m/(mullions+1),y,.065,hh,light,"window mullion",.42,.055);
      if(transom)box(ri,u,y+hh*.18,w,.07,light,"window transom",.43,.055);
      box(ri,u,y-hh/2-.13,w+.4,.13,light,"projecting sill",.36,.3);
    };
    if(p.signature==="white-funnel"){
      // The source's open funnel/blank white surfaces receive no regular grid.
      if(front){
        box(ri,l/2,g+h-.9,l,1.65,stone,"BW white upper fascia",.14,.08);
        for(const u of[l*.08,l*.92]){box(ri,u,g+h*.53,l*.13,h*.63,stone,"BW blank entrance cheek",.14,.08);pane(u,g+h*.82,l*.09,h*.12,"BW recessed upper loggia",0,false);}
        for(const u of[l*.11,l*.89])box(ri,u,g+1.1,l*.20,2.15,0xaaa89e,"BW granite base",.18,.1);
      }else{
        for(const t of[.22,.49,.76])for(const u of[l*.17,l*.40,l*.68,l*.87])pane(u,g+h*t,Math.min(3.2,l*.07),h*.10,"BW separated horizontal glazing",0,false);
        box(ri,l/2,g+h-.38,l,.45,stone,"BW restrained roof edge",.2,.12);
      }
      continue;
    }
    if(["bank-palazzo","two-historic-houses","seven-axis-neobaroque"].includes(p.signature)){
      const sax=p.signature==="seven-axis-neobaroque",hamburg=p.signature==="two-historic-houses",bavaria=p.signature==="bank-palazzo"&&front,bays=front?(sax||bavaria?7:5):Math.max(2,Math.min(11,Math.round(l/3.7))),pitch=l/bays,levels=bavaria?3:4;
      box(ri,l/2,g+h*.45,l,h*.90,stone,"historic stone/plaster field",.17,.06);
      for(let y=g+.45;y<g+h*(bavaria?.32:.22);y+=.55)box(ri,l/2,y,l,.035,0x9e8b72,"rusticated base joints",.22,.035);
      for(let floor=0;floor<levels;floor++)for(let bay=0;bay<bays;bay++){
        if(front&&floor===0&&(sax?(bay===0||bay===6):hamburg?bay===2:bavaria&&bay===3))continue;
        const u=(bay+.5)*pitch,yy=g+h*(bavaria?[.17,.47,.71]:[.115,.345,.565,.775])[floor],hh=h*(bavaria?[.22,.19,.18]:[.145,.165,.15,.135])[floor];
        pane(u,yy,Math.min(2.1,pitch*.60),hh,"historic divided sash",bavaria?2:1,true);
        if(front&&floor===1){box(ri,u,yy+hh/2+.24,pitch*.80,.18,light,"principal window hood",.43,.34);if(hamburg){beam(ri,u-pitch*.36,yy+hh/2+.32,u,yy+hh/2+.85,.14,light,"triangular hood");beam(ri,u,yy+hh/2+.85,u+pitch*.36,yy+hh/2+.32,.14,light,"triangular hood");}}
      }
      for(const t of bavaria?[.32,.84,.87]:[.22,.46,.68,.91,.94])box(ri,l/2,g+h*t,l,.15,light,"layered historic cornice",.34,.30);
      if(front){
        for(let i=1;i<bays;i++)if(!sax||i>=1&&i<=6){box(ri,i*pitch,g+h*(bavaria?.59:.58),bavaria?.48:.28,h*(bavaria?.47:.61),light,"colossal/piano-nobile pilaster",.39,.3);if(bavaria)for(const offset of[-.15,0,.15])box(ri,i*pitch+offset,g+h*.59,.035,h*.45,0xb4ab95,"Bavaria fluted pilaster groove",.55,.035);}
        const n=Math.min(60,Math.floor(l/.65));for(let i=0;i<n;i++)box(ri,(i+.5)*l/n,g+h*(bavaria?.855:.925),.17,.31,light,"cornice dentil",.48,.36);
        if(bavaria){pane(l/2,g+h*.16,pitch*.55,h*.25,"Bavaria evidenced central rectangular portal",2,false);box(ri,l/2,g+h*.305,pitch*.86,.28,light,"Bavaria central portal crown",.48,.4);for(let i=0;i<bays;i++){pane((i+.5)*pitch,g+h*.945,Math.min(1.6,pitch*.45),h*.075,"Bavaria roof dormer glazing",1,true);box(ri,(i+.5)*pitch,g+h*.993,Math.min(1.9,pitch*.55),.14,0x555c56,"Bavaria dormer cap",.44,.3);}}
        const portals=sax?[.5*pitch,6.5*pitch]:hamburg?[2.5*pitch]:[];
        for(const u of portals){pane(u,g+h*.115,pitch*.76,h*.19,"evidenced outer-axis portal",1,false);for(let i=0;i<10;i++){const a=Math.PI*i/10,b=Math.PI*(i+1)/10;beam(ri,u+Math.cos(a)*pitch*.42,g+h*.21+Math.sin(a)*pitch*.20,u+Math.cos(b)*pitch*.42,g+h*.21+Math.sin(b)*pitch*.20,.15,light,"rounded portal head");}}
        if(sax){for(let i=0;i<12;i++){const a=i/12,b=(i+1)/12;beam(ri,l*.15+l*.70*a,g+h*(.955+.035*Math.sin(a*Math.PI)),l*.15+l*.70*b,g+h*(.955+.035*Math.sin(b*Math.PI)),.16,light,"central-five curved gable relief");}for(const u of[l*.18,l*.82]){box(ri,u,g+h*.94,.35,.55,light,"gable vase base",.48,.3);box(ri,u,g+h*.965,.45,.30,light,"gable vase bowl",.48,.3);}}
      }
      continue;
    }
    if(p.signature==="tripartite-shutters"){
      const floors=r.storeys,groups=Math.max(1,Math.round(l/4.1)),pitch=l/groups;
      box(ri,l/2,g+h/2,l,h-.2,stone,"BB/MV retained dark panel reading",.16,.06);
      for(let floor=0;floor<floors;floor++)for(let group=0;group<groups;group++){
        const center=(group+.5)*pitch,y=g+(floor+.52)*h/floors,w=Math.min(.88,pitch*.22),hh=Math.min(2.45,h/floors*.72);
        for(const k of[-1,0,1])pane(center+k*(w+.08),y,w,hh,"BB/MV tripartite glazing",0,false);
        box(ri,center+pitch*.42,y,.14,hh,0x87584b,"BB/MV shutter accent",.43,.12);
      }
      for(let y=g+.35;y<g+h;y+=h/floors)box(ri,l/2,y,l,.05,0x4c5655,"dark panel horizontal joint",.23,.04);
      continue;
    }
    if(p.signature==="red-villa-and-guesthouse"){
      const head=ri<3,floors=head?8:4,bays=Math.max(2,Math.min(8,Math.round(l/(head?3.4:4.2)))),pitch=l/bays;
      box(ri,l/2,g+h/2,l,h,stone,"Bremen red rendered surface",.16,.06);
      for(let floor=0;floor<floors;floor++)for(let i=0;i<bays;i++){
        const w=pitch*(head?(i%2===0?.44:.27):floor<2?.66:.79),u=(i+.5)*pitch+(head&&floor%2?pitch*.12:0),hh=h/floors*(head?.57:.64);
        pane(Math.min(l-w/2-.1,u),g+(floor+.48)*h/floors,w,hh,"Bremen unequal deep window",head?0:2,false);
      }
      if(!head)box(ri,l*.55,g+h*.48,l*.66,.16,0x8d463c,"Bremen deep horizontal reveal",.42,.18);
      continue;
    }
    if(p.signature==="sandstone-slots-and-bands"){
      box(ri,l/2,g+h/2,l,h-.15,stone,"Hessen pale quartz-sandstone field",.16,.06);
      const slots=f.nx>.5,floors=Math.max(2,r.storeys-1),bays=Math.max(2,Math.round(l/(slots?2.7:7.0))),pitch=l/bays;
      for(let floor=0;floor<floors;floor++)for(let i=0;i<bays;i++)pane((i+.5)*pitch,g+(floor+.52)*h/floors,pitch*(slots?.31:.91),h/floors*(slots?.78:.58),slots?"Hessen narrow east slot":"Hessen horizontal ribbon",slots?0:2,false);
      for(let y=g+.3;y<g+h;y+=.9)box(ri,l/2,y,l,.018,0xaaa594,"sandstone course joint",.20,.018);
      continue;
    }
    if(p.signature==="timber-glass-hall"){
      const floors=5,pitch=h/floors;
      box(ri,l/2,g+h/2,l,h-.1,stone,"NI/SH warm panel facade",.16,.06);
      if(front){
        const hall=l*.48;box(ri,l/2,g+h/2,hall,h-.5,glass,"NI/SH central hall glazing",.32,.08);
        for(let i=0;i<=6;i++)box(ri,l/2-hall/2+i*hall/6,g+h/2,.13,h-.2,0x947556,"NI/SH timber hall mullion",.49,.25);
        for(let floor=1;floor<floors;floor++)box(ri,l/2,g+floor*pitch,hall,.13,0x6e716a,"NI/SH hall steel transom",.47,.14);
      }
      const bays=Math.max(3,Math.round(l/3.9)),pw=l/bays;
      for(let floor=0;floor<floors;floor++)for(let i=0;i<bays;i++){const u=(i+.5)*pw;if(front&&u>l*.24&&u<l*.76)continue;pane(u,g+(floor+.52)*pitch,pw*.52,pitch*.71,"NI/SH paired wing windows",1,false);}
      for(let floor=1;floor<=floors;floor++)box(ri,l/2,g+floor*pitch-.12,l,.11,0xa38c74,"NI/SH slender continuous floor band",.29,.13);
      continue;
    }
    if(p.signature==="parabolic-timber-diamonds"){
      const floors=4,bays=Math.max(3,Math.round(l/2.9)),pitch=l/bays;
      box(ri,l/2,g+h/2,l,h-.1,glass,"NRW continuous glazed envelope",.25,.08);
      for(let floor=1;floor<floors;floor++)box(ri,l/2,g+floor*h/floors,l,.13,0x67716b,"NRW glass floor transom",.36,.12);
      for(let i=0;i<=bays;i++)box(ri,i*pitch,g+h/2,.065,h,0x66766e,"NRW fine glazing mullion",.37,.07);
      const span=Math.min(8.0,l/2),n=Math.max(2,Math.ceil(l/span));
      for(let i=0;i<n;i++)for(const sign of[-1,1])for(let k=0;k<10;k++){
        const t=k/10,v=(k+1)/10,center=(i+.5)*l/n,curve=(q:number)=>center+sign*(span*(q-.5)+span*.13*(4*(q-.5)**2-1));
        const u=Math.max(.1,Math.min(l-.1,curve(t))),w=Math.max(.1,Math.min(l-.1,curve(v)));
        beam(ri,u,g+.2+(h-.4)*t,w,g+.2+(h-.4)*v,.18,0x9d7a50,"NRW parabolic timber lattice",.49);
      }
      continue;
    }
    if(p.signature==="offset-ribbons"){
      box(ri,l/2,g+h/2,l,h-.1,0xdcd7c8,"RLP light stone field",.16,.06);
      const floors=Math.max(2,r.storeys-1),bays=Math.max(2,Math.round(l/6.0)),pitch=l/bays;
      for(let floor=0;floor<floors;floor++)for(let i=0;i<bays;i++){
        const offset=(floor%2?.15:-.12)*pitch,u=Math.max(pitch*.4,Math.min(l-pitch*.4,(i+.5)*pitch+offset));
        if(front&&floor===0&&Math.abs(u-l/2)<l*.3)continue;
        pane(u,g+(floor+.63)*h/(floors+.3),pitch*.79,h/(floors+.3)*.54,"RLP offset horizontal window band",2,false);
      }
      if(front)pane(l/2,g+h*.15,l*.62,h*.24,"RLP broad glazed entry",4,false);
      for(let y=g+.2;y<g+h;y+=.8)box(ri,l/2,y,l,.018,0xb6b09f,"RLP varied stone course joint",.20,.018);
      box(ri,l/2,g+h-.18,l,.22,light,"RLP terrace parapet lip",.30,.20);
      continue;
    }
    if(p.signature==="triple-glazing-and-pergola"){
      const floors=6,pitch=h/floors;
      box(ri,l/2,g+h/2,l,h-.1,0xcfc8b7,"Saarland regular stone field",.16,.06);
      for(let floor=0;floor<floors;floor++){
        if(front){for(const t of[.1,.9])pane(l*t,g+(floor+.52)*pitch,l*.12,pitch*.79,"Saarland outer-axis window",0,true);for(const t of[.34,.5,.66])pane(l*t,g+(floor+.52)*pitch,l*.15,pitch*.84,"Saarland central three glass axes",0,true);}
        else{const n=Math.max(2,Math.round(l/4.2));for(let i=0;i<n;i++)pane((i+.5)*l/n,g+(floor+.52)*pitch,Math.min(1.8,l/n*.45),pitch*.79,"Saarland regular side window",0,true);}
      }
      for(let y=g+.3;y<g+h;y+=.55)box(ri,l/2,y,l,.018,0xb0aa98,"Saarland even stone joint",.20,.018);
      if(ri===3){for(let i=0;i<=5;i++)box(ri,i*l/5,g+h/2,.17,h,light,"Saarland rear pergola upright",.55,.2);for(let i=0;i<=6;i++)box(ri,l/2,g+i*h/6,l,.17,light,"Saarland rear pergola horizontal",.56,.2);}
      continue;
    }
    if(p.signature==="colonnade-and-terrace"){
      box(ri,l/2,g+h/2,l,h-.1,0xc8c2b3,"Thüringen stone field",.16,.06);
      const count=Math.max(2,Math.round(l/3.8)),pitch=l/count;
      if(front){box(ri,l/2,g+h*.14,l-.4,h*.26,glass,"Thüringen double-height colonnade glazing",.30,.08);for(let i=0;i<=count;i++)box(ri,i*pitch,g+h*.14,.40,h*.28,0xd1ccbf,"Thüringen street colonnade pier",.50,.48);}
      for(let floor=front?2:0;floor<6;floor++)for(let i=0;i<count;i++)pane((i+.5)*pitch,g+(floor+.52)*h/6,pitch*(i%3===0?.74:.40),h/6*.75,"Thüringen differentiated punched/glazed bay",0,false);
      for(let i=1;i<=6;i++)box(ri,l/2,g+i*h/6-.12,l,.12,0x798984,"Thüringen metal horizontal band",.31,.12);
      box(ri,l/2,g+h-.18,l,.20,light,"Thüringen retained terrace edge",.36,.22);
    }
  }
  return ops;
}
function at(f:Frame,u:number,y:number,out:number):P{return[f.a[0]+f.ux*u+f.nx*out,y,f.a[1]+f.uz*u+f.nz*out];}
function drawnBoxes(ops:Op[],ff:Frame[]):Box[]{
  return ops.map(op=>{
    const f=ff[op.run];let position=at(f,op.u,op.y,op.out),q=new Quaternion().setFromAxisAngle(UP,-Math.atan2(f.uz,f.ux)),size:P=[op.w,op.h,op.d];
    if(op.end){const end=at(f,op.end[0],op.end[1],op.out),delta=new Vector3(...end).sub(new Vector3(...position));size=[op.w,delta.length(),op.d];position=position.map((v,i)=>(v+end[i])/2)as P;q=new Quaternion().setFromUnitVectors(UP,delta.normalize());}
    return{position,size,quaternion:q.toArray(),color:op.color,role:op.role,run:op.run,sourcePartId:f.run.sourcePartId};
  });
}
function makeGroup(p:StateRepresentationProfileV321,boxes:Box[],native:boolean,options:Options,admission:Admission):Group{
  const root=new Group();root.name=native?`Native state representation v321 ${p.site.id}`:`Federal state representation ${p.site.id}`;
  const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
  const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.86});
  const mesh=new InstancedMesh(geometry,day,boxes.length),matrix=new Matrix4(),q=new Quaternion(),pos=new Vector3(),size=new Vector3(),color=new Color();
  boxes.forEach((b,i)=>{mesh.setMatrixAt(i,matrix.compose(pos.fromArray(b.position),q.fromArray(b.quaternion),size.fromArray(b.size)));mesh.setColorAt(i,color.setHex(b.color));});
  mesh.name=`${root.name} bodies`;mesh.userData={dayMaterial:day,nightMaterial:night,federalStateRepresentation:true,federalStateRepresentationId:p.site.id,stateCodes:p.site.stateCodes,textureFree:true,blockNative:native,keepInMinecraft:native};
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  root.userData={admission,sourceOwnerIds:admission.ownerIds,sourceBounded:true,sourceGeometryChanged:false,fullStaticDetailOnTouch:true,signature:p.signature,blockNative:native,keepInMinecraft:native,displayEstimates:true,detailCounts:{members:boxes.length,glazing:boxes.filter(b=>b.color===0x445e65).length},gpuBytes:geometry.attributes.position.array.byteLength+geometry.attributes.normal.array.byteLength+(geometry.index?.array.byteLength??0)+mesh.instanceMatrix.array.byteLength+(mesh.instanceColor?.array.byteLength??0)};
  if(options.diagnostics)root.userData.boxes=boxes;
  return freezeStaticSceneTransforms(root);
}
/** Only the caller's exact old generic fittings may yield; bodies stay outside. */
export function createStateRepresentationFittingsV321(site:FederalStateRepresentationProfile,sourcePrisms:readonly StatePrismV321[],legacyStyle:StateLegacyStyleV321,options:Options={}):Group|null{
  const admission=stateRepresentationAdmissionV321(site,sourcePrisms,legacyStyle),p=profiles.get(site.id);if(!admission.admitted||!p)return null;
  const ff=frames(p),boxes=drawnBoxes(plan(p,ff),ff);
  if(boxes.length===0||boxes.length>STATE_REPRESENTATIONS_V321_CAPS.drawnMembersPerHouse)return null;
  return makeGroup(p,boxes,false,options,admission);
}

function payloadColumns(p:StateRepresentationProfileV321,v:DeutschesTheaterVoxelPayload,step:number):Map<string,Column>{
  const all=new Map<string,Column>(),xs=p.sourceRecords.flatMap(r=>r.ring.map(q=>q[0]/10)),zs=p.sourceRecords.flatMap(r=>r.ring.map(q=>q[1]/10));
  const minX=Math.min(...xs)-v.cell_m*3,maxX=Math.max(...xs)+v.cell_m*3,minZ=Math.min(...zs)-v.cell_m*3,maxZ=Math.max(...zs)+v.cell_m*3;
  const insert=(ix:number,iz:number,lo:number,hi:number)=>{
    const x=ix*v.cell_m,z=iz*v.cell_m;if(x>maxX||x+v.cell_m<minX||z>maxZ||z+v.cell_m<minZ)return;
    for(let a=0;a<2;a++)for(let b=0;b<2;b++){
      const xx=ix*2+a,zz=iz*2+b,cx=(xx+.5)*step,cz=(zz+.5)*step,owners=new Set(p.sourceRecords.filter(r=>contains(r,cx,cz)).map(r=>r.id));
      all.set(`${xx},${zz}`,{lo:lo/10,hi:hi/10,owners});
    }
  };
  v.building_rows?.forEach((rows,zi)=>{const iz=v.grid.min_z_idx+zi,z=iz*v.cell_m;if(z>maxZ||z+v.cell_m<minZ)return;for(const[x,n,lo,hi]of rows){const start=Math.max(v.grid.min_x_idx+x,Math.floor(minX/v.cell_m)),end=Math.min(v.grid.min_x_idx+x+n,Math.ceil(maxX/v.cell_m));for(let ix=start;ix<end;ix++)insert(ix,iz,lo,hi);}});
  for(const[x,z,lo,hi]of v.buildings??[])insert(x,z,lo,hi);
  return all;
}
function strictCellInRing(ring:ReadonlyArray<readonly number[]>,x:number,z:number,s:number):boolean{
  const e=1e-6;for(const[dx,dz]of[[e,e],[s-e,e],[e,s-e],[s-e,s-e],[s/2,s/2],[s/2,e],[s/2,s-e],[e,s/2],[s-e,s/2]])if(!inside(ring,x+dx,z+dz))return false;
  // Do not bridge an indentation that enters a cell between its corners.
  for(let i=0;i<ring.length;i++){const a=ring[i];if(a[0]>x+e&&a[0]<x+s-e&&a[1]>z+e&&a[1]<z+s-e)return false;}
  return true;
}
function manualColumns(p:StateRepresentationProfileV321,step:number):Map<string,Column>{
  const own=new Map<string,Column>();for(const zone of p.site.manualMassing?.zones??[]){
    const xs=zone.ringWorldM.map(q=>q[0]),zs=zone.ringWorldM.map(q=>q[1]);
    for(let x=Math.floor(Math.min(...xs)/step);x*step<Math.max(...xs);x++)for(let z=Math.floor(Math.min(...zs)/step);z*step<Math.max(...zs);z++){
      if(!strictCellInRing(zone.ringWorldM,x*step,z*step,step))continue;
      const key=`${x},${z}`,previous=own.get(key);own.set(key,{lo:Math.min(previous?.lo??zone.bottomYM,zone.bottomYM),hi:Math.max(previous?.hi??zone.topYM,zone.topYM),owners:new Set(p.sourceRecords.map(r=>r.id))});
    }
  }return own;
}
function nativeShell(p:StateRepresentationProfileV321,own:Map<string,Column>,step:number):Box[]{
  const boxes:Box[]=[],color=p.site.id==="bremen"?0xb35a46:0xd4b98f;
  const add=(position:P,size:P,role:string)=>boxes.push({position,size,quaternion:IDENTITY,color,role,run:-1,sourcePartId:p.sourceRecords[0].id});
  for(const[key,col]of own){const[ix,iz]=key.split(",").map(Number),x=(ix+.5)*step,z=(iz+.5)*step;
    add([x,col.hi-.065,z],[step,.13,step],"source-described native manual roof surface");
    for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const neighbor=own.get(`${ix+dx},${iz+dz}`),lo=Math.max(col.lo,neighbor?.hi??col.lo);if(lo>=col.hi-.13)continue;
      add([x+dx*(step/2-.06),(lo+col.hi-.13)/2,z+dz*(step/2-.06)],[dx?.12:step,col.hi-.13-lo,dz?.12:step],"source-described native manual exterior wall");
    }
  }return boxes;
}
type Span={u0:number;u1:number;x0:number;z0:number;axis:"x"|"z";face:number;sign:number;lo:number;hi:number};
function nativeSpans(p:StateRepresentationProfileV321,ff:Frame[],all:Map<string,Column>,step:number):Span[][]{
  return ff.map(f=>{
    const spans:Span[]=[],xNormal=Math.abs(f.nx)>=Math.abs(f.nz),sign=Math.sign(xNormal?f.nx:f.nz),owner=short(f.run.sourcePartId),manual=!!p.site.manualMassing;
    for(const[key,c]of all){if(!manual&&!c.owners.has(owner)||manual&&!c.owners.size)continue;const[ix,iz]=key.split(",").map(Number),x=ix*step,z=iz*step;
      const nx=ix+(xNormal?sign:0),nz=iz+(xNormal?0:sign),neighbor=all.get(`${nx},${nz}`),lo=Math.max(c.lo,neighbor?.hi??c.lo);if(lo>=c.hi)continue;
      const ax=xNormal?x+(sign>0?step:0):x,az=xNormal?z:z+(sign>0?step:0),bx=xNormal?ax:x+step,bz=xNormal?z+step:az;
      const u0=(ax-f.a[0])*f.ux+(az-f.a[1])*f.uz,u1=(bx-f.a[0])*f.ux+(bz-f.a[1])*f.uz,out=((ax+bx)/2-f.a[0])*f.nx+((az+bz)/2-f.a[1])*f.nz;
      if(Math.max(u0,u1)<0||Math.min(u0,u1)>f.length||Math.abs(out)>step*4.2)continue;
      spans.push({u0,u1,x0:ax,z0:az,axis:xNormal?"z":"x",face:xNormal?ax:az,sign,lo,hi:c.hi});
    }return spans;
  });
}
function nativeFittings(ops:Op[],ff:Frame[],spans:Span[][]):Box[]{
  const boxes:Box[]=[];
  const emit=(op:Op,u:number,y:number,w:number,h:number)=>{
    const f=ff[op.run];for(const s of spans[op.run]){
      const a=Math.max(u-w/2,Math.min(s.u0,s.u1)),b=Math.min(u+w/2,Math.max(s.u0,s.u1)),lo=Math.max(y-h/2,s.lo+.01),hi=Math.min(y+h/2,s.hi-.01);if(b-a<.015||hi-lo<.015)continue;
      const dot=s.axis==="x"?f.ux:f.uz;if(Math.abs(dot)<.1)continue;const along=(a+b)/2,world=(s.axis==="x"?s.x0:s.z0)+(along-s.u0)/dot,width=(b-a)/Math.abs(dot),normal=s.face+s.sign*(op.out+.05),position:P=s.axis==="x"?[world,(lo+hi)/2,normal]:[normal,(lo+hi)/2,world],size:P=s.axis==="x"?[width,hi-lo,op.d]:[op.d,hi-lo,width];
      boxes.push({position,size,quaternion:IDENTITY,color:op.color,role:op.role,run:op.run,sourcePartId:f.run.sourcePartId});
    }
  };
  for(const op of ops){if(op.end){const du=op.end[0]-op.u,dy=op.end[1]-op.y,n=Math.max(1,Math.ceil(Math.max(Math.abs(du),Math.abs(dy))/.35));for(let i=0;i<n;i++)emit(op,op.u+du*(i+.5)/n,op.y+dy*(i+.5)/n,Math.max(op.w,Math.abs(du)/n+.02),Math.max(op.w,Math.abs(dy)/n+.02));}else emit(op,op.u,op.y,op.w,op.h);}
  return boxes;
}
/** Uses existing native payload cells; source cells remain untouched. */
export function createNativeStateRepresentationsV321(sourcePrisms:readonly StatePrismV321[],voxels:DeutschesTheaterVoxelPayload,options:Options={}):Group{
  const root=new Group();root.name="Independent cardinal state representations v321";const receipts:Admission[]=[];
  if(!voxels||!finite(voxels.cell_m)||voxels.cell_m<=0||voxels.cell_m>4||!voxels.grid||!finite(voxels.grid.min_x_idx)||!finite(voxels.grid.min_z_idx)){root.userData.admissions=[];return root;}
  const step=voxels.cell_m/2;
  for(const p of STATE_REPRESENTATIONS_V321){
    const admission=admit(p,sourcePrisms);receipts.push(admission);if(!admission.admitted)continue;
    const ff=frames(p),ops=plan(p,ff),all=payloadColumns(p,voxels,step),own=manualColumns(p,step),shell=nativeShell(p,own,step);
    for(const[key,c]of own){const previous=all.get(key);all.set(key,{lo:Math.min(c.lo,previous?.lo??c.lo),hi:Math.max(c.hi,previous?.hi??c.hi),owners:new Set([...c.owners,...previous?.owners??[]])});}
    const spans=nativeSpans(p,ff,all,step),fittings=nativeFittings(ops,ff,spans);
    if(!fittings.length||shell.length>STATE_REPRESENTATIONS_V321_CAPS.nativeShellMembersPerHouse||shell.length+fittings.length>STATE_REPRESENTATIONS_V321_CAPS.nativeMembersPerHouse){admission.admitted=false;admission.reason="missing-or-over-budget-native-front";continue;}
    const group=makeGroup(p,[...shell,...fittings],true,options,admission);group.userData.nativeShellMembers=shell.length;group.userData.nativeFittingMembers=fittings.length;group.userData.nativeStepM=step;
    if(options.diagnostics){group.userData.spans=spans;group.userData.manualColumns=[...own].map(([key,c])=>({key,lo:c.lo,hi:c.hi}));}
    root.add(group);
  }
  root.userData={admissions:receipts,sourceGeometryChanged:false,fullStaticDetailOnTouch:true,blockNative:true,keepInMinecraft:true};return freezeStaticSceneTransforms(root);
}
