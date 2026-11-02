import data from './data/parliamentaryDiningV296.json';
import type {HbfBoxV291,HbfOpeningV291,HbfPlaneV291} from './HbfGeometryOpeningsV291';
export type DiningPrismV296={id:string;ring:number[][];holes?:number[][][];y0_dm:number;h_dm:number};
export const PARLIAMENTARY_DINING_V296={
 lampenladen:{cx:326.1,cz:-100.7,radius:14.2,floor:4.24,ceiling:7.08,cutRadius:15.5,sourceIds:['awyoe6EJ','U3jAipsY','EoqE0lzF','TAXdTj4D']},
 marie:{room:[383.85,401.6,-175.8,-153.5],floor:.65,upper:4.15,ceiling:7.3,terrace:[376.8,383.85,-175.8,-153.5],sourceIds:['RdNEzXe9','11351098']},
 sourceStatus:'Published venue identities/forms; local room fit, vertical levels, furniture and small lamp geometry are labelled display estimates, not surveyed internal plans.',
 textureFree:true,fullStaticDetailOnTouch:true,maxNativeInstances:17000,maxDrawnInstances:6000,maxGpuBytes:1800000,
 sources:['https://www.bundestag.de/besuche/kunst/kuenstler/pardo/pardo-199012','https://www.bundestag.de/resource/blob/885866/0ffe70b550864744f5d2f25a78044f7a/flyer.pdf','https://marieimbundestag.de/','https://www.kusus-architekten.de/berlin/projekte/marie-elisabeth-lueders-haus/bistro.php','https://www.das-parlament.de/epaper/2025/38/epaper/ausgabe.pdf'],
} as const;
const L=PARLIAMENTARY_DINING_V296.lampenladen,M=PARLIAMENTARY_DINING_V296.marie;
const originals=new Map(data.originalPrisms.map(p=>[p.id,p]));
function same(a:unknown,b:unknown):boolean{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>,keys=Object.keys(aa);return keys.length===Object.keys(bb).length&&keys.every(k=>Object.hasOwn(bb,k)&&same(aa[k],bb[k]));}
export function diningOriginalPrismV296(p:DiningPrismV296):boolean{return same(p,originals.get(p.id));}
function box(id:string,min:[number,number,number],max:[number,number,number]):HbfOpeningV291{const planes:HbfPlaneV291[]=[[1,0,0,-min[0]],[-1,0,0,max[0]],[0,1,0,-min[1]],[0,-1,0,max[1]],[0,0,1,-min[2]],[0,0,-1,max[2]]];return{id,bounds:{min,max},planes,nativeBoxes:[{min,max}]};}
const cylinderPlanes:HbfPlaneV291[]=[[0,1,0,-4.22],[0,-1,0,7.09]];
for(let i=0;i<48;i++){const a=i*Math.PI/24,nx=Math.cos(a),nz=Math.sin(a);cylinderPlanes.push([-nx,0,-nz,L.cutRadius+nx*L.cx+nz*L.cz]);}
const lampCut:HbfOpeningV291={id:'pardo-actual-round-ground-floor',bounds:{min:[L.cx-L.cutRadius,4.22,L.cz-L.cutRadius],max:[L.cx+L.cutRadius,7.09,L.cz+L.cutRadius]},planes:cylinderPlanes};
const marieCut=box('marie-source-first-floor-glazing',[378.8,.57,-175.9],[402,7.31,-153.4]);
export const DINING_OPENINGS_V296={lampenladen:[lampCut],marie:[marieCut]} as const;
export const DINING_AUTHORED_OPENINGS_V296:readonly HbfOpeningV291[]=[lampCut,marieCut];
export const DINING_GROUND_OPENINGS_V296:readonly HbfOpeningV291[]=[box('marie-complete-lower-room-and-terrace',[376.7,.57,-175.9],[402,4.12,-153.4])];
/** Default closed. Only exact retained source objects and a fully built room enable these cuts. */
export function diningSourceOpeningsV296(p:DiningPrismV296,enabled=false):readonly HbfOpeningV291[]{if(!enabled||!diningOriginalPrismV296(p))return[];return (L.sourceIds as readonly string[]).includes(p.id)?DINING_OPENINGS_V296.lampenladen:DINING_OPENINGS_V296.marie;}
function inRing(r:number[][],x:number,z:number):boolean{let v=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if(((r[i][1]>z)!==(r[j][1]>z))&&(x<(r[j][0]-r[i][0])*(z-r[i][1])/(r[j][1]-r[i][1])+r[i][0]))v=!v;return v;}
function segmentHitsBox(a:number[],b:number[],minX:number,minZ:number,maxX:number,maxZ:number):boolean{let lo=0,hi=1;for(const[axis,min,max]of[[0,minX,maxX],[1,minZ,maxZ]]){const d=b[axis]-a[axis];if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max)return false;continue;}const x=(min-a[axis])/d,y=(max-a[axis])/d;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}return lo<hi-1e-9;}
function overlapsCell(p:DiningPrismV296,x:number,z:number):boolean{const minX=x*40+.0001,minZ=z*40+.0001,maxX=(x+1)*40-.0001,maxZ=(z+1)*40-.0001;if([[minX,minZ],[minX,maxZ],[maxX,minZ],[maxX,maxZ]].some(q=>inRing(p.ring,...q as[number,number])))return true;return p.ring.some((a,i)=>(a[0]>minX&&a[0]<maxX&&a[1]>minZ&&a[1]<maxZ)||segmentHitsBox(a,p.ring[(i+1)%p.ring.length],minX,minZ,maxX,maxZ));}
/** Full-cell exclusive receipts guard the original voxel columns, with all upper/outside fragments retained. */
export function createDiningColumnOpeningsV296(prisms:readonly DiningPrismV296[],cellM=4,enabled=false):(xi:number,zi:number,bottomDm:number,topDm:number,kind:number)=>readonly HbfOpeningV291[]{
 if(!enabled||cellM!==4||!data.originalPrisms.every(p=>prisms.some(q=>q.id===p.id&&diningOriginalPrismV296(q))))return()=>[];
 const known=new Set(data.originalPrisms.map(p=>p.id));const rows=new Map(data.nativeColumns.filter(c=>c.exclusiveFullCell).map(c=>[c.row.join(','),c]));
 return(x,z,b,t,k)=>{const row=rows.get([x,z,b,t,k].join(','));if(!row)return[];if(prisms.some(p=>!known.has(p.id)&&p.y0_dm<t&&p.y0_dm+p.h_dm>b&&overlapsCell(p,x,z)))return[];const cx=(x+.5)*4,cz=(z+.5)*4;const cut=Math.hypot(cx-L.cx,cz-L.cz)<L.cutRadius+2.9?box('exclusive-native-pardo-first-floor',[x*4,4.22,z*4],[(x+1)*4,7.09,(z+1)*4]):marieCut;return[cut];};
}
export function diningFloorAtV296(x:number,z:number,feetY:number,fallback:number):number{
 if(x>=376.9&&x<=379.1&&z<=-160.4&&z>=-165.6){const y=M.floor+Math.min(20,Math.ceil((-160.4-z)/.26))*(M.upper-M.floor)/20;if(feetY>=y-.5)return y;}

 if(Math.hypot(x-L.cx,z-L.cz)<L.radius)return feetY>=L.floor-.5?L.floor:fallback;
 if(x<M.room[0]||x>M.room[1]||z<M.room[2]||z>M.room[3]){
  if(x<M.terrace[0]||x>M.terrace[1]||z<M.terrace[2]||z>M.terrace[3])return fallback;
 }
 // The southern upper half has a balcony slab; lower visitors remain beneath it.
 return z< -165.6&&feetY>=M.upper-.5?M.upper:feetY>=M.floor-.5?M.floor:fallback;
}
export function diningOpeningContainsV296(x:number,y:number,z:number):boolean{return DINING_AUTHORED_OPENINGS_V296.some(c=>c.planes.every(p=>p[0]*x+p[1]*y+p[2]*z+p[3]>=-1e-8));}
export function diningNativeBoxFragmentsV296(box:HbfBoxV291,cuts:readonly HbfOpeningV291[]):HbfBoxV291[]{
 // Expose to root without importing any model or Three renderer into navigation.
 let parts=[box];for(const cut of cuts)for(const c of cut.nativeBoxes??[]){const next:HbfBoxV291[]=[];for(const p of parts){if(p.min.some((v,i)=>v>=c.max[i]||p.max[i]<=c.min[i])){next.push(p);continue;}const lo=p.min.map((v,i)=>Math.max(v,c.min[i])),hi=p.max.map((v,i)=>Math.min(v,c.max[i]));const min=[...p.min],max=[...p.max];for(let i=0;i<3;i++){if(min[i]<lo[i]){const end=[...max];end[i]=lo[i];next.push({min:[...min]as[number,number,number],max:end as[number,number,number]});min[i]=lo[i];}if(max[i]>hi[i]){const begin=[...min];begin[i]=hi[i];next.push({min:begin as[number,number,number],max:[...max]as[number,number,number]});max[i]=hi[i];}}}parts=next;}return parts;
}

const DINING_TABLE_COLLISION_V296=(()=>{
 const tables:{x:number;z:number;y:number;r:number}[]=[];
 for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++)if((ix!==0||iz!==0)&&Math.hypot(ix*4.2,iz*4.2)<=10.7)tables.push({x:L.cx+ix*4.2,z:L.cz+iz*4.2,y:L.floor,r:.63});
 for(const floor of[M.floor,M.upper])for(const zz of floor===M.floor?[-172.3,-168.2,-160.1,-155.8]:[-172.6,-168.7])for(const xx of[388,394.5])tables.push({x:xx,z:zz,y:floor,r:.52});
 for(const[zz,floor]of[[-172.4,M.floor],[-168.6,M.floor],[-160,M.floor],[-155.8,M.floor],[-172.4,M.upper],[-168.6,M.upper]])tables.push({x:380.5,z:zz,y:floor,r:.51});
 return tables;
})();
/** The represented upper floor/terrace and room ceiling slabs. Coordinates
 * match the authored slab faces; strict top/bottom tests leave a visitor who
 * stands on a slab top clear. The caller may supply height=0 for body samples. */
const DINING_HORIZONTAL_SLABS_V296:readonly (readonly [number,number,number,number,number,number])[]=[
 [M.room[0],M.room[1],M.room[2],M.room[3],M.ceiling,M.ceiling+.16],
 [M.room[0],M.room[1],M.room[2],-165.6,M.upper-.16,M.upper],
 [M.terrace[0],M.terrace[1],M.terrace[2],-165.6,M.upper-.20,M.upper],
];
/** Navigation follows represented room slabs, table/chair solids and glazing gaps. */
export function diningSolidAtV296(x:number,z:number,feetY:number,height=1.8,radius=.28):boolean {
 if(x<310||x>403||z< -177||z> -85)return false;
 const rr=Math.hypot(x-L.cx,z-L.cz);
 if(rr<L.radius+radius&&feetY<L.ceiling+.10&&feetY+height>L.ceiling)return true;
 for(const[x0,x1,z0,z1,bottom,top]of DINING_HORIZONTAL_SLABS_V296){
  if(feetY>=top||feetY+height<=bottom)continue;
  const dx=Math.max(x0-x,0,x-x1),dz=Math.max(z0-z,0,z-z1);
  if(dx*dx+dz*dz<=radius*radius)return true;
 }
 const angle=(Math.atan2(z-L.cz,x-L.cx)+Math.PI*2)%(Math.PI*2),sector=Math.floor(angle/(Math.PI*2)*48);
 if(Math.abs(rr-L.radius)<radius+.08&&feetY<L.ceiling&&feetY+height>L.floor&&sector!==0&&sector!==23)return true;
 if(Math.abs(x-M.room[0])<radius+.05&&z>M.room[2]&&z<M.room[3]&&feetY<M.ceiling&&feetY+height>M.floor){const bay=Math.floor((z-M.room[2])/(M.room[3]-M.room[2])*10);if(bay!==6)return true;}
 if(x>=M.room[0]&&x<=M.room[1]&&feetY<M.ceiling&&feetY+height>M.floor&&(Math.abs(z-M.room[2])<radius+.06||Math.abs(z-M.room[3])<radius+.06))return true;
 for(const t of DINING_TABLE_COLLISION_V296){if(feetY>t.y+.95||feetY+height<t.y+.1)continue;if(Math.hypot(x-t.x,z-t.z)<t.r+radius)return true;for(let i=0;i<3;i++){const a=i*Math.PI*2/3,cx=t.x+Math.cos(a)*(t.r+.5),cz=t.z+Math.sin(a)*(t.r+.5);if(Math.hypot(x-cx,z-cz)<.28+radius)return true;}}
 return false;
}
