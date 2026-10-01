import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2, Vector3 } from "three";
import source from "./data/mitteHeritageV166Source.json";
import { createMitteHeritageOrnamentRows } from "./MitteHeritageOrnamentsV166";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
type P=[number,number,number];
type Tri={color:number;triangles:number[][][]};
export const MITTE_HERITAGE_V166_GROUP="Mitte parks cemeteries and measured historical buildings";
export const MITTE_HERITAGE_V166_NATIVE_GROUP="Mitte heritage independent native blocks";
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

function landscape(d:Garden):void {
  for(const p of source.props){
    const t=p.tags as unknown as Record<string,string>,x=p.x,y=p.y,z=p.z;
    if(t.amenity==="bench"){
      const deg=Number(t.direction),yaw=Number.isFinite(deg)?deg*Math.PI/180:0;
      d.box(0x7e7255,x,y+.52,z,1.8,.12,.55,yaw);
      for(const dx of[-.65,.65])d.box(0x4c5650,x+dx,y+.25,z,.1,.5,.45);
      for(const h of[.85,1.1])d.box(0x8a795c,x,y+h,z+.23,1.8,.14,.08,yaw);
    }else if(t.natural==="tree"&&y===3){
      // Inner parks retain their official tree layer; only the outer extension
      // receives these extra OSM anchors. No full/mobile drawn reduction.
      if(d.native&&Number(p.id)%3!==0)continue;
      const height=Math.max(4,Math.min(24,Number(t.height)||9));
      d.box(0x655944,x,y+height*.37,z,.32,height*.74,.32);
      const radius=Math.min(4.5,height*.3);
      if(d.native){for(const [h,r] of [[.50,.85],[.68,1],[.85,.66]])d.box(0x688952,x,y+height*h,z,radius*r*2,height*.18,radius*r*2);}
      else{
        // Broadleaf park trees: a faceted rounded crown, not stacked conifers.
        const at=(latitude:number,longitude:number):P=>[x+Math.cos(latitude)*Math.cos(longitude)*radius,y+height*.72+Math.sin(latitude)*height*.29,z+Math.cos(latitude)*Math.sin(longitude)*radius];
        for(let k=0;k<8;k++)for(let i=0;i<12;i++){
          const a=-Math.PI/2+k*Math.PI/8,b=a+Math.PI/8,u=i*Math.PI/6,v=u+Math.PI/6;
          d.face((i+k)%3?0x6e915b:0x638953,[at(a,u),at(a,v),at(b,v),at(b,u)]);
        }
      }
    }else if(t.playground==="swing"){
      for(const dx of[-1.7,1.7])for(const dz of[-.9,.9])d.line(0x867357,[x+dx,y,z+dz],[x+dx,y+2.5,z],.11);
      d.line(0x867357,[x-1.8,y+2.5,z],[x+1.8,y+2.5,z],.13);
      for(const dx of[-.65,.65]){d.box(0x515a4b,x+dx,y+.55,z,.48,.07,.3);for(const sx of[-.19,.19])d.line(0x636b65,[x+dx+sx,y+.55,z],[x+dx+sx,y+2.5,z],.025);}
    }else if(t.playground==="slide"){
      d.box(0x9c7653,x,y+1.7,z,1.1,.15,1.1);
      for(const dx of[-.46,.46])d.line(0x8b765b,[x+dx,y,z],[x+dx,y+1.7,z],.09);
      d.line(0xb4b8ac,[x,y+1.8,z],[x+2.4,y+.2,z],.55);
    }else if(t.cemetery==="grave"){
      // Only an individually mapped grave anchor; dimensions are display
      // estimates. The records retain names without invented inscriptions.
      d.box(0x96917f,x,y+.14,z,1.25,.28,2.2);
      d.box(0xb5ae96,x,y+.8,z-.84,1.2,1.35,.2);
    }
  }
  for(const f of source.barriers){
    const t=f.tags as unknown as Record<string,string>,height=Math.min(4,Math.max(.5,Number(t.height)|| (t.barrier==="wall"?1.9:1.1)));
    for(let i=1;i<f.line.length;i++){
      const a=f.line[i-1],b=f.line[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.1)continue;
      // Each segment's source endpoint carries the same existing scene datum.
      const y=f.groundY,yaw=Math.atan2(a[1]-b[1],b[0]-a[0]);
      if(t.barrier==="wall"||t.barrier==="hedge")d.box(t.barrier==="wall"?0x9b8370:0x5b7d51,(a[0]+b[0])/2,y+height/2,(a[1]+b[1])/2,len,height,.32,yaw);
      else{
        for(const h of[.3,height])d.line(0x505b52,[a[0],y+h,a[1]],[b[0],y+h,b[1]],.045);
        const n=Math.ceil(len/1.8);for(let j=0;j<n;j++)d.box(0x4d584f,a[0]+(b[0]-a[0])*j/n,y+height/2,a[1]+(b[1]-a[1])*j/n,.075,height,.075);
      }
    }
  }
}
function create(native:boolean):Group {
  const root=new Group();root.name=native?MITTE_HERITAGE_V166_NATIVE_GROUP:MITTE_HERITAGE_V166_GROUP;
  root.userData={textureFree:true,blockNative:native,keepInMinecraft:native,fullStaticDetailOnTouch:true,sourceGeometryRetained:true,sourcePartIds:source.parts.map(p=>p.id)};
  if(native){root.add(boxBatch([...source.nativeRows,...source.groundRuns].map(([x,y,z,w,h,d,c])=>[x,y,z,w,h,d,0,c])));}
  else{root.add(triangles(source.surfaces),triangles(source.groundSurfaces),boxBatch(source.facadeBoxes));}
  const props=new Garden(native);landscape(props);
  const ornaments=createMitteHeritageOrnamentRows(native);props.boxes.push(...ornaments.boxes);props.sheets.push(...ornaments.surfaces);
  // Paint exact source-clipped window subdivision in the native reading,
  // using independent unrotated pieces, with no smooth wall double.
  if(native)for(const r of source.facadeBoxes)props.box(r[7],r[0],r[1],r[2],r[3],r[4],r[5],r[6]);
  root.add(boxBatch(props.boxes));if(props.sheets.length)root.add(triangles(props.sheets));
  return freezeStaticSceneTransforms(root);
}
export function createMitteHeritageV166():Group{return create(false);}
export function createMinecraftMitteHeritageV166():Group{return create(true);}
