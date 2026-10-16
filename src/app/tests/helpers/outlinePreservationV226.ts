import { expect } from "bun:test";
import { Group } from "three";
import { projectOutlineV225ForTest } from "./outlinePreservationV225";

/** Project only the two new additive families; every older node and byte is
 * still checked by the frozen historical fixtures and their existing receipts. */
export function projectOutlineV226ForTest(root: Group, mode: "day" | "minecraft"): () => void {
  const native = mode === "minecraft";
  const records = [
    ["Steglitz A103 mapped bridge and approaches v226", "steglitzMotorwayV226"],
    ["Source-width Alt-Mitte sidewalk complements v226" + (native ? " native" : ""), "altMitteSidewalksV226"],
  ];
  const children = [...root.children];
  const additions = records.map(([name, marker]) => {
    const found = children.filter(child => child.name === name || child.userData[marker]);
    expect(found).toHaveLength(1);
    const child = found[0];
    expect(child).toBeInstanceOf(Group);
    expect(child.name).toBe(name);
    expect(child.parent).toBe(root);
    expect(child.userData[marker]).toBe(true);
    expect(child.userData.additiveOnly).toBe(true);
    expect(child.userData.nativeMinecraft).toBe(native);
    expect(child.userData.fullStaticDetailOnTouch).toBe(true);
    return child;
  });
  for (const child of additions) root.remove(child);
  let restoreV225: () => void;
  try { restoreV225 = projectOutlineV225ForTest(root, mode); }
  catch (error) {
    for (const child of additions) root.add(child);
    root.children = children;
    throw error;
  }
  return () => {
    restoreV225();
    for (const child of additions) root.add(child);
    root.children = children;
  };
}
