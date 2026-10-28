import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { InstancedMesh, Mesh } from "three";
import { createZooGroundsV165, createMinecraftZooGroundsV165 } from "../src/ZooGroundsV165";
import receipt from "../../../geo_data/regierungsviertel/zoo-hippo-v256-render-preservation.json";
import hippo from "../src/data/zooHippoV256Source.json";
import { expectCompleteNativeZooVolumeV276, originalNativeZooBuffersV276 } from "./helpers/zooWestV276Retention";
import { disposeZooReplayV282, replayZooBeforeAnimalsV282 } from "./helpers/zooAnimalsV282Replay";

function hash(values: ArrayLike<number>): string {
  const floats = values instanceof Float32Array ? values : new Float32Array(Array.from(values));
  return createHash("sha256").update(new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength)).digest("hex");
}

describe("v256 Hippo Bay retains the complete prior rendered Zoo", () => {
  test("exact indexing preserves every prior triangle, colour and authored instance", () => {
    for (const family of receipt.families) {
      const current = family.native ? createMinecraftZooGroundsV165() : createZooGroundsV165();
      // Preserve every frozen historical hash through the exact source inverse,
      // after comparing all current non-animal geometry/materials byte-for-byte.
      const root = replayZooBeforeAnimalsV282(current, family.native);
      try {
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
            if (prior.name === "Zoo retained native house shells and ground rows") {
              const original = originalNativeZooBuffersV276();
              expect(original.matrices.length / 16).toBe(prior.instanceCount);
              expect(hash(original.matrices)).toBe(prior.instanceMatrixSha256);
              expect(hash(original.colors)).toBe(prior.instanceColorSha256);
              expectCompleteNativeZooVolumeV276(instanced);
              continue;
            }
            expect(instanced.count).toBeGreaterThanOrEqual(prior.instanceCount);
            expect(hash(instanced.instanceMatrix.array.slice(0, prior.instanceCount * 16))).toBe(prior.instanceMatrixSha256);
            expect(hash(instanced.instanceColor!.array.slice(0, prior.instanceCount * 3))).toBe(prior.instanceColorSha256);
          }
          if (expanded !== mesh.geometry) expanded.dispose();
        }
      } finally { disposeZooReplayV282(root); disposeZooReplayV282(current); }
    }
  });

  test("new grid is rendered in the existing batches under both unchanged total ceilings", () => {
    for (const family of receipt.families) {
      const root = family.native ? createMinecraftZooGroundsV165() : createZooGroundsV165();
      const retained = replayZooBeforeAnimalsV282(root, family.native);
      try {
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
        let retainedCalls = 0;
        retained.traverse(object => { if (object instanceof Mesh) retainedCalls++; });
        expect(retainedCalls).toBe(family.current.calls);
        expect(calls).toBe(retainedCalls + 1);
        // Later additive Zoo owners share these batches; their complete source
        // volumes and additions are independently checked by the v276 tests.
        expect(instances).toBeGreaterThan(0);
        expect(bytes).toBeLessThan(family.native ? 7_500_000 : 3_300_000);
        expect(root.userData.fullStaticDetailOnTouch).toBe(true);
        expect(root.userData.zooHippoV256).toBe(true);
        const props = retained.getObjectByName(family.native
          ? "Zoo native aviaries climbing rocks and furniture"
          : "Zoo structural posts rails and garden furniture") as InstancedMesh;
        const previous = family.prior.find(p => p.name === props.name)!;
        expect(retained.userData.beforeV276.boxes - previous.instanceCount!).toBe(family.native
          ? hippo.nativeRoofBars.length + hippo.nativePosts.length : hippo.posts.length);
        if (!family.native) {
          const trim = retained.getObjectByName("Zoo climbing cliffs aviary rods and animals") as Mesh;
          const old = family.prior.find(p => p.name === trim.name)!;
          expect(retained.userData.beforeV276.triangles * 3 - old.positionCount).toBe((hippo.ribs.length + hippo.edges.length) * 6);
          expect(trim.geometry.index!.count).toBeGreaterThan(retained.userData.beforeV276.triangles * 3);
        }
      } finally { disposeZooReplayV282(retained); disposeZooReplayV282(root); }
    }
  });
});
