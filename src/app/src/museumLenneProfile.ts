import sourcePrisms from "./museumLennePrisms.json";
import museumSource from "./musicMuseumSource.json";

export const MUSEUM_LENNE_GROUP = "Museum and Lenne source-bound architecture";
export const MINECRAFT_MUSEUM_LENNE_GROUP = "Minecraft Museum and Lenne architecture";
export const MUSEUM_LENNE_SOURCE_PRISMS = sourcePrisms;
export const MUSEUM_LENNE_IDS: ReadonlySet<string> = new Set(sourcePrisms.map(p => p.id));
export const MUSIC_MUSEUM_IDS: ReadonlySet<string> = new Set([
  "zI19zSfy", "7W5aNmQ5", "rcRSiKl4", "4keChp4s", "HUDk4q9R", "zWi4z8Km", "UJwr9w5r",
  "54DZVHQd", "yISXluRg", "C63xrbXN", "duXXdDCS", "4sEwVreu", "ez443n2q", "Y99y1NiA", "K0003U6g",
]);
export const MUSIC_MUSEUM_HALL_ID = "C63xrbXN";
export const MUSIC_MUSEUM_HALL_ROOF_RISE = 2.4;
export const MUSIC_MUSEUM_PROFILE = {
  name: "Musikinstrumenten-Museum and Staatliches Institut für Musikforschung",
  osm: "way/22990151", parent: "DEBE01YYK0002Kgr", sourcePartCount: 15,
  sourceUrl: "https://www.simpk.de/museum/sammlung/geschichte.html",
  architects: "Edgar Wisniewski after plans by Hans Scharoun", opened: 1984,
  roofLightCount: 14,
  sourceStatus: "All 14 original museum prism records, the separate entrance canopy and exact official surfaces retained. Absolute NHN roof heights correct the former basement-to-street extrusion error. Fourteen full-width rooflight bands follow official DOP 2025; local rise and facade details remain display estimates.",
  referenceUrls: [
    "https://commons.wikimedia.org/wiki/File:Berlin_Musikinstrumentenmuseum_01.jpg",
    "https://commons.wikimedia.org/wiki/File:State_Institute_for_Music_Research.jpg",
  ],
} as const;

export const LENNE_TOWERS = [
  { number: 11, parent: "DEBE01YYK0002KkP", osm: "way/13760716", addressNode: "node/884695165", floors: 9,
    style: "stone-frame", tone: 0xd9d5c7, ids: ["IQ5AhecB", "7UGSsHsm", "al3juMqO", "kaSatKUT", "9nldpPdl"] },
  { number: 9, parent: "DEBE01YYK0002O4m", osm: "way/13760719", addressNode: "node/884695062", floors: 10,
    style: "stone-bays", tone: 0xd8d6ca, ids: ["4SDa70e1", "e7ZGCP2p", "FwZiNafh", "weDJUBkQ", "6lkBFSf2", "kl2VYSOS", "xGwM0tMA", "NfN5BmKa"],
    sourceUrl: "https://www.bnppre.de/gewerbeimmobilien/berlin/buero-mieten/B13790/" },
  { number: 7, parent: "DEBE01YYK0002N8w", osm: "way/13760721", addressNode: "node/884694986", floors: 10,
    style: "cms-stone", tone: 0xe3dfd1, ids: ["qQB1AGR1", "lxxhZDO8"],
    occupant: "CMS Hasche Sigle", occupantNode: "node/9706958017", sourceUrl: "https://cms.law/de/deu/office/berlin" },
  { number: 5, parent: "DEBE01YYK0002SCQ", osm: "way/13760720", addressNode: "node/884694916", floors: 10,
    style: "silver-frame", tone: 0xb8c4c1, ids: ["XM6avFqL", "FyfS3ijr", "hFNeHzwb", "uBEppUal", "XaqarDMo"],
    sourceUrl: "https://www.collignonarchitektur.com/de/projekte/lennestrasse-5" },
  { number: 3, parent: "DEBE01YYK0002TDz", osm: "way/26741679", addressNode: "node/884694818", floors: 10,
    style: "glass-bands", tone: 0xa7bbba, ids: ["iMW9gUC7", "UPG7jJKm"],
    sourceUrl: "https://www.collignonarchitektur.com/de/projekte/lennestrasse-3" },
] as const;
export const MUSEUM_LENNE_PRISM_TONES: Readonly<Record<string, number>> = Object.fromEntries([
  ...[...MUSIC_MUSEUM_IDS].map(id => [id, 0xb8b7a8]),
  ...LENNE_TOWERS.flatMap(tower => tower.ids.map(id => [id, tower.tone])),
]);
export const MUSEUM_LENNE_ROOF_TONES: Readonly<Record<string, number>> = Object.fromEntries(
  sourcePrisms.map(p => [p.id, MUSIC_MUSEUM_IDS.has(p.id) ? 0xaaa99b : 0x7c8883]),
);
export const MUSIC_MUSEUM_SOURCE = museumSource;
export const MUSIC_MUSEUM_PARTS = museumSource.parts;
export function musicMuseumPart(id: string) {
  return MUSIC_MUSEUM_PARTS.find(p => p.prism_id === id || p.id === id);
}
export const MUSIC_MUSEUM_ENTRANCE_ID = "K0003U6g";
export const MUSIC_MUSEUM_ENTRANCE_FRAME = {x:-38.9,z:940.3,dx:1.8/Math.hypot(1.8,12.7),dz:12.7/Math.hypot(1.8,12.7),length:Math.hypot(1.8,12.7)} as const;
export function musicMuseumEntranceRoofletTopAt(x:number,z:number,minecraft=false):number|null {
  const f=MUSIC_MUSEUM_ENTRANCE_FRAME,dx=x-f.x,dz=z-f.z,u=dx*f.dx+dz*f.dz,out=dx*f.dz-dz*f.dx;
  if(out<.1||out>2.55||![-4.1,0,4.1].some(du=>Math.abs(u-(f.length*.5+du))<=1.45))return null;
  return minecraft?8.24+(3-Math.min(2,Math.floor((out-.1)/(2.45/3))))*.72:8.24+(2.55-out)/2.45*2.16;
}
export function musicMuseumDisplayTop(id:string):number {
  return id===MUSIC_MUSEUM_ENTRANCE_ID?10.4:musicMuseumPart(id)?.roof_max_y_m??0;
}
export function musicMuseumEntranceCanopyWalkableAt(_x:number,y:number,_z:number,sourceId?:string):boolean {
  return sourceId===MUSIC_MUSEUM_ENTRANCE_ID && y<7.80;
}
export const MUSIC_MUSEUM_ROOF_BASE = 13.914 - MUSIC_MUSEUM_HALL_ROOF_RISE;
export const MUSIC_MUSEUM_ROOF_BANDS = { start: 910.6, pitch: 3.52, count: 14, skew: .045 } as const;
/** Existing callers retain an API, but never add basement height to street terrain. */
export function musicMuseumBodyHeight(id: string, totalHeight: number): number {
  const part = musicMuseumPart(id);
  return part ? musicMuseumFacadeTop(id, part.roof_max_y_m) - part.street_ground_y_m : totalHeight;
}
export function musicMuseumFacadeTop(id: string, fallback: number): number {
  return id === MUSIC_MUSEUM_HALL_ID ? MUSIC_MUSEUM_ROOF_BASE : musicMuseumPart(id)?.roof_min_y_m ?? fallback;
}
function inside(ring: readonly (readonly number[])[], x: number, z: number): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a=ring[i], b=ring[j];
    if ((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) yes=!yes;
  }
  return yes;
}
export function musicMuseumRoofBandCoordinate(x: number, z: number): number {
  return z - MUSIC_MUSEUM_ROOF_BANDS.skew * (x + 60);
}
/** Returns the represented height of the 14 rooflight bands; they fill the hall width. */
export function musicMuseumRoofHeightAt(x: number, z: number, minecraft = false): number | null {
  if(minecraft){x=Math.floor(x)+.5;z=Math.floor(z)+.5;}
  const hall = sourcePrisms.find(p => p.id === MUSIC_MUSEUM_HALL_ID)!;
  if (!inside(hall.ring, x*10, z*10)) return null;
  if(x+.5*(z-941)>-47)return MUSIC_MUSEUM_ROOF_BASE;
  const v=musicMuseumRoofBandCoordinate(x,z)-MUSIC_MUSEUM_ROOF_BANDS.start;
  if(v<0 || v>=MUSIC_MUSEUM_ROOF_BANDS.pitch*MUSIC_MUSEUM_ROOF_BANDS.count) return MUSIC_MUSEUM_ROOF_BASE;
  const phase=v%MUSIC_MUSEUM_ROOF_BANDS.pitch;
  if(phase<.04 || phase>MUSIC_MUSEUM_ROOF_BANDS.pitch-.04) return MUSIC_MUSEUM_ROOF_BASE;
  const t=(phase-.04)/(MUSIC_MUSEUM_ROOF_BANDS.pitch-.08);
  return MUSIC_MUSEUM_ROOF_BASE + (minecraft ? Math.min(4,Math.floor(t*4)+1)*.6 : t*2.4);
}
/** Real source roof plane, with the photographed/DOP hall rooflight supplement. */
export function musicMuseumPartRoofHeightAt(id: string, x: number, z: number, minecraft = false): number | null {
  const part=musicMuseumPart(id); if(!part) return null;
  if(part.prism_id===MUSIC_MUSEUM_HALL_ID) return musicMuseumRoofHeightAt(x,z,minecraft);
  if(minecraft && part.prism_id!==MUSIC_MUSEUM_ENTRANCE_ID){x=Math.floor(x)+.5;z=Math.floor(z)+.5;}
  let result: number | null=null;
  for(const surface of part.surfaces){
    if(surface.kind!=="RoofSurface")continue;
    const r=surface.rings[0], plan=r.map(p=>[p[0],p[2]]);
    if(!inside(plan,x,z) || surface.rings.slice(1).some(h=>inside(h.map(p=>[p[0],p[2]]),x,z)))continue;
    let nx=0,ny=0,nz=0;
    for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];nx+=(a[1]-b[1])*(a[2]+b[2]);ny+=(a[2]-b[2])*(a[0]+b[0]);nz+=(a[0]-b[0])*(a[1]+b[1]);}
    if(Math.abs(ny)<1e-8)continue;
    const a=r[0],y=a[1]-(nx*(x-a[0])+nz*(z-a[2]))/ny;
    result=Math.max(result??-Infinity,Math.min(part.roof_max_y_m,y));
  }
  if(part.prism_id===MUSIC_MUSEUM_ENTRANCE_ID && result!==null)result=Math.max(result,musicMuseumEntranceRoofletTopAt(x,z,minecraft)??-Infinity);
  return result;
}
/** Exact cell/footprint overlap also catches the museum's thin diagonal return. */
function overlapsCell(ring: readonly (readonly number[])[], x:number,z:number,half:number):boolean {
  if(inside(ring,x*10,z*10))return true;
  const loX=(x-half)*10,hiX=(x+half)*10,loZ=(z-half)*10,hiZ=(z+half)*10;
  if([[loX,loZ],[loX,hiZ],[hiX,loZ],[hiX,hiZ]].some(([a,b])=>inside(ring,a,b)))return true;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];let lo=0,hi=1;
    for(const [start,end,min,max] of [[a[0],b[0],loX,hiX],[a[1],b[1],loZ,hiZ]]){
      const d=end-start;if(Math.abs(d)<1e-9){if(start<min||start>max){lo=1;hi=0;break;}}
      else{const p=(min-start)/d,q=(max-start)/d;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));}
    }
    if(lo<=hi)return true;
  }
  return false;
}
/** Only source-owned old cells are removed; tall Philharmonie cells remain. */
export function musicMuseumReplacementColumn(x:number,z:number,lowY=0,highY=24,cell=4):boolean {
  if(x < -94 || x > -32 || z < 893 || z > 1029)return false;
  return sourcePrisms.some(p=>MUSIC_MUSEUM_IDS.has(p.id) && Math.abs(highY-lowY-Math.ceil(p.h_dm/10/cell)*cell)<=.11 && lowY <= p.y0_dm/10+.51 &&
    overlapsCell(p.ring,x,z,cell/2-.001));
}
