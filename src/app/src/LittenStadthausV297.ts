import {BoxGeometry,Color,Group,InstancedBufferAttribute,InstancedMesh,Matrix4,MeshBasicMaterial,MeshStandardMaterial,Vector3} from "three";
import data from "./data/littenStadthausV297.json";
import {letteringStrokePaths} from "./drawnLettering";
import {freezeStaticSceneTransforms} from "./staticSceneTransforms";
import {LITTEN_STADTHAUS_V297_PROFILE} from "./LittenStadthausV297Profile";

type P=[number,number,number];
export type LittenStadthausRowV297={p:P;s:P;yaw:number;tone:number;role:string;sourceId:string;normal:[number,number]};
type Face={key:string;owner:string;part:string;index:number;a:number[];b:number[];normal:number[];bottom:number;top:number;windows:number[][]};
const STONE=0xc5baa4,TRIM=0xd8ceb8,IRON=0x3f4744;

/** Small source-plane fittings only. Native rows have their own delivered-face receipts. */
export function littenStadthausGeometryV297(native=false):{rows:LittenStadthausRowV297[];roles:Record<string,number>} {
  const rows:LittenStadthausRowV297[]=native?(data.nativeRows as unknown as LittenStadthausRowV297[]).map((r):LittenStadthausRowV297=>({...r,p:[...r.p],s:[...r.s],normal:[...r.normal]})):[];
  let owner="",normal:[number,number]=[0,1];
  const box=(p:P,s:P,tone:number,role:string,yaw=0):void=>{rows.push({p,s,tone,role,yaw,sourceId:owner,normal:[...normal]});};
  const stroke=(a:P,b:P,size:number,tone:number,role:string):void=>{
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz),n=Math.max(1,Math.ceil(length/.20));
    for(let j=0;j<n;j++){const t=(j+.5)/n;box([a[0]+dx*t,a[1]+dy*t,a[2]+dz*t],[Math.abs(dx)/n+size,Math.abs(dy)/n+size,Math.abs(dz)/n+size],tone,role);}
  };
  const facade=(face:Face)=>{
    owner=face.owner;normal=[face.normal[0],face.normal[1]];
    const dx=face.b[0]-face.a[0],dz=face.b[1]-face.a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,yaw=-Math.atan2(uz,ux);
    const at=(u:number,y:number,out=.32):P=>[face.a[0]+ux*u+normal[0]*out,y,face.a[1]+uz*u+normal[1]*out];
    const member=(u:number,y:number,w:number,h:number,tone:number,role:string,depth=.09,out=.32):void=>box(at(u,y,out),[w,h,depth],tone,role,yaw);
    const text=(value:string,u:number,y:number,h:number,tone:number,role:string,out=.45):void=>{
      for(const path of letteringStrokePaths(value,h))for(let j=1;j<path.length;j++){
        const a=path[j-1],b=path[j];
        // Local stroke rectangles follow the same facade normal for native fitting.
        const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.07));
        for(let k=0;k<n;k++){const t=(k+.5)/n;member(u+a[0]+(b[0]-a[0])*t,y+a[1]+(b[1]-a[1])*t,.035,.055,tone,role,.045,out);}
      }
    };
    const arc=(u:number,y:number,w:number,rise:number,tone:number,role:string,out=.42):void=>{
      for(let j=0;j<22;j++){const a=j*Math.PI/22,b=(j+1)*Math.PI/22;member(u+(Math.cos(a)+Math.cos(b))*w/4,y+(Math.sin(a)+Math.sin(b))*rise/2,Math.abs(Math.cos(b)-Math.cos(a))*w/2+.07,Math.abs(Math.sin(b)-Math.sin(a))*rise+.07,tone,role,.10,out);}
    };
    return{length,at,member,text,arc,local:(x:number,z:number)=>(x-face.a[0])*ux+(z-face.a[1])*uz};
  };
  if(!native)for(const face of data.faces as Face[]){
    const f=facade(face),key=face.key;
    if(key==="podewil"&&face.index===33)continue; // Complete corrected front belongs to its guarded packet transfer.
    if(key.startsWith("instanz")){
      // The three separate source houses keep their original roofs and all v257 windows.
      if(face.normal[0]<-.9){
        for(const y of[3.30,6.12,face.top-.35])f.member(f.length/2,y,f.length-.12,.045,0xd8cfbb,"instanz-fine-plaster-profile",.13,.62);
        const columns=key==="instanz-centre"?4:2;
        for(let j=0;j<columns;j++){
          const u=f.length*(j+.5)/columns;
          for(const side of[-1,1]){
            const offset=key==="instanz-centre"?1.0:1.15;
            for(const y of[3.95,5.22])f.member(u+side*offset,y,.10,.13,IRON,"instanz-visible-shutter-hinge",.06,.61);
          }
          if(key==="instanz-centre")for(const y of[7.65,10.65]){
            f.member(u,y+.37,1.26,.045,0xe5dcc8,"instanz-upper-window-crossbar",.055,.64);
            f.member(u,y-1.05,1.65,.08,0xd8cfbb,"instanz-upper-window-sill",.20,.65);
            f.member(u,y+1.13,1.65,.07,0xd8cfbb,"instanz-window-lintel-cap",.17,.61);
          }
        }
        for(const u of[.12,f.length-.12])f.member(u,(3.4+face.top-.4)/2,.08,face.top-3.8,0x989b8c,"instanz-downpipe",.12,.65);
      }
      if(key==="instanz-north"&&face.index===1){
        // Current operator exterior: the north return bears a vertically stacked name.
        f.text("ZUR",f.length*.52,10.95,.40,0x354436,"instanz-north-return-name");
        f.text("LETZTEN",f.length*.52,9.95,.40,0x354436,"instanz-north-return-name");
        f.text("INSTANZ",f.length*.52,8.95,.40,0x354436,"instanz-north-return-name");
        f.member(f.length*.82,11.0,.04,.86,IRON,"instanz-justice-scales",.06,.5);
        f.member(f.length*.82,11.25,.66,.05,IRON,"instanz-justice-scales",.06,.5);
        for(const side of[-1,1]){f.member(f.length*.82+side*.25,11.05,.025,.35,IRON,"instanz-justice-scales",.05,.5);f.member(f.length*.82+side*.25,10.85,.25,.045,IRON,"instanz-justice-scales",.06,.5);}
        for(const u of[f.length*.26,f.length*.75])for(let j=-2;j<=2;j++){
          f.member(u+j*.16,4.55,.025,2.15,IRON,"instanz-return-window-iron-grille",.06,.51);
          if(j<2)f.member(u,4.0+j*.22,.72,.025,IRON,"instanz-return-window-iron-grille",.06,.51);
        }
      }
      continue;
    }
    if(key==="muenze-front"){
      if(face.index===20||face.index===25){
        const band=Math.min(18.4,f.length-.9),mid=face.index===20?band/2:f.length-band/2;
        // Small independent arm/tool and robe incisions refine the already
        // retained abstract procession, without tracing Schadow's relief.
        for(let j=0;j<18;j++){
          const u=mid-band/2+.5+j*(band-1)/17;
          f.member(u+.18,14.98,.32,.065,0x9f947d,"muenze-frieze-craft-gesture",.06,.65);
          f.member(u-.12,14.68,.04,.28,0x9f947d,"muenze-frieze-robe-incision",.05,.64);
          if(j%3===0)f.member(u+.32,14.78,.055,.45,0xb7aa8b,"muenze-frieze-tool-cue",.07,.64);
        }
        for(let j=0;j<7;j++){
          const u=f.length*(j+.5)/7;
          for(const y of[10.60,18.50])for(const side of[-1,1])f.member(u+side*.35,y,.045,2.80,0xe1dac6,"muenze-front-four-leaf-tall-frame",.05,.63);
        }
      }
      if(face.index===7){
        for(const side of[-1,1])for(let y=3.4;y<13.2;y+=.75)f.member(f.length/2+side*2.05,y,.71,.035,0x928b79,"muenze-double-height-pier-joint",.06,.96);
      }
      if(face.index===33)for(const u of[f.length/6,f.length*5/6]){
        for(let j=-5;j<=5;j++)f.member(u+j*.20,11.03,.045,.70,0x8c8069,"palais-schwerin-balcony-relief-baluster",.06,1.22);
      }
      continue;
    }
    // Keep the exact earlier pane centres rather than laying a second window grid.
    for(const r of face.windows){
      const u=f.local(r[0],r[2]),y=r[1],w=r[3],h=r[4];
      if(u<w/2+.12||u>f.length-w/2-.12)continue;
      if(key==="stadthaus"){
        f.member(u,y+h*.20,w,.055,0xb7b6a5,"stadthaus-existing-window-transom",.055,.26);
        for(const side of[-1,1])f.member(u+side*w*.24,y,.045,h-.08,0xb7b6a5,"stadthaus-existing-four-light-window",.055,.26);
        // v239 already retains the complete western surrounds. Add the missing east/north/south profile only.
        if(r[0]>2689){
          f.member(u,y-h/2-.13,w+.45,.14,TRIM,"stadthaus-retained-east-window-sill",.24,.35);
          f.member(u,y+h/2+.12,w+.33,.11,STONE,"stadthaus-retained-east-window-lintel",.15,.29);
        }
      }else{
        const tone=key==="muenze-court"?0x94998c:0xe0d7c2;
        f.member(u,y+h*.17,w,.045,tone,`${key}-existing-window-crossbar`,.06,.20);
        if(key==="muenze-court")for(const side of[-1,1])f.member(u+side*w*.25,y,.045,h-.06,tone,`${key}-existing-four-leaf-window`,.06,.20);
        if(key==="verwaltung-c"&&face.normal[1]>.6){
          f.member(u,y+h/2+.13,w+.28,.14,0x8d9188,"verwaltung-c-current-south-shade-box",.18,.32);
        }
        if(key==="muenze-court"&&y<7)for(let k=-2;k<=2;k++)f.member(u+k*w/5,y,.035,h,IRON,"muenze-court-industrial-security-bar",.07,.29);
      }
    }
    if(key==="stadthaus"){
      // Rusticated basement bands and capped cornice follow complete existing outer edges.
      for(const y of[3.8,4.6,5.4,6.2,7.0,7.8])f.member(f.length/2,y,f.length-.06,.045,0x928e7e,"stadthaus-source-edge-rustication",.075,.20);
      for(const[y,h,out]of[[8.8,.16,.28],[25.7,.16,.30],[28.9,.25,.42]] as const)if(y<face.top)f.member(f.length/2,y,f.length-.04,h,TRIM,"stadthaus-retained-edge-profile",.20,out);
      if(face.normal[0]>.8&&f.length>14){
        // Reference-supported Klosterstraße return: narrow double piers and baluster reliefs.
        for(const u of[1.3,f.length-1.3]){f.member(u,16.0,.40,13.5,STONE,"stadthaus-klosterstrasse-double-pier",.24,.43);f.member(u+.55,16.0,.27,13.5,TRIM,"stadthaus-klosterstrasse-double-pier",.22,.42);}
        for(let u=2.6;u<f.length-2.3;u+=3.4){f.member(u,9.45,1.4,.12,STONE,"stadthaus-baluster-lower-rail",.18,.36);f.member(u,10.25,1.4,.11,STONE,"stadthaus-baluster-upper-rail",.18,.36);for(let i=-2;i<=2;i++)f.member(u+i*.24,9.85,.10,.62,TRIM,"stadthaus-stone-baluster",.16,.36);}
      }
    }
    if(key==="neues-stadthaus"){
      if(f.length>7&&face.top-face.bottom>12){
        f.member(f.length/2,face.bottom+1.05,f.length-.1,.16,STONE,"neues-stadthaus-granite-base-course",.18,.24);
        f.member(f.length/2,Math.min(face.top-.5,25.0),f.length-.1,.15,0xbfb8a5,"neues-stadthaus-restrained-eave",.22,.24);
      }
    }
    if(key==="verwaltung-c"&&face.normal[1]<-.5&&f.length>12){
      f.member(f.length/2,7.6,f.length-.1,.12,0xa5a18f,"verwaltung-c-retained-ground-cornice",.22,.25);
    }
    if(key==="muenze-court"&&f.length>5){
      for(const y of[face.bottom+.45,Math.min(face.top-.30,face.bottom+8.6)])f.member(f.length/2,y,f.length-.12,.12,0xb5ae99,"muenze-court-retained-stone-band",.19,.26);
      for(const u of[.20,f.length-.20])f.member(u,(face.bottom+face.top)/2,.08,face.top-face.bottom-.2,0x7d8278,"muenze-court-downpipe",.12,.3);
    }

  }

  // Additional iron balustrades, stone urns and small joint accents on the
  // retained v239 80 m tower. Its two closed drums, roof and Fortuna are untouched.
  owner="DEBE01YYK00005yc";
  for(const[level,radius]of[[40.6,10.4],[57.1,10.2],[73.1,8.0]]as const){
    const steps=native?64:48;
    for(let i=0;i<steps;i++){
      const a=i*Math.PI*2/steps,b=(i+1)*Math.PI*2/steps;
      const point=(q:number,y:number):P=>[2676+Math.cos(q)*radius,y,317.5+Math.sin(q)*radius];
      normal=[Math.cos(a),Math.sin(a)];
      if(native){
        for(const y of[level+.20,level+1.05])stroke(point(a,y),point(b,y),.065,IRON,"stadthaus-tower-cardinal-balcony-rail");
        box(point(a,level+.62),[.08,.9,.08],IRON,"stadthaus-tower-cardinal-baluster");
      }else{
        for(const y of[level+.20,level+1.05]){
          const p=point(a,y),q=point(b,y),dx=q[0]-p[0],dz=q[2]-p[2];
          box([(p[0]+q[0])/2,y,(p[2]+q[2])/2],[Math.hypot(dx,dz)+.015,.045,.045],IRON,"stadthaus-tower-balcony-rail",-Math.atan2(dz,dx));
        }
        box(point(a,level+.62),[.045,.9,.045],IRON,"stadthaus-tower-baluster");
      }
    }
  }
  const roles:Record<string,number>={};for(const row of rows)roles[row.role]=(roles[row.role]??0)+1;
  return{rows,roles};
}

/** Complete seven-axis/three-storey main front. Only the exact old estimated
 * fittings yield in the packet decoder; the original source wall remains.
 * Native uses separately fitted cardinal rows frozen by the offline builder. */
export function podewilFacadeRowsV297():LittenStadthausRowV297[]{
  const face=(data.faces as Face[]).find(f=>f.owner==="DEBE01YYK00002Vr"&&f.index===33);
  if(!face)throw Error("The exact retained Podewil principal front is missing");
  const rows:LittenStadthausRowV297[]=[],dx=face.b[0]-face.a[0],dz=face.b[1]-face.a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length,normal:[number,number]=[face.normal[0],face.normal[1]],yaw=-Math.atan2(uz,ux);
  const box=(u:number,y:number,w:number,h:number,tone:number,role:string,depth=.10,out=.25):void=>{rows.push({p:[face.a[0]+ux*u+normal[0]*out,y,face.a[1]+uz*u+normal[1]*out],s:[w,h,depth],tone,role,yaw,sourceId:face.owner,normal});};
  for(let j=0;j<7;j++)for(let level=0;level<3;level++){
    const u=length*(j+.5)/7,y=[8.4,13.8,19.2][level],h=2.70,w=1.30,role=`podewil-seven-by-three-window-${j}-${level}`;
    box(u,y,w+.28,h+.28,0xd9cdb4,role+"-reveal",.09,.16);
    box(u,y,w,h,0x4d666b,role+"-glazing",.055,.24);
    for(const side of[-1,0,1])box(u+side*w/2,y,.065,h,0xeee7d6,role+"-vertical-frame",.055,.30);
    for(const yy of[-h/2,h*.18,h/2])box(u,y+yy,w,.065,0xeee7d6,role+"-transom",.055,.30);
    box(u,y-h/2-.16,w+.40,.13,TRIM,role+"-sill",.22,.32);
  }
  const u=length*.5;
  for(const side of[-1,1])for(const extra of[0,.5]){
    box(u+side*(2.8+extra),16.25,.30,9.8,TRIM,"podewil-paired-giant-pilaster",.24,.31);
    box(u+side*(2.8+extra),21.25,.70,.28,STONE,"podewil-ionic-capital",.30,.40);
  }
  for(const y of[5.7,11.5,17.0,22.85])box(length/2,y,length-.12,.15,TRIM,"podewil-three-storey-cornice",.22,.26);
  box(u,11.6,4.25,.24,STONE,"podewil-principal-balcony-slab",.95,.58);
  for(const y of[11.84,12.58])box(u,y,4.05,.10,TRIM,"podewil-principal-balcony-rail",.16,.97);
  for(let i=-6;i<=6;i++)box(u+i*.29,12.2,.10,.65,TRIM,"podewil-principal-balcony-baluster",.14,.97);
  box(u,7.2,1.75,3.4,0x3f4139,"podewil-original-solid-portal-reading",.055,.26);
  for(let j=0;j<22;j++){const a=j*Math.PI/22,b=(j+1)*Math.PI/22;box(u+(Math.cos(a)+Math.cos(b))*.65,8.85+(Math.sin(a)+Math.sin(b))*.57,Math.abs(Math.cos(b)-Math.cos(a))*1.3+.08,Math.abs(Math.sin(b)-Math.sin(a))*1.14+.08,STONE,"podewil-principal-arched-surround",.12,.38);}
  return rows;
}

type CompleteProofV297={mesh:InstancedMesh;geometry:BoxGeometry;day:MeshBasicMaterial;night:MeshStandardMaterial;native:boolean;count:number};
const completeRootsV297=new WeakMap<Group,CompleteProofV297>();

/** Validate private provenance, live batch identity and actual completed buffers. */
export function hasCompleteLittenStadthausV297(root:Group):boolean{
  const proof=completeRootsV297.get(root);
  if(!proof||root.children.length!==1||root.children[0]!==proof.mesh||proof.mesh.parent!==root)return false;
  const mesh=proof.mesh;
  return root.userData.littenStadthausV297Complete===true&&root.userData.blockNative===proof.native&&mesh.geometry===proof.geometry&&mesh.userData.dayMaterial===proof.day&&mesh.userData.nightMaterial===proof.night&&mesh.count===proof.count&&mesh.instanceMatrix.count===proof.count&&mesh.instanceColor?.count===proof.count&&mesh.instanceMatrix.array.byteLength===proof.count*64&&mesh.instanceColor.array.byteLength===proof.count*12&&proof.geometry.getAttribute("position").count===24&&!proof.geometry.getAttribute("uv");
}

/** One texture-free, complete static batch in each independent presentation. */
export function createLittenStadthausV297(native=false,options:{mobileLike?:boolean}={}):Group {
  const root=new Group(),plan=littenStadthausGeometryV297(native);
  let geometry:BoxGeometry|undefined,day:MeshBasicMaterial|undefined,night:MeshStandardMaterial|undefined,completed=false;
  try{
    geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
    day=new MeshBasicMaterial({color:0xffffff});night=new MeshStandardMaterial({color:0xffffff,roughness:.9});
    const mesh=new InstancedMesh(geometry,day,0),matrix=new Matrix4(),scale=new Vector3(),tint=new Color();
    const matrices=new Float32Array(plan.rows.length*16),colours=new Float32Array(plan.rows.length*3);
    plan.rows.forEach((r,i)=>{matrix.makeRotationY(r.yaw).scale(scale.fromArray(r.s));matrix.setPosition(...r.p);matrix.toArray(matrices,i*16);tint.setHex(r.tone).toArray(colours,i*3);});
    mesh.count=plan.rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colours,3);mesh.computeBoundingBox();mesh.computeBoundingSphere();
    mesh.name="Retained Litten and Stadthaus exterior profiles, Instanz name and Münze court fittings";
    mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};root.add(mesh);
    root.name=`Littenstraße, Stadthaus and Alte Münze v297${native?" independent native":""}`;
    root.userData={...LITTEN_STADTHAUS_V297_PROFILE,littenStadthausV297:true,requiredBeforeNavigation:true,instanceCount:mesh.count,roles:plan.roles,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};
    freezeStaticSceneTransforms(root);
    completeRootsV297.set(root,{mesh,geometry,day,night,native,count:mesh.count});
    root.userData.littenStadthausV297Complete=true;
    completed=true;void options;return root;
  }finally{
    if(!completed){completeRootsV297.delete(root);root.clear();geometry?.dispose();day?.dispose();night?.dispose();}
  }
}
