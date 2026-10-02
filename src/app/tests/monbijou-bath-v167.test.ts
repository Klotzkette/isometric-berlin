import { expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createMinecraftMonbijouBathV167, createMonbijouBathV167 } from "../src/MonbijouBathV167";
import { monbijouBathV167WaterAt } from "../src/monbijouBathV167Profile";

test("pool water respects concave outline, paving and independent smaller basin",()=>{
  expect(monbijouBathV167WaterAt(1725,-399)).toBe(true);
  expect(monbijouBathV167WaterAt(1723,-382)).toBe(true);
  expect(monbijouBathV167WaterAt(1710,-391)).toBe(false);
  expect(monbijouBathV167WaterAt(1740,-395)).toBe(false);
});
test("one static batch per reading; native stays orthogonal and texture-free",()=>{
  const drawn=createMonbijouBathV167(), native=createMinecraftMonbijouBathV167();
  expect(drawn.children).toHaveLength(1); expect(native.children).toHaveLength(1);
  expect(drawn.children[0] instanceof InstancedMesh).toBe(false);
  expect(native.children[0] instanceof InstancedMesh).toBe(true);
  expect(native.userData.fullStaticDetailOnTouch).toBe(true);
  for(const root of [drawn,native]) root.traverse(o=>{ if(o instanceof Mesh){
    expect(o.userData.textureFree).toBe(true);
    expect(o.geometry.boundingSphere).not.toBeNull();
  }});
  expect((native.children[0] as InstancedMesh).count).toBeLessThan(1200);
});
