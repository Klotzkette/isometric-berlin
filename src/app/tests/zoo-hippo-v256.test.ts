import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { InstancedMesh, Mesh } from "three";
import { createZooGroundsV165, createMinecraftZooGroundsV165 } from "../src/ZooGroundsV165";
import receipt from "../../../geo_data/regierungsviertel/zoo-hippo-v256-render-preservation.json";
import hippo from "../src/data/zooHippoV256Source.json";

function hash(values: ArrayLike<number>): string {
  const floats = values instanceof Float32Array ? values : new Float32Array(Array.from(values));
  return createHash("sha256").update(new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength)).digest("hex");
}

describe("v256 Hippo Bay retains the complete prior rendered Zoo", () => {
  test("exact indexing preserves every prior triangle, colour and authored instance", () => {
    for (const family of receipt.families) {
      const root = family.native ? createMinecraftZooGroundsV165() : createZooGroundsV165();
      for (const prior of family.prior) {
        const mesh = root.getObjectByName(prior.name) as Mesh;
        expect(mesh).toBeDefined();
        const expanded = prior.name === "Zoo climbing cliffs aviary rods and animals"
          ? mesh.geometry.toNonIndexed() : mesh.geometry;
        expect(hash(expanded.attributes.position.array.slice(0, prior.positionCount * 3))).toBe(prior.positionSha256);
        if (prior.colorSha256)
          expect(hash(expanded.attributes.color.array.slice(0, prior.positionCount * 3))).toBe(prior.colorSha256);
        if (prior.instanceCount !== undefined) {
          const instanced = mesh as InstancedMesh;
          expect(instanced.count).toBeGreaterThanOrEqual(prior.instanceCount);
          expect(hash(instanced.instanceMatrix.array.slice(0, prior.instanceCount * 16))).toBe(prior.instanceMatrixSha256);
          expect(hash(instanced.instanceColor!.array.slice(0, prior.instanceCount * 3))).toBe(prior.instanceColorSha256);
        }
        if (expanded !== mesh.geometry) expanded.dispose();
      }
    }
  });

  test("new grid is rendered in the existing batches under both unchanged total ceilings", () => {
    for (const family of receipt.families) {
      const root = family.native ? createMinecraftZooGroundsV165() : createZooGroundsV165();
      let calls = 0, instances = 0, bytes = 0;
      root.traverse(object => {
        if (!(object instanceof Mesh)) return;
        calls++;
        for (const attribute of Object.values(object.geometry.attributes)) bytes += attribute.array.byteLength;
        bytes += object.geometry.index?.array.byteLength ?? 0;
        if (object instanceof InstancedMesh) {
          instances += object.count;
          bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
          if (family.native) for (let i = 0; i < object.count; i++)
            for (const index of [1, 2, 4, 6, 8, 9])
              expect(Math.abs(object.instanceMatrix.array[i * 16 + index])).toBe(0);
        }
      });
      expect({ calls, instances, bytes }).toEqual(family.current);
      expect(bytes).toBeLessThan(family.native ? 7_500_000 : 3_300_000);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      expect(root.userData.zooHippoV256).toBe(true);
      const props = root.getObjectByName(family.native
        ? "Zoo native aviaries climbing rocks and furniture"
        : "Zoo structural posts rails and garden furniture") as InstancedMesh;
      const previous = family.prior.find(p => p.name === props.name)!;
      expect(props.count - previous.instanceCount!).toBe(family.native
        ? hippo.nativeRoofBars.length + hippo.nativePosts.length : hippo.posts.length);
      if (!family.native) {
        const trim = root.getObjectByName("Zoo climbing cliffs aviary rods and animals") as Mesh;
        const old = family.prior.find(p => p.name === trim.name)!;
        expect(trim.geometry.index!.count - old.positionCount).toBe((hippo.ribs.length + hippo.edges.length) * 6);
      }
    }
  });
});
