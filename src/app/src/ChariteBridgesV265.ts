import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2 } from "three";
import data from "./data/chariteBridgesV265.json";
import retainedNative from "./data/chariteBridgesV265RetainedNative.json";
import { chariteBridgeContainsV265 } from "./ChariteBridgesV265Profile";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Site = (typeof data.sites)[number];
const NATIVE_CELL = .4;
const concrete = 0xb7b6a6, steel = 0x929d9e, dark = 0x514b40, roof = 0x777e79;
type Triangle = { points: number[][]; color: number };

function floorTriangles(site: Site): Triangle[] {
  const vertices=site.ring.map(p=>new Vector2(p[0],p[1]));
  const faces=ShapeUtils.triangulateShape(vertices,[]), triangles: Triangle[]=[];
  for(const y of [site.bottomY,site.bottomY+.22,site.topY-.20,site.topY]) for(const face of faces) {
    triangles.push({points:face.map(i=>[vertices[i].x,y,vertices[i].y]),color:y===site.topY?roof:steel});
  }
  return triangles;
}

function buildSite(site: Site,native: boolean): Group {
  const group=new Group();group.name=site.name;
  const rows:number[][]=[];
  const add=(x:number,y:number,z:number,w:number,h:number,d:number,color:number,angle=0)=>{
    rows.push(native?[x,y,z,w,h,d,color]:[x,y,z,w,h,d,angle,color]);
  };
  const panel=(a:number[],b:number[],u:number,y:number,w:number,h:number,d:number,color:number)=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
    if(!native)add(a[0]+dx*u,y,a[1]+dz*u,w,h,d,color,-Math.atan2(dz,dx));
    else {
      // Independently generated orthogonal strips; no rotated drawn mesh enters native mode.
      const count=Math.max(1,Math.ceil(w/NATIVE_CELL)),step=w/count;
      for(let i=0;i<count;i++) {
        const along=u-w/2+(i+.5)*step;
        add(a[0]+dx*along,y,a[1]+dz*along,Math.abs(dx)*step+Math.abs(dz)*d,h,Math.abs(dz)*step+Math.abs(dx)*d,color);
      }
    }
  };
  if(native) {
    const xs=site.ring.map(p=>p[0]),zs=site.ring.map(p=>p[1]);
    for(let xi=Math.floor(Math.min(...xs)/NATIVE_CELL);xi<=Math.floor(Math.max(...xs)/NATIVE_CELL);xi++) {
      for(let zi=Math.floor(Math.min(...zs)/NATIVE_CELL);zi<=Math.floor(Math.max(...zs)/NATIVE_CELL);zi++) {
        const x=(xi+.5)*NATIVE_CELL,z=(zi+.5)*NATIVE_CELL;
        if(!chariteBridgeContainsV265(site.ring,x,z))continue;
        add(x,site.bottomY+.11,z,NATIVE_CELL,.22,NATIVE_CELL,steel);
        add(x,site.topY-.10,z,NATIVE_CELL,.20,NATIVE_CELL,roof);
      }
    }
  } else {
    const triangles=floorTriangles(site),positions=new Float32Array(triangles.length*9),colors=new Float32Array(positions.length),tint=new Color();
    let offset=0;
    for(const t of triangles){tint.setHex(t.color);for(const p of t.points){positions.set(p,offset);tint.toArray(colors,offset);offset+=3;}}
    const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(positions,3));geometry.setAttribute("color",new BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.85});
    const mesh=new Mesh(geometry,day);mesh.name="Exact source footprint, open bridge floor and roof";
    mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,sourceOwnerIds:[site.id]};group.add(mesh);
  }
  const modern=site.levels===2,pitch=modern?3.9:site.topY-site.bottomY;
  for(let edge=0;edge<site.ring.length;edge++) {
    const a=site.ring[edge],b=site.ring[(edge+1)%site.ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<.6)continue;
    const bays=Math.max(1,Math.round(length/(modern?1.95:1.35))),bay=length/bays;
    for(let level=0;level<site.levels;level++) {
      const low=site.bottomY+level*pitch,base=modern?.32:.88,top=low+pitch-.22;
      panel(a,b,length/2,low+base/2,length,base,.15,modern?steel:concrete);
      for(let i=0;i<bays;i++) {
        const u=(i+.5)*bay;
        panel(a,b,u,(low+base+top)/2,bay-.10,top-low-base,.075,modern?(i%3===1?0x7f9fa4:0x66898e):(i%3===1?0x7e9190:0x59706f));
        panel(a,b,i*bay,(low+base+top)/2,.075,top-low-base,.14,modern?steel:dark);
        // The single-level older passage has narrow upper transoms.
        if(!modern)panel(a,b,u,top-.48,bay,.055,.13,dark);
      }
      panel(a,b,length,(low+base+top)/2,.075,top-low-base,.14,modern?steel:dark);
      panel(a,b,length/2,top+.08,length,.16,.19,modern?steel:dark);
    }
    panel(a,b,length/2,site.topY-.055,length,.11,.26,modern?steel:0x938573);
  }
  if(site.id==="4gyC0jjm")for(const r of data.supports)add(r[0],r[1],r[2],r[3],r[4],r[5],concrete);
  const mesh=justicePalaceV183Boxes(rows,native);mesh.name=`${site.name} ${native?"orthogonal blocks":"glazing, frames and supports"}`;
  Object.assign(mesh.userData,{chariteBridgesV265:true,sourceOwnerIds:[site.id],nativeMinecraft:native});group.add(mesh);
  return group;
}

/** Construct before retiring the three exact prior source prisms/columns.
 * Plan geometry is measured; documented exterior heights are photo estimates.
 * No image, canvas, media, animation, per-frame work or new lights are allocated. */
export function createChariteBridgesV265(native=false): Group {
  const root=new Group();root.name=`Charité documented connecting bridges v265${native?" native":""}`;
  root.userData={chariteBridgesV265:true,requiredBeforeNavigation:true,textureFree:true,
    nativeMinecraft:native,blockNative:native,keepInMinecraft:native,fullStaticDetailOnTouch:true,
    originalSourceSheetsRetained:true,sourceXZPreserved:!native,nativeCellM:native?NATIVE_CELL:undefined,
    sourceReceipt:"charite-bridges-v265-evidence.json",heightStatus:"documented photo estimate; not engineering survey"};
  for(const site of data.sites)root.add(buildSite(site,native));
  if(native){
    // Prior v169 native merging joins bridge and neighbouring facade cells.
    // Republish both unchanged source parts completely, on that same 2m grid,
    // before the exact four-part previous native family is retired.
    const length=retainedNative.triangles.length*9,positions=new Float32Array(length),colors=new Float32Array(length);let offset=0;
    const tint=new Color();
    for(const [points,rgb] of retainedNative.triangles){
      const c=rgb as number[];tint.setRGB(c[0]/255,c[1]/255,c[2]/255);
      for(const p of points as number[][]){positions.set(p,offset);tint.toArray(colors,offset);offset+=3;}
    }
    const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(positions,3));geometry.setAttribute("color",new BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const day=new MeshBasicMaterial({vertexColors:true}),night=new MeshStandardMaterial({vertexColors:true,roughness:.86});
    const mesh=new Mesh(geometry,day);mesh.name="Hufelandweg unchanged neighbouring source parts on original native grid";
    mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,requiredBeforeNavigation:true,nativeMinecraft:true,keepInMinecraft:true,sourceOwnerIds:retainedNative.parts.slice(),sourceEnvelopeRetained:true};root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
