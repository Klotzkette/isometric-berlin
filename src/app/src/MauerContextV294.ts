import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import data from "./data/mauerContextV294.json";
import { GROPIUS_BAU_FACADES, GROPIUS_BAU_PROFILE } from "./gropiusBauProfile";
import { TOPOGRAPHY_TERROR_MUSEUM, TOPOGRAPHY_TERROR_TOP } from "./topographyTerrorProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type P = [number,number,number];
type Row={p:P;s:P;tone:number;yaw:number;role:string;sourceId:string};
export const MAUER_CONTEXT_V294_PROFILE={sourceReceipt:"mauer-context-v294-source.json.gz",sourceGeometryRetained:true,facadeOnly:true,fullStaticDetailOnTouch:true,textureFree:true,independentOrthogonalNative:true,sites:["E-Werk / Deutsche Kinemathek","Mauerstraße Reichspostamt","Detlev-Rohwedder-Haus Niederkirchnerstraße","Gropius Bau","Topographie des Terrors"],estimatePolicy:"Complete retained metric edges/heights. Window/glazing subdivisions, brick/steel details, curved cantilever sections and small fittings are display estimates derived from credited primary photographs. No court/roof/building replacement."}as const;
function inside(r:readonly(readonly number[])[],x:number,z:number):boolean{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}

export function mauerContextGeometryV294(native=false){
  const rows:Row[]=[];let sourceId="";
  const raw=(p:P,s:P,tone:number,role:string,yaw=0)=>rows.push({p,s,tone,role,yaw,sourceId});
  const box=(p:P,s:P,tone:number,role:string,yaw=0)=>{
    if(!native){raw(p,s,tone,role,yaw);return;}
    const c=Math.cos(yaw),sn=-Math.sin(yaw),n=Math.max(1,Math.ceil(s[0]/1.0));
    for(let j=0;j<n;j++){const u=(j+.5)*s[0]/n-s[0]/2;raw([p[0]+c*u,p[1],p[2]+sn*u],[Math.abs(c)*s[0]/n+Math.abs(sn)*s[2],s[1],Math.abs(sn)*s[0]/n+Math.abs(c)*s[2]],tone,role);}
  };
  const axis=(a:readonly number[],b:readonly number[])=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;return{len,yaw:-Math.atan2(dz,dx),at:(u:number,y:number,v=0):P=>[a[0]+dx*u-dz*v,y,a[1]+dz*u+dx*v]};};
  const nativeStandOff=native?2.6:.26;
  for(const building of data.buildings){
    const all=building.originalPrisms;
    for(const p of all){
      sourceId=p.id;const ring=p.ring.map(([x,z])=>[x/10,z/10]),base=p.y0_dm/10,top=(p.y0_dm+p.h_dm)/10;
      const area=ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-b[0]*a[1];},0),out=area>0?-1:1;
      const exposed=(x:number,y:number,z:number)=>!all.some(q=>q.id!==p.id&&q.y0_dm/10<y&&(q.y0_dm+q.h_dm)/10>y&&inside(q.ring.map(([a,b])=>[a/10,b/10]),x,z));
      // Reference-only present-operator photograph: three successively
      // projecting upper bands; exposed steel and Prüss brick infill.
      if(p.id==="iCggg7S6"){
        const arc=ring.slice(1,12);
        for(let j=1;j<arc.length;j++){
          const f=axis(arc[j-1],arc[j]);
          for(const[y,h,extra]of[[8.0,3.4,0],[12.1,3.4,0],[16.2,3.4,.16],[20.2,3.2,.46],[24.1,3.4,.80]]as const){
            const v=out*(nativeStandOff+extra),at=(u:number,yy:number)=>f.at(u,yy,v);
            box(at(f.len/2,y),[f.len+.03,h,.10],0x955b43,"ewerk-quartered-control-brick-infill",f.yaw);
            box(at(f.len/2,y+.83),[f.len-.18,1.15,.13],0x526260,"ewerk-quarter-control-strip-window",f.yaw);
            box(at(f.len/2,y-h/2+.12),[f.len+.12,.20,.25],0x4a514c,extra>0?"ewerk-three-stepped-steel-cantilever":"ewerk-control-lower-steel-floor-band",f.yaw);
            box(at(.05,y),[.13,h,.22],0x48514c,"ewerk-exposed-steel-vertical",f.yaw);
            box(at(f.len/2,y+.83),[.09,1.15,.18],0x8c998f,"ewerk-control-window-division",f.yaw);
          }
        }
        continue;
      }
      const ewerk=building.key==="48118905",finance=building.key==="relation/280070",post=building.key==="relation/318560";
      for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length],f=axis(a,b);
        if(f.len<5||top-base<12)continue;
        const check=f.at(f.len/2,base+8,out*.35);
        if(!exposed(...check))continue;
        // Only the actual public Niederkirchner wall; courtyard wings remain.
        if(finance&&(a[1]+b[1])/2<1260)continue;
        if(post&&Math.max(a[0],b[0])<1030)continue;
        const v=out*nativeStandOff;
        if(ewerk){
          const low=base+(native?3.0:0);
          box(f.at(f.len/2,(low+top-1)/2,v),[f.len-.06,top-low-1,.10],0x945b45,"ewerk-retained-source-red-clinker-field",f.yaw);
          for(let y=base+2.5;y<top-1;y+=3.4){
            const tall=top-base<24,h=tall?Math.min(6,top-base-6):1.50;
            if(tall&&y>base+3)continue;
            for(let u=1.5;u<f.len-1;u+=3.4){
              box(f.at(u,y+(tall?2.3:0),v+out*.10),[1.32,h,.13],0x4e605e,tall?"ewerk-tall-industrial-hall-window":"ewerk-nine-storey-small-square-window",f.yaw);
              box(f.at(u,y+(tall?2.3:0),v+out*.18),[.09,h,.16],0xa0a89a,"ewerk-industrial-glazing-steel-mullion",f.yaw);
              if(tall)for(const dy of[-1.8,0,1.8])box(f.at(u,y+2.3+dy,v+out*.18),[1.32,.09,.16],0x919b90,"ewerk-hall-horizontal-glazing-division",f.yaw);
            }
          }
          box(f.at(f.len/2,top-1.0,v+out*.13),[f.len,.22,.30],0x5a5145,"ewerk-source-cornice-steel-cap",f.yaw);
        }
        if(finance){
          for(let y=base+4.0;y<Math.min(top-1,base+27);y+=3.6)for(let u=1.8;u<f.len-1.3;u+=3.2){
            box(f.at(u,y,v),[1.15,2.20,.12],0x506364,"rohwedder-niederkirchner-tall-window",f.yaw);
            box(f.at(u-.72,y,v+out*.05),[.16,2.65,.24],0xc1bdab,"rohwedder-limestone-vertical-window-jamb",f.yaw);
            box(f.at(u,y-1.25,v+out*.08),[1.55,.17,.30],0xcac5b3,"rohwedder-seven-storey-limestone-sill",f.yaw);
          }
          box(f.at(f.len/2,Math.min(top-.8,base+26),v),[f.len,.25,.42],0xc7c3b3,"rohwedder-retained-wing-limestone-cornice",f.yaw);
        }
        if(post){
          box(f.at(f.len/2,Math.min(top-1,base+19.5),v),[f.len,.28,.35],0xc3b69c,"reichspost-source-curved-stone-entablature",f.yaw);
          for(let u=1.6;u<f.len-1;u+=4.1){
            box(f.at(u,base+8.1,v),[.34,10.0,.27],0xb9aa8c,"reichspost-mauerstrasse-rusticated-pier",f.yaw);
            box(f.at(u,base+13.25,v+out*.08),[.75,.28,.34],0xcabd9f,"reichspost-baroque-pier-capital",f.yaw);
          }
        }
      }
    }
  }
  sourceId="RQLhhnrF";
  for(const facade of GROPIUS_BAU_FACADES){const f=axis(facade.start,facade.end);for(let j=0;j<facade.bays;j++){
    const u=(j+.5)*f.len/facade.bays;
    box(f.at(u,GROPIUS_BAU_PROFILE.groundYM+28.5,-(native?3.25:.78)),[.30,.28,.22],0xd2bb84,"gropius-terracotta-cornice-connection",f.yaw);
  }}
  sourceId=TOPOGRAPHY_TERROR_MUSEUM.id;
  const tr=TOPOGRAPHY_TERROR_MUSEUM.ring.map(([x,z])=>[x/10,z/10]);
  for(let i=0;i<tr.length;i++){const f=axis(tr[i],tr[(i+1)%tr.length]);if(f.len<20)continue;for(let u=3;u<f.len-2;u+=7.5)box(f.at(u,TOPOGRAPHY_TERROR_TOP-.24,-(native?1.5:.25)),[.16,.28,.24],0x6d7b78,"topography-screen-cornice-clamp",f.yaw);}
  const roles:Record<string,number>={};for(const r of rows)roles[r.role]=(roles[r.role]??0)+1;
  return{rows,roles};
}

export function createMauerContextV294(native=false,options:{mobileLike?:boolean}={}):Group{
  const root=new Group(),model=mauerContextGeometryV294(native),g=new BoxGeometry(1,1,1);g.deleteAttribute("uv");
  const day=new MeshBasicMaterial(),night=new MeshStandardMaterial({roughness:.90});
  const m=new InstancedMesh(g,day,0),matrices=new Float32Array(model.rows.length*16),colors=new Float32Array(model.rows.length*3),matrix=new Matrix4(),q=new Quaternion(),v=new Vector3(),s=new Vector3(),tint=new Color(),axis=new Vector3(0,1,0);
  model.rows.forEach((r,i)=>{matrix.compose(v.fromArray(r.p),q.setFromAxisAngle(axis,r.yaw),s.fromArray(r.s)).toArray(matrices,i*16);tint.setHex(r.tone).toArray(colors,i*3);});
  m.count=model.rows.length;m.instanceMatrix=new InstancedBufferAttribute(matrices,16);m.instanceColor=new InstancedBufferAttribute(colors,3);m.computeBoundingBox();m.computeBoundingSphere();m.userData={dayMaterial:day,nightMaterial:night,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};root.add(m);
  root.name="Mauerstraße and Niederkirchnerstraße retained-source context v294";root.userData={...MAUER_CONTEXT_V294_PROFILE,mauerContextV294:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,instances:m.count,roles:model.roles};
  void options;return freezeStaticSceneTransforms(root);
}
