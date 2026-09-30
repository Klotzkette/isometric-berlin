import source from "./fernsehturmPavilionSource.json";
import { bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";

export const FERNSEHTURM_PAVILION_SOURCE = source;
export const FERNSEHTURM_PAVILION_PARTS = source.profiles.flatMap(p => p.parts);
export const FERNSEHTURM_PAVILION_PROFILE = Object.freeze({
  name: "Fernsehturm folded pavilions and open terraces",
  groundY: 5.2,
  galleryY: 12.22,
  roofThicknessM: .20,
  glazingPitchM: 2.25,
  referenceUrls: [source.heritage_url,
    "https://commons.wikimedia.org/wiki/File:Pavillon_Fernsehturm_Berlin.jpg",
    "https://commons.wikimedia.org/wiki/File:Berlin_fernsehturm_pavillon.jpg"],
  dimensionsPolicy: "Complete 2026 LoD2 envelopes; facade grids, gallery elevation and stair subdivisions are procedural display estimates.",
});
export const FERNSEHTURM_PAVILION_ENCLOSED = source.profiles.filter(p => p.display_role === "enclosed").flatMap(p => p.parts);
export const FERNSEHTURM_PAVILION_ROOFS = source.profiles.filter(p => p.display_role === "folded-roof").flatMap(p => p.parts);
export const FERNSEHTURM_PAVILION_GALLERY = source.profiles.find(p => p.display_role === "gallery")!.parts[0];
export type PavilionStair = { part: BebelplatzSourcePart; a: number[]; b: number[]; c: number[]; d: number[]; length: number; width: number; bottom: number; top: number; };
const distanceToBody = (x: number,z: number) => Math.min(...FERNSEHTURM_PAVILION_ENCLOSED.flatMap(p => p.ring.map(v => Math.hypot(x-v[0],z-v[1]))));
export const FERNSEHTURM_PAVILION_STAIRS: PavilionStair[] = source.profiles.filter(p => p.display_role === "steps").map(({parts:[part]}) => {
  const ring=part.ring;
  const edges=ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return {i,a,b,length:Math.hypot(a[0]-b[0],a[1]-b[1]),distance:distanceToBody((a[0]+b[0])/2,(a[1]+b[1])/2)};});
  // A short end touches the gallery; the opposite short end reaches the plaza.
  const max=Math.max(...edges.map(e=>e.length));
  const edge=edges.filter(e=>e.length<max*.7).sort((a,b)=>a.distance-b.distance)[0];
  const i=edge.i,a=edge.a,b=edge.b,c=ring[(i+2)%4],d=ring[(i+3)%4];
  return {part,a,b,c,d,length:(Math.hypot(a[0]-d[0],a[1]-d[1])+Math.hypot(b[0]-c[0],b[1]-c[1]))/2,width:edge.length,bottom:5.28,top:FERNSEHTURM_PAVILION_PROFILE.galleryY};
});
export function fernsehturmPavilionStairHeight(s: PavilionStair,x:number,z:number):number|null {
  if(!bebelplatzPartContains(s.part,x,z))return null;
  const ax=(s.a[0]+s.b[0])/2,az=(s.a[1]+s.b[1])/2,bx=(s.c[0]+s.d[0])/2,bz=(s.c[1]+s.d[1])/2;
  const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
  const count=Math.ceil((s.top-s.bottom)/.18);
  return s.bottom+Math.ceil((1-t)*count)/count*(s.top-s.bottom);
}
function nearby(x:number,z:number):boolean{return x>2490&&x<2650&&z>-220&&z<-60;}
export function fernsehturmPavilionSupportHeightAt(x:number,z:number,y:number,maxStep=.4):number|null {
  if(!nearby(x,z))return null;
  for(const s of FERNSEHTURM_PAVILION_STAIRS){const h=fernsehturmPavilionStairHeight(s,x,z);if(h!==null&&h<=y+maxStep)return h;}
  const h=FERNSEHTURM_PAVILION_PROFILE.galleryY;
  return h<=y+maxStep&&bebelplatzPartContains(FERNSEHTURM_PAVILION_GALLERY,x,z)?h:null;
}
export function fernsehturmPavilionSolidAt(x:number,z:number,y:number,radius=0):boolean {
  if(!nearby(x,z)||y<5.2||y>24.3)return false;
  const samples=[[x,z],[x-radius,z],[x+radius,z],[x,z-radius],[x,z+radius]];
  for(const [sx,sz] of samples){
    for(const p of FERNSEHTURM_PAVILION_ENCLOSED){
      // The narrow elevated entrance bridge remains open underneath.
      const min=p.id==="DEBE3DltuFr02ehH"?11.85:5.2;
      const top=bebelplatzPartRoofAt(p,sx,sz);
      if(top!==null&&y>=min&&y<top-.001)return true;
    }
    for(const p of FERNSEHTURM_PAVILION_ROOFS){const top=bebelplatzPartRoofAt(p,sx,sz);if(top!==null&&Math.abs(y-top)<.16)return true;}
  }
  return false;
}
