import {
  BoxGeometry, Color, Group, InstancedMesh,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Shape,
  ShapeGeometry, Vector3,
} from "three";
import type { PrismBuilding, PrismPayload } from "./IsometricCityWorld";
import { createBuilder, finishDrawnGroup, paintGeometry, type Builder } from "./drawnKit";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import sourcePrisms from "./deutschesTheaterPrisms.json";

export const DEUTSCHES_THEATER_GROUP = "Deutsches Theater details";
export const MINECRAFT_DEUTSCHES_THEATER_GROUP = "Minecraft Deutsches Theater details";
export const DEUTSCHES_THEATER_SOURCE_PRISMS = sourcePrisms;
export const DEUTSCHES_THEATER_MAIN_IDS: ReadonlySet<string> = new Set(sourcePrisms.filter(p => p.parent === "DEBE01YYK00002VR").map(p => p.id));
export const DEUTSCHES_THEATER_KAMMERSPIELE_IDS: ReadonlySet<string> = new Set(sourcePrisms.filter(p => p.parent === "DEBE01YYK000037b").map(p => p.id));
export const DEUTSCHES_THEATER_IDS: ReadonlySet<string> = new Set(sourcePrisms.map(p => p.id));
/** The overlay supplies exposed facade fields; none of these source bodies is removed. */
export const DEUTSCHES_THEATER_CUSTOM_FACADE_IDS = DEUTSCHES_THEATER_IDS;
export const DEUTSCHES_THEATER_TONES = {
  corten: 0x9b563f, facadeIvory: 0xeeece5, facadeShade: 0xdeddd7,
  frame: 0xf6f3eb, gardenDark: 0x355c3d, gardenLight: 0x527c4f,
  glass: 0x46606a, gold: 0xc7a64d, kammerspiele: 0xcbd8ca,
  kammerspieleShade: 0xb8c9b9, nightGlass: 0xffc86f, slate: 0x566267,
  steel: 0x343d3e, stone: 0xd4d0c6, roofTile: 0x93604d,
} as const;
export const DEUTSCHES_THEATER_ROOF_TONES: Readonly<Record<string, number>> = Object.fromEntries(
  sourcePrisms.map(p => [p.id, ["wZRgel5C", "V4fdozio", "tiVg9hjE", "yfxeFHHc"].includes(p.id)
    ? DEUTSCHES_THEATER_TONES.roofTile : DEUTSCHES_THEATER_TONES.slate]),
);
export const DEUTSCHES_THEATER_PROFILE = {
  address: "Schumannstrasse 13a, 10117 Berlin", built: 1850,
  geometryStatus: "exact Berlin LoD2 footprints and measured heights retained; facade articulation, garden furniture and rooftop sign are deterministic photo-bounded display reconstructions, not facade survey data",
  lod2Parent: "DEBE01YYK00002VR", kammerspieleParent: "DEBE01YYK000037b",
  name: "Deutsches Theater und Kammerspiele", osmNodeId: "345806623",
  mainFrontId: "KeeAYa8r", mainFrontEdge: 2,
  mainAnnexId: "TVjCvFcI", mainAnnexEdge: 1,
  kammerspieleFrontId: "yMkbzxqy", kammerspieleFrontEdge: 4,
  kammerspieleFrontBays: 8, kammerspieleCentralBays: 4,
  logoStatus: "The photographed facade DT ligature and open D enclosing T roof sign; no contemporary website campaign logo invented on the building.",
  sourceUrls: [
    "https://www.deutschestheater.de/das-deutsche-theater/profil",
    "https://www.deutschestheater.de/service/technikportal",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011193",
    "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
    "https://commons.wikimedia.org/wiki/File:Deutsches_Theater_Berlin_2024-05-09_01.jpg",
    "https://commons.wikimedia.org/wiki/File:Deutsches_Theater_Berlin_2024-05-09_03.jpg",
  ],
} as const;

export type DeutschesTheaterVoxelPayload = {
  cell_m: number; grid: { min_x_idx: number; min_z_idx: number };
  building_rows?: Array<Array<[number, number, number, number, number]>>;
  buildings?: Array<[number, number, number, number, number]>;
};
export type DeutschesTheaterOptions = { mobileLike?: boolean; voxels?: DeutschesTheaterVoxelPayload; diagnostics?: boolean };
type Triple = [number, number, number];
type Wall = { id: string; index: number; length: number; dx: number; dz: number; nx: number; nz: number; x: number; z: number };
export type DeutschesTheaterBlock = {
  position: Triple; size: Triple; quaternion: [number, number, number, number];
  color: number; role: string; sourceId: string; normal?: [number, number]; luminous?: boolean;
};
type Plan = { blocks: DeutschesTheaterBlock[]; curved: Builder; labels: string[]; windows: number; mobile: boolean; minecraft: boolean };
const C = DEUTSCHES_THEATER_TONES;
function parts(payload?: Pick<PrismPayload, "buildings">): PrismBuilding[] {
  return (payload?.buildings ?? sourcePrisms as unknown as PrismBuilding[]).filter(p => DEUTSCHES_THEATER_IDS.has(p.id));
}
function contains(p: PrismBuilding, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = p.ring.length - 1; i < p.ring.length; j = i++) {
    const [ax, az] = p.ring[i], [bx, bz] = p.ring[j];
    if ((az > z * 10) !== (bz > z * 10) && x * 10 < (bx - ax) * (z * 10 - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
function walls(p: PrismBuilding): Wall[] {
  const area = p.ring.reduce((s, a, i) => { const b = p.ring[(i + 1) % p.ring.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
  return p.ring.flatMap((a, index) => {
    const b = p.ring[(index + 1) % p.ring.length], x = a[0] / 10, z = a[1] / 10;
    const length = Math.hypot(b[0] / 10 - x, b[1] / 10 - z);
    if (length < .2) return [];
    const dx = (b[0] / 10 - x) / length, dz = (b[1] / 10 - z) / length, sign = area >= 0 ? 1 : -1;
    return [{ id: p.id, index, length, dx, dz, nx: dz * sign, nz: -dx * sign, x, z }];
  });
}
function at(w: Wall, u: number, y: number, out: number): Triple { return [w.x + w.dx * u + w.nx * out, y, w.z + w.dz * u + w.nz * out]; }
function subwall(w: Wall, start: number, end: number): Wall { return { ...w, x: w.x + w.dx * start, z: w.z + w.dz * start, length: end - start }; }
function box(p: Plan, w: Wall, u: number, y: number, out: number, width: number, height: number, depth: number, color: number, role: string, luminous = false): void {
  const q = new Quaternion().setFromAxisAngle(new Vector3(0,1,0), -Math.atan2(w.dz,w.dx));
  p.blocks.push({ position: at(w,u,y,out), size: [width,height,depth], quaternion: q.toArray(), color, role, sourceId: w.id, normal: [w.nx,w.nz], luminous });
}
function beam(p: Plan, w: Wall, a: Triple, b: Triple, width: number, color: number, role: string, luminous = false): void {
  const aa = new Vector3(...at(w,...a)), bb = new Vector3(...at(w,...b)), v = bb.clone().sub(aa), length = v.length();
  if (p.minecraft) {
    const n = Math.max(1, Math.ceil(length / .12));
    for (let i = 0; i < n; i++) { const pp = aa.clone().lerp(bb,(i+.5)/n); p.blocks.push({ position: pp.toArray(), size: [Math.max(.14,width),Math.max(.14,width),Math.max(.14,width)], quaternion: [0,0,0,1], color, role, sourceId:w.id, normal: [w.nx,w.nz], luminous }); }
  } else p.blocks.push({ position: aa.lerp(bb,.5).toArray(), size: [width,length,width], quaternion: new Quaternion().setFromUnitVectors(new Vector3(0,1,0),v.normalize()).toArray(), color, role, sourceId:w.id, normal: [w.nx,w.nz], luminous });
}
function shape(p: Plan, w: Wall, u: number, y: number, out: number, s: Shape, color: number, lamp = false): void {
  const g = new ShapeGeometry(s,p.mobile ? 8 : 16), m = new Matrix4().set(w.dx,0,w.nx,w.x+w.dx*u+w.nx*out,0,1,0,y,w.dz,0,w.nz,w.z+w.dz*u+w.nz*out,0,0,0,1);
  // Source rings can have either winding. Reflecting this plane requires
  // reversing its real triangle indices as well as transforming the normals.
  if (m.determinant() < 0 && g.index) for (let i = 0; i < g.index.count; i += 3) { const b = g.index.getX(i+1); g.index.setX(i+1,g.index.getX(i+2)); g.index.setX(i+2,b); }
  g.applyMatrix4(m);g.computeVertexNormals();g.deleteAttribute("uv");paintGeometry(g,color);(lamp?p.curved.lamps:p.curved.parts).push(g);
}
function archShape(width: number,height: number): Shape { const r=width/2,s=new Shape();s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,height-r);s.absarc(0,height-r,r,0,Math.PI,false);s.closePath();return s; }
function archField(p: Plan,w: Wall,u:number,y:number,out:number,width:number,height:number,color:number,luminous=false): void {
  if (!p.minecraft) { shape(p,w,u,y,out,archShape(width,height),color,luminous);return; }
  const r=width/2,rect=height-r;
  box(p,w,u,y+rect/2,out,width,rect,.18,color,"stepped arch field",luminous);
  const n=p.mobile?3:5;
  for(let i=0;i<n;i++) { const yy=(i+.5)*r/n,ww=2*Math.sqrt(Math.max(0,r*r-yy*yy));box(p,w,u,y+rect+yy,out,ww,r/n,.18,color,"stepped arch crown",luminous); }
}
function window(p:Plan,w:Wall,u:number,bottom:number,width:number,height:number,arched=false,shutters=false,out=.2):void {
  const t=p.minecraft?.13:.075;
  if(arched) {
    archField(p,w,u,bottom-.17,out,width+.34,height+.34,C.frame);
    archField(p,w,u,bottom,out+.1,width,height,C.glass,true);
    // The retained courtyard photograph resolves a masonry opening with
    // visible jambs. Keep its existing arch/pane coordinates and add only
    // shallow side returns; the glazing remains the first central surface.
    const jambHeight=height-width/2;
    for(const side of [-1,1])box(p,w,u+side*(width/2+.095),bottom+jambHeight/2,out+.11,.13,jambHeight,.27,C.stone,"arched masonry jamb return");
  }
  else {box(p,w,u,bottom+height/2,out,width+.32,height+.3,.11,C.frame,"window surround");box(p,w,u,bottom+height/2,out+.095,width,height,.1,C.glass,"window glazing",true);}
  box(p,w,u,bottom+height*.44,out+.2,t,height*.88,.09,C.frame,"window central mullion");
  const divisions=p.mobile||p.minecraft?2:4;
  for(let k=1;k<=divisions;k++) box(p,w,u,bottom+k*height/(divisions+1),out+.2,width,t,.09,C.frame,"window glazing crossbar");
  if(arched&&!p.minecraft&&!p.mobile) for(const ang of [Math.PI/4,Math.PI/2,3*Math.PI/4]) beam(p,w,[u,bottom+height-width/2,out+.21],[u+Math.cos(ang)*width*.48,bottom+height-width/2+Math.sin(ang)*width*.48,out+.21],.055,C.frame,"arched fanlight spoke");
  box(p,w,u,bottom-.15,out+.19,width+.48,.18,.31,C.stone,"projecting window sill");
  if(shutters) for(const sign of [-1,1]) {box(p,w,u+sign*(width*.5+.31),bottom+height/2,out+.17,.46,height+.12,.15,C.frame,"open shutter");if(!p.mobile&&!p.minecraft)for(let l=0;l<12;l++)box(p,w,u+sign*(width*.5+.31),bottom+(l+.5)*height/12,out+.26,.39,.075,.09,0xc3c9bb,"shutter louvre");}
  p.windows++;
}
function rail(p:Plan,w:Wall,u:number,bottom:number,width:number,out:number,role:string):void {
  box(p,w,u,bottom+.78,out,width,.08,.09,C.steel,role);box(p,w,u,bottom+.08,out,width,.07,.08,C.steel,role);
  const n=Math.max(2,Math.round(width/(p.mobile||p.minecraft?.65:.4)));
  for(let i=0;i<=n;i++)box(p,w,u-width/2+i*width/n,bottom+.43,out,.055,.78,.055,C.steel,role);
  if(!p.mobile&&!p.minecraft) for(let i=0;i<Math.floor(n/2);i++){const a=u-width/2+(i*2+.2)*width/n;beam(p,w,[a,bottom+.11,out],[a+width/n*1.6,bottom+.75,out],.045,C.steel,role);beam(p,w,[a,bottom+.75,out],[a+width/n*1.6,bottom+.11,out],.045,C.steel,role);}
}
function text(p:Plan,w:Wall,value:string,u:number,y:number,out:number,width:number,height:number):void {
  const paths=letteringStrokePaths(value,height),layout=letteringLayout(value,height),scale=Math.min(1,width/layout.totalWidthM);
  // Front edges run east-to-west; readable text runs left-to-right for the
  // visitor outside. Keeping the source edge direction would mirror all text.
  for(const path of paths)for(let i=0;i<path.length-1;i++)beam(p,w,[u-path[i][0]*scale,y+path[i][1],out],[u-path[i+1][0]*scale,y+path[i+1][1],out],p.minecraft?.065:.045,C.gold,`inscription ${value}`,true);
  p.labels.push(value);
}
/** The built rooftop mark is an open D contour with a T in its left field. */
function roofLogo(p:Plan,w:Wall):void {
  const centre=at(w,.65,0,0);w={...w,x:centre[0],z:centre[2],dx:-w.dx,dz:-w.dz};
  const u=0,y=24.2,out=.12;
  for(const du of [-1.15,.75])box(p,w,u+du,y+1.12,out,.075,2.24,.075,C.steel,"roof logo rectangular support");
  box(p,w,u-.2,y+1.05,out,1.9,.07,.07,C.steel,"roof logo support crossbar");
  beam(p,w,[u-.95,y+.07,out],[u+.66,y+1.03,out],.06,C.steel,"roof logo diagonal brace");
  const bottom=y+2.24,top=bottom+2.7,left=u-1.27,right=u+.64,r=1.35;
  const points:Triple[]=[[left,bottom,out+.1],[left,top,out+.1],[right,top,out+.1]];
  const n=p.minecraft?10:24;
  for(let i=1;i<=n;i++){const a=Math.PI/2-i*Math.PI/n;points.push([right+Math.cos(a)*r,bottom+r+Math.sin(a)*r,out+.1]);}points.push([left,bottom,out+.1]);
  for(let i=0;i<points.length-1;i++)beam(p,w,points[i],points[i+1],.13,C.gold,"roof D outline",true);
  beam(p,w,[left+.32,top-.4,out+.12],[left+1.5,top-.4,out+.12],.12,C.gold,"roof T crossbar",true);
  beam(p,w,[left+.91,top-.4,out+.12],[left+.91,bottom+.4,out+.12],.12,C.gold,"roof T stem",true);
}
function pedimentLogo(p:Plan,w:Wall,y:number):void {
  const centre=at(w,w.length/2,0,0);w={...w,x:centre[0],z:centre[2],dx:-w.dx,dz:-w.dz};
  const u=0,out=1.15,h=1.2,left=u-.18;
  // Thin historic ligature: shared vertical stem, curved D and serif T.
  beam(p,w,[left,y,out],[left,y+h,out],.055,C.gold,"pediment DT shared stem",true);
  beam(p,w,[u-.47,y+h,out],[u+.45,y+h,out],.055,C.gold,"pediment DT serif crossbar",true);
  const n=p.minecraft?8:16;
  for(let i=0;i<n;i++){const a=Math.PI/2-i*Math.PI/n,b=Math.PI/2-(i+1)*Math.PI/n;beam(p,w,[left+Math.cos(a)*.74,y+h/2+Math.sin(a)*h/2,out],[left+Math.cos(b)*.74,y+h/2+Math.sin(b)*h/2,out],.055,C.gold,"pediment DT curved letter",true);}
  beam(p,w,[u-.44,y,out],[u+.2,y,out],.05,C.gold,"pediment DT serif foot",true);
}
function triangle(p:Plan,w:Wall,width:number,height:number,y:number,out:number,color:number,role:string):void {
  if(p.minecraft){const n=6;for(let i=0;i<n;i++)box(p,w,w.length/2,y+(i+.5)*height/n,out,width*(1-(i+.5)/n),height/n,.22,color,role);}
  else{const s=new Shape();s.moveTo(-width/2,0);s.lineTo(width/2,0);s.lineTo(0,height);s.closePath();shape(p,w,w.length/2,y,out,s,color);}
}
function mainFront(p:Plan,w:Wall):void {
  const y0=5.2,out=.86;
  box(p,w,w.length/2,y0+7.5,out,w.length,15,.17,C.facadeIvory,"main ivory facade");
  box(p,w,w.length/2,y0+.52,out+.04,w.length,.95,.27,C.stone,"main base course");
  for(const u of [w.length*.385,w.length*.615])window(p,w,u,y0+2.85,1.92,6.8,true,false,out+.15);
  for(const u of [w.length*.12,w.length*.88]){window(p,w,u,y0+2.85,1.5,4,false,false,out+.15);window(p,w,u,y0+10.25,1.25,1.5,false,false,out+.15);box(p,w,u,y0+7.2,out+.35,2.2,.17,.4,C.frame,"side window hood");}
  for(const u of [w.length*.275,w.length*.5,w.length*.725]) {box(p,w,u,y0+7.4,out+.31,.55,10,.43,C.frame,"three portico pilasters");box(p,w,u,y0+2.53,out+.36,.8,.3,.55,C.stone,"pilaster base");box(p,w,u,y0+12.25,out+.39,.84,.26,.57,C.frame,"pilaster capital");}
  for(const [y,h,d] of [[12.65,.42,.45],[14.04,.26,.6],[14.35,.12,.72]] as const)box(p,w,w.length/2,y0+y,out+.28,w.length+.46,h,d,C.frame,"main layered entablature");
  triangle(p,w,w.length+.35,3.15,y0+14.38,out+.17,C.facadeIvory,"main pediment field");
  for(const sign of [-1,1])beam(p,w,[w.length/2+sign*(w.length/2+.25),y0+14.4,out+.39],[w.length/2,y0+17.58,out+.39],.22,C.frame,"main raking cornice");
  pedimentLogo(p,w,y0+15.0);text(p,w,"DEUTSCHES THEATER",w.length/2,y0+13.04,out+.67,w.length*.72,.54);
  rail(p,w,w.length/2,y0+2.5,w.length-1.3,out+.65,"main entrance balcony");
  for(let i=0;i<4;i++)box(p,w,w.length/2,y0+.12+i*.17,1.5-i*.19,w.length*.69-i*.18,.24,1.15-i*.15,C.stone,"main entrance step");
}
function kammerFront(p:Plan,w:Wall):void {
  // Ns58PVF3 is the source's shallow central risalit. Keep the authored
  // glazing outside its 0.7 m front, not buried behind that retained prism.
  const y0=5.2,out=.96,width=w.length;
  box(p,w,width/2,y0+8.43,out,width,16.86,.14,C.kammerspiele,"Kammerspiele sage facade");
  box(p,w,width/2,y0+.55,out+.1,width,1.1,.24,C.kammerspieleShade,"Kammerspiele plinth");
  for(let bay=0;bay<8;bay++) {const u=width*(bay+.5)/8;window(p,w,u,y0+3.0,1.7,4.1,false,true,out+.12);window(p,w,u,y0+9.35,1.7,4.65,true,false,out+.12);rail(p,w,u,y0+9.5,2.0,out+.43,"Kammerspiele individual upper balcony");}
  const centre=width/2,cw=width*.52;
  for(const u of [centre-cw/2,centre+cw/2])box(p,w,u,y0+10.35,out+.22,.23,12.9,.24,C.kammerspieleShade,"Kammerspiele central risalit edge");
  box(p,w,centre,y0+16.85,out+.2,width+.12,.22,.35,C.frame,"Kammerspiele eaves");
  triangle(p,w,cw,.95,y0+16.97,out+.27,C.kammerspiele,"Kammerspiele shallow central gable");
  for(const side of [-1,1])beam(p,w,[centre+side*cw/2,y0+17.02,out+.43],[centre,y0+17.97,out+.43],.18,C.frame,"Kammerspiele raking cornice");
  text(p,w,"KAMMERSPIELE",centre,y0+16.00,out+.57,cw*.88,.47);
  text(p,w,"DES",centre,y0+15.42,out+.57,1.5,.27);
  text(p,w,"DEUTSCHEN THEATERS",centre,y0+14.98,out+.57,cw*.86,.29);
  // The glazed canopy belongs to the Kammer entrance, not the main portico.
  const canopy=width*.74;
  box(p,w,centre,y0+2.83,1.05,canopy,.14,1.6,C.glass,"Kammer glazed entrance canopy");
  const ribs=p.mobile?6:10;
  for(let i=0;i<=ribs;i++)box(p,w,centre-canopy/2+i*canopy/ribs,y0+2.91,1.05,.065,.06,1.62,C.frame,"Kammer canopy rib");
}
function garden(p:Plan,w:Wall):void {
  const first=-17.5;
  // Four raised beds retain central and side approach gaps; their subdivision
  // is a bounded display reading of the 2024 planting, not a planting survey.
  for(const [u,ww] of [[first+5,8],[first+15,8],[first+25,8],[first+35,8]] as const) {
    box(p,w,u,5.5,17.8,ww,.48,2.25,C.corten,"courtyard corten planter");
    box(p,w,u,6.08,17.8,ww-.25,.78,2.05,C.gardenDark,"courtyard low planting");
    for(let i=0;i<(p.mobile?3:6);i++)box(p,w,u-ww*.38+i*ww*.76/((p.mobile?3:6)-1),6.62,17.8,.72,.42,1.5,C.gardenLight,"courtyard varied planting crown");
  }
  for(const u of [first+3,first+36]) {
    box(p,w,u,7.18,7,.13,3.96,.13,C.steel,"courtyard twin lamp pole");
    box(p,w,u,8.77,7,1.82,.12,.12,C.steel,"courtyard twin lamp arm");
    for(const side of [-1,1]) {
      const a=u+side*.75;box(p,w,a,8.7,7,.54,.86,.54,C.frame,"courtyard lantern glass",true);box(p,w,a,9.2,7,.74,.14,.74,C.steel,"courtyard lantern cap");box(p,w,a,8.24,7,.43,.13,.43,C.steel,"courtyard lantern foot");
      for(const d of [-.26,.26])box(p,w,a+d,8.7,7,.035,.88,.55,C.steel,"courtyard lantern edge");
    }
  }
}
function voxelSampler(v?:DeutschesTheaterVoxelPayload):(x:number,y:number,z:number)=>boolean {
  if(!v)return()=>false;const cols=new Map<string,[number,number]>(),cell=v.cell_m;
  const add=(x:number,z:number,lo:number,hi:number)=>{if(x*cell<615||x*cell>815||z*cell< -642||z*cell> -544)return;cols.set(`${x},${z}`,[lo/10,hi/10]);};
  v.building_rows?.forEach((row,zi)=>{const z=v.grid.min_z_idx+zi;if(z*cell< -645||z*cell> -540)return;for(const [x,n,lo,hi] of row)for(let i=0;i<n;i++)add(v.grid.min_x_idx+x+i,z,lo,hi);});
  for(const [x,z,lo,hi] of v.buildings??[])add(x,z,lo,hi);
  return(x,y,z)=>{const c=cols.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`);return !!c&&y>=c[0]&&y<=c[1];};
}
function plan(payload:Pick<PrismPayload,"buildings">|undefined,options:DeutschesTheaterOptions,minecraft:boolean):Plan {
  const source=parts(payload),byId=new Map(source.map(b=>[b.id,b])),p:Plan={blocks:[],curved:createBuilder(),labels:[],windows:0,mobile:minecraft&&!!options.mobileLike,minecraft};
  const main=byId.get("KeeAYa8r"),kammer=byId.get("yMkbzxqy"),annex=byId.get("TVjCvFcI");if(!main||!kammer||!annex)return p;
  const m=walls(main).find(w=>w.index===2)!,k=subwall(walls(kammer).find(w=>w.index===4)!,0,23.15);
  const obscured=(w:Wall,u:number,y:number)=>{const point=at(w,u,y,.3);return source.some(q=>q.id!==w.id&&y>=q.y0_dm/10&&y<(q.y0_dm+q.h_dm)/10&&contains(q,point[0],point[2]));};
  for(const b of source)for(const w of walls(b)) {
    if(w.length<2.5||b.id==="KeeAYa8r"||b.id==="Ns58PVF3")continue;
    const low=b.y0_dm/10,top=(b.y0_dm+b.h_dm)/10,roof=b.roof===1000?0:Math.min(4.8,b.h_dm/10*.2),max=top-roof-.5;
    const bays=Math.max(1,Math.floor(w.length/(p.minecraft?4.5:3.3))),pitch=w.length/bays;
    for(let bay=0;bay<bays;bay++) {
      const u=(bay+.5)*pitch;
      if(b.id==="yMkbzxqy"&&w.index===4&&u<23.7)continue;
      // The part behind the portico retains its right-hand two-storey annex.
      if(b.id==="TVjCvFcI"&&w.index===1&&u>w.length-17.8)continue;
      for(let y=low+3.0;y+2.4<max;y+=3.65) {
        if(obscured(w,u,y+1.2))continue;
        if(b.id==="TVjCvFcI"&&w.index===1) {if(y>low+8)continue;window(p,w,u,low+(y<low+5?2.85:10.15),1.45,y<low+5?4.0:1.45,false,y<low+5);}
        else window(p,w,u,y,Math.min(1.5,pitch*.55),2.35,false,false,.18);
      }
      // Closely spaced roof-edge brackets on the two courtyard side wings.
      if((b.id==="wZRgel5C"||b.id==="tiVg9hjE")&&!obscured(w,u,max-.3)) {box(p,w,u,max-.2,.22,.27,.42,.35,C.frame,"courtyard eaves console");box(p,w,u,max+.15,.16,pitch,.14,.33,C.frame,"courtyard eaves cornice");}
    }
  }
  mainFront(p,m);kammerFront(p,k);roofLogo(p,k);garden(p,k);
  if(minecraft&&options.voxels) {
    const occupied=voxelSampler(options.voxels);
    const offsets=new Map<string,number>();
    const key=(b:DeutschesTheaterBlock)=>`${b.sourceId}/${b.normal![0].toFixed(3)}/${b.normal![1].toFixed(3)}`;
    const projected=(b:DeutschesTheaterBlock)=>b.normal&&!b.role.startsWith("courtyard")&&!b.role.startsWith("roof");
    for(const b of p.blocks) {
      if(!projected(b))continue;
      let move=0;const [nx,nz]=b.normal!,dx=-nz,dz=nx;
      // A diagonal 4 m cell can project up to sqrt(2)*4 m along its normal.
      // Sample the opening's height as well: stacked source columns need not
      // have the same top at its centre and upper/lower window corners.
      for(const du of [-b.size[0]*.45,0,b.size[0]*.45])for(const dy of [-b.size[1]*.45,0,b.size[1]*.45])for(let d=0;d<5.8;d+=.15)if(occupied(b.position[0]+dx*du+nx*d,b.position[1]+dy,b.position[2]+dz*du+nz*d))move=Math.max(move,d+b.size[2]/2+.12);
      offsets.set(key(b),Math.max(offsets.get(key(b))??0,move));
    }
    // Keep the whole wall's layer order. Moving a broad opaque facade farther
    // than individual panes would put a new solid wall in front of its windows.
    for(const b of p.blocks)if(projected(b)){const d=offsets.get(key(b))??0;b.position[0]+=b.normal![0]*d;b.position[2]+=b.normal![1]*d;}
  }
  return p;
}
function make(payload:Pick<PrismPayload,"buildings">|undefined,options:DeutschesTheaterOptions,minecraft:boolean):Group {
  const p=plan(payload,options,minecraft),g=new Group();g.name=minecraft?MINECRAFT_DEUTSCHES_THEATER_GROUP:DEUTSCHES_THEATER_GROUP;
  const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
  const matrix=new Matrix4(),q=new Quaternion(),position=new Vector3(),scale=new Vector3(),color=new Color();
  for(const luminous of minecraft?[false]:[false,true]) {
    const selected=minecraft?p.blocks:p.blocks.filter(b=>!!b.luminous===luminous);if(!selected.length)continue;
    const day=new MeshBasicMaterial({color:0xffffff});const night=new MeshStandardMaterial({color:0xffffff,roughness:.87,metalness:0,emissive:luminous?C.nightGlass:0,emissiveIntensity:luminous?.34:0});
    const mesh=new InstancedMesh(geometry,day,selected.length);mesh.name=`${g.name} ${luminous?"glazing and lettering":"facade blocks"}`;
    selected.forEach((b,i)=>{matrix.compose(position.fromArray(b.position),q.fromArray(b.quaternion),scale.fromArray(b.size));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(b.color));});
    mesh.userData.dayMaterial=day;mesh.userData.nightMaterial=night;mesh.userData.sourceBounded=true;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();g.add(mesh);
  }
  const curved=finishDrawnGroup(p.curved,{name:"Deutsches Theater curved facade fields",lampEmissive:C.nightGlass,lampEmissiveIntensity:.34});if(curved)g.add(curved);
  g.userData.architecturalProfile=DEUTSCHES_THEATER_PROFILE;g.userData.geometryStatus=DEUTSCHES_THEATER_PROFILE.geometryStatus;
  g.userData.rooftopMark="DT";g.userData.facadeLabels=p.labels;g.userData.mobileLike=p.mobile;g.userData.minecraft=minecraft;
  g.userData.detailCounts={sourcePrisms:parts(payload).length,windows:p.windows,facadeLabels:p.labels.length,instances:p.blocks.length,mainPilasters:3,kammerspieleBays:8};
  if(options.diagnostics)g.userData.blocks=p.blocks;
  freezeStaticSceneTransforms(g);return g;
}
/** Shared authored geometry in Day, Night, Snowstorm and Schwellenraum. */
export function createDeutschesTheater(prisms?:Pick<PrismPayload,"buildings">,options:DeutschesTheaterOptions={}):Group {return make(prisms,options,false);}
/** Separate stepped arches and block lettering, with retained source voxel shells. */
export function createMinecraftDeutschesTheater(prisms?:Pick<PrismPayload,"buildings">,options:DeutschesTheaterOptions={}):Group {return make(prisms,options,true);}
