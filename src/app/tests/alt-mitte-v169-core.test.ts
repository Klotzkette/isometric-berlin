import { expect, test } from "bun:test";
import { Mesh } from "three";
import { createAltMitteCoreV169 } from "../src/AltMitteDrawnCoreV169";
import {
  createMinecraftAltMitteCoreV169,
  preloadAltMitteNativeV169Source,
} from "../src/AltMitteNativeCoreV169";
import {
  ALT_MITTE_V169_GROUP,
  ALT_MITTE_V169_NATIVE_GROUP,
} from "../src/AltMitteCoreV169";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import { staticGeometryAudit } from "./helpers/staticGeometryAudit";

// Prepare source before any synchronous native-world construction.
await preloadAltMitteNativeV169Source();

for (const [name, factory, native] of [
  [ALT_MITTE_V169_GROUP, createAltMitteCoreV169, false],
  [ALT_MITTE_V169_NATIVE_GROUP, createMinecraftAltMitteCoreV169, true],
] as const) {
  test(`${name}: every real packet stays resident with exactly equal full/touch geometry`, () => {
    const snapshots: ReturnType<typeof staticGeometryAudit>[] = [];
    for (const mobileLike of [false, true]) {
      const root = factory({ mobileLike });
      try {
        expect(root.name).toBe(name);
        expect(root.userData.sourceEnvelopeResident).toBe(true);
        expect(root.userData.facadeStreamingIndependent).toBe(true);
        expect(root.userData.nativeMinecraft).toBe(native);
        expect(root.userData.sourceParents.length).toBeGreaterThan(0);
        expect(root.children.length).toBe(root.userData.sourceChunkIds.length);
        expect(root.children.length).toBeGreaterThan(0);
        expect(new Set(root.userData.sourceChunkIds).size).toBe(
          root.children.length,
        );
        let triangleCount = 0;
        root.traverse((node) => {
          expect(node.matrixAutoUpdate).toBe(false);
          if (!(node instanceof Mesh)) return;
          const position = node.geometry.getAttribute("position");
          expect(position.array).toBeInstanceOf(Uint16Array);
          triangleCount += node.geometry.index!.count / 3;
          expect(node.geometry.boundingBox?.isEmpty()).toBe(false);
          expect(Number.isFinite(node.geometry.boundingSphere!.radius)).toBe(
            true,
          );
          if (native)
            expect(node.userData.dayMaterial).toBe(node.userData.nightMaterial);
          else
            expect(node.userData.dayMaterial).not.toBe(
              node.userData.nightMaterial,
            );
        });
        expect(triangleCount).toBeGreaterThan(0);
        const snapshot = staticGeometryAudit(root);
        expect(snapshot.budget.bytes).toBe(root.userData.geometryBytes);
        snapshots.push(snapshot);
      } finally {
        disposeSurroundingCityRoot(root);
      }
    }
    expect(snapshots[1]).toEqual(snapshots[0]);
  }, 30000);
}
