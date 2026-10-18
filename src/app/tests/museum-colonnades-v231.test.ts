import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { createMuseumColonnadesV231 } from "../src/MuseumColonnadesV231";
import { museumColonnadesV231GroundAt as groundAt, museumColonnadesV231RoofAt as roofAt, museumColonnadesV231SolidAt as solidAt } from "../src/museumColonnadesV231Navigation";
import { createColonnadesCoreColumnTesterV231, isColonnadesCorePrismV231 } from "../src/colonnadesCorePreviousV231";
import data from "../src/data/colonnadesV231.json";
import nav from "../src/data/colonnadesV231Navigation.json";
import receipt from "../src/data/colonnadesCorePreviousV231.json";
import core from "../public/mesh/regierungsviertel/lod2-prisms.json";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

test("both renderers have exact-sized static full detail and independent native geometry", () => {
  for (const native of [false, true]) {
    const root = createMuseumColonnadesV231(native); let bytes = 0, count = 0;
    try {
      expect(root.children.length).toBe(native ? 1 : 3);
      root.traverse(o => {
        expect(o.matrixAutoUpdate).toBe(false);
        if (!(o instanceof Mesh)) return;
        count++; expect(o.userData.museumColonnadesV231).toBe(true);
        expect(o.userData.siteKey).toBe("kolonnadenhof"); expect(o.userData.requiredBeforeNavigation).toBe(true);
        expect(o.userData.nativeMinecraft).toBe(native); expect(o.frustumCulled).toBe(true);
        expect(o.geometry.getAttribute("uv")).toBeUndefined();
        for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
        if (o instanceof InstancedMesh) {
          bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
          expect(o.instanceMatrix.count).toBe(o.count);
          const m = new Matrix4();
          for (let i = 0; i < o.count; i += 19) {
            o.getMatrixAt(i, m); expect(m.elements.every(Number.isFinite)).toBe(true);
            if (native) for (const j of [1, 2, 4, 6, 8, 9]) expect(m.elements[j]).toBe(0);
          }
        }
      });
      expect(count).toBeLessThanOrEqual(3); expect(bytes).toBeLessThan(600000);
    } finally { disposeStaticAudit(root); }
  }
});

test("every complete measured roof triangle reaches the rendered position buffer unchanged", () => {
  const root = createMuseumColonnadesV231();
  try {
    const p = (root.children[0] as Mesh).geometry.getAttribute("position"); let i = 0;
    for (const s of data.sites[0].roofs) for (const t of s.triangles) for (const vertex of t) {
      expect([p.getX(i), p.getY(i), p.getZ(i)]).toEqual(vertex.map(Math.fround)); i++;
    }
  } finally { disposeStaticAudit(root); }
});

test("all six longitudinal paths stay open below the roof in both modes without upward teleport", () => {
  let checked = 0;
  for (const native of [false, true]) for (const route of nav.passageSamples) {
    for (const [x, , z] of route.points) {
      expect(solidAt(x, 6.4, z, .32, native)).toBe(false);
      expect(groundAt(x, z, 5.22, native)).toBeCloseTo(5.22, 3);
      const roof = roofAt(x, z, native); expect(roof).not.toBeNull();
      expect(roof!).toBeGreaterThan(12.5);
      expect(groundAt(x, z, roof!, native)).toBeCloseTo(roof!, 3);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(250);
  expect(groundAt(0, 0, 5.22)).toBeNull(); expect(groundAt(0, 0, 5.22, true)).toBeNull();
});

test("visible column bodies stop walkers but adjacent bays remain genuinely transparent", () => {
  for (const native of [false, true]) {
    const root = createMuseumColonnadesV231(native); root.updateMatrixWorld(true);
    try {
      const [x, z] = nav.columns[8];
      expect(solidAt(x, 6.5, z, .32, native)).toBe(true);
      const cast = new Raycaster(new Vector3(x, 6.5, z - 1.5), new Vector3(0, 0, 1), 0, 3);
      expect(cast.intersectObject(root, true).length).toBeGreaterThan(0);
      const a = nav.passageSamples[0].points[8], b = nav.passageSamples[0].points[9];
      const delta = new Vector3(b[0] - a[0], 0, b[2] - a[2]);
      const clear = new Raycaster(new Vector3(a[0], 6.5, a[2]), delta.clone().normalize(), 0, delta.length());
      expect(clear.intersectObject(root, true).length).toBe(0);
      const down = new Raycaster(new Vector3(a[0], 25, a[2]), new Vector3(0, -1, 0), 0, 30);
      expect(down.intersectObject(root, true)[0].point.y).toBeCloseTo(roofAt(a[0], a[2], native)!, 3);
    } finally { disposeStaticAudit(root); }
  }
});

test("only two exact closed proxies transfer; changed originals and every neighbour survive", () => {
  const original = core.buildings, retired = new Set(receipt.owners.map(o => o.prism.id));
  expect(original.filter(isColonnadesCorePrismV231).map(p => p.id).sort()).toEqual([...retired].sort());
  expect(original.filter(p => !isColonnadesCorePrismV231(p))).toEqual(original.filter(p => !retired.has(p.id)));
  for (const o of receipt.owners) {
    expect(isColonnadesCorePrismV231(o.prism)).toBe(true);
    expect(isColonnadesCorePrismV231({ ...o.prism, h_dm: o.prism.h_dm + 1 })).toBe(false);
    expect(isColonnadesCorePrismV231({ ...o.prism, tone: [0, 0, 0] })).toBe(false);
    const tester = createColonnadesCoreColumnTesterV231(original, receipt.cellM);
    for (const row of o.columns) expect(tester(row[0], row[1], row[2], row[3], row[4])).toBe(true);
    const row = o.columns[0], cx = (row[0] + .5) * receipt.cellM * 10, cz = (row[1] + .5) * receipt.cellM * 10;
    const added = { id: "unrelated-new-overlap", ring: [[cx - 5, cz - 5], [cx + 5, cz - 5], [cx + 5, cz + 5], [cx - 5, cz + 5]], y0_dm: 52, h_dm: 100 };
    expect(createColonnadesCoreColumnTesterV231([...original, added], receipt.cellM)(row[0], row[1], row[2], row[3], row[4])).toBe(false);
  }
  expect(isColonnadesCorePrismV231(original.find(p => p.id === "42698898")!)).toBe(false);
});
