import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, ShapeUtils, Vector2, Vector3 } from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { DB_TOWER_PROFILE as P, DB_TOWER_SOURCE as S, dbTowerDisplayY, dbTowerPartContains, dbTowerRoofAt, type DbTowerPart } from "./dbTowerProfile";
export type DbTowerOptions={mobileLike?:boolean;diagnostics?:boolean};
type Point=[number,number,number];
type Family="frame"|"glass"|"crown"|"logo-red"|"logo-white";
export type DbTowerBlock={position:Point;size:Point;yaw:number;color:number;family:Family;role:string;floor:number;normal:[number,number]};
const FRAME=0x72888e, DARK=0x344a51, WHITE=0xf7f7ee, RED=0xda1429;
const MAIN=S.parts.find(p=>p.id.endsWith("xpXBjoqL"))!;
const UP=new Vector3(0,1,0);
type Wall={a:number[];b:number[];length:number;dx:number;dz:number;nx:number;nz:number;part:DbTowerPart};
function walls(part:DbTowerPart):Wall[]{return part.ring.map((a,i)=>{
 const b=part.ring[(i+1)%part.ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
 let nx=-dz,nz=dx;
 if(dbTowerPartContains(part,(a[0]+b[0])/2+nx*.025,(a[1]+b[1])/2+nz*.025)){nx=-nx;nz=-nz;}
 return{a,b,length,dx,dz,nx,nz,part};
});}
function at(w:Wall,u:number,y:number,out=.12):Point {return[w.a[0]+w.dx*u+w.nx*out,y,w.a[1]+w.dz*u+w.nz*out];}
/** All devices retain the same 26-storey drawn glazing, bays and fine rails. */
export function planDbTowerArchitecture(minecraft=false,mobileLike=false):DbTowerBlock[]{
 mobileLike = minecraft && mobileLike;
 const blocks:DbTowerBlock[]=[];
 const add=(w:Wall,u:number,y:number,width:number,height:number,depth:number,out:number,color:number,family:Family,role:string,floor=-1)=>blocks.push({position:at(w,u,y,out),size:[width,height,depth],yaw:-Math.atan2(w.dz,w.dx),color,family,role,floor,normal:[w.nx,w.nz]});
 const pitch=(P.mainTop-P.officeBottom)/P.officeFloors;
 for(const w of walls(MAIN)){
  const bays=Math.max(1,Math.round(w.length/(minecraft?(mobileLike?4:2.4):(mobileLike?3.2:1.6)))),step=w.length/bays;
  // Floor zero is the taller transparent lobby, followed by 25 office levels.
  for(let floor=0;floor<P.floors;floor++){
   const y0=floor===0?P.ground:P.officeBottom+(floor-1)*pitch,y1=floor===0?P.officeBottom:P.officeBottom+floor*pitch;
   for(let i=0;i<bays;i++){
    const u=(i+.5)*step;
    add(w,u,(y0+y1)/2,Math.max(.12,step-.1),y1-y0-.4,.12,.16,floor===0?0x9caead:(i+floor)%4===0?0x77959e:0x91abb0,"glass",floor===0?"transparent lobby":"office glazing",floor);
    add(w,u,y1-.10,step,.17,.25,.20,FRAME,"frame","silver horizontal floor rail",floor);

    if(floor>0)add(w,u,y1-.40,Math.max(.15,step-.22),.10,.10,.25,WHITE,"glass","continuous bright office ceiling",floor);
    if(!mobileLike&&floor>0){add(w,u,y0+.48,step-.13,.35,.13,.24,0x61787c,"frame","recessed green spandrel",floor);add(w,u,y1-.58,step-.13,.035,.06,.25,0xb5c5c4,"frame","fine blind rail",floor);}
   }

  }
  for(let i=0;i<=bays;i++)add(w,Math.min(w.length,i*step+.04),(P.ground+P.mainTop)/2,minecraft?.18:.08,P.mainTop-P.ground,.25,.23,DARK,"frame","continuous vertical mullion");
  // The actual upper volumes are set back. The photographed outer wind screen
  // continues the measured arc above them; it does not add a solid tower floor.
  const curved=w.length<3 && w.nz>-.15;
  if(curved){
   const h=P.crownTop-P.crownBottom;
   for(let i=0;i<bays;i++){
    const u=(i+.5)*step;
    add(w,u,P.crownBottom+h/2,step-.1,h-.16,.08,.16,0xbed2d4,"crown","open upper glass wind screen");
    add(w,i*step+.04,P.crownBottom+h/2,.08,h,.20,.21,FRAME,"frame","upper glass screen post");
   }
   for(const y of[P.crownBottom,P.crownBottom+h*.52,P.crownTop-.06])add(w,w.length/2,y,w.length,.10,.18,.22,FRAME,"frame","crown screen rail");
  }
 }
 // Only exposed portions of the retained set-back roof plant receive panes.
 for(const part of S.parts.filter(p=>p!==MAIN))for(const w of walls(part)){
  const n=Math.max(1,Math.ceil(w.length/(mobileLike?3:1.6))),step=w.length/n;
  for(let i=0;i<n;i++){
   const u=(i+.5)*step,p=at(w,u,P.mainTop+3,.18);
   if(S.parts.some(q=>q!==part&&q!==MAIN&&dbTowerPartContains(q,p[0],p[2])))continue;
   const top=dbTowerRoofAt(p[0]-w.nx*.25,p[2]-w.nz*.25,part.id)??dbTowerDisplayY(part.top_y_m);
   for(let row=0;row<2;row++){
    const y0=P.mainTop+(top-P.mainTop)*row/2,y1=P.mainTop+(top-P.mainTop)*(row+1)/2;
    add(w,u,(y0+y1)/2,Math.max(.05,step-.12),y1-y0-.35,.10,.15,0x9eb6b9,"glass","illuminated set-back crown glazing",26+row);
    add(w,u,y1-.08,step,.13,.20,.20,FRAME,"frame","set-back crown rail");
    add(w,i*step+.03,(y0+y1)/2,.08,y1-y0,.20,.21,DARK,"frame","set-back crown post");
   }
  }
 }
 // The logo sits at the eastern end of the measured curved screen.
 const w=walls(MAIN)[3],u=w.length/2,cy=104.60,logoWidth=6.6,logoHeight=4.6;
 add(w,u,cy,logoWidth,logoHeight,.16,.45,RED,"logo-red","DB red sign field");
 for(const dy of[-1,1])add(w,u,cy+dy*(logoHeight/2-.2),logoWidth-.30,.16,.08,.56,WHITE,"logo-white","DB white border");
 for(const dx of[-1,1])add(w,u+dx*(logoWidth/2-.2),cy,.16,logoHeight-.3,.08,.56,WHITE,"logo-white","DB white border");
 const glyphs=[[[0,0],[0,1],[.48,1],[.72,.82],[.72,.18],[.48,0],[0,0]],[[0,0],[0,1],[.48,1],[.68,.82],[.68,.62],[.48,.51],[0,.51],[.50,.51],[.75,.32],[.75,.17],[.53,0],[0,0]]];
 const gh=3.05,advance=2.62;
 for(let letter=0;letter<2;letter++)for(let j=1;j<glyphs[letter].length;j++){
  const a=glyphs[letter][j-1],b=glyphs[letter][j],ax=u-2.44+letter*advance+a[0]*2.65,bx=u-2.44+letter*advance+b[0]*2.65,ay=cy-gh/2+a[1]*gh,by=cy-gh/2+b[1]*gh;
  const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/(minecraft?.22:.10)));
  for(let k=0;k<n;k++)add(w,2*u-(ax+(bx-ax)*(k+.5)/n),ay+(by-ay)*(k+.5)/n,Math.max(.42,Math.abs(bx-ax)/n+.12),Math.max(.42,Math.abs(by-ay)/n+.12),.10,.61,WHITE,"logo-white",letter===0?"DB letter D":"DB letter B");
 }
 return blocks;
}
function pair(family:Family,vertexColors=false){
 const day=new MeshBasicMaterial({color:0xffffff,vertexColors,side:DoubleSide,transparent:family==="crown",opacity:family==="crown"?.32:1});
 const night=new MeshStandardMaterial({color:0x80999f,vertexColors,side:DoubleSide,roughness:.46,metalness:.08,transparent:family==="crown",opacity:family==="crown"?.16:1,emissive:family==="glass"?0xdceedd:family==="logo-red"?RED:family==="logo-white"?WHITE:0,emissiveIntensity:family==="glass"?P.windowNightIntensity:family.startsWith("logo")?1.1:0});
 if(family==="glass"||family.startsWith("logo")){night.userData.nightEmissive=night.emissive.getHex();night.userData.nightEmissiveIntensity=night.emissiveIntensity;}
 const moon=new MeshBasicMaterial({color:0x303e50,vertexColors,side:DoubleSide,transparent:family==="crown",opacity:family==="crown"?.12:1});
 return [day,night,moon] as const;
}
function attach(mesh:Mesh,m:ReturnType<typeof pair>){mesh.material=m[0];mesh.userData.dayMaterial=m[0];mesh.userData.nightMaterial=m[1];mesh.userData.moonlitMaterial=m[2];mesh.userData.textureFree=true;}
function sourceMesh():Mesh{
 const positions:number[]=[],colors:number[]=[],c=new Color();
 for(const part of S.parts)for(const s of part.surfaces){
  const rings=s.rings.map(r=>r.map(v=>[v[0],dbTowerDisplayY(v[1]),v[2]])),r=rings[0],n=new Vector3();
  for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];n.x+=(a[1]-b[1])*(a[2]+b[2]);n.y+=(a[2]-b[2])*(a[0]+b[0]);n.z+=(a[0]-b[0])*(a[1]+b[1]);}
  const axis=Math.abs(n.y)>Math.abs(n.x)?Math.abs(n.y)>Math.abs(n.z)?1:2:Math.abs(n.x)>Math.abs(n.z)?0:2,pp=rings.map(rr=>rr.map(v=>axis===1?new Vector2(v[0],v[2]):axis===0?new Vector2(v[2],v[1]):new Vector2(v[0],v[1]))),flat=rings.flat(),tris=ShapeUtils.triangulateShape(pp[0],pp.slice(1));
  c.setHex(s.kind==="RoofSurface"?0x718389:0x506e77);
  for(const t of tris)for(const i of t){positions.push(...flat[i]);colors.push(c.r,c.g,c.b);}
 }
 const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.setAttribute("color",new Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();const m=new Mesh(g);m.name="BahnTower exact LoD2 roof and body planes";attach(m,pair("frame",true));return m;
}
function sourceBlocks(blocks:DbTowerBlock[],mobile:boolean):void{
 const cell=mobile?2.8:1.8;
 for(const part of S.parts){
  for(const w of walls(part)){
   const n=Math.ceil(w.length/cell);for(let i=0;i<n;i++){
    const position=at(w,(i+.5)*w.length/n,0,-.18),top=dbTowerRoofAt(position[0],position[2],part.id)??dbTowerDisplayY(part.top_y_m),bottom=part===MAIN?P.ground:P.mainTop;
    position[1]=(top+bottom)/2;
    if(top>bottom)blocks.push({position,size:[w.length/n+.02,top-bottom,.36],yaw:-Math.atan2(w.dz,w.dx),color:0x516d76,family:"frame",role:"block-native source wall",floor:-1,normal:[w.nx,w.nz]});
   }
  }
  const minX=Math.min(...part.ring.map(v=>v[0])),maxX=Math.max(...part.ring.map(v=>v[0])),minZ=Math.min(...part.ring.map(v=>v[1])),maxZ=Math.max(...part.ring.map(v=>v[1]));
  for(let x=minX+cell/2;x<maxX;x+=cell)for(let z=minZ+cell/2;z<maxZ;z+=cell)if(dbTowerPartContains(part,x,z)){
   const top=dbTowerRoofAt(x,z,part.id)??dbTowerDisplayY(part.top_y_m);
   blocks.push({position:[x,top-.12,z],size:[cell,.24,cell],yaw:0,color:0x718389,family:"frame",role:"block-native source roof",floor:-1,normal:[0,0]});
  }
 }
}
function create(options:DbTowerOptions,minecraft:boolean):Group{
 const root=new Group();root.name=minecraft?"Minecraft BahnTower at Potsdamer Platz":"BahnTower at Potsdamer Platz";
 const blocks=planDbTowerArchitecture(minecraft,!!options.mobileLike);if(minecraft)sourceBlocks(blocks,!!options.mobileLike);else root.add(sourceMesh());
 const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
 for(const family of["frame","glass","crown","logo-red","logo-white"] as const){
  const a=blocks.filter(b=>b.family===family),mesh=new InstancedMesh(geometry,new MeshBasicMaterial(),0),matrices=new Float32Array(a.length*16),colors=new Float32Array(a.length*3),matrix=new Matrix4(),q=new Quaternion(),c=new Color();
  a.forEach((b,i)=>{matrix.compose(new Vector3(...b.position),q.setFromAxisAngle(UP,b.yaw),new Vector3(...b.size));matrices.set(matrix.toArray(),i*16);c.setHex(b.color).toArray(colors,i*3);});
  mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.count=a.length;mesh.name=`BahnTower ${family}`;attach(mesh,pair(family));
  mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
 }
 root.userData.sourcePartIds=S.parts.map(p=>p.id);root.userData.sourceRecordsRetained=true;root.userData.floors=P.floors;root.userData.textureFree=true;root.userData.displaySubdivisionsAreSurveyed=false;
 if(options.diagnostics)root.userData.blocks=blocks;
 freezeStaticSceneTransforms(root);return root;
}
export function createDbTowerArchitecture(options:DbTowerOptions={}):Group{return create(options,false);}
export function createMinecraftDbTowerArchitecture(options:DbTowerOptions={}):Group{return create(options,true);}
