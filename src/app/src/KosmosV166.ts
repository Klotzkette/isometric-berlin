import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import source from "./data/kosmosV166Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";

export const KOSMOS_V166_GROUP = "KOSMOS former cinema and current event venue";
export const KOSMOS_V166_NATIVE_GROUP = "KOSMOS event venue native blocks";
export const KOSMOS_V166_RENDER_BUDGET = Object.freeze({
  parents: source.parents.length, parts: source.parts.length,
  facadeInstances: source.facadeBoxes.length, nativeSourceBlocks: source.nativeBlocks.length,
  drawnBatches: 2, nativeBatches: 1,
});

type Surface = {color:number;triangles:number[][][]};
function surfacesMesh(surfaces: Surface[]): Mesh {
  const count=surfaces.reduce((n,s)=>n+s.triangles.length*9,0);
  const positions=new Float32Array(count),colors=new Float32Array(count),color=new Color();let offset=0;
  for(const s of surfaces){color.setHex(s.color);for(const t of s.triangles)for(const p of t){positions.set(p,offset);colors.set([color.r,color.g,color.b],offset);offset+=3;}}
  const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.setAttribute("color",new Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.89,flatShading:true});
  const mesh=new Mesh(geometry,day);mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};return mesh;
}
function instances(rows:readonly number[][],native=false):InstancedMesh{
  const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
  const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.9,flatShading:true});
  const mesh=new InstancedMesh(geometry,day,0),matrix=new Matrix4(),color=new Color();
  const matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3);
  rows.forEach((r,i)=>{if(native)matrix.makeScale(r[4]??2,r[4]??2,r[4]??2);else{matrix.makeRotationY(r[6]);matrix.scale(new Vector3(r[3],r[4],r[5]));}matrix.setPosition(r[0],r[1],r[2]);matrix.toArray(matrices,i*16);color.setHex(r[native?3:7]).toArray(colors,i*3);});
  mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:native,nativeMinecraft:native};mesh.computeBoundingBox();mesh.computeBoundingSphere();return mesh;
}

/** Authored strokes aligned with the measured left ceramic facade plane. */
function signSurfaces():Surface[]{
  const dx=43.026,dz=8.051,len=Math.hypot(dx,dz);
  const at=(u:number,y:number):number[]=>[5296.569+dx/len*(4.65+u)-dz/len*.29,y,341.813+dz/len*(4.65+u)+dx/len*.29];
  const triangles:number[][][]=[];
  for(const path of letteringStrokePaths("KOSMOS",.83))for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],du=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(du,dy);if(!length)continue;
    const u=-.045*dy/length,v=.045*du/length;
    const q=[at(a[0]+u,7.93+a[1]+v),at(b[0]+u,7.93+b[1]+v),at(b[0]-u,7.93+b[1]-v),at(a[0]-u,7.93+a[1]-v)];triangles.push([q[0],q[1],q[2]],[q[0],q[2],q[3]]);
  }return[{color:0x293D45,triangles}];
}
function nativeAccents():number[][]{
  const cells=new Map<string,number[]>();
  const put=(x:number,y:number,z:number,color:number)=>{const c=[Math.floor((x-.275)/.5),Math.floor(y/.5),Math.floor((z+1.471)/.5)];cells.set(c.join(","),[c[0]*.5+.25,c[1]*.5+.25,c[2]*.5+.25,color,.5]);};

  for(const r of source.facadeBoxes){if(r[8]===5)continue;for(let u=-r[3]/2+.1;u<r[3]/2;u+=.44)for(let v=-r[4]/2+.04;v<r[4]/2;v+=.44)put(r[0]+Math.cos(r[6])*u,r[1]+v,r[2]-Math.sin(r[6])*u,r[7]);}
  for(const s of signSurfaces())for(const [a,b,c] of s.triangles){const steps=Math.max(1,Math.ceil(Math.max(Math.hypot(...a.map((v,i)=>v-b[i])),Math.hypot(...a.map((v,i)=>v-c[i])))/.22));for(let i=0;i<=steps;i++)for(let j=0;j<=steps-i;j++)put(...a.map((v,k)=>v+(b[k]-v)*i/steps+(c[k]-v)*j/steps) as [number,number,number],s.color);}
  return [...cells.values()];
}
export function createKosmosV166(_options:{mobileLike?:boolean}={}):Group{
  const root=new Group();root.name=KOSMOS_V166_GROUP;root.userData={textureFree:true,sourceEnvelopeRetained:true,sourcePartIds:source.parts.map(p=>p.id),renderBudget:KOSMOS_V166_RENDER_BUDGET,currentUse:"event venue",userNameMatch:"uncertain"};
  const shell=surfacesMesh([...source.surfaces,...signSurfaces()]);shell.name="KOSMOS complete official roofs walls and authored lettering";
  const detail=instances(source.facadeBoxes);detail.name="KOSMOS ceramic bands foyer glass and curved auditorium masonry";
  root.add(shell,detail);return freezeStaticSceneTransforms(root);
}
export function createMinecraftKosmosV166(_options:{mobileLike?:boolean}={}):Group{
  const root=new Group();root.name=KOSMOS_V166_NATIVE_GROUP;root.userData={textureFree:true,sourcePartIds:source.parts.map(p=>p.id),nativeMinecraft:true,keepInMinecraft:true,blockNative:true,noHiddenSolidInfill:true};
  const mesh=instances([...source.nativeBlocks,...nativeAccents()],true);mesh.name="Independent KOSMOS source surface blocks and orthogonal facade accents";root.add(mesh);return freezeStaticSceneTransforms(root);
}
