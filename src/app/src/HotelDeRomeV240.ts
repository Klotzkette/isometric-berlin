import { letteringStrokePaths } from "./drawnLettering";

export type HotelPoint = [number, number, number];
type XZ = readonly [number, number];
type Axis = { start: XZ; end: XZ; side: -1 | 1 };
/** The existing shared instancer retains HU/library geometry byte-for-byte. */
export interface HotelBuilder {
  readonly minecraft: boolean;
  box(axis: Axis, u: number, y: number, out: number, size: HotelPoint, color: number): void;
  column(axis: Axis, u: number, bottom: number, top: number, out: number, diameter: number, color: number): void;
  beam(a: HotelPoint, b: HotelPoint, thickness: number, color: number): void;
  arch(axis: Axis, u: number, spring: number, out: number, width: number, rise: number, thickness: number, color: number): void;
}

export const HOTEL_DE_ROME_V240 = {
  parent: "DEBE01YYK00002GD",
  measuredParts: 10,
  measuredSurfaces: 103,
  axes: [
    { start: [1508.0, 374.042], end: [1515.692, 373.422], side: 1, bays: 2 },
    { start: [1515.651, 372.724], end: [1538.603, 370.811], side: 1, bays: 5 },
    { start: [1538.686, 371.516], end: [1546.447, 370.946], side: 1, bays: 2 },
  ] as (Axis & { bays: number })[],
  columnCount: 6,
  columnBottom: 10.58,
  columnTop: 20.82,
  measuredProjectedFrontTop: 21.369,
  measuredStreetEave: 24.304,
  balustradeBottom: 22.05,
  balustradeTop: 23.24,
  wallTone: 0xc5bdad,
  roofTone: 0x696b68,
  geometryStatus: "Complete v131 measured shell retained; photo-informed facade dimensions, hues and subdivisions are display estimates.",
} as const;
const P = HOTEL_DE_ROME_V240;
const STONE = P.wallTone, LIGHT = 0xdbd3c1, SHADE = 0xa59e8f;
const BASE = 0xb3afa4, JOINT = 0x8c8a81, GLASS = 0x526d75;
const GLINT = 0x8eaaa9, FRAME = 0x989a80, DARK = 0x404d4b, GOLD = 0xb9a467;
const length = (a: Axis): number => Math.hypot(a.end[0] - a.start[0], a.end[1] - a.start[1]);
function point(a: Axis, u: number, y: number, out: number): HotelPoint {
  const dx=a.end[0]-a.start[0], dz=a.end[1]-a.start[1], l=length(a);
  return [a.start[0]+(dx*u+dz*out*a.side)/l,y,a.start[1]+(dz*u-dx*out*a.side)/l];
}

function archGlass(b: HotelBuilder, a: Axis, u: number, spring: number, width: number, out: number): void {
  // Separate head strips fit the round aperture; neither representation has a square dark cap.
  const count=b.minecraft?7:12, pitch=width/count;
  for(let i=0;i<count;i++){
    const x=-width/2+(i+.5)*pitch, h=Math.sqrt(Math.max(0,(width/2)**2-x*x));
    b.box(a,u+x,spring+h/2,out,[pitch+.012,h,.10],GLASS);
  }
}
function aperture(b: HotelBuilder, a: Axis, u: number, y: number, w: number, h: number, round=false): void {
  const out=.27;
  b.box(a,u,y,out,[w,h,.12],GLASS);
  if(round)archGlass(b,a,u,y+h/2,w,out);
  // Inset olive/bronze frames, four large panes and restrained cool sky reflections.
  for(const sign of [-1,1]) {
    b.box(a,u+sign*(w/2+.11),y,.37,[.20,h+.12,.25],round?BASE:LIGHT);
    b.box(a,u+sign*(w/2-.08),y,.39,[.075,h,.10],FRAME);
    b.box(a,u+sign*w*.245,y+h*.20,.405,[w*.37,h*.26,.018],GLINT);
  }
  b.box(a,u,y,.42,[.09,h,.09],FRAME);
  b.box(a,u,y+h*.22,.42,[w,.09,.09],FRAME);
  b.box(a,u,y-h/2-.11,.42,[w+.46,.19,.44],LIGHT);
  if(round){
    b.arch(a,u,y+h/2,.40,w+.22,(w+.22)/2,.22,BASE);
    b.box(a,u,y+h/2+w/2+.14,.47,[.29,.43,.31],LIGHT);
  }else{
    b.box(a,u,y+h/2+.12,.42,[w+.46,.20,.41],LIGHT);
    b.box(a,u,y+h/2+.34,.35,[w+.17,.16,.23],STONE);
    for(const sign of [-1,1])b.box(a,u+sign*w*.38,y-h/2-.31,.36,[.25,.28,.31],SHADE);
  }
}
function pediment(b: HotelBuilder,a: Axis,u: number,central:boolean): void {
  const y=14.68,w=3.12;
  b.box(a,u,y,.40,[w,.26,.48],LIGHT);
  b.box(a,u,y-.34,.34,[w-.25,.34,.28],STONE);
  if(central){
    b.arch(a,u,y+.14,.45,w,.58,.17,LIGHT);
    b.arch(a,u,y+.12,.40,w-.28,.43,.13,SHADE);
  }else if(b.minecraft){
    for(let i=0;i<9;i++)b.box(a,u+(i-4)*w/9,y+.23+.53*(1-Math.abs(i-4)/4),.43,[w/9,.20,.23],LIGHT);
  }else{
    b.beam(point(a,u-w/2,y+.10,.43),point(a,u,y+.82,.43),.19,LIGHT);
    b.beam(point(a,u,y+.82,.43),point(a,u+w/2,y+.10,.43),.19,LIGHT);
  }
}
function windowRail(b:HotelBuilder,a:Axis,u:number):void {
  b.box(a,u,10.92,.58,[2.85,.17,.46],LIGHT);
  b.box(a,u,10.36,.56,[2.85,.18,.46],STONE);
  const n=b.minecraft?6:9;
  for(let i=0;i<n;i++)b.box(a,u-1.23+i*2.46/(n-1),10.63,.58,[.12,.45,.18],LIGHT);
}
function rustication(b:HotelBuilder,a:Axis):void {
  const l=length(a),bays=P.axes.find(x=>x===a)!.bays;
  for(let row=0;row<8;row++){
    const y=5.50+row*.60;
    // Subtract the round openings from each course; joints never stripe through the glass.
    let intervals:[number,number][]=[[0,l]];
    for(let i=0;i<bays;i++){
      const u=(i+.5)*l/bays,w=(bays===5&&i===2)?3.05:2.36;
      const spring=8.43, half=y<=spring?w/2+.20:Math.sqrt(Math.max(0,(w/2+.20)**2-(y-spring)**2));
      if(half===0)continue;
      intervals=intervals.flatMap(([x,z])=>z<=u-half||x>=u+half?[[x,z]] as [number,number][]:[[x,Math.min(z,u-half)],[Math.max(x,u+half),z]].filter(([p,q])=>q-p>.05) as [number,number][]);
    }
    for(const [x,z] of intervals){
      const n=Math.ceil((z-x)/1.55),pitch=(z-x)/n;
      for(let i=0;i<n;i++)b.box(a,x+(i+.5)*pitch,y,.18,[Math.max(.08,pitch-.065),.53,.21],(row+i)%3===0?STONE:BASE);
    }
  }
  b.box(a,l/2,5.28,.22,[l,.27,.30],JOINT);
}
function terraceRail(b:HotelBuilder,a:Axis,central:boolean):void {
  const l=length(a),bottom=P.balustradeBottom;
  for(const [y,h,w] of [[bottom,.22,.54],[P.balustradeTop,.21,.60]] as const)b.box(a,l/2,y,.15,[l,h,w],STONE);
  const n=Math.floor(l/(b.minecraft?.80:.51));
  for(let i=0;i<=n;i++){
    const u=i*l/n;
    if(central&&Math.abs(u-l/2)<2.0)continue;
    b.box(a,u,bottom+.59,.15,[.16,.92,.24],LIGHT);
    if(!b.minecraft)b.box(a,u,bottom+.48,.15,[.25,.28,.27],LIGHT);
  }
  for(const u of central?[0,l/2-2.05,l/2+2.05,l]:[0,l])b.box(a,u,bottom+.60,.16,[.52,1.25,.68],STONE);
  if(central)b.box(a,l/2,bottom+.65,.19,[4.10,1.34,.62],STONE);
}

/** Correct only the obsolete v131 Hotel display recipe, keeping all measured sheets. */
export function addHotelDeRomeV240(b:HotelBuilder):void {
  for(const a of P.axes){
    const l=length(a),central=a.bays===5;
    rustication(b,a);
    for(const [y,h,d,color] of [[10.18,.20,.44,SHADE],[10.42,.25,.67,LIGHT],[20.99,.20,.49,STONE],[21.30,.35,.75,LIGHT],[21.70,.16,.93,LIGHT],[21.53,.12,.70,SHADE]] as const)
      b.box(a,l/2,y,.36,[l+.03,h,d],color);
    // Widely spaced modillions under the source-aligned main cornice.
    const dentils=Math.floor(l/(b.minecraft?1.2:.65));
    for(let i=0;i<dentils;i++)b.box(a,(i+.5)*l/dentils,21.08,.69,[.25,.24,.39],LIGHT);
    for(let i=0;i<a.bays;i++){
      const u=(i+.5)*l/a.bays,entry=central&&i===2;
      aperture(b,a,u,7.05,entry?3.05:2.36,2.76,true);
      aperture(b,a,u,12.55,2.28,3.04);
      aperture(b,a,u,18.08,2.28,2.98);
      pediment(b,a,u,central);
      windowRail(b,a,u);
    }
    terraceRail(b,a,central);
  }
  const a=P.axes[1],l=length(a);
  for(let i=0;i<6;i++)b.column(a,i*l/5,P.columnBottom,P.columnTop,.71,1.22,LIGHT);
  // Source-projected central frieze, with the historic hotel name in small metal letters.
  b.box(a,l/2,21.48,.50,[l+.40,.48,.27],STONE);
  if(!b.minecraft)for(const path of letteringStrokePaths('HOTEL DE ROME',.49))for(let i=1;i<path.length;i++)
    b.beam(point(a,l/2-path[i-1][0],21.28+path[i-1][1],.77),point(a,l/2-path[i][0],21.28+path[i][1],.77),.044,GOLD);
  // Shallow entrance canopy and framed double door: no new ground or navigation slab.
  b.box(a,l/2,8.58,1.38,[5.10,.13,2.48],DARK);
  b.box(a,l/2,8.49,2.58,[5.22,.18,.14],GOLD);
  for(const sign of [-1,1]){
    b.box(a,l/2+sign*1.54,6.72,.55,[.13,3.04,.17],DARK);
    b.box(a,l/2+sign*.12,6.54,.59,[.055,.62,.06],GOLD);
    b.box(a,l/2+sign*3.25,6.0,.92,[.70,1.35,.58],DARK);
    b.box(a,l/2+sign*3.25,6.76,.92,[.78,.17,.66],GOLD);
  }
}

/** Keep coarse native wall cells behind the measured street face, without touching roofs. */
export function clipHotelNativeFront<T extends { position: HotelPoint; size: HotelPoint; color: number }>(block:T):T|null {
  const [x,,z]=block.position,[w,,d]=block.size;
  if(x<1508||x>1546.447||z-d/2>375)return block;
  const fronts=P.axes.flatMap(a=>{
    const lo=Math.max(x-w/2,a.start[0]),hi=Math.min(x+w/2,a.end[0]);
    if(lo>hi)return [];
    return [lo,hi].map(px=>a.start[1]+(px-a.start[0])*(a.end[1]-a.start[1])/(a.end[0]-a.start[0]));
  });
  if(!fronts.length)return block;
  const low=Math.max(z-d/2,...fronts),high=z+d/2;
  if(low>=high)return null;
  if(low===z-d/2)return block;
  return {...block,position:[x,block.position[1],(low+high)/2],size:[w,block.size[1],high-low]};
}
