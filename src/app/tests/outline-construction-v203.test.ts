import { expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { BufferGeometry, InstancedMesh, Material, type Object3D } from "three";
import { completeCooperatively } from "../src/cooperativeWork";
import { createOutlineLandmarksV182Steps, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { createOuterThinOutlinesSteps } from "../src/OuterThinOutlines";
import baseline from "./fixtures/outline-landmarks-v203-baseline.json";

function signature(root: Object3D) {
  const hash = createHash("sha256"); let objects = 0, bytes = 0;
  root.traverse((n: any) => {
    objects++;
    hash.update(JSON.stringify([n.name,n.type,n.visible,n.matrix.elements,n.position.toArray(),n.rotation.toArray(),n.scale.toArray(),n.renderOrder,n.frustumCulled,n.count??null]));
    const attrs = Object.entries(n.geometry?.attributes ?? {});
    if (n.geometry?.index) attrs.push(["index", n.geometry.index]);
    if (n.instanceMatrix) attrs.push(["instanceMatrix", n.instanceMatrix]);
    if (n.instanceColor) attrs.push(["instanceColor", n.instanceColor]);
    for (const [name, a] of attrs as any) {
      hash.update(JSON.stringify([name, a.itemSize, a.normalized, a.count]));
      const data = new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength);
      hash.update(data); bytes += data.byteLength;
    }
  });
  return { sha256: hash.digest("hex"), objects, bytes, families: root.children.length };
}

for (const mode of ["day", "minecraft"] as const) test(`${mode} cooperative construction preserves every v1.0.102 render-buffer byte and transform`, async () => {
  let tasks = 0;
  const root = await completeCooperatively(createOutlineLandmarksV182Steps(mode), {
    budgetMs: 0, isCancelled: () => false,
    yieldTask: async () => { tasks++; await new Promise(resolve => setTimeout(resolve, 0)); },
  });
  try {
    expect(tasks).toBeGreaterThanOrEqual(baseline[mode].families);
    expect(signature(root)).toEqual(baseline[mode]);
  } finally { disposeOutlineConstruction(root); }
});

test("cancelling partial outer construction disposes the map and every completed family", async () => {
  const geometry = spyOn(BufferGeometry.prototype, "dispose");
  const material = spyOn(Material.prototype, "dispose");
  const instance = spyOn(InstancedMesh.prototype, "dispose");
  let tasks = 0;
  try {
    await expect(completeCooperatively(createOuterThinOutlinesSteps("day"), {
      budgetMs: 0, isCancelled: () => tasks === 4,
      yieldTask: async () => { tasks++; },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(geometry.mock.calls.length).toBeGreaterThan(3);
    expect(material.mock.calls.length).toBeGreaterThan(3);
    expect(instance.mock.calls.length).toBeGreaterThan(0);
    expect(new Set(geometry.mock.contexts).size).toBe(geometry.mock.calls.length);
    expect(new Set(material.mock.contexts).size).toBe(material.mock.calls.length);
  } finally { geometry.mockRestore(); material.mockRestore(); instance.mockRestore(); }
});
