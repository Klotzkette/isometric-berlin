import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createMitteHeritageV166, createMinecraftMitteHeritageV166 } from "../src/MitteHeritageV166";
import source from "../src/data/mitteHeritageV166Source.json";
import { mitteHeritageV166RoofAt } from "../src/mitteHeritageV166Profile";

describe("mapped Mitte heritage source and separate native representation",()=>{
  test("drawn keeps every official sheet, mapped path and texture-free ornament",()=>{
    const g=createMitteHeritageV166();expect(g.userData.sourcePartIds.length).toBe(29);
    expect(g.children.length).toBe(5);expect(g.userData.fullStaticDetailOnTouch).toBe(true);
    g.traverse(o=>{if(o instanceof Mesh){const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)expect((m as {map?:unknown}).map).toBeFalsy();expect(o.geometry.getAttribute("position").count).toBeGreaterThan(0);}});
  });
  test("native has only unrotated boxes and all source parts",()=>{
    const g=createMinecraftMitteHeritageV166();expect(g.userData.sourcePartIds).toEqual(source.parts.map(p=>p.id));
    g.traverse(o=>{if(o instanceof Mesh){expect(o instanceof InstancedMesh).toBe(true);const a=(o as InstancedMesh).instanceMatrix.array;for(let i=0;i<a.length;i+=16)for(const offset of[1,2,4,6,8,9])expect(Math.abs(a[i+offset])).toBeLessThan(1e-6);}});
  });
  test("park approaches do not inherit a building roof",()=>{
    expect(mitteHeritageV166RoofAt(1961.049,-1476.786)).toBeNull();
    expect(mitteHeritageV166RoofAt(1783,-1542)).toBeGreaterThan(18);
  });
});
