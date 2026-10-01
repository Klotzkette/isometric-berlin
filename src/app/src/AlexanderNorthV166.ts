import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import source from "./data/alexanderNorthV166Source.json";
import nav from "./data/alexanderNorthV166Navigation.json";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const ALEXANDER_NORTH_V166_GROUP = "Alexander north: complete Park Inn, Pressehaus, Tor and street sources";
export const ALEXANDER_NORTH_V166_NATIVE_GROUP = "Alexander north: independent orthogonal native skin";
type P = [number,number,number];
type Instance = { matrix: Matrix4; color: number };

function boxes(rows: readonly number[][]): Instance[] {
  return rows.map(r => {
    const matrix = new Matrix4().makeRotationY(r[6]);
    matrix.scale(new Vector3(r[3],r[4],r[5])); matrix.setPosition(r[0],r[1],r[2]);
    return {matrix,color:r[7]};
  });
}
function batch(rows: readonly Instance[]): InstancedMesh {
  const geometry=new BoxGeometry(1,1,1); geometry.deleteAttribute("uv");
  const day=new MeshBasicMaterial({color:0xffffff});
  const night=new MeshStandardMaterial({color:0xffffff,flatShading:true,roughness:.87});
  const mesh=new InstancedMesh(geometry,day,0), colors=new Float32Array(rows.length*3), matrices=new Float32Array(rows.length*16), c=new Color();
  rows.forEach((r,i)=>{r.matrix.toArray(matrices,16*i);c.setHex(r.color).toArray(colors,3*i);});
  mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};mesh.computeBoundingBox();mesh.computeBoundingSphere();return mesh;
}
function sourceSheets(): Mesh {
  const points:number[]=[],colors:number[]=[],c=new Color();
  for(const s of source.surfaces){c.setHex(s.color);for(const t of s.triangles)for(const p of t){points.push(...p);colors.push(c.r,c.g,c.b);}}
  const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(points,3));geometry.setAttribute("color",new Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,flatShading:true,roughness:.9});
  const mesh=new Mesh(geometry,day);mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,completeSourceSurfaces:true};return mesh;
}

/** Lettering, masts and frame dimensions are independently authored estimates. */
function recognition(native: boolean): Instance[] {
  const result:Instance[]=[];
  function cube(c:number,p:P,w:number,h:number,d:number):void {result.push(...boxes([[...p,w,h,d,0,c]]));}
  function rod(c:number,a:P,b:P,width:number):void {
    const start=new Vector3(...a),end=new Vector3(...b),axis=end.clone().sub(start),len=axis.length();
    if(native){const n=Math.max(1,Math.ceil(len/Math.max(.20,width)));for(let i=0;i<=n;i++){const p=start.clone().lerp(end,i/n);cube(c,p.toArray() as P,width,width,width);}return;}
    const q=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),axis.normalize());
    result.push({color:c,matrix:new Matrix4().compose(start.add(end).multiplyScalar(.5),q,new Vector3(width,len,width))});
  }
  function text(label:string,at:P,tangent:P,height:number,color:number,width=.10):void {
    const paths=letteringStrokePaths(label,height),span=Math.max(...paths.flat().map(p=>p[0]));
    const point=(p:readonly number[]):P=>[at[0]+tangent[0]*(p[0]-span/2),at[1]+p[1],at[2]+tangent[2]*(p[0]-span/2)];
    for(const path of paths)for(let i=1;i<path.length;i++)rod(color,point(path[i-1]),point(path[i]),width);
  }
  function front(partId:string,headingX=0,headingZ=1): {a:number[];b:number[];dx:number;dz:number;length:number;nx:number;nz:number;top:number} {
    const p=nav.parts.find(p=>p.id===partId)!;
    const edges=p.ring.map((a,i)=>{const b=p.ring[(i+1)%p.ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);return{a,b,dx:dx/length,dz:dz/length,length,nx:dz/length,nz:-dx/length,top:p.top_y_m};});
    // Choose a long southern exposure. Clockwise source ground rings have the
    // opposite normals, so the outward point is checked against the centroid.
    const center=p.ring.reduce((v,q)=>[v[0]+q[0]/p.ring.length,v[1]+q[1]/p.ring.length],[0,0]);
    for(const e of edges)if(e.nx*((e.a[0]+e.b[0])/2-center[0])+e.nz*((e.a[1]+e.b[1])/2-center[1])<0){e.nx*=-1;e.nz*=-1;}
    return edges.filter(e=>e.nx*headingX+e.nz*headingZ>.1).sort((a,b)=>b.length-a.length)[0]??edges.sort((a,b)=>b.length-a.length)[0];
  }
  const park=front("DEBE3DeEvGXQZFW3"),mid:P=[(park.a[0]+park.b[0])/2+park.nx*.35,park.top-5.1,(park.a[1]+park.b[1])/2+park.nz*.35];
  const tangent:P=park.dx<0?[-park.dx,0,-park.dz]:[park.dx,0,park.dz];
  text("PARK INN",mid,tangent,2.85,0x194777,.23);
  for(const t of [-.34,.34]){
    const at:P=[mid[0]+tangent[0]*park.length*t,park.top,mid[2]+tangent[2]*park.length*t];
    rod(0xA9A6A0,at,[at[0],at[1]+17.5,at[2]],native?.36:.15);
    for(let y=5;y<17;y+=3.8)rod(0xA9A6A0,[at[0]-.65,at[1]+y,at[2]],[at[0]+.65,at[1]+y,at[2]],.12);
  }
  const tor=front("DEBE3DYRpubWolUn");
  text("SCHOENHAUSER TOR",[(tor.a[0]+tor.b[0])/2+tor.nx*.26,7.1,(tor.a[1]+tor.b[1])/2+tor.nz*.26],tor.dx<0?[-tor.dx,0,-tor.dz]:[tor.dx,0,tor.dz],.82,0xECEBDD,.075);
  // Published rooftop identity, fitted around the retained LoD2 sign support.
  const center:P=[2756.45,77.3,-553.15],radius=3.2;
  for(let i=0;i<40;i++){
    const a=i*Math.PI/20,b=(i+1)*Math.PI/20;
    for(const y of [77.3,79.45])rod(0xD5D6C8,[center[0]+Math.cos(a)*radius,y,center[2]+Math.sin(a)*radius],[center[0]+Math.cos(b)*radius,y,center[2]+Math.sin(b)*radius],.10);
  }
  text("BERLINER",[center[0],77.55,center[2]+3.28],[1,0,0],.83,0xF0EFDC,.105);
  text("VERLAG",[center[0],77.55,center[2]-3.28],[-1,0,0],.83,0xF0EFDC,.105);
  // The official operator + exact OSM node identify this restaurant. The
  // text is a simple locator, not a facsimile of any sign, logo or portrait.
  const vuong=front("DEBE3DTSFeK8a2Bb",-1,0);
  text("MONSIEUR VUONG",[(vuong.a[0]+vuong.b[0])/2+vuong.nx*.26,5.5,(vuong.a[1]+vuong.b[1])/2+vuong.nz*.26],vuong.dx<0?[-vuong.dx,0,-vuong.dz]:[vuong.dx,0,vuong.dz],.42,0xCDBEA3,.07);
  return result;
}

function create(native:boolean):Group {
  const root=new Group();root.name=native?ALEXANDER_NORTH_V166_NATIVE_GROUP:ALEXANDER_NORTH_V166_GROUP;
  root.userData={textureFree:true,blockNative:native,keepInMinecraft:native,fullStaticDetailOnTouch:true,sourceGeometryRetained:true,sourcePartIds:source.partIds,sourceOwnerIds:nav.outerOwners.map(p=>p.id),detailStatus:"Source metric envelopes; bounded procedural facade, sign and mast estimates. Berlinian is an unfinished structural shell."};
  if(native)root.add(batch(boxes(source.nativeRuns.map(([x,y,z,w,h,d,c])=>[x,y,z,w,h,d,0,c]))));
  else root.add(sourceSheets(),batch(boxes(source.facadeBoxes)));
  root.add(batch(recognition(native)));return freezeStaticSceneTransforms(root);
}
export function createAlexanderNorthV166():Group { return create(false); }
export function createMinecraftAlexanderNorthV166():Group { return create(true); }
