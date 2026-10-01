import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createAlexanderNorthV166, createMinecraftAlexanderNorthV166 } from "../src/AlexanderNorthV166";
import { ALEXANDER_NORTH_V166_PARENT_IDS, alexanderNorthV166RoofAt, alexanderNorthV166SourceColumn } from "../src/alexanderNorthV166Profile";
import source from "../src/data/alexanderNorthV166Source.json";
import nav from "../src/data/alexanderNorthV166Navigation.json";
import { staticGeometryAudit, disposeStaticAudit } from "./helpers/staticGeometryAudit";

describe("source-complete Alexander north",()=>{
  test("all original sheets render with identical full static touch detail",()=>{
    const root=createAlexanderNorthV166();
    expect(Array.from((root.children[0] as Mesh).geometry.attributes.position.array)).toEqual(Array.from(new Float32Array(source.surfaces.flatMap(s=>s.triangles).flat(2))));
    expect((root.children[1] as InstancedMesh).count).toBe(source.facadeBoxes.length);
    expect(root.userData.sourcePartIds).toHaveLength(107);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    const audit=staticGeometryAudit(root);expect(audit.budget.draws).toBe(3);expect(audit.budget.bytes).toBeLessThan(3800000);
    disposeStaticAudit(root);
  });
  test("native skin and identity details have orthogonal matrices only",()=>{
    const root=createMinecraftAlexanderNorthV166();
    root.traverse(o=>{expect(o.matrixAutoUpdate).toBe(false);if(!(o instanceof Mesh))return;expect(o instanceof InstancedMesh).toBe(true);
      if(o instanceof InstancedMesh)for(let i=0;i<o.count;i++)for(const k of [1,2,4,6,8,9])expect(Math.abs(o.instanceMatrix.array[16*i+k])).toBe(0);
    });
    expect(staticGeometryAudit(root).budget.draws).toBe(2);
    expect((root.children[0] as InstancedMesh).count).toBe(7955);
    disposeStaticAudit(root);
  });
  test("exact roof support survives tall-source refinement and unrelated owners stay clear",()=>{
    expect(ALEXANDER_NORTH_V166_PARENT_IDS.size).toBe(26);
    expect(alexanderNorthV166RoofAt(0,0)).toBeNull();
    for(const [a,b,c] of nav.roofTriangles){const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3,y=(a[1]+b[1]+c[1])/3;
      if(Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))<.01)continue;
      expect(alexanderNorthV166RoofAt(x,z)??-Infinity).toBeGreaterThanOrEqual(y-.001);
    }
    expect(alexanderNorthV166SourceColumn(2812,-388,3,127)).toBe(true);
    expect(alexanderNorthV166SourceColumn(2812,-388,3,99)).toBe(false);
    expect(alexanderNorthV166SourceColumn(0,0,3,127)).toBe(false);
  });
});
