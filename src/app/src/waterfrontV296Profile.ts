import type { HbfOpeningV291,HbfBoxV291,HbfPlaneV291 } from './HbfGeometryOpeningsV291';
import source from "./data/waterfrontV296.json";

type Point = readonly [number, number];
export type WaterfrontNodeV296 = readonly [number, number, number];
export type WaterfrontRouteV296 = { id: string; width: number; surface: "asphalt"|"paving_stones"; nodes: readonly WaterfrontNodeV296[] };
const bridge = source.roads.find(r => r.id === "15405394")!.points;
const dx = bridge[1][0] - bridge[0][0], dz = bridge[1][1] - bridge[0][1];
const length = Math.hypot(dx, dz);
export const GUSTAV_ALIGNMENT_V296 = {
  sourceWay: "15405394", sourceEndpoints: bridge,
  centre: [(bridge[0][0] + bridge[1][0]) / 2, (bridge[0][1] + bridge[1][1]) / 2] as [number, number],
  axis: [dx / length, dz / length] as [number, number],
  sourceLength: length, inventoryLength: 87.76,
  // Retained ground-context deck4.25 + the existing terminal flat-plate rise.
  // This is an alignment datum, not a new elevation survey.
  endTop: 4.25024661330135,
  panoramaJunction: [-38.07, -398.56] as Point,
  oldPanoramaBaseAtJunction: 7.0260736656373926,
  heightFitRadius: 26,
  status: "Exact retained OSM centreline; short terminal joints and bounded matching heights are display estimates",
} as const;

/** Correct only the old illustrative upper-height fit near the actual junction.
 * All source XZ nodes, the lower route and the far profile remain unchanged. */
export function gustavPanoramaBaseV296(x: number, z: number, previous: number): number {
  const p = GUSTAV_ALIGNMENT_V296;
  const distance = Math.hypot(x - p.panoramaJunction[0], z - p.panoramaJunction[1]);
  if (distance >= p.heightFitRadius) return previous;
  const w = (1 - distance / p.heightFitRadius) ** 2;
  return previous + (p.endTop - .11 - p.oldPanoramaBaseAtJunction) * w;
}

type Section = { left: [number,number,number]; right: [number,number,number]; centre: [number,number,number] };
/** The refitted sloping junction keeps the original source centreline as a
 * triangle edge. Outside that finite fit retain the old triangle topology. */
export function gustavPathTrianglesV296(a: Section, b: Section, upper: boolean): number[][][] {
  const p=GUSTAV_ALIGNMENT_V296;
  const distance=(q:Section)=>Math.hypot(q.centre[0]-p.panoramaJunction[0],q.centre[2]-p.panoramaJunction[1]);
  return upper && Math.min(distance(a),distance(b))<p.heightFitRadius
    ? [[a.left,b.left,b.centre],[a.left,b.centre,a.centre],[a.centre,b.centre,b.right],[a.centre,b.right,a.right]]
    : [[a.left,b.left,b.right],[a.left,b.right,a.right]];
}

function route(id: string, heights: readonly number[], width: number): WaterfrontRouteV296 {
  const points = source.roads.find(r => r.id === id)!.points;
  if (points.length !== heights.length) throw new Error("Incomplete waterfront source height fit");
  return { id, width, surface: "paving_stones", nodes: points.map((p, i) => [p[0], heights[i], p[1]]) };
}
const p = GUSTAV_ALIGNMENT_V296;
const modelSouth: WaterfrontNodeV296 = [p.centre[0] + p.axis[0] * p.inventoryLength / 2, p.endTop, p.centre[1] + p.axis[1] * p.inventoryLength / 2];
const southFootway=source.roads.find(r=>r.id==="1127988519")!.points;
const southEndZ=-383.09,southEndX=southFootway[0][0]+(southFootway[1][0]-southFootway[0][0])*(southEndZ-southFootway[0][1])/(southFootway[1][1]-southFootway[0][1]);
export const WATERFRONT_ROUTES_V296: readonly WaterfrontRouteV296[] = [
  { id: "gustav-south-terminal", width: 5, surface: "asphalt", nodes: [modelSouth, [bridge[1][0], p.endTop, bridge[1][1]], [-38.07, p.endTop, -398.56], [southFootway[0][0], 4.95, southFootway[0][1]], [southEndX, 6.185, southEndZ]] },
  // Original OSM nodes; lower quayside and continuous rise of the mapped
  // transverse footway beside HumboldtHafenEins toward Alexanderufer/Futurium.
  route("4592740", [1.99, 1.99, 1.99], 3.4),
  route("1348082755", [4.49, 3.78, 1.99], 3.4),
  // Meet the retained Hugo-Preuß south footway/deck at its actual displayed
  // top. This is a height match to existing geometry, not an altitude survey.
  route("497648062", [1.99, 5.407888889312744], 3.1),
];

type V3=[number,number,number];
export type WaterfrontTriangleV296=readonly [V3,V3,V3];
/** Shared full-width sections retain every source node and close bent joints. */
function trianglesForRoute(route:WaterfrontRouteV296):WaterfrontTriangleV296[]{
 const sections=route.nodes.map((p,i)=>{const a=route.nodes[Math.max(0,i-1)],b=route.nodes[Math.min(route.nodes.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1,nx=-dz/len*route.width/2,nz=dx/len*route.width/2;return{c:[...p]as V3,l:[p[0]+nx,p[1],p[2]+nz]as V3,r:[p[0]-nx,p[1],p[2]-nz]as V3};});
 const out:WaterfrontTriangleV296[]=[];for(let i=1;i<sections.length;i++){const a=sections[i-1],b=sections[i];out.push([a.l,b.l,b.c],[a.l,b.c,a.c],[a.c,b.c,b.r],[a.c,b.r,a.r]);}
 // A 1-mm end overlap absorbs Float32 representation of shared source
 // endpoints. Every exact source centre remains present; no visible gap or
 // unsupported endpoint is introduced by GPU rounding.
 for(const i of[0,sections.length-1]){const a=sections[i],b=sections[i===0?1:i-1],dx=a.c[0]-b.c[0],dz=a.c[2]-b.c[2],length=Math.hypot(dx,dz),extend=(q:V3):V3=>[q[0]+dx/length*.001,q[1],q[2]+dz/length*.001],l=extend(a.l),r=extend(a.r);out.push([a.l,l,a.c],[a.c,l,r],[a.c,r,a.r]);}
 return out;
}
const trianglesById=new Map(WATERFRONT_ROUTES_V296.map(r=>[r.id,trianglesForRoute(r)]));
export function waterfrontRouteTrianglesV296(route:WaterfrontRouteV296):readonly WaterfrontTriangleV296[]{return trianglesById.get(route.id)??[];}
function triangleY(t:WaterfrontTriangleV296,x:number,z:number):number|null{const[a,b,c]=t,dx=b[0]-a[0],dz=b[2]-a[2],ex=c[0]-a[0],ez=c[2]-a[2],den=dx*ez-dz*ex;if(Math.abs(den)<1e-10)return null;const u=((x-a[0])*ez-(z-a[2])*ex)/den,v=(dx*(z-a[2])-dz*(x-a[0]))/den;return u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8?a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]):null;}
export function waterfrontRouteSampleV296(route:WaterfrontRouteV296,x:number,z:number):{y:number;distance:number}|null{
 let height:number|null=null;for(const t of waterfrontRouteTrianglesV296(route)){const y=triangleY(t,x,z);if(y!==null)height=height===null?y:Math.max(height,y);}if(height===null)return null;
 let distance=Infinity;for(let i=1;i<route.nodes.length;i++){const a=route.nodes[i-1],b=route.nodes[i],dx=b[0]-a[0],dz=b[2]-a[2],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz)));distance=Math.min(distance,Math.hypot(x-a[0]-dx*u,z-a[2]-dz*u));}return{y:height,distance};
}
export const WATERFRONT_NATIVE_STEP_V296=.5;
function clipCell(triangle:WaterfrontTriangleV296,x0:number,z0:number,size:number):V3[]{let polygon=triangle.map(v=>[...v]as V3);for(const[axis,value,sign]of[[0,x0,1],[0,x0+size,-1],[2,z0,1],[2,z0+size,-1]]){const out:V3[]=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;if(da>=-1e-9)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t)as V3);}}polygon=out;if(!polygon.length)break;}return polygon;}
export type WaterfrontCellV296={x:number;y:number;z:number;size:number;surface:WaterfrontRouteV296["surface"]};
const nativeCells=new Map<string,WaterfrontCellV296>();
for(const route of WATERFRONT_ROUTES_V296)for(const t of waterfrontRouteTrianglesV296(route)){const s=WATERFRONT_NATIVE_STEP_V296,x0=Math.floor(Math.min(...t.map(v=>v[0]))/s),x1=Math.floor(Math.max(...t.map(v=>v[0]))/s),z0=Math.floor(Math.min(...t.map(v=>v[2]))/s),z1=Math.floor(Math.max(...t.map(v=>v[2]))/s);for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){const poly=clipCell(t,ix*s,iz*s,s);let area=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];area+=a[0]*b[2]-b[0]*a[2];}if(Math.abs(area)<1e-9)continue;const y=poly.reduce((v,p)=>v+p[1],0)/poly.length,key=ix+':'+iz;if((nativeCells.get(key)?.y??-Infinity)>=y)continue;nativeCells.set(key,{x:(ix+.5)*s,y,z:(iz+.5)*s,size:s,surface:route.surface});}}
export function waterfrontNativeCellsV296():readonly WaterfrontCellV296[]{return [...nativeCells.values()];}
export function waterfrontGroundAtV296(x:number,z:number,native=false):number|null{
 if(x< -45||x>175||z< -648||z> -380)return null;
 if(native){const s=WATERFRONT_NATIVE_STEP_V296;return nativeCells.get(Math.floor(x/s)+':'+Math.floor(z/s))?.y??null;}
 let y:number|null=null;for(const route of WATERFRONT_ROUTES_V296){const q=waterfrontRouteSampleV296(route,x,z);if(q)y=y===null?q.y:Math.max(y,q.y);}return y;
}
/** Exact slope-aware triangle prisms only above the complete new paving.
 * No broad raster cell or river level is removed; source outside fragments stay. */
function triangleOpening(t:WaterfrontTriangleV296,id:string):HbfOpeningV291{
 const[a,b,c]=t,dx=b[0]-a[0],dz=b[2]-a[2],ex=c[0]-a[0],ez=c[2]-a[2],den=dx*ez-dz*ex,ay=((b[1]-a[1])*ez-(c[1]-a[1])*dz)/den,az=(dx*(c[1]-a[1])-ex*(b[1]-a[1]))/den,base=a[1]-ay*a[0]-az*a[2],sign=den>0?1:-1,planes:HbfPlaneV291[]=[];
 for(const[p,q]of[[a,b],[b,c],[c,a]]){const x=q[0]-p[0],z=q[2]-p[2];planes.push([-z*sign,0,x*sign,(z*p[0]-x*p[2])*sign]);}planes.push([-ay,1,-az,.13-base],[0,-1,0,Math.max(a[1],b[1],c[1])+3]);
 const bounds:HbfBoxV291={min:[Math.min(a[0],b[0],c[0]),Math.min(a[1],b[1],c[1])-.13,Math.min(a[2],b[2],c[2])],max:[Math.max(a[0],b[0],c[0]),Math.max(a[1],b[1],c[1])+3,Math.max(a[2],b[2],c[2])]};
 const nativeBoxes:HbfBoxV291[]=[];const s=WATERFRONT_NATIVE_STEP_V296;for(const cell of nativeCells.values()){if(cell.x+s/2<bounds.min[0]||cell.x-s/2>bounds.max[0]||cell.z+s/2<bounds.min[2]||cell.z-s/2>bounds.max[2])continue;const poly=clipCell(t,cell.x-s/2,cell.z-s/2,s);let area=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];area+=a[0]*b[2]-b[0]*a[2];}if(Math.abs(area)>1e-9)nativeBoxes.push({min:[cell.x-s/2,cell.y-.13,cell.z-s/2],max:[cell.x+s/2,cell.y+3,cell.z+s/2]});}
 // Bounds are broad-phase only. Include the independent native coverage;
 // drawn clipping still uses the exact triangle planes above.
 const expandedMin:[number,number,number]=[...bounds.min],expandedMax:[number,number,number]=[...bounds.max];
 for(const b of nativeBoxes)for(let i=0;i<3;i++){expandedMin[i]=Math.min(expandedMin[i],b.min[i]);expandedMax[i]=Math.max(expandedMax[i],b.max[i]);}
 return{id,planes,bounds:{min:expandedMin,max:expandedMax},nativeBoxes};
}
export const WATERFRONT_GROUND_OPENINGS_V296:readonly HbfOpeningV291[]=WATERFRONT_ROUTES_V296.flatMap(route=>waterfrontRouteTrianglesV296(route).filter(t=>Math.abs((t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]))>1e-8).map((t,i)=>triangleOpening(t,route.id+':'+i)));
export function waterfrontGroundOpeningsV296(enabled=false):readonly HbfOpeningV291[]{return enabled?WATERFRONT_GROUND_OPENINGS_V296:[];}

/** The source5m north/south footway opens the rail on both sides of the
 * Panoramaweg. It changes no deck, support below it or unrelated railing. */
export const GUSTAV_RAIL_OPENING_V296 = {
  id: "gustav-actual-panorama-junction", bounds: { min: [-41.15, 3.5, -402] as [number, number, number], max: [-35.0, 9, -394.2] as [number, number, number] },
  planes: [[1,0,0,41.15],[-1,0,0,-35],[0,1,0,-3.5],[0,-1,0,9],[0,0,1,402],[0,0,-1,-394.2]] as [number,number,number,number][],
};


/** Complete retained source receipt for the documented public HHE arcade.
 * The narrow path air is a subset of its documented two-storey arcade;
 * its eight-metre clearance is an explicitly estimated display fit;
 * its unsurveyed absolute fit follows the existing local quay datum. */
export const WATERFRONT_ARCADE_RECEIPT_V296 = {"prism":{"id":"eGZXjFeA","ring":[[1196,-5430],[1544,-5424],[1539,-5151],[1426,-5183],[1254,-5224],[1080,-5255],[956,-5272],[959,-5458],[1196,-5453]],"holes":[],"y0_dm":34,"h_dm":347,"class":1,"roof":5000,"tone":[65,70,68]},"columns":[{"row":[24,-136,17,377,4],"owners":["eGZXjFeA"],"exclusive":true,"exclusiveFullCell":true},{"row":[25,-136,18,378,4],"owners":["eGZXjFeA"],"exclusive":true,"exclusiveFullCell":true},{"row":[24,-135,17,377,4],"owners":["eGZXjFeA"],"exclusive":true,"exclusiveFullCell":true},{"row":[25,-135,18,378,4],"owners":["eGZXjFeA"],"exclusive":true,"exclusiveFullCell":true},{"row":[24,-134,17,377,4],"owners":["eGZXjFeA"],"exclusive":true,"exclusiveFullCell":true},{"row":[25,-134,18,378,4],"owners":["eGZXjFeA"],"exclusive":true,"exclusiveFullCell":true},{"row":[24,-133,17,377,4],"owners":["eGZXjFeA"],"exclusive":true,"exclusiveFullCell":true},{"row":[25,-133,19,379,4],"owners":["eGZXjFeA"],"exclusive":true,"exclusiveFullCell":true}],"sha256":{"lod2-prisms.json":"b56a8c157faa2d3df2a90c225e0819712d1261996025fcb2cece1b9cb41f602e","minecraft-voxels.json":"343499436d39a1012be687f5ab26782acdc04030d41e32e758d0eea058b059ce"}} as const;
export type WaterfrontPrismV296={id:string;ring:readonly (readonly number[])[];holes?:readonly (readonly (readonly number[])[])[];y0_dm:number;h_dm:number};
function sameWaterfrontSource(a:unknown,b:unknown):boolean{
 if(a===b)return true;if(a===null||b===null||typeof a!=="object"||typeof b!=="object"||Array.isArray(a)!==Array.isArray(b))return false;
 const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>,keys=Object.keys(aa);return keys.length===Object.keys(bb).length&&keys.every(k=>Object.hasOwn(bb,k)&&sameWaterfrontSource(aa[k],bb[k]));
}
export function waterfrontOriginalPrismV296(p:WaterfrontPrismV296):boolean{return sameWaterfrontSource(p,WATERFRONT_ARCADE_RECEIPT_V296.prism);}
const mainArcadeOpenings:readonly HbfOpeningV291[]=WATERFRONT_GROUND_OPENINGS_V296.filter(c=>c.id.startsWith("4592740:")||c.id.startsWith("497648062:")).map(c=>({...c,id:"hhe-public-arcade:"+c.id,planes:c.planes.map((p,i)=>i===c.planes.length-1?[0,-1,0,9.99]as HbfPlaneV291:p),bounds:{min:[...c.bounds.min]as[number,number,number],max:[c.bounds.max[0],9.99,c.bounds.max[2]]},nativeBoxes:c.nativeBoxes?.map(b=>({min:[...b.min]as[number,number,number],max:[b.max[0],9.99,b.max[2]]}))}));
// Capsule-safe terminal air connects the mapped route to the existing bridge
// support beyond its endpoint. Only this source owner/old fitting may yield.
const northMouth=WATERFRONT_ROUTES_V296.find(r=>r.id==="497648062")!.nodes.at(-1)!;
const mouthBounds:HbfBoxV291={min:[northMouth[0]-1.8,northMouth[1]-.8,northMouth[2]-.65],max:[northMouth[0]+1.8,9.99,northMouth[2]+.65]};
const northMouthOpening:HbfOpeningV291={id:"hhe-public-arcade:north-bridge-mouth",bounds:mouthBounds,nativeBoxes:[mouthBounds],planes:[[1,0,0,-mouthBounds.min[0]],[-1,0,0,mouthBounds.max[0]],[0,1,0,-mouthBounds.min[1]],[0,-1,0,mouthBounds.max[1]],[0,0,1,-mouthBounds.min[2]],[0,0,-1,mouthBounds.max[2]]]};
export const WATERFRONT_ARCADE_OPENINGS_V296:readonly HbfOpeningV291[]=[...mainArcadeOpenings,northMouthOpening];
export function waterfrontSourceOpeningsV296(p:WaterfrontPrismV296,enabled=false):readonly HbfOpeningV291[]{return enabled&&waterfrontOriginalPrismV296(p)?WATERFRONT_ARCADE_OPENINGS_V296:[];}
function waterfrontInRing(r:readonly (readonly number[])[],x:number,z:number):boolean{let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++)if((r[i][1]>z)!==(r[j][1]>z)&&x<(r[j][0]-r[i][0])*(z-r[i][1])/(r[j][1]-r[i][1])+r[i][0])inside=!inside;return inside;}
function waterfrontSegmentTouchesCell(a:readonly number[],b:readonly number[],minX:number,minZ:number,maxX:number,maxZ:number):boolean{let lo=0,hi=1;for(const[axis,min,max]of[[0,minX,maxX],[1,minZ,maxZ]]){const d=b[axis]-a[axis];if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max)return false;continue;}const p=(min-a[axis])/d,q=(max-a[axis])/d;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));}return lo<hi-1e-9;}
function waterfrontSourceTouchesCell(p:WaterfrontPrismV296,x:number,z:number):boolean{
 const x0=x*40+.0001,z0=z*40+.0001,x1=(x+1)*40-.0001,z1=(z+1)*40-.0001,corners=[[x0,z0],[x0,z1],[x1,z0],[x1,z1]];
 if(corners.some(q=>waterfrontInRing(p.ring,q[0],q[1])&&!(p.holes??[]).some(h=>waterfrontInRing(h,q[0],q[1]))))return true;
 return p.ring.some((a,i)=>(a[0]>x0&&a[0]<x1&&a[1]>z0&&a[1]<z1)||waterfrontSegmentTouchesCell(a,p.ring[(i+1)%p.ring.length],x0,z0,x1,z1));
}
/** Original integer column tuples, exclusive full-cell ownership and original
 * source records all gate admission. Unknown/changed/foreign cells stay closed. */
export function createWaterfrontColumnOpeningsV296(prisms:readonly WaterfrontPrismV296[],cellM=4,enabled=false):(xi:number,zi:number,bottomDm:number,topDm:number,kind:number)=>readonly HbfOpeningV291[]{
 if(!enabled||cellM!==4||!prisms.some(waterfrontOriginalPrismV296))return()=>[];
 const rows=new Set(WATERFRONT_ARCADE_RECEIPT_V296.columns.filter(c=>c.exclusiveFullCell&&!prisms.some(p=>p.id!==WATERFRONT_ARCADE_RECEIPT_V296.prism.id&&p.y0_dm<c.row[3]&&p.y0_dm+p.h_dm>c.row[2]&&waterfrontSourceTouchesCell(p,c.row[0],c.row[1]))).map(c=>c.row.join(',')));
 return(x,z,b,t,k)=>rows.has([x,z,b,t,k].join(','))?WATERFRONT_ARCADE_OPENINGS_V296:[];
}
export function waterfrontOpeningContainsV296(x:number,y:number,z:number,native=false):boolean{
 if(x<96||x>104||z< -550||z> -524||y<1.8||y>9.99)return false;
 return WATERFRONT_ARCADE_OPENINGS_V296.some(c=>native?(c.nativeBoxes??[]).some(b=>x>=b.min[0]&&x<=b.max[0]&&y>=b.min[1]&&y<=b.max[1]&&z>=b.min[2]&&z<=b.max[2]):c.planes.every(p=>p[0]*x+p[1]*y+p[2]*z+p[3]>=-1e-8));
}
/** Exact intersection of the narrow admitted route and retained source XZ
 * footprint. The new underside closes its actual exposed opening at9.99m. */
export const WATERFRONT_ARCADE_CEILING_V296:readonly WaterfrontTriangleV296[]=WATERFRONT_ARCADE_OPENINGS_V296.flatMap(c=>{
 let polygon:V3[]=WATERFRONT_ARCADE_RECEIPT_V296.prism.ring.map(([x,z])=>[x/10,9.99,z/10]);
 for(const plane of c.planes.filter(p=>p[1]===0)){const out:V3[]=[];const value=(v:V3)=>plane[0]*v[0]+plane[2]*v[2]+plane[3];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=value(a),db=value(b);if(da>=0)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t)as V3);}}polygon=out;if(!polygon.length)break;}
 const result:WaterfrontTriangleV296[]=[];for(let i=1;i+1<polygon.length;i++){const t:WaterfrontTriangleV296=[polygon[0],polygon[i],polygon[i+1]];if(Math.abs((t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]))>1e-8)result.push(t);}return result;
});
const arcadeCells=new Map<string,WaterfrontCellV296>();
for(const t of WATERFRONT_ARCADE_CEILING_V296){const x0=Math.floor(Math.min(...t.map(p=>p[0]))/.5),x1=Math.floor(Math.max(...t.map(p=>p[0]))/.5),z0=Math.floor(Math.min(...t.map(p=>p[2]))/.5),z1=Math.floor(Math.max(...t.map(p=>p[2]))/.5);for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){const p=clipCell(t,ix*.5,iz*.5,.5);let area=0;for(let i=0;i<p.length;i++)area+=p[i][0]*p[(i+1)%p.length][2]-p[(i+1)%p.length][0]*p[i][2];if(Math.abs(area)>1e-8){const x=(ix+.5)*.5,z=(iz+.5)*.5;arcadeCells.set(x+":"+z,{x,y:9.99,z,size:.5,surface:"paving_stones"});}}}
export function waterfrontArcadeCeilingCellsV296():readonly WaterfrontCellV296[]{return[...arcadeCells.values()];}
function frameBoxes(native:boolean):HbfBoxV291[]{
 const n=routesNorthStart(),s=native?.25:.18;
 const xs=[n[0]-1.7,n[0]+1.7],boxes:HbfBoxV291[]=xs.map(x=>{const cx=native?(Math.floor(x/.25)+.5)*.25:x,cz=native?(Math.floor(n[2]/.25)+.5)*.25:n[2];return{min:[cx-s/2,1.99,cz-s/2],max:[cx+s/2,9.99,cz+s/2]};});
 boxes.push({min:[n[0]-1.83,9.99,n[2]-.18],max:[n[0]+1.83,10.17,n[2]+.18]});return boxes;
}
function routesNorthStart():WaterfrontNodeV296{return WATERFRONT_ROUTES_V296.find(r=>r.id==="497648062")!.nodes[0];}
const arcadeFrames=[frameBoxes(false),frameBoxes(true)];
export function waterfrontArcadeFramesV296(native=false):readonly HbfBoxV291[]{return arcadeFrames[+native];}
export function waterfrontArcadeSolidAtV296(x:number,y:number,z:number,radius=0,native=false):boolean{
 if(x<97||x>103||z< -550||z> -524||y<1.98||y>10.18)return false;
 if(y>=9.99&&y<10.17&&(native?arcadeCells.has((Math.floor(x/.5)+.5)*.5+":"+(Math.floor(z/.5)+.5)*.5):WATERFRONT_ARCADE_CEILING_V296.some(t=>triangleY(t,x,z)!==null)))return true;
 return arcadeFrames[+native].some(b=>y>b.min[1]&&y<b.max[1]&&Math.max(b.min[0]-x,0,x-b.max[0])**2+Math.max(b.min[2]-z,0,z-b.max[2])**2<radius*radius+1e-10);
}
