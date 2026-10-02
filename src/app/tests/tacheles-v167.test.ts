import { expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createTachelesV167, createMinecraftTachelesV167 } from "../src/TachelesV167";
import { TACHELES_V167_PARENT_IDS, TACHELES_V167_PRISM_IDS, TACHELES_V167_PARTS, tachelesV167RoofAt, tachelesV167SourceColumn } from "../src/tachelesV167Profile";
import nav from "../src/data/tachelesV167Navigation.json";
import source from "../src/data/tachelesV167Source.json";
import { staticGeometryAudit, disposeStaticAudit } from "./helpers/staticGeometryAudit";

test("complete source identity has exact legacy replacement and five ground obstacles and a passage roof", () => {
  expect([...TACHELES_V167_PRISM_IDS].sort()).toEqual(["19283679", "40754304"]);
  expect(TACHELES_V167_PARENT_IDS.size).toBe(2); expect(source.sourceParts).toHaveLength(4);
  expect(TACHELES_V167_PARTS).toHaveLength(6);
  expect(tachelesV167SourceColumn(1211, -729, 5.2, 21.2)).toBe(true);
  expect(tachelesV167SourceColumn(1211, -729, 5.2, 25.2)).toBe(false);
  expect(tachelesV167SourceColumn(1300, -729, 5.2, 21.2)).toBe(false);
  expect(tachelesV167RoofAt(1250, -740)).toBeNull();
  for (const [a, b, c] of nav.roofTriangles) {
    const area = (b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
    if (Math.abs(area) > .001) expect(tachelesV167RoofAt((a[0]+b[0]+c[0])/3, (a[2]+b[2]+c[2])/3)!).toBeGreaterThanOrEqual((a[1]+b[1]+c[1])/3-.01);
  }
  for (const [x, z, y] of nav.nativeRoofCells) expect(tachelesV167RoofAt(x+.5, z+.5, true)).toBe(y);
});

test("four drawn styles share compact geometry and full touch detail", () => {
  const a = createTachelesV167(), b = createTachelesV167({ mobileLike: true });
  expect(a.children).toHaveLength(2); expect(a.userData.sourcePartIds).toHaveLength(4);
  expect(a.userData.currentRoofCorrectionDocumented).toBe(true);
  for (let i=0;i<a.children.length;i++) {
    const x=a.children[i] as Mesh, y=b.children[i] as Mesh;
    expect(x.matrixAutoUpdate).toBe(false);
    expect(x.geometry.attributes.position.array).toEqual(y.geometry.attributes.position.array);
    expect(x.userData.dayMaterial).toBeTruthy();expect(x.userData.nightMaterial).toBeTruthy();
    if(x instanceof InstancedMesh && y instanceof InstancedMesh) expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
  }
  const { budget } = staticGeometryAudit(a);
  expect(budget.draws).toBe(2);expect(budget.bytes).toBeLessThan(350000);
  console.log({tachelesDrawn:budget});disposeStaticAudit(a);disposeStaticAudit(b);
});

test("native Tacheles is a bounded independent orthogonal skin with no smooth clone", () => {
  const a=createMinecraftTachelesV167(),b=createMinecraftTachelesV167({mobileLike:true});
  expect(a.children).toHaveLength(2);let total=0;
  a.children.forEach((child,i)=>{
    expect(child instanceof InstancedMesh).toBe(true);
    const x=child as InstancedMesh,y=b.children[i]as InstancedMesh;
    total+=x.count;expect(x.instanceMatrix.array).toEqual(y.instanceMatrix.array);
    expect(x.matrixAutoUpdate).toBe(false);
    const matrices=x.instanceMatrix.array;
    let rotations=0;for(let i=0;i<x.count;i++)for(const j of[1,2,4,6,8,9])rotations+=Math.abs(matrices[i*16+j]);
    expect(rotations).toBe(0);
  });
  expect(total).toBeLessThan(18000);expect(total).toBeGreaterThan(15000);
  const {budget}=staticGeometryAudit(a);expect(budget.draws).toBe(2);expect(budget.bytes).toBeLessThan(1400000);
  console.log({tachelesNative:budget,instances:total});disposeStaticAudit(a);disposeStaticAudit(b);
});
