/** Actual runtime source guards are additive; old model/receipt bytes survive. */
import {expect,test}from"bun:test";
import {createNorthCoreActualTerrainControllerV310,type NorthCoreActualDeltaV310}from"../src/NorthCoreActualTerrainV310";
import type {NorthCoreTerrainRecipesV309}from"../src/NorthCoreTerrainV309";
import type {NorthCoreBridgeDeltaV309}from"../src/NorthCoreBridgeTerrainV309";
import {runtimeConstructorOptionsV310,runtimeConstructorOptionsSourceV310}from"./helpers/northRuntimeActualV310";
import {stage}from"./helpers/northCoreActualV309";
const controls={delta:4273494300,variants:{"drawn-initial":513866325,"drawn-worker":1893277644,minecraft:4230670502}};
const load=async()=>({base:await Bun.file(new URL("../src/data/coreTerrainContactV307.json",import.meta.url)).json()as NorthCoreTerrainRecipesV309,bridge:await Bun.file(new URL("../src/data/gesundbrunnenBridgeCoreV309Delta.json",import.meta.url)).json()as NorthCoreBridgeDeltaV309,actual:await Bun.file(new URL("../src/data/coreTerrainActualV310.json",import.meta.url)).json()as NorthCoreActualDeltaV310});

test("actual source derivative reuses all geometry/paint/outside streams and changes only full-source instance guards and ordinals",async()=>{
 const{base,bridge,actual}=await load(),before=JSON.stringify(base),c=createNorthCoreActualTerrainControllerV310(controls),r=await stage(c.composeSteps(base,bridge,actual));expect(r!==null).toBe(true);if(!r)return;
 for(const key of["drawn-initial","minecraft"]){const old=base.variants[key].parts[0],part=r.source.variants[key].parts[0];expect(part.outside).toBe(old.outside);expect(part.attributes).toBe(old.attributes);expect(part.index).toBe(old.index);expect(part.matrix).toBe(old.matrix);expect(part.materials).toBe(old.materials);expect(part.retire.length).toBe(old.retire.length);expect(part.instances).toBe(actual.variants[key].instances);expect(part.retire).toBe(actual.variants[key].retire);}
 expect(JSON.stringify(base)).toBe(before);expect(r.source.variants["drawn-initial"].parts[0].instances?.count).toBe(125364);expect(r.source.variants.minecraft.parts[0].instances?.count).toBe(184956);
},60000);

test("changed actual delta bytes and extra original variant cannot enter the source composition",async()=>{
 const{base,bridge,actual}=await load(),c=createNorthCoreActualTerrainControllerV310(controls),changed=structuredClone(actual);changed.variants["drawn-initial"].retire[0]++;
 expect(await stage(c.composeSteps(base,bridge,changed))).toBeNull();expect((await stage(c.composeSteps(base,bridge,actual)))!==null).toBe(true);
 base.variants.foreign=base.variants.minecraft;expect(await stage(c.composeSteps(base,bridge,actual))).toBeNull();
},60000);

test("real constructor options distinguish deferred smooth terrain and complete native fidelity sources",()=>{
 const prisms={schema_version:1,classes:[],buildings:[]};for(const mobile of[false,true]){
  const drawn=runtimeConstructorOptionsV310(false,mobile,prisms);expect(drawn.retainRasterAsphalt).toBe(false);expect(drawn.retainRasterWater).toBe(false);expect(drawn.smoothSurfaces).toBeNull();expect(drawn.parliamentaryDiningV296).toBe(true);expect(drawn.waterfrontV296).toBe(true);
  const native=runtimeConstructorOptionsV310(true,mobile,prisms);expect(native.sourcePrisms).toBe(prisms.buildings);expect(native.neighbourhoodV300).toBe(true);expect(native.parliamentInteriorsV295).toBe(true);expect(native.detailProfile).toBe(mobile?"mobile":"full");
 }expect(runtimeConstructorOptionsSourceV310(false)).toContain("retainRasterAsphalt: false");expect(runtimeConstructorOptionsSourceV310(true)).toContain("sourcePrisms: prisms?.buildings");
});
