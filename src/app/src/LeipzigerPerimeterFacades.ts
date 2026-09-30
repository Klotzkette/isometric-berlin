import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { LEIPZIGER_PERIMETER_PARTS, LEIPZIGER_PERIMETER_RUNS, perimeterExposed, perimeterPoint, type PerimeterRun } from "./leipzigerPerimeterProfile";
export const LEIPZIGER_PERIMETER_GROUP = "Source-bound Leipziger Platz perimeter facades";
const C={ glass:0x667779, darkGlass:0x425456, frame:0x848479, pale:0xd3d0c3, stone:0xc7bea7, limestone:0xd7d2bf, bronze:0x897957, joint:0x969384, mosse:0xc8b68e, shadow:0x7f8179 };
class Batch {
  matrices:number[]=[];colors:number[]=[];counts:Record<string,number>={};private matrix=new Matrix4();private q=new Quaternion();private p=new Vector3();private s=new Vector3();private c=new Color();
  constructor(readonly minecraft:boolean){}
  face(r:PerimeterRun,u:number,y:number,w:number,h:number,color:number,out=.22,d=.16):void{
    if(w<=0||h<=0)return;
    const p=perimeterPoint(r,u,out+(this.minecraft?1.85:0));
    // Block-native relief stays chunky without replacing the official voxel body.
    if(this.minecraft){d=Math.max(.28,d);h=Math.max(.18,h);w=Math.max(.18,w);}
    this.p.set(p[0],y,p[1]);this.s.set(w,h,d);this.q.setFromAxisAngle(new Vector3(0,1,0),-Math.atan2(r.b[1]-r.a[1],r.b[0]-r.a[0]));
    this.matrix.compose(this.p,this.q,this.s);this.matrices.push(...this.matrix.elements);this.c.setHex(color).toArray(this.colors,this.colors.length);this.counts[r.key]=(this.counts[r.key]??0)+1;
  }
  finish():Group{
    const root=new Group();root.name=this.minecraft?"Block-native Leipziger Platz perimeter facades":LEIPZIGER_PERIMETER_GROUP;
    const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.88,flatShading:true});
    const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");const mesh=new InstancedMesh(geometry,day,0);
    mesh.instanceMatrix=new InstancedBufferAttribute(new Float32Array(this.matrices),16);mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(this.colors),3);mesh.count=this.colors.length/3;
    mesh.name=root.name+" stone, glazing and frames";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:this.minecraft};mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
    root.userData={textureFree:true,blockNative:this.minecraft,keepInMinecraft:this.minecraft,nativeMinecraft:this.minecraft,facadeOnly:true,noHiddenSolidInfill:true,profileInstances:this.counts,sourcePartIds:LEIPZIGER_PERIMETER_PARTS.map(p=>p.part.id),sourceWallRuns:LEIPZIGER_PERIMETER_RUNS.length};
    return freezeStaticSceneTransforms(root);
  }
}
function style(r:PerimeterRun,u:number){
  const p=perimeterPoint(r,u,0);
  if(r.key==="southWest")return p[0]>416?"kontor":p[0]<386?"torhaus":"stadtpalais";
  return r.key;
}
function window(b:Batch,r:PerimeterRun,u:number,y:number,pitch:number,h:number):void{
  const s=style(r,u),upper=y>r.ground+24;
  let w=Math.min(pitch*.63,2.2),stone=C.pale,glass=C.glass,depth=.22;
  if(s==="mosse"){w=pitch*.82;stone=C.mosse;glass=0x68766e;}
  if(s==="torhaus"){w=pitch*.64;stone=C.limestone;}
  if(s==="stadtpalais"){w=pitch*.75;stone=C.limestone;depth=.31;}
  if(s==="kontor"){w=pitch*.92;stone=C.bronze;glass=0x344340;}
  if(s==="west"){w=pitch*.68;stone=0xb8b9af;depth=.35;}
  if(s==="southMiddleEast"){stone=0xcec1a6;glass=0x6c7a75;}
  if(s==="southEast"){w=pitch*.9;stone=C.bronze;glass=0x697d79;}
  if(s==="eastChamfer"){w=pitch*.73;stone=0xc9c8bb;depth=.44;}
  if(s==="east"){w=pitch*(upper?.54:.79);stone=0xd2cfbe;}
  b.face(r,u,y,w+.18,h+.16,C.shadow,depth,.13);b.face(r,u,y,w,h,glass,depth+.09,.11);
  for(const sign of[-1,1])b.face(r,u+sign*(w/2+.10),y,.15,h+.3,stone,depth+.15,.30);
  for(const sign of[-1,1])b.face(r,u,y+sign*(h/2+.11),w+.32,.17,stone,depth+.16,.33);
  if(w>1.8)b.face(r,u,y,.085,h,C.frame,depth+.21,.12);
  if(s==="mosse"||s==="stadtpalais"||s==="eastChamfer")b.face(r,u,y-h*.18,w,.085,C.frame,depth+.21,.1);
  if(s==="southEast")for(const fraction of[-.34,-.17,0,.17,.34])b.face(r,u,y+h*fraction,w+.2,.10,C.bronze,depth+.28,.29);
  if(s==="torhaus"||s==="west")b.face(r,u-pitch/2+.1,y,.26,h+1.2,stone,depth+.25,.55);
  if(s==="stadtpalais"){
    // Wide, recessed-looking limestone reveals, not an invented full wall.
    b.face(r,u,y-h/2-.23,w+.55,.21,C.limestone,.53,.62);
  }
}
export function createLeipzigerPerimeterFacades(minecraft=false):Group{
  const b=new Batch(minecraft);
  for(const r of LEIPZIGER_PERIMETER_RUNS){
    const middle=style(r,r.length/2),bayTarget=middle==="kontor"?6:middle==="west"?4.25:middle==="southEast"?4.1:middle==="stadtpalais"?4.2:3.25;
    const bays=Math.max(1,Math.round(r.length/bayTarget)),pitch=r.length/bays;
    // Common per-building floor datum avoids resetting rhythms at source seams.
    for(let floor=0;floor<12;floor++){
      const floorPitch=r.key==="southMiddleWestUpperFront"?3.2:3.35;
      const y=r.ground+2.5+floor*floorPitch,h=floor===0?3.55:2.24;
      if(y-h/2<r.bottom+.16||y+h/2>r.top-.3)continue;
      for(let i=0;i<bays;i++){
        const u=(i+.5)*pitch;if(!perimeterExposed(r,u,y))continue;
        window(b,r,u,y,pitch,h);
        if(floor===0&&pitch>2.3){b.face(r,u,y-1.05,.09,1.25,C.bronze,.49,.12);b.face(r,u+.22,y-1.05,.055,.48,C.bronze,.57,.1);}
      }
      // Horizontal joints stop at each exact source edge and never bridge gaps.
      const bandY=y+h/2+.41;
      if(bandY<r.top-.15&&perimeterExposed(r,r.length/2,bandY))b.face(r,r.length/2,bandY,r.length,.13,middle==="mosse"?C.mosse:middle==="kontor"?C.bronze:C.stone,.32,.27);
    }
    if(r.key==="mosse"&&r.top>35&&r.length>2&&perimeterExposed(r,r.length/2,r.top-1.0)){
      // Thin upright roof-bay seams; the surveyed curved roof itself is untouched.
      for(let i=0;i<=bays;i++)b.face(r,Math.min(r.length-.1,Math.max(.1,i*pitch)),r.top-1.55,.11,2.1,0x777e73,.25,.19);
    }
  }
  return b.finish();
}
