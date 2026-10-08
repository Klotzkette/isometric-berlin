import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, ShapeUtils, Vector2, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { addBox, addCylinder, createBuilder, finishDrawnGroup, paintGeometry } from "./drawnKit";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import source from "./data/westSquaresV163Source.json";
import refinement from "./data/westSquaresV188Detail.json";

export const WEST_SQUARES_V163_PROFILE = {
  groundY: 5.2,
  station: { center: [-1974.806, 1854.717] as const, yaw: 1.218, osmWay: "26369724" },
  memorial: { position: source.memorial.position, osmNode: "7912441064", yaw: 1.218 + Math.PI,
    destinations: ["AUSCHWITZ", "STUTTHOF", "MAIDANEK", "TREBLINKA", "THERESIENSTADT", "BUCHENWALD", "DACHAU", "SACHSENHAUSEN", "RAVENSBRÜCK", "BERGEN-BELSEN", "TROSTENEZ", "FLOSSENBÜRG"],
  },
  ernstReuter: { fountainWays: ["4598245", "42023136"], smallJets: 41, mainJetHeightM: 15 },
  geometryStatus: "Complete retained official surfaces; fine windows, lettering, roof/entrance subdivisions and jet/bench locations are display interpretations. Mapped footprints remain metric anchors.",
} as const;
export const WEST_SQUARES_V188_PROFILE = Object.freeze({
  roofSource: "Geoportal Berlin DOP2025; dimensions are procedural display estimates",
  glassHall: { width: 70, depth: 26, rise: 6.2, baseY: 35.7, centerDepth: 30 },
  pavingOwners: refinement.paving.map(p => p.id),
  roadOwners: refinement.roadIds,
  retainedSourceHashes: refinement.sourceHashes,
  maxNativeBlocks: 40500,
});
export const WEST_SQUARES_V163_GROUP = "Ernst-Reuter-Platz Wittenbergplatz and KaDeWe source detail";
export const WEST_SQUARES_V163_NATIVE_GROUP = "West squares independent native blocks";

function batch(rows: readonly number[][], blocks = false): InstancedMesh {
  const g = new BoxGeometry(1, 1, 1); g.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true });
  const mesh = new InstancedMesh(g, day, 0), m = new Matrix4(), c = new Color();
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  rows.forEach((r, i) => {
    if (blocks) m.makeScale(2, 2, 2);
    else { m.makeRotationY(r[6]); m.scale(new Vector3(r[3], r[4], r[5])); }
    m.setPosition(r[0], r[1], r[2]); m.toArray(matrices, i * 16);
    // The old brown flat KaDeWe roof was a palette fallback, not measured
    // material. DOP2025 distinguishes its grey service deck from tiled edges.
    const color = r[blocks ? 3 : 7];
    c.setHex(blocks && color === 0x8F6659 ? 0xA4AAA3 : blocks && color === 0xB9AA96 ? 0xC3BDAF : color).toArray(colors, i * 3);
  });
  mesh.count = rows.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: blocks, nativeMinecraft: blocks };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}

/** Small shared authoring kit; native solids are axis-aligned blocks, never cylinders. */
class PublicRealm {
  builder = createBuilder();
  blocks: number[][] = [];
  constructor(readonly native: boolean) {}
  box(c: number, x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0): void {
    if (!this.native) { addBox(this.builder, c, x, y, z, w, h, d, yaw, false); return; }
    const size = .65;
    // Surface-only block sampling preserves open spaces and avoids hidden infill.
    const nx = Math.max(1, Math.ceil(w / size)), ny = Math.max(1, Math.ceil(h / size)), nz = Math.max(1, Math.ceil(d / size));
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
      if (ix > 0 && ix < nx - 1 && iy > 0 && iy < ny - 1 && iz > 0 && iz < nz - 1) continue;
      const u = (ix + .5) * w / nx - w / 2, v = (iz + .5) * d / nz - d / 2;
      this.blocks.push([x + Math.cos(yaw) * u + Math.sin(yaw) * v, y + (iy + .5) * h / ny - h / 2, z - Math.sin(yaw) * u + Math.cos(yaw) * v,
        Math.max(.045, w / nx), Math.max(.045, h / ny), Math.max(.045, d / nz), 0, c]);
    }
  }
  cylinder(c: number, x: number, y: number, z: number, radius: number, height: number): void {
    if (!this.native) addCylinder(this.builder, c, x, y, z, radius, height, 10, false);
    else this.box(c, x, y, z, radius * 1.5, height, radius * 1.5);
  }
  line(c: number, a: number[], b: number[], width: number): void {
    const d = new Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]), length=d.length();
    if (length < .0001) return;
    if (this.native) {
      const n=Math.ceil(length/Math.max(width,.14));
      for(let i=0;i<=n;i++) this.blocks.push([a[0]+d.x*i/n,a[1]+d.y*i/n,a[2]+d.z*i/n,width,width,width,0,c]);
    } else {
      const g=new BoxGeometry(width,length,width);
      const up=new Vector3(0,1,0), axis=new Vector3().crossVectors(up,d.clone().normalize());
      if(axis.lengthSq()>1e-10) g.applyMatrix4(new Matrix4().makeRotationAxis(axis.normalize(),Math.acos(up.dot(d.clone().normalize()))));
      else if(d.y<0) g.rotateX(Math.PI);
      g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2); paintGeometry(g,c); this.builder.parts.push(g);
    }
  }
  text(text: string, x: number, y: number, z: number, maxWidth: number, height: number, yaw: number, color=0xD9B04D): void {
    const cap = Math.min(height,height*maxWidth/letteringLayout(text,height).totalWidthM);
    const point=(p:number[])=>[x+Math.cos(yaw)*p[0],y+p[1],z-Math.sin(yaw)*p[0]];
    for(const path of letteringStrokePaths(text,cap)) for(let i=1;i<path.length;i++) this.line(color,point(path[i-1]),point(path[i]),cap*.13);
  }
  polygon(rings: number[][][], y:number, color:number):void {
    if (this.native) {
      // Native public-space surfaces use their precise mapped perimeter as short blocks;
      // original native ground remains beneath, so no high-resolution smooth double.
      for(const ring of rings) for(let i=0;i<ring.length;i++) {
        const a=ring[i],b=ring[(i+1)%ring.length], n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));
        for(let j=0;j<n;j++) this.box(color,a[0]+(b[0]-a[0])*j/n,y,a[1]+(b[1]-a[1])*j/n,.6,.12,.6);
      }
      return;
    }
    const vectors=rings.map(r=>r.map(([x,z])=>new Vector2(x,z))), vertices=rings.flat();
    const faces=ShapeUtils.triangulateShape(vectors[0],vectors.slice(1));
    const g=new BufferGeometry().setAttribute("position",new Float32BufferAttribute(faces.flatMap(f=>[f[0],f[2],f[1]].flatMap(i=>[vertices[i][0],y,vertices[i][1]])),3));
    g.setIndex(Array.from({length:g.getAttribute("position").count},(_,i)=>i)); paintGeometry(g,color); this.builder.parts.push(g);
  }
  finish(name:string):Group {
    if(!this.native) return finishDrawnGroup(this.builder,{name})!;
    const root=new Group();root.name=name;const mesh=batch(this.blocks);mesh.userData.blockNative=true;mesh.userData.nativeMinecraft=true;root.add(mesh);root.userData.nativeBlockCount=this.blocks.length;return root;
  }
}

function publicSpace(native:boolean):Group {
  const root=new Group();root.name="Mapped West-square public realm";
  const erp=new PublicRealm(native);
  for(const r of source.publicRealm) if(r.id!=="26556151") for(const p of r.polygons) {
    erp.polygon(p,5.28,r.kind==="grass"?0x789565:0xB6B3A4);
    for(const ring of p) for(let i=0;i<ring.length;i++) {
      const a=ring[i],b=ring[(i+1)%ring.length];
      erp.line(0xCDC9B9,[a[0],5.38,a[1]],[b[0],5.38,b[1]],.2);
    }
  }
  for(const [index,id] of ["4598245","42023136"].entries()) {
    const ring=source.osm[id as "4598245"].rings[0];
    erp.polygon([ring],5.43,0x5A8B90);
    ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length];erp.line(0xB9B3A1,[a[0],5.55,a[1]],[b[0],5.55,b[1]],.6);});
    const minX=Math.min(...ring.map(p=>p[0])),maxX=Math.max(...ring.map(p=>p[0])),minZ=Math.min(...ring.map(p=>p[1])),maxZ=Math.max(...ring.map(p=>p[1]));
    const count=index===0?25:16, cols=index===0?5:4;
    for(let i=0;i<count;i++) {
      const x=minX+(i%cols+1)*(maxX-minX)/(cols+1),z=minZ+(Math.floor(i/cols)+1)*(maxZ-minZ)/(cols+1);
      const h=1.25+(i%3)*.18;erp.cylinder(0xD5E6DF,x,5.45+h/2,z,.10,h);
      for(const s of [-1,1]) erp.line(0xBCD8D9,[x,6.1,z],[x+s*.45,5.6,z+.35],.07);
    }
    if(index===0) {
      const x=(minX+maxX)/2,z=(minZ+maxZ)/2;
      erp.cylinder(0xDAEBE7,x,12.95,z,.25,15);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;erp.line(0xBBD8DA,[x,18.3,z],[x+Math.sin(a)*1.1,6.0,z+Math.cos(a)*1.1],.10);}
    }
  }
  for(const b of source.benches){const [x,z]=b.position;erp.box(0x837455,x,5.83,z,2.4,.14,.56,.04);for(const u of [-.8,.8])erp.box(0x8F9186,x+u,5.55,z,.18,.48,.42);}
  root.add(erp.finish("Ernst-Reuter mapped lawns paving two basins and 41 small jets"));
  const w=new PublicRealm(native), p=WEST_SQUARES_V163_PROFILE.station;
  if (native) w.blocks.push(...refinement.nativePaving);
  else for (const area of [...refinement.paving, ...refinement.roads])
    for (const polygon of area.polygons) w.polygon(polygon, area.y, area.color);
  // Exact mapped paving holes keep lawns, station and fountain sites open.
  // The retained road buffers get one continuous asphalt skin, above the old
  // fragmented substrate; every original street and path remains in the scene.
  const point=(x:number,y:number,z:number)=>[p.center[0]+Math.cos(p.yaw)*x+Math.sin(p.yaw)*z,y,p.center[1]-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z];
  const localBox=(c:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const q=point(x,y,z);w.box(c,q[0],q[1],q[2],sx,sy,sz,p.yaw);};
  // Source shell retains its cruciform plan and roof geometry. Entrance relief is additive.
  for(const side of [-1,1]) {
    for(const x of [-5,-1.68,1.68,5]) localBox(0xE1DFD0,x,9.1,side*17.3,.65,7.7,.7);
    for(const x of [-3.34,0,3.34]) {
      localBox(0x25302F,x,7.75,side*17.34,2.55,4.8,.13);
      const q=point(x,11.25,side*17.45);w.text(x===0?"UNTERGRUND BAHN":"WITTENBERGPLATZ",q[0],q[1],q[2],2.7,.22,p.yaw+(side<0?Math.PI:0));
    }
    localBox(0xD5D1C4,0,13.1,side*17.3,11.1,.6,.8);
    const a=point(-5.55,13.42,side*17.36),b=point(0,14.65,side*17.36),c=point(5.55,13.42,side*17.36);
    w.line(0xC6C4B7,a,b,.42);w.line(0xC6C4B7,b,c,.42);
  }
  // Source-bound stone plinths, window heads and dark metal cross frames.
  // Positions reuse the source-clipped v163 windows; no new opening survey.
  const stationFootprints = source.parts.filter(part => part.name === "Wittenbergplatz pavilion");
  for (const row of source.facadeBoxes) {
    if (row[8] !== 1 || !stationFootprints.some(part => part.rings.some(ring => {
      const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
      return row[0]>=Math.min(...xs)-.3 && row[0]<=Math.max(...xs)+.3 && row[2]>=Math.min(...zs)-.3 && row[2]<=Math.max(...zs)+.3;
    }))) continue;
    const [x,y,z,width,height,,yaw] = row;
    for(const sign of [-1,1]) w.box(0xB8B6A7,x,y+sign*(height/2+.16),z,width+.30,.18,.23,yaw);
    const ax=Math.cos(yaw)*(width/2-.15),az=-Math.sin(yaw)*(width/2-.15);
    const outward=(x-p.center[0])*Math.sin(yaw)+(z-p.center[1])*Math.cos(yaw)>0?1:-1;
    const fx=x+Math.sin(yaw)*outward*.14,fz=z+Math.cos(yaw)*outward*.14;
    w.line(0x70816C,[fx-ax,y-height/2+.12,fz-az],[fx+ax,y+height/2-.12,fz+az],.065);
    w.line(0x70816C,[fx-ax,y+height/2-.12,fz-az],[fx+ax,y-height/2+.12,fz+az],.065);
  }
  for(const side of [-1,1]) {
    for(const x of [-5,-1.68,1.68,5]) {
      localBox(0xCBC8B8,x,5.62,side*17.3,.92,.56,.96);
      localBox(0xD9D7CA,x,12.6,side*17.3,.90,.35,.94);
    }
    // Thin source-facing landing bands preserve the open three-door entrance.
    for(const depth of [17.85,18.15,18.45]) localBox(0xBCBAAB,0,5.35,side*depth,10.5,.10,.25);
  }
  const memorial=WEST_SQUARES_V163_PROFILE.memorial,[mx,mz]=memorial.position,myaw=memorial.yaw;
  const mp=(u:number,y:number,depth=0)=>[mx+Math.cos(myaw)*u+Math.sin(myaw)*depth,y,mz-Math.sin(myaw)*u+Math.cos(myaw)*depth];
  for(const u of [-.81,.81]){const q=mp(u,7.25);w.cylinder(0x858C85,q[0],q[1],q[2],.055,4.1);}
  const heading=mp(0,8.78);w.box(0x373F40,heading[0],heading[1],heading[2],1.5,.55,.055,myaw);
  for(const [i,text] of ["ORTE DES SCHRECKENS,","DIE WIR NIEMALS VERGESSEN DÜRFEN"].entries()) {const q=mp(0,8.84-i*.22,.04);w.text(text,q[0],q[1],q[2],1.4,.09,myaw);}
  memorial.destinations.forEach((text,i)=>{const y=8.35-i*.215,q=mp(0,y);w.box(0x3E4644,q[0],q[1],q[2],1.5,.20,.055,myaw);const t=mp(0,y-.06,.04);w.text(text,t[0],t[1],t[2],1.36,.105,myaw);});
  root.add(w.finish("Wittenbergplatz porticoes and twelve-place Holocaust memorial sign"));
  const k=new PublicRealm(native), kx=-2084.6,kz=1826.7,kyaw=-.598;
  const kp=(u:number,y:number,d:number)=>[kx+Math.cos(kyaw)*u+Math.sin(kyaw)*d,y,kz-Math.sin(kyaw)*u+Math.cos(kyaw)*d];
  const kb=(color:number,u:number,y:number,d:number,sx:number,sy:number,sz:number)=>{const p=kp(u,y,d);k.box(color,p[0],p[1],p[2],sx,sy,sz,kyaw);};
  // The complete flat source roof remains below the DOP2025-supported roof
  // organisation. Exact footprint collar; slope and hall sections are estimates.
  const roofCells = new Map<string, number[]>();
  const roofCell = (p:number[],color:number) => {
    const x=Math.floor(p[0]/2)*2+1,z=Math.floor(p[2]/2)*2+1,y=Math.round(p[1]*2)/2;
    const key=`${x}:${z}`,previous=roofCells.get(key);
    if(!previous || y>=previous[1]) roofCells.set(key,[x,y,z,2,.5,2,0,color]);
  };
  for(const triangle of refinement.roofCollar) {
    const [a,b,c]=triangle.points;
    if(native) {
      const steps=Math.ceil(Math.max(Math.hypot(...b.map((v,i)=>v-a[i])),Math.hypot(...c.map((v,i)=>v-a[i])))/2);
      for(let i=0;i<=steps;i++)for(let j=0;j<=steps-i;j++)
        roofCell(a.map((v,axis)=>v+(b[axis]-v)*i/steps+(c[axis]-v)*j/steps),triangle.color);
    } else {
      const geometry=new BufferGeometry().setAttribute("position",new Float32BufferAttribute([...a,...b,...c],3));
      geometry.setIndex([0,1,2]);paintGeometry(geometry,triangle.color);k.builder.parts.push(geometry);
    }
  }
  for(const {row} of refinement.facadeBands) {
    const [x,y,z,width,height,depth,yaw,color]=row;
    if(native) {
      const count=Math.ceil(width/2);
      for(let i=0;i<count;i++) {
        const u=(i+.5)*width/count-width/2;
        k.blocks.push([x+Math.cos(yaw)*u,y,z-Math.sin(yaw)*u,Math.min(2,width),height,Math.max(.65,depth),0,color]);
      }
    } else k.box(color,x,y,z,width,height,depth,yaw);
  }
  const hall=WEST_SQUARES_V188_PROFILE.glassHall;
  const hp=(u:number,a:number)=>kp(u,hall.baseY+Math.sin(a)*hall.rise,hall.centerDepth+Math.cos(a)*hall.depth/2);
  for(let i=0;i<24;i++) {
    const a=i*Math.PI/24,b=(i+1)*Math.PI/24;
    if(native) for(let u=-hall.width/2;u<=hall.width/2;u+=2) roofCell(hp(u,(a+b)/2),0x7F9C9F);
    else {
      const left=hp(-hall.width/2,a),right=hp(hall.width/2,a),nextLeft=hp(-hall.width/2,b),nextRight=hp(hall.width/2,b);
      const geometry=new BufferGeometry().setAttribute("position",new Float32BufferAttribute([...left,...right,...nextLeft,...nextLeft,...right,...nextRight],3));
      geometry.setIndex([0,1,2,3,4,5]);paintGeometry(geometry,i%3===0?0x8FA7A8:0x789396);k.builder.parts.push(geometry);
    }
    if(!native) {
      for(const u of [-35,-25,-15,-5,5,15,25,35]) k.line(0xC5CEBF,hp(u,a),hp(u,b),.14);
      if(i%4===0) k.line(0xC5CEBF,hp(-35,a),hp(35,a),.14);
    }
  }
  if(native) k.blocks.push(...roofCells.values());
  // KaDeWe's flat LoD2 envelope lacks the glazed roof vault. Its geometric
  // recognition cap is an explicitly non-surveyed addition, not substituted source.
  const radius=8.2, base=32.8, depth=19;
  for(let i=0;i<32;i++) {
    const a=i*Math.PI/32,b=(i+1)*Math.PI/32;
    const p=kp(Math.cos(a)*radius,base+Math.sin(a)*radius,0),q=kp(Math.cos(b)*radius,base+Math.sin(b)*radius,0);
    if(native) {
      for(let d=0;d<=depth;d+=.65){const c=kp(Math.cos((a+b)/2)*radius,base+Math.sin((a+b)/2)*radius,d);k.box(0x789A9C,c[0],c[1],c[2],.65,.65,.65);}
    } else {
      const r=kp(Math.cos(a)*radius,base+Math.sin(a)*radius,depth),t=kp(Math.cos(b)*radius,base+Math.sin(b)*radius,depth);
      const g=new BufferGeometry().setAttribute("position",new Float32BufferAttribute([...p,...q,...r,...q,...t,...r],3));g.setIndex([0,1,2,3,4,5]);paintGeometry(g,0x789A9C);k.builder.parts.push(g);
    }
    if(i%4===0)k.line(0xB1C0B9,p,kp(Math.cos(a)*radius,base+Math.sin(a)*radius,depth),.12);
    for(const d of [0,depth/2,depth])k.line(0xB1C0B9,kp(Math.cos(a)*radius,base+Math.sin(a)*radius,d),kp(Math.cos(b)*radius,base+Math.sin(b)*radius,d),.12);
  }
  for(const u of [-5.1,-2.55,0,2.55,5.1]) {kb(0x334A48,u,8.0,-.15,2.2,5.4,.18);kb(0xC5BBA6,u-1.25,8.2,-.25,.25,5.8,.32);}
  kb(0x343D3B,0,11.5,-1.4,15,.22,3);
  for(const y of [13.0,18.0,23.0,28.0])kb(0xCEBEA5,0,y,-.25,19,.28,.46);
  for(const [text,y,cap,width] of [["KAUFHAUS DES WESTENS",29.5,.64,23],["KADEWE",12.2,.65,10]] as const){const q=kp(0,y,-.45);k.text(text,q[0],q[1],q[2],width,cap,kyaw,0xE8E6D9);}
  root.add(k.finish("KaDeWe entrance lettering and glazed barrel-roof recognition"));
  return root;
}

/** Complete geometry on pointer and touch; all visible features share the same profile. */
export function createWestSquaresV163(_options:{mobileLike?:boolean}={}):Group {
  const root=new Group();root.name=WEST_SQUARES_V163_GROUP;
  for(const building of source.buildings) {
    const ids=new Set(source.parts.filter(p=>p.parentId===building.id).map(p=>p.id));
    const parts:BufferGeometry[]=[];
    for(const s of source.surfaces) if(ids.has(s.partId)) {
      const g=new BufferGeometry().setAttribute("position",new Float32BufferAttribute(s.triangles.flat(2),3));paintGeometry(g,building.name === "KaDeWe" ? (s.kind === "RoofSurface" ? 0xA4AAA3 : 0xC3BDAF) : s.color);parts.push(g);
    }
    const g=mergeGeometries(parts,false)!;parts.forEach(p=>p.dispose());
    const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.9,flatShading:true});
    const mesh=new Mesh(g,day);mesh.name=building.name+" complete official LoD2 surfaces";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};root.add(mesh);
  }
  const details=batch(source.facadeBoxes);details.name="West-square source-clipped facade windows and mullions";root.add(details);
  root.add(publicSpace(false));root.userData.v188Refinement=WEST_SQUARES_V188_PROFILE;root.userData.sourcePartIds=source.parts.map(p=>p.id);
  freezeStaticSceneTransforms(root);return root;
}
export function createMinecraftWestSquaresV163(_options:{mobileLike?:boolean}={}):Group {
  const root=new Group();root.name=WEST_SQUARES_V163_NATIVE_GROUP;root.add(batch(source.nativeBlocks,true),publicSpace(true));
  freezeStaticSceneTransforms(root);return root;
}
