/** Offline byte-level no-regression proof through the full production decoder. */
import type { BufferGeometry, Object3D } from 'three';
import { ShaderLib } from 'three';
import { buildSurroundingCityChunk, type SurroundingCityChunk, type SurroundingOwnershipOptions } from '../src/SurroundingCityGeometry';
import { clusterFacadesSourceV320 } from '../src/ClusterFacadesV320';
import { berlinSenateSourceV321 } from '../src/BerlinSenateV321';
import type { NeighbourhoodSourceV300 } from '../src/NeighbourhoodPacketV300';
import type { CivicPlateV350 } from '../src/CivicFacilitiesV350';
import { drain,plateClearV350 } from './civic-facility-support-v350';

const equal=(a:ArrayLike<number>,b:ArrayLike<number>)=>a.length===b.length&&Array.from(a).every((v,i)=>v===b[i]);
function array(geometry:BufferGeometry,name:string):ArrayLike<number>{const a=geometry.getAttribute(name) as any;return a?.data?.array??a?.array??[];}
function dispose(root:Object3D){root.traverse((o:any)=>{o.geometry?.dispose();const ms=[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.groundOverlayDayV329,o.userData.groundOverlayNightV329].flat();for(const m of new Set(ms))m?.dispose?.();});root.clear();}

export async function productionOptionsV350(id:string,flags:SurroundingOwnershipOptions):Promise<SurroundingOwnershipOptions>{
 const result={...flags,groundFinishV348:true,clusterFacadesV320:clusterFacadesSourceV320,berlinSenateV321:berlinSenateSourceV321};
 if(['5_-7','6_-7','9_4','-2_4'].includes(id))result.namedTransportSourceV334=(await import('../src/data/namedElevatedStationsV334.json')).default as any;
 if(['outer187-27_15','outer187-27_16'].includes(id))result.namedTransportSourceV334=(await import('../src/data/katzengrabenV334.json')).default as any;
 if(['ring182-8_8','ring182-8_10','ring182-9_8'].includes(id))result.neukoellnBuildingsV342=(await import('../src/data/neukoellnBuildingsV342Packets.json')).default as any;
 return result;
}
export async function productionSupportV350(raw:SurroundingCityChunk,id:string,native:boolean,flags:SurroundingOwnershipOptions,prior:NonNullable<SurroundingOwnershipOptions['sourceQuarterSourcesV303']>){
 const decoded=drain(buildSurroundingCityChunk(structuredClone(raw),id,native,false,{...await productionOptionsV350(id,flags),sourceQuarterSourcesV303:prior}));
 try{
  const meshes=decoded.root.children.filter((c:any)=>c.isMesh).map((c:any)=>{
   const words=array(c.geometry,'position'),p=new Uint16Array(words.length/2);
   for(let v=0;v<words.length/6;v++)for(let axis=0;axis<3;axis++)p[v*3+axis]=words[v*6+axis];
   return{p,i:new Uint32Array(c.geometry.getIndex().array)};
  });
  return{meshes,nav:decoded.nav};
 }finally{dispose(decoded.root);}
}
export async function proveCorridorProductionV354(raw:SurroundingCityChunk,id:string,native:boolean,flags:SurroundingOwnershipOptions,prior:NonNullable<SurroundingOwnershipOptions['sourceQuarterSourcesV303']>,source:NeighbourhoodSourceV300,startVertex:number,retired:Set<string>,plates?:CivicPlateV350[]):Promise<{valid:boolean;reason?:string;oldKinds?:unknown;vertices?:number;unsupportedPlates?:number[]}>{
 const options=await productionOptionsV350(id,flags),key=(native?'minecraft:':'drawn:')+id,plan=source.packets[key];
 const addedVertices=atob(plan.append.positions).length/6,addedIndices=atob(plan.append.indices).length/4;
 let before:(ReturnType<typeof buildSurroundingCityChunk> extends Generator<void,infer T>?T:never)|undefined,after:typeof before;
 try{
  before=drain(buildSurroundingCityChunk(structuredClone(raw),id,native,false,{...options,sourceQuarterSourcesV303:prior}));
  after=drain(buildSurroundingCityChunk(structuredClone(raw),id,native,false,{...options,sourceQuarterSourcesV303:[...prior,{kind:plan.append.kind,source:source as any}]}));
  const fail=(reason:string)=>({valid:false,reason,oldKinds:before!.root.userData.sourceKinds});
  if(!after.root.userData.sourceKinds.includes(plan.append.kind))return fail('new-recipe-not-admitted-in-production');
  if(JSON.stringify(before.root.userData.sourceKinds)!==JSON.stringify(after.root.userData.sourceKinds.filter((k:string)=>k!==plan.append.kind)))return fail('older-source-kind-order-differs');
  for(const [key,value] of Object.entries(before.root.userData)){
   if(key==='sourceKinds'||key==='neighbourhoodV300'||key==='sourceQuarterTrianglesV303'||key==='sourceQuarterOwnersV303'||key==='sourceQuarterLineSegmentsV303')continue;
   if((typeof value!=='object'||Array.isArray(value))&&JSON.stringify(value)!==JSON.stringify(after.root.userData[key]))return fail('older-root-metadata-differs:'+key);
  }
  if((after.root.userData.sourceQuarterTrianglesV303??0)-(before.root.userData.sourceQuarterTrianglesV303??0)!==(plan as any).retire.reduce((n:number,r:any)=>n+r.triangles.length,0))return fail('retired-metadata-count-differs');
  // Owner metadata is an ordered transfer log, not a sorted set. Ground
  // overlays run after ordinary recipes, so this block is inserted before them.
  const oldOwners=before.root.userData.sourceQuarterOwnersV303??[],newOwners=after.root.userData.sourceQuarterOwnersV303??[],addedOwners=(plan as any).owners;
  const intactOwnerLog=newOwners.length===oldOwners.length+addedOwners.length&&Array.from({length:oldOwners.length+1},(_,at)=>at).some(at=>JSON.stringify(newOwners)===JSON.stringify([...oldOwners.slice(0,at),...addedOwners,...oldOwners.slice(at)]));
  if(!intactOwnerLog)return fail('ordered-source-owner-complement-differs');
  if((after.root.userData.sourceQuarterLineSegmentsV303??0)-(before.root.userData.sourceQuarterLineSegmentsV303??0)!==(plan as any).retireLines.length)return fail('retired-line-metadata-differs');
  const retiredNav=new Set((plan as any).retireNav.map((b:any)=>JSON.stringify(b)));
  const expectedNav={...before.nav,buildings:[...before.nav.buildings.filter(b=>!retiredNav.has(JSON.stringify(b))),...(plan as any).appendNav]};
  if(JSON.stringify(expectedNav)!==JSON.stringify(after.nav))return fail('production-navigation-differs');
  const priorMesh=before.root.children.some((c:any)=>c.isMesh);
  if(before.root.children.length+(priorMesh?0:1)!==after.root.children.length)return fail('production-child-count-differs');
  if(!priorMesh){const mesh=after.root.children.find((c:any)=>c.isMesh) as any;if(!mesh||mesh.geometry.getIndex().count!==addedIndices||mesh.geometry.getAttribute('position').count!==addedVertices)return fail('new-companion-mesh-differs');}
  for(let child=0;child<before.root.children.length;child++){
   const old=before.root.children[child] as any,next=after.root.children.find((c:any)=>c.type===old.type) as any;
   const a=old.geometry as BufferGeometry,b=next.geometry as BufferGeometry;
   if(!a||!b||old.type!==next.type)return fail('production-child-shape-differs');
   const av=array(a,'position'),bv=array(b,'position');
   if(old.isMesh){
    if(plates){
     const positions=new Uint16Array(av.length/2);for(let v=0;v<av.length/6;v++)for(let axis=0;axis<3;axis++)positions[v*3+axis]=av[v*6+axis];
     const triangles=new Uint32Array(a.getIndex()!.array);
     const unsupported=plates.flatMap((plate,i)=>plateClearV350([{p:positions,i:triangles}],plate)?[]:[i]);
     if(unsupported.length)return{...fail('fully-decoded-wall-or-clearance-not-supported'),unsupportedPlates:unsupported};
    }
    for(const name of ['dayMaterial','nightMaterial','groundOverlayDayV329','groundOverlayNightV329']){
     const first=old.userData[name],second=next.userData[name];
     if(Boolean(first)!==Boolean(second))return fail('older-material-family-differs:'+name);
     if(first){
      if(first.customProgramCacheKey()!==second.customProgramCacheKey())return fail('older-material-hook-differs:'+name);
      const describe=(m:any)=>{const template=m.type==='MeshBasicMaterial'?ShaderLib.basic:ShaderLib.standard;const shader={vertexShader:template.vertexShader,fragmentShader:template.fragmentShader,uniforms:{}};m.onBeforeCompile(shader,{});return JSON.stringify(shader);};
      if(describe(first)!==describe(second))return fail('older-shader-uniforms-differ:'+name);
     }
    }
    if(bv.length-av.length!==addedVertices*6)return fail('production-vertex-count-differs');
    const start=startVertex*6,end=start+addedVertices*6;
    for(let i=0;i<av.length;i++)if(av[i]!==bv[i<start?i:i+end-start])return fail('old-position-or-colour-word-differs');
    const ai=a.getIndex()!.array,bi=b.getIndex()!.array;
    if(bi.length-ai.length!==addedIndices)return fail('production-index-count-differs');
    let oldAt=0,skipped=0;
    for(let t=0;t<bi.length;t+=3){
     const inside=[bi[t],bi[t+1],bi[t+2]].map(n=>n>=startVertex&&n<startVertex+addedVertices);
     if(inside.every(Boolean)){skipped+=3;continue;}
     if(inside.some(Boolean))return fail('new-triangle-crosses-original-vertices');
     const first=ai[oldAt],retire=retired.has([ai[oldAt],ai[oldAt+1],ai[oldAt+2]].join(','));for(let k=0;k<3;k++){const value=bi[t+k],translated=value>=startVertex+addedVertices?value-addedVertices:value;const expected=retire?first:ai[oldAt];if(expected!==translated)return fail('old-triangle-word-differs:'+oldAt);oldAt++;}
    }
    if(skipped!==addedIndices||oldAt!==ai.length)return fail('old-triangle-accounting-differs');
   }else {
    const retiredLines=new Set((plan as any).retireLines as number[]);const attribute=a.getAttribute('position') as any;const stride=attribute.data?.stride??attribute.itemSize;
    if(av.length!==bv.length)return fail('line-count-differs');
    for(let i=0;i<av.length;i++){const vertex=Math.floor(i/stride),axis=i%stride;const expected=axis<3&&vertex%2===1&&retiredLines.has(Math.floor(vertex/2))?av[i-stride]:av[i];if(bv[i]!==expected)return fail('unrelated-line-word-differs:'+i);}
   }
  }
  return{valid:true,vertices:addedVertices};
 }catch(error){return{valid:false,reason:String(error)};}
 finally{if(before)dispose(before.root);if(after)dispose(after.root);}
}
