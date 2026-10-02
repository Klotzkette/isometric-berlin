import { expect, test } from "bun:test";
import { InstancedMesh } from "three";
import { createTeehausRuinV168, createMinecraftTeehausRuinV168 } from "../src/TeehausRuinV168";
import { teehausRuinV168SourceColumn, TEEHAUS_RUIN_V168_PRISM_IDS } from "../src/teehausRuinV168Profile";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

test("Teehaus replaces only its six exact survey columns, never ground or neighbors",()=>{
  expect(TEEHAUS_RUIN_V168_PRISM_IDS.size).toBe(6);
  expect(teehausRuinV168SourceColumn(-1581,160,5.2,9.2)).toBe(true);
  expect(teehausRuinV168SourceColumn(-1581,160,3,5.2)).toBe(false);
  expect(teehausRuinV168SourceColumn(-1581,160,5.2,17.2)).toBe(false);
  expect(teehausRuinV168SourceColumn(-1581,180,5.2,9.2)).toBe(false);
});
test("the whole documented ruin has identical touch and desktop geometry in two drawn batches",()=>{
  const a=createTeehausRuinV168(),b=createTeehausRuinV168({mobileLike:true});
  const audit=staticGeometryAudit(a);
  expect(audit).toEqual(staticGeometryAudit(b));expect(audit.budget.draws).toBe(2);expect(audit.budget.bytes).toBeLessThan(100000);
  expect(a.userData.rooflessInterior).toBe(true);expect(a.userData.sourceParts).toHaveLength(6);
  console.log({teehausDrawn:audit.budget});disposeStaticAudit(a);disposeStaticAudit(b);
});
test("native ruin stays orthogonal and keeps its full detail with one bounded batch",()=>{
  const a=createMinecraftTeehausRuinV168(),b=createMinecraftTeehausRuinV168({mobileLike:true});
  const audit=staticGeometryAudit(a);expect(audit).toEqual(staticGeometryAudit(b));expect(audit.budget.draws).toBe(1);expect(audit.budget.bytes).toBeLessThan(650000);
  const mesh=a.children[0] as InstancedMesh;expect(mesh.isInstancedMesh).toBe(true);expect(mesh.count).toBeGreaterThan(5000);
  for(let i=0;i<mesh.count;i++)for(const j of[1,2,4,6,8,9])expect(Math.abs(mesh.instanceMatrix.array[i*16+j])).toBe(0);
  console.log({teehausNative:audit.budget});disposeStaticAudit(a);disposeStaticAudit(b);
});
