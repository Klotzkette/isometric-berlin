import data from './data/moabitLandmarksV269Profile.json';

type Source={id?:unknown;ring?:unknown;holes?:unknown;y0_dm?:unknown;h_dm?:unknown;class?:unknown;roof?:unknown;tone?:unknown};
const fingerprint=(p:Source)=>JSON.stringify([p.id,p.ring,p.holes,p.y0_dm,p.h_dm,p.class,p.roof,p.tone]);
const originals=new Map(data.sites.map(s=>[s.previousPrism.id,fingerprint(s.previousPrism)]));
const neighbours=new Map(data.sites.flatMap(s=>s.neighbours.map(p=>[p.id,fingerprint(p)] as const)));
export const MOABIT_LANDMARKS_V269_PROFILE={sites:data.sites.map(s=>({key:s.key,name:s.name,owner:s.owner,groundY:s.groundY,topY:s.topY,...s.metrics})),fullStaticDetailOnTouch:true,independentlyOrthogonalNative:true} as const;

/** Only the two unchanged14mOSM fallback records yield to required complete sources. */
export function isMoabitLandmarkSourceV269(value:unknown):boolean{
 if(!value||typeof value!=='object')return false;
 const p=value as Source;return typeof p.id==='string'&&originals.has(p.id)&&originals.get(p.id)===fingerprint(p);
}

/** Exact original voxel tuple; foreign/shared cells and changed neighbours stay. */
export function createMoabitLandmarkColumnTesterV269(prisms:readonly unknown[]|undefined,cell:number){
 const no=(_x:number,_z:number,_lo:number,_hi:number,_kind:number)=>false;
 if(cell!==data.cellM||!prisms)return no;
 const matching=new Set(prisms.filter(isMoabitLandmarkSourceV269).map(p=>(p as Source).id));
 const active=data.sites.filter(s=>matching.has(s.previousPrism.id)),columns=active.flatMap(s=>s.columns);
 const siteBounds=active.map(s=>({minX:Math.min(...s.columns.map(c=>c[0]))*cell*10,maxX:(Math.max(...s.columns.map(c=>c[0]))+1)*cell*10,minZ:Math.min(...s.columns.map(c=>c[1]))*cell*10,maxZ:(Math.max(...s.columns.map(c=>c[1]))+1)*cell*10}));
 // Read each source once; fingerprint only the few exact near-site neighbours.
 const foreign=prisms.flatMap(raw=>{
  if(!raw||typeof raw!=='object')return[];
  const p=raw as Source;if(typeof p.id==='string'&&matching.has(p.id)||!Array.isArray(p.ring))return[];
  const ring=p.ring as number[][],xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
  const b={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
  if(!siteBounds.some(s=>b.maxX>=s.minX&&b.minX<=s.maxX&&b.maxZ>=s.minZ&&b.minZ<=s.maxZ))return[];
  if(typeof p.id==='string'&&neighbours.get(p.id)===fingerprint(p))return[];
  return[b];
 });
 const keys=new Set(columns.filter(c=>!foreign.some(b=>b.maxX>=c[0]*cell*10&&b.minX<=(c[0]+1)*cell*10&&b.maxZ>=c[1]*cell*10&&b.minZ<=(c[1]+1)*cell*10)).map(c=>c.join('/')));
 return(x:number,z:number,lo:number,hi:number,kind:number)=>keys.has([x,z,lo,hi,kind].join('/'));
}

function roofAt(triangles:readonly number[][][],x:number,z:number):number|null{
 let top=-Infinity;
 for(const [a,b,c]of triangles){
  const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-8)continue;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
  if(Math.min(u,v,1-u-v)>=-1e-6)top=Math.max(top,u*a[1]+v*b[1]+(1-u-v)*c[1]);
 }
 return Number.isFinite(top)?top:null;
}

/** Complete represented roofs, with identical independent cardinal quantisation. */
export function moabitLandmarkSolidsV269(native=false){
 return data.sites.flatMap(s=>(native?s.nativeFootprints:s.drawnFootprints).map(p=>({
  ...p,minY:s.groundY,maxY:s.topY,sourceId:s.prism,
  topAt:(x:number,z:number):number|null=>{
   if(native){x=(Math.floor(x/data.nativeCellM)+.5)*data.nativeCellM;z=(Math.floor(z/data.nativeCellM)+.5)*data.nativeCellM;}
   const top=roofAt(s.roofTriangles,x,z);return top===null?null:native?Math.min(s.topY,Math.ceil(top/data.nativeCellM)*data.nativeCellM):top;
  },
 })));
}
