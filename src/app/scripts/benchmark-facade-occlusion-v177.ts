import { createHash } from "node:crypto";
import { createEuropacityArchitecture, planEuropacityArchitecture } from "../src/EuropacityArchitecture";
import { createRohwedderHausArchitecture, planRohwedderHaus } from "../src/RohwedderHausArchitecture";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxels from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import { InstancedMesh, Mesh, type Group } from "three";

export function geometryHash(root: Group) {
  const hash = createHash("sha256");
  const materials = new Set<object>();
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    hash.update(JSON.stringify([o.name, o.matrix.elements, o.visible, o.castShadow, o.receiveShadow]));
    for (const [name, attribute] of Object.entries(o.geometry.attributes)) {
      hash.update(JSON.stringify([name, attribute.itemSize, attribute.normalized, attribute.array.constructor.name]));
      hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    }
    if (o.geometry.index) hash.update(new Uint8Array(o.geometry.index.array.buffer));
    if (o instanceof InstancedMesh) {
      hash.update(String(o.count));
      for (const attribute of [o.instanceMatrix, o.instanceColor]) if (attribute) hash.update(new Uint8Array(attribute.array.buffer));
    }
    for (const material of [o.material, o.userData.dayMaterial, o.userData.nightMaterial].flat()) {
      if (!material || materials.has(material)) continue;
      materials.add(material);
      const data = material.toJSON(); delete data.uuid;
      hash.update(JSON.stringify(data));
    }
  });
  const digest = hash.digest("hex");
  root.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); });
  for (const material of materials) (material as {dispose(): void}).dispose();
  return digest;
}
if (import.meta.main) {
const report = [];
for (const name of ["europacity", "rohwedder"] as const) for (const minecraft of [false, true]) for (const mobileLike of [false, true]) {
  const options = { minecraft, mobileLike, voxels, sourcePrisms: prisms.buildings };
  const plan = () => name === "europacity" ? planEuropacityArchitecture(options) : planRohwedderHaus(prisms, options);
  const samples = [];
  let blocks: ReturnType<typeof plan> = [];
  for (let n = 0; n < 5; n++) { const start = performance.now(); blocks = plan(); samples.push(performance.now() - start); }
  const blockHash = createHash("sha256").update(JSON.stringify(blocks)).digest("hex");
  const root = name === "europacity" ? createEuropacityArchitecture(options) : createRohwedderHausArchitecture(prisms, options);
  report.push({ name, minecraft, mobileLike, count: blocks.length, blockHash, geometryHash: geometryHash(root), samples, medianMs: samples.toSorted((a,b)=>a-b)[2] });
}
console.log(JSON.stringify(report, null, 2));
}
