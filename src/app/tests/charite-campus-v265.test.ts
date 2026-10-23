import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { InstancedMesh } from 'three';
import source from '../src/data/chariteCampusV265.json';
import receipt from '../../../geo_data/regierungsviertel/charite-campus-v265-preservation.json';
import { chariteCampusRecordsV265,createChariteCampusV265,CHARITE_CAMPUS_V265_PROFILE } from '../src/ChariteCampusV265';
import { historicChariteWindows,HISTORIC_CHARITE_IDS,chariteContainsRing } from '../src/HistoricChariteCampus';
const all=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/lod2-prisms.json',import.meta.url),'utf8')).buildings;
const parts=all.filter((p:{id:string})=>HISTORIC_CHARITE_IDS.has(p.id));

test('museum opt-in retires exactly the 19 photo-disproved groups, preserving source and every other window',()=>{
 const before=JSON.stringify(parts),old=parts.flatMap((p:any)=>historicChariteWindows(p,parts));
 const next=parts.flatMap((p:any)=>historicChariteWindows(p,parts,{includeLegacyMuseumFront:false}));
 const replaced=old.filter((w:any)=>w.sourceId==='gwXjAt32'&&[14,16].includes(w.wall.index));
 expect(replaced).toEqual(receipt.retiredWindowGroups);expect(replaced.length).toBe(19);
 expect(next).toEqual(old.filter((w:any)=>!replaced.includes(w)));expect(JSON.stringify(parts)).toBe(before);
 for(const p of source.parts)expect(p).toEqual(all.find((q:{id:string})=>q.id===p.id));
});

test('museum complete facade has seven vitrines and 63 triple upper panes in three storeys',()=>{
 const r=chariteCampusRecordsV265();
 expect(r.filter(r=>r.role==='museum-bronze-vitrine-sill').length).toBe(7);
 expect(r.filter(r=>r.role==='museum-triple-upper-sill').length).toBe(63);
 expect(r.filter(r=>r.role==='museum-triple-sill').length).toBe(21);
 expect(r.filter(r=>r.role==='museum-entry-door-leaf').length).toBe(2);
 expect(CHARITE_CAMPUS_V265_PROFILE.vitrineHeightM).toBe(6);
 expect(r.filter(r=>r.role==='ruska-basement-light-sill').length).toBeGreaterThan(8);
});

test('new glazing is outside retained exact source planes and within bounded facade extents',()=>{
 for(const native of [false,true])for(const r of chariteCampusRecordsV265(native)){
  expect([...r.position,...r.size,r.angle,r.tone].every(Number.isFinite)).toBe(true);
  expect(r.size.every(x=>x>0)).toBe(true);if(native)expect(r.angle).toBe(0);
  expect(r.position[1]-r.size[1]/2).toBeGreaterThan(3.5);
  expect(r.position[1]+r.size[1]/2).toBeLessThan(26.8);
  if(r.role.endsWith('-pane')){
   const p=source.parts.find(p=>p.id===r.owner)!;
   expect(chariteContainsRing(p.ring,r.position[0],r.position[2])).toBe(false);
  }
 }
});

test('one frozen bounded batch per family, equal full/mobile, no texture or retained diagnostics',()=>{
 for(const native of [false,true]){
  const root=createChariteCampusV265(native),mobile=createChariteCampusV265(native,{mobileLike:true});
  expect(root.children.length).toBe(1);expect(root.userData.records).toBeUndefined();
  expect(root.matrixAutoUpdate).toBe(false);
  const mesh=root.children[0] as InstancedMesh,mobileMesh=mobile.children[0] as InstancedMesh;
  expect(mesh.matrixAutoUpdate).toBe(false);expect(mesh.userData.textureFree).toBe(true);
  expect(mesh.count).toBe(native?3031:3158);
  expect(mesh.instanceMatrix.array).toEqual(mobileMesh.instanceMatrix.array);
  expect(mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength).toBeLessThan(250000);
  for(const m of [mesh,mobileMesh]){m.geometry.dispose();m.userData.dayMaterial.dispose();m.userData.nightMaterial.dispose();}
 }
});
