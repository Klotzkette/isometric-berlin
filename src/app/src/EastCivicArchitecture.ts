import { BoxGeometry, Color, CylinderGeometry, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { sourceMesh } from "./BebelplatzBuildingShells";
import { bebelplatzPartBounds, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { EAST_CIVIC_SOURCES as S, EAST_CIVIC_GROUP_NAME, MINECRAFT_EAST_CIVIC_GROUP_NAME, EAST_CIVIC_OPEN_CANOPY_IDS, EAST_CIVIC_GLASS_PART_IDS, EAST_CIVIC_LOGGIA_POSTS, FRIEDRICHSWERDER_TOWER_IDS, eastCivicPartContains, eastCivicPartRoofAt, eastCivicPartBaseAt } from "./eastCivicProfile";
type P = [number, number, number];
type Kind = "blocks" | "sculpture" | "columns" | "spires";
type Axis = { a: readonly number[]; b: readonly number[]; side: number };
const UP = new Vector3(0,1,0);
const C = { brick: 0xad6946, lightBrick: 0xc4855b, darkBrick: 0x775445, stone: 0xd4ccba, pale: 0xe4dfce, frame: 0x7b817d, glass: 0x436169, dark: 0x343e3e, roof: 0x787b71, gold: 0xcab966 };
const axisLength = (a: Axis) => Math.hypot(a.b[0]-a.a[0],a.b[1]-a.a[1]);
const axisYaw = (a: Axis) => -Math.atan2(a.b[1]-a.a[1],a.b[0]-a.a[0]);
function pt(a: Axis,u: number,y: number,out=.25): P { const l=axisLength(a),dx=(a.b[0]-a.a[0])/l,dz=(a.b[1]-a.a[1])/l;return[a.a[0]+dx*u+dz*out*a.side,y,a.a[1]+dz*u-dx*out*a.side]; }
class Builder {
  batches = new Map<Kind, { matrix: number[]; color: number }[]>();
  constructor(readonly minecraft: boolean) {}
  add(kind: Kind, p: P, size: P, color: number, rotation = new Quaternion()): void {
    if (this.minecraft) kind = "blocks";
    const list = this.batches.get(kind) ?? [];
    list.push({ matrix: new Matrix4().compose(new Vector3(...p), rotation, new Vector3(...size)).toArray(), color }); this.batches.set(kind, list);
  }
  box(p: P, size: P, color: number, yaw = 0): void { this.add("blocks", p, size, color, new Quaternion().setFromAxisAngle(UP, yaw)); }
  bead(p: P, size: P, color: number): void { this.add("sculpture", p, size, color); }
  beam(a: P, b: P, width: number, color: number): void {
    const d = new Vector3(...b).sub(new Vector3(...a)), l = d.length();
    if (l < .001) return;
    this.add("columns", a.map((n, i) => (n + b[i]) / 2) as P, [width, l, width], color, new Quaternion().setFromUnitVectors(UP, d.multiplyScalar(1 / l)));
  }
  facade(a: Axis, u: number, y: number, w: number, h: number, color: number, out = .22, depth = .18): void { this.box(pt(a, u, y, out), [w, h, depth], color, axisYaw(a)); }
  finish(root: Group): void {
    const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .87, flatShading: true });
    for (const [kind, rows] of this.batches) {
      const g = kind === "spires" ? new CylinderGeometry(0, .5, 1, 4) : kind === "blocks" ? new BoxGeometry(1, 1, 1) : kind === "sculpture" ? new SphereGeometry(.5, 10, 7) : new CylinderGeometry(.5, .5, 1, 8);
      g.deleteAttribute("uv"); const mesh = new InstancedMesh(g, day, 0), matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3), color = new Color();
      rows.forEach((r, i) => { matrices.set(r.matrix, i * 16); color.setHex(r.color).toArray(colors, i * 3); });
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.count = rows.length;
      mesh.name = `${root.name} ${kind}`; mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: this.minecraft };
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
    }
  }
}
function clipAbove(ring:number[][],base:number):number[][] {const out:number[][]=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],da=a[1]-base,db=b[1]-base;if(da>=0)out.push(a);if((da<0)!==(db<0))out.push(a.map((v,j)=>v+(b[j]-v)*da/(da-db)));}return out;}
function clipPlane(ring:number[][],distance:(p:number[])=>number):number[][] {
 const out:number[][]=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],da=distance(a),db=distance(b);if(da>=-1e-7)out.push(a);if((da<0)!==(db<0))out.push(a.map((v,j)=>v+(b[j]-v)*da/(da-db)));}return out;
}
/** Partition a source sheet by the exact convex loggia footprint, preserving its complement. */
function loggiaPartition(ring:number[][]):{outside:number[][][];inside:number[][]} {
 const corners=S[1].parts.find(p=>p.id==='DEBE01YYK0001xuZ')!.ring;
 let inside=ring;const outside:number[][][]=[];
 const signed=corners.reduce((n,a,i)=>{const b=corners[(i+1)%corners.length];return n+a[0]*b[1]-b[0]*a[1];},0),sign=Math.sign(signed);
 for(let i=0;i<corners.length;i++){const a=corners[i],b=corners[(i+1)%corners.length],distance=(p:number[])=>sign*((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]));const piece=clipPlane(inside,p=>-distance(p));if(piece.length>=3 && inside.some(p=>distance(p)<-1e-6))outside.push(piece);inside=clipPlane(inside,distance);if(inside.length<3)break;}
 return{outside,inside};
}
function displayed(part:BebelplatzSourcePart):BebelplatzSourcePart {
 if(part.id==='DEBE3DYaStnJ2Nlk'){
  const glass=S[1].parts.find(p=>p.id==='DEBE3DJrlFgy3FFk')!;
  return{...part,surfaces:part.surfaces.flatMap(s=>{
   if(s.kind==='RoofSurface')return[{...s,rings:[...s.rings,glass.ring.map(([x,z])=>[x,part.top_y_m,z])]}];
   const divided=loggiaPartition(s.rings[0]),high=clipAbove(divided.inside,27.503);
   return[...divided.outside,...(high.length>=3?[high]:[])].map(r=>({kind:s.kind,rings:[r]}));
  })};
 }
 if(!EAST_CIVIC_OPEN_CANOPY_IDS.has(part.id))return part;
 return {...part,surfaces:part.surfaces.flatMap(s=>{if(s.kind==='RoofSurface')return[s];const ring=clipAbove(s.rings[0],eastCivicPartBaseAt(part));return ring.length>=3?[{kind:s.kind,rings:[ring]}]:[];})};
}
/** Procedural intersecting arcs and mullions; source facade plane remains authoritative. */
function arch(b:Builder,a:Axis,u:number,bottom:number,width:number,height:number,color=C.glass):void {
 const spring=bottom+height-width*.62;b.facade(a,u,(bottom+spring)/2,width,spring-bottom,color,.31);
 const n=b.minecraft?6:14;
 for(const side of [-1,1])for(let i=0;i<n;i++){const t=i/n,q=(i+1)/n;const x=(v:number)=>side*width/2*(1-v),y=(v:number)=>spring+width*.62*Math.sqrt(Math.max(0,1-(1-v/2)**2))/Math.sqrt(.75);b.beam(pt(a,u+x(t),y(t),.44),pt(a,u+x(q),y(q),.44),.20,C.lightBrick);const c=(t+q)/2,xx=x(c),yy=y(c);b.facade(a,u+xx,(spring+yy)/2,width/(2*n)+.035,yy-spring,color,.32);}
 for(const side of [-1,1])b.facade(a,u+side*width/2,(bottom+spring)/2,.2,spring-bottom,C.lightBrick,.44);
 b.facade(a,u,bottom,width+.4,.2,C.lightBrick,.45);
}
function window(b:Builder,a:Axis,u:number,y:number,w:number,h:number,modern=false):void {b.facade(a,u,y,w+.28,h+.26,modern?C.frame:C.pale);b.facade(a,u,y,w,h,C.glass,.39);b.facade(a,u,y,w,.095,C.frame,.5);b.facade(a,u,y,.085,h,C.frame,.5);b.facade(a,u,y-h/2-.12,w+.4,.2,C.pale,.44,.35);}
function pinnacle(b:Builder,p:P,height:number):void {b.box([p[0],p[1]+.75,p[2]],[.65,1.5,.65],C.lightBrick);if(b.minecraft){for(let i=0;i<5;i++){const size=.72*(1-i/5);b.box([p[0],p[1]+1.6+i*(height-1.6)/5,p[2]],[size,(height-1.6)/5,size],C.brick);}}else b.add("spires",[p[0],p[1]+1.5+(height-1.5)/2,p[2]],[1,height-1.5,1],C.brick);b.box([p[0],p[1]+height+.16,p[2]],[.13,.4,.13],C.gold);}
function parapet(b:Builder,a:Axis,y:number):void {const l=axisLength(a);for(const h of[-.42,.42])b.facade(a,l/2,y+h,l,.15,C.lightBrick,.15,.28);for(let u=.3;u<l;u+=.8){b.beam(pt(a,u-.3,y-.35,.15),pt(a,u+.3,y+.35,.15),.10,C.lightBrick);b.beam(pt(a,u-.3,y+.35,.15),pt(a,u+.3,y-.35,.15),.10,C.lightBrick);}}
function church(b:Builder):void {
 const front:Axis={a:[1761.166,406.336],b:[1780.363,399.562],side:-1};
 const west:Axis={a:[1744.402,356.651],b:[1759.144,398.528],side:-1};
 const east:Axis={a:[1762.291,350.342],b:[1777.042,392.207],side:1};
 for(const a of[west,east]){for(let i=0;i<5;i++){const u=(i+.5)*axisLength(a)/5;arch(b,a,u,10.1,5.05,16.5);for(const d of[-1.5,-.5,.5,1.5])b.facade(a,u+d,16.8,.13,12.7,C.lightBrick,.48);b.facade(a,u,16.2,4.9,.17,C.lightBrick,.5);for(const h of[22,24])for(const du of[-1.2,1.2]){const n=b.minecraft?6:12;for(let j=0;j<n;j++){const t=j*Math.PI*2/n,q=(j+1)*Math.PI*2/n;b.beam(pt(a,u+du+Math.cos(t)*.75,h+Math.sin(t)*.75,.5),pt(a,u+du+Math.cos(q)*.75,h+Math.sin(q)*.75,.5),.1,C.lightBrick);}}}
 for(let i=0;i<=5;i++){const u=i*axisLength(a)/5;b.facade(a,u,17.2,1.05,24,C.lightBrick,.25,.7);pinnacle(b,pt(a,u,29.7,.1),3.2);}for(const y of[6.1,9.2,28.5,29.7])b.facade(a,axisLength(a)/2,y,axisLength(a),.22,C.darkBrick,.42,.4);parapet(b,a,30.3);}
 const centre=axisLength(front)/2;arch(b,front,centre,12.1,7.2,16.1);for(let i=-3;i<=3;i++)b.facade(front,centre+i*.9,19.4,.13,13.5,C.lightBrick,.5);b.facade(front,centre,18.3,6.8,.24,C.lightBrick,.5);for(const side of[-1,1])arch(b,front,centre+side*2,5.2,3.3,6.2,C.dark);
 for(const id of FRIEDRICHSWERDER_TOWER_IDS){const p=S[0].parts.find(p=>p.id===id)!;const ring=p.ring;for(const a of ring.map((q,i)=>({a:q,b:ring[(i+1)%ring.length],side:-1})).filter(a=>axisLength(a)>4.5)){const mid=pt(a,axisLength(a)/2,0,1);if(eastCivicPartContains(p,mid[0],mid[2]))a.side=1;const l=axisLength(a);for(const y of[31.6,37.1])for(let k=0;k<3;k++)arch(b,a,(k+.5)*l/3,y-2,1.1,4.3,C.dark);for(const y of[10,21])arch(b,a,l/2,y,1.4,4,C.dark);for(const y of[9,18,29.5,35.1,41.8])b.facade(a,l/2,y,l+.35,.26,C.darkBrick,.26,.4);parapet(b,a,p.top_y_m+.6);}
 const corners=id===FRIEDRICHSWERDER_TOWER_IDS[0]?[[1771.845,394.044],[1777.678,391.982],[1780.363,399.562],[1774.524,401.621]]:[[1758.5,398.746],[1764.325,396.699],[1767.004,404.277],[1761.166,406.336]];for(const[x,z]of corners)pinnacle(b,[x,p.top_y_m,z],3.5);}
 parapet(b,{a:[1766.748,403.563],b:[1774.268,400.906],side:-1},30.5);
 for(const u of[3.1,17.25]){const centre=pt(front,u,27.6,.52),normal=new Vector3(.333,0,.943).normalize();b.add('columns',centre,[1.48,.12,1.48],C.gold,new Quaternion().setFromUnitVectors(UP,normal));b.add('columns',pt(front,u,27.6,.61),[1.29,.10,1.29],C.darkBrick,new Quaternion().setFromUnitVectors(UP,normal));b.beam(pt(front,u,27.6,.72),pt(front,u,28.1,.72),.055,C.gold);b.beam(pt(front,u,27.6,.72),pt(front,u+.34,27.4,.72),.055,C.gold);}
 for(const [u,y,r]of[[centre,25.6,1.0],[centre-1.55,23.9,.9],[centre+1.55,23.9,.9]]){const n=b.minecraft?8:18;for(let i=0;i<n;i++){const a=i*Math.PI*2/n,z=(i+1)*Math.PI*2/n;b.beam(pt(front,u+Math.cos(a)*r,y+Math.sin(a)*r,.6),pt(front,u+Math.cos(z)*r,y+Math.sin(z)*r,.6),.13,C.lightBrick);}}

 const p=pt(front,centre,11.45,.65);b.box(p,[.36,1.7,.3],0x647360,axisYaw(front));for(const s of[-1,1])b.beam([p[0],p[1]+.4,p[2]],[p[0]+s*1.2,p[1]+.9,p[2]],.2,0x647360);
}
function ministry(b:Builder):void {
 for(const s of S.slice(1)){const modern=s.key==='foreignOfficeNew';for(const p of s.parts){if(EAST_CIVIC_OPEN_CANOPY_IDS.has(p.id)||EAST_CIVIC_GLASS_PART_IDS.has(p.id))continue;for(const ring of[p.ring,...p.holes])for(let e=0;e<ring.length;e++){const a:Axis={a:ring[e],b:ring[(e+1)%ring.length],side:1},l=axisLength(a);if(l<8)continue;const mid=pt(a,l/2,0,.35);if(eastCivicPartContains(p,mid[0],mid[2]))a.side=-1;const outward=pt(a,l/2,0,.6);if(s.parts.some(q=>q!==p&&eastCivicPartContains(q,outward[0],outward[2])&&(eastCivicPartRoofAt(q,outward[0],outward[2])??0)>=p.top_y_m-.8))continue;const pitch=modern?3.6:3.8,n=Math.max(1,Math.floor(l/pitch));for(let i=0;i<n;i++){const u=(i+.5)*l/n,point=pt(a,u,0,-.1),top=eastCivicPartRoofAt(p,point[0],point[2])??p.top_y_m;for(let y=modern?7.4:9;y+1.5<top-1;y+=modern?3.75:4){if(p.id==='DEBE3DYaStnJ2Nlk' && eastCivicPartBaseAt(p,point[0],point[2])>y)continue;if(p.id==='DEBE3DYaStnJ2Nlk' && y>9 && Math.abs(a.a[0]-1918.164)<.01 && Math.abs(a.b[0]-1929.26)<.01)continue;const outside=pt(a,u,0,.6);if(s.parts.some(q=>q!==p && eastCivicPartContains(q,outside[0],outside[2]) && (eastCivicPartRoofAt(q,outside[0],outside[2])??0)>y+1.6))continue;window(b,a,u,y,modern?1.35:1.62,modern?2.65:2.6,modern);}}b.facade(a,l/2,Math.min(p.top_y_m-.45,modern?27.7:31.2),l,.28,C.pale,.3,.34);if(!modern)for(const y of[5.8,14.1])if(y<p.top_y_m)b.facade(a,l/2,y,l,.24,C.pale,.3,.36);}}}
 const river:Axis={a:[1918.164,443.11],b:[1929.26,476.868],side:1};for(const y of[10.3,14,17.7,21.4,25.1]){b.facade(river,axisLength(river)/2,y,axisLength(river)-1.8,2.85,C.glass,.34);for(let u=1.1;u<axisLength(river)-.7;u+=1.15)b.facade(river,u,y,.085,2.85,C.frame,.47);}
 for(const p of S[1].parts.filter(p=>EAST_CIVIC_GLASS_PART_IDS.has(p.id))){const r=p.ring,a=r[0],d=r[1],e=r[r.length-1];for(let i=0;i<=12;i++){const t=i/12,x=a[0]+(d[0]-a[0])*t,z=a[1]+(d[1]-a[1])*t,xx=x+e[0]-a[0],zz=z+e[1]-a[1];const y1=eastCivicPartRoofAt(p,x,z)??p.top_y_m,y2=eastCivicPartRoofAt(p,xx,zz)??p.top_y_m;b.beam([x,y1+.08,z],[xx,y2+.08,zz],.11,C.frame);}}
 for(const[x,z]of EAST_CIVIC_LOGGIA_POSTS)b.box([x,16.35,z],[1.05,22.3,1.05],C.pale);
 const old:Axis={a:[1833.46,540.93],b:[1939.09,506.2],side:1};for(let i=0;i<24;i++){const u=(i+.5)*axisLength(old)/24;b.facade(old,u,9.35,.7,8.3,C.pale,.55,.72);}for(const y of[5.35,5.57,5.79])b.facade(old,axisLength(old)/2,y,axisLength(old),.18,C.stone,1.1,1.8);
}
function nativeShell(b:Builder):void {const cell=2,parts=S.flatMap(s=>s.parts),bounds=parts.map(bebelplatzPartBounds),grid=new Map<string,{x:number;z:number;top:number;base:number;color:number;wall:number}>();for(let ix=Math.floor(Math.min(...bounds.map(r=>r[0]))/cell);ix*cell<Math.max(...bounds.map(r=>r[2]));ix++)for(let iz=Math.floor(Math.min(...bounds.map(r=>r[1]))/cell);iz*cell<Math.max(...bounds.map(r=>r[3]));iz++){const x=(ix+.5)*cell,z=(iz+.5)*cell;let selected:BebelplatzSourcePart|undefined,top=-Infinity;for(const p of parts){const y=eastCivicPartRoofAt(p,x,z);if(y!==null&&y>top){selected=p;top=y;}}if(!selected)continue;const church=S[0].parts.some(p=>p.id===selected!.id),glass=EAST_CIVIC_GLASS_PART_IDS.has(selected.id);grid.set(`${ix},${iz}`,{x,z,top,base:eastCivicPartBaseAt(selected,x,z),color:glass?C.glass:C.roof,wall:church?C.brick:glass?C.glass:C.stone});}
 for(const[key,v]of grid){b.box([v.x,v.top-.22,v.z],[cell,.44,cell],v.color);const[ix,iz]=key.split(',').map(Number),neighbour=Math.min(...[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>grid.get(`${ix+dx},${iz+dz}`)?.top??5.2)),base=Math.max(neighbour,v.base),h=v.top-.44-base;if(h>0){const n=Math.ceil(h/3);for(let i=0;i<n;i++)b.box([v.x,base+(i+.5)*h/n,v.z],[cell,h/n,cell],v.wall);}}
}
function create(minecraft:boolean):Group {const root=new Group();root.name=minecraft?MINECRAFT_EAST_CIVIC_GROUP_NAME:EAST_CIVIC_GROUP_NAME;root.userData={textureFree:true,keepInMinecraft:minecraft,blockNative:minecraft,fullStaticDetailOnTouch:true,sourcePartIds:S.flatMap(s=>s.parts.map(p=>p.id)),sourceParents:S.flatMap(s=>s.parent_ids),photographsBundled:false,surfaceOnly:true,hiddenSolidInfill:false};const b=new Builder(minecraft);if(minecraft)nativeShell(b);else S.forEach((s,i)=>{const mesh=sourceMesh(s.parts.filter(p=>!EAST_CIVIC_GLASS_PART_IDS.has(p.id)).map(displayed),{wall:i===0?C.brick:C.stone,roof:i===0?0x775f50:C.roof,name:s.key});mesh.userData.originalRoofSheetsRetained=true;mesh.userData.sourceGeometryUnchanged=i!==1;mesh.userData.displayConflictResolution=i===1?'Specific glass atrium and open high loggias supersede overlapping coarse parent closures':undefined;root.add(mesh);const glass=s.parts.filter(p=>EAST_CIVIC_GLASS_PART_IDS.has(p.id));if(glass.length)root.add(sourceMesh(glass,{wall:C.glass,roof:C.glass,name:'Foreign Office glass atria'}));});church(b);ministry(b);b.finish(root);return freezeStaticSceneTransforms(root);}
export function createEastCivicArchitecture():Group{return create(false);}
export function createMinecraftEastCivicArchitecture():Group{return create(true);}
