import { expect, test } from "bun:test";
import { Group, InstancedMesh, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from "three";
import scene from "../public/mesh/regierungsviertel/scene.json";
import { createArchitecturalSignature, type ChancelleryModelSignature } from "../src/ArchitecturalLandmarks";
import { createMinecraftArchitecturalLandmarks } from "../src/MinecraftArchitecturalLandmarks";
import { createHbfNorthApproach } from "../src/HbfNorthApproach";
import { admitsChancelleryPhotoSignatureV287, applyChancelleryPhotoDrawnV287, admitsChancelleryPhotoNativeV287, applyChancelleryPhotoNativeV287 } from "../src/ChancelleryPhotoV287Batch";
import owners from "../src/data/chancelleryPhotoV287Owners.json";
import { CHANCELLERY_NATIVE_FACES_V287 } from "../src/ChancelleryPhotoV287";

const signature = scene.architectural_signatures.find(s => s.kind === "chancellery_model") as ChancelleryModelSignature;
const baseline = () => createArchitecturalSignature(signature, { chancelleryPhotoV287: false })!;
const ivyName = owners.drawn[0].name;
const hash = (a: ArrayLike<number>) => new Bun.CryptoHasher("sha256").update(new Float32Array(Array.from(a))).digest("hex");
function inventory(root: Group) {
  const result: unknown[] = [];
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    result.push([o.name, o.geometry.uuid, Object.entries(o.geometry.attributes).map(([name, a]) => [name, hash(a.array)]), o.geometry.index && hash(o.geometry.index.array),
      o instanceof InstancedMesh ? hash(o.instanceMatrix.array) : null,
      o instanceof InstancedMesh && o.instanceColor ? hash(o.instanceColor.array) : null, o.position.toArray(), o.quaternion.toArray()]);
  });
  return result;
}

test("the complete photographed faces replace only the receipted authored members", () => {
  const root = baseline();
  const oldChildren = [...root.children];
  const untouched = oldChildren.filter(o => !owners.drawn.some(r => r.name === o.name));
  const snapshots = untouched.map(o => { const group = new Group(); group.add(o); const result = inventory(group); root.add(o); return result; });
  const partial = owners.drawn.filter(r => !r.whole).map(r => {
    const mesh = root.getObjectByName(r.name) as InstancedMesh;
    const removed = new Set(r.owners.map(row => hash(row.matrix)));
    return { mesh, expected: Array.from({ length: mesh.count }, (_, i) => Array.from((mesh.instanceMatrix.array as Float32Array).subarray(i * 16, i * 16 + 16))).filter(row => !removed.has(hash(row))) };
  });
  expect(applyChancelleryPhotoDrawnV287(root, signature)).toBeTrue();
  expect(root.getObjectByName(ivyName)).toBeUndefined();
  expect(root.getObjectByName(owners.drawn[1].name)).toBeUndefined();
  expect(root.userData.chancelleryPhotoV287).toMatchObject({ count: 1838, retiredIvy: 40, retiredLouvres: 8, retiredLocalLoggiaInstances: 4 });
  for (const { mesh, expected } of partial) expect(Array.from(mesh.instanceMatrix.array)).toEqual(expected.flat());
  untouched.forEach((o, i) => { expect(o.parent).toBe(root); const group = new Group(); group.add(o); expect(inventory(group)).toEqual(snapshots[i]); root.add(o); });
  const opaque = root.getObjectByName("Chancellery photo v287 green climbing cover and Ehrenhof faces") as InstancedMesh;
  const glass = root.getObjectByName("Chancellery photo v287 clear louvre glazing") as InstancedMesh;
  expect(opaque.count).toBe(1822); expect(glass.count).toBe(16);
  expect((glass.material as MeshPhysicalMaterial).transparent).toBeTrue();
  expect((glass.material as MeshPhysicalMaterial).depthWrite).toBeFalse();
  // Same two replacement draw calls as the old ivy plus louvred-pane meshes.
  expect(root.children.filter(o => o instanceof Mesh)).toHaveLength(oldChildren.filter(o => o instanceof Mesh).length);
  expect(applyChancelleryPhotoDrawnV287(root, signature)).toBeFalse();
});

test("changed source geometry and accessors preserve the complete old family", () => {
  for (const key of Object.keys(owners.sourceSignature)) {
    const root = baseline(), source = structuredClone(signature) as unknown as Record<string, unknown>;
    let calls = 0;
    Object.defineProperty(source, key, { get() { calls++; return (signature as unknown as Record<string, unknown>)[key]; }, enumerable: true });
    const before = inventory(root);
    expect(admitsChancelleryPhotoSignatureV287(source)).toBeFalse();
    expect(applyChancelleryPhotoDrawnV287(root, source)).toBeFalse();
    expect(calls).toBe(0); expect(inventory(root)).toEqual(before);
  }
  const changed = { ...signature, cube_height_m: signature.cube_height_m + .001 };
  expect(createArchitecturalSignature(changed)!.getObjectByName(ivyName)).toBeDefined();
});

test("changed, duplicate, reparented or manually transformed old members cannot yield", () => {
  const edits: ((root: Group) => void)[] = [
    root => { const old = root.getObjectByName(ivyName) as InstancedMesh; old.instanceMatrix.array[12] += .01; },
    root => { const old = root.getObjectByName(ivyName) as InstancedMesh; const copy = old.clone(); copy.material = (old.material as MeshStandardMaterial).clone(); (copy.material as MeshStandardMaterial).opacity = .123; root.add(copy); },
    root => { const old = root.getObjectByName(ivyName)!; const moved = new Group(); moved.position.x = 100; root.add(moved); moved.add(old); },
    root => { const old = root.getObjectByName(ivyName)!; old.matrixAutoUpdate = false; old.matrix.makeTranslation(100, 0, 0); },
    root => { const old = root.getObjectByName(ivyName) as InstancedMesh; (old.material as MeshStandardMaterial).opacity = .123; },
    root => { root.getObjectByName(ivyName)!.add(new Group()); },
    root => { const old = root.getObjectByName(owners.drawn[2].name) as InstancedMesh; old.geometry.getAttribute("position").setX(0, 999); },
  ];
  for (const edit of edits) {
    const root = baseline(); edit(root); const before = inventory(root);
    expect(applyChancelleryPhotoDrawnV287(root, signature)).toBeFalse();
    expect(root.getObjectByName(ivyName)).toBeDefined(); expect(inventory(root)).toEqual(before);
  }
});

test("native retirement requires a complete branded replacement and keeps every unrelated matrix/color", () => {
  const root = createMinecraftArchitecturalLandmarks();
  const mesh = root.getObjectByName(owners.native.name) as InstancedMesh;
  const before = inventory(root), oldCount = mesh.count;
  expect(admitsChancelleryPhotoNativeV287(root)).toBeTrue();
  expect(applyChancelleryPhotoNativeV287(root, { count: 1811 })).toBeFalse();
  expect(inventory(root)).toEqual(before);
  const matrices = Array.from({ length: mesh.count }, (_, i) => Array.from((mesh.instanceMatrix.array as Float32Array).subarray(i * 16, i * 16 + 16)));
  const colors = Array.from({ length: mesh.count }, (_, i) => Array.from((mesh.instanceColor!.array as Float32Array).subarray(i * 3, i * 3 + 3)));
  const removed = new Set(owners.native.owners.map(row => hash(row.matrix)));
  const retainedIndices = matrices.map((row, i) => removed.has(hash(row)) ? -1 : i).filter(i => i >= 0);
  const replacement = createHbfNorthApproach(() => 5.2, true);
  expect(applyChancelleryPhotoNativeV287(root, replacement.userData.chancelleryPhotoV287)).toBeTrue();
  expect(mesh.count).toBe(oldCount - 12);
  const fragments = owners.native.owners.flatMap(row => row.retained ? [row.retained] : []);
  expect(Array.from(mesh.instanceMatrix.array)).toEqual([...retainedIndices.flatMap(i => matrices[i]), ...fragments.flatMap(r => r.matrix)]);
  expect(Array.from(mesh.instanceColor!.array)).toEqual([...retainedIndices.flatMap(i => colors[i]), ...fragments.flatMap(r => r.color)]);
  expect(root.children.reduce((n, o) => n + (o instanceof InstancedMesh ? o.count : 0), 0)).toBeLessThan(5500);
});

test("native changed owners reject the family and the fallback host adds no new faces", () => {
  const root = createMinecraftArchitecturalLandmarks(); const old = root.getObjectByName(owners.native.name) as InstancedMesh;
  const first = owners.native.owners[0].matrix;
  const index = Array.from({ length: old.count }, (_, i) => i).find(i => hash((old.instanceMatrix.array as Float32Array).subarray(i * 16, i * 16 + 16)) === hash(first))!;
  old.instanceMatrix.array[index * 16 + 12] += .01;
  expect(admitsChancelleryPhotoNativeV287(root)).toBeFalse();
  const host = createHbfNorthApproach(() => 5.2, true, { chancelleryPhotoV287: false });
  expect(host.userData.chancelleryPhotoV287).toBeUndefined();
  expect(applyChancelleryPhotoNativeV287(root, host.userData.chancelleryPhotoV287)).toBeFalse();
});


test("a changed existing support keeps both the previous panes and complete native fallback", () => {
  const root = createMinecraftArchitecturalLandmarks(), mesh = root.getObjectByName(owners.native.name) as InstancedMesh;
  const owner = CHANCELLERY_NATIVE_FACES_V287.frontPylons[0].owners[0];
  const index = Array.from({ length: mesh.count }, (_, i) => i).find(i => hash((mesh.instanceMatrix.array as Float32Array).subarray(i * 16, i * 16 + 16)) === hash(owner.matrix))!;
  expect(index).toBeGreaterThanOrEqual(0);
  mesh.instanceColor!.array[index * 3] += .001;
  const before = inventory(root);
  expect(admitsChancelleryPhotoNativeV287(root)).toBeFalse();
  const replacement = createHbfNorthApproach(() => 5.2, true);
  expect(applyChancelleryPhotoNativeV287(root, replacement.userData.chancelleryPhotoV287)).toBeFalse();
  expect(inventory(root)).toEqual(before);
});
