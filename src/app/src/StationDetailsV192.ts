import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import source from "./data/stationDetailsV192.json";
import alexander from "./data/alexanderStationsV183Navigation.json";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { zooEntrancePointV192, ZOO_ENTRANCE_V192_POSTS } from "./stationDetailsV192Profile";
export { zooEntrancePointV192, ZOO_ENTRANCE_V192_POSTS } from "./stationDetailsV192Profile";

type P = [number, number, number];
type Row = { matrix: Matrix4; color: number; role: string };
const UP = new Vector3(0, 1, 0);

/** Stroke paths already have their horizontal origin at the label centre. */
export function stationFacadeLetteringPointV192(a: { a: number[]; dx: number; dz: number; nx: number; nz: number; length: number }, p: number[], y: number, out: number): P {
  // Viewer-right is up cross outward normal, independent of compass direction.
  const sign = a.dx * a.nz - a.dz * a.nx > 0 ? 1 : -1;
  const u = a.length / 2 + sign * p[0];
  return [a.a[0] + a.dx * u + a.nx * out, y + p[1], a.a[1] + a.dz * u + a.nz * out];
}

class Builder {
  readonly rows: Row[] = [];
  readonly glass: Row[] = [];
  readonly sheets: number[] = [];
  constructor(readonly native: boolean) {}
  box(p: P, size: P, color: number, role: string, glass = false, yaw = 0): void {
    const n=this.native&&yaw?Math.max(1,Math.ceil(size[0]/.18)):1;
    for(let i=0;i<n;i++) {
      const u=((i+.5)/n-.5)*size[0],q:P=[p[0]+Math.cos(yaw)*u,p[1],p[2]-Math.sin(yaw)*u];
      const m=new Matrix4().makeRotationY(this.native?0:yaw).scale(new Vector3(size[0]/n,size[1],size[2])).setPosition(...q);
      (glass ? this.glass : this.rows).push({ matrix:m,color,role });
    }
  }
  beam(a: P, b: P, width: number, color: number, role: string): void {
    const d = new Vector3(...b).sub(new Vector3(...a)), length = d.length();
    if (length < .001) return;
    if (this.native) {
      const n = Math.max(1, Math.ceil(length / .9));
      for (let i = 0; i < n; i++) this.box(a.map((v, j) => v + (b[j] - v) * (i + .5) / n) as P,
        [Math.max(width, Math.abs(d.x) / n), Math.max(width, Math.abs(d.y) / n), Math.max(width, Math.abs(d.z) / n)], color, role);
    } else this.rows.push({ matrix: new Matrix4().compose(new Vector3(...a).add(new Vector3(...b)).multiplyScalar(.5),
      new Quaternion().setFromUnitVectors(UP, d.normalize()), new Vector3(width, length, width)), color, role });
  }
  text(label: string, height: number, maxWidth: number, point: (x: number, y: number) => P, role: string): void {
    const fit = Math.min(height, height * maxWidth / letteringLayout(label, height).totalWidthM);
    for (const path of letteringStrokePaths(label, fit)) for (let i = 1; i < path.length; i++)
      this.beam(point(...path[i - 1]), point(...path[i]), fit * .10, 0xf2f0dd, role);
  }
  pane(a: P, b: P, c: P, d: P): void {
    if (!this.native) { this.sheets.push(...a, ...b, ...c, ...a, ...c, ...d); return; }
    const n = Math.ceil(new Vector3(...b).distanceTo(new Vector3(...a)) / .65);
    const m = Math.ceil(new Vector3(...d).distanceTo(new Vector3(...a)) / .65);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const point = (u: number, v: number): P => a.map((_, k) => (a[k] * (1-u) + b[k]*u)*(1-v) + (d[k]*(1-u)+c[k]*u)*v) as P;
      const p = point((i+.5)/n, (j+.5)/m), q = point(i/n, j/m), r = point((i+1)/n, (j+1)/m);
      const q2=point((i+1)/n,j/m),r2=point(i/n,(j+1)/m);
      this.box(p, p.map((_, k) => Math.max(.045, Math.abs(r[k]-q[k]), Math.abs(r2[k]-q2[k]))) as P, 0xa8c2bd, "orthogonal-transparent-pane", true);
    }
  }
  finish(name: string): Group {
    const root = new Group(); root.name = name;
    const materials = (glass: boolean) => {
      const common = { color: 0xffffff, side: DoubleSide, transparent: glass, opacity: glass ? .17 : 1, depthWrite: !glass };
      return { day: new MeshBasicMaterial(common), night: new MeshStandardMaterial({ ...common, roughness: .82 }) };
    };
    for (const [rows, glass] of [[this.rows, false], [this.glass, true]] as const) {
      if (!rows.length) continue;
      const g = new BoxGeometry(1,1,1); g.deleteAttribute("uv");
      const {day,night}=materials(glass), mesh=new InstancedMesh(g,day,0), tint=new Color();
      const matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3);
      rows.forEach((r,i)=>{r.matrix.toArray(matrices,i*16);tint.setHex(r.color).toArray(colors,i*3);});
      mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
      mesh.name=`${name}: ${glass ? "glass" : "members"}`;
      mesh.userData={dayMaterial:day,nightMaterial:night,glass,textureFree:true,blockNative:this.native,roles:rows.map(r=>r.role)};
      mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
    }
    if (this.sheets.length) {
      const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(this.sheets,3));g.computeVertexNormals();
      const {day,night}=materials(true);day.color.setHex(0xa8c2bd);night.color.setHex(0xa8c2bd);
      const mesh=new Mesh(g,day);mesh.name=`${name}: mapped glass roof and railings`;
      mesh.userData={dayMaterial:day,nightMaterial:night,glass:true,textureFree:true};g.computeBoundingBox();g.computeBoundingSphere();root.add(mesh);
    }
    root.userData={textureFree:true,blockNative:this.native,nativeMinecraft:this.native,keepInMinecraft:this.native,fullStaticDetailOnTouch:true,surfaceOnly:true,hiddenSolidInfill:false,sourceReceipt:"stationDetailsV192.json",instanceCount:this.rows.length+this.glass.length,renderableCount:root.children.length};
    return freezeStaticSceneTransforms(root);
  }
}

export function createAlexanderStationDetailsV192(native = false): Group {
  const b=new Builder(native),p=alexander.profiles.find(p=>p.key==="alexanderStation")!,f=p.frame;
  const length=f.length-.18,half=f.width/2-.12,eave=25.47,top=p.parts[0].top_y_m;
  const at=(u:number,y:number,v:number):P=>[f.x+f.dx*u-f.dz*v,y,f.z+f.dz*u+f.dx*v];
  const roofY=(v:number)=>eave+(top-eave)*Math.sqrt(Math.max(0,1-(v/half)**2));
  // Photographed longitudinal members connect the existing transverse ribs.
  for (const fraction of [-.92,-.78,-.60,-.38,0,.38,.60,.78,.92]) {
    const v=half*fraction,y=roofY(v)-.29;
    b.beam(at(-length/2,y,v),at(length/2,y,v),.12,0x5c6968,"Alexander-longitudinal-purlin");
  }
  const segments=Math.ceil(length/6.3);
  for(let i=1;i<segments;i+=2)for(const side of [-1,1]) {
    const u=-length/2+i*length/segments,v=side*half*.48,y=roofY(v)-.55;
    b.beam(at(u,y+.25,v),at(u,y-.20,v),.07,0x667476,"Alexander-lamp-hanger");
    b.beam(at(u-.40,y-.20,v),at(u+.40,y-.20,v),.13,0xe9e4c7,"Alexander-roof-luminaire");
  }
  // Existing boards remain. Both faces have separately oriented readable text.
  for(const v of [-half*.48,half*.48])for(let u=-length/2+17;u<length/2-10;u+=24)for(const side of [-1,1])
    b.text("ALEXANDERPLATZ",.25,3.45,(x,y)=>at(u+side*x,16.08+y,v+side*.072),"Alexander-platform-name");
  return b.finish("Alexanderplatz bounded hall recognition v192");
}

export function createZooEntranceDetailsV192(native=false):Group {
  const b=new Builder(native),g=source.zoo.groundY,eave=g+source.zoo.eaveHeightEstimate,top=g+source.zoo.height;
  const at=zooEntrancePointV192;
  for(const side of [-1,1]) {
    b.pane(at(0,0,top),at(1,0,top),at(1,side,eave),at(0,side,eave));
    b.beam(at(0,side,eave),at(1,side,eave),.12,0x886d6b,"Zoo-canopy-rose-eave");
  }
  b.beam(at(0,0,top),at(1,0,top),.13,0x65706b,"Zoo-canopy-ridge");
  for(const u of [0,.25,.5,.75,1])for(const side of [-1,1])
    b.beam(at(u,side,eave),at(u,0,top),.10,0x5b6660,"Zoo-canopy-gable-frame");
  for(const p of ZOO_ENTRANCE_V192_POSTS) {
    b.box([p[0],(g+eave)/2,p[2]],[.38,eave-g,.38],0xb8b5a9,"Zoo-canopy-stone-post");
    for(const y of [g+.8,g+1.6])b.box([p[0],y,p[2]],[.39,.018,.39],0x777a70,"Zoo-stone-joint");
  }
  // Visible railings follow the mapped descent; the below-ground route is not invented.
  const [a,c]=source.zoo.stairs.points,dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
  const stair=(t:number,y:number,s:number):P=>[a[0]+dx*t+nx*s,y,a[1]+dz*t+nz*s];
  for(const side of [-1,1]) {
    b.pane(stair(0,g+.10,side*1.1),stair(1,g+.10,side*1.1),stair(1,g+.96,side*1.1),stair(0,g+.96,side*1.1));
    b.beam(stair(0,g+1.02,side*1.1),stair(1,g+1.02,side*1.1),.07,0x4c5c54,"Zoo-stair-balustrade");
    for(const t of [0,.5,1])b.beam(stair(t,g,side*1.1),stair(t,g+1.06,side*1.1),.06,0x4c5c54,"Zoo-stair-balustrade-post");
  }
  // The U, U2 and U9 are distinct plaques on a canopy post, as photographed.
  const pole=at(1,1,g),right:P=[dx/length,0,dz/length],front:P=[nx,0,nz];
  for(const [label,y,w,h,color] of [["U",g+1.97,.31,.37,0x225889],["U2",g+1.63,.30,.20,0xa55245],["U9",g+1.39,.30,.20,0xb97536]] as const) {
    const center:P=[pole[0]+front[0]*.22,y,pole[2]+front[2]*.22];
    b.box(center,[w,h,.07],color,"Zoo-entrance-line-plaque",false,-Math.atan2(right[2],right[0]));
    // Orthogonal stepped backings project farther along the sign normal than
    // the drawn 7cm rotated board. Keep every glyph ahead of that whole support.
    const textOffset=native ? (Math.abs(front[0])*w/Math.ceil(w/.18)+Math.abs(front[2])*.07)/2+.02 : .045;
    b.text(label,h*.62,w*.85,(x,yy)=>[center[0]+right[0]*x+front[0]*textOffset,y-h*.31+yy,center[2]+right[2]*x+front[2]*textOffset],"Zoo-entrance-line-lettering");
  }
  return b.finish("Hardenbergplatz mapped U entrance O v192");
}
