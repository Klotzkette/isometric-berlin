import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { isTorhausPhotoWall, LEIPZIGER_PERIMETER_PARTS, LEIPZIGER_PERIMETER_RUNS, perimeterExposed, perimeterPoint, type PerimeterRun } from "./leipzigerPerimeterProfile";
export const LEIPZIGER_PERIMETER_GROUP = "Source-bound Leipziger Platz perimeter facades";
const C={ glass:0x667779, darkGlass:0x425456, frame:0x848479, pale:0xd3d0c3, stone:0xc7bea7, limestone:0xd7d2bf, bronze:0x897957, joint:0x969384, mosse:0xc8b68e, shadow:0x7f8179 };
class Batch {
  matrices:number[]=[];colors:number[]=[];counts:Record<string,number>={};photoWallInstances:{partId:string;wallIndex:number;start:number;count:number;kind:string}[]=[];private matrix=new Matrix4();private q=new Quaternion();private p=new Vector3();private s=new Vector3();private c=new Color();
  private nativeColumns=new Map<string,number>();nativeColumnMerges=0;
  constructor(readonly minecraft:boolean,readonly mergeNativeColumns:boolean){}
  beginRun():void{this.nativeColumns.clear();}
  face(r:PerimeterRun,u:number,y:number,w:number,h:number,color:number,out=.22,d=.16):void{
    if(w<=0||h<=0)return;
    if(this.minecraft&&(r.key==="west"||r.key==="southWest")){
      this.nativeFace(r,u,y,w,h,color,out,d);return;
    }
    const p=perimeterPoint(r,u,out+(this.minecraft?1.85:0));
    // Block-native relief stays chunky without replacing the official voxel body.
    if(this.minecraft){d=Math.max(.28,d);h=Math.max(.18,h);w=Math.max(.18,w);}
    this.p.set(p[0],y,p[1]);this.s.set(w,h,d);this.q.setFromAxisAngle(new Vector3(0,1,0),-Math.atan2(r.b[1]-r.a[1],r.b[0]-r.a[0]));
    this.matrix.compose(this.p,this.q,this.s);this.matrices.push(...this.matrix.elements);this.c.setHex(color).toArray(this.colors,this.colors.length);this.counts[r.key]=(this.counts[r.key]??0)+1;
  }
  /** Independent orthogonal bricks follow the source edge in short steps.
   * Long diagonal windows never become deep rotated cuboids. Projection of
   * every brick onto its source tangent remains inside that exact wall run.
   */
  private nativeFace(r:PerimeterRun,u:number,y:number,w:number,h:number,color:number,out:number,d:number):void{
    const lo=Math.max(.06,u-w/2),hi=Math.min(r.length-.06,u+w/2);
    const bottom=Math.max(r.bottom+.06,y-h/2),top=Math.min(r.top-.06,y+h/2);
    if(hi<=lo||top<=bottom)return;
    const tx=(r.b[0]-r.a[0])/r.length,tz=(r.b[1]-r.a[1])/r.length;
    const n=Math.ceil((hi-lo)/4),step=(hi-lo)/n,depth=Math.max(.28,d);
    this.q.identity();this.c.setHex(color);
    for(let i=0;i<n;i++){
      const center=lo+(i+.5)*step,p=perimeterPoint(r,center,out+1.85);
      let sx=Math.max(.12,Math.abs(tx)*step+Math.abs(r.normal[0])*depth);
      let sz=Math.max(.12,Math.abs(tz)*step+Math.abs(r.normal[1])*depth);
      const halfProjection=(Math.abs(tx)*sx+Math.abs(tz)*sz)/2;
      const fit=Math.min(1,(center-.02)/halfProjection,(r.length-.02-center)/halfProjection);
      sx*=fit;sz*=fit;
      // Exact occupied-volume union: only identical-colour boxes with the
      // same XZ rectangle and overlapping/touching Y intervals may coalesce.
      // This joins the old continuous pier segments without thinning them.
      const key=[r.partId,r.wallIndex,p[0],p[1],sx,sz,color].join(":"),previous=this.nativeColumns.get(key);
      if(this.mergeNativeColumns&&previous!==undefined){
        const oldBottom=this.matrices[previous+13]-this.matrices[previous+5]/2,oldTop=this.matrices[previous+13]+this.matrices[previous+5]/2;
        if(bottom<=oldTop+1e-9&&top>=oldBottom-1e-9){
          const mergedBottom=Math.min(bottom,oldBottom),mergedTop=Math.max(top,oldTop);
          this.matrices[previous+5]=mergedTop-mergedBottom;this.matrices[previous+13]=(mergedBottom+mergedTop)/2;this.nativeColumnMerges++;continue;
        }
      }
      this.nativeColumns.set(key,this.matrices.length);
      this.p.set(p[0],(bottom+top)/2,p[1]);this.s.set(sx,top-bottom,sz);
      this.matrix.compose(this.p,this.q,this.s);this.matrices.push(...this.matrix.elements);this.c.toArray(this.colors,this.colors.length);
      this.counts[r.key]=(this.counts[r.key]??0)+1;
    }
  }
  finish():Group{
    const root=new Group();root.name=this.minecraft?"Block-native Leipziger Platz perimeter facades":LEIPZIGER_PERIMETER_GROUP;
    const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.88,flatShading:true});
    const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");const mesh=new InstancedMesh(geometry,day,0);
    mesh.instanceMatrix=new InstancedBufferAttribute(new Float32Array(this.matrices),16);mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(this.colors),3);mesh.count=this.colors.length/3;
    mesh.name=root.name+" stone, glazing and frames";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:this.minecraft};mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
    root.userData={textureFree:true,blockNative:this.minecraft,keepInMinecraft:this.minecraft,nativeMinecraft:this.minecraft,facadeOnly:true,noHiddenSolidInfill:true,profileInstances:this.counts,sourcePartIds:LEIPZIGER_PERIMETER_PARTS.map(p=>p.part.id),sourceWallRuns:LEIPZIGER_PERIMETER_RUNS.length,photoWallInstances:this.photoWallInstances,nativeColumnMerges:this.nativeColumnMerges,photoDimensions:"Unsurveyed facade subdivisions and material tones are photo-guided display estimates; original LoD2 wall and roof dimensions remain unchanged"};
    return freezeStaticSceneTransforms(root);
  }
}

/** All values below describe photo recognition, not measured apertures.
 * TRION's pale grid has near-square upper panes and a distinctly tall base;
 * the Torhaus has slender dark panes between continuous pale vertical piers.
 */
function photoFacade(b:Batch,r:PerimeterRun,torhaus:boolean):void{
  // This upper setback continues down into a court. Only the exterior band
  // above the retained adjacent shoulder roof receives street-photo detail.
  const bottomLimit=torhaus&&r.partId==="DEBE3DsjTZxEWmPH"&&r.wallIndex===6
    ?Math.max(r.bottom,LEIPZIGER_PERIMETER_PARTS.find(p=>p.part.id==="DEBE3DjIomtjGFLa")!.part.top_y_m):r.bottom;
  const stadtpalais=torhaus&&r.partId==="DEBE3DjIomtjGFLa"&&r.wallIndex===12;
  const start=b.colors.length/3,bays=Math.max(1,Math.round(r.length/(stadtpalais?4.2:torhaus?2.45:3.45))),pitch=r.length/bays;
  const stone=stadtpalais?0xd1cdbd:torhaus?0xb8b5a8:0xd2d0c5,glass=torhaus?0x435053:0x46545b,bronze=0x7c7058;
  // Clipping is local to the exact source plane, including raised upper parts.
  const face=(u:number,y:number,w:number,h:number,color:number,out:number,d:number)=>{
    const left=Math.max(.10,u-w/2),right=Math.min(r.length-.10,u+w/2);
    const bottom=Math.max(bottomLimit+.12,y-h/2),top=Math.min(r.top-.18,y+h/2);
    if(right<=left||top<=bottom||!perimeterExposed(r,(left+right)/2,(bottom+top)/2))return;
    b.face(r,(left+right)/2,(bottom+top)/2,right-left,top-bottom,color,out,d);
  };
  const baseTop=r.ground+(torhaus?5.25:5.35),floorPitch=torhaus?3.55:3.45;
  const rows:[number,number][]=[[r.ground+.28,baseTop-.16]];
  for(let bottom=baseTop;bottom<r.top;bottom+=floorPitch)rows.push([bottom+.16,bottom+floorPitch-.16]);
  for(const [bottom,top] of rows){
    const clippedBottom=Math.max(bottom,bottomLimit+.14),clippedTop=Math.min(top,r.top-.22);
    if(clippedTop-clippedBottom<1.25)continue;
    const y=(clippedTop+clippedBottom)/2,h=clippedTop-clippedBottom;
    for(let i=0;i<bays;i++){
      const u=(i+.5)*pitch,w=pitch*(stadtpalais?.75:torhaus?.59:.73);
      face(u,y,w+.16,h+.09,0x77796f,.28,.17);
      face(u,y,w,h,glass,.40,.12);
      // Fine bronze jambs read beside the dark Torhaus glazing. TRION's
      // paired narrow fields sit inside its much broader pale grid.
      for(const sign of[-1,1])face(u+sign*(w/2+.045),y,.095,h,torhaus?bronze:0x68706c,.51,.17);
      if(!torhaus)for(const sign of[-1,1])face(u+sign*w*.17,y,.07,h,0x747c76,.53,.13);
      if(torhaus&&r.bottom>r.ground+20){
        face(u,clippedBottom+.29,w,.52,0x4d5352,.55,.13);
        for(const f of[-.30,-.1,.1,.30])face(u+w*f,clippedBottom+.29,.045,.52,bronze,.62,.10);
      }
    }
    face(r.length/2,top+.08,r.length,.16,stone,.51,.27);
  }
  // Continuous piers are visibly stronger than the thin floor ties. Their
  // endpoints stay on the source plane instead of bridging roof setbacks.
  const pierWidth=Math.min(torhaus?.36:.39,pitch*.2);
  for(let i=0;i<=bays;i++)face(i*pitch,(bottomLimit+r.top)/2,pierWidth,r.top-bottomLimit,stone,torhaus?.62:.58,torhaus?.54:.39);
  b.photoWallInstances.push({partId:r.partId,wallIndex:r.wallIndex,start,count:b.colors.length/3-start,kind:stadtpalais?"stadtpalais":torhaus?"torhaus":"trion"});
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
export function createLeipzigerPerimeterFacades(minecraft=false,mergeNativeColumns=true):Group{
  const b=new Batch(minecraft,mergeNativeColumns);
  for(const r of LEIPZIGER_PERIMETER_RUNS){
    b.beginRun();
    if(r.key==="west"||isTorhausPhotoWall(r)){photoFacade(b,r,r.key!=="west");continue;}
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
