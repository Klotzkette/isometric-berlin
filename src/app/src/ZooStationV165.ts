import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import source from "./data/zooStationV165Source.json";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { createZooEntranceDetailsV192 } from "./StationDetailsV192";

export const ZOO_STATION_V165_GROUP = "Bahnhof Zoo transparent source halls and Amerika Haus";
export const ZOO_STATION_V165_NATIVE_GROUP = "Bahnhof Zoo and Amerika Haus independent native blocks";
export const ZOO_STATION_V165_PROFILE = /* @__PURE__ */ (() => Object.freeze({
  stationHeritageId: "09040500", amerikaHeritageId: "09096192",
  trackCount: 6, platformCount: 3, sourcePartCount: 21,
  references: ["https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040500", "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096192", "https://www.bahnhof.de/berlin-zoologischer-garten", "https://co-berlin.org/en/about-us"],
  sourceStatus: source.sourceStatus,
}))();
type Row = number[];
const steel = 0x434f4c;
function pair(glass = false) {
  const common = { color: 0xffffff, transparent: glass, opacity: glass ? .16 : 1, depthWrite: !glass, side: DoubleSide };
  return { day: new MeshBasicMaterial(common), night: new MeshStandardMaterial({ ...common, roughness: .8, flatShading: true }) };
}
function instanced(rows: Row[], beams: Row[], glass: boolean, native: boolean): InstancedMesh {
  const geometry = new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
  const {day,night} = pair(glass),mesh=new InstancedMesh(geometry,day,0),matrix=new Matrix4(),tint=new Color();
  const count=rows.length+beams.length,matrices=new Float32Array(count*16),colors=new Float32Array(count*3);
  rows.forEach((r,i)=>{matrix.makeRotationY(r[6]);matrix.scale(new Vector3(r[3],r[4],r[5]));matrix.setPosition(r[0],r[1],r[2]);matrix.toArray(matrices,i*16);tint.setHex(r[7]).toArray(colors,i*3);});
  const up=new Vector3(0,1,0),direction=new Vector3(),rotation=new Quaternion();
  beams.forEach((r,j)=>{const i=rows.length+j;direction.set(r[3]-r[0],r[4]-r[1],r[5]-r[2]);const length=direction.length();rotation.setFromUnitVectors(up,direction.normalize());matrix.compose(new Vector3((r[0]+r[3])/2,(r[1]+r[4])/2,(r[2]+r[5])/2),rotation,new Vector3(r[6],length,r[6]));matrix.toArray(matrices,i*16);tint.setHex(r[7]).toArray(colors,i*3);});
  mesh.count=count;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:native,nativeMinecraft:native,glass};mesh.computeBoundingBox();mesh.computeBoundingSphere();return mesh;
}
function sourceMesh(glass: boolean): Mesh {
  const surfaces=source.surfaces.filter(s=>(s.material==="glass")===glass);
  const size=surfaces.reduce((sum,s)=>sum+s.triangles.length*9,0),positions=new Float32Array(size),colors=new Float32Array(size),color=new Color();let k=0;
  for(const s of surfaces){color.setHex(s.color);for(const t of s.triangles)for(const p of t){positions.set(p,k);colors.set([color.r,color.g,color.b],k);k+=3;}}
  const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(positions,3));geometry.setAttribute("color",new BufferAttribute(colors,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const {day,night}=pair(glass);day.vertexColors=true;night.vertexColors=true;
  const mesh=new Mesh(geometry,day);mesh.name=glass?"Zoo hall transparent source curtain walls":"All measured opaque roofs stone and three mapped platforms";
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,glass};return mesh;
}
/** Recognition details are separate, bounded estimates; no image or font textures. */
function accents(): {boxes:Row[];beams:Row[]} {
  const boxes:Row[]=[],beams:Row[]=[];
  const yaw=-Math.atan2(7.870,10.168),cx=-2798.767,cz=1295.548;
  // Local +u runs to the reader's right from the Hardenbergstrasse pavement.
  // The outward depth basis points north-east; using the roof edge direction
  // for +u instead would mirror both the mosaic layout and the lettering.
  const at=(u:number,y:number,d:number):number[]=>[cx-Math.cos(yaw)*u-Math.sin(yaw)*d,y,cz+Math.sin(yaw)*u-Math.cos(yaw)*d];
  const box=(u:number,y:number,d:number,w:number,h:number,t:number,color:number)=>boxes.push([...at(u,y,d),w,h,t,yaw,color]);
  const text=(label:string,u:number,y:number,d:number,height:number,color:number)=>{for(const path of letteringStrokePaths(label,height))for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];beams.push([...at(u+a[0],y+a[1],d),...at(u+b[0],y+b[1],d),height*.105,color]);}};
  // Original blue-grey mosaic and abstract flag field above the restored entrance.
  box(0,13.26,.11,12.86,7.36,.12,0x86abb3);box(-4.05,13.26,.18,4.7,7.34,.08,0x608f9e);
  box(-4.05,10.57,.24,4.7,1.95,.08,0xc1c5bc);box(.75,10.17,.23,4.9,.96,.09,0x5594a3);
  for(const y of [11.8,11.97,13.0,13.17,14.25,14.42])box(1.6,y,.245,8.12,.055,.025,0xd77e45);
  for(const y of [12.33,13.55,14.8,15.6])for(let i=0;i<7;i++)box(-.1+i*.87,y,.25,.12,.12,.028,0xd7d9cd);
  text("AMERIKA HAUS",-4.05,10.68,.31,.30,0x31383a);
  text("C O BERLIN",0,17.16,.14,.74,0x3f4348);
  beams.push([...at(-2.80,17.14,.16),...at(-2.48,17.95,.16),.065,0x3f4348]);
  box(0,7.33,.20,11.8,3.68,.14,0x738e8c);
  for(let i=0;i<=8;i++)box(-5.9+i*11.8/8,7.33,.34,.085,3.74,.12,0xe1e0d2);
  box(0,8.79,.34,11.8,.09,.12,0xe1e0d2);box(0,5.48,.34,12.2,.14,.43,0xd8d6c9);
  for(let i=0;i<3;i++)box(0,5.16-i*.11,.8+i*.48,13.4+i*.45,.18,.55,0xc8c7ba);
  // The well-known elevated station name is on the Hardenbergplatz facade.
  const stationYaw=Math.atan2(43.621,22.390),stationX=-2653.668,stationZ=1230.9215;
  const sp=(u:number,y:number,d:number):number[]=>[stationX+Math.cos(stationYaw)*u+Math.sin(stationYaw)*d,y,stationZ-Math.sin(stationYaw)*u+Math.cos(stationYaw)*d];
  for(const path of letteringStrokePaths("BERLIN ZOOLOGISCHER GARTEN",1.1))for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];beams.push([...sp(a[0],28.95+a[1],.18),...sp(b[0],28.95+b[1],.18),.095,0xe9e8d8]);
  }
  boxes.push([...sp(-17.1,29.54,.09),2.8,1.58,.13,stationYaw,0xbe3f39]);
  for(const u of [-17,-9,0,9,17])beams.push([...sp(u,28.60,.04),...sp(u,29.07,.04),.07,steel]);
  for(const path of letteringStrokePaths("DB",.90))for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];beams.push([...sp(-17.1+a[0],29.05+a[1],.22),...sp(-17.1+b[0],29.05+b[1],.22),.11,0xf2eee1]);
  }
  // Bench seats, timetable cases and dark blue numbered platform signs are
  // bounded to each exact platform, using its source ring centre line samples.
  for(const p of source.platforms){
    const angle=61.1*Math.PI/180,ux=Math.cos(angle),uz=-Math.sin(angle);
    for(const [x,z] of p.furniturePoints){
      boxes.push([x,14.44,z,3.2,.15,.48,angle,0x707b72]);
      for(const side of [-1,1])boxes.push([x+ux*side*1.3,14.13,z+uz*side*1.3,.10,.58,.35,angle,steel]);
      boxes.push([x,16.6,z,2.5,.65,.09,angle,0x263d5b]);
      boxes.push([x-ux*1.12,15.5,z-uz*1.12,.055,3.1,.055,angle,steel]);
    }
  }
  return {boxes,beams};
}
function nativeRows(rows:Row[],beams:Row[]):Row[]{
  const result:Row[]=[];
  for(const r of rows){
    // Thin repeated elements use a separate orthogonal reading, never rotated
    // smooth meshes. Long horizontal dimensions become stepped blocks.
    const nx=Math.max(1,Math.ceil(r[3]/1.25)),nz=Math.max(1,Math.ceil(r[5]/1.25));
    for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
      const u=(ix+.5)*r[3]/nx-r[3]/2,v=(iz+.5)*r[5]/nz-r[5]/2;
      result.push([r[0]+Math.cos(r[6])*u+Math.sin(r[6])*v,r[1],r[2]-Math.sin(r[6])*u+Math.cos(r[6])*v,r[3]/nx,r[4],r[5]/nz,0,r[7]]);
    }
  }
  for(const r of beams){
    const dx=r[3]-r[0],dy=r[4]-r[1],dz=r[5]-r[2],n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))/1.25));
    for(let i=0;i<n;i++){const f=(i+.5)/n;result.push([r[0]+dx*f,r[1]+dy*f,r[2]+dz*f,Math.max(r[6],Math.abs(dx)/n),Math.max(r[6],Math.abs(dy)/n),Math.max(r[6],Math.abs(dz)/n),0,r[7]]);}
  }
  return result;
}
function create(native:boolean):Group{
  const group=new Group();group.name=native?ZOO_STATION_V165_NATIVE_GROUP:ZOO_STATION_V165_GROUP;
  const extra=accents(),boxes=[...source.boxes,...extra.boxes],beams=[...source.beams,...extra.beams];
  if(native){
    const opaque=nativeRows(boxes,beams),glass:Row[]=[];
    for(const r of source.nativeBlocks){const row=[Number(r[0]),Number(r[1]),Number(r[2]),2,2,2,0,Number(r[3])];(r[4]==="glass"?glass:opaque).push(row);}
    const a=instanced(opaque,[],false,true);a.name="Zoo station native source and details";group.add(a);
    const b=instanced(glass,[],true,true);b.name="Zoo station native glass blocks";group.add(b);
  }else{
    group.add(sourceMesh(false),sourceMesh(true));
    const members=instanced(boxes,beams,false,false);members.name="Zoo steel glazing grid sleepers stairs and Amerika Haus mosaic";group.add(members);
  }
  group.add(createZooEntranceDetailsV192(native));
  group.userData={...ZOO_STATION_V165_PROFILE,detailProfile:"full",nativeMinecraft:native,textureFree:true,staticDetailParity:true};freezeStaticSceneTransforms(group);return group;
}
export function createZooStationV165(_options?:{detailProfile?:"full"|"mobile"}):Group{return create(false);}
export function createMinecraftZooStationV165(_options?:{detailProfile?:"full"|"mobile"}):Group{return create(true);}
