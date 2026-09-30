import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2, Vector3 } from "three";
import source from "./unterDenLindenSource.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const RUSSIAN_EMBASSY_SOURCE_PARTS = source.profiles.find(p=>p.key==="russianEmbassy")!.parts;
export const RUSSIAN_EMBASSY_SOURCE_IDS = new Set(RUSSIAN_EMBASSY_SOURCE_PARTS.map(p=>p.id.slice(-8)));
export const RUSSIAN_EMBASSY_GROUND_Y=5.2;
type Point=[number,number,number];
export const RUSSIAN_EMBASSY_SOURCE_DY=RUSSIAN_EMBASSY_GROUND_Y-RUSSIAN_EMBASSY_SOURCE_PARTS[0].ground_y_m;
export function russianEmbassyPartContains(part:typeof RUSSIAN_EMBASSY_SOURCE_PARTS[number],x:number,z:number):boolean {
 return pointInWorldRing(x,z,part.ring as unknown as WorldRing)&&!part.holes.some(h=>pointInWorldRing(x,z,h as unknown as WorldRing));
}
function triangulate(rings:number[][][]):Point[][] {
 const n=new Vector3(),r=rings[0];for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];n.x+=(a[1]-b[1])*(a[2]+b[2]);n.y+=(a[2]-b[2])*(a[0]+b[0]);n.z+=(a[0]-b[0])*(a[1]+b[1]);}
 const axis=Math.abs(n.y)>Math.abs(n.x)?Math.abs(n.y)>Math.abs(n.z)?1:2:Math.abs(n.x)>Math.abs(n.z)?0:2;
 const projected=rings.map(r=>r.map(v=>axis===1?new Vector2(v[0],v[2]):axis===0?new Vector2(v[2],v[1]):new Vector2(v[0],v[1]))),flat=rings.flat();
 return ShapeUtils.triangulateShape(projected[0],projected.slice(1)).map(t=>t.map(i=>[flat[i][0],flat[i][1]+RUSSIAN_EMBASSY_SOURCE_DY,flat[i][2]]as Point));
}
const roofTriangles=RUSSIAN_EMBASSY_SOURCE_PARTS.flatMap(part=>part.surfaces.filter(s=>s.kind==="RoofSurface").flatMap(s=>triangulate(s.rings).map(triangle=>({id:part.id,triangle}))));
export function russianEmbassyRoofAt(x:number,z:number,id?:string):number|null {
 let result:number|null=null;
 for(const {id:partId,triangle:[a,b,c]}of roofTriangles){if(id&&id!==partId)continue;const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-9)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)result=Math.max(result??-Infinity,u*a[1]+v*b[1]+(1-u-v)*c[1]);}return result;
}
/** Each old four-metre column is replaced only when it meets a retained source ring. */
export function isRussianEmbassyReplacementColumn(x:number,z:number):boolean {
 if(x<748||x>866||z<293||z>414)return false;
 return RUSSIAN_EMBASSY_SOURCE_PARTS.some(p=>[-1.996,0,1.996].some(dx=>[-1.996,0,1.996].some(dz=>russianEmbassyPartContains(p,x+dx,z+dz))));
}
function materials(mesh:Mesh):void{mesh.userData.dayMaterial=mesh.material;mesh.userData.nightMaterial=new MeshStandardMaterial({color:(mesh.material as MeshBasicMaterial).color,side:DoubleSide,roughness:.87});mesh.userData.textureFree=true;}
export function createRussianEmbassySourceGeometry():Group {
 const root=new Group();root.name="Russian Embassy complete original LoD2 walls and roofs";root.userData={sourcePartIds:RUSSIAN_EMBASSY_SOURCE_PARTS.map(p=>p.id),sourceSurfaceCount:RUSSIAN_EMBASSY_SOURCE_PARTS.reduce((n,p)=>n+p.surfaces.length,0),verticalTranslationM:RUSSIAN_EMBASSY_SOURCE_DY,originalSourceRetained:true,textureFree:true};
 for(const kind of["WallSurface","RoofSurface"]){const positions=RUSSIAN_EMBASSY_SOURCE_PARTS.flatMap(p=>p.surfaces.filter(s=>s.kind===kind).flatMap(s=>triangulate(s.rings))).flat(2),g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();const m=new Mesh(g,new MeshBasicMaterial({color:kind==="WallSurface"?0xd0c9b5:0x9d655d,side:DoubleSide}));m.name=`Russian Embassy original ${kind}`;materials(m);root.add(m);}return freezeStaticSceneTransforms(root);
}
/** Exterior-only native roofs and walls retain sixteen source parts and open courts. */
export function createMinecraftRussianEmbassySourceGeometry(options:{mobileLike?:boolean}={}):Group {
 const root=new Group();root.name="Block-native Russian Embassy complete source envelope";root.userData={nativeMinecraft:true,keepInMinecraft:true,textureFree:true,hiddenSolidInfill:false,sourcePartIds:RUSSIAN_EMBASSY_SOURCE_PARTS.map(p=>p.id)};
 const cell=options.mobileLike?2:1.5,boxes:{p:Point;s:Point;color:number}[]=[];
 for(const p of RUSSIAN_EMBASSY_SOURCE_PARTS){const minX=Math.min(...p.ring.map(q=>q[0])),maxX=Math.max(...p.ring.map(q=>q[0])),minZ=Math.min(...p.ring.map(q=>q[1])),maxZ=Math.max(...p.ring.map(q=>q[1]));
  for(let x=minX+cell/2;x<maxX;x+=cell)for(let z=minZ+cell/2;z<maxZ;z+=cell){if(!russianEmbassyPartContains(p,x,z))continue;const top=russianEmbassyRoofAt(x,z,p.id);if(top!==null)boxes.push({p:[x,top-.18,z],s:[cell,.36,cell],color:0x9d655d});}
  for(const ring of[p.ring,...p.holes])for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),n=Math.ceil(length/cell);for(let j=0;j<n;j++){const x=a[0]+dx*(j+.5)/n,z=a[1]+dz*(j+.5)/n,top=russianEmbassyRoofAt(x,z,p.id)??p.top_y_m+RUSSIAN_EMBASSY_SOURCE_DY;boxes.push({p:[x,(top+5.2)/2,z],s:[Math.max(.4,Math.abs(dx/n)),top-5.2,Math.max(.4,Math.abs(dz/n))],color:0xd0c9b5});}}
 }
 const g=new BoxGeometry(1,1,1);g.deleteAttribute("uv");const mesh=new InstancedMesh(g,new MeshBasicMaterial({color:0xffffff}),boxes.length),m=new Matrix4(),c=new Color();boxes.forEach((b,i)=>{m.makeScale(...b.s).setPosition(...b.p);mesh.setMatrixAt(i,m);mesh.setColorAt(i,c.setHex(b.color));});mesh.name="Russian Embassy native exterior-only roofs and walls";materials(mesh);mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);return freezeStaticSceneTransforms(root);
}
