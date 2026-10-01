import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2, Vector3 } from "three";
import source from "./data/kranzlerV165Source.json";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
type P=[number,number,number];
type Tri={color:number;triangles:number[][][]};
export const KRANZLER_V165_GROUP="Kranzler Eck exact glass wedge and striped cafe rotunda";
export const KRANZLER_V165_NATIVE_GROUP="Kranzler Eck independent native blocks";
function boxBatch(rows: readonly number[][]): InstancedMesh {
  const g=new BoxGeometry(1,1,1);g.deleteAttribute("uv");
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
  g.computeVertexNormals();const mesh=new Mesh(g,day);mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};g.computeBoundingBox();g.computeBoundingSphere();return mesh;
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

function ornament(g:Garden):void {
  // LoD2 pavilion centre and measured roof elevation; awning perimeter uses
  // OSM way 474593825. Small strips/rails are explicit visual proportions.
  const x=-2787.195,z=1579.49,n=96,at=(t:number,r:number,y:number):P=>[x+Math.cos(t)*r,y,z+Math.sin(t)*r];
  for(let i=0;i<n;i++){
    const t=i*Math.PI*2/n,u=(i+1)*Math.PI*2/n,c=i%2?0xe9ddc7:0x9c3d35;
    g.face(c,[at(t,6.6,19.35),at(u,6.6,19.35),at(u,8.45,18.60),at(t,8.45,18.60)]);
    g.face(c,[at(t,8.45,18.60),at(u,8.45,18.60),at(u,8.45,18.33),at(t,8.45,18.33)]);
    for(const h of [15.60,16.35])g.line(0xb7a77c,at(t,8.18,h),at(u,8.18,h),.075);
    if(i%2===0)g.line(0xd8d6b9,at(t,8.18,15.62),at(t,8.18,16.35),.055);
  }
  const yaw=-.42,paths=letteringStrokePaths("KRANZLER",1.25),width=Math.max(...paths.flat().map(p=>p[0]));
  const point=(p:number[]):P=>[x+Math.cos(yaw)*(p[0]-width/2)+Math.sin(yaw)*7.2,21.75+p[1],z-Math.sin(yaw)*(p[0]-width/2)+Math.cos(yaw)*7.2];
  for(const path of paths)for(let i=1;i<path.length;i++)g.line(0xb7a56b,point(path[i-1]),point(path[i]),.095);
}
function create(native:boolean):Group {
  const root=new Group();root.name=native?KRANZLER_V165_NATIVE_GROUP:KRANZLER_V165_GROUP;
  root.userData={textureFree:true,blockNative:native,keepInMinecraft:native,fullStaticDetailOnTouch:true,sourceGeometryRetained:true,sourcePartIds:source.parts.map(p=>p.id)};
  if(native){root.add(boxBatch(source.nativeRuns.map(([x,y,z,w,h,d,c])=>[x,y,z,w,h,d,0,c])));}
  else{root.add(triangles(source.surfaces),boxBatch(source.facadeBoxes));}
  const props=new Garden(native);ornament(props);root.add(boxBatch(props.boxes));
  if(props.sheets.length)root.add(triangles(props.sheets));
  return freezeStaticSceneTransforms(root);
}
export function createKranzlerV165():Group{return create(false);}
export function createMinecraftKranzlerV165():Group{return create(true);}
