import { describe, expect, test } from "bun:test";
import { BufferGeometry, InstancedMesh, Mesh } from "three";
import { createNeukoellnEnvelopesV210, createNeukoellnPlacesV210 } from "../src/NeukoellnPlacesV210";
import { createSouthKiezV185 } from "../src/SouthKiezV185";
import { createMinecraftSouthKiezV185 } from "../src/MinecraftSouthKiezV185";
import { transferNeukoellnLegacyV185V210 } from "../src/neukoellnLegacyV185TransferV210";
import { neukoellnV210RoofAt, neukoellnV210SolidAt, transferNeukoellnNavigationV210 } from "../src/neukoellnPlacesV210Navigation";
import data from "../src/data/neukoellnPlacesV210.json";
import receipt from "../src/data/neukoellnPlacesV210Ownership.json";
import type { SurroundingNavigation } from "../src/SurroundingCityGeometry";

describe("bounded current Neukoelln architecture v210",()=>{
 test("final-sized independent buffers preserve drawn and native source detail",()=>{
  for(const native of [false,true]) for(const required of [false,true]) {
   const root=(required?createNeukoellnEnvelopesV210:createNeukoellnPlacesV210)(native);
   expect(root.userData.fullStaticDetailOnTouch).toBe(true);
   expect(root.userData.historicalTowers).toBe(false);
   root.traverse(o=>{
    if(!(o instanceof Mesh))return;
    expect((o.geometry as BufferGeometry).getAttribute("uv")).toBeUndefined();
    if(o instanceof InstancedMesh) {
      expect(o.instanceMatrix.array.length).toBe(o.count*16);
      expect(o.instanceColor!.array.length).toBe(o.count*3);
      expect(o.count).toBe(required?data.shellBlocks.length:native?data.blocks.length:data.boxes.length);
    }
   });
  }
 });
 test("exact legacy transfer is reversible byte for byte and refuses changed inputs",()=>{
  for(const native of [false,true]) {
   const root=native?createMinecraftSouthKiezV185():createSouthKiezV185();
   const mesh=root.children[0] as InstancedMesh, before=(mesh.instanceMatrix.array as Float32Array).slice();
   transferNeukoellnLegacyV185V210(root,native);
   expect(mesh.instanceMatrix.array).not.toEqual(before);
   transferNeukoellnLegacyV185V210(root,native,true);
   expect(mesh.instanceMatrix.array).toEqual(before);
   const r=receipt.legacyDetailRecords.find(r=>r.mode===(native?"minecraft":"drawn"))!;
   mesh.instanceMatrix.array[r.first*16+12]+=.5;
   const altered=(mesh.instanceMatrix.array as Float32Array).slice();
   transferNeukoellnLegacyV185V210(root,native);expect(mesh.instanceMatrix.array).toEqual(altered);
  }
 });
 test("navigation removes only unchanged proxy records and follows actual roof heights",()=>{
  const r=receipt.navigationRecords[0];
  const nav={groundY:r.groundY,buildings:[structuredClone(r.original)],barriers:[]} as unknown as SurroundingNavigation;
  expect(transferNeukoellnNavigationV210(r.tile,nav).buildings).toHaveLength(0);
  expect(nav.buildings).toHaveLength(1);
  expect(transferNeukoellnNavigationV210("unrelated",nav)).toBe(nav);
  const changed=structuredClone(nav);changed.buildings[0].height+=.01;
  expect(transferNeukoellnNavigationV210(r.tile,changed)).toBe(changed);
  expect(neukoellnV210RoofAt(5060.45,5091.38)).toBeCloseTo(21.7,5);
  expect(neukoellnV210RoofAt(5060.45,5091.38,true)).toBe(22);
  expect(neukoellnV210SolidAt(5060.45,18,5091.38)).toBe(true);
  expect(neukoellnV210SolidAt(5060.45,26,5091.38)).toBe(false);
  expect(neukoellnV210RoofAt(3543.19,3617.44)).toBeNull();
  expect(neukoellnV210RoofAt(0,0)).toBeNull();
 });
});
