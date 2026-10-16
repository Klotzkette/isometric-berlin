import { expect, test } from "bun:test";
import { createKalkscheuneFacadesV218, planKalkscheuneFacadesV218 } from "../src/KalkscheuneFacadesV218";
import source from "../src/data/kalkscheuneFacadesV218.json";

test("Kalkscheune low corner has two window rows, three axes and divided attic", () => {
  const drawn = planKalkscheuneFacadesV218();
  const front = source.walls.find(w => w.role === "corner-west")!;
  const panes = drawn.filter(b => b.owner === front.id && b.role === "glazing" && b.position[0] < 1250 && b.position[2] > -580);
  expect(panes).toHaveLength(5);
  expect(new Set(panes.map(b => b.position[1])).size).toBe(2);
  expect(drawn.filter(b => b.role === "entrance")).toHaveLength(1);
  expect(drawn.filter(b => b.role === "attic glazing")).toHaveLength(1);
  expect(drawn.filter(b => b.role === "KALKSCHEUNE lettering").length).toBeGreaterThan(20);
});

test("bounded texture-free source detail and independent orthogonal native detail", () => {
  for (const native of [false,true]) {
    const root=createKalkscheuneFacadesV218(native,true);
    const blocks=planKalkscheuneFacadesV218(native);
    expect(root.children).toHaveLength(1);
    expect(root.userData.sourceBodiesRetained).toBe(true);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(blocks.length).toBeLessThan(native ? 11000 : 3000);
    for (const b of blocks) {
      expect(b.position.every(Number.isFinite) && b.size.every(v=>v>0 && Number.isFinite(v))).toBe(true);
      expect(b.position[0]).toBeGreaterThan(1244);
      expect(b.position[0]).toBeLessThan(1286);
      expect(b.position[2]).toBeGreaterThan(-585);
      expect(b.position[2]).toBeLessThan(-529);
      if(native) expect(b.yaw === 0 && b.roll === 0).toBe(true);
    }
    expect(root.userData.sourceParentIds).toEqual(source.parents);
  }
});
