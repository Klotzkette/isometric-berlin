import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { BufferAttribute, Group, InstancedMesh, Material, Mesh } from "three";
import { build } from "vite";
import { losslessJsonData, READONLY_CONSTRUCTION_JSON_FIELDS } from "../losslessJsonData";

class CollectableReference {
  static entries: CollectableReference[] = [];
  private value: object | undefined;
  constructor(value: object) { this.value=value; CollectableReference.entries.push(this); }
  deref(): object | undefined { return this.value; }
  static collect(): void {
    for (const entry of this.entries) entry.value=undefined;
    this.entries=[];
  }
}
type Fixture = {
  factory: (native: boolean) => Group;
  source: Record<string, unknown>;
};

async function compiledFactory(tacheles = false): Promise<string> {
  const dir=await mkdtemp(join(tmpdir(),"isometric-hospital-cache-v255-"));
  const app=resolve(import.meta.dir,"../src");
  const entry=join(dir,"entry.js");
  try {
    const constructor = tacheles
      ? `import { createTachelesV167, createMinecraftTachelesV167 } from ${JSON.stringify(join(app,"TachelesV167.ts"))};
const factory = native => native ? createMinecraftTachelesV167() : createTachelesV167();`
      : `import { createBundeswehrHospitalV214 as factory } from ${JSON.stringify(join(app,"BundeswehrHospitalV214.ts"))};`;
    await writeFile(entry, `${constructor}
import source from ${JSON.stringify(join(app,"data",tacheles ? "tachelesV167Source.json" : "bundeswehrHospitalV214.json"))};
window.fixture = { factory, source };`);
    const result=await build({configFile:false,root:dir,publicDir:false,logLevel:"silent",
      plugins:[losslessJsonData()],build:{write:false,minify:true,rolldownOptions:{input:entry}}});
    if(Array.isArray(result)||!("output" in result))throw new Error("Expected one factory bundle");
    const chunk=result.output.find(item=>item.type==="chunk"&&item.isEntry);
    if(!chunk||chunk.type!=="chunk")throw new Error("Missing factory bundle");
    return chunk.code;
  } finally { await rm(dir,{recursive:true,force:true}); }
}
function execute(code: string, weak: boolean): Fixture {
  const window: { fixture?: Fixture }={};
  new Function("window","WeakRef",code)(window,weak?CollectableReference:undefined);
  return window.fixture!;
}
function renderDigest(root: Group): string {
  const hash=new Bun.CryptoHasher("sha256");
  const geometries=new Set<Mesh["geometry"]>(),materials=new Set<Material>();
  const attribute=(value?: BufferAttribute): void=>{
    if(!value){hash.update("none");return;}
    hash.update(JSON.stringify([value.itemSize,value.normalized,value.count,value.array.constructor.name]));
    hash.update(new Uint8Array(value.array.buffer,value.array.byteOffset,value.array.byteLength));
  };
  root.updateMatrixWorld(true);
  root.traverse(object=>{
    hash.update(JSON.stringify([object.type,object.name,object.matrix.elements,object.matrixWorld.elements]));
    const mesh=object as Mesh;if(!mesh.geometry)return;
    geometries.add(mesh.geometry);
    for(const [name,value] of Object.entries(mesh.geometry.attributes).sort(([a],[b])=>a.localeCompare(b))){
      hash.update(name);attribute(value as BufferAttribute);
    }
    attribute(mesh.geometry.index??undefined);
    const instance=mesh as InstancedMesh;
    if(instance.isInstancedMesh){
      attribute(instance.instanceMatrix);attribute(instance.instanceColor??undefined);
      hash.update(JSON.stringify([instance.count,instance.boundingBox,instance.boundingSphere]));
    }
    for(const material of [mesh.material,mesh.userData.dayMaterial,mesh.userData.nightMaterial].flat().filter(Boolean) as Material[])
      materials.add(material);
  });
  const result=hash.digest("hex");
  root.traverse(object=>{const mesh=object as InstancedMesh;if(mesh.isInstancedMesh)mesh.dispose();});
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
  root.clear();
  return result;
}

test("hospital constructor retains all rendered values across weak source collection",async()=>{
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["bundeswehrHospitalV214.json"]).toEqual(["boxes","blocks","padTriangles"]);
  const raw=JSON.parse(await readFile(resolve(import.meta.dir,"../src/data/bundeswehrHospitalV214.json"),"utf8"));
  const code=await compiledFactory(),strong=execute(code,false),weak=execute(code,true);
  const helipad=weak.source.helipad;
  for(const field of ["boxes","blocks","padTriangles"] as const){
    const before=weak.source[field];
    expect(before).toEqual(raw[field]);
    CollectableReference.collect();
    const after=weak.source[field];
    expect(after).toEqual(raw[field]);
    if(field==="padTriangles")expect(after).toBe(before); // 428 bytes remains eager.
    else expect(after).not.toBe(before); // Deterministically reconstruct large readonly rows.
  }
  const expected=[false,true].map(native=>renderDigest(strong.factory(native)));
  for(const native of [false,true,false,true]){
    CollectableReference.collect();
    expect(renderDigest(weak.factory(native))).toBe(expected[native?1:0]);
    for(const field of ["boxes","blocks","padTriangles"] as const)
      expect(weak.source[field]).toEqual(raw[field]); // v215 correction must not mutate v214 rows.
    expect(weak.source.helipad).toBe(helipad);
  }
  CollectableReference.collect();
},60_000);

test("Tacheles constructor preserves both model families through weak source reconstruction",async()=>{
  const fields=["surfaces","facadeBoxes","nativeRows","nativeDetailRows"];
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["tachelesV167Source.json"]).toEqual(fields);
  const raw=JSON.parse(await readFile(resolve(import.meta.dir,"../src/data/tachelesV167Source.json"),"utf8"));
  const code=await compiledFactory(true),strong=execute(code,false),weak=execute(code,true);
  const parents=weak.source.parents,parts=weak.source.sourceParts;
  for(const field of fields){
    const before=weak.source[field];
    expect(before).toEqual(raw[field]);
    CollectableReference.collect();
    const after=weak.source[field];
    expect(after).toEqual(raw[field]);
    if(JSON.stringify(raw[field]).length>=64*1024)expect(after).not.toBe(before);
    else expect(after).toBe(before);
  }
  const expected=[false,true].map(native=>renderDigest(strong.factory(native)));
  for(const native of [false,true,false,true]){
    CollectableReference.collect();
    expect(renderDigest(weak.factory(native))).toBe(expected[native?1:0]);
    for(const field of fields)expect(weak.source[field]).toEqual(raw[field]);
    expect(weak.source.parents).toBe(parents);
    expect(weak.source.sourceParts).toBe(parts);
  }
  CollectableReference.collect();
},60_000);
