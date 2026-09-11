import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Path, Shape, ShapeGeometry, Vector2, Vector3 } from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { TOPOGRAPHY_TERROR_SOURCE as S, TOPOGRAPHY_TERROR_MUSEUM as M, TOPOGRAPHY_TERROR_GROUP, MINECRAFT_TOPOGRAPHY_TERROR_GROUP, TOPOGRAPHY_TERROR_PROFILE, TOPOGRAPHY_TERROR_TOP as TOP, topographySolidContains, topographySiteSurfaceAt, topographySourceGroundAt, type TopographyPoint as Point, type TopographySolid } from "./topographyTerrorProfile";

type Triple = [number, number, number];
export type TopographyBlock = { position: Triple; size: Triple; yaw: number; color: number; role: string; normal?: Point; glass?: boolean; solid?: boolean };
export type TopographyOptions = { mobileLike?: boolean; minecraft?: boolean; diagnostics?: boolean };
export type TopographyWall = { a: Point; b: Point; dx: number; dz: number; nx: number; nz: number; length: number; court: boolean; index: number };
const C = { steel: 0xb8c4c5, bright: 0xe0e4de, shadow: 0x7c8c8f, glass: 0x4b666b, glassLight: 0x7d9493, gravel: 0xa8a595, dark: 0x3d4544, concrete: 0xb2b0a4, wall: 0xa9a697, wallDark: 0x898d82, brick: 0x83796b, rust: 0x795441, pv: 0x3d5264, white: 0xd9ded5 };
const sourceOuter = M.ring.map(p => [p[0] / 10, p[1] / 10] as unknown as Point), sourceCourt = M.holes[0].map(p => [p[0] / 10, p[1] / 10] as unknown as Point);
function walls(ring: readonly Point[], court = false): TopographyWall[] {
  const area = ring.reduce((s, a, i) => { const b = ring[(i + 1) % ring.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0), sign = (area >= 0 ? 1 : -1) * (court ? -1 : 1);
  return ring.map((a, index) => { const b = ring[(index + 1) % ring.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length; return { a, b, index, dx, dz, nx: sign * dz, nz: -sign * dx, length, court }; }).filter(w => w.length > .01);
}
export function topographyMuseumWalls(): TopographyWall[] { return [...walls(sourceOuter), ...walls(sourceCourt, true)]; }
function at(w: TopographyWall, u: number, y: number, out = 0): Triple { return [w.a[0] + w.dx * u + w.nx * out, y, w.a[1] + w.dz * u + w.nz * out]; }
function pathRecord(id: string): number[][] { return S.paths.find(p => p.tags.id === id)!.line; }
const entryWall = walls(sourceOuter)[2];
function local(u: number, v: number, y: number): Triple { return at(entryWall, u, y, -v); }
function lineFrame(a: Point, b: Point): TopographyWall { const length = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length; return { a, b, length, dx, dz, nx: dz, nz: -dx, court: false, index: 0 }; }

export function planTopographyTerror(options: TopographyOptions = {}): TopographyBlock[] {
  const blocks: TopographyBlock[] = [], mc = !!options.minecraft, mobile = mc && !!options.mobileLike;
  const box = (position: Triple, size: Triple, color: number, role: string, yaw = 0, glass = false, solid = false, normal?: Point) => { if (size.every(n => n > 0)) blocks.push({ position, size, color, role, yaw, glass, solid, normal }); };
  const emit = (w: TopographyWall, u: number, y: number, width: number, height: number, depth: number, out: number, color: number, role: string, glass = false, solid = false) => box(at(w, u, y, out), [width, height, depth], color, role, -Math.atan2(w.dz, w.dx), glass, solid, [w.nx, w.nz]);
  for (const w of topographyMuseumWalls()) {
    const bays = w.court ? 12 : (mc ? 24 : 36), pitch = w.length / bays, low = 3.4, screenBottom = w.court ? 5.75 : 6.25;
    for (let i = 0; i < bays; i++) {
      const u = (i + .5) * pitch, entrance = !w.court && w.index === 2 && u > 9.2 && u < 36.8, door = !w.court && w.index === 0 && Math.abs(u - w.length * .58) < 1.4;
      emit(w, u, (low + 6.3) / 2, pitch, 6.3 - low, .15, -.16, i % 3 ? C.glass : C.glassLight, "recessed basement glazing", true);
      emit(w, u - pitch / 2 + .06, (low + TOP) / 2, mc ? .16 : .09, TOP - low, .2, .04, C.steel, "continuous facade upright");
      emit(w, u, (screenBottom + TOP) / 2, pitch, TOP - screenBottom, .12, -.1, i % 4 ? C.glassLight : C.glass, "screen backing glazing", true);
      const open = entrance || door || w.court, meshLow = entrance ? 10.75 : (door ? 9.5 : screenBottom);
      if (open) emit(w, u, (6.3 + meshLow) / 2, pitch - .1, meshLow - 6.3, .12, .025, C.glass, entrance ? "north entrance glazing" : "courtyard glazing", true);
      const screenHeight = TOP - meshLow - .2, strips = mc ? 8 : (mobile ? 16 : 28);
      for (let j = 0; j < strips; j++) emit(w, u, meshLow + .1 + (j + .5) * screenHeight / strips, pitch - .10, mc ? .22 : (mobile ? .055 : .04), mc ? .22 : .085, .15, j % 3 ? C.steel : C.bright, "stainless screen horizontal weave");
      if (!mc && !mobile) for (const du of [-.28, .28]) emit(w, u + du * pitch, (meshLow + TOP) / 2, .023, TOP - meshLow - .1, .045, .13, C.shadow, "screen fine vertical wire");
      if (entrance) for (const y of [6.4, 10.72]) emit(w, u, y, pitch, .13, .21, .12, C.steel, "entry horizontal frame");
      emit(w, u - pitch / 2 + .045, (meshLow + TOP) / 2, mc ? .16 : .07, TOP - meshLow, .20, .15, C.bright, "mesh panel upright");
    }
    emit(w, w.length / 2, TOP - .08, w.length, .16, .32, 0, C.bright, "source-height roof coping");
    emit(w, w.length / 2, screenBottom + .06, w.length, .12, .28, 0, C.shadow, "floating screen lower rim");
  }
  // Geometry follows DOP 2025 array-group layout; micro divisions are local.
  const arrays: readonly (readonly [number, number, number, number])[] = [[4.5,4,11,5],[19,4,13,5],[36,4,13,5],[4.5,11,11,7],[19,11,13,4],[36,11,13,7],[4.5,20,11,7],[38,20,11,7],[4.5,29,11,7],[38,29,11,7],[4.5,39,10,5],[20,40,14,3],[36,39,13,5],[5,47,9,3],[39,47,10,4]];
  for (const [u,v,width,depth] of arrays) {
    box(local(u+width/2,v+depth/2,TOP+.015),[width,.025,depth],C.pv,"2025 rooftop photovoltaic group",-Math.atan2(entryWall.dz,entryWall.dx));
    const rows=mobile||mc?1:Math.max(2,Math.floor(depth/1.7)),cols=mobile||mc?2:Math.max(3,Math.floor(width/1.2));
    for(let i=1;i<cols;i++)box(local(u+i*width/cols,v+depth/2,TOP+.031),[.018,.012,depth],C.shadow,"PV panel seam",-Math.atan2(entryWall.dz,entryWall.dx));
    for(let i=1;i<rows;i++)box(local(u+width/2,v+i*depth/rows,TOP+.031),[width,.012,.018],C.shadow,"PV panel seam",-Math.atan2(entryWall.dz,entryWall.dx));
  }
  box(local(26.5,47.8,TOP+.016),[16.8,.027,3.8],C.white,"southern roof service strip",-Math.atan2(entryWall.dz,entryWall.dx));
  const steps=pathRecord("409575371"),entry=lineFrame(steps[0] as unknown as Point,steps[1] as unknown as Point),count=7;
  for(let i=0;i<count;i++)emit(entry,(i+.5)*entry.length/count,5.6+(i+1)*.055,entry.length/count,(i+1)*.11,5.2,0,C.steel,"mapped main entry stair",false,true);
  const ramp=pathRecord("409575376"), rampLengths=ramp.slice(1).map((p,i)=>Math.hypot(p[0]-ramp[i][0],p[1]-ramp[i][1])), rampTotal=rampLengths.reduce((a,b)=>a+b,0);let rampDistance=0;
  for(let i=1;i<ramp.length;i++){
    const f=lineFrame(ramp[i-1] as unknown as Point,ramp[i] as unknown as Point),n=Math.ceil(f.length/.9);
    for(let j=0;j<n;j++){
      const u=(j+.5)*f.length/n,y=6.37-(rampDistance+u)/rampTotal*.77;
      emit(f,u,y-.06,f.length/n+.012,.12,1.8,0,C.shadow,"mapped switchback ramp landing",false,true);
      for(const side of [-1,1])emit(f,u,y+1.02,f.length/n+.015,.07,.07,side*.85,C.steel,"ramp handrail",false,true);
    }
    for(const side of [-1,1]){const m=Math.max(1,Math.round(f.length/2.5));for(let j=0;j<=m;j++){const u=j*f.length/m,y=6.37-(rampDistance+u)/rampTotal*.77;emit(f,u,y+.52,.065,1.05,.065,side*.85,C.steel,"ramp guard post",false,true);}}
    rampDistance+=f.length;
  }
  for(let s=1;s<S.officialWall.line.length;s++){
    const w=lineFrame(S.officialWall.line[s-1] as unknown as Point,S.officialWall.line[s] as unknown as Point),n=Math.max(1,Math.round(w.length/1.2)),pitch=w.length/n;
    for(let i=0;i<n;i++){
      const u=(i+.5)*pitch,chipped=(i+s*3)%11===3,hole=(i+s*7)%29===10,point=at(w,u,0),base=topographySourceGroundAt(point[0],point[2]),top=base+3.5-(chipped?.24:0);
      if(hole){
        emit(w,u,base+.38,pitch-.025,.76,.24,0,C.wallDark,"Wall lower damaged panel",false,true);
        emit(w,u,top-.7,pitch-.025,1.4,.24,0,C.wall,"Wall upper damaged panel",false,true);
        for(const du of [-pitch*.39,pitch*.39])emit(w,u+du,(base+top)/2,pitch*.2,top-base,.24,0,C.wall,"Wall hole side",false,true);
        if(!mobile)for(const du of [-.2,.2])emit(w,u+du,base+1.55,mc?.075:.027,1.6,.04,0,C.rust,"exposed wall reinforcement");
      }else emit(w,u,(base+top)/2,pitch-.025,top-base,.24,0,i%7?C.wall:C.wallDark,"preserved concrete Wall panel",false,true);
      for(const[oy,d]of(mc?[[0,.45],[.16,.28]]:[[-.08,.35],[0,.47],[.13,.36],[.20,.18]]))emit(w,u,top+oy,pitch-.03,mc?.17:.10,d,0,C.wallDark,"surviving rounded Wall crown");
      if(!mc&&!mobile&&i%2===0)for(const side of [-1,1])emit(w,u-.17,base+.68+i%3*.28,pitch*.52,.11,.032,side*.137,i%4?C.wallDark:C.concrete,"bounded weathered concrete chip");
    }
    const guards=Math.ceil(w.length/2);
    for(let i=0;i<=guards;i++){const u=i*w.length/guards,p=at(w,u,0,-1),base=topographySourceGroundAt(p[0],p[2]);emit(w,u,base+.65,.07,1.3,.07,-1,C.steel,"Wall protection post",false,true);}
    for(let i=0;i<guards;i++){const u=(i+.5)*w.length/guards,p=at(w,u,0,-1),base=topographySourceGroundAt(p[0],p[2]);for(const dy of [.2,.6,1.25])emit(w,u,base+dy,w.length/guards+.01,.045,.045,-1,C.steel,"Wall protection rail",false,true);}
  }
  const tr=S.trench.ring,north=lineFrame(tr[1] as unknown as Point,tr[2] as unknown as Point),south=lineFrame(tr[0] as unknown as Point,tr[3] as unknown as Point),length=north.length,n=72,pitch=length/n;
  for(let i=0;i<n;i++){
    const u=(i+.5)*pitch,p=at(north,u,0,-3.45),ground=topographySourceGroundAt(p[0],p[2]);
    emit(north,u,ground+.06,pitch,.10,6.8,-3.45,C.dark,"mapped archaeological trench floor");
    emit(north,u,ground+.40,pitch-.035,.58,.72,-.62,i%3?C.brick:C.concrete,"archaeological retained wall relief",false,true);
    emit(north,u,ground+2.23,pitch-.09,.065,7,-3.55,i%3?C.glassLight:C.glass,"trench protective glass canopy",true);
    emit(north,u-pitch/2,ground+2.26,.09,.1,7.1,-3.55,C.steel,"trench roof transverse frame");
    if(i%3===0){emit(north,u,ground+1.23,.10,2,.10,-.5,C.steel,"trench canopy support",false,true);emit(south,u,ground+1.31,pitch*.7,1.3,.055,-.35,C.white,"plain exhibition panel field");}
  }
  for(let i=0;i<n;i++){const u=(i+.5)*pitch,p=at(north,u,0,-3.45),y=topographySourceGroundAt(p[0],p[2])+2.27;for(const d of [-.05,-3.55,-7.05])emit(north,u,y,pitch+.01,.12,.11,d,C.steel,"trench roof continuous rail");}
  const cellar=S.cellar.ring.slice(0,-1) as unknown as Point[],cf=walls(cellar),floorY=5.68;
  for(const w of cf){emit(w,w.length/2,floorY-.8,w.length,2.2,.45,-.23,C.brick,"mapped cellar perimeter relief",false,true);emit(w,w.length/2,floorY+.98,w.length,.06,.06,.35,C.steel,"cellar guard rail",false,true);}
  const long=cf[1],nCell=7;
  for(let i=0;i<=nCell;i++){
    const u=i*long.length/nCell;
    emit(long,u,floorY+.45,.28,.18,10.5,-5.2,i%2?C.steel:C.rust,"exposed cellar steel cross brace");
    if(i>0&&i<nCell)emit(long,u,floorY-.9,.36,.9,10,-5.2,C.brick,"cellar low division trace",false,true);
    emit(long,u,floorY+.98,.065,.96,.065,.35,C.steel,"cellar guard post",false,true);
  }
  return blocks;
}
function surface(ring: readonly Point[], holes: readonly (readonly Point[])[], y: number, color: number, name: string): Mesh {
  const shape=new Shape(ring.map(p=>new Vector2(p[0],-p[1])));for(const h of holes)shape.holes.push(new Path(h.map(p=>new Vector2(p[0],-p[1]))));
  const geo=new ShapeGeometry(shape);geo.rotateX(-Math.PI/2);geo.translate(0,y,0);geo.deleteAttribute("uv");
  const day=new MeshStandardMaterial({color,roughness:.96}),night=new MeshStandardMaterial({color,roughness:.96}),mesh=new Mesh(geo,day);mesh.name=name;mesh.userData.dayMaterial=day;mesh.userData.nightMaterial=night;return mesh;
}
export function createTopographyTerrorArchitecture(options: TopographyOptions = {}): Group {
  const blocks=planTopographyTerror(options),root=new Group(),mc=!!options.minecraft;root.name=mc?MINECRAFT_TOPOGRAPHY_TERROR_GROUP:TOPOGRAPHY_TERROR_GROUP;root.userData.geometryStatus=TOPOGRAPHY_TERROR_PROFILE.status;root.userData.profile=TOPOGRAPHY_TERROR_PROFILE;root.userData.keepInMinecraft=mc;
  for(const p of S.siteSurfaces)root.add(surface(p.ring as unknown as Point[],p.holes as unknown as Point[][],p.top,0x83857a,"Source-height open site surface "+p.id));
  // Asphalt paths over the source platform retain their OSM axes. Ground
  // below is untouched; only covered path intervals get a surface veneer.
  for(const p of S.paths)if(p.tags.highway==="footway"&&p.tags.id!=="409575376")for(let i=1;i<p.line.length;i++){
    const w=lineFrame(p.line[i-1] as unknown as Point,p.line[i] as unknown as Point),n=Math.ceil(w.length/1.4);
    for(let j=0;j<n;j++){const t=(j+.5)*w.length/n,xyz=at(w,t,0),y=topographySiteSurfaceAt(xyz[0],xyz[2]);if(y===null)continue;blocks.push({position:[xyz[0],y+.013,xyz[2]],size:[w.length/n+.008,.025,p.tags.id==="449361871"?3.8:1.8],yaw:-Math.atan2(w.dz,w.dx),color:0x626a68,role:"mapped public site path"});}
  }
  const cube=new BoxGeometry();cube.deleteAttribute("uv");
  for(const glass of [false,true]){
    const subset=blocks.filter(b=>!!b.glass===glass),day=new MeshStandardMaterial({color:0xffffff,roughness:glass?.45:.87,metalness:glass?.10:.08}),night=new MeshStandardMaterial({color:0xffffff,roughness:glass?.45:.87,metalness:glass?.10:.08,emissive:glass?0x253b3e:0,emissiveIntensity:.22}),mesh=new InstancedMesh(cube,day,subset.length),matrix=new Matrix4();
    subset.forEach((b,i)=>{matrix.makeRotationY(b.yaw).scale(new Vector3(...b.size)).setPosition(...b.position);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new Color(b.color));});mesh.name=glass?"Topography glazing and protective canopy":"Topography steel concrete masonry details";mesh.userData.dayMaterial=day;mesh.userData.nightMaterial=night;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
  }
  root.add(surface(sourceOuter,[sourceCourt],TOP,C.gravel,"Source-exact museum roof with open courtyard"));
  root.add(surface(sourceCourt,[],3.43,C.dark,"Courtyard water mirror"));
  root.add(surface(S.cellar.ring as unknown as Point[],[],3.25,C.dark,"Mapped west cellar ground relief"));
  root.add(surface(S.memorialPatch.ring as unknown as Point[],[],5.69,C.gravel,"Mapped memorial ground patch"));
  root.userData.detailCounts=Object.fromEntries([...new Set(blocks.map(b=>b.role))].map(role=>[role,blocks.filter(b=>b.role===role).length]));root.userData.instanceCount=blocks.length;root.userData.solids=blocks.filter(b=>b.solid).map(b=>({x:b.position[0],y:b.position[1],z:b.position[2],width:b.size[0],height:b.size[1],depth:b.size[2],yaw:b.yaw,role:b.role}));if(options.diagnostics)root.userData.blocks=blocks;freezeStaticSceneTransforms(root);return root;
}
export function createMinecraftTopographyTerrorArchitecture(options: TopographyOptions = {}): Group { return createTopographyTerrorArchitecture({...options,minecraft:true}); }
let solids:TopographySolid[]|null=null;
export function topographyAuthoredSolids():readonly TopographySolid[]{return solids??=planTopographyTerror().filter(b=>b.solid).map(b=>({x:b.position[0],y:b.position[1],z:b.position[2],width:b.size[0],height:b.size[1],depth:b.size[2],yaw:b.yaw,role:b.role}));}
export function topographyAuthoredSolidAt(x:number,z:number,footY:number,height=1.8,radius=.25):boolean{if(x<700||x>960||z<1295||z>1465)return false;return topographyAuthoredSolids().some(s=>topographySolidContains(s,x,footY,z,height,radius));}
export function topographyAuthoredTopAt(x:number,z:number):number|null{if(x<700||x>960||z<1295||z>1465)return null;let top:number|null=null;for(const s of topographyAuthoredSolids())if(topographySolidContains(s,x,s.y-s.height/2,z,s.height,0))top=Math.max(top??-Infinity,s.y+s.height/2);return top;}
export function setTopographyMinecraftPresentation(root:Group|null,minecraft:boolean):void{root?.traverse(o=>{if(o.name===TOPOGRAPHY_TERROR_GROUP)o.visible=!minecraft;else if(o.name===MINECRAFT_TOPOGRAPHY_TERROR_GROUP)o.visible=minecraft;});}
