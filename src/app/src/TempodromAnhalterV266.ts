import { BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, ShapeUtils, Vector2, Vector3 } from 'three';
import data from './data/tempodromAnhalterV266.json';
import { anhalterMasonryRowsV266, anhalterPointV266, tempodromRoofAtV266, TEMPODROM_ANHALTER_V266_PROFILE, type AnhalterRowV266 } from './TempodromAnhalterV266Profile';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import { letteringStrokePaths } from './drawnLettering';

type Point=[number,number,number];
type Triangle={points:Point[];tone:number;role:string};
const WHITE=0xf0f0e8,SHADOW=0xd4d9d5,GLASS=0x40595d,STONE=0xc5b394,COPPER=0x4b655b;
const [DX,DZ]=data.portico.direction,ANGLE=-Math.atan2(DZ,DX);

export { tempodromRoofAtV266 } from './TempodromAnhalterV266Profile';

export function tempodromAnhalterGeometryV266(native=false){
  const rows:AnhalterRowV266[]=anhalterMasonryRowsV266(native),triangles:Triangle[]=[];
  const emit=(position:Point,size:Point,tone:number,role:string,angle=0)=>rows.push({position,size,tone,role,angle});
  const panel=(u:number,y:number,v:number,w:number,h:number,d:number,tone:number,role:string)=>{
    if(!native)emit(anhalterPointV266(u,y,v),[w,h,d],tone,role,ANGLE);
    else{const n=Math.max(1,Math.ceil(w/.24)),step=w/n;for(let i=0;i<n;i++)emit(anhalterPointV266(u-w/2+(i+.5)*step,y,v),[Math.abs(DX)*step+Math.abs(DZ)*d,h,Math.abs(DZ)*step+Math.abs(DX)*d],tone,role);}
  };
  const tri=(a:Point,b:Point,c:Point,tone:number,role:string)=>triangles.push({points:[a,b,c],tone,role});
  const quad=(a:Point,b:Point,c:Point,d:Point,tone:number,role:string)=>{tri(a,b,c,tone,role);tri(a,c,d,tone,role);};
  // Exact complete retained roof, including every original millimetre vertex.
  const roof=data.portico.roof[0].rings[0] as Point[],shape=roof.map(p=>new Vector2(p[0],p[2]));
  if(!native)for(const f of ShapeUtils.triangulateShape(shape,[]))tri(roof[f[0]],roof[f[1]],roof[f[2]],0x68716a,'complete-measured-portico-roof');
  else{
    // Independent orthogonal roof terraces retain the source envelope's slope.
    for(let u=-8.8;u<=8.8;u+=.4)for(let v=-3.2;v<=3.2;v+=.4)panel(u,16.225+v*.112,v,.4,.24,.4,0x68716a,'native-source-roof');
  }
  // Layered archivolts, cap courses and small terracotta panels.
  for(const v of [-3.51,3.44]){
    for(const u of [-5.45,0,5.45]){
      for(const radius of [2.12,2.40])for(let j=0;j<36;j++){
        const a=(j+.5)*Math.PI/36;
        panel(u+Math.cos(a)*radius,10.95+Math.sin(a)*radius,v,.19,.22,.12,j%2===0?STONE:0xbda77d,'layered-archivolt');
      }
      for(const s of [-1,1])panel(u+s*2.32,8.05,v,.16,5.7,.15,STONE,'arch-jamb-moulding');
    }
    for(const y of [14.40,15.15,15.68])panel(0,y,v,18.22,.18,.28,STONE,'portico-cornice');
    for(let u=-8.7;u<8.8;u+=.47)panel(u,14.02,v,.19,.23,.25,STONE,'portico-dentil');
    for(let u=-8.5;u<8.6;u+=.9){panel(u,14.83,v,.66,.43,.10,0x9d835c,'terracotta-frieze');panel(u,14.83,v+(v<0?-.06:.06),.38,.23,.10,STONE,'terracotta-frieze-relief');}
  }
  for(const u of [-5.45,0,5.45]){
    for(let i=0;i<40;i++){const a=i*Math.PI*2/40;panel(u+Math.cos(a)*1.34,20.25+Math.sin(a)*1.34,2.59,.17,.19,.17,STONE,'oculus-moulding');}
  }
  for(const u of [-8.5,-2.73,2.73,8.5]){
    panel(u,20.28,2.57,.72,3.45,.18,0x947b56,'vertical-relief-panel');
    for(let j=0;j<10;j++){panel(u+(j%2?-.15:.15),18.8+j*.32,2.45,.24,.22,.17,STONE,'terracotta-leaf-relief');}
  }
  for(let u=-9.0;u<=9;u+=.44)panel(u,23.25,2.48,.19,.24,.21,STONE,'rear-dentil');
  // Original compact sculptural silhouettes, deliberately not detailed sculpture copies.
  for(const side of [-1,1]){
    for(const [u,y,w,h] of [[side*2.45,24.1,2.5,.45],[side*2.6,24.55,1.9,.55],[side*2.8,25.12,.76,1.0],[side*2.57,25.85,.5,.54],[side*1.95,24.9,.55,.34]] as number[][])panel(u,y,3.12,w,h,.65,COPPER,'tag-nacht-silhouette');
    panel(side*7.65,16.35,-2.96,1.35,.35,.94,STONE,'allegory-plinth');
    panel(side*7.65,16.92,-2.96,.80,1.05,.57,STONE,'berolina-anhaltina-torso');
    panel(side*7.60,17.70,-2.94,.44,.52,.44,STONE,'berolina-anhaltina-head');
  }
  // Fine masonry courses preserve the large architectural hierarchy.
  for(const u of [-8.15,-2.75,2.75,8.15])for(let j=0;j<23;j++)panel(u,5.64+j*.23,-3.47,1.44,.025,.025,0x927b59,'brick-course');

  const t=data.tempodrom,point=(r:number,a:number):Point=>{const x=t.centre[0]+r*Math.cos(a),z=t.centre[1]+r*Math.sin(a);return[x,tempodromRoofAtV266(x,z)??14.45,z];};
  if(!native){
    const n=24,radial=18;
    for(let sector=0;sector<n;sector++){
      const a=.18+sector*Math.PI*2/n,b=.18+(sector+1)*Math.PI*2/n;
      for(let j=0;j<radial;j++){
        const r0=5.5+(t.radius-5.5)*j/radial,r1=5.5+(t.radius-5.5)*(j+1)/radial;
        quad(point(r0,a),point(r1,a),point(r1,b),point(r0,b),sector%2?SHADOW:WHITE,'twelve-fold-white-roof');
      }
      const A=point(t.radius,a),B=point(t.radius,b);
      quad([A[0],14.20,A[2]],A,B,[B[0],14.20,B[2]],GLASS,'radial-clerestory');
      const ca:Point=[t.centre[0]+5.5*Math.cos(a),35.75,t.centre[1]+5.5*Math.sin(a)],cb:Point=[t.centre[0]+5.5*Math.cos(b),35.75,t.centre[1]+5.5*Math.sin(b)];
      tri([t.centre[0],35.75,t.centre[1]],ca,cb,0x638183,'glazed-open-crown');
    }
  }else{
    const cell=.85;
    for(let ix=Math.floor((t.centre[0]-t.radius)/cell);ix<Math.ceil((t.centre[0]+t.radius)/cell);ix++)for(let iz=Math.floor((t.centre[1]-t.radius)/cell);iz<Math.ceil((t.centre[1]+t.radius)/cell);iz++){
      const x=(ix+.5)*cell,z=(iz+.5)*cell,y=tempodromRoofAtV266(x,z,true);if(y===null)continue;
      const r=Math.hypot(x-t.centre[0],z-t.centre[1]);
      emit([x,y-.22,z],[cell,.44,cell],r<5.5?0x638183:WHITE,r<5.5?'native-glazed-crown':'native-twelve-fold-roof');
    }
    for(let i=0;i<180;i++){const a=i*Math.PI*2/180,x=t.centre[0]+30.7*Math.cos(a),z=t.centre[1]+30.7*Math.sin(a),y=tempodromRoofAtV266(x,z,true)!;emit([x,(y+14.2)/2,z],[.7,Math.max(.2,y-14.2),.7],GLASS,'native-clerestory');}
  }
  // The source podium stays whole. Small glazing and cedar fins fit its real edges.
  const ring=t.retainedPrism.ring;
  for(let edge=0;edge<ring.length;edge++){
    const a=ring[edge].map(v=>v/10),b=ring[(edge+1)%ring.length].map(v=>v/10),len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len<20)continue;
    const dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len,n=Math.ceil(len/1.7),step=len/n;
    for(let i=0;i<n;i++){
      const u=(i+.5)*step,x=a[0]+dx*u+dz*.14,z=a[1]+dz*u-dx*.14;
      if(!native){emit([x,9.5,z],[step-.15,3.0,.09],GLASS,'podium-glazing',-Math.atan2(dz,dx));emit([x,12.1,z],[step-.15,1.25,.11],0x806f58,'cedar-spandrel',-Math.atan2(dz,dx));}
      else{emit([x,9.5,z],[Math.abs(dx)*(step-.15)+Math.abs(dz)*.10,3,Math.abs(dz)*(step-.15)+Math.abs(dx)*.10],GLASS,'native-podium-glazing');}
      emit([x,10.2,z],[.13,5.3,.13],0xb2afa0,'podium-mullion');
    }
  }
  // Small graphic lettering on the retained recessed north entrance.
  const label=letteringStrokePaths('TEMPODROM',.70),letterPoints=label.flat(),mid=(Math.min(...letterPoints.map(p=>p[0]))+Math.max(...letterPoints.map(p=>p[0])))/2;
  for(const path of label)for(let j=1;j<path.length;j++){
    const a=path[j-1],b=path[j],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.08));
    for(let k=0;k<n;k++){const q=(k+.5)/n,u=a[0]+(b[0]-a[0])*q-mid,y=12.55+a[1]+(b[1]-a[1])*q;emit([641.6-DX*u,y,1901.1-DZ*u],[.075,.075,.075],0xf4f2dc,'tempodrom-lettering');}
  }
  return{rows,triangles};
}

export function createTempodromAnhalterV266(native=false,options:{mobileLike?:boolean;diagnostics?:boolean}={}):Group{
  const root=new Group();root.name='Tempodrom folded roof and Anhalter portico v266';
  const {rows,triangles}=tempodromAnhalterGeometryV266(native),geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute('uv');
  const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.86});
  const mesh=new InstancedMesh(geometry,day,0),matrices=new Float32Array(rows.length*16),colours=new Float32Array(rows.length*3),matrix=new Matrix4(),q=new Quaternion(),up=new Vector3(0,1,0),p=new Vector3(),s=new Vector3(),color=new Color();
  rows.forEach((r,i)=>{matrix.compose(p.set(...r.position),q.setFromAxisAngle(up,r.angle),s.set(...r.size));matrix.toArray(matrices,i*16);color.setHex(r.tone).toArray(colours,i*3);});
  mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colours,3);
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  if(triangles.length){
    const positions=new Float32Array(triangles.length*9),colors=new Float32Array(positions.length);let offset=0;
    for(const t of triangles){color.setHex(t.tone);for(const point of t.points){positions.set(point,offset);color.toArray(colors,offset);offset+=3;}}
    const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(positions,3));g.setAttribute('color',new BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const d=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),n=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.82});
    const roof=new Mesh(g,d);roof.name='Twelve roof folds and complete original portico roof';roof.userData={dayMaterial:d,nightMaterial:n,textureFree:true};root.add(roof);
  }
  root.userData={...TEMPODROM_ANHALTER_V266_PROFILE,instances:rows.length,triangles:triangles.length,sourceEnvelopeRetained:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};
  if(options.diagnostics)root.userData.records={rows,triangles};
  return freezeStaticSceneTransforms(root);
}
