import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide,
  Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion,
  ShapeUtils, SphereGeometry, Vector2, Vector3,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
import { NEUE_WACHE_COLUMN_U, NEUE_WACHE_DOOR_U, NEUE_WACHE_PROFILE as P, NEUE_WACHE_WALLS } from "./neueWacheProfile";

type Point = [number, number, number];
type Kind = "stone" | "bronze" | "column" | "round";
type Instance = { matrix: number[]; color: number };
const STONE = 0xb4ab93, EDGE = 0xcac0a8, SHADE = 0x9b9585, INTERIOR = 0x898d89;
const BRONZE = 0x494940, BRONZE_LIGHT = 0x5b594b, IRON = 0x353a39;
export const NEUE_WACHE_GROUP_NAME = "Neue Wache open memorial hall and Kollwitz Pieta";
class Builder {
  batches = new Map<Kind, Instance[]>();
  constructor(readonly minecraft: boolean) {}
  add(kind: Kind, p: Point, size: Point, color: number, q = new Quaternion()): void {
    if (this.minecraft) kind = kind === "bronze" ? "bronze" : "stone";
    const values = this.batches.get(kind) ?? [];
    values.push({ matrix: new Matrix4().compose(new Vector3(...p),q,new Vector3(...size)).toArray(), color });
    this.batches.set(kind, values);
  }
  box(p: Point, size: Point, color = STONE): void { this.add("stone",p,size,color); }
  beam(a: Point, b: Point, width: number, color: number, kind: Kind = "stone"): void {
    const d = new Vector3(...b).sub(new Vector3(...a));
    this.add(kind,a.map((v,i)=>(v+b[i])/2) as Point,[width,d.length(),width],color,
      new Quaternion().setFromUnitVectors(new Vector3(0,1,0),d.normalize()));
  }
  finish(root: Group): void {
    const day = new MeshBasicMaterial({color: 0xffffff,vertexColors:true});
    const night = new MeshStandardMaterial({color: 0xffffff,vertexColors:true,roughness:.9, flatShading:true});
    for (const [kind, values] of this.batches) {
      const geometry = kind === "column" ? new CylinderGeometry(.46,.52,1,24) :
        kind === "bronze" && !this.minecraft ? new CylinderGeometry(.5,.5,1,10) :
        kind === "round" && !this.minecraft ? new SphereGeometry(.5,12,8) : new BoxGeometry(1,1,1);
      geometry.deleteAttribute("uv");
      const normal=geometry.getAttribute("normal"), tints=new Float32Array(normal.count*3);
      for(let i=0;i<normal.count;i++){
        const shade=.90+.1*Math.max(0,normal.getY(i))+.06*normal.getX(i)-.06*normal.getZ(i);
        tints.set([shade,shade,shade],i*3);
      }
      geometry.setAttribute("color",new Float32BufferAttribute(tints,3));
      const mesh = new InstancedMesh(geometry,day,0), color = new Color();
      const matrices = new Float32Array(values.length*16), colors = new Float32Array(values.length*3);
      values.forEach((v,i)=>{matrices.set(v.matrix,i*16);color.setHex(v.color).toArray(colors,i*3);});
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices,16);
      mesh.instanceColor = new InstancedBufferAttribute(colors,3);mesh.count = values.length;
      mesh.name = `${NEUE_WACHE_GROUP_NAME} ${kind}`;
      mesh.userData = {dayMaterial:day,nightMaterial:night,textureFree:true};
      mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
    }
  }
}
function mesh(name: string, positions: number[], colors: number[]): Mesh {
  const g = new BufferGeometry();
  g.setAttribute("position",new Float32BufferAttribute(positions,3));
  g.setAttribute("color",new Float32BufferAttribute(colors,3));
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  const day = new MeshBasicMaterial({color:0xffffff,vertexColors:true,side:DoubleSide});
  const night = new MeshStandardMaterial({color:0xffffff,vertexColors:true,side:DoubleSide,roughness:.91,flatShading:true});
  const m = new Mesh(g,day);m.name=name;m.userData={dayMaterial:day,nightMaterial:night,textureFree:true};return m;
}
function roof(root: Group, b: Builder): void {
  if (b.minecraft) {
    // A thin stepped shell, no concealed solid fill; the open oculus survives.
    const cell=.55;
    for(let x=-11.5;x<11.4;x+=cell) for(let z=-7.6;z<13.8;z+=cell) {
      const u=x+cell/2,v=z+cell/2;
      if(Math.hypot(u,v)<P.oculusRadius+cell*.5) continue;
      b.box([u,14.7,v],[cell,.626,cell],0xaaa99b);
    }
    return;
  }
  const outline = [[-11.5,-7.6],[11.4,-7.6],[11.4,13.8],[-11.5,13.8]].map(([x,z])=>new Vector2(x,z));
  const hole = Array.from({length:48},(_,i)=>new Vector2(Math.cos(i*Math.PI/24)*P.oculusRadius,Math.sin(i*Math.PI/24)*P.oculusRadius));
  const flat=[...outline,...hole],triangles=ShapeUtils.triangulateShape(outline,[hole]);
  const positions:number[]=[],colors:number[]=[],color=new Color();
  const tri=(a:Point,b:Point,c:Point,tone:number)=>{color.setHex(tone);for(const p of [a,b,c]){positions.push(...p);colors.push(color.r,color.g,color.b);}};
  for(const y of [14.35,P.roofY]) for(const t of triangles) tri(...t.map(i=>[flat[i].x,y,flat[i].y] as Point) as [Point,Point,Point],y===P.roofY?0xb9b7ab:0xc4c5be);
  for(let i=0;i<48;i++) {
    const a=hole[i],c=hole[(i+1)%48];
    tri([a.x,14.35,a.y],[c.x,14.35,c.y],[c.x,P.roofY,c.y],0x999e97);
    tri([a.x,14.35,a.y],[c.x,P.roofY,c.y],[a.x,P.roofY,a.y],0x999e97);
  }
  root.add(mesh("Neue Wache roof with real open oculus",positions,colors));
}
function sculpture(root: Group,b:Builder):void {
  const floor=P.floorY;
  b.box([0,floor+.025,0],[3.1,.05,3.15],0x343733);
  // Seated, hooded mother enclosing the adult son between her knees.
  // Folded drapery is authored low-poly geometry, not an image/scan.
  const rings=[{y:.08,rx:.68,rz:.5,z:.04},{y:.42,rx:.67,rz:.49,z:-.02},
    {y:.94,rx:.45,rz:.33,z:-.16},{y:1.32,rx:.29,rz:.25,z:-.18}];
  if(!b.minecraft) {
    const positions:number[]=[],colors:number[]=[],color=new Color();
    const point=(j:number,i:number):Point=>{
      const r=rings[j],a=i*Math.PI/16,fold=1+.065*Math.sin(i*2.4+j*.7);
      return [Math.sin(a)*r.rx*fold,floor+r.y,r.z-Math.cos(a)*r.rz*fold];
    };
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<32;i++) {
      // A front recess keeps the son's folded body distinct from the cloak.
      if(j>0 && i>=12 && i<=19)continue;
      color.setHex(i%3===0?BRONZE_LIGHT:BRONZE);
      for(const p of [point(j,i),point(j,i+1),point(j+1,i+1),point(j,i),point(j+1,i+1),point(j+1,i)]){
        positions.push(...p);colors.push(color.r,color.g,color.b);
      }
    }
    root.add(mesh("Kollwitz mother folded bronze mantle",positions,colors));
  } else {
    for(let j=0;j<7;j++) {
      const y=(j+.5)*.19,r=.7-j*.06;
      b.add("bronze",[0,floor+y,-.12],[r*1.55,.19,.54],BRONZE);
      if(j<4)for(const side of [-1,1])b.add("bronze",[side*(.49-j*.04),floor+y,.21],[.22,.19,.42],BRONZE_LIGHT);
    }
  }
  b.add("round",[-.04,floor+1.42,-.12],[.45,.38,.44],BRONZE);
  b.add("round",[-.035,floor+1.36,.075],[.28,.24,.15],0x33372f);
  b.beam([-.35,floor+.81,.04],[-.25,floor+1.04,.26],.19,BRONZE_LIGHT,"bronze");
  b.beam([-.25,floor+1.04,.26],[-.04,floor+1.22,.20],.15,BRONZE_LIGHT,"bronze");
  b.beam([.35,floor+.92,-.03],[.40,floor+.63,.30],.19,BRONZE_LIGHT,"bronze");
  b.beam([.40,floor+.63,.30],[.16,floor+.47,.46],.13,BRONZE_LIGHT,"bronze");
  b.add("round",[-.31,floor+.58,.28],[.30,.33,.29],BRONZE_LIGHT);
  b.beam([-.24,floor+.46,.30],[.25,floor+.33,.39],.30,BRONZE,"bronze");
  b.beam([.25,floor+.33,.39],[-.24,floor+.19,.59],.20,BRONZE_LIGHT,"bronze");
  b.beam([-.24,floor+.19,.59],[.44,floor+.11,.61],.15,BRONZE_LIGHT,"bronze");
  b.beam([-.20,floor+.44,.47],[.14,floor+.43,.50],.095,BRONZE_LIGHT,"bronze");
  const paths=letteringStrokePaths("DEN OPFERN VON KRIEG UND GEWALTHERRSCHAFT",.15);
  for(const line of paths)for(let i=1;i<line.length;i++)b.beam(
    [line[i-1][0],floor+.012,2.1-line[i-1][1]],
    [line[i][0],floor+.012,2.1-line[i][1]],.014,0x65675e);
}
/** The same lightweight hall in every mode; native mode has block-built columns/roof. */
export function createNeueWache(minecraft=false):Group {
  const root=new Group(),b=new Builder(minecraft);
  root.name=NEUE_WACHE_GROUP_NAME+(minecraft?" Minecraft":"");
  root.position.set(P.centre[0],0,P.centre[1]);root.rotation.y=P.rotationY;
  root.userData={textureFree:true,keepInMinecraft:minecraft,blockNative:minecraft,openInterior:true,sourcePrismId:"24240381"};
  // Bounded granite forecourt: mapped paved approach and LDA paving account.
  b.box([-.45,P.streetY+.014,26.4],[26,.028,10.5],0x9d9f92);
  for(let u=-12.45;u<13;u+=1.2)b.box([u,P.streetY+.029,26.4],[.02,.01,10.5],0x858c80);
  for(let v=21.15;v<31.7;v+=1.2)b.box([-.45,P.streetY+.030,v],[26,.01,.02],0x858c80);
  b.box([-.1,P.floorY-.065,3.2],[23,.13,21.65],0x8b8e86);
  b.box([-.45,P.floorY-.07,17.6],[16.8,.14,8.3],0xb3ae9d);
  b.box([-.45,P.streetY+.045,21.6],[17.5,.09,1.1],0xb3ae9d);
  for(const [u,v,w,d] of NEUE_WACHE_WALLS)b.box([u,9.91,v],[w,9.06,d],STONE);
  b.box([-.1,11.79,13.37],[22.9,4.89,.9],STONE);
  // Restrained ashlar coursing reads on all four sides and inside the hall.
  for(let y=P.floorY+.6;y<14.5;y+=.75) {
    for(const side of [-1,1])b.box([side===-1?-10.70:10.53,y,2.9],[.025,.022,19.6],0x6f7770);
    b.box([-.1,y,-6.805],[21.2,.022,.025],0x6f7770);
    for(const [u,v,w,d]of NEUE_WACHE_WALLS)if(v===13.37)b.box([u,y,v+d/2+.01],[w,.02,.025],SHADE);
  }
  for(const side of [-1,1]) {
    b.box([side===-1?-10.69:10.52,9.9,2.9],[.06,9.0,19.55],INTERIOR);
    for(let y=P.floorY+.6;y<14.5;y+=.75)b.box([side===-1?-10.655:10.485,y,2.9],[.014,.021,19.55],0x737a74);
  }
  b.box([-.1,9.9,-6.79],[21.1,9,.035],INTERIOR);
  for(let y=P.floorY+.6;y<14.5;y+=.75)b.box([-.1,y,-6.76],[21.1,.025,.025],0x737a74);
  for(const u of [-10.65,9.95])for(const v of [-5.9,15.1]) {
    b.box([u,9.7,v],[4.4,8.64,3.8],STONE);
    b.box([u,14.09,v],[4.65,.35,4.05],EDGE);
    b.box([u,14.6,v],[4.1,.67,3.52],SHADE);
    b.box([u,14.93,v],[4.32,.16,3.72],EDGE);
    for(let dx=-1.8;dx<2;dx+=.5)b.box([u+dx,13.79,v+1.9],[.2,.3,.6],EDGE);
  }
  for(const u of NEUE_WACHE_COLUMN_U) {
    for(const v of (u===NEUE_WACHE_COLUMN_U[0]||u===NEUE_WACHE_COLUMN_U[5]?[15.65,17.7,19.75]:[19.75])) {
      b.add("column",[u,8.9,v],[1,6.98,1],EDGE);
      b.box([u,12.4,v],[1.37,.24,1.37],EDGE);
      if(!minecraft) {
        for(let i=0;i<20;i++) {const a=i*Math.PI/10;b.beam([u+Math.sin(a)*.539,5.52,v+Math.cos(a)*.539],[u+Math.sin(a)*.479,12.22,v+Math.cos(a)*.479],.024,SHADE);}
      } else for(let y=5.8;y<12.2;y+=.75)b.box([u,y,v],[1.04,.06,1.04],SHADE);
    }
  }
  b.box([-.46,12.72,17.45],[16.5,.5,6.6],STONE);
  b.box([-.46,13.45,20.12],[16.85,1.05,.85],STONE);
  b.box([-.46,13.94,20.12],[17.1,.19,1.06],EDGE);
  // Triangular low pediment follows the source roof apex, never a tall invented gable.
  if(minecraft) for(let i=0;i<34;i++) {
    const u=-8.7+(i+.5)*16.5/34, h=Math.max(.025,(1-Math.abs((u+.45)/8.25))*1.45);
    b.box([u,13.99+h/2,17.3],[16.5/34,h,7.1],STONE);
  } else {
    const positions:number[]=[],colors:number[]=[],tone=new Color(STONE);
    const tri=(a:Point,b:Point,c:Point)=>{for(const p of [a,b,c]){positions.push(...p);colors.push(tone.r,tone.g,tone.b);}};
    for(const v of [13.75,20.85])tri([-8.7,13.99,v],[7.8,13.99,v],[-.12,P.pedimentTopY,v]);
    for(const u of [-8.7,7.8]) {
      tri([u,13.99,13.75],[-.12,P.pedimentTopY,13.75],[-.12,P.pedimentTopY,20.85]);
      tri([u,13.99,13.75],[-.12,P.pedimentTopY,20.85],[u,13.99,20.85]);
    }
    root.add(mesh("Neue Wache continuous source-fitted pediment",positions,colors));
  }
  b.beam([-8.9,14.02,20.72],[-.12,P.pedimentTopY,20.72],.22,EDGE);
  b.beam([-.12,P.pedimentTopY,20.72],[8,14.02,20.72],.22,EDGE);
  // Six winged relief figures and restrained pediment relief silhouettes.
  for(const u of NEUE_WACHE_COLUMN_U) {
    b.add("round",[u,13.65,20.61],[.19,.19,.12],EDGE);
    b.add("column",[u,13.35,20.64],[.24,.43,.12],EDGE);
    for(const side of [-1,1])b.beam([u,13.5,20.62],[u+side*.28,13.66,20.63],.11,EDGE);
  }
  for(const u of [-8.91,8.0])for(const v of [15.7,18.1]) {
    b.add("round",[u,13.65,v],[.12,.19,.19],EDGE);
    b.add("column",[u,13.35,v],[.12,.43,.24],EDGE);
    for(const side of [-1,1])b.beam([u,13.5,v],[u,13.66,v+side*.28],.11,EDGE);
  }
  for(let i=-6;i<=6;i++) {
    const h=.18+(1-Math.abs(i)/7)*.55;
    b.add("round",[i*.69-.1,14.1+h,20.86],[.15,.15,.10],EDGE);
    b.beam([i*.69-.1,14.02,20.84],[i*.69+.02,14.02+h,20.84],.12,EDGE);
  }
  for(const u of [-3.55,2.7]) {
    for(let dx=-.75;dx<=.76;dx+=.15)b.box([u+dx,7.34,13.37],[.045,3.9,.12],IRON);
    b.box([u,7.45,13.37],[1.6,.055,.14],IRON);
  }
  // Open central iron gate leaves stand against the reveals, with a 2.06 m passage.
  for(const side of [-1,1])for(let dz=-.7;dz<=.7;dz+=.17)b.box([NEUE_WACHE_DOOR_U+side*1.07,7.34,12.9+dz],[.045,3.9,.045],IRON);
  for(let u=-10;u<=10;u+=.55)b.box([u,P.floorY+.004,3],[.012,.008,19.6],0x787e77);
  for(let v=-6.5;v<12.7;v+=.55)b.box([0,P.floorY+.005,v],[21,.008,.012],0x787e77);
  roof(root,b);sculpture(root,b);b.finish(root);
  return freezeStaticSceneTransforms(root);
}
