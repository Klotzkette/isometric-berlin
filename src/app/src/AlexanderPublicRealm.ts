import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, SphereGeometry, Vector3,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { ALEXANDER_PUBLIC_REALM_PROFILE as P, ALEXANDER_PUBLIC_REALM_SOURCE as S,
  ALEXANDER_PUBLIC_REALM_OSM_KEYS } from "./alexanderPublicRealmProfile";

type Point = [number, number, number];
type Pose = (side: number, up: number, forward: number) => Point;
type Kind = "blocks" | "sculpted bronze" | "round members" | "tree crowns";
type Instance = { matrix: number[]; color: number };
const UP = new Vector3(0, 1, 0), BRONZE = 0x535d57, PATINA = 0x657f72, DARK = 0x343c36;
const GRANITE = 0xa57d73, PALE = 0xc4bdac, WATER = 0x66989b;

/** Fixed, texture-free batches. Touch keeps every drawn triangle. */
class PublicRealmBuilder {
  readonly batches = new Map<Kind, Instance[]>();
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly indices: number[] = [];
  readonly matrix = new Matrix4();
  readonly shade = new Color();
  constructor(readonly minecraft: boolean) {}
  add(kind: Kind, p: Point, size: Point, color: number, rotation = new Quaternion()): void {
    if (this.minecraft) kind = "blocks";
    this.matrix.compose(new Vector3(...p), rotation, new Vector3(...size));
    const rows = this.batches.get(kind) ?? [];
    rows.push({ matrix: this.matrix.toArray(), color }); this.batches.set(kind, rows);
  }
  box(p: Point, size: Point, color: number, angle = 0): void {
    this.add("blocks", p, size, color, new Quaternion().setFromAxisAngle(UP, angle));
  }
  round(p: Point, size: Point, color = BRONZE): void { this.add("sculpted bronze", p, size, color); }
  line(a: Point, b: Point, diameter: number, color = BRONZE, depth = diameter): void {
    const v = new Vector3(...b).sub(new Vector3(...a)), length = v.length();
    if (length < .001) return;
    this.add("round members", a.map((c, i) => (c + b[i]) / 2) as Point, [diameter, length, depth], color,
      new Quaternion().setFromUnitVectors(UP, v.multiplyScalar(1 / length)));
  }
  path(p: Point[], width: number, color = BRONZE): void {
    for (let i = 1; i < p.length; i++) this.line(p[i - 1], p[i], width, color);
  }
  surface(rows: number, columns: number, point: (u: number, v: number) => Point, color: number, block = .12): void {
    if (this.minecraft) {
      const nr = Math.min(rows, 7), nc = columns > 64 ? columns : Math.min(columns, 24);
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
        const p = point((c + .5) / nc, (r + .5) / nr);
        const a = point(c / nc, (r + .5) / nr), z = point((c + 1) / nc, (r + .5) / nr);
        const a2 = point((c + .5) / nc, r / nr), z2 = point((c + .5) / nc, (r + 1) / nr);
        this.box(p, [Math.max(block, Math.abs(z[0]-a[0]), Math.abs(z2[0]-a2[0])),
          Math.max(block, Math.abs(z[1]-a[1]), Math.abs(z2[1]-a2[1])),
          Math.max(block, Math.abs(z[2]-a[2]), Math.abs(z2[2]-a2[2]))], color);
      }
      return;
    }
    const start = this.positions.length / 3; this.shade.setHex(color);
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= columns; c++) {
      const u = c / columns, v = r / rows;
      this.positions.push(...point(u,v));
      const tint = .85 + .1 * Math.sin(u * Math.PI * 2) + .05 * v;
      this.colors.push(this.shade.r*tint,this.shade.g*tint,this.shade.b*tint);
    }
    for (let r=0;r<rows;r++) for(let c=0;c<columns;c++) {
      const a=start+r*(columns+1)+c, b=a+columns+1; this.indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  finish(root: Group): void {
    const day = new MeshBasicMaterial({ vertexColors: true });
    const night = new MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: .08 });
    let count = 0;
    for (const [kind,rows] of this.batches) {
      const g = kind === "blocks" ? new BoxGeometry(1,1,1)
        : kind === "round members" ? new CylinderGeometry(.5,.5,1,8)
        : new SphereGeometry(.5,kind === "tree crowns" ? 8 : 14,kind === "tree crowns" ? 6 : 10);
      g.deleteAttribute("uv");
      const normal=g.getAttribute("normal"), colors=new Float32Array(normal.count*3);
      for(let i=0;i<normal.count;i++) {
        const shade=.77+.17*Math.max(0,normal.getY(i))+.045*normal.getX(i)-.04*normal.getZ(i);
        colors.set([shade,shade,shade],i*3);
      }
      g.setAttribute("color",new Float32BufferAttribute(colors,3));
      const m=new InstancedMesh(g,day,0), matrices=new Float32Array(rows.length*16), tint=new Float32Array(rows.length*3);
      rows.forEach((r,i)=>{matrices.set(r.matrix,i*16);this.shade.setHex(r.color).toArray(tint,i*3);});
      m.instanceMatrix=new InstancedBufferAttribute(matrices,16);m.instanceColor=new InstancedBufferAttribute(tint,3);m.count=rows.length;
      m.name=`Alexander public realm ${this.minecraft ? "native cubes" : kind}`;
      m.userData={dayMaterial:day,nightMaterial:night,textureFree:true,keepInMinecraft:this.minecraft,blockNative:this.minecraft};
      m.computeBoundingBox();m.computeBoundingSphere();root.add(m);count+=rows.length;
    }
    if(this.positions.length) {
      const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(this.positions,3));
      g.setAttribute("color",new Float32BufferAttribute(this.colors,3));g.setIndex(this.indices);g.computeVertexNormals();
      const d=day.clone(), n=night.clone();d.side=n.side=DoubleSide;
      const m=new Mesh(g,d);m.name="Alexander public realm curved stone and bronze";
      m.userData={dayMaterial:d,nightMaterial:n,textureFree:true};root.add(m);
    }
    root.userData.instanceCount=count;root.userData.renderableCount=root.children.length;
  }
}
function pose(x:number,y:number,z:number,angle=0):Pose {
  const c=Math.cos(angle),s=Math.sin(angle);
  return(side,up,front)=>[x+c*front-s*side,y+up,z+s*front+c*side];
}
function relative(at:Pose,x:number,y:number,z:number,angle=0):Pose {
  const origin=at(x,y,z), side0=at(1,0,0), side1=at(0,0,0);
  const base=Math.atan2(-(side0[0]-side1[0]),side0[2]-side1[2]);
  return pose(...origin,base+angle);
}
function face(b:PublicRealmBuilder, at:Pose, scale:number, beard=true,color=BRONZE):void {
  b.round(at(0,0,0),[.42*scale,.56*scale,.4*scale],color);
  b.round(at(0,.14,-.06),[.45*scale,.33*scale,.42*scale],DARK);
  b.round(at(0,-.06,.19),[.12*scale,.16*scale,.12*scale],color);
  for(const s of [-1,1]) {
    b.round(at(s*.215,-.02,0),[.08*scale,.14*scale,.08*scale],color);
    b.line(at(s*.055,.045,.177),at(s*.15,.035,.17),.03*scale,DARK);
  }
  if(beard) for(let i=0;i<9;i++) {
    const x=(i-4)*.04*scale;
    b.line(at(x,-.1,.14),at(x*.6,-.3-Math.cos((i-4)*.23)*.025,.13),.07*scale,i%2?color:DARK);
  }
}
function drape(b:PublicRealmBuilder, at:Pose, sections:Point[], color:number, depth=.34):void {
  b.surface(sections.length*3,24,(u,v)=>{
    const k=v*(sections.length-1),i=Math.min(sections.length-2,Math.floor(k)),t=k-i;
    const a=sections[i],z=sections[i+1],w=a[0]+(z[0]-a[0])*t,y=a[1]+(z[1]-a[1])*t,f=a[2]+(z[2]-a[2])*t;
    const angle=u*Math.PI*2,fold=.017*Math.cos(angle*12)*(1-v);
    return at((w+fold)*Math.cos(angle),y,f+(depth+fold)*Math.sin(angle));
  },color);
}
function hand(b:PublicRealmBuilder,at:Pose,color=BRONZE):void {
  b.round(at(0,0,0),[.19,.12,.25],color);
  for(let i=0;i<4;i++) b.path([at((i-1.5)*.039,0,.06),at((i-1.5)*.044,-.035,.17),at((i-1.5)*.043,-.1,.2)],.035,color);
}
function marxEngels(b:PublicRealmBuilder):void {
  const [x,y,z]=P.marxEngels.position,at=pose(x,y+.18,z,P.marxEngels.frontAngleRad);
  // Mapped four-corner granite plinth, not the 60 m memorial ensemble circle.
  const outline=S.marx_engels.outline_xz;
  if(b.minecraft) {
    const a=outline[0],q=outline[1],r=outline[2];
    b.box([x,y+.09,z],[Math.hypot(q[0]-a[0],q[1]-a[1]),.18,Math.hypot(r[0]-q[0],r[1]-q[1])],0x9d9e91,-Math.atan2(q[1]-a[1],q[0]-a[0]));
  } else {
    b.surface(1,outline.length-1,(u,v)=>{
      const n=outline.length-1,t=u*n,i=Math.min(n-1,Math.floor(t)),f=t-i;
      const a=outline[i],q=outline[(i+1)%n]; return[x+(a[0]+(q[0]-a[0])*f-x)*v,y+.18,z+(a[1]+(q[1]-a[1])*f-z)*v];
    },0x9d9e91);
    b.surface(1,outline.length-1,(u,v)=>{
      const n=outline.length-1,t=u*n,i=Math.min(n-1,Math.floor(t)),f=t-i;
      const a=outline[i],q=outline[(i+1)%n];return[a[0]+(q[0]-a[0])*f,y+.18*v,a[1]+(q[1]-a[1])*f];
    },0x82867c);
  }
  const marx=relative(at,.91,0,.25),engels=relative(at,-.82,0,-.23);
  // Seated Marx, knees/hands forward, armchair-like block at his back.
  b.box(marx(0,.57,-.25),[1.1,1.14,.78],BRONZE,-P.marxEngels.frontAngleRad);
  drape(b,marx,[[.52,.65,-.18],[.59,1.38,-.02],[.61,1.95,-.16],[.39,2.25,-.18]],BRONZE,.28);
  b.round(marx(0,2.41,-.13),[.73,.36,.53],BRONZE);
  face(b,relative(marx,0,2.68,-.12),1.15,true);
  for(const s of [-1,1]) {
    b.line(marx(s*.35,1.27,.03),marx(s*.4,1.14,.72),.48,BRONZE);
    b.line(marx(s*.4,1.15,.72),marx(s*.4,.16,.78),.39,BRONZE);
    b.round(marx(s*.4,.12,.92),[.4,.2,.71],0x655b43);
    b.round(marx(s*.51,1.94,-.08),[.38,.44,.48],BRONZE);
    b.line(marx(s*.58,1.96,-.08),marx(s*.63,1.36,.23),.31,BRONZE);
    b.line(marx(s*.63,1.36,.23),marx(s*.43,1.33,.64),.25,BRONZE);
    hand(b,relative(marx,s*.43,1.36,.66),0x857049);
    b.path([marx(s*.15,2.13,.13),marx(s*.33,1.84,.26),marx(s*.23,1.31,.34)],.055,0x72786c);
  }
  for(let i=0;i<4;i++) b.round(marx(0,1.43+i*.16,.3),[.045,.045,.028],DARK);
  // Standing Engels, long open coat, two separated legs and dropped arms.
  for(const s of [-1,1]) {
    b.line(engels(s*.22,.18,0),engels(s*.22,1.67,-.02),.31,BRONZE);
    b.round(engels(s*.22,.1,.12),[.36,.19,.57],DARK);
  }
  drape(b,engels,[[.53,.77,-.08],[.55,1.53,-.05],[.56,2.52,-.03],[.62,3.04,-.07],[.36,3.19,-.06]],BRONZE,.28);
  b.box(engels(0,1.95,.265),[.105,1.9,.032],DARK,-P.marxEngels.frontAngleRad);
  b.round(engels(0,3.21,-.01),[.55,.23,.46],BRONZE);
  face(b,relative(engels,0,3.49,.015),1.08,true);
  for(const s of [-1,1]) {
    b.round(engels(s*.54,3.0,-.06),[.42,.45,.48],BRONZE);
    b.line(engels(s*.62,3.01,-.03),engels(s*.72,2.28,.02),.31,BRONZE);
    b.line(engels(s*.72,2.28,.02),engels(s*.7,1.85,.05),.25,BRONZE);
    hand(b,relative(engels,s*.7,1.80,.12));
    b.path([engels(s*.14,3.13,.23),engels(s*.34,2.72,.32),engels(s*.15,2.42,.32)],.055,0x747a6d);
  }
}
function smallFigure(b:PublicRealmBuilder,at:Pose,scale=1,color=PATINA):void {
  b.round(at(0,1.16*scale,0),[.49*scale,.88*scale,.36*scale],color);
  face(b,relative(at,0,1.85*scale,0),.72*scale,false,color);
  for(const s of [-1,1]) {
    b.line(at(s*.14,.86*scale,.03),at(s*.29,.55*scale,.47*scale),.22*scale,color);
    b.line(at(s*.29,.55*scale,.47*scale),at(s*.33,.1*scale,.54*scale),.18*scale,color);
    b.line(at(s*.24,1.5*scale,0),at(s*.42,1.13*scale,.1),.16*scale,color);
    b.line(at(s*.42,1.13*scale,.1),at(s*.3,.92*scale,.44),.14*scale,color);
  }
  drape(b,at,[[.25,.28,.16],[.45,.71,.23],[.26,1.02,.03]],color,.25*scale);
}
function pointInOutline(x:number,z:number,ring:number[][]):boolean {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function neptun(b:PublicRealmBuilder):void {
  const [x,y,z]=P.neptun.position,at=pose(x,y,z,0),outline=S.neptun.outline_xz.slice(0,-1),n=outline.length;
  // Exact mapped four-lobed waterline and concentric granite moulding courses.
  const edge=(u:number,scale:number,height:number):Point=>{
    const q=u*n,i=Math.min(n-1,Math.floor(q)),t=q-i,a=outline[i],v=outline[(i+1)%n];
    return[x+(a[0]+(v[0]-a[0])*t-x)*scale,y+height,z+(a[1]+(v[1]-a[1])*t-z)*scale];
  };
  if(b.minecraft) {
    // Exact clipped top rows: no radial bounding boxes outside the waterline.
    // Native plaza cells top out at 5.52 m here. Keep water at 5.675 m,
    // above that retained paving and 26 cm below the granite lip (5.935 m).
    const minX=Math.floor(Math.min(...outline.map(p=>p[0]))*2)/2,maxX=Math.max(...outline.map(p=>p[0]));
    const minZ=Math.floor(Math.min(...outline.map(p=>p[1]))*2)/2,maxZ=Math.max(...outline.map(p=>p[1]));
    for(let z=minZ;z<maxZ;z+=.5) {
      let start:number|null=null;
      for(let x=minX;x<=maxX+.5;x+=.5) {
        const inside=pointInOutline(x+.25,z+.25,outline);
        if(inside&&start===null)start=x;
        if(!inside&&start!==null){b.box([(start+x)/2,y+.34,z+.25],[x-start,.18,.5],WATER);start=null;}
      }
    }
  } else b.surface(1,n,(u,v)=>edge(u,v*.988,.18),WATER,.22);
  // One continuous red-granite wall with rounded base, lip and inner wall.
  const courses=[[1.02,.05],[1.027,.13],[1.008,.2],[1.011,.52],[1.035,.6],[1.032,.69],[.975,.69],[.964,.6],[.98,.2]];
  for(let k=1;k<courses.length;k++) {
    const a=courses[k-1],z=courses[k];
    b.surface(1,n,(u,v)=>edge(u,a[0]+(z[0]-a[0])*v,a[1]+(z[1]-a[1])*v),GRANITE+k%3*0x040303,.09);
  }
  // Central irregular rock and four muscular tritons supporting the shell.
  for(let i=0;i<11;i++) {
    const a=i*2.399,r=i<7?1.13:.48;
    b.round(at(Math.cos(a)*r,.45+(i%4)*.62,Math.sin(a)*r),[1.65,1.34,1.45],i%2?0x768277:0x6c776b);
  }
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2+.25,t=relative(at,Math.cos(a)*1.28,1.24,Math.sin(a)*1.28,a);
    b.round(t(0,.71,0),[.69,1.31,.54],PATINA);face(b,relative(t,0,1.49,.07),.92,true,PATINA);
    for(const s of [-1,1]) {
      b.line(t(s*.34,1.08,0),t(s*.61,1.7,-.12),.26,PATINA);
      b.line(t(s*.61,1.7,-.12),t(s*.7,2.32,-.18),.21,PATINA);
      b.round(t(s*.7,2.34,-.18),[.28,.13,.27],PATINA);
    }
    b.path([t(0,.25,0),t(.2,0,.76),t(.74,-.14,1.32),t(.93,.11,1.53)],.38,PATINA);
  }
  b.surface(12,64,(u,v)=>{
    const a=u*Math.PI*2,r=v*2.65,flute=Math.sin(a*12),h=3.35+.69*v*v+.18*flute*v;
    return at(Math.cos(a)*r,h,Math.sin(a)*r);
  },0x819080);
  b.surface(4,64,(u,v)=>{
    const a=u*Math.PI*2,r=2.65-.2*v;
    return at(Math.cos(a)*r,4.04+.18*Math.sin(a*12)-.17*v,Math.sin(a)*r);
  },PATINA);
  // Neptune sits upon the shell; folded knees, broad torso, beard and trident.
  const god=relative(at,0,3.82,0,-2.35);
  b.round(god(0,2.04,-.08),[1.28,2.25,.81],PATINA);
  b.round(god(0,3.05,-.07),[1.5,.62,.86],PATINA);
  face(b,relative(god,0,4.02,-.01),1.72,true,PATINA);
  drape(b,god,[[.6,.36,.14],[.78,.95,.32],[.67,1.2,.03]],0x78877a,.47);
  for(const s of [-1,1]) {
    b.line(god(s*.37,1.28,.1),god(s*.67,1.07,1.06),.56,PATINA);
    b.line(god(s*.67,1.07,1.06),god(s*.83,.35,1.5),.43,PATINA);
    b.round(god(s*.83,.29,1.61),[.43,.25,.71],PATINA);
    b.line(god(s*.68,2.94,-.04),god(s*.91,1.86,.26),.43,PATINA);
    b.line(god(s*.91,1.86,.26),god(s*.72,1.27,.85),.31,PATINA);
  }
  // Long hair/beard striations survive distant silhouettes without texture.
  for(let i=0;i<11;i++) {
    const a=i/10*Math.PI*2;
    b.path([god(.42*Math.cos(a),4.27,-.07+.28*Math.sin(a)),god(.5*Math.cos(a),3.72,-.08+.34*Math.sin(a)),god(.44*Math.cos(a),3.32,.04+.36*Math.sin(a))],.08,0x476657);
  }
  const trident=[god(-.92,.85,.52),god(-.83,5.78,.46)] as Point[];b.path(trident,.075,PATINA);
  for(const s of [-1,0,1]) b.path([god(-.83,5.28,.46),god(-.83+s*.34,5.44,.46),god(-.83+s*.34,6.18,.46)],.075,PATINA);
  // Four river allegories at the lobes, with distinct documented attributes.
  for(let i=0;i<4;i++) {
    const angle=i*Math.PI/2+.65,r=7.25,river=relative(at,Math.sin(angle)*r,.65,Math.cos(angle)*r,angle+Math.PI/2);
    smallFigure(b,river,.94,0x929b86);
    if(i===0) { // Elbe: fruits and ears of corn.
      b.round(river(.49,.58,.4),[.62,.29,.47],PATINA);
      for(let k=0;k<6;k++) b.round(river(.35+k%3*.15,.75+Math.floor(k/3)*.11,.37),[.14,.14,.14],0x728d64);
    } else if(i===1) { // Rhine: fishing net and grapes.
      for(let k=0;k<6;k++) b.line(river(-.7+k*.11,.1,.56),river(-.53+k*.08,1.05,.2),.024,PATINA);
      for(let k=0;k<8;k++)b.round(river(.5+(k%3)*.09,.8-Math.floor(k/3)*.1,.2),[.12,.12,.12],PATINA);
    } else if(i===2) { // Vistula: logs.
      for(let k=0;k<3;k++) b.line(river(.45,.17+k*.16,-.36),river(.66,.17+k*.16,.48),.18,PATINA);
    } else { // Oder: goat and hide.
      b.round(river(.56,.47,.1),[.31,.49,.64],PATINA);b.round(river(.67,.81,.39),[.22,.29,.32],PATINA);
      for(const s of [-1,1])b.path([river(.67+s*.1,.92,.32),river(.67+s*.13,1.13,.19),river(.67+s*.13,1.06,.08)],.055,PATINA);
    }
  }
  // Sea turtle, crocodile, seal and coiled snake; four inward water jets.
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2+.08,animal=relative(at,Math.sin(a)*4.65,.18,Math.cos(a)*4.65,a+Math.PI/2);
    if(i===0) {
      b.round(animal(0,.36,0),[1.2,.6,1.45],PATINA);b.round(animal(0,.4,.84),[.41,.3,.5],PATINA);
      for(const s of [-1,1])for(const f of [-.45,.45])b.round(animal(s*.64,.15,f),[.55,.13,.35],PATINA);
    } else if(i===1) {
      b.round(animal(0,.31,0),[.68,.48,1.65],PATINA);b.round(animal(0,.34,1.12),[.44,.23,.92],PATINA);
      b.path([animal(0,.27,-.7),animal(.15,.22,-1.3),animal(.46,.22,-1.78)],.22,PATINA);
      for(let k=0;k<8;k++)b.box(animal(0,.62,-.65+k*.18),[.13,.12,.12],DARK);
    } else if(i===2) {
      b.round(animal(0,.7,0),[.77,1.24,.78],PATINA);b.round(animal(0,1.35,.33),[.47,.45,.53],PATINA);
      for(const s of [-1,1])b.line(animal(s*.23,.61,.04),animal(s*.7,.13,.38),.21,PATINA);
    } else {
      const points:Point[]=[];
      for(let k=0;k<=30;k++){const a=k/30*Math.PI*4,r=.64-k*.009;points.push(animal(Math.cos(a)*r,.22+k*.014,Math.sin(a)*r));}
      points.push(animal(.2,1.19,.25),animal(.05,1.6,.48));b.path(points,.22,PATINA);
    }
    const p=animal(0,i===3?1.6:i===2?1.36:.47,.85),target=at(0,1.55,0),points:Point[]=[];
    for(let k=0;k<=16;k++){const t=k/16;points.push([p[0]+(target[0]-p[0])*t,p[1]+(target[1]-p[1])*t+2.1*4*t*(1-t),p[2]+(target[2]-p[2])*t]);}
    b.path(points,b.minecraft?.08:.046,0xa1c4bd);
  }
}
function forumCourt(b:PublicRealmBuilder):void {
  const outline=S.ensemble.outline_xz.slice(0,-1),[cx,cz]=S.ensemble.center_xz,y=S.ground_y_m+.04;
  if(b.minecraft) {
    const minX=Math.floor(Math.min(...outline.map(p=>p[0]))),maxX=Math.max(...outline.map(p=>p[0]));
    const minZ=Math.floor(Math.min(...outline.map(p=>p[1]))),maxZ=Math.max(...outline.map(p=>p[1]));
    for(let z=minZ;z<maxZ;z++) {
      let start:number|null=null;
      for(let x=minX;x<=maxX+1;x++) {
        const within=pointInOutline(x+.5,z+.5,outline);
        if(within&&start===null)start=x;
        if(!within&&start!==null){b.box([(start+x)/2,y-.03,z+.5],[x-start,.06,1],0xbcb7a8);start=null;}
      }
    }
  } else b.surface(1,outline.length,(u,v)=>{
    const n=outline.length,t=u*n,i=Math.min(n-1,Math.floor(t)),f=t-i,a=outline[i],q=outline[(i+1)%n];
    return[cx+(a[0]+(q[0]-a[0])*f-cx)*v,y,cz+(a[1]+(q[1]-a[1])*f-cz)*v];
  },0xbcb7a8);
}
function ensemble(b:PublicRealmBuilder):void {
  const y=S.ground_y_m;
  const p=S.alte_welt.outline_xz,a=p[0],z=p[1],dx=z[0]-a[0],dz=z[1]-a[1],length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx);
  b.box([S.alte_welt.center_xz[0],y+1.6,S.alte_welt.center_xz[1]],[length,3.2,1.63],PALE,angle);
  for(let i=0;i<5;i++) {
    const cx=a[0]+dx*(i+.5)/5,cz=a[1]+dz*(i+.5)/5,at=pose(cx,y+.15,cz,-.57);
    b.round(at(0,1.81,.86),[.78,.61,.2],0xada99a);
    b.round(at(0,1.05,.89),[1.04,1.3,.24],0xb8b2a1);
  }
  for(const item of S.secondary) {
    const [x,z]=item.center_xz,at=pose(x,y,z,-.636);
    if(item.kind==="double-stele") for(const side of [-1,1]) {
      b.box(at(side*.3,2,0),[.53,4,.16],0x9dada7,.636);
      // Photo-bearing steles read as shallow alternating silver fields, no photo copies.
      for(let j=0;j<6;j++)b.box(at(side*.3,.41+j*.57,.091),[.43,.43,.025],j%2?0x6e807a:0xbdc8c1,.636);
    } else {
      b.box(at(0,1.02,0),[2.72,2.04,.26],0x4d6859,.636);
      for(let j=0;j<3;j++)smallFigure(b,relative(at,(j-1)*.75,.1,.18),.74,0x6f8771);
    }
  }
}
function trees(b:PublicRealmBuilder):void {
  for(const [i,t] of S.added_trees.entries()) {
    const [x,y,z]=t.position,h=t.height_m,r=t.crown_radius_m;
    b.line([x,y,z],[x,y+h*.65,z],.38,0x796f50);
    for(let j=0;j<3;j++) {
      const a=j*Math.PI*2/3+i*.61;
      b.line([x,y+h*.36,z],[x+Math.cos(a)*r*.48,y+h*.76,z+Math.sin(a)*r*.48],.13,0x796f50);
      b.add("tree crowns",[x+Math.cos(a)*r*.37,y+h*.68,z+Math.sin(a)*r*.37],[r*1.5,h*.43,r*1.5],j%2?0x628149:0x729453);
    }
    b.add("tree crowns",[x,y+h*.85,z],[r*1.34,h*.3,r*1.34],0x7c9a57);
  }
}
function build(minecraft:boolean):Group {
  const root=new Group();root.name=minecraft?"Minecraft Alexander public realm":"Alexander public realm";
  root.userData={keepInMinecraft:minecraft,blockNative:minecraft,sourceBound:true,textureFree:true,
    ownedOsmKeys:[...ALEXANDER_PUBLIC_REALM_OSM_KEYS],sourceTreeCount:S.added_trees.length,
    retainedExistingTreeCount:S.retained_existing_tree_count_in_forum,proceduralDimensions:true,memorialProtected:true,schwellenraumGeschuetzt:true,fullStaticDetailOnTouch:true,hiddenSolidInfill:false};
  const b=new PublicRealmBuilder(minecraft);forumCourt(b);marxEngels(b);neptun(b);ensemble(b);trees(b);b.finish(root);
  freezeStaticSceneTransforms(root);return root;
}
export function createAlexanderPublicRealm(_mobileLike=false):Group{return build(false);}
export function createMinecraftAlexanderPublicRealm(_mobileLike=false):Group{return build(true);}
