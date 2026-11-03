import{expect,test}from"bun:test";
import{Mesh}from"three";
import baseJson from"../src/data/coreTerrainContactV307.json";
import deltaJson from"../src/data/gesundbrunnenBridgeCoreV309Delta.json";
import{createNorthCoreBridgeTerrainControllerV309,prepareNorthCoreBridgeTerrainV309Steps,hasCompleteNorthCoreBridgeTerrainV309,revokeNorthCoreBridgeTerrainV309,type NorthCoreBridgeDeltaV309}from"../src/NorthCoreBridgeTerrainV309";
import type{NorthCoreTerrainRecipesV309}from"../src/NorthCoreTerrainV309";
import{actualDrawn,dispose,done,expectUnchanged,oldReferences,stage}from"./helpers/northCoreActualV309";
const base=baseJson as unknown as NorthCoreTerrainRecipesV309,delta=deltaJson as unknown as NorthCoreBridgeDeltaV309;
const controls={delta:1522445275,variants:{"drawn-initial":691981172,"drawn-worker":1893277644,minecraft:398998653}};
const fnv=(v:unknown)=>{const s=JSON.stringify(v);let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
test("bridge Core composition reuses every old outside byte and changes only three disjoint source retire lists",()=>{
 const c=createNorthCoreBridgeTerrainControllerV309(controls),r=done(c.composeSteps(base,delta));expect(r).not.toBeNull();const derived=r!.source;
 for(const[k,control]of Object.entries(delta.baseVariantControls))expect(fnv(base.variants[k])).toBe(control);
 for(const[k,control]of Object.entries(controls.variants))expect(fnv(derived.variants[k])).toBe(control);
 expect(derived.variants["drawn-initial"]).toBe(base.variants["drawn-initial"]);expect(derived.variants.minecraft).toBe(base.variants.minecraft);
 let changed=0;
 for(let i=0;i<base.variants["drawn-worker"].parts.length;i++){const p=base.variants["drawn-worker"].parts[i],q=derived.variants["drawn-worker"].parts[i];expect(q.outside).toBe(p.outside);if(q!==p){changed++;const row=delta.variants["drawn-worker"].parts.find(r=>r.name===p.name&&r.batchId===p.batchId)!;expect(q.outsideAdditions).toBe(row.outsideAdditions);expect(row.retire.some(n=>p.retire.includes(n))).toBe(false);expect(q.retire).toEqual([...p.retire,...row.retire].sort((a,b)=>a-b));}else expect(q).toBe(p);}
 expect(changed).toBe(3);expect(delta.variants["drawn-worker"].parts.reduce((n,r)=>n+r.retire.length,0)).toBe(28);
});
test("a bridge delta cannot retire a previously owned source face",()=>{
 const bad=structuredClone(delta),row=bad.variants["drawn-worker"].parts[0],part=base.variants["drawn-worker"].parts.find(p=>p.name===row.name&&p.batchId===row.batchId)!;row.retire=[part.retire[0]];
 const c=createNorthCoreBridgeTerrainControllerV309({...controls,delta:fnv(bad)});expect(done(c.composeSteps(base,bad))).toBeNull();
});
test("actual complete Worker+Main source transfers the bridge delta through one reversible controller",async()=>{
 const world=await actualDrawn(base),refs=oldReferences(world);
 try{const tx=await stage(prepareNorthCoreBridgeTerrainV309Steps(world,false,true,base,delta));expect(tx).not.toBeNull();expectUnchanged(refs);expect(tx!.commit(true)).toBe(true);expect(hasCompleteNorthCoreBridgeTerrainV309(world,false)).toBe(true);
  const meshes:Mesh[]=[];world.traverse(o=>{if(o instanceof Mesh&&o.userData.northCoreOutsideV309)meshes.push(o);});
  for(const row of delta.variants["drawn-worker"].parts)for(const q of row.outsideAdditions){const m=meshes.filter(m=>m.userData.northCoreOutsideKeyV309===q.key);expect(m).toHaveLength(1);for(const[attr,key]of[["position","positions"],["color","colors"],["normal","normals"]]as const){const a=m[0].geometry.getAttribute(attr).array;expect(Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64")).toBe(q[key]);}const a=m[0].geometry.index!.array;expect(Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64")).toBe(q.indices);}
  base.variants.foreign=base.variants.minecraft;
  try{expect(tx!.complete()).toBe(false);expect(tx!.commit(true)).toBe(false);}finally{delete base.variants.foreign;}
  tx!.rollback();expectUnchanged(refs);expect(hasCompleteNorthCoreBridgeTerrainV309(world,false)).toBe(false);
 }finally{revokeNorthCoreBridgeTerrainV309(world);dispose(world);}
},60000);
