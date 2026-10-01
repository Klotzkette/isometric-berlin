import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createKranzlerV165, createMinecraftKranzlerV165 } from "../src/KranzlerV165";
import source from "../src/data/kranzlerV165Source.json";
import { staticGeometryAudit, disposeStaticAudit } from "./helpers/staticGeometryAudit";

describe("measured Kranzler ensemble",()=>{
  test("draws every complete source surface and facade instance",()=>{
    const root=createKranzlerV165();
    expect(Array.from((root.children[0] as Mesh).geometry.attributes.position.array)).toEqual(Array.from(new Float32Array(source.surfaces.flatMap(s=>s.triangles).flat(2))));
    expect((root.children[1] as InstancedMesh).count).toBe(source.facadeBoxes.length);
    expect(root.userData.sourcePartIds).toHaveLength(19);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(staticGeometryAudit(root).budget.draws).toBe(4);
    disposeStaticAudit(root);
  });
  test("native source surfaces and striped details contain only orthogonal boxes",()=>{
    const root=createMinecraftKranzlerV165();
    let count=0;
    root.traverse(o=>{expect(o.matrixAutoUpdate).toBe(false);if(!(o instanceof Mesh))return;
      expect(o instanceof InstancedMesh).toBe(true);
      if(o instanceof InstancedMesh){count+=o.count;for(let i=0;i<o.count;i++)for(const j of [1,2,4,6,8,9])expect(Math.abs(o.instanceMatrix.array[16*i+j])).toBe(0);}
    });
    expect(count).toBeLessThan(15000);
    expect((root.children[0] as InstancedMesh).count).toBe(1251);
    disposeStaticAudit(root);
  });
});
