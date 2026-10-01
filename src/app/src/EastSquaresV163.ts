import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { EAST_SQUARES_V163_SOURCE as S, EAST_SQUARES_V163_GROUP_NAME, MINECRAFT_EAST_SQUARES_V163_GROUP_NAME } from "./eastSquaresV163Profile";

type P = [number, number, number];
type Kind = "blocks" | "columns" | "balls";
type Row = { matrix: number[]; color: number };
const UP = new Vector3(0, 1, 0), TAU = Math.PI * 2;
const C = { stone:0xbab9a9, pale:0xd6d2ba, seam:0x7b7c73, water:0x609ca7, spray:0xc4e3e3, bronze:0x64695a, bronzeLight:0x8d8a68, bronzeDark:0x424d47, silver:0xb8c2c5, dark:0x374246, gold:0xd8b55c, enamel:[0x53758c,0xeee3b7,0xb35947,0x6c8b73,0xd0b45b,0xdddcc4] };
const pt=(x:number,y:number,z:number):P=>[x,y,z];
/** Compact immutable batches; native cells never carry smooth primitive geometry. */
class Builder {
  rows = new Map<Kind, Row[]>();
  positions:number[]=[]; colors:number[]=[]; indices:number[]=[];
  roles:Record<string,number>={};
  nativeCells = new Map<string,{p:P;color:number;size:number}>();
  constructor(readonly native:boolean) {}
  mark(role:string):void { this.roles[role]=(this.roles[role]??0)+1; }
  primitive(kind:Kind,p:P,size:P,color:number,q=new Quaternion()):void {
    if(this.native)kind="blocks";
    const rows=this.rows.get(kind)??[];rows.push({matrix:new Matrix4().compose(new Vector3(...p),this.native?new Quaternion():q,new Vector3(...size)).toArray(),color});this.rows.set(kind,rows);
  }
  box(p:P,size:P,color:number,yaw=0):void {this.primitive("blocks",p,size,color,new Quaternion().setFromAxisAngle(UP,yaw));}
  cell(p:P,size:number,color:number):void {
    const q=p.map(v=>Math.round(v/size)*size) as P;
    this.nativeCells.set(`${size}:${q.join(",")}`,{p:q,color,size});
  }
  line(a:P,b:P,width:number,color:number):void {
    const d=new Vector3(...b).sub(new Vector3(...a)),length=d.length();if(length<.0001)return;
    if(this.native){const step=Math.max(width,.12),n=Math.ceil(length/step);for(let i=0;i<=n;i++)this.cell(a.map((v,j)=>v+(b[j]-v)*i/n) as P,step,color);}
    else this.primitive("columns",a.map((v,j)=>(v+b[j])/2) as P,[width,length,width],color,new Quaternion().setFromUnitVectors(UP,d.multiplyScalar(1/length)));
  }
  polygon(p:P[],color:number,cellSize=.25):void {
    if(this.native){for(let i=1;i<p.length-1;i++){const a=new Vector3(...p[0]),b=new Vector3(...p[i]),c=new Vector3(...p[i+1]),n=Math.ceil(Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))/cellSize);for(let u=0;u<=n;u++)for(let v=0;v<=n-u;v++)this.cell(a.clone().addScaledVector(b.clone().sub(a),u/n).addScaledVector(c.clone().sub(a),v/n).toArray() as P,cellSize,color);}return;}
    const offset=this.positions.length/3,tint=new Color(color);for(const v of p){this.positions.push(...v);this.colors.push(tint.r,tint.g,tint.b);}for(let i=1;i<p.length-1;i++)this.indices.push(offset,offset+i,offset+i+1);
  }
  circle(x:number,y:number,z:number,r:number,width:number,color:number,n=64):void {for(let i=0;i<n;i++)this.line(pt(x+Math.cos(i*TAU/n)*r,y,z+Math.sin(i*TAU/n)*r),pt(x+Math.cos((i+1)*TAU/n)*r,y,z+Math.sin((i+1)*TAU/n)*r),width,color);}
  disk(x:number,y:number,z:number,r:number,color:number,n=64):void {
    if(this.native){const step=.4;for(let dz=-r;dz<=r;dz+=step){const w=Math.sqrt(Math.max(0,r*r-dz*dz));if(w>0)this.box([x,y,z+dz],[w*2,.10,step],color);}return;}
    for(let i=0;i<n;i++)this.polygon([[x,y,z],[x+Math.cos(i*TAU/n)*r,y,z+Math.sin(i*TAU/n)*r],[x+Math.cos((i+1)*TAU/n)*r,y,z+Math.sin((i+1)*TAU/n)*r]],color);
  }
  ring(x:number,y:number,z:number,r:number,h:number,width:number,color:number,n=64):void {
    for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n;const p=(t:number,d:number,up:number):P=>[x+Math.cos(t)*d,y+up,z+Math.sin(t)*d];if(this.native){this.box(p((a+b)/2,r,h/2),[Math.max(width,Math.abs(Math.sin(a))*r*TAU/n),h,Math.max(width,Math.abs(Math.cos(a))*r*TAU/n)],color);}else{this.polygon([p(a,r-width/2,0),p(b,r-width/2,0),p(b,r-width/2,h),p(a,r-width/2,h)],color);this.polygon([p(a,r+width/2,0),p(a,r+width/2,h),p(b,r+width/2,h),p(b,r+width/2,0)],color);this.polygon([p(a,r-width/2,h),p(b,r-width/2,h),p(b,r+width/2,h),p(a,r+width/2,h)],color);}}
  }
  finish(root:Group):void {
    for(const v of this.nativeCells.values())this.box(v.p,[v.size,v.size,v.size],v.color);
    const day=new MeshBasicMaterial({vertexColors:true}),night=new MeshStandardMaterial({vertexColors:true,roughness:.83,metalness:.15,flatShading:true});
    for(const[kind,rows]of this.rows){const g=kind==="blocks"?new BoxGeometry(1,1,1):kind==="columns"?new CylinderGeometry(.5,.5,1,8):new SphereGeometry(.5,12,8);g.deleteAttribute("uv");const normal=g.getAttribute("normal"),shade=new Float32Array(normal.count*3);for(let i=0;i<normal.count;i++){const v=.78+.16*Math.max(0,normal.getY(i))+.04*normal.getX(i)-.04*normal.getZ(i);shade.set([v,v,v],i*3);}g.setAttribute("color",new Float32BufferAttribute(shade,3));const m=new InstancedMesh(g,day,0),matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3),tint=new Color();rows.forEach((r,i)=>{matrices.set(r.matrix,i*16);tint.setHex(r.color).toArray(colors,i*3);});m.instanceMatrix=new InstancedBufferAttribute(matrices,16);m.instanceColor=new InstancedBufferAttribute(colors,3);m.count=rows.length;m.name=`${root.name} ${kind}`;m.userData={dayMaterial:day,nightMaterial:night,textureFree:true,blockNative:this.native,keepInMinecraft:this.native};m.computeBoundingBox();m.computeBoundingSphere();root.add(m);}
    if(this.positions.length){const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(this.positions,3));g.setAttribute("color",new Float32BufferAttribute(this.colors,3));g.setIndex(this.indices);g.computeVertexNormals();const d=day.clone(),n=night.clone();d.side=n.side=DoubleSide;const m=new Mesh(g,d);m.name=`${root.name} folded metal and mapped basin`;m.userData={dayMaterial:d,nightMaterial:n,textureFree:true};root.add(m);}
    root.userData={...root.userData,roleCounts:this.roles,instanceCount:[...this.rows.values()].reduce((n,r)=>n+r.length,0),renderableCount:root.children.length};
  }
}
function basin(b:Builder,feature:typeof S.features.friendship,y:number,rimHeight:number):void {
  const [x,z]=feature.centerXZ,ring=feature.outlineXZ.slice(0,-1);
  if(b.native){const r=Math.min(...ring.map(p=>Math.hypot(p[0]-x,p[1]-z)));b.disk(x,y+.13,z,r,C.water);}
  for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length],outer=(v:number[])=>{const length=Math.hypot(v[0]-x,v[1]-z);return[x+(v[0]-x)*(length+.45)/length,z+(v[1]-z)*(length+.45)/length];},a2=outer(a),c2=outer(c);if(!b.native)b.polygon([[x,y+.13,z],[a[0],y+.13,a[1]],[c[0],y+.13,c[1]]],C.water);b.polygon([[a[0],y+rimHeight,a[1]],[c[0],y+rimHeight,c[1]],[c2[0],y+rimHeight,c2[1]],[a2[0],y+rimHeight,a2[1]]],C.pale,.38);b.polygon([[a2[0],y,a2[1]],[a2[0],y+rimHeight,a2[1]],[c2[0],y+rimHeight,c2[1]],[c2[0],y,c2[1]]],C.stone,.38);b.mark("mapped basin edge");}
}
function waterJet(b:Builder,x:number,y:number,z:number,h:number,lean=.16):void {
  for(let j=0;j<5;j++){const t=j/5,u=(j+1)/5;b.line([x+Math.sin(t*3)*lean,y+t*h,z],[x+Math.sin(u*3)*lean,y+u*h,z],.095*(1-t*.5),j%2?C.spray:0x9ac7d0);}
}
function floatingRing(b:Builder):void {
  const f=S.features.floatingRing,[x,z]=f.centerXZ,y=f.groundY;basin(b,f,y,.5);
  for(let i=0;i<8;i++){const t=i*TAU/8;b.line([x+Math.cos(t)*5.1,y+.18,z+Math.sin(t)*5.1],[x+Math.cos(t)*5.1,y+4.88,z+Math.sin(t)*5.1],.23,C.bronzeDark);b.mark("ring support");}
  b.ring(x,y+2.38,z,5.25,.11,.14,C.bronzeDark);b.ring(x,y+4.84,z,5.25,.11,.14,C.bronzeDark);
  for(let i=0;i<16;i++){const t=(i+.5)*TAU/16,c=Math.cos(t),s=Math.sin(t),at=(u:number,v:number,out=0):P=>[x+c*(5.25+out)-s*u,y+2.4+v,z+s*(5.25+out)+c*u];
    b.polygon([at(-.75,0),at(.75,0),at(.75,2.5),at(-.75,2.5)],C.bronze);b.mark("copper relief panel");
    for(const h of[0,2.5])b.line(at(-.75,h,.045),at(.75,h,.045),.055,C.bronzeLight);
    for(const u of[-.75,.75])b.line(at(u,0,.045),at(u,2.5,.045),.055,C.bronzeLight);
    // Photographed crystalline/pyramidal relief vocabulary, independently authored motifs.
    const rows=i%3===0?3:2,cols=i%4===1?2:1;for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const left=-.66+col*1.32/cols,right=left+1.32/cols,low=.10+row*2.3/rows,high=low+2.3/rows,peak=at((left+right)/2,(low+high)/2,.22+(i%3)*.045),a=at(left,low,.04),c1=at(right,low,.04),d=at(right,high,.04),e=at(left,high,.04);b.polygon([a,c1,peak],C.bronzeDark);b.polygon([c1,d,peak],C.bronze);b.polygon([d,e,peak],C.bronzeLight);b.polygon([e,a,peak],i%5===0?0x9b8c55:C.bronze);}
  }
  for(let i=0;i<43;i++){const t=i*TAU/43;waterJet(b,x+Math.cos(t)*7.0,y+.16,z+Math.sin(t)*7.0,2.4+(i%4)*.45);b.mark("outer water jet");}
  for(let i=0;i<9;i++){const t=i*TAU/8,r=i?1.2:0;waterJet(b,x+Math.cos(t)*r,y+.16,z+Math.sin(t)*r,i?11.0+(i%3)*1.1:17.84,.32);b.mark("central water jet");}
}
function friendship(b:Builder):void {
  const f=S.features.friendship,[x,z]=f.centerXZ,y=f.groundY;basin(b,f,y,.56);b.ring(x,y+.14,z,6.4,1.25,.38,C.bronze,96);b.disk(x,y+1.17,z,6.2,C.water);
  // Raised ceramic frieze: individually authored leaves, fruit and colour fields.
  for(let i=0;i<48;i++){const t=i*TAU/48,at=(u:number,v:number,out=0):P=>[x+Math.cos(t)*(6.62+out)-Math.sin(t)*u,y+.22+v,z+Math.sin(t)*(6.62+out)+Math.cos(t)*u],base=C.enamel[i%C.enamel.length];b.polygon([at(-.42,0),at(.42,0),at(.42,1.12),at(-.42,1.12)],base,.25);b.line(at(0,.06,.04),at(.02,1.0,.04),.055,i%2?C.pale:C.bronzeDark);for(let k=0;k<3;k++){const v=.23+k*.25,side=k%2?1:-1;b.polygon([at(.01,v,.06),at(side*.3,v+.08,.06),at(side*.27,v+.26,.06),at(.03,v+.2,.06)],C.enamel[(i+3)%C.enamel.length],.16);}b.mark("ceramic frieze panel");}
  // Seventeen rhombic, shallow inverted-pyramid copper bowls in a rising spiral.
  for(let i=0;i<17;i++){const t=.4+i*TAU/8.5,r=1.35+(16-i)*.20,cx=x+Math.cos(t)*r,cz=z+Math.sin(t)*r,h=2.15+i*4.05/16,diameter=3.55-i*.135,at=(u:number,v:number,w:number):P=>[cx+Math.cos(t)*u-Math.sin(t)*w,y+v,cz+Math.sin(t)*u+Math.cos(t)*w],corners=[at(diameter*.62,h,0),at(0,h,diameter*.44),at(-diameter*.62,h,0),at(0,h,-diameter*.44)],bottom=at(0,h-.55,0);b.line(at(0,1.2,0),bottom,.21,C.bronzeDark);for(let k=0;k<4;k++){b.polygon([bottom,corners[k],corners[(k+1)%4]],k%2?C.bronze:C.bronzeLight);b.line(corners[k],corners[(k+1)%4],.06,C.bronzeDark);b.line(bottom,corners[k],.047,C.bronzeDark);}b.mark("rhombic copper bowl");if(i%2===0){b.line(at(-.40,h-.7,0),at(.40,h-.7,0),.05,C.bronze);b.line(at(-.40,h-1.12,0),at(.40,h-1.12,0),.05,C.bronze);for(const side of[-1,1])b.line(at(side*.4,h-.7,0),at(side*.4,h-1.12,0),.05,C.bronze);b.primitive("balls",at(0,h-.90,0),[.29,.29,.10],C.bronzeLight);}
    const spill=corners[0];b.line(spill,[spill[0]+Math.cos(t)*.16,Math.max(y+1.22,spill[1]-.85),spill[2]+Math.sin(t)*.16],.065,C.spray);
  }
  for(let i=0;i<8;i++){const t=i*TAU/8,r=6.64,sx=x+Math.cos(t)*r,sz=z+Math.sin(t)*r;b.primitive("balls",[sx,y+.89,sz],[.30,.35,.28],C.bronze);for(let j=0;j<8;j++){const u=j/8,v=(j+1)/8;b.line([sx+Math.cos(t)*u*1.8,y+.89+.15*Math.sin(u*Math.PI)-.70*u*u,sz+Math.sin(t)*u*1.8],[sx+Math.cos(t)*v*1.8,y+.89+.15*Math.sin(v*Math.PI)-.70*v*v,sz+Math.sin(t)*v*1.8],.07,C.spray);}b.mark("lower basin spout");}
}
function worldClock(b:Builder):void {
  const f=S.features.worldClock,[x,z]=f.centerXZ,y=f.groundY,r=3.12;
  // Keep the authored compass pavement above the surrounding path at y + .12.
  b.disk(x,y+.22,z,6.7,0xc8c6b5);for(let i=0;i<16;i++){const t=i*TAU/16,reach=i%2?4.4:6.45;b.polygon([[x,y+.28,z],[x+Math.cos(t-.1)*1.25,y+.28,z+Math.sin(t-.1)*1.25],[x+Math.cos(t)*reach,y+.28,z+Math.sin(t)*reach]],i%2?0x938f7c:0x686f6b,.3);b.polygon([[x,y+.28,z],[x+Math.cos(t)*reach,y+.28,z+Math.sin(t)*reach],[x+Math.cos(t+.1)*1.25,y+.28,z+Math.sin(t+.1)*1.25]],C.pale,.3);}
  if(b.native){for(let i=0;i<12;i++){const t=i*TAU/12;b.box([x+Math.cos(t)*.54,y+1.38,z+Math.sin(t)*.54],[.42,2.7,.42],C.silver);}}else b.primitive("columns",[x,y+1.35,z],[1.5,2.7,1.5],C.silver);
  const cities=["LONDON","BERLIN","KAIRO","MOSKAU","BAKU","KARACHI","DHAKA","BANGKOK","PEKING","TOKYO","SYDNEY","NOUMEA","AUCKLAND","APIA","HONOLULU","ANCHORAGE","LOS ANGELES","DENVER","MEXIKO","NEW YORK","CARACAS","BRASILIA","FERNANDO","REYKJAVIK"];
  for(let i=0;i<24;i++){const a=i*TAU/24,c=(i+1)*TAU/24,t=(a+c)/2,at=(u:number,v:number,out=0):P=>[x+Math.cos(t)*(r*Math.cos(Math.PI/24)+out)-Math.sin(t)*u,y+v,z+Math.sin(t)*(r*Math.cos(Math.PI/24)+out)+Math.cos(t)*u],width=2*r*Math.sin(Math.PI/24);
    for(const[lo,hi,color]of[[2.7,3.55,C.silver],[3.55,4.32,0x574643],[4.32,5.2,C.silver]])b.polygon([at(-width/2,lo),at(width/2,lo),at(width/2,hi),at(-width/2,hi)],color,.18);
    b.line(at(-width/2,2.7,.035),at(-width/2,5.2,.035),.035,C.pale);
    const hour=String((i+12)%24),city=cities[i],cityHeight=Math.min(.10,.68/(city.length*.85));
    // The panel's positive tangent runs left when viewed from outside the drum.
    for(const [word,cap,base,color]of[[hour,.43,3.7,C.gold],[city,cityHeight,4.68,C.dark]] as const)for(const path of letteringStrokePaths(word,cap))for(let k=1;k<path.length;k++)b.line(at(-path[k-1][0],base+path[k-1][1],.055),at(-path[k][0],base+path[k][1],.055),cap*.12,color);
    for(let k=0;k<4;k++){b.box(at(-.29+k*.19,3.61,.04),[.042,.055,.035],C.gold,-t);b.box(at(-.29+k*.19,4.25,.04),[.042,.055,.035],C.gold,-t);}
    b.mark("time zone face");
  }
  b.disk(x,y+5.2,z,r,C.silver,24);b.disk(x,y+2.7,z,r,C.dark,24);b.line([x,y+5.22,z],[x,y+9.74,z],.13,C.dark);b.primitive("balls",[x,y+7.51,z],[.5,.5,.5],C.silver);
  // Open stylized planetary armillary; ring planes and sphere spacing are photo fits.
  for(let k=0;k<8;k++){const r1=.82+k*.225,tilt=.34+k*.135,turn=k*.59;let previous:P|undefined;for(let j=0;j<=64;j++){const t=j*TAU/64,xx=Math.cos(t)*r1,zz=Math.sin(t)*r1,yy=Math.sin(t)*r1*Math.sin(tilt),p:P=[x+Math.cos(turn)*xx-Math.sin(turn)*zz*Math.cos(tilt),y+7.52+yy,z+Math.sin(turn)*xx+Math.cos(turn)*zz*Math.cos(tilt)];if(previous)b.line(previous,p,.036,C.dark);previous=p;if(j===8+(k*5)%41){b.primitive("balls",p,[.18+k*.02,.18+k*.02,.18+k*.02],C.silver);if(k===5)b.circle(p[0],p[1],p[2],.29,.033,C.dark,24);}}b.mark("planet orbit");}
}
function create(native:boolean):Group {
  const root=new Group();root.name=native?MINECRAFT_EAST_SQUARES_V163_GROUP_NAME:EAST_SQUARES_V163_GROUP_NAME;root.userData={textureFree:true,blockNative:native,keepInMinecraft:native,fullStaticDetailOnTouch:true,sourceGeometryUnchanged:true,photographsBundled:false};
  for(const[key,build]of[["floatingRing",floatingRing],["friendship",friendship],["worldClock",worldClock]] as const){const f=S.features[key],g=new Group();g.name=f.name;g.userData={osmKey:f.osmKey,groundY:f.groundY,sourceOutlineXZ:f.outlineXZ,sourceCenterXZ:f.centerXZ,textureFree:true,blockNative:native,keepInMinecraft:native};const b=new Builder(native);build(b);b.finish(g);root.add(g);}return freezeStaticSceneTransforms(root);
}
export function createEastSquaresV163(_mobileLike=false):Group {return create(false);}
export function createMinecraftEastSquaresV163(_mobileLike=false):Group {return create(true);}
