import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2, Vector3,
} from "three";
import source from "./data/cafeNeuerSeeV164Source.json";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

type P = [number, number, number];
type Tri = { color: number; triangles: number[][][] };
const WOOD=0xb8935f, DARK=0x465b49, CREAM=0xdedbc6;
export const CAFE_NEUER_SEE_V164_GROUP="Cafe am Neuen See measured roofs and lakeside garden";
export const CAFE_NEUER_SEE_V164_NATIVE_GROUP="Cafe am Neuen See independent native blocks";

function boxBatch(rows: readonly number[][]): InstancedMesh {
  const g=new BoxGeometry(1,1,1);g.deleteAttribute("uv");g.deleteAttribute("normal");
  const day=new MeshBasicMaterial({color:0xffffff});
  const night=new MeshStandardMaterial({color:0xffffff,flatShading:true,roughness:.9});
  const mesh=new InstancedMesh(g,day,0), matrix=new Matrix4(), c=new Color();
  const matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3);
  rows.forEach((r,i)=>{matrix.makeRotationY(r[6]);matrix.scale(new Vector3(r[3],r[4],r[5]));matrix.setPosition(r[0],r[1],r[2]);matrix.toArray(matrices,i*16);c.setHex(r[7]).toArray(colors,i*3);});
  mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};
  mesh.computeBoundingBox();mesh.computeBoundingSphere();return mesh;
}
function triangles(sheets: readonly Tri[]): Mesh {
  const positions:number[]=[],colors:number[]=[],color=new Color();
  for(const sheet of sheets){color.setHex(sheet.color);for(const t of sheet.triangles)for(const p of t){positions.push(...p);colors.push(color.r,color.g,color.b);}}
  const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.setAttribute("color",new Float32BufferAttribute(colors,3));
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,flatShading:true,roughness:.88});
  const mesh=new Mesh(g,day);mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};g.computeBoundingBox();g.computeBoundingSphere();return mesh;
}

/** Shared authoring coordinates; Minecraft emits only unrotated little boxes. */
class Garden {
  boxes:number[][]=[];
  sheets:Tri[]=[];
  constructor(readonly native:boolean){}
  box(c:number,x:number,y:number,z:number,w:number,h:number,d:number,yaw=0):void {
    if(!this.native||yaw===0){this.boxes.push([x,y,z,w,h,d,0===yaw?0:yaw,c]);return;}
    const n=Math.max(1,Math.ceil(w/.3)),m=Math.max(1,Math.ceil(d/.3));
    for(let i=0;i<n;i++)for(let j=0;j<m;j++){
      const u=(i+.5)*w/n-w/2,v=(j+.5)*d/m-d/2;
      this.boxes.push([x+Math.cos(yaw)*u+Math.sin(yaw)*v,y,z-Math.sin(yaw)*u+Math.cos(yaw)*v,w/n,h,d/m,0,c]);
    }
  }
  line(c:number,a:P,b:P,width:number):void {
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
    const n=Math.max(1,Math.ceil(length/(this.native?Math.max(.18,width):.13)));
    if(Math.abs(dy)<.00001){this.box(c,(a[0]+b[0])/2,a[1],(a[2]+b[2])/2,length,width,width,Math.atan2(-dz,dx));return;}
    if (!this.native) {
      // A continuous thin prism avoids dotted chair legs, oars and lettering.
      const axis = new Vector3(dx,dy,dz).normalize();
      const u = new Vector3().crossVectors(axis, Math.abs(axis.y) < .9 ? new Vector3(0,1,0) : new Vector3(1,0,0)).normalize().multiplyScalar(width/2);
      const v = new Vector3().crossVectors(axis,u).normalize().multiplyScalar(width/2);
      const corners = (p:P):P[] => [[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j]) => new Vector3(...p).addScaledVector(u,i).addScaledVector(v,j).toArray() as P);
      const start=corners(a), end=corners(b);
      this.face(c,start);this.face(c,end);
      for(let i=0;i<4;i++){const j=(i+1)%4;this.face(c,[start[i],start[j],end[j],end[i]]);}
      return;
    }
    // Orthogonal stepping remains separate from the drawn rods.
    for(let i=0;i<=n;i++)this.box(c,a[0]+dx*i/n,a[1]+dy*i/n,a[2]+dz*i/n,width,Math.max(width,Math.abs(dy)/n+.01),width);
  }
  face(c:number,ring:P[]):void {
    if(this.native){
      // Surface sampling, never a smooth panel under the native model.
      for(let k=1;k<ring.length-1;k++){
        const a=new Vector3(...ring[0]),b=new Vector3(...ring[k]),d=new Vector3(...ring[k+1]);
        const n=Math.max(1,Math.ceil(Math.max(a.distanceTo(b),a.distanceTo(d),b.distanceTo(d))/.35));
        for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){const p=a.clone().addScaledVector(b.clone().sub(a),i/n).addScaledVector(d.clone().sub(a),j/n);this.box(c,p.x,p.y,p.z,.32,.16,.32);}
      }return;
    }
    this.sheets.push({color:c,triangles:ring.slice(1,-1).map((p,i)=>[ring[0],p,ring[i+2]])});
  }
  ground(ring:number[][],color:number,y:number):void {
    const face=ShapeUtils.triangulateShape(ring.map(p=>new Vector2(p[0],p[1])),[]);
    for(const t of face)this.face(color,t.map(i=>[ring[i][0],y,ring[i][1]]) as P[]);
  }
}
const mappedDeck = source.features.find(f=>f.id==="1069887158")!.world_xz_m as unknown as WorldRing;
function furnitureBaseAt(x:number,z:number):number {
  return pointInWorldRing(x,z,mappedDeck) ? source.deckY : 5.32;
}
function picnic(g:Garden,x:number,z:number):void {
  const y=furnitureBaseAt(x,z), yaw=.90, at=(u:number,h:number,v:number):P=>[x+Math.cos(yaw)*u+Math.sin(yaw)*v,y+h,z-Math.sin(yaw)*u+Math.cos(yaw)*v];
  const box=(c:number,u:number,h:number,v:number,w:number,hi:number,d:number)=>g.box(c,...at(u,h,v),w,hi,d,yaw);
  for(let i=0;i<5;i++)box(WOOD,0,.75,-.32+i*.16,2.4,.08,.14);
  for(const side of[-1,1]){
    box(WOOD,0,.43,side*.77,2.4,.09,.27);
    for(const end of[-.85,.85]){
      box(DARK,end,.24,side*.77,.065,.48,.24);
      box(DARK,end,.38,side*.29,.055,.71,.055);
    }
  }
}
function chair(g:Garden,x:number,z:number,yaw:number):void {
  const y=furnitureBaseAt(x,z), at=(u:number,h:number,v:number):P=>[x+Math.cos(yaw)*u+Math.sin(yaw)*v,y+h,z-Math.sin(yaw)*u+Math.cos(yaw)*v];
  for(let i=0;i<4;i++)g.box(CREAM,...at(0,.44,-.2+i*.13),.48,.045,.10,yaw);
  for(const u of[-.23,.23]){g.line(DARK,at(u,.04,-.2),at(u,.49,.17),.035);g.line(DARK,at(u,.04,.20),at(u,.88,-.20),.035);}
  for(const h of[.64,.78,.89])g.box(CREAM,...at(0,h,-.2),.50,.085,.04,yaw);
}
function rowingBoat(g:Garden,x:number,z:number,yaw:number,index:number):void {
  const water=g.native?source.nativeWaterY:source.waterY;
  const at=(u:number,h:number,v:number):P=>[x+Math.cos(yaw)*u+Math.sin(yaw)*v,water+h,z-Math.sin(yaw)*u+Math.cos(yaw)*v];
  const hull=index%2?0xa54f38:0x7d392d,n=24;
  const perimeter=(r:number,h:number):P[]=>Array.from({length:n},(_,i)=>{const t=i*Math.PI*2/n;return at(Math.cos(t)*2.05*r,h,Math.sin(t)*.78*r*(.80+.20*Math.sin(t)));});
  const top=perimeter(1,.45),bottom=perimeter(.70,-.13),inside=perimeter(.89,.40),floor=perimeter(.66,.02);
  for(let i=0;i<n;i++){
    const j=(i+1)%n;g.face(hull,[bottom[i],bottom[j],top[j],top[i]]);g.face(0xc1aa83,[inside[i],inside[j],floor[j],floor[i]]);
    g.face(CREAM,[top[i],top[j],inside[j],inside[i]]);
  }
  g.face(0x98734a,floor);
  for(const u of[-.85,.25,1.25])g.box(WOOD,...at(u,.29,0),.26,.10,u>1?.83:1.27,yaw);
  for(const side of[-1,1]){
    const a=at(.10,.53,side*.15),b=at(-.65,.21,side*2.1);g.line(WOOD,a,b,.065);
    g.box(0xab885a,...at(-.64,.21,side*2.13),.46,.05,.19,yaw+.4*side);
  }
}
function garden(g:Garden):void {
  const byId=new Map(source.features.map(f=>[f.id,f]));
  const floors = source;
  if(g.native){
    for(const [x,y,z,w,h,d,color] of floors.gardenNativeRuns)g.box(color,x,y,z,w,h,d);
  }else{
    g.sheets.push(...floors.gardenSurfaces);
    for(const [a,b] of floors.deckPlankLines)g.line(0x9b8a6d,[a[0],floors.deckY+.009,a[1]],[b[0],floors.deckY+.009,b[1]],.018);
  }
  for(const [a,b] of floors.shorelineDeckRails){
    const y=floors.deckY,dx=b[0]-a[0],dz=b[1]-a[1],n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/2.2));
    for(let i=0;i<=n;i++)g.box(WOOD,a[0]+dx*i/n,y+.56,a[1]+dz*i/n,.12,1.12,.12);
    for(const h of [.35,.69,1.08])g.line(h>1?WOOD:DARK,[a[0],y+h,a[1]],[b[0],y+h,b[1]],h>1?.10:.025);
  }
  // The existing lake/bank/path surfaces remain untouched; only the mapped pier
  // and thin deck detail are added, with an open boat-hire approach.
  const pier=byId.get("118603619")!.world_xz_m as number[][];
  for(let i=1;i<pier.length;i++){
    const a=pier[i-1],b=pier[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),yaw=Math.atan2(-dz,dx);
    g.box(0x826d4e,(a[0]+b[0])/2,5.48,(a[1]+b[1])/2,length,.2,1.5,yaw);
    const n=Math.ceil(length/.26);for(let j=0;j<=n;j++)g.box(0xb7a283,a[0]+dx*j/n,5.59,a[1]+dz*j/n,.025,.02,1.46,yaw);
    for(let j=0;j<=length;j+=3)g.box(DARK,a[0]+dx*j/length,5.15,a[1]+dz*j/length,.13,.9,.13);
  }
  for(const [x,z] of source.tables)picnic(g,x,z);
  for(const [x,z] of source.chairTables){
    const lift=furnitureBaseAt(x,z)-5.28;
    g.box(WOOD,x,6.01+lift,z,.85,.075,.85);g.box(DARK,x,5.64+lift,z,.09,.7,.09);
    for(let i=0;i<4;i++){const t=i*Math.PI/2;chair(g,x+Math.sin(t)*.9,z+Math.cos(t)*.9,t);}
  }
  for(const [x,z] of source.sandpits){
    g.box(0xdfc991,x,5.35,z,3.6,.16,3.4);
    for(const s of[-1,1]){g.box(WOOD,x+s*1.9,5.56,z,.20,.48,3.9);g.box(WOOD,x,5.56,z+s*1.8,3.8,.48,.20);}
    for(let i=0;i<3;i++)g.box([0xb74d35,0xe3b552,0x537dac][i],x-.9+i*.8,5.54,z+(i%2)*.65,.21,.18,.20);
  }
  for(const [x,z] of source.canopies){
    for(const u of[-3.1,3.1])for(const v of[-2.6,2.6])g.box(0xa19376,x+u,6.75,z+v,.10,3.1,.10);
    const a:P=[x-3.4,8.28,z-2.9],b:P=[x+3.4,8.28,z-2.9],c:P=[x+3.4,8.28,z+2.9],d:P=[x-3.4,8.28,z+2.9],peak:P=[x,9.6,z];
    for(const [p,q] of[[a,b],[b,c],[c,d],[d,a]]){g.face(0xe8dfc7,[p,q,peak]);g.line(0xcac0a8,p,peak,.045);}
  }
  source.boats.forEach(([x,z,yaw],i)=>rowingBoat(g,x,z,yaw,i));
  // A restrained strand of garden bulbs, attached to four local timber posts.
  for(const [x,z] of source.tables.filter((_,i)=>i%12===0)){
    const lift=furnitureBaseAt(x,z)-5.28;
    g.box(DARK,x-2,6.85+lift,z,.09,3.3,.09);
    for(let k=0;k<8;k++){const u=k/7,v=(k+1)/7;
      const a:P=[x-2+u*4,8.5+lift-.4*Math.sin(u*Math.PI),z],b:P=[x-2+v*4,8.5+lift-.4*Math.sin(v*Math.PI),z];
      if(k<7)g.line(DARK,a,b,.025);g.box(0xffe0a4,a[0],a[1]-.08,a[2],.12,.15,.12);
    }
    g.box(DARK,x+2,6.85+lift,z,.09,3.3,.09);
  }
}
function create(native:boolean):Group {
  const root=new Group();root.name=native?CAFE_NEUER_SEE_V164_NATIVE_GROUP:CAFE_NEUER_SEE_V164_GROUP;
  root.userData={textureFree:true,blockNative:native,keepInMinecraft:native,fullStaticDetailOnTouch:true,boatCount:source.boats.length,sandpitCount:source.sandpits.length,canopyCount:source.canopies.length,chairCount:source.chairTables.length*4,sourceGeometryRetained:true};
  if(native){const m=boxBatch(source.nativeBlocks.map(([x,y,z,c])=>[x,y,z,1,1,1,0,c]));m.name="Independent cafe source-surface blocks";root.add(m);}
  else{const m=triangles(source.surfaces);m.name="Complete cafe measured walls and shaped roofs";root.add(m);const f=boxBatch(source.facadeBoxes.map(r=>r.slice(0,8) as number[]));f.name="Cafe source-clipped timber and glazing";root.add(f);}
  const props=new Garden(native);garden(props);
  if(!native){
    const yaw=.90,at=(u:number,y:number):P=>[-1828.2+Math.cos(yaw)*u,y,893.9-Math.sin(yaw)*u];
    for(const path of letteringStrokePaths("CAFE AM NEUEN SEE",.43))for(let i=1;i<path.length;i++)props.line(0xe4d4b8,at(path[i-1][0],9.9+path[i-1][1]),at(path[i][0],9.9+path[i][1]),.05);
  }
  const furniture=boxBatch(props.boxes);furniture.name="Open garden seating pier boats and seasonal canopies";root.add(furniture);
  if(props.sheets.length){const mesh=triangles(props.sheets);mesh.name="Hollow rowing hulls and light fabric roofs";root.add(mesh);}
  return freezeStaticSceneTransforms(root);
}
export function createCafeNeuerSeeV164():Group{return create(false);}
export function createMinecraftCafeNeuerSeeV164():Group{return create(true);}
