import { expect, test } from "bun:test";
import { Color, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import companion from "../src/data/courtsParkV293.json";
import recognition from "../src/data/districtCourtsV229.json";
import envelopes from "../src/data/districtCourtsV229Native.json";
import { createWeddingCourtV333, weddingCourtV333PreviousPanes } from "../src/WeddingCourtV333";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const site = recognition.sites.find(s => s.key === "wedding")!;
const wall = envelopes.sites.find(s => s.key === "wedding")!;
const center = new Vector3(254.6545, 0, -3439.5005);
const tangent = new Vector3(.6998499207070085, 0, .7142899190709567);
const outward = new Vector3(-tangent.z, 0, tangent.x);
const between = (i: number, ranges: number[][]) => ranges.some(([a, b]) => i >= a && i <= b);

test("the shared V293 recognition proof covers the overlapping panes and plaque", () => {
  const original = companion.sites.find(s => s.key === "wedding")!;
  const mask = weddingCourtV333PreviousPanes(original)!;
  expect([...mask]).toEqual([284, 285, 286, 291, 292, 293, 298, 299, 300, 305, 306, 307]);
  expect(weddingCourtV333PreviousPanes({...original, label: {...original.label, height: .31}})).toBeNull();
  const changed = structuredClone(original);
  changed.panes[284][1] += .01;
  expect(weddingCourtV333PreviousPanes(changed)).toBeNull();
});

test("Wedding replaces only the exact conflicting recognition rows in each original mode", () => {
  const original = JSON.stringify(site);
  for (const native of [false, true]) {
    const result = createWeddingCourtV333(site, native)!;
    expect(result).not.toBeNull();
    try {
      if (native) {
        const retired = [[2564, 2608], [2653, 2673], [2702, 2722], [2751, 2771], [4527, 4536], [4820, 4871]];
        expect(result.rows).toEqual(site.nativeRows.filter((_, i) => !between(i, retired)));
        expect(result.rods).toHaveLength(0);
      } else {
        const retired = [[1136, 1147], [1164, 1175], [1192, 1203], [1220, 1231], [1960, 1960], [2056, 2061]];
        expect(result.rows.slice(0, -2)).toEqual(site.boxes.filter((_, i) => !between(i, retired)));
        expect(result.rods).toEqual(site.rods.filter((_, i) => !between(i, [[144, 149], [178, 187]])));
        const [a, b] = result.rows.slice(-2);
        expect(a[3] + b[3] + 2 * 3.58).toBeCloseTo(site.boxes[1960][3], 10);
      }
      expect(result.labels).toHaveLength(0);
      expect(JSON.stringify(site)).toBe(original);
      const changed = structuredClone(site);
      (native ? changed.nativeRows[0] : changed.boxes[0])[1] += .01;
      expect(createWeddingCourtV333(changed, native)).toBeNull();
      expect(createWeddingCourtV333({...site, key: "wedding-mahn"}, native)).toBeNull();
    } finally {
      disposeStaticAudit(result.root);
    }
  }
});

test("the drawn exterior has the two dark doors, raised centre pier and glazed tracery", () => {
  const {root} = createWeddingCourtV333(site, false)!;
  const mesh = root.children[0] as Mesh;
  try {
    root.updateMatrixWorld(true);
    const sample = (u: number, y: number) => {
      const start = center.clone().addScaledVector(tangent, u).addScaledVector(outward, 6);
      start.y = y;
      const hit = new Raycaster(start, outward.clone().negate()).intersectObject(mesh)[0];
      if (!hit?.face) return null;
      const colors = mesh.geometry.getAttribute("color");
      return new Color(colors.getX(hit.face.a), colors.getY(hit.face.a), colors.getZ(hit.face.a)).getHex();
    };
    expect(sample(-2.13, 7.2)).toBe(0x293e3b);
    expect(sample(2.13, 7.2)).toBe(0x293e3b);
    expect(sample(0, 7.2)).toBe(0xa99d89);
    expect(sample(.55, 14.22)).toBe(0x394a51);
    expect(sample(0, 14.22)).toBe(0xc0b5a1);
    expect(sample(4.95, 7.08)).toBe(0xd2cbc0);
    expect(sample(6, 14)).toBeNull();
    expect(sample(0, 26.5)).toBeNull();
    const position = mesh.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const p = new Vector3().fromBufferAttribute(position, i).sub(center);
      expect(Math.abs(p.dot(tangent))).toBeLessThan(5.3);
      expect(p.dot(outward)).toBeGreaterThan(.024);
      expect(p.dot(outward)).toBeLessThan(.762);
      expect(p.y).toBeGreaterThan(5.2);
      expect(p.y).toBeLessThan(26);
    }
    const {budget} = staticGeometryAudit(root);
    expect(budget.draws).toBe(1);
    expect(budget.bytes).toBeLessThan(270_000);
    expect(root.matrixAutoUpdate).toBe(false);
    expect(mesh.matrixAutoUpdate).toBe(false);
  } finally {
    disposeStaticAudit(root);
  }
});

test("native tracery blocks are cardinal and touch the independently delivered wall faces", () => {
  const {root} = createWeddingCourtV333(site, true)!;
  const mesh = root.children[0] as InstancedMesh;
  try {
    const colors = new Set<number>();
    const m = new Matrix4(), tint = new Color();
    const wallColumns = wall.blocks.filter(([, y, , , h]) => y - h / 2 <= 5.2 && y + h / 2 >= 25.8);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      mesh.getColorAt(i, tint);
      colors.add(tint.getHex());
      const [width, , , , , height, , , , , depth, , x, y, z] = m.elements;
      for (const offAxis of [1, 2, 4, 6, 8, 9]) expect(m.elements[offAxis]).toBe(0);
      expect(wallColumns.some(([bx, by, bz, w, h, d]) =>
        Math.abs(x - bx) + width / 2 <= w / 2 + .0001 &&
        Math.abs(y - by) + height / 2 <= h / 2 &&
        Math.abs(z - depth / 2 - (bz + d / 2 - .012)) < .00025)).toBe(true);
    }
    for (const color of [0x293e3b, 0x394a51, 0xa99d89, 0xc0b5a1]) expect(colors.has(color)).toBe(true);
    const {budget} = staticGeometryAudit(root);
    expect(budget.draws).toBe(1);
    expect(budget.bytes).toBeLessThan(85_000);
    expect(mesh.userData.keepInMinecraft).toBe(true);
    expect(mesh.userData.dayMaterial).not.toBe(mesh.userData.nightMaterial);
  } finally {
    disposeStaticAudit(root);
  }
});
