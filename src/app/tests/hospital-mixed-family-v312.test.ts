import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Group, InstancedMesh, Mesh } from "three";
import { createHospitalRecognitionV228 } from "../src/HospitalRecognitionV228";
import { createHospitalEnvelopesV228 } from "../src/HospitalEnvelopesV228";
import { createBundeswehrHospitalV214 } from "../src/BundeswehrHospitalV214";
import { createHospitalArchitectureV308 } from "../src/HospitalArchitectureV308";
import { applyHospitalPreviousV308 } from "../src/HospitalArchitectureV308Previous";
import { disposeOutlineConstruction } from "../src/OutlineLandmarksV182";

const words = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
const hash = (a: ArrayBufferView) => createHash("sha256").update(words(a)).digest("hex");
function fixture() {
  const scene = new Group(), outline = new Group(); scene.add(outline);
  const families = [false, true].map(native => {
    const world = new Group(), recognition = createHospitalRecognitionV228(native), envelopes = createHospitalEnvelopesV228(native), replacement = createHospitalArchitectureV308(native);
    world.add(recognition, envelopes, replacement); scene.add(world);
    return {world, recognition, envelopes, replacement};
  });
  function ward(native: boolean) {
    const group = createBundeswehrHospitalV214(native); outline.add(group);
    return group.children.find(child => child instanceof InstancedMesh) as InstancedMesh;
  }
  function pins() {
    const result: string[] = [];
    for (const family of families) for (const root of [family.recognition, family.envelopes]) root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      for (const attribute of Object.values(object.geometry.attributes)) result.push(hash(attribute.array));
      if (object.geometry.index) result.push(hash(object.geometry.index.array));
      if (object instanceof InstancedMesh) { result.push(hash(object.instanceMatrix.array)); if (object.instanceColor) result.push(hash(object.instanceColor.array)); }
    });
    return result;
  }
  function close() {
    for (const native of [false, true]) applyHospitalPreviousV308(scene, native, false, families[Number(native)].replacement, families[Number(native)].world);
    disposeOutlineConstruction(scene);
  }
  return {scene, outline, families, ward, pins, close};
}

test("coexisting complete worlds retain strict default counts and scope only their own facade family", () => {
  const f = fixture(), [drawn, native] = f.families, ward = f.ward(false), original = hash(ward.instanceMatrix.array), before = f.pins();
  try {
    native.world.visible = false;
    // The historical whole-scene API still rejects mixed named duplicates.
    expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement)).toBe(false);
    expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, drawn.world)).toBe(true);
    expect(native.recognition.children.every(child => child.visible)).toBe(true);
    expect(native.envelopes.children.every(child => child.visible)).toBe(true);
    expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, native.world)).toBe(false);
    expect(hash(ward.instanceMatrix.array)).toBe(original);
    expect(f.pins()).toEqual(before);
  } finally { f.close(); }
});

test("shared outline ward replacement returns every old row and strictly re-admits Drawn after Native", () => {
  const f = fixture(), [drawn, native] = f.families, first = f.ward(false), original = hash(first.instanceMatrix.array), before = f.pins();
  try {
    native.world.visible = false;
    expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, drawn.world)).toBe(true);
    // The exact release utility used inside the actual outline setMode.
    disposeOutlineConstruction(f.outline); const middle = f.ward(true), nativeOriginal = hash(middle.instanceMatrix.array);
    drawn.world.visible = false; native.world.visible = true;
    expect(applyHospitalPreviousV308(f.scene, true, true, native.replacement, native.world)).toBe(true);
    disposeOutlineConstruction(f.outline); const last = f.ward(false), lastOriginal = hash(last.instanceMatrix.array);
    native.world.visible = false; drawn.world.visible = true;
    expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, drawn.world)).toBe(true);
    expect(hash(first.instanceMatrix.array)).toBe(original);
    expect(native.recognition.children.some(child => !child.visible)).toBe(true);
    expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, drawn.world)).toBe(true);
    expect(applyHospitalPreviousV308(f.scene, false, false, drawn.replacement, drawn.world)).toBe(false);
    expect(hash(last.instanceMatrix.array)).toBe(lastOriginal);
    expect(applyHospitalPreviousV308(f.scene, true, false, native.replacement, native.world)).toBe(false);
    expect(hash(middle.instanceMatrix.array)).toBe(nativeOriginal);
    expect(f.pins()).toEqual(before);
  } finally { f.close(); }
});

test("foreign duplicate facades and wards plus attached authored disposal remain closed", () => {
  const f = fixture(), [drawn] = f.families, ward = f.ward(false), original = hash(ward.instanceMatrix.array);
  try {
    const selected = drawn.recognition.children.find(child => child.name === "Charité Campus Benjamin Franklin source-attached facade")!;
    const duplicate = selected.clone(); drawn.world.add(duplicate);
    expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, drawn.world)).toBe(false);
    duplicate.removeFromParent();
    const extra = f.ward(false);
    expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, drawn.world)).toBe(false);
    extra.parent!.removeFromParent();
    expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, drawn.world)).toBe(true);
    ward.geometry.dispose();
    expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, drawn.world)).toBe(false);
    expect(hash(ward.instanceMatrix.array)).toBe(original);
    expect(drawn.recognition.children.every(child => child.visible)).toBe(true);
    expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, drawn.world)).toBe(false);
    disposeOutlineConstruction(extra.parent!);
  } finally { f.close(); }
});

test("detached ward cannot excuse disposed facades or move the canonical replacement to a foreign host", () => {
  for (const damageFacade of [false, true]) {
    const f = fixture(), [drawn] = f.families; f.ward(false);
    try {
      expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, drawn.world)).toBe(true);
      if (damageFacade) (drawn.recognition.children.find(child => child.name === "Charité Campus Benjamin Franklin source-attached facade") as Mesh).geometry.dispose();
      disposeOutlineConstruction(f.outline);
      const newWard = f.ward(false);
      if (!damageFacade) { const foreign = new Group(); f.scene.add(foreign); foreign.add(newWard.parent!); }
      expect(applyHospitalPreviousV308(f.scene, false, true, drawn.replacement, drawn.world)).toBe(false);
      expect(drawn.recognition.children.every(child => child.visible)).toBe(true);
    } finally { f.close(); }
  }
});
