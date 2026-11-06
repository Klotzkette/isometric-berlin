/** Bounded actual Core proof:37 fitting owners plus their7 exact neighbours.
 * The independent two-owner V8 capture below preserves complete source words;
 * no user-agent selection, tolerance or full-city construction is involved. */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { BufferAttribute, BufferGeometry, Group, InstancedBufferAttribute, InstancedMesh, InterleavedBufferAttribute, LineSegments, Material, Mesh, MeshBasicMaterial } from "three";
import { wilhelmStreetFrontsCorePlanV325 } from "../src/WilhelmStreetFrontsV325Core";
import coreData from "../src/data/wilhelmStreetFrontsV325Core.json";
const drain = <T>(steps: Generator<void, T>): T => { for (;;) { const next = steps.next(); if (next.done) return next.value; } };
test("an already cached exact V8 alternative still rejects a mutated delta source", () => {
  const original = coreData.drawnV8.baseControl;
  const first = wilhelmStreetFrontsCorePlanV325(false, false, true);
  try {
    coreData.drawnV8.baseControl = original + 1;
    expect(() => wilhelmStreetFrontsCorePlanV325(false, false, true)).toThrow("Changed exact engine variant");
  } finally { coreData.drawnV8.baseControl = original; }
  expect(wilhelmStreetFrontsCorePlanV325(false, false, true).plan).toBe(first.plan);
});
test("actual bounded Drawn Core retires exactly 630 fittings behind the private model gate and restores on source revoke", async () => {
  const [{ createIsometricCityCore }, { runtimeConstructorOptionsV310 }, owners, fronts, sources, { wilhelmStreetFrontsCorePlanV325 }] = await Promise.all([
    import("../src/IsometricCityWorld"), import("./helpers/northRuntimeActualV310"), import("../src/ExactOwnersV321"),
    import("../src/WilhelmStreetFrontsV325"), import("../src/WilhelmStreetFrontsV325Sources"), import("../src/WilhelmStreetFrontsV325Core"),
  ]);
  const p = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8"));
  const { plan, control } = wilhelmStreetFrontsCorePlanV325();
  const neighbours = ["3qbK80tG", "400002kR", "40001MBA", "8ATaGDbD", "9mFgI41a", "FvtLRV0z", "lGcVZgqS"];
  const ids = new Set([...plan.owners.map(o => o.id), ...neighbours]);
  const selected = p.buildings.filter((b: any) => ids.has(b.id)); expect(selected).toHaveLength(44);
  // All actual original P prisms supply exposure; only37 selected owners and
  // their7 exact edge neighbours construct. No complete city is built.
  const root = createIsometricCityCore(p, null, null, null, { ...runtimeConstructorOptionsV310(false, false, p),
    buildings: selected, includeContext: false, moabitMitteV300: false, westKiezV302: false });
  const world = new Group().add(root);
  const bytes = (array: ArrayBufferView) => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");
  const renderables: (Mesh | LineSegments)[] = []; root.traverse(o => { if (o instanceof Mesh || o instanceof LineSegments) renderables.push(o); });
  const snapshot = renderables.map(object => ({ object, geometry: object.geometry, index: object.geometry.index,
    indexWords: object.geometry.index ? Array.from(object.geometry.index.array) : null,
    attributes: Object.entries(object.geometry.attributes).map(([key, attribute]) => ({ key, attribute,
      words: bytes(attribute instanceof InterleavedBufferAttribute ? attribute.data.array : attribute.array) })),
    matrix: object instanceof InstancedMesh ? object.instanceMatrix : null,
    matrixWords: object instanceof InstancedMesh ? Array.from(object.instanceMatrix.array) : null,
    color: object instanceof InstancedMesh ? object.instanceColor : null,
    colorWords: object instanceof InstancedMesh && object.instanceColor ? bytes(object.instanceColor.array) : null,
  }));
  let model: Group | null = null, transaction: ReturnType<typeof owners.stageExactOwnersV321> = null;
  try {
    expect(plan.owners).toHaveLength(37);
    expect(plan.owners.filter(o => o.components.some(c => Array.isArray(c.retire) && c.retire.length))).toHaveLength(37);
    expect(plan.owners.every(o => o.retireBody === false)).toBeTrue();
    expect(plan.owners.flatMap(o => o.components).filter(c => c.name === "LoD2 prism buildings" || c.name === "LoD2 prism ink lines").every(c => c.retire === false)).toBeTrue();
    const receipt = drain(owners.createExactOwnersSourceV321Steps(plan, p.buildings, control)); expect(receipt).not.toBeNull();
    expect(owners.stageExactOwnersV321(root, receipt!, () => fronts.hasCompleteWilhelmStreetFrontsV325(new Group(), false))).toBeNull();
    const source = drain(sources.bindWilhelmStreetFrontsV325SourcesSteps(p.buildings)); expect(source).not.toBeNull();
    model = drain(fronts.createWilhelmStreetFrontsV325Steps({ native: false, sourceReceipt: source! })); expect(model).not.toBeNull(); world.add(model!);
    const gate = () => model?.parent === world && fronts.hasCompleteWilhelmStreetFrontsV325(model!, false) && sources.hasWilhelmStreetFrontsV325Sources(source, false);
    expect(gate()).toBeTrue(); transaction = owners.stageExactOwnersV321(root, receipt!, gate); expect(transaction).not.toBeNull();
    expect(transaction!.activeOwners).toHaveLength(37); expect(transaction!.commit(gate)).toBeTrue(); expect(transaction!.complete()).toBeTrue();
    let retired = 0, retiredLines = 0, retiredInstances = 0;
    for (const s of snapshot) {
      for (const a of s.attributes) {
        expect(s.object.geometry.getAttribute(a.key)).toBe(a.attribute);
        expect(bytes(a.attribute instanceof InterleavedBufferAttribute ? a.attribute.data.array : a.attribute.array)).toBe(a.words);
      }
      if (s.object instanceof InstancedMesh) {
        expect(s.object.instanceColor).toBe(s.color); if (s.color) expect(bytes(s.color.array)).toBe(s.colorWords);
        const now = s.object.instanceMatrix.array, old = s.matrixWords!; expect(now.length).toBe(old.length);
        for (let row = 0; row < old.length / 16; row++) {
          const changed = Array.from({ length: 16 }, (_, i) => i).some(i => !Object.is(now[row * 16 + i], old[row * 16 + i]));
          if (!changed) continue; retired++; retiredInstances++;
          for (let i = 0; i < 16; i++) expect(now[row * 16 + i]).toBe([0, 1, 2, 4, 5, 6, 8, 9, 10].includes(i) ? 0 : old[row * 16 + i]);
        }
      } else if (s.object.geometry !== s.geometry) {
        expect(s.object).toBeInstanceOf(LineSegments);
        const now = s.object.geometry.index!.array, old = s.indexWords ?? Array.from({ length: s.geometry.getAttribute("position").count }, (_, i) => i);
        expect(now.length).toBe(old.length);
        for (let row = 0; row < old.length / 2; row++) {
          expect(now[row * 2]).toBe(old[row * 2]);
          if (!Object.is(now[row * 2 + 1], old[row * 2 + 1])) { retired++; retiredLines++; expect(now[row * 2 + 1]).toBe(old[row * 2]); }
        }
      }
      if (s.object.name === "LoD2 prism buildings" || s.object.name === "LoD2 prism ink lines") {
        expect(s.object.geometry).toBe(s.geometry); expect(s.object.geometry.index).toBe(s.index);
      }
    }
    expect(retired).toBe(630); expect(retiredLines).toBe(590); expect(retiredInstances).toBe(40);
    // An actual original source word revokes both private fronts proof and
    // the live Core gate; the exact old body/roof/ink/fitting refs return.
    const changed = p.buildings.find((b: any) => b.id === plan.owners[0].id), originalHeight = changed.h_dm;
    changed.h_dm++; expect(gate()).toBeFalse(); expect(transaction!.complete()).toBeFalse(); changed.h_dm = originalHeight;
    for (const s of snapshot) {
      expect(s.object.geometry).toBe(s.geometry); expect(s.object.geometry.index).toBe(s.index);
      if (s.object instanceof InstancedMesh) { expect(s.object.instanceMatrix).toBe(s.matrix); expect(Array.from(s.object.instanceMatrix.array)).toEqual(s.matrixWords); }
    }
  } finally {
    transaction?.rollback(); if (model) fronts.disposeWilhelmStreetFrontsV325(model);
    const resources = new Set<{ dispose(): void }>(); root.traverse(o => {
      if (o instanceof Mesh || o instanceof LineSegments) {
        resources.add(o.geometry); if (o instanceof InstancedMesh) resources.add(o);
        for (const material of [o.material, o.userData.dayMaterial, o.userData.nightMaterial].flat()) if (material instanceof Material) resources.add(material);
      }
    }); for (const resource of resources) resource.dispose(); root.clear(); world.clear();
  }
}, 30000);

function capturedV8Root(fixture: any): Group {
  const root = new Group();
  const types: Record<string, any> = { Float32Array, Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array };
  const words = (type: string, text: string): any => {
    const bytes = Buffer.from(text, "base64"), Type = types[type]; if (!Type) throw Error("Unknown captured word type");
    const storage = new Uint8Array(bytes.byteLength); storage.set(bytes); return new Type(storage.buffer);
  };
  for (const owner of fixture.owners) for (const part of owner.parts) {
    const geometry = new BufferGeometry();
    for (const [name, attr] of Object.entries(part.attributes) as [string, any][])
      geometry.setAttribute(name, new BufferAttribute(words(attr.type, attr.bytes), attr.itemSize, attr.normalized));
    if (part.index) geometry.setIndex(new BufferAttribute(words(part.index.type, part.index.bytes), 1));
    const material = new MeshBasicMaterial(), object = part.kind === "instances" ? new InstancedMesh(geometry, material, part.instances.count) :
      part.kind === "lines" ? new LineSegments(geometry, material) : new Mesh(geometry, material);
    if (object instanceof InstancedMesh) {
      object.instanceMatrix = new InstancedBufferAttribute(words("Float32Array", part.instances.matrix), 16);
      if (part.instances.color) object.instanceColor = new InstancedBufferAttribute(words("Float32Array", part.instances.color), 3);
    }
    object.name = part.name; object.userData.dayMaterial = material; object.userData.nightMaterial = material;
    root.add(object);
  }
  return root;
}
test("the independently captured complete V8 owners require their strict alternative and reject a changed original word", async () => {
  const [owners, fronts, sources] = await Promise.all([import("../src/ExactOwnersV321"), import("../src/WilhelmStreetFrontsV325"), import("../src/WilhelmStreetFrontsV325Sources")]);
  const raw = readFileSync(new URL("./fixtures/wilhelm-street-core-v325-v8.json", import.meta.url));
  expect(raw.byteLength).toBe(14197); expect(createHash("sha256").update(raw).digest("hex")).toBe("fc590dda6d8d113d1e1bc9cd630b32267bbeeac0dbfdaa96513049f25ae89f7b");
  const captured = JSON.parse(raw.toString()), p = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8"));
  expect(captured.engine.v8).toBe("14.6.202.34-node.20"); expect(captured.owners.map((o: any) => o.source.id).sort()).toEqual(["B6BxwVWS", "nRGU0hkP"]);
  for (const owner of captured.owners) expect(owner.source).toEqual(p.buildings.find((b: any) => b.id === owner.source.id));
  const root = capturedV8Root(captured), world = new Group().add(root), canonical = wilhelmStreetFrontsCorePlanV325(), variant = wilhelmStreetFrontsCorePlanV325(false, false, true);
  expect(canonical.plan.owners).toHaveLength(37); expect(variant.plan.owners).toHaveLength(37);
  expect(variant.plan.owners.filter((owner, i) => owner !== canonical.plan.owners[i]).map(o => o.id).sort()).toEqual(["B6BxwVWS", "nRGU0hkP"]);
  const canonicalSource = drain(owners.createExactOwnersSourceV321Steps(canonical.plan, p.buildings, canonical.control)); expect(canonicalSource).not.toBeNull();
  expect(owners.stageExactOwnersV321(root, canonicalSource!, true)).toBeNull();
  const variantSource = drain(owners.createExactOwnersSourceV321Steps(variant.plan, p.buildings, variant.control)); expect(variantSource).not.toBeNull();
  const body = root.children.find(o => o.name === "LoD2 prism buildings") as Mesh, position = body.geometry.getAttribute("position"), originalWord = position.array[0];
  position.array[0] += 0.001;
  expect(owners.stageExactOwnersV321(root, variantSource!, true)).toBeNull(); position.array[0] = originalWord;
  const source = drain(sources.bindWilhelmStreetFrontsV325SourcesSteps(p.buildings)); expect(source).not.toBeNull();
  const model = drain(fronts.createWilhelmStreetFrontsV325Steps({ native: false, sourceReceipt: source! })); expect(model).not.toBeNull(); world.add(model!);
  const gate = () => model?.parent === world && fronts.hasCompleteWilhelmStreetFrontsV325(model!, false) && sources.hasWilhelmStreetFrontsV325Sources(source, false);
  const snapshot = root.children.map(object => ({ object: object as Mesh, geometry: (object as Mesh).geometry, index: (object as Mesh).geometry.index,
    matrix: object instanceof InstancedMesh ? object.instanceMatrix : undefined }));
  const transaction = owners.stageExactOwnersV321(root, variantSource!, gate); expect(transaction).not.toBeNull();
  try {
    expect(transaction!.activeOwners.slice().sort()).toEqual(["B6BxwVWS", "nRGU0hkP"]); expect(transaction!.commit(gate)).toBeTrue(); expect(transaction!.complete()).toBeTrue();
    for (const s of snapshot.filter(s => s.object.name === "LoD2 prism buildings" || s.object.name === "LoD2 prism ink lines")) {
      expect(s.object.geometry).toBe(s.geometry); expect(s.object.geometry.index).toBe(s.index);
    }
    // The publication boundary repeats the full exact word proof; ordinary
    // readiness uses the established metadata/selected-word budget.
    position.array[0] += 0.001; expect(transaction!.commit(gate)).toBeFalse(); expect(transaction!.complete()).toBeFalse(); position.array[0] = originalWord;
    for (const s of snapshot) { expect(s.object.geometry).toBe(s.geometry); expect(s.object.geometry.index).toBe(s.index);
      if (s.object instanceof InstancedMesh) expect(s.object.instanceMatrix).toBe(s.matrix); }
  } finally {
    position.array[0] = originalWord; transaction?.rollback(); if (model) fronts.disposeWilhelmStreetFrontsV325(model);
    const resources = new Set<{ dispose(): void }>(); root.traverse(o => { if (o instanceof Mesh || o instanceof LineSegments) {
      resources.add(o.geometry); if (o instanceof InstancedMesh) resources.add(o); for (const material of [o.material].flat()) resources.add(material);
    } }); for (const resource of resources) resource.dispose(); root.clear(); world.clear();
  }
}, 30000);
