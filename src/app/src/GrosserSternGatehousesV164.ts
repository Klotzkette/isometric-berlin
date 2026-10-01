import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import { paintGeometry } from "./drawnKit";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { GROSSER_STERN_GATEHOUSES_V164_PROFILE, gatehouseV164World, type GatehouseV164 } from "./grosserSternGatehousesV164Profile";

export const GROSSER_STERN_GATEHOUSES_V164_GROUP = "Four measured Grosser Stern gatehouses with square piers";
export const GROSSER_STERN_GATEHOUSES_V164_NATIVE_GROUP = "Grosser Stern independent native gatehouses";
const C={stone:0xbab2a1, pale:0xcac3b1, base:0xaca99a, joint:0xa29b8c, dark:0x323b39, pane:0x667873, frame:0xc7c9bd, roof:0x626a62, metal:0x48504b};
type P=[number,number,number];
type Row=[number,number,number,number,number,number,number,number];

class Build {
  rows:Row[]=[];
  faces:number[]=[];
  colors:number[]=[];
  counts:Record<string,number>={};
  constructor(readonly native:boolean){}
  mark(role:string):void{this.counts[role]=(this.counts[role]??0)+1;}
  box(h:GatehouseV164,x:number,y:number,z:number,w:number,height:number,d:number,c:number):void{
    const p=gatehouseV164World(h,x,y,z),yaw=Math.atan2(-h.right[1],h.right[0]);
    if(!this.native){this.rows.push([...p,w,height,d,yaw,c]);return;}
    const step=.55,nx=Math.max(1,Math.ceil(w/step)),ny=Math.max(1,Math.ceil(height/step)),nz=Math.max(1,Math.ceil(d/step));
    for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++)for(let iz=0;iz<nz;iz++){
      if(ix>0&&ix<nx-1&&iy>0&&iy<ny-1&&iz>0&&iz<nz-1)continue;
      const q=gatehouseV164World(h,x+(ix+.5)*w/nx-w/2,y+(iy+.5)*height/ny-height/2,z+(iz+.5)*d/nz-d/2);
      this.rows.push([...q,w/nx,height/ny,d/nz,0,c]);
    }
  }
  polygon(h:GatehouseV164,local:P[],c:number):void{
    if(this.native){
      // Independent stair-stepped surface sampling; no rotated triangles or smooth shell.
      for(let i=1;i<local.length-1;i++){
        const a=local[0],b=local[i],d=local[i+1];
        const count=Math.ceil(Math.max(Math.hypot(...b.map((v,j)=>v-a[j])),Math.hypot(...d.map((v,j)=>v-a[j])))/.44);
        for(let u=0;u<=count;u++)for(let v=0;v<=count-u;v++){
          const q=gatehouseV164World(h,...a.map((n,j)=>n+(b[j]-n)*u/count+(d[j]-n)*v/count) as P);
          this.rows.push([...q,.45,.24,.45,0,c]);
        }
      }
      return;
    }
    const color=new Color(c);
    for(let i=1;i<local.length-1;i++)for(const v of [local[0],local[i],local[i+1]]){this.faces.push(...gatehouseV164World(h,...v));this.colors.push(color.r,color.g,color.b);}
  }
  line(h:GatehouseV164,a:P,b:P,size:number,c:number):void{
    const direction=new Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),length=direction.length();
    if(length<1e-8)return;
    if(!this.native){
      // One continuous square-section prism: separated samples made the
      // shallow pediment mouldings and handrails look like dotted lines.
      direction.divideScalar(length);
      const reference=Math.abs(direction.y)>.98?new Vector3(1,0,0):new Vector3(0,1,0);
      const u=new Vector3().crossVectors(direction,reference).normalize().multiplyScalar(size/2);
      const v=new Vector3().crossVectors(direction,u).normalize().multiplyScalar(size/2);
      const corners=(point:P):P[]=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>[
        point[0]+s*u.x+t*v.x,point[1]+s*u.y+t*v.y,point[2]+s*u.z+t*v.z,
      ] as P);
      const near=corners(a),far=corners(b);
      this.polygon(h,near,c);this.polygon(h,[...far].reverse(),c);
      for(let i=0;i<4;i++)this.polygon(h,[near[i],near[(i+1)%4],far[(i+1)%4],far[i]],c);
      return;
    }
    // The independent native reading deliberately retains orthogonal steps.
    const n=Math.max(1,Math.ceil(length/.22));
    for(let i=0;i<n;i++)this.box(h,...a.map((v,j)=>v+(b[j]-v)*(i+.5)/n) as P,size,size,size,c);
  }
}

function addHouse(b:Build,h:GatehouseV164):void{
  const w=h.widthM/2,d=h.bodyDepthM/2,front=d+h.porticoDepthM-.42;
  // A shallow base surrounds an actual open stair hall, not a dark panel on a box.
  for(const s of [-1,1]){
    b.box(h,s*(w-.2),.06,0,.42,.16,h.bodyDepthM,C.base);
    b.box(h,s*(w-.2),3.24,0,.4,6.45,h.bodyDepthM,C.stone);
  }
  b.box(h,0,3.24,-d+.18,h.widthM,.4+6.05,.36,C.stone);
  b.box(h,0,.08,d+1.05,h.widthM+.34,.18,2.5,C.base);
  // Stone hall margins surround, but never bridge, the exact central stair cut.
  for(const side of [-1,1]){
    b.box(h,side*(w+2.58)/2,.055,0,w-2.58,.12,h.bodyDepthM,C.base);
    b.mark("stone hall margin");
  }
  b.box(h,0,.055,-d+.21,5.16,.12,.42,C.base);
  b.box(h,0,.055,d-.17,5.16,.12,.34,C.base);
  b.mark("stone hall margin");b.mark("stone hall margin");
  // Photo-confirmed four square piers; the openings remain empty all the way through.
  for(const r of [-.87,-.29,.29,.87]){
    const x=r*w;
    b.box(h,x,2.86,front,.72,5.5,.76,C.pale);
    b.box(h,x,.2,front,.85,.25,.86,C.base);
    b.box(h,x,5.52,front,.86,.23,.88,C.pale);
    b.box(h,x,5.69,front,.97,.16,1.0,C.stone);
    b.mark("square pier");
  }
  // Restrained entablature, shallow pediment and hipped rear roof from references.
  b.box(h,0,5.94,front,h.widthM+.3,.43,1.02,C.stone);
  b.box(h,0,6.19,front,h.widthM+.48,.13,1.16,C.pale);
  b.polygon(h,[[-w-.24,6.26,front+.57],[w+.24,6.26,front+.57],[0,7.10,front+.57]],C.pale);
  for(const s of [-1,1])b.line(h,[s*(w+.24),6.27,front+.59],[0,7.10,front+.59],.115,C.base);
  b.mark("shallow front pediment");
  // Porch ceiling has visible coffering; no heavy solid below it closes the entrance.
  b.box(h,0,5.69,d+.55,h.widthM,.16,h.porticoDepthM,C.pale);
  for(const z of [d+.15,d+.85,d+1.5])b.box(h,0,5.56,z,h.widthM,.12,.08,C.base);
  for(const x of [-2.2,0,2.2])b.box(h,x,5.56,d+.8,.08,.12,1.9,C.base);
  const e=h.eaveM,r=h.ridgeM,rz=-d+3.5;
  b.polygon(h,[[-w-.16,e,-d-.12],[-w-.16,e,d+.1],[0,r,d+.1],[0,r,rz]],C.roof);
  b.polygon(h,[[w+.16,e,d+.1],[w+.16,e,-d-.12],[0,r,rz],[0,r,d+.1]],0x737970);
  b.polygon(h,[[-w-.16,e,-d-.12],[0,r,rz],[w+.16,e,-d-.12]],0x58645c);
  // Full-height front gable closes only the space above the stair-hall ceiling.
  b.box(h,0,6.37,d+.02,h.widthM,.55,.18,C.stone);
  b.polygon(h,[[-w,e,d+.06],[w,e,d+.06],[0,r,d+.06]],C.stone);
  for(const s of [-1,1]){
    for(const [yy,hh,over] of [[6.37,.20,.16],[6.58,.15,.24],[.75,.08,.025]])b.box(h,s*w,yy,0,.25+over,hh,h.bodyDepthM+.3,C.pale);
    // Five narrow upper windows and five lower apertures on each side.
    for(let i=0;i<5;i++){
      const z=-d+1.18+i*(h.bodyDepthM-2.36)/4;
      for(const [y,height] of [[4.76,1.6],[1.53,.67]]){
        b.box(h,s*(w+.012),y,z,.07,height,.68,C.pane);
        b.box(h,s*(w+.075),y,z,.045,height,.045,C.frame);
        for(const dz of [-.39,.39])b.box(h,s*(w+.08),y,z+dz,.15,height+.12,.095,C.pale);
        for(const dy of [-height/2,height/2])b.box(h,s*(w+.08),y+dy,z,.16,.095,.87,C.frame);
        b.box(h,s*(w+.14),y-height/2-.08,z,.29,.12,.94,C.base);
        b.mark("source-bounded side window");
      }
    }
    // Staggered ashlar joints, including the inner stairwell walls.
    for(let row=1;row<13;row++){
      const yy=row*.48;
      b.box(h,s*(w+.016),yy,0,.022,.022,h.bodyDepthM,C.joint);
      for(let col=0;col<7;col++){
        const z=-d+(col+.5+(row%2)*.5)*1.75;
        if(z>d-.05)continue;
        b.box(h,s*(w+.02),yy-.24,z,.024,.45,.018,C.joint);
      }
    }
    // Roof gutters and rear downpipes.
    b.box(h,s*(w+.2),6.61,0,.10,.11,h.bodyDepthM+.5,C.metal);
    b.box(h,s*(w+.2),3.25,-d+.22,.105,6.3,.105,C.metal);
  }
  // Rear service door plus stone frame, separate from the front tunnel access.
  b.box(h,0,1.35,-d-.022,1.12,2.5,.08,C.dark);
  for(const x of [-.62,.62])b.box(h,x,1.35,-d-.09,.15,2.75,.14,C.pale);
  b.box(h,0,2.72,-d-.1,1.4,.18,.18,C.pale);
  b.box(h,.34,1.3,-d-.09,.14,.08,.12,C.frame);
  // Real dark stair cavity and descending individual treads. No invented exit tunnel.
  b.box(h,0,-2.805,0,5.2,.14,h.bodyDepthM-.8,C.dark);
  // The stone inner faces sit just inside the exact terrain cut, preventing
  // the soil-coloured slab edge from showing through the stair hall.
  for(const side of [-1,1])b.box(h,side*2.65,-1.5,0,.18,3.0,h.bodyDepthM-.6,C.base);
  b.box(h,0,-1.5,-d+.4,5.5,3.0,.18,C.base);
  for(let i=0;i<16;i++){
    const z=d-.12-i*.47,y=.045-i*.19;
    b.box(h,0,y,z,5.0,.14,.47,i%2?0x7f847b:0x8b8e83);
    b.mark("descending stair tread");
  }
  for(const s of [-1,1]){
    b.line(h,[s*2.43,1.05,d-.12],[s*2.43,-1.78,d-7.17],.075,C.metal);
    for(let i=0;i<9;i++)b.box(h,s*2.43,.55-i*.33,d-.18-i*.82,.065,1.03,.065,C.metal);
  }
  // Small bilingual information panel as non-text geometric bands.
  b.box(h,w-.8,1.48,front+.48,.54,.79,.065,0xedeadf);
  for(let i=0;i<7;i++)b.box(h,w-.8,1.72-i*.075,front+.518,.41,.018,.01,0x6a7069);
  b.mark("open portico and stair hall");
}

function create(native:boolean):Group{
  const b=new Build(native);
  for(const h of GROSSER_STERN_GATEHOUSES_V164_PROFILE)addHouse(b,h);
  const root=new Group();root.name=native?GROSSER_STERN_GATEHOUSES_V164_NATIVE_GROUP:GROSSER_STERN_GATEHOUSES_V164_GROUP;
  root.userData={textureFree:true,photographsBundled:false,fullStaticDetailOnTouch:true,blockNative:native,keepInMinecraft:native,counts:b.counts,sourcePartCount:8,houseCount:4};
  const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");geometry.deleteAttribute("normal");
  const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.95,flatShading:true});
  const mesh=new InstancedMesh(geometry,day,0),matrices=new Float32Array(b.rows.length*16),colors=new Float32Array(b.rows.length*3),m=new Matrix4(),c=new Color();
  b.rows.forEach((r,i)=>{if(native)m.makeScale(r[3],r[4],r[5]);else{m.makeRotationY(r[6]);m.scale(new Vector3(r[3],r[4],r[5]));}m.setPosition(r[0],r[1],r[2]);m.toArray(matrices,i*16);c.setHex(r[7]).toArray(colors,i*3);});
  mesh.count=b.rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
  mesh.userData={dayMaterial:day,nightMaterial:night,blockNative:native,nativeMinecraft:native};mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  if(!native&&b.faces.length){
    const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(b.faces,3));paintGeometry(g,0xffffff);g.setAttribute("color",new Float32BufferAttribute(b.colors,3));g.computeBoundingBox();g.computeBoundingSphere();
    const d=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),n=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.98,flatShading:true}),roof=new Mesh(g,d);roof.userData={dayMaterial:d,nightMaterial:n};root.add(roof);
  }
  root.userData.instanceCount=b.rows.length;return freezeStaticSceneTransforms(root);
}
export function createGrosserSternGatehousesV164(_mobileLike=false):Group{return create(false);}
export function createMinecraftGrosserSternGatehousesV164(_mobileLike=false):Group{return create(true);}
