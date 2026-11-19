/** One photo-referenced Wappenbrunnen, admitted on its real resident forecourt. */
import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial,
} from "three";

export const NIKOLAI_FOUNTAIN_V353 = Object.freeze({
  id: "berlin:zierbrunnen:ZB-MI-17", name: "Wappenbrunnen", host: "4_0",
  // Keep the register point for identity. The survey outlines the physical basin.
  inventoryX: 2398.37, inventoryZ: 298.91,
  x: 2395.20, z: 300.88, radius: 2, height: 6, basinHeight: 1.7,
  drawnSha256: "ef331382da9f41c0ef99013bda475a08214d6f926a936770e939f5259341968b",
  nativeSha256: "52085ae3efac701b41c278876569242f4b9c236171f71a2593d84cf9d41685f9",
  reference: "https://bildhauerei-in-berlin.de/bildwerk/wappenbrunnen-7845/",
});
export type NikolaiFountainSupportV353 = {
  ground: (x: number, z: number) => number | null;
  water: (x: number, z: number) => boolean;
  blocked: (x: number, y: number, z: number) => boolean;
  hasHost: (id: string, sha256: string) => boolean;
};
type Point = [number, number, number];
type Solid = [number, number, number, number, number, number];
const RADIUS = 180;
const STONE = 0xb4a68a, EDGE = 0xc3b69a, RELIEF = 0x938871;
const IRON = 0x29302b, BEAR = 0x837b65, WATER = 0x536f68;

/** All positions are local metres; Native is constructed independently from boxes. */
export function nikolaiFountainGeometryV353(native: boolean) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const solids: Solid[] = [];
  const tint = new Color();
  let boxes = 0;
  const quad = (a: Point, b: Point, c: Point, d: Point, rgb: number) => {
    const offset = positions.length / 3;
    tint.setHex(rgb);
    for (const point of [a, b, c, d]) {
      positions.push(...point);
      colors.push(tint.r, tint.g, tint.b);
    }
    for (const [i,j,k] of [[0,1,2],[0,2,3]]) {
      const p=[a,b,c,d][i],q=[a,b,c,d][j],r=[a,b,c,d][k];
      const ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=r[0]-p[0],vy=r[1]-p[1],vz=r[2]-p[2];
      if(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)>1e-10)indices.push(offset+i,offset+j,offset+k);
    }
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, rgb: number, solid = false) => {
    const a = x - w / 2, b = x + w / 2, lo = y - h / 2, hi = y + h / 2, c = z - d / 2, e = z + d / 2;
    quad([a,lo,e],[b,lo,e],[b,hi,e],[a,hi,e],rgb);
    quad([b,lo,c],[a,lo,c],[a,hi,c],[b,hi,c],rgb);
    quad([b,lo,e],[b,lo,c],[b,hi,c],[b,hi,e],rgb);
    quad([a,lo,c],[a,lo,e],[a,hi,e],[a,hi,c],rgb);
    quad([a,hi,e],[b,hi,e],[b,hi,c],[a,hi,c],rgb);
    quad([a,lo,c],[b,lo,c],[b,lo,e],[a,lo,e],rgb);
    boxes++;
    if (solid) solids.push([a,lo,c,b,hi,e]);
  };
  const beam = (a: Point, b: Point, width: number, rgb: number) => {
    const dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2];
    const length = Math.hypot(dx,dy,dz);
    if (!length) return;
    if (native) {
      if (dx === 0 && dz === 0) { box(a[0],(a[1]+b[1])/2,a[2],width,length,width,rgb); return; }
      const steps = Math.ceil(length / .09);
      for (let j = 0; j < steps; j++) {
        const t = (j+.5)/steps;
        box(a[0]+dx*t,a[1]+dy*t,a[2]+dz*t,
          Math.abs(dx)/steps+width,Math.abs(dy)/steps+width,Math.abs(dz)/steps+width,rgb);
      }
    } else {
      const lenXZ = Math.hypot(dx,dz);
      const u: Point = lenXZ ? [dz/lenXZ*width/2,0,-dx/lenXZ*width/2] : [width/2,0,0];
      const v: Point = [(dy*u[2]-dz*u[1])/length,(dz*u[0]-dx*u[2])/length,(dx*u[1]-dy*u[0])/length];
      const at = (p: Point, i: number): Point => [p[0]+u[0]*Math.cos(i*Math.PI/2)+v[0]*Math.sin(i*Math.PI/2),p[1]+u[1]*Math.cos(i*Math.PI/2)+v[1]*Math.sin(i*Math.PI/2),p[2]+u[2]*Math.cos(i*Math.PI/2)+v[2]*Math.sin(i*Math.PI/2)];
      for (let i = 0; i < 4; i++) quad(at(a,i),at(a,i+1),at(b,i+1),at(b,i),rgb);
    }
  };
  const path = (points: Point[], width: number, rgb: number) => {
    for (let i = 1; i < points.length; i++) beam(points[i-1],points[i],width,rgb);
  };
  const inOctagon = (x: number, z: number, r: number) => {
    for (let i = 0; i < 8; i++) if (x*Math.cos((i+.5)*Math.PI/4)+z*Math.sin((i+.5)*Math.PI/4) > r*Math.cos(Math.PI/8)) return false;
    return true;
  };
  const ring = (outer: number, inner: number, bottom: number, top: number, rgb: number, solid = false) => {
    if (native) {
      const cell = .16;
      const n = Math.ceil(outer/cell);
      for (let j=-n;j<n;j++) {
        let begin: number | null = null;
        for (let i=-n;i<=n;i++) {
          const hit = i<n && [[i,j],[i+1,j],[i,j+1],[i+1,j+1]].every(([a,b])=>inOctagon(a*cell,b*cell,outer)) &&
            (!inner || !inOctagon((i+.5)*cell,(j+.5)*cell,inner));
          if (hit && begin === null) begin=i;
          if (!hit && begin !== null) {
            box((begin+i)*cell/2,(bottom+top)/2,(j+.5)*cell,(i-begin)*cell,top-bottom,cell,rgb,solid);
            begin=null;
          }
        }
      }
    } else {
      const point = (r: number, y: number, i: number): Point => [Math.cos(i*Math.PI/4)*r,y,Math.sin(i*Math.PI/4)*r];
      for (let i=0;i<8;i++) {
        quad(point(outer,bottom,i),point(outer,top,i),point(outer,top,i+1),point(outer,bottom,i+1),rgb);
        quad(point(outer,top,i),point(inner,top,i),point(inner,top,i+1),point(outer,top,i+1),rgb);
        if (inner) quad(point(inner,bottom,i+1),point(inner,top,i+1),point(inner,top,i),point(inner,bottom,i),rgb);
      }
      if (solid) {
        // Actual Drawn octagonal footprint is checked analytically in solidAt.
        solids.push([-outer,bottom,-outer,outer,top,outer]);
      }
    }
  };
  const ellipsoid = (x: number,y: number,z: number,rx: number,ry: number,rz: number,rgb: number) => {
    if (native) {
      const step=.1;
      for(let j=Math.floor(-ry/step);j<=Math.ceil(ry/step);j++) for(let k=Math.floor(-rz/step);k<=Math.ceil(rz/step);k++) {
        const yy=(j+.5)*step,zz=(k+.5)*step;
        const part=1-(yy/ry)**2-(zz/rz)**2;
        if(part<=0)continue;
        const xx=Math.sqrt(part)*rx;
        box(x,y+yy,z+zz,Math.max(step,Math.floor(2*xx/step)*step),step,step,rgb);
      }
    } else {
      const point=(a:number,b:number):Point=>[x+rx*Math.cos(a)*Math.sin(b),y+ry*Math.cos(b),z+rz*Math.sin(a)*Math.sin(b)];
      for(let j=0;j<6;j++)for(let i=0;i<10;i++)quad(point(i*Math.PI/5,j*Math.PI/6),point((i+1)*Math.PI/5,j*Math.PI/6),point((i+1)*Math.PI/5,(j+1)*Math.PI/6),point(i*Math.PI/5,(j+1)*Math.PI/6),rgb);
    }
  };

  // Documented three octagonal steps and 4 m overall diameter, not a new plaza.
  ring(2,0,0,.15,STONE,true); ring(1.88,0,.15,.30,EDGE,true); ring(1.76,0,.30,.45,STONE,true);
  ring(1.62,1.34,.45,1.43,STONE,true); ring(1.67,1.30,1.43,1.51,EDGE,true);
  ring(1.30,0,.48,.50,WATER);
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4,c=Math.cos(a),s=Math.sin(a);
    box(c*1.60,1.01,s*1.60,.23,1.12,.23,EDGE);
    ellipsoid(c*1.60,1.59,s*1.60,.21,.11,.21,RELIEF);
    // Eight relief medallions: motifs are deliberately simplified, not fake text.
    const front=(i+.5)*Math.PI/4, nx=Math.cos(front),nz=Math.sin(front),tx=-nz,tz=nx;
    const cx=nx*1.511,cz=nz*1.511;
    const medallion:Point[]=[];
    for(let j=0;j<=16;j++)medallion.push([cx+tx*Math.cos(j*Math.PI/8)*.265,1.0+Math.sin(j*Math.PI/8)*.265,cz+tz*Math.cos(j*Math.PI/8)*.265]);
    path(medallion,.035,RELIEF);
    path([[-.17,.16],[-.17,-.02],[0,-.19],[.17,-.02],[.17,.16],[-.17,.16]].map(([u,v])=>[cx+tx*u,1+v,cz+tz*u] as Point),.032,RELIEF);
  }
  ring(.39,0,.50,.73,RELIEF,true); ring(.29,0,.73,2.70,STONE,true); ring(.40,0,2.70,2.86,EDGE,true);
  // Seated bear: body, haunches, head, short snout, ears and paws holding a shield.
  ellipsoid(0,3.18,0,.31,.45,.31,BEAR);
  ellipsoid(.02,2.99,-.25,.27,.20,.18,BEAR); ellipsoid(.02,2.99,.25,.27,.20,.18,BEAR);
  ellipsoid(-.10,3.65,0,.25,.24,.24,BEAR); ellipsoid(-.32,3.62,0,.15,.10,.14,BEAR);
  ellipsoid(-.05,3.84,-.18,.10,.11,.08,BEAR); ellipsoid(-.05,3.84,.18,.10,.11,.08,BEAR);
  box(-.36,3.19,0,.11,.49,.38,EDGE);
  ellipsoid(-.36,3.35,-.22,.12,.13,.11,BEAR); ellipsoid(-.36,3.35,.22,.12,.13,.11,BEAR);
  // Open ironwork: no filled dome or roof. Thin ribs meet below the lily finial.
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4,c=Math.cos(a),s=Math.sin(a),t:Point=[-s,0,c];
    beam([c*1.52,1.67,s*1.52],[c*1.52,4.18,s*1.52],.047,IRON);
    const rib:Point[]=[];
    for(let j=0;j<=12;j++) { const p=j/12*Math.PI/2; rib.push([c*1.52*Math.cos(p),4.18+1.13*Math.sin(p),s*1.52*Math.cos(p)]); }
    path(rib,.055,IRON);
    for(const side of [-1,1]) {
      const scroll:Point[]=[];
      for(let j=0;j<=18;j++) { const p=j/18*Math.PI*2.15,r=.28*(1-j/22); scroll.push([c*1.38+t[0]*side*(.27+r*Math.cos(p)),4.38+r*Math.sin(p),s*1.38+t[2]*side*(.27+r*Math.cos(p))]); }
      path(scroll,.032,IRON);
    }
  }
  beam([0,5.30,0],[0,5.97,0],.055,IRON);
  for(const side of [-1,1])path([[0,5.44,0],[side*.18,5.62,0],[side*.16,5.84,0],[side*.05,5.98,0]],.04,IRON);
  path([[0,5.44,-.08],[0,5.68,-.18],[0,5.90,0]],.04,IRON);

  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(positions,3));
  geometry.setAttribute("color",new Float32BufferAttribute(colors,3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData={textureFree:true,nativeMinecraft:native,boxes,sourceId:NIKOLAI_FOUNTAIN_V353.id};
  return {geometry,solids};
}

export function createNikolaiFountainV353() {
  const root=new Group(); root.name="Wappenbrunnen — Nikolaikirchplatz";
  root.userData={textureFree:true,sourceId:NIKOLAI_FOUNTAIN_V353.id};
  let active:{mesh:Mesh;native:boolean;y:number;solids:Solid[]}|null=null;
  let sampling=false;
  const release=():boolean=>{
    if(!active)return false;
    active.mesh.removeFromParent(); active.mesh.geometry.dispose();
    (active.mesh.material as MeshStandardMaterial).dispose(); active=null; return true;
  };
  const supportHeight=(native:boolean,support:NikolaiFountainSupportV353):number|null=>{
    const site=NIKOLAI_FOUNTAIN_V353;
    if(!support.hasHost(site.host,native?site.nativeSha256:site.drawnSha256))return null;
    const y=support.ground(site.x,site.z);
    if(y===null||!Number.isFinite(y))return null;
    let low=y,high=y;
    // The whole 4 m base, including corner/interior samples, must be supported.
    // This pinned forecourt crosses an existing 9 cm path finish. Seat the
    // 15 cm first step on the lowest supported floor, with no floating gap.
    for(let j=-4;j<=4;j++)for(let i=-4;i<=4;i++) {
      const sx=site.x+i*.5,sz=site.z+j*.5;
      const floor=support.ground(sx,sz);
      if(floor===null||!Number.isFinite(floor)||support.water(sx,sz)||support.blocked(sx,floor,sz))return null;
      low=Math.min(low,floor);high=Math.max(high,floor);
      if(high-low>.090001)return null;
    }
    return low;
  };
  return {
    root,
    refresh(x:number,z:number,native:boolean,support:NikolaiFountainSupportV353):boolean {
      let y:number|null=null;
      sampling=true;
      try { if((x-NIKOLAI_FOUNTAIN_V353.x)**2+(z-NIKOLAI_FOUNTAIN_V353.z)**2<=RADIUS**2)y=supportHeight(native,support); }
      finally { sampling=false; }
      let changed=false;
      if(active&&(y===null||active.native!==native||Math.abs(active.y-y)>.001))changed=release();
      if(y===null||active)return changed;
      const {geometry,solids}=nikolaiFountainGeometryV353(native);
      const mesh=new Mesh(geometry,new MeshStandardMaterial({vertexColors:true,roughness:.88,side:DoubleSide}));
      mesh.name="Wappenbrunnen: sandstone basin, bear and open iron canopy";
      mesh.position.set(NIKOLAI_FOUNTAIN_V353.x,y,NIKOLAI_FOUNTAIN_V353.z);
      mesh.userData={textureFree:true,nativeMinecraft:native,blockNative:native,sourceId:NIKOLAI_FOUNTAIN_V353.id};
      mesh.updateMatrix();mesh.matrixAutoUpdate=false;root.add(mesh);active={mesh,native,y,solids};return true;
    },
    solidAt(x:number,y:number,z:number,radius:number,native:boolean):boolean {
      if(sampling||!active||active.native!==native||!root.parent||!root.visible||!root.parent.visible)return false;
      const dx=x-NIKOLAI_FOUNTAIN_V353.x,dz=z-NIKOLAI_FOUNTAIN_V353.z,dy=y-active.y;
      if(native)return active.solids.some(([ax,ay,az,bx,by,bz])=>dy>=ay&&dy<=by&&dx>=ax-radius&&dx<=bx+radius&&dz>=az-radius&&dz<=bz+radius);
      for(const [ax,ay,,bx,by]of active.solids) {
        if(dy<ay||dy>by)continue;
        const r=(bx-ax)/2+radius;
        if(Array.from({length:8},(_,i)=>dx*Math.cos((i+.5)*Math.PI/4)+dz*Math.sin((i+.5)*Math.PI/4)).every(v=>v<=r*Math.cos(Math.PI/8)))return true;
      }
      return false;
    },
    release,
    dispose():void {release();root.removeFromParent();},
  };
}
