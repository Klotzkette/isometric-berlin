import {BufferAttribute,BufferGeometry,Color,DoubleSide,Group,InstancedMesh,Mesh,MeshBasicMaterial,MeshStandardMaterial,type Object3D} from "three";
import data from "./data/pfaueninselDetailsV346.json";
import {freezeStaticSceneTransforms} from "./staticSceneTransforms";
import {isSceneGeometryGpuRetirementV309} from "./sceneGeometryGpuResidency";
import {isSceneMaterialProgramRetirementV321} from "./sceneMaterialPrograms";

type Piece={color:number;role:string;triangle:number[][]};
type Receipt={native:boolean;host:Group;outer:Group;mesh:Mesh;invalid:boolean};
const receipts=new WeakMap<Group,Receipt>();
const hash=(a:ArrayBufferView):number=>{let h=2166136261;for(const c of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^c,16777619)>>>0;return h;};
const atOrigin=(o:Object3D)=>o.position.lengthSq()===0&&o.scale.x===1&&o.scale.y===1&&o.scale.z===1&&o.quaternion.x===0&&o.quaternion.y===0&&o.quaternion.z===0&&o.quaternion.w===1;
function hostIntact(host:Group,native:boolean):boolean{
 const pin=native?data.hostPins.native:data.hostPins.drawn;
 const surfaces=host.children.filter(o=>o instanceof Mesh&&!(o instanceof InstancedMesh)&&!o.userData.pfaueninselDetailsV346) as Mesh[];
 const boxes=host.children.filter(o=>o instanceof InstancedMesh) as InstancedMesh[];
 if(!atOrigin(host)||!host.visible||boxes.length!==1||!boxes[0].visible||!atOrigin(boxes[0])||boxes[0].count!==pin.boxes||hash(boxes[0].instanceMatrix.array)!==pin.matrixHash||!boxes[0].instanceColor||hash(boxes[0].instanceColor.array)!==pin.colourHash)return false;
 const box=boxes[0].geometry,ba=box.getAttribute("position"),bi=box.index;
 if(ba.count!==24||!bi||bi.count!==36)return false;
 const bp=new Float32Array(72);for(let i=0;i<24;i++){bp[i*3]=ba.getX(i);bp[i*3+1]=ba.getY(i);bp[i*3+2]=ba.getZ(i);}
 if(hash(bp)!==4139129861||hash(bi.array)!==3067861605)return false;
 if(!pin.positions)return surfaces.length===0;
 if(surfaces.length!==1||!surfaces[0].visible||!atOrigin(surfaces[0]))return false;
 const g=surfaces[0].geometry,a=g.getAttribute("position"),ix=g.index;
 if(a.count*3!==pin.positions||!ix||ix.count!==pin.indices)return false;
 // Reading exact logical coordinates also works after the existing renderer
 // interleaves attributes; no alternate source object authorizes admission.
 const points=new Float32Array(pin.positions);for(let i=0;i<a.count;i++){points[i*3]=a.getX(i);points[i*3+1]=a.getY(i);points[i*3+2]=a.getZ(i);}
 return hash(points)===pin.positionHash&&hash(ix.array)===pin.indexHash;
}
export function hasPfaueninselDetailsV346(root:Group|null|undefined):boolean{
 if(!root)return false;const r=receipts.get(root);
 return !!r&&!r.invalid&&root.visible&&root.parent===r.host&&r.host.parent===r.outer&&r.outer.parent!==null&&atOrigin(root)&&atOrigin(r.outer)&&r.mesh.parent===root&&r.mesh.visible&&hostIntact(r.host,r.native);
}
/** Attach only to the exact complete retained castle, never to a userData label.
 * Its original source body, 99 fittings / 222 Native boxes stay untouched. */
export function attachPfaueninselDetailsV346(outer:Group,native=false):Group|null{
 const host=outer.children.find(o=>o instanceof Group&&o.userData.siteKey==="schloss-pfaueninsel") as Group|undefined;
 if(!host||!atOrigin(outer)||host.children.some(o=>o.userData.pfaueninselDetailsV346)||!hostIntact(host,native))return null;
 const pieces=(native?data.native:data.drawn) as Piece[],p=new Float32Array(pieces.length*9),c=new Float32Array(pieces.length*9),colour=new Color();
 for(let t=0;t<pieces.length;t++){const row=pieces[t];colour.setHex(row.color);for(let v=0;v<3;v++){p.set(row.triangle[v],t*9+v*3);colour.toArray(c,t*9+v*3);}}
 const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(p,3));geometry.setAttribute("color",new BufferAttribute(c,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.88,flatShading:true});
 const mesh=new Mesh(geometry,day),root=new Group();root.name="Pfaueninsel: raised clock turret, zinc dome and open iron braces v346";
 mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,pfaueninselDetailsV346:true,blockNative:native,keepInMinecraft:native};
 root.userData={pfaueninselDetailsV346:true,textureFree:true,fullStaticDetailOnTouch:true,blockNative:native,keepInMinecraft:native};root.add(mesh);host.add(root);
 const r:Receipt={host,outer,mesh,native,invalid:false};receipts.set(root,r);
 geometry.addEventListener("dispose",()=>{if(!isSceneGeometryGpuRetirementV309(geometry))r.invalid=true;});
 for(const m of[day,night])m.addEventListener("dispose",()=>{if(!isSceneMaterialProgramRetirementV321(m))r.invalid=true;});
 return freezeStaticSceneTransforms(root);
}
function roofY(x:number,z:number):number|null{
 let top:number|null=null;
 for(const [a,b,c] of data.roofTriangles){const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-10)continue;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;
  if(Math.min(u,v,w)>=-1e-7){const y=u*a[1]+v*b[1]+w*c[1];top=top===null?y:Math.max(top,y);}
 }return top;
}
/** Matching raised-turret roof, gated by the same actual attached host. */
export function pfaueninselDetailsGroundAtV346(root:Group|null|undefined,x:number,z:number):number|null{
 if(Math.abs(x-data.centre[0])>3||Math.abs(z-data.centre[1])>3||!hasPfaueninselDetailsV346(root))return null;
 const r=receipts.get(root!)!;
 if(!r.native)return roofY(x,z);
 let top:number|null=null;for(const c of data.nativeRoofCaps)if(x>=c[0]&&x<c[2]&&z>=c[1]&&z<c[3])top=top===null?c[4]:Math.max(top,c[4]);return top;
}
export function pfaueninselDetailsSolidAtV346(root:Group|null|undefined,x:number,y:number,z:number,radius=0):boolean{
 if(Math.abs(x-data.centre[0])>3+radius||Math.abs(z-data.centre[1])>3+radius||y<15||y>24||!hasPfaueninselDetailsV346(root))return false;
 const r=receipts.get(root!)!;
 if(r.native)return data.nativeRoofCaps.some(c=>x>=c[0]-radius&&x<=c[2]+radius&&z>=c[1]-radius&&z<=c[3]+radius&&y<=c[4]);
 const top=roofY(x,z);return top!==null&&y>=data.minY&&y<=top;
}
