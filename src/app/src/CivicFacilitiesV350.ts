/** Source-wall facility recognition; compact recipes expand only for admitted hosts. */
import type { SourceQuarterCatalogueEntryV309 } from './SourceQuarterCatalogueV309';
import type { NeighbourhoodPlanV300, NeighbourhoodSourceV300 } from './NeighbourhoodPacketV300';
import type { SurroundingPackedMesh } from './SurroundingCityGeometry';
import index from './data/civicFacilitiesV350Index.json';

export const CIVIC_FACILITIES_KIND_V350 = 'civic-facilities-v350';
// Original geometric bitmap lettering, not copied sign artwork or a font texture.
const GLYPHS: Record<string, string> = {
 A:'010101111101101',B:'110101110101110',C:'111100100100111',D:'110101101101110',E:'111100110100111',
 F:'111100110100100',G:'111100101101111',H:'101101111101101',I:'111010010010111',J:'001001001101111',
 K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'101111111111101',O:'111101101101111',
 P:'110101110100100',Q:'111101101111001',R:'110101110101101',S:'111100111001111',T:'111010010010010',
 U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',
 Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001111100111','3':'110001010001110',
 '4':'101101111001001','5':'111100110001110','6':'111100111101111','7':'111001010010010','8':'111101111101111',
 '9':'111101111001111','-':'000000111000000','+':'000010111010000','.':'000000000000010',' ':'000000000000000',
};
const CATEGORIES = ['GRUNDSCHULE','KITA','APOTHEKE'];
export type CivicPlateV350 = [number,number,number,number,number,number,number,number,number,string];
type CompactPlan = Omit<NeighbourhoodPlanV300,'append'|'appendFingerprint'> & {plates:CivicPlateV350[];facilityIds:string[]};
export type CivicCompactSourceV350 = {schemaVersion:1;keys:string[];packets:Record<string,CompactPlan>};
const linear = (value:number) => Math.round((value<=10.31475?value/255/12.92:((value/255+.055)/1.055)**2.4)*255);
const PAPER=[220,222,213].map(linear), INK=[48,60,64].map(linear), RED=[164,40,42].map(linear);
export function civicLabelV350(value:string):string {
 return value.replace(/ß/g,'SS').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 .+-]/g,' ').replace(/\s+/g,' ').trim().slice(0,26);
}
function encoded(bytes:Uint8Array):string {
 let text='';for(let at=0;at<bytes.length;at+=8192)text+=String.fromCharCode(...bytes.subarray(at,at+8192));return btoa(text);
}
function fingerprint(part:SurroundingPackedMesh):number {
 let h=2166136261;for(const text of [part.positions,part.colors,part.indices])for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;return h;
}
export function civicPlateMeshV350(plates:readonly CivicPlateV350[],native=false):SurroundingPackedMesh {
 if(plates.length>64)throw Error('Civic facility host exceeds finite measured plate allowance');
 const positions:number[]=[],colours:number[]=[],indices:number[]=[];
 for(const row of plates){
  const [x,y,z,dx,dz,nx,nz,width,category,name]=row;
  if(row.length!==10||row.slice(0,9).some(n=>typeof n!=='number'||!Number.isFinite(n))||![0,1,2].includes(category)||width<120||width>300||typeof name!=='string'||name.length>26)throw Error('Invalid civic source-wall plate');
  if(Math.abs(Math.hypot(dx,dz)-1e6)>2||Math.abs(Math.hypot(nx,nz)-1e6)>2||Math.abs(dx*nx+dz*nz)>2e6||native&&(![0,1e6,-1e6].includes(dx)||![0,1e6,-1e6].includes(dz)))throw Error('Unsupported civic source-wall direction');
  const quad=(u0:number,v0:number,u1:number,v1:number,depth:number,rgb:number[])=>{
   const start=positions.length/3;
   for(const [u,v]of[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]){
    const p=[x+(dx*u+nx*depth)/1e6,y+v,z+(dz*u+nz*depth)/1e6].map(Math.round);
    if(p.some(n=>n<0||n>65535))throw Error('Civic plate escaped exact packet centimetres');
    positions.push(...p);colours.push(...rgb);
   }
   if(dx*nz-dz*nx>0)indices.push(start,start+1,start+2,start,start+2,start+3);
   else indices.push(start,start+2,start+1,start,start+3,start+2);
  };
  quad(-width/2,-18,width/2,18,5,PAPER);
  const text=(value:string,baseY:number,pitch:number,rgb:number[])=>{
   const total=(value.length*4-1)*pitch;
   for(let c=0;c<value.length;c++){
    const bits=GLYPHS[value[c]]??GLYPHS[' '];
    // Consecutive lit columns share a single quad, reducing packet work.
    for(let r=0;r<5;r++)for(let col=0;col<3;){
     if(bits[r*3+col]!=='1'){col++;continue;}const from=col;while(col<3&&bits[r*3+col]==='1')col++;
     const u=-total/2+(c*4+from)*pitch,v=baseY+(4-r)*pitch;
     quad(u,v,u+(col-from)*pitch-.4,v+pitch-.4,7,rgb);
    }
   }
  };
  const title=CATEGORIES[category];text(title,2,Math.min(2.6,(width-12)/(title.length*4-1)),category===2?RED:INK);
  const label=civicLabelV350(name);if(label)text(label,-13,Math.min(2,(width-12)/(label.length*4-1)),INK);
 }
 return {kind:CIVIC_FACILITIES_KIND_V350,positionType:'u16cm',positions:encoded(new Uint8Array(new Uint16Array(positions).buffer)),colors:encoded(new Uint8Array(colours)),indices:encoded(new Uint8Array(new Uint32Array(indices).buffer))};
}
/** Only compact words remain strongly held; expanded binary plans can retire. */
export function civicFacilitySourceV350(compact:CivicCompactSourceV350):NeighbourhoodSourceV300 {
 if(compact.schemaVersion!==1||compact.keys.length>32||new Set(compact.keys).size!==compact.keys.length||Object.keys(compact.packets).length!==compact.keys.length)throw Error('Incomplete civic facility recipe');
 const packets:Record<string,NeighbourhoodPlanV300>={};
 for(const key of compact.keys){
  const source=compact.packets[key];if(!source||source.retire.length||!source.plates.length)throw Error('Civic facility recipe may only append supported plates');
  let cached:WeakRef<NeighbourhoodPlanV300>|undefined;
  Object.defineProperty(packets,key,{enumerable:true,get(){
   const previous=cached?.deref();if(previous)return previous;
   const {plates,facilityIds:_facilityIds,...guards}=source;
   const append=civicPlateMeshV350(plates,key.startsWith('minecraft:'));
   const plan={...guards,append,appendFingerprint:fingerprint(append)};
   cached=new WeakRef(plan);return plan;
  }});
 }
 return {schemaVersion:1,keys:compact.keys.slice(),packets};
}
let loaders:Record<string,()=>Promise<unknown>>={};
try{loaders=import.meta.glob('./data/civicFacilitiesV350Packets*.json');}catch{/* Fixture runner reads identical compact source. */}
export const civicFacilitiesEntriesV350:SourceQuarterCatalogueEntryV309[]=index.sources.map(({file,keys})=>({
 kind:CIVIC_FACILITIES_KIND_V350,keys,
 load:async()=>{
  const path='./data/'+file,loader=loaders[path];
  const module=await(loader?loader():import(/* @vite-ignore */path)) as {default:CivicCompactSourceV350};
  return {default:civicFacilitySourceV350(module.default)};
 },
}));
