/** Browser-measured V8 layout is an exact second candidate, never a tolerance. */
import{expect,test}from"bun:test";
import{createNorthCoreEnginesControllerV311,type CoreWorkerV8ProfileV311}from"../src/NorthCoreEnginesV311";
import type{NorthCoreTerrainRecipesV309}from"../src/NorthCoreTerrainV309";
import type{NorthCoreActualDeltaV310}from"../src/NorthCoreActualTerrainV310";
import type{NorthCoreBridgeDeltaV309}from"../src/NorthCoreBridgeTerrainV309";
import{stage}from"./helpers/northCoreActualV309";
const controls={profile:2735151910,variants:{"drawn-initial":513866325,"drawn-worker":2911124795,minecraft:4230670502}};
const load=async()=>({base:await Bun.file(new URL("../src/data/coreTerrainContactV307.json",import.meta.url)).json()as NorthCoreTerrainRecipesV309,bridge:await Bun.file(new URL("../src/data/gesundbrunnenBridgeCoreV309Delta.json",import.meta.url)).json()as NorthCoreBridgeDeltaV309,actual:await Bun.file(new URL("../src/data/coreTerrainActualV310.json",import.meta.url)).json()as NorthCoreActualDeltaV310,profile:await Bun.file(new URL("../src/data/coreWorkerV8V311.json",import.meta.url)).json()as CoreWorkerV8ProfileV311});
test("V8 exact profile preserves every local source owner and outside reference with only the proved 918 ordinal shifts",async()=>{
 const{base,bridge,actual,profile}=await load(),c=createNorthCoreEnginesControllerV311(controls),before=JSON.stringify(base),r=await stage(c.composeSteps(base,bridge,actual,profile));expect(r!==null).toBe(true);if(!r)return;
 const old=base.variants["drawn-worker"].parts.find(p=>p.batchId===profile.part.batchId&&p.name===profile.part.name)!,part=r.source.variants["drawn-worker"].parts.find(p=>p.batchId===profile.part.batchId&&p.name===profile.part.name)!;
 expect(part.outside).toBe(old.outside);expect(part.materials).toBe(old.materials);expect(part.matrix).toBe(old.matrix);expect(part.attributes).toBe(profile.part.attributes);expect(part.index).toBe(profile.part.index);expect(part.retire).toHaveLength(184049);expect(part.retire.filter((n,i)=>n!==old.retire[i])).toHaveLength(918);
 expect(part.retire).toEqual(old.retire.map(n=>n>=1337586?n-2:n));expect(JSON.stringify(base)).toBe(before);
},60000);
test("unknown profile bytes and a changed cached original catalogue fail closed",async()=>{
 const{base,bridge,actual,profile}=await load(),c=createNorthCoreEnginesControllerV311(controls),wrong=structuredClone(profile);wrong.part.index.hash++;
 expect(await stage(c.composeSteps(base,bridge,actual,{schemaVersion:1,variant:"drawn-worker"}as CoreWorkerV8ProfileV311))).toBeNull();expect(await stage(c.composeSteps(base,bridge,actual,wrong))).toBeNull();expect((await stage(c.composeSteps(base,bridge,actual,profile)))!==null).toBe(true);
 base.variants.foreign=base.variants.minecraft;expect(await stage(c.composeSteps(base,bridge,actual,profile))).toBeNull();base.variants=null as unknown as typeof base.variants;expect(await stage(c.composeSteps(base,bridge,actual,profile))).toBeNull();
},60000);
