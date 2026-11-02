import {expect,test} from "bun:test";
import {Group} from "three";
import {justicePalaceV183Boxes} from "../src/justicePalaceV183Batches";
import {syncQuarterLegacyFittingsV303,type QuarterLegacyReceiptV303} from "../src/QuarterLegacyFittingsV303";

function fixture(native=false){
  const rows=native?[[10,5,20,5,.2,1,0xccccbb],[22,4,31,3,.4,1,0x333322],[40,4,30,6,.3,2,0x998877]]:[[10,5,20,5,.2,.3,.4,0xccccbb],[22,4,31,3,.4,.2,.7,0x333322],[40,4,30,6,.3,.2,1.2,0x998877]];
  const root=new Group(),parent=new Group(),mesh=justicePalaceV183Boxes(rows,native);parent.userData={frontageCount:113,mappedBenchCount:39};parent.add(mesh);root.add(parent);
  const receipt:QuarterLegacyReceiptV303={owner:"old-house",native,expectedCount:3,rows:[{index:0,row:rows[0]}],requiredPacketKeys:[`${native?"minecraft":"drawn"}:north`,`${native?"minecraft":"drawn"}:south`]};
  return {root,parent,mesh,receipt,before:new Float32Array(mesh.instanceMatrix.array),colors:new Float32Array(mesh.instanceColor!.array)};
}
test("legacy profiles yield only after both actual packet keys and restore on eviction or mode change",()=>{
  for(const native of [false,true]){
    const {root,mesh,receipt,before,colors}=fixture(native),keys=receipt.requiredPacketKeys;
    expect(syncQuarterLegacyFittingsV303(root,new Set(),[receipt])).toBe(0);
    expect(syncQuarterLegacyFittingsV303(root,new Set([keys[0]]),[receipt])).toBe(0);
    expect([...mesh.instanceMatrix.array]).toEqual([...before]);
    expect(syncQuarterLegacyFittingsV303(root,new Set(keys),[receipt])).toBe(1);
    expect([...mesh.instanceMatrix.array.slice(0,12)]).toEqual(new Array(12).fill(0));
    expect([...mesh.instanceMatrix.array.slice(12)]).toEqual([...before.slice(12)]);
    expect([...mesh.instanceColor!.array]).toEqual([...colors]);
    expect(syncQuarterLegacyFittingsV303(root,new Set(keys),[receipt])).toBe(0);
    expect(syncQuarterLegacyFittingsV303(root,new Set([keys[0]]),[receipt])).toBe(1);
    expect([...mesh.instanceMatrix.array]).toEqual([...before]);
    expect(syncQuarterLegacyFittingsV303(root,new Set(keys.map(k=>k.replace(native?"minecraft:":"drawn:",native?"drawn:":"minecraft:"))),[receipt])).toBe(0);
  }
});
test("receipt mutation cannot empty required keys or redirect a registered slot",()=>{
  const {root,mesh,receipt,before}=fixture(),keys=receipt.requiredPacketKeys.slice();
  syncQuarterLegacyFittingsV303(root,new Set(),[receipt]);
  receipt.requiredPacketKeys.length=0;receipt.rows[0].index=2;receipt.rows[0].row=[1,2,3,1,1,1,0,0];receipt.owner="foreign";
  expect(syncQuarterLegacyFittingsV303(root,new Set(),[receipt])).toBe(0);
  expect([...mesh.instanceMatrix.array]).toEqual([...before]);
  expect(syncQuarterLegacyFittingsV303(root,new Set(keys),[receipt])).toBe(1);
  expect([...mesh.instanceMatrix.array.slice(16)]).toEqual([...before.slice(16)]);
  expect(syncQuarterLegacyFittingsV303(root,new Set(),[])).toBe(1);
  expect([...mesh.instanceMatrix.array]).toEqual([...before]);
});
test("empty, duplicate, overlapping, wrong-count and changed actual source receipts stay closed",()=>{
  const mutations=[
    (r:QuarterLegacyReceiptV303)=>{r.requiredPacketKeys=[];},
    (r:QuarterLegacyReceiptV303)=>{r.requiredPacketKeys.push(r.requiredPacketKeys[0]);},
    (r:QuarterLegacyReceiptV303)=>{r.rows.push(structuredClone(r.rows[0]));},
    (r:QuarterLegacyReceiptV303)=>{r.expectedCount++;},
    (r:QuarterLegacyReceiptV303)=>{r.rows[0].row[3]++;},
  ];
  for(const mutate of mutations){const {root,mesh,receipt,before}=fixture();mutate(receipt);expect(syncQuarterLegacyFittingsV303(root,new Set(["drawn:north","drawn:south"]),[receipt])).toBe(0);expect([...mesh.instanceMatrix.array]).toEqual([...before]);}
  const {root,mesh,receipt,before}=fixture();expect(syncQuarterLegacyFittingsV303(root,new Set(receipt.requiredPacketKeys),[receipt,structuredClone(receipt)])).toBe(0);expect([...mesh.instanceMatrix.array]).toEqual([...before]);
});
