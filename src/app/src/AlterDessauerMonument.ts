import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { ALTER_DESSAUER_PROFILE as P } from "./wilhelmRefinementProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
export { ALTER_DESSAUER_PROFILE } from "./wilhelmRefinementProfile";
type Point=[number,number,number];
type Kind="blocks"|"bronze"|"members";
type Piece={p:Point;size:Point;color:number;rotation:Quaternion};
const UP=new Vector3(0,1,0), BRONZE=0x43504a, EDGE=0x657168, DARK=0x303b36, GRANITE=0x938a7e, STONE=0xb3aa9a;
/** Fixed texture-free sculpture batches; identical full detail on touch and pointer. */
class Builder {
  batches=new Map<Kind,Piece[]>();positions:number[]=[];colors:number[]=[];indices:number[]=[];
  constructor(readonly minecraft:boolean){}
  add(kind:Kind,p:Point,size:Point,color:number,rotation=new Quaternion()):void{if(this.minecraft)kind="blocks";const list=this.batches.get(kind)??[];list.push({p,size,color,rotation});this.batches.set(kind,list);}
  box(p:Point,size:Point,color:number,yaw=0):void{this.add("blocks",p,size,color,new Quaternion().setFromAxisAngle(UP,yaw));}
  round(p:Point,size:Point,color=BRONZE):void{this.add("bronze",p,size,color);}
  line(a:Point,b:Point,width:number,color=BRONZE,depth=width):void{const d=new Vector3(...b).sub(new Vector3(...a)),length=d.length();if(length<.00001)return;this.add("members",a.map((v,i)=>(v+b[i])/2)as Point,[width,length,depth],color,new Quaternion().setFromUnitVectors(UP,d.multiplyScalar(1/length)));}
  path(points:Point[],width:number,color=BRONZE):void{for(let i=1;i<points.length;i++)this.line(points[i-1],points[i],width,color);}
  surface(rows:number,cols:number,at:(u:number,v:number)=>Point,color:number):void{
    if(this.minecraft){for(let r=0;r<Math.min(rows,6);r++)for(let c=0;c<Math.min(cols,15);c++)this.box(at((c+.5)/Math.min(cols,15),(r+.5)/Math.min(rows,6)),[.19,.17,.19],color);return;}
    const start=this.positions.length/3,shade=new Color(color);for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){this.positions.push(...at(c/cols,r/rows));const light=.84+.12*Math.sin(c/cols*Math.PI*2)+.04*r/rows;this.colors.push(shade.r*light,shade.g*light,shade.b*light);}for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=start+r*(cols+1)+c,b=a+cols+1;this.indices.push(a,b,a+1,a+1,b,b+1);}
  }
  finish(root:Group):void{
    const day=new MeshBasicMaterial({vertexColors:true}),night=new MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:.15});let count=0;
    for(const[kind,pieces]of this.batches){const g=kind==="blocks"?new BoxGeometry(1,1,1):kind==="bronze"?new SphereGeometry(.5,14,10):new CylinderGeometry(.5,.5,1,8);g.deleteAttribute("uv");const n=g.getAttribute("normal"),colors=new Float32Array(n.count*3);for(let i=0;i<n.count;i++){const shade=.8+.15*Math.max(0,n.getY(i))+.03*n.getX(i)-.035*n.getZ(i);colors.set([shade,shade,shade],i*3);}g.setAttribute("color",new Float32BufferAttribute(colors,3));const mesh=new InstancedMesh(g,day,pieces.length),m=new Matrix4(),tint=new Color();pieces.forEach((p,i)=>{m.compose(new Vector3(...p.p),p.rotation,new Vector3(...p.size));mesh.setMatrixAt(i,m);mesh.setColorAt(i,tint.setHex(p.color));});mesh.name=`Alter Dessauer ${this.minecraft?"native blocks":kind}`;mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,keepInMinecraft:this.minecraft,blockNative:this.minecraft};mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);count+=pieces.length;}
    if(this.positions.length){const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(this.positions,3));g.setAttribute("color",new Float32BufferAttribute(this.colors,3));g.setIndex(this.indices);g.computeVertexNormals();const d=day.clone(),n=night.clone();d.side=n.side=DoubleSide;const mesh=new Mesh(g,d);mesh.name="Alter Dessauer coat folds and tricorne";mesh.userData={dayMaterial:d,nightMaterial:n,textureFree:true};root.add(mesh);}root.userData.instanceCount=count;root.userData.renderableCount=root.children.length;
  }
}
export function createAlterDessauerMonument(minecraft=false):Group{
  const root=new Group();root.name=minecraft?"Block-native Alter Dessauer monument":"Alter Dessauer source-bound bronze monument";root.userData={...P,keepInMinecraft:minecraft,blockNative:minecraft,textureFree:true,sourceBound:true,detailProfile:"full",collisionRole:"granular monument core; surrounding square remains open"};
  const b=new Builder(minecraft),angle=P.frontAngleRad,c=Math.cos(angle),s=Math.sin(angle),yaw=-angle;
  const at=(side:number,up:number,front:number):Point=>[P.world[0]+c*front-s*side,P.world[1]+up,P.world[2]+s*front+c*side];
  const box=(side:number,y:number,front:number,size:Point,color=GRANITE):void=>b.box(at(side,y,front),size,color,yaw+Math.PI/2);
  for(const[y,h,w]of[[.12,.24,2.62],[.34,.2,2.34],[.55,.22,2.08],[.77,.22,2.2],[1.02,.28,1.98],[1.98,1.64,1.88],[2.86,.12,1.98],[3.02,.2,2.18],[3.18,.12,1.91]]as const)box(0,y,0,[w,h,w],y>2.8?STONE:GRANITE);
  box(0,2.04,.953,[1.05,.89,.035],0x535549);for(const x of[-.57,.57])box(x,2.04,.966,[.045,1,.035],STONE);for(const y of[1.54,2.54])box(0,y,.966,[1.18,.045,.035],STONE);
  const letters=letteringStrokePaths("LEOPOLD",.095);let min=Infinity,max=-Infinity;for(const path of letters)for(const[x]of path){min=Math.min(min,x);max=Math.max(max,x);}for(const path of letters)b.path(path.map(([x,y])=>at(x-(min+max)/2,2.25+y,.982)),.012,0xc5b68e);
  // Source photographs distinguish the side relief fields from the inscribed front.
  for(const side of[-1,1]){box(side*.955,1.98,0,[.035,.85,1],DARK);for(let i=0;i<3;i++){b.round(at(side*.978,2.18,(i-1)*.22),[.065,.13,.12],EDGE);b.line(at(side*.98,2.12,(i-1)*.22),at(side*.98,1.8,(i-1)*.22),.1,EDGE);b.line(at(side*.98,1.92,(i-1)*.22),at(side*.98,1.69,(i-1)*.22+.07),.06,EDGE);}}
  box(0,3.31,0,[1.4,.16,1.22],DARK);const fy=3.39;
  // Two separate high boots, a shifted stance and knee breeches.
  for(const side of[-1,1]){const f=side===-1?.19:-.12;b.round(at(side*.23,fy+.08,f+.15),[.28,.17,.52]);b.line(at(side*.23,fy+.18,f),at(side*.2,fy+.98,f-.025),.235,BRONZE,.27);b.line(at(side*.2,fy+.98,f-.025),at(side*.17,fy+1.47,-.08),.31);for(let i=0;i<7;i++)b.round(at(side*.23+side*.09,fy+.28+i*.083,f+.09),[.022,.028,.032],EDGE);b.round(at(side*.2,fy+1.03,f+.08),[.27,.16,.16]);}
  b.surface(16,28,(u,v)=>{const a=u*Math.PI*2,width=.40-.11*v+.035*Math.sin(v*Math.PI),fold=.026*Math.cos(a*10)*(1-v);return at((width+fold)*Math.cos(a),fy+1.08+v*1.67,-.10+(.27+fold)*Math.sin(a));},BRONZE);
  for(const side of[-1,1])b.path([at(side*.12,fy+2.62,.15),at(side*.27,fy+2.3,.21),at(side*.1,fy+1.77,.22)],.055,EDGE);b.path([at(-.28,fy+2.58,.14),at(.03,fy+2.23,.225),at(.26,fy+1.8,.13)],.1,0x56615a);for(let i=0;i<7;i++)b.round(at(.065,fy+1.73+i*.12,.218),[.045,.045,.028],EDGE);
  for(const side of[-1,1]){b.round(at(side*.43,fy+2.49,-.055),[.31,.38,.4]);b.line(at(side*.46,fy+2.45,-.04),at(side*.51,fy+1.99,.02),.25);b.line(at(side*.51,fy+1.99,.02),at(side*.53,fy+1.62,.14),.21);b.round(at(side*.53,fy+1.56,.16),[.18,.25,.2]);for(let i=0;i<4;i++)b.line(at(side*.53+(i-1.5)*.035,fy+1.6,.23),at(side*.53+(i-1.5)*.035,fy+1.48,.225),.028,EDGE);for(let i=0;i<3;i++)b.line(at(side*.50-.09,fy+1.76+i*.035,.15),at(side*.50+.09,fy+1.76+i*.035,.15),.025,EDGE);}
  // Baton in the right hand and sword at the left hip, as in the bronze copy.
  b.line(at(-.90,fy+1.52,.20),at(-.12,fy+1.55,.21),.075,DARK);b.line(at(.55,fy+1.78,.08),at(.65,fy+.48,-.08),.064,DARK);b.line(at(.42,fy+1.79,.075),at(.68,fy+1.79,.075),.055,EDGE);
  b.round(at(0,fy+2.71,-.05),[.27,.22,.27]);b.round(at(0,fy+2.94,.015),[.40,.50,.38]);b.round(at(0,fy+2.91,.208),[.095,.14,.095],EDGE);
  for(const side of[-1,1]){b.round(at(side*.10,fy+3.01,.175),[.095,.029,.045],DARK);b.round(at(side*.185,fy+2.93,.008),[.075,.15,.085]);for(let i=0;i<4;i++)b.round(at(side*.15,fy+2.93-i*.077,-.09),[.13,.13,.14],DARK);}b.line(at(-.068,fy+2.79,.173),at(.068,fy+2.79,.173),.02,DARK);
  // Swept three-corner brim and shallow crown instead of the former cone.
  b.surface(5,36,(u,v)=>{const a=u*Math.PI*2,r=.17+v*(.27+.085*Math.cos(3*a));return at(r*Math.cos(a),fy+3.12+.12*(1-v)+.075*v*Math.cos(3*a),r*.72*Math.sin(a));},DARK);b.round(at(0,fy+3.18,0),[.35,.19,.31],DARK);b.path([at(-.36,fy+3.10,.08),at(-.18,fy+3.22,.17),at(0,fy+3.18,.22),at(.20,fy+3.23,.16),at(.38,fy+3.12,.08)],.034,EDGE);
  const posts:Point[]=[];for(let i=0;i<8;i++){const a=Math.PI/4*i,px=Math.cos(a)*1.91,pz=Math.sin(a)*1.91;posts.push([px,0,pz]);b.line(at(px,.08,pz),at(px,1.07,pz),.095,DARK);b.round(at(px,1.13,pz),[.16,.15,.16],EDGE);for(const y of[.16,.30,.89,1.04])b.round(at(px,y,pz),[.16,.055,.16],EDGE);}
  for(let i=0;i<posts.length;i++){const a=posts[i],z=posts[(i+1)%posts.length],n=minecraft?6:15;b.path(Array.from({length:n},(_,j)=>{const t=j/(n-1);return at(a[0]+(z[0]-a[0])*t,1-.25*Math.sin(t*Math.PI),a[2]+(z[2]-a[2])*t);}),minecraft?.038:.018,DARK);}
  b.finish(root);return freezeStaticSceneTransforms(root);
}
