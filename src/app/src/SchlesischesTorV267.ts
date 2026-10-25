import { BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, ShapeUtils, Vector2, Vector3 } from 'three';
import data from './data/schlesischesTorV267.json';
import { SCHLESISCHES_TOR_V267_PROFILE, schlesischesTorPointV267, schlesischesTorRoofCellsV267, schlesischesTorStructuralRowsV267, type SchlesischesTorRowV267 } from './SchlesischesTorV267Profile';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import { letteringStrokePaths } from './drawnLettering';

type Point=[number,number,number];
type Triangle={points:Point[];tone:number;role:string};
const BRICK=0xa9614b,STONE=0xcbbda4,DARK=0x42594f,GLASS=0x3c5353,ROOF=0xb96a49;

export function schlesischesTorGeometryV267(native=false){
  const rows:SchlesischesTorRowV267[]=schlesischesTorStructuralRowsV267(native),triangles:Triangle[]=[];
  const emit=(position:Point,size:Point,tone:number,role:string,angle=0)=>rows.push({position,size,tone,role,angle});
  const tri=(a:Point,b:Point,c:Point,tone:number,role:string)=>triangles.push({points:[a,b,c],tone,role});
  const quad=(a:Point,b:Point,c:Point,d:Point,tone:number,role:string)=>{tri(a,b,c,tone,role);tri(a,c,d,tone,role);};
  const facadeRing=native?data.nativeRing:data.ring;
  let area=0;for(let i=0;i<facadeRing.length;i++){const a=facadeRing[i],b=facadeRing[(i+1)%facadeRing.length];area+=a[0]*b[1]-b[0]*a[1];}
  const sign=area>0?1:-1;
  for(let edge=0;edge<facadeRing.length;edge++){
    const a=facadeRing[edge],b=facadeRing[(edge+1)%facadeRing.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.15)continue;
    const dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length,nx=dz*sign,nz=-dx*sign,angle=-Math.atan2(dz,dx);
    const panel=(u:number,y:number,w:number,h:number,out:number,d:number,tone:number,role:string)=>{
      if(w<=0||h<=0||u-w/2<-.01||u+w/2>length+.01)return;
      const n=native?Math.max(1,Math.ceil(w/.55)):1,step=w/n;
      for(let i=0;i<n;i++){
        const q=u-w/2+(i+.5)*step;
        emit([a[0]+dx*q+nx*out,y,a[1]+dz*q+nz*out],native?[Math.abs(dx)*step+Math.abs(nx)*d,h,Math.abs(dz)*step+Math.abs(nz)*d]:[w,h,d],tone,role,native?0:angle);
      }
    };
    panel(length/2,(3+data.baseTopY)/2,length,data.baseTopY-3,.055,.09,BRICK,'source-bound-red-brick');
    for(const [y,h,out] of [[3.45,.55,.16],[8.95,.45,.19],[13.18,.18,.21],[13.57,.25,.28]])panel(length/2,y,length,h,out,.20,STONE,'sandstone-string-and-eave-course');
    if(length>1.2)for(let j=0;j<27;j++)panel(length/2,4.0+j*.33,length,.024,.111,.02,0x8f5445,'brick-mortar-course');
    if(length<2.8)continue;
    const arch=(u:number,bottom:number,spring:number,r:number,openTone:number,role:string)=>{
      const samples=22,step=2*r/samples;
      for(let i=0;i<samples;i++){
        const off=-r+(i+.5)*step,h=spring+Math.sqrt(Math.max(0,r*r-off*off))-bottom;
        panel(u+off,bottom+h/2,step+.003,h,.25,.12,openTone,role+'-recess');
      }
      for(let i=0;i<24;i++){
        const t=(i+.5)*Math.PI/24;
        panel(u+Math.cos(t)*(r+.16),spring+Math.sin(t)*(r+.16),.23,.23,.37,.23,STONE,role+'-archivolt');
      }
      for(const s of [-1,1]){
        panel(u+s*(r+.14),(bottom+spring)/2,.22,spring-bottom,.37,.25,STONE,role+'-jamb');
        panel(u+s*(r+.14),spring,.42,.25,.44,.37,STONE,role+'-capital');
      }
      panel(u,spring+r+.18,.35,.48,.40,.28,STONE,role+'-keystone');
    };
    if(native?data.nativePortalEdges.includes(edge):edge===51){
      for(const u of native?[length/2]:[length*.25,length*.75]){
        arch(u,3.12,6.63,native?1.45:1.77,0x3a443e,'paired-portal');
        panel(u,4.65,2.55,2.9,.34,.08,0x56645a,'closed-door-interpretation');
        for(const dx of [-.8,0,.8])panel(u+dx,4.65,.075,2.9,.41,.075,STONE,'portal-door-bar');
        for(let k=0;k<5;k++)panel(u+(k-2)*.22,9.45+(.18-Math.abs(k-2)*.06),.20,.26,.38,.22,STONE,'portal-carved-pediment-silhouette');
      }
      for(const u of native?[length*.25,length*.75]:[length*.2,length*.5,length*.8]){
        arch(u,10.0,12.0,native?.52:.72,GLASS,'grouped-upper-window');
        panel(u,11.1,.065,2.3,.4,.08,STONE,'upper-window-mullion');
      }
      // This stays a closed source-owned exterior. No interior or doorway
      // navigation exception is implied by the relief above its old wall.
    }else{
      const count=Math.max(1,Math.round(length/3.3)),pitch=length/count;
      for(let i=0;i<count;i++){
        const u=(i+.5)*pitch,r=Math.min(.70,(pitch-.9)/2);
        if(r<.4)continue;
        arch(u,9.65,12.1,r,GLASS,'platform-arched-window');
        panel(u,10.95,.07,2.4,.39,.07,STONE,'window-mullion');
        panel(u,10.7,r*2,.07,.39,.07,STONE,'window-transom');
        if(length>4)arch(u,4.0,6.3,r*.85,0x4c5e54,'lower-shop-window');
      }
    }
    for(const u of [.28,length-.28])panel(u,6.2,.32,5.2,.24,.20,STONE,'sandstone-corner-quoin');
  }
  if(native)rows.push(...schlesischesTorRoofCellsV267());
  else{
    for(const roof of data.roofs)for(let index=0;index<roof.faces.length;index++){
      const points=roof.faces[index] as Point[];
      for(const f of ShapeUtils.triangulateShape(points.map(p=>new Vector2(p[0],p[2])),[]))tri(points[f[0]],points[f[1]],points[f[2]],[ROOF,0xc07855,0xa6573d,0xb56b4c][index%4],roof.name);
    }
    const [cx,cz]=data.tower.centre,profile=data.tower.profile;
    for(let j=1;j<profile.length;j++)for(let i=0;i<48;i++){
      const a=i*Math.PI/24,b=(i+1)*Math.PI/24,[h0,r0]=profile[j-1],[h1,r1]=profile[j];
      quad([cx+r0*Math.cos(a),data.baseTopY+h0,cz+r0*Math.sin(a)],[cx+r0*Math.cos(b),data.baseTopY+h0,cz+r0*Math.sin(b)],[cx+r1*Math.cos(b),data.baseTopY+h1,cz+r1*Math.sin(b)],[cx+r1*Math.cos(a),data.baseTopY+h1,cz+r1*Math.sin(a)],i%4===0?0xab6043:ROOF,'curved-west-tower-helm');
    }
  }
  const [dx,dz]=data.direction,localPanel=(u:number,y:number,v:number,w:number,h:number,d:number,tone:number,role:string)=>{
    const n=native?Math.max(1,Math.ceil(w/.4)):1;
    for(let i=0;i<n;i++)emit(schlesischesTorPointV267(u-w/2+(i+.5)*w/n,y,v),native?[Math.abs(dx)*w/n+Math.abs(dz)*d,h,Math.abs(dz)*w/n+Math.abs(dx)*d]:[w,h,d],tone,role,native?0:-Math.atan2(dz,dx));
  };
  // Pierced stone crown is separate from the curved tile roof, as photographed.
  for(const y of [19.0,20.45])localPanel(-17,y,9.1,4.85,.22,1.3,STONE,'tower-pierced-crown-cap');
  for(let i=0;i<6;i++)localPanel(-19.1+i*.84,19.75,9.1,.18,1.4,1.0,STONE,'tower-pierced-crown-pier');
  for(let i=0;i<5;i++)for(let j=0;j<10;j++){
    const t=(j+.5)*Math.PI/10;localPanel(-18.68+i*.84+Math.cos(t)*.32,20.0+Math.sin(t)*.32,9.1,.13,.13,1.0,STONE,'tower-crown-arch');
  }
  localPanel(-19.1,21.7,9.1,.11,3.2,.11,0x648071,'tower-finial');
  localPanel(-19.1,20.8,9.1,.45,.16,.45,0x648071,'tower-finial-base');
  // Steelwork is restricted to the retained western track excerpts. The east
  // 223m roof/viaduct owner and every existing road/path remain untouched.
  const stroke=(a:Point,b:Point,width:number,tone:number,role:string)=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),n=Math.max(1,Math.ceil(length/(native?.20:.14)));
    for(let i=0;i<n;i++){const t=(i+.5)/n;emit([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],[width,width,width],tone,role);}
  };
  for(const track of data.tracks)for(let segment=1;segment<track.points.length;segment++){
    const a=track.points[segment-1],b=track.points[segment],length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
    const at=(u:number,y:number,v:number):Point=>[a[0]+dx*u-dz*v,y,a[1]+dz*u+dx*v];
    for(const v of [-.7175,.7175])stroke(at(0,9.04,v),at(length,9.04,v),.13,0x7e8982,'1435mm-gauge-rail');
    for(const v of [-1.51,1.51]){
      for(const y of [8.1,9.2,10.25])stroke(at(0,y,v),at(length,y,v),.12,DARK,'steel-girder-and-railing-chord');
      for(let u=.4;u<length;u+=1.15)stroke(at(u,9.2,v),at(u,10.25,v),.055,DARK,'railing-baluster');
      for(let u=0;u<length-3.2;u+=3.2){stroke(at(u,8.15,v),at(u+3.2,9.12,v),.12,DARK,'lattice-girder-brace');stroke(at(u,9.12,v),at(u+3.2,8.15,v),.12,DARK,'lattice-girder-brace');}
    }
  }
  // Two small literal U identifiers; no raster lettering or route animation.
  for(const u of [-8,12]){
    localPanel(u,10.65,8.7,1.3,1.35,.12,0x23578a,'station-u-sign');
    const paths=letteringStrokePaths('U',.7);
    for(const path of paths)for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i];stroke(schlesischesTorPointV267(u-a[0]+.25,10.20+a[1],8.80),schlesischesTorPointV267(u-b[0]+.25,10.20+b[1],8.80),.08,0xf2f0dc,'station-u-lettering');
    }
  }
  return{rows,triangles};
}

export function createSchlesischesTorV267(native=false,options:{mobileLike?:boolean;diagnostics?:boolean}={}):Group{
  const root=new Group();root.name='Schlesisches Tor source-bound station silhouette and west viaduct v267';
  const {rows,triangles}=schlesischesTorGeometryV267(native),geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute('uv');
  const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.85}),mesh=new InstancedMesh(geometry,day,0);
  const matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3),matrix=new Matrix4(),q=new Quaternion(),up=new Vector3(0,1,0),p=new Vector3(),s=new Vector3(),tint=new Color();
  rows.forEach((r,i)=>{matrix.compose(p.set(...r.position),q.setFromAxisAngle(up,r.angle),s.set(...r.size));matrix.toArray(matrices,i*16);tint.setHex(r.tone).toArray(colors,i*3);});
  mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};root.add(mesh);
  if(triangles.length){
    const positions=new Float32Array(triangles.length*9),colors=new Float32Array(positions.length);let offset=0;
    for(const t of triangles){tint.setHex(t.tone);for(const point of t.points){positions.set(point,offset);tint.toArray(colors,offset);offset+=3;}}
    const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(positions,3));g.setAttribute('color',new BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const d=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),n=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.85}),roof=new Mesh(g,d);roof.userData={dayMaterial:d,nightMaterial:n,textureFree:true};root.add(roof);
  }
  root.userData={...SCHLESISCHES_TOR_V267_PROFILE,instances:rows.length,triangles:triangles.length,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};
  if(options.diagnostics)root.userData.records={rows,triangles};
  return freezeStaticSceneTransforms(root);
}
