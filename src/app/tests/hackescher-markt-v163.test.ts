import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createHackescherMarktV163, createMinecraftHackescherMarktV163 } from "../src/HackescherMarktV163";
import { HACKESCHER_MARKT_V163_PRISM_IDS, hackescherHoefePassageAt, hackescherMarktRoofAt } from "../src/hackescherMarktV163Profile";
import source from "../src/data/hackescherMarktV163Source.json";
import navigation from "../src/data/hackescherMarktV163Navigation.json";

describe("Hackescher Markt source architecture", () => {
  test("retains measured court voids, exact ownership and connected passages", () => {
    expect(source.parents).toHaveLength(29); expect(source.parts).toHaveLength(50);
    expect(HACKESCHER_MARKT_V163_PRISM_IDS.size).toBe(10);
    expect(hackescherMarktRoofAt(2094,-536)).toBeNull();
    expect(hackescherMarktRoofAt(2050,-598)).toBeNull();
    for (const p of source.passages) {
      const a=p.line[0],b=p.line[1],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
      expect(hackescherHoefePassageAt(x,6.8,z)).toBe(true);
      expect(hackescherHoefePassageAt(x,12,z)).toBe(false);
      expect(hackescherHoefePassageAt(x,6.8,z,"unrelated-building")).toBe(false);
    }
    for(const [x,z,y] of navigation.nativeRoofCells) expect(hackescherMarktRoofAt(x,z,true)).toBe(y);
  });
  test("complete architecture is batched and Minecraft has independent axis-aligned geometry", () => {
    for (const native of [false,true]) {
      const group=native?createMinecraftHackescherMarktV163():createHackescherMarktV163();
      let meshes=0,instances=0;
      group.traverse(o=>{
        if (!(o instanceof Mesh)) return; meshes++;
        expect(o.geometry.getAttribute("position").count).toBeGreaterThan(0);
        expect(o.geometry.boundingSphere?.radius).toBeLessThan(1000);
        if (native) expect(o instanceof InstancedMesh).toBe(true);
        if (o instanceof InstancedMesh) {
          instances+=o.count;
          if(native) for(let i=0;i<o.count;i++) {
            const a=o.instanceMatrix.array;
            expect(a[i*16+1]).toBe(0);expect(a[i*16+2]).toBe(0);expect(a[i*16+4]).toBe(0);
          }
        }
        o.geometry.dispose();
      });
      expect(meshes).toBeLessThanOrEqual(4);expect(instances).toBeLessThan(24000);
    }
  });
});
