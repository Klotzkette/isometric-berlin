import { expect, test } from "bun:test";
import { InstancedMesh, MeshBasicMaterial } from "three";
import { CHARITE_BETTENHAUS_V207_GROUP, CHARITE_BETTENHAUS_V207_IDS,
  createChariteBettenhausV207 } from "../src/ChariteBettenhausV207";
import data from "../src/data/chariteBettenhausV207.json";

test("bounded source-additive tower detail keeps final-size buffers and both mode families", () => {
  for (const native of [false, true]) {
    const root = createChariteBettenhausV207(native);
    expect(root.name).toBe(CHARITE_BETTENHAUS_V207_GROUP);
    expect(root.children).toHaveLength(2);
    expect(root.userData.sourceSuppressionIds).toEqual([]);
    expect(root.userData.sourceGeometryRetained).toBe(true);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    let bytes = 0;
    root.traverse(o => {
      expect(o.matrixAutoUpdate).toBe(false);
      if (!(o instanceof InstancedMesh)) return;
      expect(o.frustumCulled).toBe(true);
      expect(o.geometry.attributes.uv).toBeUndefined();
      expect(o.instanceMatrix.count).toBe(o.count);
      expect(o.instanceColor!.count).toBe(o.count);
      expect(o.boundingSphere!.radius).toBeLessThan(70);
      bytes += o.instanceMatrix.array.byteLength + o.instanceColor!.array.byteLength;
      bytes += Object.values(o.geometry.attributes).reduce((sum, a) => sum + a.array.byteLength, 0);
      bytes += o.geometry.index!.array.byteLength;
      if (native) for (let i = 0; i < o.count; i++) {
        for (const k of [1, 2, 4, 6, 8, 9]) expect(o.instanceMatrix.array[i * 16 + k]).toBe(0);
      }
    });
    expect(bytes).toBe(native ? data.stats.nativeBufferBytes : data.stats.drawnBufferBytes);
  }
  expect(CHARITE_BETTENHAUS_V207_IDS.size).toBe(16);
  expect(CHARITE_BETTENHAUS_V207_IDS.has("L2e097lj")).toBe(false);
});

test("night glazing follows existing central lights-off behavior without another animation loop", () => {
  for (const native of [false, true]) {
    const light = createChariteBettenhausV207(native).children[1] as InstancedMesh;
    expect(light.name).toBe("Charite lit facade window panes");
    expect(light.userData.nightOnly).toBe(true);
    expect(light.visible).toBe(false);
    expect(light.material).toBeInstanceOf(MeshBasicMaterial);
    expect(light.userData.nightMaterial).toBeUndefined();
    expect(light.count).toBe(native ? 365 : 341);
  }
});

test("repeat construction is deterministic with identical complete static facade detail", () => {
  for (const native of [false, true]) {
    const first = createChariteBettenhausV207(native);
    const second = createChariteBettenhausV207(native);
    first.children.forEach((o, i) => {
      const a = o as InstancedMesh, b = second.children[i] as InstancedMesh;
      expect(a.count).toBe(b.count);
      expect(a.instanceMatrix.array).toEqual(b.instanceMatrix.array);
      expect(a.instanceColor!.array).toEqual(b.instanceColor!.array);
    });
  }
});
