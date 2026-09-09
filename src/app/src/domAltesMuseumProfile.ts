import source from "./domAltesMuseumSource.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
export { DOM_ALTES_PRISM_IDS } from "./domAltesMuseumIds";
export type MuseumSourcePart = typeof source.dom.parts[number];
export const DOM_ALTES_SOURCE = source;
export const DOM_ALTES_GROUP = "Berliner Dom, Altes Museum and granite bowl";
export const MINECRAFT_DOM_ALTES_GROUP = "Minecraft Berliner Dom, Altes Museum and granite bowl";
export const DOM_PROFILE = {
  centre: [2011, 23] as const, yaw: -1.0303, ground: 2.27,
  bodyTop: 35.8, drumBase: 35.8, drumTop: 54.27, domeTop: 81.27,
  domeRadius: 21.4, domeLocal: [-3.2, -2] as const,
  lanternTop: 93.27, top: 100.27, publishedHeightM: 98,
  towers: [[-38.5, 25.5], [32, 25.5], [-28.5, -26.5], [22.5, -26.5]] as const,
  towerDrumTop: 54.5, towerDomeTop: 65.6,
  towerScales: [1,1,.64,.64] as const,
};
export const ALTES_PROFILE = {
  centre: [1868.37, -.216] as const, yaw: .5405,
  frontLength: 84.24, frontDepth: 6.8, deck: 7.301,
  colonnadeTop: 22.45, entablatureTop: 24.53, columns: 18,
  rotundaTop: 32.211,
};
export const GRANITE_BOWL_PROFILE = {
  node: "376689138", centre: [1880.092031, 19.330824] as const,
  ground: 5.2, diameterM: 6.9, plinthRadius: 4.42,
  supportCount: 3, bowlBottom: 6.22, rim: 7.47,
  material: "red granite", referenceDiameterPrecision: "published 6.9 m; no sub-centimetre survey claim",
};
export function museumPartContains(part: { ring: number[][]; holes: number[][][] }, x: number, z: number): boolean {
  return pointInWorldRing(x, z, part.ring as unknown as WorldRing) && !part.holes.some(h => pointInWorldRing(x, z, h as unknown as WorldRing));
}
export function domWorld(u: number, y: number, v: number): [number, number, number] {
  const p = DOM_PROFILE, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return [p.centre[0] + c * u + s * v, y, p.centre[1] - s * u + c * v];
}
export function altesWorld(u: number, y: number, v: number): [number, number, number] {
  const p = ALTES_PROFILE, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return [p.centre[0] + c * u + s * v, y, p.centre[1] - s * u + c * v];
}
export function domLocal(x: number, z: number): [number, number] {
  const p = DOM_PROFILE, dx = x - p.centre[0], dz = z - p.centre[1];
  return [dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw), dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)];
}
/** Original LoD2 records survive; only explicitly documented coarse roof shapes subdivide. */
export function museumDisplayY(part: MuseumSourcePart, y: number): number {
  if (part.id === source.dom.parent_id)
    return part.ground_y_m + (y - part.ground_y_m) * (DOM_PROFILE.bodyTop - part.ground_y_m) / (part.top_y_m - part.ground_y_m);
  if (part.id === "DEBE3DMfhQc2wgOO" || part.id === "DEBE3DZGavw271ZU") return Math.min(y, ALTES_PROFILE.rotundaTop);
  return y;
}
type RoofPlane = { part: MuseumSourcePart; ring: number[][]; a: number[]; n: number[] };
const roofs: RoofPlane[] = source.altes.parts.flatMap(part => part.surfaces.filter(s => s.kind === "RoofSurface").map(s => {
  const r = s.rings[0].map(p => [p[0], museumDisplayY(part, p[1]), p[2]]), n = [0,0,0];
  for (let i = 0; i < r.length; i++) { const a=r[i],b=r[(i+1)%r.length]; n[0]+=(a[1]-b[1])*(a[2]+b[2]); n[1]+=(a[2]-b[2])*(a[0]+b[0]); n[2]+=(a[0]-b[0])*(a[1]+b[1]); }
  return { part, ring:r.map(p=>[p[0],p[2]]), a:r[0], n };
}));
export function altesRoofAt(x: number, z: number, id?: string): number | null {
  let top: number | null = null;
  for (const p of roofs) if ((!id || p.part.id === id) && Math.abs(p.n[1]) > 1e-6 && pointInWorldRing(x,z,p.ring as unknown as WorldRing)) {
    const y = p.a[1] - (p.n[0]*(x-p.a[0])+p.n[2]*(z-p.a[2]))/p.n[1];
    top = Math.max(top ?? -Infinity, y);
  }
  return top;
}
/** Matches the drawn dome and tower roof profiles, avoiding the former 98 m flat roof. */
export function domRoofAt(x: number, z: number): number | null {
  if (!museumPartContains(source.dom.parts[0], x, z)) return null;
  const p = DOM_PROFILE, [u,v] = domLocal(x,z);
  let top = p.bodyTop;
  const r = Math.hypot(u-p.domeLocal[0],v-p.domeLocal[1]);
  if (r <= p.domeRadius) top = p.drumTop+(p.domeTop-p.drumTop)*Math.sqrt(Math.max(0,1-(r/p.domeRadius)**2));
  for (let i=0;i<p.towers.length;i++) {
    const [tu,tv]=p.towers[i],scale=p.towerScales[i],radius=Math.hypot(u-tu,v-tv),base=p.bodyTop+(p.towerDrumTop-p.bodyTop)*scale;
    if (radius<=6.8*scale) top=Math.max(top,base+(p.towerDomeTop-p.towerDrumTop)*scale*Math.sqrt(Math.max(0,1-(radius/(6.8*scale))**2)));
  }
  const gu=u-p.domeLocal[0],gv=v-p.domeLocal[1];
  if(Math.abs(gu)<=.28&&Math.abs(gv)<=.23)top=p.top;
  else if(Math.abs(gu)<=1.6&&Math.abs(gv)<=.23)top=Math.max(top,98.995);
  else if(r<=.8)top=Math.max(top,94.12+Math.sqrt(.8*.8-r*r));
  return top;
}
/** Exact original source masks; no district-radius exclusion of neighbours. */
export function isDomAltesReplacementColumn(x:number,z:number,top?:number,cell=4):boolean {
  if(x<1800-cell||x>2060+cell||z< -70-cell||z>80+cell)return false;
  for(const p of source.previous_context_prisms){
    const maximum=p.y0_dm/10+Math.ceil(p.h_dm/(cell*10))*cell;
    if(top!==undefined&&top>maximum+.001)continue;
    const contains=(px:number,pz:number)=>pointInWorldRing(px*10,pz*10,p.ring as unknown as WorldRing)&&!p.holes.some(h=>pointInWorldRing(px*10,pz*10,h as unknown as WorldRing));
    if([-.499,0,.499].some(dx=>[-.499,0,.499].some(dz=>contains(x+dx*cell,z+dz*cell))))return true;
  }
  return false;
}
export const DOM_ALTES_ARCHITECTURE_PROFILE = {
  sourceCreated: "2026-03-02", textureFree: true, catalogueAddition: false,
  sourceUrls: [source.dom.source_url,
    "https://www.openstreetmap.org/way/313670734", "https://www.openstreetmap.org/relation/3619", "https://www.openstreetmap.org/node/376689138",
    "https://www.berlinerdom.de/besuchen-wissen/ueber-den-dom/architektur/",
    "https://www.smb.museum/en/museums-institutions/altes-museum/about-us/profile/",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09012501",
    "https://bildhauerei-in-berlin.de/bildwerk/granitschale-7879/",
    "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
  ],
  sourceStatus: "Official LoD2 plans and complete original planes retained. Dom flat roof omits the five domes and assigns the same 43.419 m to the entire mass; articulated body/drum/tower heights are photograph-based estimates under the institution's 98 m total height. Two narrow Altes roof strips are subdivided below their retained anomalous peaks to the main 32.211 m roof envelope. Facades, sculpture silhouettes, roof ribs and cross subdivisions are procedural recognition geometry, not facade surveys.",
} as const;

export function altesLocal(x:number,z:number):[number,number] {
  const p=ALTES_PROFILE,dx=x-p.centre[0],dz=z-p.centre[1];
  return [dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw),dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw)];
}
/** Extra solids complement source obstacles without closing the public portico. */
export function domAltesExtraSolidAt(x:number,y:number,z:number,radius=0):boolean {
  if(x<1800||x>2060||z< -70||z>80)return false;
  const [u,v]=altesLocal(x,z),p=ALTES_PROFILE;
  if(y>=22.5-radius&&y<=24.53+radius&&Math.abs(u)<=42.7+radius&&Math.abs(v-2.5)<=4.35+radius)return true;
  if(y>=p.deck-radius&&y<=p.colonnadeTop+.3+radius)
    for(let i=0;i<p.columns;i++)if(Math.hypot(u-(-39.8+i*79.6/17),v-2.6)<=.85+radius)return true;
  const b=GRANITE_BOWL_PROFILE,r=Math.hypot(x-b.centre[0],z-b.centre[1]);
  if(r<=3.45+radius){const inner=6.39+1.08*(Math.min(r,3.45)/3.45)**2.45;if(y>=inner-.3-radius&&y<=inner+radius)return true;}
  if(y>=5.36-radius&&y<=6.22+radius)for(let i=0;i<3;i++) {const t=i*Math.PI*2/3+.4,cx=b.centre[0]+Math.cos(t)*1.65,cz=b.centre[1]+Math.sin(t)*1.65;if(Math.hypot(x-cx,z-cz)<=.72+radius)return true;}
  return false;
}
/** Supports the approach steps, open colonnade deck/roof and bowl plinth. */
export function domAltesExtraGroundAt(x:number,z:number,referenceFeetY:number):number|null {
  const [u,v]=altesLocal(x,z);let result:number|null=null;
  const accept=(y:number)=>{if(y<=referenceFeetY+.52)result=Math.max(result??-Infinity,y);};
  if(Math.abs(u)<=42.7&&Math.abs(v-2.5)<=4.35) {if(v<=3.5)accept(ALTES_PROFILE.deck);accept(ALTES_PROFILE.entablatureTop);}
  if(Math.abs(u)<=12&&v>=4.04&&v<=9.56) {const i=Math.max(0,Math.min(20,Math.floor((v-4.04)/.26)));accept(5.22+(21-i)*(ALTES_PROFILE.deck-5.22)/21+.08);}
  const b=GRANITE_BOWL_PROFILE,r=Math.hypot(x-b.centre[0],z-b.centre[1]);if(r<=b.plinthRadius)accept(b.ground+.26);
  if(r<=3.45)accept(6.39+1.08*(r/3.45)**2.45);
  return result;
}

/** Westmost source edge for a facade axis, in the building's own plan frame. */
export function domFrontVAt(u:number):number {
  const ring=source.dom.parts[0].ring.map(p=>domLocal(p[0],p[1]));let result=-Infinity;
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if((a[0]<=u&&b[0]>=u)||(b[0]<=u&&a[0]>=u)){const t=(u-a[0])/(b[0]-a[0]);if(Number.isFinite(t))result=Math.max(result,a[1]+t*(b[1]-a[1]));}}
  return Number.isFinite(result)?result:33.8;
}

export function domBackVAt(u:number):number {
  const ring=source.dom.parts[0].ring.map(p=>domLocal(p[0],p[1]));let result=Infinity;
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if((a[0]<=u&&b[0]>=u)||(b[0]<=u&&a[0]>=u)){const t=(u-a[0])/(b[0]-a[0]);if(Number.isFinite(t))result=Math.min(result,a[1]+t*(b[1]-a[1]));}}
  return Number.isFinite(result)?result:-33.8;
}
