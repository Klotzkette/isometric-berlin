import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, ShapeUtils, Vector2, Vector3 } from 'three';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import { pointInWorldRing, type WorldRing } from './chancelleryExtensionProfile';
import { JAMES_SIMON_SOURCE as SOURCE, JAMES_SIMON_PROFILE, JAMES_SIMON_GROUP, MINECRAFT_JAMES_SIMON_GROUP, JAMES_SIMON_OPEN_PART_IDS, JAMES_SIMON_YAW, JAMES_SIMON_LOW_POSTS, JAMES_SIMON_HIGH_POSTS, jamesSimonMainStairTopAt, jamesSimonRoofAt, jamesSimonStairTopAt, jamesSimonLocal, jamesSimonWorld } from './jamesSimonProfile';
type P=[number,number,number];
const STONE=0xd7d2c4, LIGHT=0xe9e6db, JOINT=0xb6b1a5, GLASS=0x60777b;
const MAIN='DEBE3DetH0pbh00c';
function pair(vertexColors=false){return [new MeshBasicMaterial({vertexColors,side:DoubleSide}),new MeshStandardMaterial({vertexColors,side:DoubleSide,roughness:.78}),new MeshBasicMaterial({color:0xa5b8c2,vertexColors,side:DoubleSide})] as const;}
function attach(mesh:Mesh,p:ReturnType<typeof pair>){mesh.material=p[0];mesh.userData={dayMaterial:p[0],nightMaterial:p[1],moonlitMaterial:p[2],textureFree:true};}
function isOpenWall(id:string,points:number[][]):boolean {return JAMES_SIMON_OPEN_PART_IDS.has(id)||(id===MAIN&&points.every(p=>{const[u,v]=jamesSimonLocal(p[0],p[2]);return v>-.3||(u>102.9&&v> -7.9);}));}
/** Clip only the authored staircase aperture; original source polygons stay packaged. */
function clipPolygon(poly:number[][],value:(p:number[])=>number):number[][] {
 const out:number[][]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],fa=value(a),fb=value(b);if(fa>=-1e-8)out.push(a);if((fa<0)!==(fb<0)){const t=fa/(fa-fb);out.push(a.map((v,k)=>v+(b[k]-v)*t));}}return out;
}
function plinthStairCut(triangle:number[][],roof:boolean):number[][][] {
 const planes=[(p:number[])=>jamesSimonLocal(p[0],p[2])[0]-28,(p:number[])=>78-jamesSimonLocal(p[0],p[2])[0],(p:number[])=>jamesSimonLocal(p[0],p[2])[1]-.35,(p:number[])=>5.55-jamesSimonLocal(p[0],p[2])[1]];
 let inside=triangle;const pieces:number[][][]=[];for(const plane of planes){const outside=clipPolygon(inside,p=>-plane(p));if(outside.length>=3)pieces.push(outside);inside=clipPolygon(inside,plane);if(inside.length<3)break;}
 if(!roof&&inside.length>=3){const lower=clipPolygon(inside,p=>10.41-(jamesSimonLocal(p[0],p[2])[0]-28)/50*5.81-.12-p[1]);if(lower.length>=3)pieces.push(lower);}return pieces;
}
/** Correct the coarse LoD2 roof over the photographed open southern stair only. */
function mainStairCut(triangle:number[][],roof:boolean):number[][][] {
 const planes=[(p:number[])=>jamesSimonLocal(p[0],p[2])[0]-70,(p:number[])=>103.7-jamesSimonLocal(p[0],p[2])[0],(p:number[])=>jamesSimonLocal(p[0],p[2])[1]+21.5,(p:number[])=>-7.85-jamesSimonLocal(p[0],p[2])[1]];
 let inside=triangle;const pieces:number[][][]=[];
 for(const plane of planes){const outside=clipPolygon(inside,p=>-plane(p));if(outside.length>=3)pieces.push(outside);inside=clipPolygon(inside,plane);if(inside.length<3)break;}
 if(!roof&&inside.length>=3){const lower=clipPolygon(inside,p=>4.6+(103.1-jamesSimonLocal(p[0],p[2])[0])/33.1*5.81-.2-p[1]);if(lower.length>=3)pieces.push(lower);}
 return pieces;
}
function sourceMesh():Mesh {
 const positions:number[]=[],colors:number[]=[];const c=new Color();
 for(const part of SOURCE.parts)for(const surface of part.surfaces){
  const roof=surface.kind==='RoofSurface';const opened=!roof&&isOpenWall(part.id,surface.rings[0]);
  const rings=surface.rings.map(r=>r.map(p=>[p[0],opened?Math.min(p[1],part.id===MAIN?10.41:4.6):p[1],p[2]]));
  const ring=rings[0];let n=[0,0,0];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}
  const axis=Math.abs(n[1])>Math.max(Math.abs(n[0]),Math.abs(n[2]))?1:Math.abs(n[0])>Math.abs(n[2])?0:2;
  const projected=rings.map(r=>r.map(p=>axis===1?new Vector2(p[0],p[2]):axis===0?new Vector2(p[2],p[1]):new Vector2(p[0],p[1])));
  const flat=rings.flat();c.setHex(roof?0xc3c4bb:STONE);
  for(const face of ShapeUtils.triangulateShape(projected[0],projected.slice(1))){const triangle=face.map(i=>flat[i]);const pieces=part.id==='DEBE3DuquIO5LuiT'?plinthStairCut(triangle,roof):part.id===MAIN?mainStairCut(triangle,roof):[triangle];for(const piece of pieces)for(let i=1;i<piece.length-1;i++)for(const v of[piece[0],piece[i],piece[i+1]]){positions.push(...v);colors.push(c.r,c.g,c.b);}}
 }
 // A source-footprint terrace slab closes the floor below the open upper colonnade.
 const floor=SOURCE.parts.find(p=>p.id===MAIN)!;c.setHex(STONE);for(const face of ShapeUtils.triangulateShape(floor.ring.map(p=>new Vector2(p[0],p[1])),[]))for(const piece of mainStairCut(face.map(i=>[floor.ring[i][0],10.41,floor.ring[i][1]]),true))for(let i=1;i<piece.length-1;i++)for(const p of[piece[0],piece[i],piece[i+1]]){positions.push(...p);colors.push(c.r,c.g,c.b);}
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();
 const m=new Mesh(g);m.name='James-Simon all eight original roof and articulated wall parts';attach(m,pair(true));m.userData.sourcePartIds=SOURCE.parts.map(p=>p.id);return m;
}
export function createJamesSimonArchitecture(options:{minecraft?:boolean;mobileLike?:boolean}={}):Group {
 const root=new Group(),native=!!options.minecraft;root.name=native?MINECRAFT_JAMES_SIMON_GROUP:JAMES_SIMON_GROUP;root.userData={...JAMES_SIMON_PROFILE,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};
 const rows:{p:P;s:P;color:number;yaw:number}[]=[];
 const worldBox=(p:P,s:P,color:number,yaw=0)=>rows.push({p,s,color,yaw});
 const box=(u:number,y:number,v:number,w:number,h:number,d:number,color:number)=>worldBox(jamesSimonWorld(u,y,v),[w,h,d],color,JAMES_SIMON_YAW);
 if(!native)root.add(sourceMesh());
 else for(const p of SOURCE.parts){
  for(let i=0;i<p.ring.length;i++){const a=p.ring[i],b=p.ring[(i+1)%p.ring.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.02)continue;
   const points=[[a[0],p.top_y_m,a[1]],[b[0],p.top_y_m,b[1]]];const top=isOpenWall(p.id,points)?p.id===MAIN?10.41:4.6:p.top_y_m;
   if(p.id==='DEBE3DuquIO5LuiT'||p.id===MAIN){
    const n=Math.ceil(l/.6);for(let j=0;j<n;j++){const t=(j+.5)/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,[u,v]=jamesSimonLocal(x,z),stair=p.id===MAIN&&u>=70&&v< -7.85?4.6+(103.1-u)/33.1*5.81:jamesSimonStairTopAt(u,v),h=stair===null?top:Math.min(top,stair-.12),depth=u>=.5&&u<=78&&v>.35?1.1:.36;worldBox([x,(h+p.ground_y_m)/2,z],[l/n,h-p.ground_y_m,depth],STONE,-Math.atan2(b[1]-a[1],b[0]-a[0]));}
   }else worldBox([(a[0]+b[0])/2,(top+p.ground_y_m)/2,(a[1]+b[1])/2],[l,top-p.ground_y_m,.5],STONE,-Math.atan2(b[1]-a[1],b[0]-a[0]));
  }
  const cell=1.6,xs=p.ring.map(x=>x[0]),zs=p.ring.map(x=>x[1]);for(let x=Math.min(...xs)+cell/2;x<Math.max(...xs);x+=cell)for(let z=Math.min(...zs)+cell/2;z<Math.max(...zs);z+=cell)if(pointInWorldRing(x,z,p.ring as unknown as WorldRing)&&!((p.id==='DEBE3DuquIO5LuiT'||p.id===MAIN)&&[-.5,0,.5].some(dx=>[-.5,0,.5].some(dz=>{const[u,v]=jamesSimonLocal(x+dx*cell,z+dz*cell);return p.id===MAIN?u>=70&&v<=-7.85:jamesSimonStairTopAt(u,v)!==null;})))){worldBox([x,(jamesSimonRoofAt(x,z,p.id)??p.top_y_m)-.18,z],[cell,.36,cell],0xc3c4bb);if(p.id===MAIN)worldBox([x,10.23,z],[cell,.36,cell],STONE);}
 }
 // Tall rectangular pre-cast columns, continuous canopy fascia and terrace soffit.
 for(const p of JAMES_SIMON_HIGH_POSTS)box(p.u,14.58,p.v,.28,8.34,.28,LIGHT);
 for(const y of [10.35,18.7])box(54.4,y,-.03,98,.28,.66,LIGHT);
 box(54.4,10.28,-2.5,98,.26,5.1,STONE);
 // Recessed glazing never fills the column intervals at the canal edge.
 for(let i=0;i<25;i++){const u=7.4+i*3.8;box(u,14.33,-5.25,3.62,7.75,.15,GLASS);box(u-1.88,14.33,-5.12,.12,7.85,.22,LIGHT);box(u,17.97,-5.11,3.8,.13,.2,LIGHT);}
 // Low colonnades use exact individual source edges and stay open under their roofs.
 for(const p of JAMES_SIMON_LOW_POSTS)worldBox([p.x,(4.6+p.top)/2,p.z],[.28,p.top-4.6,.28],LIGHT,JAMES_SIMON_YAW);
 // Three actual stair flights and broad intervening landings, no ramp substitute.
 for(let flight=0;flight<3;flight++){for(let i=0;i<12;i++){const u=78-(flight+(i+.5)*.84/12)*50/3,top=4.6+(flight+(i+1)/12)*(10.41-4.6)/3;box(u,(top+.808)/2,2.95,50*.84/36+.025,top-.808,5.2,LIGHT);}const top=4.6+(flight+1)*(10.41-4.6)/3;box(78-(flight+.92)*50/3,(top+.808)/2,2.95,50*.16/3,top-.808,5.2,LIGHT);}
 // Broad main entrance staircase beside the high terrace; all three landings open to sky.
 for(let flight=0;flight<3;flight++){
  for(let i=0;i<12;i++){const u=103.1-(flight+(i+.5)*.84/12)*33.1/3,top=jamesSimonMainStairTopAt(u,-14.5)!;box(u,(top+.808)/2,-14.5,33.1*.84/36+.012,top-.808,13.1,LIGHT);}
  const u=103.1-(flight+.92)*33.1/3,top=jamesSimonMainStairTopAt(u,-14.5)!;box(u,(top+.808)/2,-14.5,33.1*.16/3,top-.808,13.1,LIGHT);
 }
 // Foyer doors and a thin lintel sit behind the last landing, with no solid box over the stairs.
 box(69.72,14.3,-14.5,.16,7.7,12.8,GLASS);
 for(let v=-20.6;v< -8;v+=2.1)box(69.82,14.3,v,.22,7.8,.1,0x756f60);
 box(69.85,18.22,-14.5,.3,.24,13.1,LIGHT);
 for(const u of [5.8,103])box(u,18.7,-3.85,.3,.28,7.7,LIGHT);
 // Low colonnade soffit rims and recessed lights follow only their exact source edges.
 for(const p of SOURCE.parts.filter(p=>JAMES_SIMON_OPEN_PART_IDS.has(p.id)))for(let i=0;i<p.ring.length;i++){const a=p.ring[i],b=p.ring[(i+1)%p.ring.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l>.1)worldBox([(a[0]+b[0])/2,p.top_y_m-.18,(a[1]+b[1])/2],[l,.36,.2],LIGHT,-Math.atan2(b[1]-a[1],b[0]-a[0]));}
 // Native half-block depth covers retained exterior bank slivers without deleting land.
 const faceOffset=native?.65:0;
 // Stone courses and staggered vertical joints on the high canal plinth.
 for(let y=2.1;y<10.1;y+=.72)box(17.4,y,7.34+faceOffset,34.5,.026,.035,JOINT);
 for(let y=2.1,row=0;y<10;y+=.72,row++)for(let u=1.6+(row%2)*1.6;u<33;u+=3.2)box(u,y+.35,7.35+faceOffset,.027,.65,.036,JOINT);
 for(const u of [10,24]){box(u,7.5,7.4+faceOffset,6.2,2.35,.15,0x344b50);box(u,6.27,7.5+faceOffset,6.45,.12,.22,LIGHT);}
 // Thin handrails along terrace/stair edge preserve the open skyline.
 for(let i=0;i<=32;i++)box(6+i*3,10.96,.42,.07,1.1,.07,0x9ba9a5);box(54,11.5,.42,96,.075,.075,0x9ba9a5);
 const g=new BoxGeometry(1,1,1);g.deleteAttribute('uv');const p=pair();const mesh=new InstancedMesh(g,p[0],0),ms=new Float32Array(rows.length*16),cs=new Float32Array(rows.length*3),c=new Color(),m=new Matrix4(),q=new Quaternion();
 rows.forEach((r,i)=>{m.compose(new Vector3(...r.p),q.setFromAxisAngle(new Vector3(0,1,0),r.yaw),new Vector3(...r.s));ms.set(m.elements,i*16);c.setHex(r.color).toArray(cs,i*3);});mesh.instanceMatrix=new InstancedBufferAttribute(ms,16);mesh.instanceColor=new InstancedBufferAttribute(cs,3);mesh.count=rows.length;mesh.name=native?'James-Simon single native block batch':'James-Simon slender columns glazing stairs and joints';attach(mesh,p);mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);return freezeStaticSceneTransforms(root);
}
export function createMinecraftJamesSimonArchitecture(options:{mobileLike?:boolean}={}):Group {return createJamesSimonArchitecture({...options,minecraft:true});}
