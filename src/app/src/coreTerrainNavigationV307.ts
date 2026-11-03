/** Exact final Core contact: small face ordinals, shared actual render buffers. */
import {Group,Mesh}from'three';
import source from './data/coreTerrainContactV307Navigation.json';
import {hasCompleteRailTerrainContactV307,hasCompleteRailTerrainContactApproachV309}from'./RailTerrainContactV307';
type Binding={mesh:Mesh;cells:Record<string,number[][]>};
const known=new WeakMap<Group,Map<boolean,((x:number,z:number)=>number|null)>>();
/** Bind once to private-provenance actual model children. No packed geometry is
 * imported or decoded here, and no strong duplicate XYZ/index arrays survive. */
export function createCoreHumboldtNavigationV307(contactRoot:Group,native=false):(x:number,z:number)=>number|null{
 const previous=known.get(contactRoot)?.get(native);if(previous)return previous;
 const complete=()=>hasCompleteRailTerrainContactV307(contactRoot,native)||hasCompleteRailTerrainContactApproachV309(contactRoot,native);
 if(!complete())throw Error('Actual complete contact root required for navigation');
 const region=source.regions.find(r=>r.native===native);if(!region)throw Error('Exact core navigation mode missing');
 const bindings:Binding[]=region.meshes.map(m=>{const candidates=contactRoot.children.filter(c=>c instanceof Mesh&&c.name===m.key);if(candidates.length!==1)throw Error('Exact actual core floor mesh missing');return{mesh:candidates[0]as Mesh,cells:m.cells as unknown as Record<string,number[][]>};});
 const sample=(x:number,z:number):number|null=>{
  if(!complete())return null;
  let high=-Infinity;
  for(const binding of bindings){const cx=Math.floor(x/4),cz=Math.floor(z/4),xs=Math.abs(x-cx*4)<1e-7?[cx,cx-1]:[cx],zs=Math.abs(z-cz*4)<1e-7?[cz,cz-1]:[cz];const runs=xs.flatMap(xx=>zs.flatMap(zz=>binding.cells[`${xx}_${zz}`]??[]));if(!runs.length)continue;
   // Legal GPU parking restores only this same needed geometry once in the
   // current JS job. These references are local and never enter a cache.
   const attribute=binding.mesh.geometry.getAttribute('position'),index=binding.mesh.geometry.index!;
   const p=attribute.array,ix=index.array;
   for(const[start,count]of runs)for(let id=start;id<start+count;id++){const at=id*3,a=Number(ix[at])*3,b=Number(ix[at+1])*3,c=Number(ix[at+2])*3,ax=Number(p[a]),ay=Number(p[a+1]),az=Number(p[a+2]),bx=Number(p[b]),by=Number(p[b+1]),bz=Number(p[b+2]),cx=Number(p[c]),cy=Number(p[c+1]),cz=Number(p[c+2]),d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-9)continue;const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;if(Math.min(u,v,1-u-v)>=-1e-7)high=Math.max(high,u*ay+v*by+(1-u-v)*cy);}
  }
  return Number.isFinite(high)?high:null;
 };
 const modes=known.get(contactRoot)??new Map();modes.set(native,sample);known.set(contactRoot,modes);return sample;
}
