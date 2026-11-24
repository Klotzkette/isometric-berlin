import { expect, test } from "bun:test";
import { Box3, Group, InstancedMesh, Matrix4, Mesh } from "three";
import { createAltMitteCoreV169FromSource, type AltMitteCoreV169Source } from "../src/AltMitteCoreV169";
import { createSchlossQuartierV383 } from "../src/SchlossQuartierV383";
import gable from "../src/data/kurstrasseGiebelV383.json";
import data from "../src/data/schlossQuartierV383.json";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

for (const native of [false,true]) test("Resident public walls and three squares in "+(native?"block style":"drawn style"),async()=>{
  const mode=native?"Native":"Drawn";
  const index=await Bun.file(new URL(`../src/data/altMitte${mode}V169Source.json`,import.meta.url)).json();
  const wanted=new Set(data.fronts.flatMap(f=>(native?f.nativeHosts:f.drawnHosts).map(h=>h.packetId)));
  if(native) wanted.add(gable.packet);
  const chunks:{id:string;packet:SurroundingCityChunk}[]=[];
  for(const row of index.chunkFiles)if(wanted.has(row.id))chunks.push({id:row.id,packet:await Bun.file(new URL("../src/data/"+row.file,import.meta.url)).json()});
  const payload:AltMitteCoreV169Source={schemaVersion:1,sourceParents:data.fronts.map(f=>f.edge.prismId),drawnChunks:native?[]:chunks,minecraftChunks:native?chunks:[]};
  const world=new Group();world.add(createAltMitteCoreV169FromSource(payload,native,{schlossplatzV239:true,architectureV241:true}));
  let packetMesh:Mesh|undefined;
  if(native)world.traverse(o=>{
    if(o instanceof Mesh && o.name.endsWith(gable.packet+" native Minecraft mapped surfaces and massing")) packetMesh=o;
  });
  const indices=packetMesh?.geometry.index;
  const baseline=indices?.array.slice();
  const out=createSchlossQuartierV383(world,native);
  expect(out.userData.kurstrasseGableTriangles).toBe(native?176:0);
  if(indices && baseline) {
    const certified=new Set(gable.triangles.map(t=>t[0]));
    let protectedChanged=0, changed=0;
    for(let i=0;i<baseline.length;i+=3) {
      const differed=baseline[i+1]!==indices.getX(i+1)||baseline[i+2]!==indices.getX(i+2)||baseline[i]!==indices.getX(i);
      if(differed) { changed++; if(!certified.has(i/3))protectedChanged++; }
    }
    expect(protectedChanged).toBe(0);
    expect(changed).toBe(176);
    expect(gable.retainedTriangles).toBe(184);
    expect(createSchlossQuartierV383(world,native).userData.admitted).toEqual(out.userData.admitted);
  }
  expect(out.userData.admitted).toEqual(data.fronts.map(f=>f.surface));
  expect(createSchlossQuartierV383(new Group(),native).userData.admitted).toEqual([]);
  expect(data.fronts.reduce((n,f)=>n+f.rows.length*f.cols.length,0)).toBe(286);
  const gate=out.getObjectByName("Sanchi-Tor am Humboldt Forum");
  expect(gate).toBeDefined();
  const bounds=new Box3().setFromObject(gate!);
  expect(bounds.max.y-bounds.min.y).toBeGreaterThan(9.7);
  expect(bounds.max.z-bounds.min.z).toBeLessThan(6.7);
  expect(bounds.max.x-bounds.min.x).toBeLessThan(1.4);
  const mat=new Matrix4();
  let cardinal=true;
  out.traverse(o=>{
    if(!(o instanceof InstancedMesh)) return;
    expect(o.count).toBeGreaterThan(0);
    if(native) for(let i=0;i<o.count;i++) {
      o.getMatrixAt(i,mat);
      for(const col of [0,4,8]) if(mat.elements.slice(col,col+3).filter(v=>Math.abs(v)>1e-6).length!==1)cardinal=false;
    }
  });
  expect(cardinal).toBe(true);
});
