import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import source from "./data/ulapParkSources.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number];
type Vec = [number, number, number];
export const ULAP_SOURCE = source;
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, 1);
const STONE = 0x989b8b, WOOD = 0x766451, IRON = 0x515c57;
class Boxes {
  matrices: number[] = [];
  colors: number[] = [];
  box(p: Vec, size: Vec, tint: number, yaw = 0): void {
    new Matrix4().compose(new Vector3(...p), new Quaternion().setFromAxisAngle(UP, yaw), new Vector3(...size)).toArray(this.matrices, this.matrices.length);
    new Color(tint).toArray(this.colors, this.colors.length);
  }
  beam(a: Vec, b: Vec, width: number, tint: number): void {
    const direction = new Vector3(...b).sub(new Vector3(...a));
    const length = direction.length();
    if (length < .001) return;
    new Matrix4().compose(
      new Vector3(...a).add(new Vector3(...b)).multiplyScalar(.5),
      new Quaternion().setFromUnitVectors(FORWARD, direction.divideScalar(length)),
      new Vector3(width, width, length),
    ).toArray(this.matrices, this.matrices.length);
    new Color(tint).toArray(this.colors, this.colors.length);
  }
  finish(name: string, native: boolean, glow = false): InstancedMesh {
    const geometry = new BoxGeometry(); geometry.deleteAttribute("uv");
    const day = new MeshBasicMaterial({color: 0xffffff});
    const night = new MeshStandardMaterial({color: 0xffffff, roughness: .96, emissive: glow ? 0xffdda0 : 0, emissiveIntensity: glow ? .85 : 0});
    if(glow){night.userData.nightEmissive=0xffdda0;night.userData.nightEmissiveIntensity=.85;}
    const mesh = new InstancedMesh(geometry,day,0);
    mesh.count=this.colors.length/3;mesh.instanceMatrix=new InstancedBufferAttribute(new Float32Array(this.matrices),16);mesh.instanceColor=new InstancedBufferAttribute(new Float32Array(this.colors),3);
    mesh.name=name;mesh.userData={dayMaterial:day,nightMaterial:night,civicBuildingDetail:true,textureFree:true,blockNative:native,hiddenSolidInfill:false};mesh.computeBoundingBox();mesh.computeBoundingSphere();return mesh;
  }
}

/** Leave the existing mapped trunks open through the broad historic stair.
 * Only ground-plane root clearances are reconstructed; no new trees are added. */
function clearTreadIntervals(
  x: number, z: number, ux: number, uz: number,
  depth: number, from: number, to: number,
): Point[] {
  let intervals: Point[] = [[from, to]];
  for (const tree of source.stairTrees.records) {
    const dx = tree.position[0] - x, dz = tree.position[2] - z;
    const distanceAlong = Math.max(0, Math.abs(dx * ux + dz * uz) - depth / 2);
    const radius = tree.trunkRadius + .10;
    if (distanceAlong >= radius) continue;
    const across = -dx * uz + dz * ux;
    const halfGap = Math.sqrt(radius * radius - distanceAlong * distanceAlong);
    const low = across - halfGap, high = across + halfGap;
    const next: Point[] = [];
    for (const [left, right] of intervals) {
      if (high <= left || low >= right) next.push([left, right]);
      else {
        if (low - left > .025) next.push([left, low]);
        if (right - high > .025) next.push([high, right]);
      }
    }
    intervals = next;
  }
  return intervals;
}
function clip(poly:Point[], a:Point, b:Point, sign:number):Point[]{
  const side=(p:Point)=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
  const out:Point[]=[];
  for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=side(p),v=side(q);if(u>=0)out.push(p);if((u>=0)!==(v>=0)){const t=u/(u-v);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}
  return out;
}
/** A thin, terrain-following gravel layer within the retained OSM park ring.
 * The lower grove / planted-bank division is an illustrative reconstruction,
 * not a traced landscape plan. All mapped source trees remain in their layer. */
function gravel(terrainAt:(x:number,z:number)=>number,native:boolean):Mesh {
  const ring=source.parkRing.slice(0,-1) as Point[];
  const area=ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1];},0),sign=Math.sign(area);
  const positions:number[]=[];
  for(let x=-494;x<-364;x+=4)for(let z=-554;z<-437;z+=4){
    let cell:Point[]=[[x,z],[x+4,z],[x+4,z+4],[x,z+4]];
    for(let i=0;i<ring.length&&cell.length;i++)cell=clip(cell,ring[i],ring[(i+1)%ring.length],sign);
    // Leave the historic stair's planted bank uncovered.
    cell=clip(cell,[-484,-479],[-386,-444],-1);
    for(let i=1;i<cell.length-1;i++)for(const p of[cell[0],cell[i+1],cell[i]])positions.push(p[0],terrainAt(native?x+2:p[0],native?z+2:p[1])+.16,p[1]);
  }
  const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.computeBoundingSphere();
  const day=new MeshBasicMaterial({color:0xc3bdac,side:DoubleSide}),night=new MeshBasicMaterial({color:0x3d3a33,side:DoubleSide});
  const mesh=new Mesh(geometry,day);mesh.name="ULAP lower grove fine-gravel ground";mesh.userData={dayMaterial:day,nightMaterial:night,civicBuildingDetail:true,sourcePolygonId:4791783,textureFree:true,blockNative:native};return mesh;
}
/** Width, slat spacing and bench orientation are photo-based display estimates.
 * The 31 bench anchors and stair axes/count tags remain their original OSM data. */
export function createUlapPark(terrainAt:(x:number,z:number)=>number,native=false):Group {
  const root=new Group();root.name=native?"Minecraft ULAP park":"ULAP historic stair and illuminated grove";
  root.userData={sourceBound:true,sourcePolygonId:4791783,sourceBenchIds:source.benches.map(b=>b.id),sourcePathIds:source.stairsAndLandings.map(p=>p.id),existingStairTreeCount:source.stairTrees.records.length,fullStaticDetailOnTouch:true,keepInMinecraft:native,blockNative:native,textureFree:true,proceduralDimensions:true};
  const stone=new Boxes(),wood=new Boxes(),lamps=new Boxes();
  root.add(gravel(terrainAt,native));
  for(const bench of source.benches){
    const [x,z]=bench.position,y=terrainAt(x,z)+.18,yaw=.34;
    const concrete=(bench.tags as {material?:string}).material==="concrete";
    if(concrete){stone.box([x,y+.24,z],[2.1,.48,.64],0xbdbdaf,yaw);continue;}
    const n=native?5:7;
    for(let row=0;row<n;row++)wood.box([x,y+.12+(row+.5)*.40/n,z],[3.15,.40/n-.014,.79],row%2?WOOD:0x897761,yaw);
    // The recessed strip illuminates the bench itself; no extra point lights.
    lamps.box([x,y+.08,z],[2.98,.07,.66],0xdfd4af,yaw);
    for(const side of[-1,1])stone.box([x+side*1.12*Math.cos(yaw),y+.055,z-side*1.12*Math.sin(yaw)],[.18,.11,.56],IRON,yaw);
  }
  for(const path of source.stairsAndLandings){
    // Keep each mapped landing segment, including the kink in 1395945054.
    for (let segment = 0; segment + 1 < path.points.length; segment++) {
    const a=path.points[segment],q=path.points[segment+1],dx=q[0]-a[0],dz=q[1]-a[1],length=Math.hypot(dx,dz);
    if (length < .001) continue;
    const ux=dx/length,uz=dz/length;
    const historic=path.id===985355687||path.id===1395945051||path.id===1395945053||path.id===1395945052||path.id===1395945054||path.id===361460040;
    // The upper approach is mapped as a footway but explicitly has 11 steps.
    const steps = path.tags.highway === "steps" || path.id === 361460040;
    const count=steps ? (historic&&path.id!==361460040?Math.max(1,Math.round(length/.43)):Number(path.tags.step_count)) : Math.max(1,Math.ceil(length/.8));
    const width=historic?18:path.id===1395945055?2.4:2.8,yaw=Math.atan2(dx,dz),lo=terrainAt(a[0],a[1]),hi=terrainAt(q[0],q[1]);
    for(let k=0;k<count;k++){
      const t=(k+.5)/count,y=lo+(hi-lo)*(steps?(k+1)/count:t)+.16;
      // The maintained OSM stair axis occupies the leftmost 2.8 m. The old
      // broad flights continue beside it, with spaced joints and moss seams.
      const strips=historic?7:1;
      for(let j=0;j<strips;j++){
        const offset=historic?j*width/strips:0;
        const ax=a[0]+dx*t,az=a[1]+dz*t,half=(width/strips-.018)/2,depth=length/count+.02;
        const intervals=clearTreadIntervals(ax,az,ux,uz,depth,offset-half,offset+half);
        for (const [left,right] of intervals) {
          const center=(left+right)/2,x=ax-uz*center,z=az+ux*center;
          stone.box([x,y-.12,z],[right-left,.24,depth],(k+j)%4===0?0x8a907d:STONE,yaw);
          if(historic&&j>0&&k%3===1&&right-left>.05)wood.box([x,y+.006,z],[right-left-.03,.02,.05],0x657a4e,yaw);
        }
      }
    }
    if(steps&&!historic)for(const side of[-1,1])for(let k=0;k<=4;k++){
      const t=k/4,x=a[0]+dx*t+uz*side*1.3,z=a[1]+dz*t-ux*side*1.3,y=lo+(hi-lo)*t;
      stone.box([x,y+.65,z],[.055,1.0,.055],IRON);
      if(k<4)stone.beam([x,y+1.13,z],[x+dx/4,y+1.13+(hi-lo)/4,z+dz/4],.065,IRON);
    }
    }
  }
  root.add(stone.finish("ULAP mapped stair flights and concrete details",native),wood.finish("ULAP wooden light benches and planted stair joints",native),lamps.finish("ULAP recessed warm bench lights",native,true));
  return freezeStaticSceneTransforms(root);
}
