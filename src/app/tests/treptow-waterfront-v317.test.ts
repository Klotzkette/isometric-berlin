import { expect, test } from "bun:test";
import { BoxGeometry, Group, InstancedMesh, InterleavedBufferAttribute, Matrix4, Mesh, OrthographicCamera, Raycaster, Vector3 } from "three";
import { createTreptowWaterfrontV317, hasCompleteTreptowWaterfrontV317,
  treptowWaterfrontV317Solids } from "../src/TreptowWaterfrontV317";
import { loadSourceQuarterRecipesV309 } from "../src/SourceQuarterCatalogueV309";
import { buildSurroundingCityChunk, prepareSurroundingQuarterPredecessorV303,
  type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { applySourceQuarterLinesV303, applySourceQuarterTrianglesV303,
  captureSourceQuarterPacketV303, prepareSourceQuarterPacketV303,
  sourceQuarterNavigationV303, sourceQuarterOwnersV303,
  type SourceQuarterSourceV303 } from "../src/SourceQuarterPacketV303";
import { schwellenraumMaterialFor } from "../src/visual-modes/schwellenraum/materialGrade";
import planData from "../src/data/treptowWaterfrontV317Packets.json";
import { createSurroundingCity, type SurroundingCityManifest } from "../src/SurroundingCity";
import { createMinecraftMaterialState, disposeMinecraftMaterialState,
  setMinecraftMaterialPresentation } from "../src/visual-modes/minecraft/materialMode";
import { interleaveStaticGeometry } from "../src/interleaveStaticGeometry";
import { parkStaticGeometrySteps } from "../src/losslessStaticStorage";

function done<T>(steps: Generator<void,T>): T {
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}
const plans = planData as unknown as SourceQuarterSourceV303;
async function packet(key: string): Promise<SurroundingCityChunk> {
  const [mode,id] = key.split(":");
  const url = new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`, import.meta.url);
  return JSON.parse(new TextDecoder().decode(Bun.gunzipSync(await Bun.file(url).bytes())));
}
function downward(root: Group, x: number, z: number): number {
  root.updateMatrixWorld(true);
  return new Raycaster(new Vector3(x,180,z),new Vector3(0,-1,0)).intersectObject(root,true)[0]?.point.y ?? -Infinity;
}

test.each([false,true])("full Treptow geometry/private lifetime and independent navigation, native=%s", native => {
  const root = createTreptowWaterfrontV317(native);
  expect(hasCompleteTreptowWaterfrontV317(root,native)).toBeTrue();
  expect(hasCompleteTreptowWaterfrontV317(root,!native)).toBeFalse();
  expect(hasCompleteTreptowWaterfrontV317(root.clone(),native)).toBeFalse();
  expect(downward(root,6060,2745)).toBeGreaterThan(120);
  // This low wing formerly inherited the entire tower's127m envelope.
  expect(downward(root,5900,2720)).toBeLessThan(55);
  expect(downward(root,5535,2462)).toBeCloseTo(3.45,2);
  const solids = treptowWaterfrontV317Solids(native);
  expect(solids.length).toBeGreaterThan(80);
  expect(solids.some(s=>s.parentId==="badeschiff"||s.parentId==="badeschiff-pool")).toBeTrue();
  root.traverse(o=>{if(o instanceof Mesh)o.material=o.userData.nightMaterial;});
  expect(hasCompleteTreptowWaterfrontV317(root,native)).toBeTrue();
  root.traverse(o=>{if(o instanceof Mesh)o.material=schwellenraumMaterialFor(o,o.userData.dayMaterial);});
  expect(hasCompleteTreptowWaterfrontV317(root,native)).toBeTrue();
  const toon=createMinecraftMaterialState();
  setMinecraftMaterialPresentation(root,toon,true);
  expect(hasCompleteTreptowWaterfrontV317(root,native)).toBeTrue();
  setMinecraftMaterialPresentation(root,toon,false);
  disposeMinecraftMaterialState(toon);
  const member = root.children.at(-1) as InstancedMesh;
  const matrix = new Matrix4();
  if(native)for(let i=0;i<member.count;i++){
    member.getMatrixAt(i,matrix);
    expect([1,2,4,6,8,9].every(j=>matrix.elements[j]===0)).toBeTrue();
  }
  member.position.x += .1;
  expect(hasCompleteTreptowWaterfrontV317(root,native)).toBeFalse();
  member.position.x -= .1;
  expect(hasCompleteTreptowWaterfrontV317(root,native)).toBeTrue();
  member.geometry.dispose();
  expect(hasCompleteTreptowWaterfrontV317(root,native)).toBeFalse();
});

test.each([false,true])("mobile stock streams retain all Float32 words and private admission, native=%s", native=>{
  const root=createTreptowWaterfrontV317(native), stock=new BoxGeometry(1,1,1);
  stock.deleteAttribute("uv");
  const members=root.children.filter((o):o is InstancedMesh=>o instanceof InstancedMesh);
  expect(members.length).toBe(native?4:1);
  for(const mesh of members)for(const name of ["position","normal"]){
    const actual=mesh.geometry.getAttribute(name) as InterleavedBufferAttribute;
    const expected=stock.getAttribute(name);
    expect(actual).toBeInstanceOf(InterleavedBufferAttribute);
    const words=new Uint32Array(actual.data.array.buffer,actual.data.array.byteOffset,actual.data.array.length);
    const original=new Uint32Array(expected.array.buffer,expected.array.byteOffset,expected.array.length);
    expect(original.every((word,index)=>word===words[Math.floor(index/3)*actual.data.stride+actual.offset+index%3])).toBeTrue();
  }
  const before=members.map(m=>Object.values(m.geometry.attributes));
  expect(interleaveStaticGeometry(root).geometries).toBe(0);
  expect(hasCompleteTreptowWaterfrontV317(root,native)).toBeTrue();
  root.traverse(o=>{if(o instanceof Mesh)o.material=schwellenraumMaterialFor(o,o.userData.dayMaterial);});
  done(parkStaticGeometrySteps(root));
  expect(interleaveStaticGeometry(root).geometries).toBe(0);
  expect(members.every((m,i)=>Object.values(m.geometry.attributes).every((a,j)=>a===before[i][j]))).toBeTrue();
  expect(hasCompleteTreptowWaterfrontV317(root,native)).toBeTrue();
  const position=members[0].geometry.getAttribute("position") as InterleavedBufferAttribute;
  position.data.needsUpdate=true;
  expect(hasCompleteTreptowWaterfrontV317(root,native)).toBeFalse();
  stock.dispose();
});

async function until(check:()=>boolean): Promise<void> {
  for(let i=0;i<500;i++){
    if(check())return;
    await new Promise(resolve=>setTimeout(resolve,2));
  }
  throw Error("Bounded v317 controller did not settle");
}

test("actual packet reloads after admission and restores every old owner on model loss",async()=>{
  const raw=await packet("drawn:10_4"),text=JSON.stringify(raw),model=createTreptowWaterfrontV317();
  const camera=new OrthographicCamera(-400,400,400,-400,1,3000);
  camera.position.set(5376,500,2304);camera.up.set(0,0,-1);camera.lookAt(5376,0,2304);camera.updateMatrixWorld();
  const rect={ring:[[5120,2048],[5632,2048],[5632,2560],[5120,2560]],holes:[]};
  const asset={url:"10_4.drawn.json",bytes:text.length};
  const manifest:SurroundingCityManifest={schemaVersion:1,groundY:3,footprint:[rect],chunks:[{id:"10_4",bounds:[5120,2048,5632,2560],drawn:asset,minecraft:asset}]};
  let admitted=false,clock=0,fetches=0;
  const fetcher=(async(input:RequestInfo|URL)=>{
    if(String(input).endsWith("manifest.json"))return new Response(JSON.stringify(manifest));
    fetches++;return new Response(text);
  }) as typeof fetch;
  const city=createSurroundingCity({camera,manifestUrl:new URL("https://example.test/manifest.json"),fetch:fetcher,
    now:()=>clock,sourceQuartersV303:true,loadSourceQuarterSourcesV309:loadSourceQuarterRecipesV309,
    treptowWaterfrontV317:()=>admitted&&hasCompleteTreptowWaterfrontV317(model,false)});
  try{
    await city.ready;await until(()=>city.residentChunkCount===1&&!city.pending);
    expect(city.root.children[0].userData.sourceQuarterOwnersV303).toEqual([]);
    admitted=true;city.refresh(clock=1000);
    await until(()=>city.residentChunkCount===1&&!city.pending&&city.root.children[0].userData.sourceQuarterOwnersV303.length===2);
    expect(city.root.children[0].userData.sourceQuarterTrianglesV303).toBe(117);
    (model.children.at(-1) as Mesh).geometry.dispose();city.refresh(clock=2000);
    expect(city.residentChunkCount).toBe(0);
    await until(()=>city.residentChunkCount===1&&!city.pending);
    expect(city.root.children[0].userData.sourceQuarterOwnersV303).toEqual([]);
    expect(fetches).toBe(3);
  } finally {city.dispose();}
});

test.each(planData.keys)("exact production recipe preserves every foreign face, ink and nav in %s", async key => {
  const raw = await packet(key), rawText = JSON.stringify(raw), [mode,id] = key.split(":"), native = mode === "minecraft";
  const recipe = plans.packets[key];
  const ticket = done(captureSourceQuarterPacketV303(raw,id,native,true,plans,"treptow-waterfront-v317",true));
  expect(ticket).toBeDefined();
  const predecessor = done(prepareSurroundingQuarterPredecessorV303(raw,id,native,{}));
  const ready = done(prepareSourceQuarterPacketV303(predecessor,ticket));
  expect(sourceQuarterOwnersV303(ready)).toEqual(recipe.owners);
  for(const [mi,mesh] of ready.meshes.entries()){
    const old = new Uint32Array(Uint8Array.fromBase64(mesh.indices).buffer), changed = old.slice();
    const retired = new Set(recipe.retire.find(r=>r.mesh===mi)?.triangles ?? []);
    expect(done(applySourceQuarterTrianglesV303(ready,mi,changed,0))).toBe(retired.size);
    expect(old.every((value,index)=>changed[index] === (retired.has(Math.floor(index/3)) ? old[Math.floor(index/3)*3] : value))).toBeTrue();
  }
  if(ready.lines){
    const old = new Uint16Array(Uint8Array.fromBase64(ready.lines.positions).buffer), changed=old.slice();
    const retired=new Set(recipe.retireLines);
    expect(done(applySourceQuarterLinesV303(ready,changed,3,changed.length/3))).toBe(retired.size);
    expect(old.every((value,index)=>changed[index] === (retired.has(Math.floor(index/6)) && index%6>=3 ? old[index-3] : value))).toBeTrue();
  }
  expect(sourceQuarterNavigationV303(ready,ready.nav).buildings).toEqual(
    ready.nav.buildings.filter(b=>!recipe.owners.includes(b.sourceId)));
  expect(JSON.stringify(raw)).toBe(rawText);
  const foreign=structuredClone(raw);foreign.nav.buildings.push({...foreign.nav.buildings[0],sourceId:"foreign-extra"});
  expect(done(captureSourceQuarterPacketV303(foreign,id,native,true,plans,"treptow-waterfront-v317",true))).toBeUndefined();
});

test("real loader admission is closed by default and opens only its complete family", async()=>{
  for(const native of [false,true]){
    const raw=await packet(`${native?"minecraft":"drawn"}:10_4`);
    const recipes=await loadSourceQuarterRecipesV309("10_4",native);
    const closed=done(buildSurroundingCityChunk(raw,"10_4",native,false,{sourceQuartersV303:true,sourceQuarterSourcesV303:recipes}));
    expect(closed.root.userData.sourceQuarterTrianglesV303??0).toBe(0);
    const opened=done(buildSurroundingCityChunk(raw,"10_4",native,false,{sourceQuartersV303:true,sourceQuarterSourcesV303:recipes,treptowWaterfrontV317:true}));
    expect(opened.root.userData.sourceQuarterTrianglesV303).toBe(native?575:117);
  }
});
