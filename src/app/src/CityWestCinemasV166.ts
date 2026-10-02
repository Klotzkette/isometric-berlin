import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import source from "./data/cityWestCinemasV166Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";

export const CITYWEST_CINEMAS_V166_GROUP = "City West cinemas Savignyplatz and surveyed FÜRST architecture";
export const CITYWEST_CINEMAS_V166_NATIVE_GROUP = "City West cinemas Savignyplatz and FÜRST native blocks";
export const CITYWEST_CINEMAS_V166_RENDER_BUDGET = /* @__PURE__ */ (() => Object.freeze({
  parents: source.parents.length, parts: source.parts.length,
  facadeInstances: source.facadeBoxes.length, get nativeSourceBlocks() { return source.nativeBlocks.length; },
  drawnBatches: 3, nativeBatches: 1,
}))();

type Surface = {color:number;triangles:number[][][]};
function surfacesMesh(surfaces: Surface[]): Mesh {
  const count=surfaces.reduce((n,s)=>n+s.triangles.length*9,0);
  const positions=new Float32Array(count),colors=new Float32Array(count),color=new Color();let offset=0;
  for(const s of surfaces){color.setHex(s.color);for(const t of s.triangles)for(const p of t){positions.set(p,offset);colors.set([color.r,color.g,color.b],offset);offset+=3;}}
  const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(positions,3));geometry.setAttribute("color",new BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
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

/** Text is authored stroke geometry, following the actual curved auditorium. */
function signSurfaces():Surface[]{
  const zooPoints=source.surfaces.filter(s=>s.partId==="DEBE3DjeP5aTIgFW"&&s.kind==="WallSurface")
    .flatMap(s=>s.rings.flat().filter(p=>p[1]>28.85&&p[2]>1370&&p[0]<-2557))
    .map(p=>[p[0],p[2]]).sort((a,b)=>a[0]-b[0]);
  const curve=zooPoints.filter((p,i)=>i===0||p[0]!==zooPoints[i-1][0]);
  const lengths=[0];for(let i=1;i<curve.length;i++)lengths.push(lengths[i-1]+Math.hypot(curve[i][0]-curve[i-1][0],curve[i][1]-curve[i-1][1]));
  const zooAt=(u:number,y:number):number[]=>{const distance=lengths.at(-1)!/2+u;let k=1;while(k<lengths.length-1&&lengths[k]<distance)k++;const a=curve[k-1],b=curve[k],len=lengths[k]-lengths[k-1],t=(distance-lengths[k-1])/len,dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;return[a[0]+(b[0]-a[0])*t-dz*.23,y,a[1]+(b[1]-a[1])*t+dx*.23];};
  const kantAt=(u:number,y:number):number[]=>{const dx=27.297,dz=3.126,len=Math.hypot(dx,dz),v=21.2+u;return[-4329.524+dx/len*v-dz/len*.7,y,1250.986+dz/len*v+dx/len*.7];};
  const triangles:number[][][]=[];
  for(const label of [{text:"ZOO PALAST",height:1.72,y:26.4,at:zooAt},{text:"KANT KINO",height:.39,y:8.76,at:kantAt}]){
    for(const path of letteringStrokePaths(label.text,label.height))for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],du=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(du,dy);if(!length)continue;
      const stroke=label.height*.045,u=-stroke*dy/length,v=stroke*du/length;
      const q=[label.at(a[0]+u,label.y+a[1]+v),label.at(b[0]+u,label.y+b[1]+v),label.at(b[0]-u,label.y+b[1]-v),label.at(a[0]-u,label.y+a[1]-v)];triangles.push([q[0],q[1],q[2]],[q[0],q[2],q[3]]);
    }
  }return[{color:0xF0EAD8,triangles}];
}
function nativeAccents():number[][]{
  const cells=new Map<string,number[]>();
  const put=(x:number,y:number,z:number,color:number)=>{const c=[Math.floor(x/.5),Math.floor(y/.5),Math.floor(z/.5)];cells.set(c.join(","),[c[0]*.5+.25,c[1]*.5+.25,c[2]*.5+.25,color,.5]);};
  for(const s of signSurfaces())for(const t of s.triangles){const [a,b,c]=t,span=Math.max(Math.hypot(...a.map((v,i)=>v-b[i])),Math.hypot(...a.map((v,i)=>v-c[i]))),steps=Math.ceil(span/.25);for(let i=0;i<=steps;i++)for(let j=0;j<=steps-i;j++)put(...a.map((v,k)=>v+(b[k]-v)*i/steps+(c[k]-v)*j/steps) as [number,number,number],s.color);}
  // Source-bound signboards, five pilasters and balcony edges have their own
  // orthogonal half-metre native skin; no smooth detail root survives this mode.
  for(const r of source.facadeBoxes){if(r[8]<6)continue;for(let u=-r[3]/2;u<r[3]/2;u+=.45)for(let v=-r[4]/2;v<r[4]/2;v+=.45)put(r[0]+Math.cos(r[6])*u,r[1]+v,r[2]-Math.sin(r[6])*u,r[7]);}
  return [...cells.values()];
}
export function createCityWestCinemasV166(_options:{mobileLike?:boolean}={}):Group{
  const root=new Group();root.name=CITYWEST_CINEMAS_V166_GROUP;root.userData={textureFree:true,sourceEnvelopeRetained:true,sourcePartIds:source.parts.map(p=>p.id),renderBudget:CITYWEST_CINEMAS_V166_RENDER_BUDGET};
  const shell=surfacesMesh([...source.surfaces,...source.pavingSurfaces]);shell.name="Complete official City West roofs walls and mapped Savignyplatz paths";
  const detail=instances(source.facadeBoxes);detail.name="Source clipped City West facade and garden edge details";
  const signs=surfacesMesh(signSurfaces());signs.name="Zoo Palast curved lettering and Kant Kino entrance lettering";
  root.add(shell,detail,signs);return freezeStaticSceneTransforms(root);
}
export function createMinecraftCityWestCinemasV166(_options:{mobileLike?:boolean}={}):Group{
  const root=new Group();root.name=CITYWEST_CINEMAS_V166_NATIVE_GROUP;root.userData={textureFree:true,sourcePartIds:source.parts.map(p=>p.id),nativeMinecraft:true,keepInMinecraft:true,blockNative:true,noHiddenSolidInfill:true};
  const mesh=instances([...source.nativeBlocks,...nativeAccents()],true);mesh.name="Independent City West surface blocks and native cinema accents";root.add(mesh);return freezeStaticSceneTransforms(root);
}
