import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, SphereGeometry, Vector2, Vector3 } from "three";
import { addBox, createBuilder, finishDrawnGroup, paintGeometry, type Builder } from "./drawnKit";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import ownership from "./data/weltkugelV281Ownership.json";

export const WELTKUGEL_V281 = Object.freeze({
  sourceId: "20866116", groundY: 5.2,
  basinCenter: [-2408.6, 1531.05] as const,
  globeCenter: [-2404.8, 1531.05] as const,
  globeRadius: 4.25, basinRadius: 8,
  sourceRing: ownership.previousPrisms[0].ring.map(([x, z]) => [x / 10, z / 10]),
  sourceUrls: [
    "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/brunnen/artikel.118259.php",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040105",
    "https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/weltkugelbrunnen",
  ],
  interpretation: "Complete retained mapped rim. Granite segmentation, figurative motifs and upper cascade are photo-guided estimates; the below-plaza stair court requires a separate terrain survey and is not raised above ground.",
});
const P = WELTKUGEL_V281, G = P.groundY;
const GRANITE = [0xaf9480, 0xa28471, 0xb49a84, 0x977a67];
const BRONZE = 0x3e4841, WATER = 0x6c8580, SPRAY = 0xc6d9d1;
type Row = [number, number, number, number, number, number, number];
type Point = [number, number, number];
function inside(x: number, z: number, ring = P.sourceRing): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

/** Code-built sculpture; no photographic texture and no generic solid pedestal. */
class Fountain {
  rows: Row[] = [];
  constructor(readonly native: boolean, readonly builder: Builder) {}
  box(c: number, x: number, y: number, z: number, w: number, h: number, d: number) {
    if (this.native) this.rows.push([x, y, z, w, h, d, c]);
    else addBox(this.builder, c, x, y, z, w, h, d, 0, false);
  }
  line(c: number, a: Point, b: Point, width: number) {
    const delta = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), length = delta.length();
    if (length < 1e-6) return;
    if (this.native) {
      const n = Math.ceil(length / (width * .8));
      for (let i = 0; i <= n; i++) this.box(c, a[0] + delta.x * i / n, a[1] + delta.y * i / n, a[2] + delta.z * i / n, width, width, width);
    } else {
      const geometry = new BoxGeometry(width, length, width);
      const rotation = new Matrix4().lookAt(new Vector3(), delta, new Vector3(0, 0, 1));
      geometry.rotateX(Math.PI / 2); geometry.applyMatrix4(rotation);
      geometry.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      paintGeometry(geometry, c); this.builder.parts.push(geometry);
    }
  }
  head(x: number, y: number, z: number, radius: number, c = BRONZE) {
    if (this.native) this.box(c, x, y, z, radius * 1.65, radius * 1.8, radius * 1.65);
    else {
      const geo = new SphereGeometry(radius, 10, 6); geo.translate(x, y, z);
      paintGeometry(geo, c); this.builder.parts.push(geo);
    }
  }
  polygon(ring: number[][], y: number, c: number) {
    if (this.native) {
      const step = .25, xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
      // Every row is its exact contained-cell interval; no diagonal cuboids.
      for (let iz = Math.floor(Math.min(...zs) / step); iz < Math.ceil(Math.max(...zs) / step); iz++) {
        let start: number | null = null;
        const end = Math.ceil(Math.max(...xs) / step);
        for (let ix = Math.floor(Math.min(...xs) / step); ix <= end; ix++) {
          const occupied = ix < end && [[.001,.001],[.999,.001],[.999,.999],[.001,.999]].every(([u,v]) => inside((ix+u)*step,(iz+v)*step,ring));
          if (occupied && start === null) start = ix;
          if (!occupied && start !== null) { this.box(c,(start+ix)*step/2,y-.045,(iz+.5)*step,(ix-start)*step,.09,step); start=null; }
        }
      }
    } else {
      const points = ring.map(([x,z]) => new Vector2(x,z));
      const positions: number[] = [];
      for (const ids of ShapeUtils.triangulateShape(points, [])) {
        const [a,b,c] = ids.map(i => ring[i]);
        for (const p of [a,c,b]) positions.push(p[0],y,p[1]);
      }
      const geo = new BufferGeometry(); geo.setAttribute("position", new Float32BufferAttribute(positions,3));geo.setIndex(Array.from({length:positions.length/3},(_,i)=>i));
      paintGeometry(geo,c); this.builder.parts.push(geo);
    }
  }
  /** Relief follows the visible globe, rather than a plane inside its volume.
   * These east/west motifs sit on the unrecessed meridians. Native fittings
   * use the actual cardinal skin/support extents, never a smooth-mode voxel cut. */
  surfaceX(side: -1 | 1, y: number, z: number, rows: readonly Row[], halfY = 0, halfZ = 0) {
    const [cx,cz]=P.globeCenter;
    if (this.native) {
      let outward = -Infinity;
      for (const [x,ry,rz,w,h,d] of rows) {
        if (ry+h/2 < y-halfY || ry-h/2 > y+halfY || rz+d/2 < z-halfZ || rz-d/2 > z+halfZ) continue;
        outward=Math.max(outward,side*x+w/2);
      }
      if (Number.isFinite(outward)) return side*outward;
    }
    return cx+side*Math.sqrt(Math.max(0,P.globeRadius**2-(y-G-.55)**2-(z-cz)**2));
  }
  surfacePlate(c: number, side: -1 | 1, y: number, z: number, h: number, w: number, offset: number) {
    const ny=Math.ceil(h/.15),nz=Math.ceil(w/.15),dy=h/ny,dz=w/nz;
    const rows=this.rows.slice(),positions:number[]=[];
    for(let iy=0;iy<ny;iy++)for(let iz=0;iz<nz;iz++) {
      const y0=y-h/2+iy*dy,z0=z-w/2+iz*dz;
      if(this.native) {
        // Submillimetre overlap closes float32 instance-position rounding
        // at these kilometre-offset world coordinates, including panel seams.
        const x=this.surfaceX(side,y0+dy/2,z0+dz/2,rows,dy/2+.00001,dz/2+.0003);
        this.box(c,x+side*(offset+.015),y0+dy/2,z0+dz/2,.03,dy+.00002,dz+.0006);
      } else {
        const points=[[y0,z0],[y0+dy,z0],[y0+dy,z0+dz],[y0,z0+dz]].map(([py,pz])=>
          [this.surfaceX(side,py,pz,rows)+side*offset,py,pz]);
        for(const index of side===1?[0,1,2,0,2,3]:[0,2,1,0,3,2])positions.push(...points[index]);
      }
    }
    if(!this.native) {
      const geo=new BufferGeometry();geo.setAttribute("position",new Float32BufferAttribute(positions,3));
      geo.setIndex(Array.from({length:positions.length/3},(_,i)=>i));
      paintGeometry(geo,c);this.builder.parts.push(geo);
    }
  }
  surfaceLine(c: number, side: -1 | 1, a: Point, b: Point, width: number, skin: readonly Row[]) {
    const steps=Math.ceil(Math.hypot(b[1]-a[1],b[2]-a[2])/(width*.55));
    let previous:Point|undefined;
    for(let i=0;i<=steps;i++) {
      const y=a[1]+(b[1]-a[1])*i/steps,z=a[2]+(b[2]-a[2])*i/steps;
      const point:Point=[this.surfaceX(side,y,z,skin,this.native?width/2:0,this.native?width/2:0)+side*.06,y,z];
      if(this.native) {
        this.box(c,...point,width,width,width);
        // Close the orthogonal relief across a native skin step without
        // rotating cuboids or leaving disconnected bronze marks.
        if(previous&&Math.abs(point[0]-previous[0])>width)
          this.box(c,(point[0]+previous[0])/2,(y+previous[1])/2,(z+previous[2])/2,Math.abs(point[0]-previous[0])+width,width,width);
      } else if(previous) this.line(c,previous,point,width);
      previous=point;
    }
  }
  build() {
    const [cx,cz]=P.globeCenter, [bx,bz]=P.basinCenter;
    this.polygon(P.sourceRing,G+.11,GRANITE[1]);
    // West-facing semicircular upper basin, as described on the LDA plaque.
    const basin: number[][]=[];
    for(let i=0;i<=48;i++){const a=Math.PI*.5+i*Math.PI/48;basin.push([bx+7.6*Math.cos(a),bz+7.6*Math.sin(a)]);}
    basin.push([cx-1.8,bz-7.6],[cx-1.8,bz+7.6]);
    this.polygon(basin,G+.28,WATER);
    for(let i=0;i<48;i++) {
      const a=Math.PI*.5+i*Math.PI/48,b=Math.PI*.5+(i+1)*Math.PI/48;
      this.line(GRANITE[i%4],[bx+8*Math.cos(a),G+.45,bz+8*Math.sin(a)],[bx+8*Math.cos(b),G+.45,bz+8*Math.sin(b)],.42);
    }
    // Individually sawn granite meridians, with narrow recessed seams.
    if(this.native) {
      const s=.3,r=P.globeRadius;
      for(let ix=-15;ix<=15;ix++)for(let iz=-15;iz<=15;iz++){
        const x=ix*s,z=iz*s,d=x*x+z*z;
        if(d>=r*r)continue;
        const h=Math.sqrt(r*r-d);
        const band=((Math.floor((Math.atan2(z,-x)+Math.PI)*6/Math.PI)%12)+12)%12;
        const recess=[1,4,8].includes(band)?.22:0;
        const top=h-recess;
        const adjacent=[[x-s,z],[x+s,z],[x,z-s],[x,z+s]].map(([a,b])=>{
          const q=a*a+b*b;if(q>=r*r)return 0;
          const k=((Math.floor((Math.atan2(b,-a)+Math.PI)*6/Math.PI)%12)+12)%12;
          return Math.sqrt(r*r-q)-([1,4,8].includes(k)?.22:0);
        });
        const bottom=Math.max(0,Math.min(top,...adjacent)-.08);
        this.box(GRANITE[band%4],cx+x,G+.55+(top+bottom)/2,cz+z,s,top-bottom,s);
      }
    } else {
      for(let i=0;i<12;i++) {
        const geo=new SphereGeometry(P.globeRadius,6,12,i*Math.PI/6+.008,Math.PI/6-.016,0,Math.PI/2);
        if([1,4,8].includes(i))geo.translate(0,-.22,0);
        geo.translate(cx,G+.55,cz);paintGeometry(geo,GRANITE[i%4]);this.builder.parts.push(geo);
      }
    }
    const globeSkin=this.rows.slice();
    // Vertical panel silhouettes follow the east face's curved granite skin.
    for(const [dz,h,w] of [[-1.8,3.1,.8],[0,2.4,.65],[1.75,3.15,.75]]) {
      this.surfacePlate(GRANITE[1],1,G+.54+h/2,cz+dz,h-.08,w,.025);
      this.surfacePlate(BRONZE,1,G+.5+h*.57,cz+dz,h*.42,w*.6,.035);
    }
    // Carved diamond and cross motifs remain geometric relief, not a texture.
    for(const dz of [-1.2,1.2]){
      const x=cx-3.45,z=cz+dz,y=G+2.7;
      const points:Point[]=[[x,y+.45,z],[x-.08,y,z+.36],[x,y-.45,z],[x-.08,y,z-.36],[x,y+.45,z]];
      for(let j=1;j<points.length;j++)this.surfaceLine(BRONZE,-1,points[j-1],points[j],.085,globeSkin);
    }
    // Three shallow, visible upper spill shelves. Lower sunken court is not fabricated.
    for(let i=0;i<3;i++){
      this.box(GRANITE[i],cx+3.65+i*.8,G+.5-i*.12,cz,1,.18,2.5+i*.3);
      this.box(WATER,cx+3.65+i*.8,G+.595-i*.12,cz,.85,.015,2.2+i*.3);
    }
    // Bronze boat/Ark with an open gunwale and small paired figures.
    const boatX=bx-3.1,boatZ=bz-3.7;
    this.box(BRONZE,boatX,G+.55,boatZ,2.8,.22,.75);
    for(const z of [-.42,.42])this.box(BRONZE,boatX,G+.78,boatZ+z,3,.38,.1);
    for(const x of [-.7,0,.7]){this.box(BRONZE,boatX+x,G+1.02,boatZ,.2,.5,.22);this.head(boatX+x,G+1.36,boatZ,.16);}
    // Reclining bather with ochre helmet, and crocodile at the western rim.
    this.box(BRONZE,cx-.7,G+4.15,cz-2.3,1.1,.26,.38);
    this.head(cx-.1,G+4.42,cz-2.3,.21);this.head(cx-.1,G+4.6,cz-2.3,.22,0xcbb456);
    const crocodileX=bx-7.3,crocodileZ=bz+1.3;
    this.box(BRONZE,crocodileX,G+.76,crocodileZ,.5,.3,1.8);
    this.box(BRONZE,crocodileX,G+.79,crocodileZ-.99,.42,.22,.65);
    this.line(BRONZE,[crocodileX,G+.71,crocodileZ+.7],[crocodileX+.4,G+.55,crocodileZ+1.8],.2);
    for(const z of [-.5,.5])for(const side of [-1,1])this.box(BRONZE,crocodileX+side*.4,G+.61,crocodileZ+z,.42,.14,.2);
    // Two seated bronze motifs on the segmented granite ledge.
    for(const dz of [-2,2]) {
      const x=cx-4.35,z=cz+dz;
      this.box(GRANITE[0],x,G+.65,z,1.1,.45,.95);
      this.box(BRONZE,x,G+1.15,z,.32,.6,.28);this.head(x,G+1.62,z,.22);
      this.box(BRONZE,x-.24,G+.87,z,.7,.22,.32);
    }
    // Quiet opaque parabolic water streams; no flashing or animation allocation.
    for(let j=0;j<7;j++) {
      const z=cz-3+j, x=cx-Math.sqrt(Math.max(0,16-(z-cz)**2));
      for(let k=0;k<14;k++) {
        const point=(t:number):Point=>[x-t*2.7,G+.36+1.3*(1-t)+3.5*t*(1-t),z-.15*t];
        this.line(SPRAY,point(k/14),point((k+1)/14),.055);
      }
    }
  }
}

export function appendWeltkugelV281(builder: Builder): void {new Fountain(false,builder).build();}
export function createWeltkugelV281(native=false,_options:{mobileLike?:boolean}={}):Group {
  const builder=createBuilder(), model=new Fountain(native,builder);model.build();
  let root:Group;
  if(native){
    root=new Group();const rows=model.rows,m=new Matrix4(),c=new Color();
    const matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3);
    rows.forEach(([x,y,z,w,h,d,color],i)=>{m.makeScale(w,h,d);m.setPosition(x,y,z);m.toArray(matrices,i*16);c.setHex(color).toArray(colors,i*3);});
    const g=new BoxGeometry();g.deleteAttribute("uv");
    const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.92,flatShading:true});
    const mesh=new InstancedMesh(g,day,0);mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
    mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,nativeMinecraft:true,blockNative:true,keepInMinecraft:true};mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
    root.userData.instanceCount=rows.length;
  }else root=finishDrawnGroup(builder,{name:"Weltkugelbrunnen segmented granite and bronze"})!;
  root.name="Weltkugelbrunnen v281"+(native?" native":"");
  Object.assign(root.userData,{profile:P,textureFree:true,fullStaticDetailOnTouch:true,sourceGeometryRetained:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native});
  return freezeStaticSceneTransforms(root);
}

/** Physical upper globe only: water, spray and open court remain passable. */
export function weltkugelBodyBlockedV281(x:number,z:number,bottom:number,top:number,radius:number):boolean{
  const d=Math.hypot(x-P.globeCenter[0],z-P.globeCenter[1]);
  if(![d,bottom,top,radius].every(Number.isFinite)||top<G+.55||d>P.globeRadius+radius)return false;
  const h=Math.sqrt(Math.max(0,P.globeRadius**2-Math.max(0,d-radius)**2));
  return bottom<G+.55+h;
}
