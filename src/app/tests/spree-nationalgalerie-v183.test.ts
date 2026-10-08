import { expect, test } from "bun:test";
import { InstancedMesh, Material, Mesh } from "three";
import { createNeueNationalgalerieV183 } from "../src/NeueNationalgalerieV183";
import { NATIONALGALERIE_V183, NATIONALGALERIE_V183_IDS, nationalgalerieV183Column } from "../src/neueNationalgalerieV183Profile";
import { createSpreeLandmarksV183, MOLECULE_V183_AXES, MOLECULE_V183_HOLES } from "../src/SpreeLandmarksV183";
function dispose(root: ReturnType<typeof createSpreeLandmarksV183>) {
  const materials=new Set<Material>();root.traverse(o=>{if(!(o instanceof Mesh))return;o.geometry.dispose();if(o instanceof InstancedMesh)o.dispose();for(const m of [o.userData.dayMaterial,o.userData.nightMaterial])if(m)materials.add(m);});for(const m of materials)m.dispose();
}
test("Nationalgalerie owns only eight retained envelopes and keeps a transparent recessed hall",()=>{
  expect(NATIONALGALERIE_V183_IDS.size).toBe(8);
  expect(nationalgalerieV183Column(...NATIONALGALERIE_V183.center as [number,number])).toBeTrue();
  expect(nationalgalerieV183Column(0,0)).toBeFalse();
  for(const native of [false,true]){const root=createNeueNationalgalerieV183(native);try{
    expect(root.userData.columnCount).toBe(8);expect(root.userData.roofWidthM).toBe(64.8);
    const glass=root.children.find(o=>o.name.endsWith(" glass")) as InstancedMesh;
    expect(glass.count).toBeGreaterThan(0);expect(glass.userData.dayMaterial.opacity).toBe(.18);expect(glass.userData.dayMaterial.depthWrite).toBeFalse();
    let bytes=0;root.traverse(o=>{if(o instanceof InstancedMesh){bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);if(native)for(let i=0;i<o.count;i++){const a=o.instanceMatrix.array;for(const k of [1,2,4,6,8,9])expect(a[i*16+k]).toBe(0);}}});
    expect(bytes).toBeLessThan(800_000);
  }finally{dispose(root);}}
});
test("Molecule Man retains three mapped radial plates and actual perforations",()=>{
  expect(MOLECULE_V183_AXES).toHaveLength(3);expect(MOLECULE_V183_HOLES.length).toBeGreaterThan(100);
  for(const native of [false,true]){const root=createSpreeLandmarksV183(native);try{
    expect(root.userData.heightM).toBe(30);expect(root.userData.figureCount).toBe(3);
    let triangles=0;root.traverse(o=>{if(o instanceof Mesh){const p=o.geometry.getAttribute("position");for(const n of p.array)expect(Number.isFinite(n)).toBeTrue();triangles+=(o.geometry.index?.count??p.count)/3;}});
    expect(triangles).toBeLessThan(60_000);expect(root.children.length).toBe(native?1:3);
  }finally{dispose(root);}}
});
