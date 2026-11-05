import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, SphereGeometry, Vector3,
} from "three";
import source from "./data/karlMarxPlacesV316.json";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = readonly [number, number, number];
type Box = { center: Point; size: Point; yaw: number };
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, 1);
const GROUND = 3;
const C = { cream: 0xc7bfab, dark: 0x252f30, wood: 0x976943, green: 0x437339, pale: 0xf1efdf, copper: 0x7b8063, pipe: 0x424e4b, water: 0x75aaa6, amber: 0xf1c576 };

export const KARL_MARX_PLACES_V316 = {
  museumNode: "1270188822", entranceNode: "2772941687", museumParent: "DEBE02YY200009jf",
  gardenWay: "38863723", gardenBuildingWay: "24264765", fountainWay: "24240866",
  groundY: GROUND, gardenRing: source.gardenRing,
  displayEstimates: "Facade fittings, furniture layout, tree crowns and small piping sections are photo-guided display estimates.",
} as const;

class PlaceBatch {
  boxes: number[][] = [];
  balls: number[][] = [];
  solids: Box[] = [];
  positions: number[] = [];
  colors: number[] = [];
  roles: Record<string, number> = {};
  constructor(readonly native: boolean) {}
  mark(role: string): void { this.roles[role] = (this.roles[role] ?? 0) + 1; }
  box(center: Point, size: Point, color: number, yaw = 0, solid = false): void {
    const actualYaw = this.native ? 0 : yaw;
    const matrix = new Matrix4().makeRotationY(actualYaw).scale(new Vector3(...size));
    matrix.setPosition(...center);
    this.boxes.push([...matrix.elements, color]);
    if (solid) this.solids.push({ center, size, yaw: actualYaw });
  }
  line(a: Point, b: Point, width: number, color: number): void {
    const start = new Vector3(...a), delta = new Vector3(...b).sub(start), length = delta.length();
    if (length < 0.001) return;
    if (this.native) {
      const pitch = Math.max(0.085, width * 0.85), count = Math.ceil(length / pitch);
      for (let i = 0; i <= count; i++) {
        this.box(start.clone().addScaledVector(delta, i / count).toArray() as [number, number, number], [width, width, width], color);
      }
      return;
    }
    const matrix = new Matrix4().compose(start.addScaledVector(delta, 0.5),
      new Quaternion().setFromUnitVectors(FORWARD, delta.multiplyScalar(1 / length)), new Vector3(width, width, length));
    this.boxes.push([...matrix.elements, color]);
  }
  triangle(a: Point, b: Point, c: Point, color: number): void {
    const tint = new Color(color);
    this.positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.colors.push(tint.r, tint.g, tint.b);
  }
  crown(center: Point, size: Point, color: number): void {
    if (this.native) { this.box(center, size, color); return; }
    const matrix = new Matrix4().makeScale(...size).setPosition(...center);
    this.balls.push([...matrix.elements, color]);
  }
  finish(name: string): Group {
    const root = new Group(); root.name = name;
    root.userData = { textureFree: true, fullStaticDetailOnTouch: true, blockNative: this.native, keepInMinecraft: this.native, roleCounts: this.roles };
    const day = new MeshBasicMaterial({ vertexColors: true });
    const night = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true });
    for (const [rows, geometry] of [[this.boxes, new BoxGeometry()], [this.balls, new SphereGeometry(0.5, 10, 7)]] as const) {
      if (!rows.length) { geometry.dispose(); continue; }
      geometry.deleteAttribute("uv");
      const mesh = new InstancedMesh(geometry, day, 0), tint = new Color();
      const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
      rows.forEach((row, i) => { matrices.set(row.slice(0, 16), i * 16); tint.setHex(row[16]).toArray(colors, i * 3); });
      mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
      mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.count = rows.length;
      mesh.name = `${name} ${rows === this.boxes ? "fittings" : "tree crowns"}`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, blockNative: this.native, keepInMinecraft: this.native };
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
    }
    if (this.positions.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
      geometry.setAttribute("color", new Float32BufferAttribute(this.colors, 3)); geometry.computeVertexNormals();
      const d = day.clone(), n = night.clone(); d.side = n.side = DoubleSide;
      const mesh = new Mesh(geometry, d); mesh.name = `${name} canopy surfaces`;
      mesh.userData = { dayMaterial: d, nightMaterial: n }; root.add(mesh);
    }
    return root;
  }
}

function museumPoint(u: number, y: number, out: number, native: boolean): Point {
  // Positive lettering direction is north along the photographed east facade.
  const tangentX = 0.1844, tangentZ = -0.98285, normalX = 0.98285, normalZ = 0.1844;
  let x = source.museumEntrance[0] + tangentX * u;
  const z = source.museumEntrance[1] + tangentZ * u;
  if (native) {
    const row = source.nativeFacades.find(([a, b]) => z >= a && z < b);
    x = row?.[2] ?? x;
    return [x + out, y, z];
  }
  const wall = source.drawnFacades.find(([a, b]) => z >= Math.min(a[1], b[1]) && z <= Math.max(a[1], b[1]));
  if (wall) {
    const [a, b] = wall;
    x = a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]);
  }
  return [x + normalX * out, y, z + normalZ * out];
}

function museum(native: boolean): PlaceBatch {
    const b = new PlaceBatch(native), yaw = Math.atan2(0.98285, 0.1844);
    const at = (u: number, y: number, out = 0.18) => museumPoint(u, y, out, native);
    const onWall = (u: number, y: number, width: number, height: number, color: number, out = 0.18, thickness = 0.08) =>
      b.box(at(u, y, out), native ? [thickness, height, width] : [width, height, thickness], color, yaw);
    for (const [word, center, height] of [["COMPUTERSPIELE", -8.0, 0.92], ["MUSEUM", 6.1, 0.92]] as const) {
      for (const path of letteringStrokePaths(word, height)) for (let i = 1; i < path.length; i++)
        b.line(at(center + path[i - 1][0], 8.55 + path[i - 1][1], 0.24), at(center + path[i][0], 8.55 + path[i][1], 0.24), 0.14, C.pale);
      b.mark("raised museum wordmark");
    }
    // Main portal, visible display, bowed wrought-iron grille and fluted piers.
    onWall(0, 5.05, 2.4, 3.6, 0x3a514f, 0.23);
    for (const u of [-1.26, 1.26]) onWall(u, 5.08, 0.12, 3.8, C.cream, 0.34);
    onWall(0, 6.88, 2.7, 0.15, C.cream, 0.35);
    onWall(0, 4.9, 0.06, 3.2, C.pale, 0.36);
    for (const side of [-1, 1]) {
      const u = side * 2.15;
      onWall(u, 5.5, 0.63, 4.9, C.cream, 0.32, 0.34);
      for (let flute = 0; flute < 5; flute++) onWall(u + (flute - 2) * 0.09, 5.5, 0.029, 4.5, 0xa69b81, 0.51);
    }
    for (let i = 0; i < 11; i++) {
      const u = -1.8 + i * 0.36;
      const points = [at(u, 8.16, 0.4), at(u, 8.20, 1.15), at(u, 8.65, 1.82), at(u, 10.5, 1.82)];
      for (let j = 1; j < points.length; j++) b.line(points[j - 1], points[j], 0.055, C.dark);
    }
    for (const y of [8.22, 9.2, 10.42]) b.line(at(-1.9, y, 1.82), at(1.9, y, 1.82), 0.055, C.dark);
    b.mark("bowed entrance grille");
    onWall(0.06, 9.73, 1.6, 1.2, C.dark, 1.88, 0.12);
    // A representative still from the changing game display, never a video.
    for (let y = 0; y < 10; y++) for (let x = 0; x < 14; x++) {
      const active = (x < 4 && y > 4) || (x >= 4 && x < 8 && y > 6) || (x >= 8 && y > 3 && y < 7);
      onWall((x - 6.5) * 0.102, 9.73 + (y - 4.5) * 0.103, 0.098, 0.099, active ? [0x54c68b, 0x2bb793, 0x96ba48][(x + y) % 3] : 0x087955, 1.965, 0.025);
    }
    b.mark("pixel game display");
    // Pixel murals occupy the photographed left display window only.
    onWall(-6.8, 5.3, 3.6, 3.45, 0x354d50, 0.24);
    for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) {
      if (x > 1 && x < 10 && y > 1 && y < 10) continue;
      const color = [0x83b5a0, 0xbf6895, 0xe7d075, 0x6d9ba5, 0xd2826b][(x * 3 + y * 7) % 5];
      onWall(-6.8 + (x - 5.5) * 0.27, 5.3 + (y - 5.5) * 0.27, 0.265, 0.265, color, 0.32, 0.035);
    }
    for (const path of letteringStrokePaths("WELCOME", 0.26)) for (let i = 1; i < path.length; i++)
      b.line(at(-6.8 + path[i - 1][0], 5.5 + path[i - 1][1], 0.38), at(-6.8 + path[i][0], 5.5 + path[i][1], 0.38), 0.045, C.pale);
    b.mark("pixel window graphic");
    return b;
}

function inGarden(x: number, z: number): boolean {
  let inside = false;
  const ring = source.gardenRing;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i], [c, d] = ring[j];
    if ((b > z) !== (d > z) && x < (c - a) * (z - b) / (d - b) + a) inside = !inside;
  }
  return inside;
}

function garden(native: boolean): PlaceBatch {
  const b = new PlaceBatch(native), yaw = -0.18;
  const anchor = (u: number, v: number): readonly [number, number] => [4745 + Math.cos(yaw) * u + Math.sin(yaw) * v, 232 - Math.sin(yaw) * u + Math.cos(yaw) * v];
  const candidates = [[-8,-3],[-3,-3],[2,-3],[7,-3],[-8,2],[-3,2],[2,2],[7,2],[-8,7],[-3,7],[2,7],[7,7]];
  for (const [u, v] of candidates) {
    const [x,z] = anchor(u,v);
    if (![-1,1].every(s => [-1,1].every(t => inGarden(x+s*1.5,z+t*1.45)))) continue;
    if (source.trees.some(([tx,tz]) => Math.hypot(x-tx,z-tz)<2.75)) continue;
    const point = (a:number,y:number,c:number):Point => [x+Math.cos(yaw)*a+Math.sin(yaw)*c,y,z-Math.sin(yaw)*a+Math.cos(yaw)*c];
    b.box(point(0,GROUND+0.78,0),[2.1,0.12,0.82],C.wood,yaw,true);
    for(const side of [-1,1]) {
      b.box(point(0,GROUND+0.48,side*0.86),[2.1,0.11,0.33],C.wood,yaw,true);
      b.box(point(0,GROUND+0.90,side*1.0),[2.1,0.27,0.10],C.wood,yaw,true);
      for(const leg of [-0.8,0.8]) {
        b.box(point(leg,GROUND+0.36,side*0.3),[0.075,0.69,0.075],C.dark,yaw,true);
        b.box(point(leg,GROUND+0.23,side*0.87),[0.075,0.43,0.075],C.dark,yaw,true);
      }
    }
    b.mark("wood and metal seating group");
  }
  for (const [u,v] of [[-6,-1],[5,2],[2,8]]) {
    const [x,z]=anchor(u,v), radius=2.7, top=GROUND+3.0;
    b.box([x,GROUND+1.5,z],[0.09,3.0,0.09],C.dark,0,true);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4,c=(i+1)*Math.PI/4;
      const p:Point=[x+Math.cos(a)*radius,top-0.39,z+Math.sin(a)*radius];
      const q:Point=[x+Math.cos(c)*radius,top-0.39,z+Math.sin(c)*radius];
      if(!native)b.triangle([x,top+0.12,z],p,q,C.dark);
      else for(let dx=-2.5;dx<=2.5;dx+=0.5)for(let dz=-2.5;dz<=2.5;dz+=0.5) {
        if(i!==0||Math.hypot(dx,dz)>radius)continue;
        b.box([x+dx,top+0.12-Math.max(Math.abs(dx),Math.abs(dz))*0.17,z+dz],[0.5,0.12,0.5],C.dark);
      }
      b.line([x,top+0.10,z],p,0.045,0x62655c);
    }
    b.mark("dark garden parasol");
  }
  for(const [x,z,h,r] of source.trees) {
    b.line([x,GROUND,z],[x,GROUND+h*0.65,z],0.32,0x6d634d);
    for(const [ox,oy,oz] of [[0,0,0],[-1.3,0.6,0.6],[1.1,0.35,-0.9],[0.3,1.4,0.2]])
      b.crown([x+ox,GROUND+h-r+oy,z+oz],[r*1.6,r*1.45,r*1.5],ox<0?0x527d42:0x648b4d);
    b.mark("DOP anchored garden tree");
  }
  // Warm cage lanterns hang in the same rows visible in the 2026 operator photographs.
  for(const v of [-5,3,11]) {
    const [ax,az]=anchor(-11,v),[cx,cz]=anchor(8,v);
    b.line([ax,GROUND+3.6,az],[cx,GROUND+3.6,cz],0.035,C.dark);
    for(let i=0;i<6;i++) {
      const x=ax+(cx-ax)*(i+0.5)/6,z=az+(cz-az)*(i+0.5)/6;
      b.box([x,GROUND+3.29,z],[0.13,0.24,0.13],C.amber);
      for(const side of [-1,1])for(const along of [-1,1])
        b.line([x+side*0.14,GROUND+3.12,z+along*0.14],[x+side*0.14,GROUND+3.46,z+along*0.14],0.025,C.dark);
    }
  }
  // The small existing courtyard water trough is retained as a display estimate.
  const [fx,fz]=anchor(1,11.5);
  b.box([fx,GROUND+0.29,fz],[3.4,0.58,1.7],C.cream,yaw,true);
  b.box([fx,GROUND+0.60,fz],[3.0,0.025,1.3],C.water,yaw);
  for(const du of [-1,0,1])b.line([fx+du,GROUND+0.62,fz],[fx+du,GROUND+0.98,fz],0.045,0xc7e4df);
  b.mark("courtyard fountain");
  return b;
}

function fountain(native:boolean):PlaceBatch {
  const b=new PlaceBatch(native),[x,z]=source.fountainCenter;
  // Preserve the complete v163 sculpture. Add visible steel pipework below its relief ring.
  for(const [radius,count] of [[7,43],[3.3,12],[1.2,6]]) {
    for(let i=0;i<count;i++) {
      const a=i*Math.PI*2/count,c=(i+1)*Math.PI*2/count;
      const p:Point=[x+Math.cos(a)*radius,GROUND+0.22,z+Math.sin(a)*radius];
      const q:Point=[x+Math.cos(c)*radius,GROUND+0.22,z+Math.sin(c)*radius];
      b.line(p,q,0.15,C.pipe);
      b.line(p,[p[0],GROUND+0.48,p[2]],0.11,C.copper);
    }
    b.mark("polygonal water supply pipe");
  }
  for(let i=0;i<8;i++) {
    const angle=i*Math.PI/4,dx=Math.cos(angle),dz=Math.sin(angle);
    b.line([x+dx*5.1,GROUND+0.24,z+dz*5.1],[x+dx*3.7,GROUND+2.35,z+dz*3.7],0.10,C.pipe);
    b.box([x+dx*5.1,GROUND+0.20,z+dz*5.1],[0.58,0.12,0.58],C.pipe);
  }
  // Partial gilding is documented by the sculptor's estate; these slim facets
  // are original display motifs, placed on four existing crystalline plates.
  for(const index of [1,5,9,13]) {
    const angle=(index+0.5)*Math.PI/8,dx=Math.cos(angle),dz=Math.sin(angle);
    for(let j=0;j<3;j++) {
      const u=-0.35+j*0.30;
      const a:Point=[x+dx*5.50-dz*u,GROUND+2.7+j*0.28,z+dz*5.50+dx*u];
      b.line(a,[a[0]-dz*0.30,a[1]+0.30,a[2]+dx*0.30],0.035,0xaa9d65);
    }
  }
  return b;
}

/** Each site owns only additive furniture and recognition on retained geometry. */
export function createKarlMarxPlacesV316(native=false):Group {
  const root=new Group(); root.name="Computerspielemuseum, James June and Strausberger details v316";
  root.userData={...KARL_MARX_PLACES_V316,textureFree:true,blockNative:native,keepInMinecraft:native};
  for(const [name,build] of [["Computerspielemuseum entrance",museum],["James June summer garden",garden],["Strausberger ring structural detail",fountain]] as const) {
    const batch = build(native);
    if (name === "James June summer garden") solidCache.set(native, batch.solids);
    root.add(batch.finish(name));
  }
  return freezeStaticSceneTransforms(root);
}

const solidCache = new Map<boolean,Box[]>();
/** The open garden routes remain free between its actual represented furniture. */
export function karlMarxPlacesSolidAtV316(x:number,y:number,z:number,radius=0,native=false):boolean {
  if(x<4727||x>4767||z<207||z>251)return false;
  const solids=solidCache.get(native);
  if (!solids) return false;
  return solids.some(box=>{
    const dx=x-box.center[0],dz=z-box.center[2],c=Math.cos(box.yaw),s=Math.sin(box.yaw);
    return Math.abs(dx*c-dz*s)<box.size[0]/2+radius&&Math.abs(dx*s+dz*c)<box.size[2]/2+radius&&y+radius>box.center[1]-box.size[1]/2&&y-radius<box.center[1]+box.size[1]/2;
  });
}
