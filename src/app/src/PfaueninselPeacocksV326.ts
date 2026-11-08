/** Six illustrative freely roaming peacocks, using the existing frame callback.
 * Shared path/clock identity; independent faceted and cardinal representations. */
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage,
  Frustum, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Sphere, Vector3,
  type Camera, type Object3D } from 'three';
import source from './data/southWestSitesV326.json';
import { isSceneMaterialProgramRetirementV321 } from './sceneMaterialPrograms';
import { isSceneGeometryGpuRetirementV309 } from './sceneGeometryGpuResidency';
import { advanceZooAnimalClockV282, createZooAnimalClockV282, prepareZooAnimalRouteV282,
  sampleZooAnimalPoseV282, type ZooAnimalPoseV282, type ZooAnimalClockV282 } from './zooAnimalMotionV282';
export { createZooAnimalClockV282 as createPfaueninselPeacockClockV326 } from './zooAnimalMotionV282';

type Route={id:string;siteId:string;sourcePath:string;routeXZ:[number,number][];groundY:number;speed:number;phase:number;white:boolean};
type Vertex={bird:number;x:number;y:number;z:number;fan:boolean;leg:number};
type NativePart={bird:number;x:number;y:number;z:number;w:number;h:number;d:number;fan:boolean;leg:number};
export const PFAUENINSEL_PEACOCKS_V326=Object.freeze({count:6,blue:4,white:2,maxBytes:650000,maxHz:10});
const activeAncestor=(root:Object3D)=>{for(let p:Object3D|null=root;p;p=p.parent)if(!p.visible)return false;return true;};
const ROUTE_CONTROL=4142574250;
const routeHash=()=>{let h=2166136261;const s=JSON.stringify(source.peacocks);for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};

/** No RAF, timer, media, per-frame allocations or shadow-atlas invalidation. */
export function createPfaueninselPeacocksV326(native=false,clock:ZooAnimalClockV282=createZooAnimalClockV282()):Group {
  const root=new Group();root.name='Pfaueninsel: four blue and two white moving peacocks v326';
  root.userData={textureFree:true,illustrativeOccupancy:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,movingPeacocksV326:true};
  const placements=source.peacocks as Route[];
  if(routeHash()!==ROUTE_CONTROL||placements.length!==6||placements.filter(q=>q.white).length!==2)throw Error('Incomplete Pfaueninsel peacock population or changed island routes');
  const routes=placements.map(q=>prepareZooAnimalRouteV282({...q,animalId:q.id}));
  const poses:ZooAnimalPoseV282[]=routes.map(q=>({x:q.routeXZ[0][0],y:q.groundY,z:q.routeXZ[0][1],quarterTurn:0,gait:0}));
  const vertices:Vertex[]=[],colors:number[]=[],parts:NativePart[]=[],partColors:number[]=[];
  const color=new Color(),cube=new BoxGeometry(1,1,1),organic=new IcosahedronGeometry(1,0);
  const addColor=(rgb:number)=>{color.setHex(rgb);colors.push(color.r,color.g,color.b);};
  const triangle=(bird:number,points:number[][],rgb:number,fan=false,leg=0)=>{for(const p of points){vertices.push({bird,x:p[0],y:p[1],z:p[2],fan,leg});addColor(rgb);}};
  const shape=(bird:number,x:number,y:number,z:number,w:number,h:number,d:number,rgb:number,rounded=false,fan=false,leg=0)=>{
    if(native){parts.push({bird,x,y,z,w:rounded?w*2:w,h:rounded?h*2:h,d:rounded?d*2:d,fan,leg});partColors.push(rgb);return;}
    const g=rounded?organic:cube,p=g.getAttribute('position'),ix=g.index,count=ix?ix.count:p.count;
    for(let i=0;i<count;i+=3){const points:number[][]=[];for(let j=0;j<3;j++){const k=ix?ix.getX(i+j):i+j;points.push([x+p.getX(k)*w/(rounded?1:1),y+p.getY(k)*h/(rounded?1:1),z+p.getZ(k)*d/(rounded?1:1)]);}triangle(bird,points,rgb,fan,leg);}
  };
  const ellipse=(bird:number,x:number,y:number,z:number,ry:number,rz:number,rgb:number)=>{for(let k=0;k<8;k++){const a=k*Math.PI/4,b=(k+1)*Math.PI/4;triangle(bird,[[x,y,z],[x,y+Math.cos(a)*ry,z+Math.sin(a)*rz],[x,y+Math.cos(b)*ry,z+Math.sin(b)*rz]],rgb,true);}};
  for(let i=0;i<6;i++){
    const white=placements[i].white,blue=white?0xF0F0E5:0x125D96,neck=white?0xE7ECE6:0x087B91,wing=white?0xD8DFD8:0x8B7751,train=white?0xDFE6DB:0x4C8050;
    // Body/head scale follows peafowl proportions; dimensions remain estimates.
    shape(i,0,.63,0,.41,.29,.26,blue,true);
    shape(i,-.09,.66,-.22,.28,.20,.065,wing,true);shape(i,-.09,.66,.22,.28,.20,.065,wing,true);
    shape(i,.30,.98,0,.10,.40,.105,neck,true);shape(i,.35,1.31,0,.13,.12,.115,blue,true);
    shape(i,.49,1.29,0,.15,.055,.06,white?0xABA88A:0xA5A087);
    for(const side of[-1,1]){shape(i,.40,1.35,side*.105,.04,.04,.018,0x202B2C);shape(i,.34,1.30,side*.11,.10,.018,.016,0xF1E8CD);shape(i,.02,.26,side*.12,.045,.46,.045,0x8F8870,false,false,side);shape(i,.10,.035,side*.12,.25,.045,.095,0x8F8870,false,false,side);}
    for(let k=0;k<5;k++)shape(i,.31+(k-2)*.025,1.52+(1-Math.abs(k-2)/3)*.045,0,.018,.20,.022,neck);
    // Separate narrow feathers and distinct blue/gold ocelli. White mutation
    // carries pale shafts, with no invented coloured eye pattern.
    const feathers=native?19:23;
    for(let k=0;k<feathers;k++){
      const t=(k/(feathers-1)-.5)*Math.PI*.91,r=1.65+(k%2)*.10;
      const z=Math.sin(t)*r,y=.58+Math.cos(t)*r;
      if(native){
        for(let n=0;n<8;n++){const f=(n+.5)/8;shape(i,-.40,.62+(y-.62)*f,z*f,.10,.18,.10,train,false,true);}
        shape(i,-.42,y,z,.13,.20,.15,white?0xF7F5E9:0xB6A75F,false,true);
        if(!white){shape(i,-.48,y,z,.10,.11,.09,0x2A7B94,false,true);shape(i,-.54,y,z,.055,.055,.055,0x273F64,false,true);}
      }else{
        // Feather surfaces form a fan around a low root, rather than a disk.
        const start=[-.40,.62,0],end=[-.42,y,z],rz=.048*Math.cos(t),ry=-.048*Math.sin(t);
        triangle(i,[[start[0],start[1]+ry,start[2]+rz],[end[0],end[1]+ry,end[2]+rz],[end[0],end[1]-ry,end[2]-rz]],train,true);
        triangle(i,[[start[0],start[1]+ry,start[2]+rz],[end[0],end[1]-ry,end[2]-rz],[start[0],start[1]-ry,start[2]-rz]],train,true);
        ellipse(i,-.46,y,z,.13,.085,white?0xF8F8EC:0xBAAB64);
        if(!white){ellipse(i,-.485,y,z,.086,.057,0x1F8391);ellipse(i,-.502,y,z,.044,.030,0x243D62);}
      }
    }
  }
  cube.dispose();organic.dispose();
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.88,flatShading:true});
  let mesh:Mesh|InstancedMesh,attribute:BufferAttribute|null=null;
  if(native){const g=new BoxGeometry(1,1,1);g.deleteAttribute('uv');const m=new InstancedMesh(g,day,0);m.count=parts.length;m.instanceMatrix=new InstancedBufferAttribute(new Float32Array(parts.length*16),16).setUsage(DynamicDrawUsage);m.instanceColor=new InstancedBufferAttribute(new Float32Array(parts.length*3),3);partColors.forEach((c,i)=>m.setColorAt(i,color.setHex(c)));mesh=m;}
  else{const g=new BufferGeometry();attribute=new BufferAttribute(new Float32Array(vertices.length*3),3).setUsage(DynamicDrawUsage);g.setAttribute('position',attribute);g.setAttribute('normal',new BufferAttribute(new Float32Array(vertices.length*3),3).setUsage(DynamicDrawUsage));g.setAttribute('color',new BufferAttribute(new Float32Array(colors),3));mesh=new Mesh(g,day);}
  mesh.name=native?'Six independent cardinal peacocks':'Six faceted blue and white peacocks with feather eyes';
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,dynamicAnimation:true,keepInMinecraft:native,blockNative:native};mesh.castShadow=false;root.add(mesh);
  // All six routes are in this compact island domain. Per-animal broad phase
  // below avoids keeping far-away birds active for a near-site camera.
  const spheres=routes.map(q=>{const a=q.routeXZ[0],b=q.routeXZ[1];return new Sphere(new Vector3((a[0]+b[0])/2,q.groundY+1,(a[1]+b[1])/2),Math.hypot(b[0]-a[0],b[1]-a[1])/2+3);});
  const bounds=spheres.reduce((a,b)=>a.union(b),spheres[0].clone());mesh.geometry.boundingSphere=bounds.clone();if(mesh instanceof InstancedMesh)mesh.boundingSphere=bounds.clone();
  const projection=new Matrix4(),frustum=new Frustum(),matrix=new Matrix4();let disposed=false;
  const worldX=(x:number,z:number,q:number)=>q===0?x:q===1?z:q===2?-x:-z;
  const worldZ=(x:number,z:number,q:number)=>q===0?z:q===1?-x:q===2?-z:x;
  const write=(seconds:number)=>{
    for(let i=0;i<6;i++)sampleZooAnimalPoseV282(routes[i],seconds,poses[i]);
    if(mesh instanceof InstancedMesh){for(let i=0;i<parts.length;i++){const p=parts[i],pose=poses[p.bird],q=pose.quarterTurn,spread=p.fan?.75+.22*Math.sin(seconds*.32+p.bird*1.37):1,x=p.x-(p.fan?(1-spread)*Math.max(0,p.y-.62)*.9:0),y=p.fan?.62+(p.y-.62)*spread:p.y,z=p.z*spread,leg=p.leg*pose.gait*.035;matrix.makeScale(q%2?p.d:p.w,p.h,q%2?p.w:p.d).setPosition(pose.x+worldX(x+leg,z,q),pose.y+y,pose.z+worldZ(x+leg,z,q));mesh.setMatrixAt(i,matrix);}mesh.instanceMatrix.needsUpdate=true;}
    else if(attribute){for(let i=0;i<vertices.length;i++){const p=vertices[i],pose=poses[p.bird],spread=p.fan?.75+.22*Math.sin(seconds*.32+p.bird*1.37):1,x=p.x-(p.fan?(1-spread)*Math.max(0,p.y-.62)*.9:0)+p.leg*pose.gait*.035,y=p.fan?.62+(p.y-.62)*spread:p.y,z=p.z*spread;attribute.setXYZ(i,pose.x+worldX(x,z,pose.quarterTurn),pose.y+y,pose.z+worldZ(x,z,pose.quarterTurn));}attribute.needsUpdate=true;
      const normal=mesh.geometry.getAttribute('normal')as BufferAttribute,a=attribute.array;
      for(let i=0;i<vertices.length;i+=3){const j=i*3,ux=a[j+3]-a[j],uy=a[j+4]-a[j+1],uz=a[j+5]-a[j+2],vx=a[j+6]-a[j],vy=a[j+7]-a[j+1],vz=a[j+8]-a[j+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz)||1;normal.setXYZ(i,nx/length,ny/length,nz/length);normal.setXYZ(i+1,nx/length,ny/length,nz/length);normal.setXYZ(i+2,nx/length,ny/length,nz/length);}normal.needsUpdate=true;
    }
  };
  write(clock.elapsedSeconds);
  const bytes=Object.values(mesh.geometry.attributes as Record<string,BufferAttribute>).reduce((n,a)=>n+a.array.byteLength,mesh.geometry.index?.array.byteLength??0)+(mesh instanceof InstancedMesh?mesh.instanceMatrix.array.byteLength+(mesh.instanceColor?.array.byteLength??0):0);
  if(bytes>PFAUENINSEL_PEACOCKS_V326.maxBytes){mesh.geometry.dispose();if(mesh instanceof InstancedMesh)mesh.dispose();day.dispose();night.dispose();throw Error(`Peacock buffer budget exceeded: ${bytes}`);}
  root.userData.geometryBytes=bytes;root.userData.sourcePaths=placements.map(q=>q.sourcePath);
  root.userData.update=(timestamp:number,camera:Camera,reducedMotion=false):boolean=>{
    if(disposed)return false;let active=activeAncestor(root)&&!reducedMotion&&(typeof document==='undefined'||!document.hidden);
    if(active){projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);active=spheres.some(s=>camera.position.distanceToSquared(s.center)<700*700&&frustum.intersectsSphere(s));}
    if(!advanceZooAnimalClockV282(clock,timestamp,active))return false;
    write(clock.elapsedSeconds);return true;
  };
  // Common Outline teardown calls this before dropping its old family. Direct
  // disposal and resource disposal also permanently close the callback.
  const stop=()=>{disposed=true;advanceZooAnimalClockV282(clock,0,false);};
  mesh.geometry.addEventListener('dispose',()=>{if(!isSceneGeometryGpuRetirementV309(mesh.geometry))stop();});day.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(day))stop();});night.addEventListener('dispose',()=>{if(!isSceneMaterialProgramRetirementV321(night))stop();});
  let released=false;
  const releaseMotionData=()=>{stop();vertices.length=0;colors.length=0;parts.length=0;partColors.length=0;routes.length=0;poses.length=0;spheres.length=0;};
  // Generic permanent-world disposal already visits this established hook.
  // Do not detach/clear while its outer Object3D traversal is in progress.
  root.userData.disposeZooAnimalsV282=releaseMotionData;
  root.userData.dispose=()=>{if(released)return;released=true;releaseMotionData();if(mesh instanceof InstancedMesh)mesh.dispose();mesh.geometry.dispose();day.dispose();night.dispose();root.removeFromParent();root.clear();};
  freezeTransforms(root);return root;
}

function freezeTransforms(root:Group):void {root.updateMatrixWorld(true);root.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});}
