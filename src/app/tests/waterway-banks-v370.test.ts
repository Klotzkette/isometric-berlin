import { expect, test } from "bun:test";
import { DataTexture, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { createWaterwayBanksV370 as create, type WaterwayBankV370 } from "../src/WaterwayBanksV370";

const record = (material: string, extra: Partial<WaterwayBankV370> = {}): WaterwayBankV370 => ({
  id: "sample",
  water: "Spree",
  material,
  points: [
    [0, 0],
    [8, 0],
  ],
  height: 2,
  ...extra,
});
const meshes = (group: ReturnType<typeof create>) => group.children as Mesh[];
const front = (g: ReturnType<typeof create>, x: number, y: number) =>
  new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1)).intersectObjects(g.children, false)[0];
const top = (g: ReturnType<typeof create>, x: number, z: number) =>
  new Raycaster(new Vector3(x, 15, z), new Vector3(0, -1, 0)).intersectObjects(g.children, false)[0];
const textureOf = (m: Mesh) => m.userData.nightMaterial.map as DataTexture;
const brick = (g: ReturnType<typeof create>) =>
  meshes(g).find((m) => m.userData.waterwayBankFinish === "brick")!;

test("rolled sheet piles have a folded face, coping, wet steel and projecting waler", () => {
  const g = create([record("steel")], 0);
  const valley = front(g, 0.09, 0.9),
    web = front(g, 0.265, 0.9),
    ridge = front(g, 0.4, 0.9);
  expect(valley.point.z).toBeCloseTo(0.13, 5);
  expect(web.point.z).toBeGreaterThan(0.17);
  expect(web.point.z).toBeLessThan(0.33);
  expect(ridge.point.z).toBeCloseTo(0.34, 5);
  expect(front(g, 0.4, 1.4).point.z).toBeCloseTo(0.405, 5);
  const wet = front(g, 0.4, 0.08);
  const ink = (hit: typeof wet) => (hit.object as Mesh).geometry.getAttribute("color").getX(hit.face!.a);
  expect(ink(wet)).toBeLessThan(ink(ridge));
  expect(top(g, 0.4, 0.14).point.y).toBeCloseTo(2, 5);
});

test("graded Panke Drawn and cardinal Native facings fit behind the extant painted strokes", () => {
  const drawn = create([record("brick", { topY: [1.5, 2.5], faceOffset: -0.055 })], 0);
  expect(front(drawn, 3.25, 0.6).point.z).toBeCloseTo(0.105, 5);
  expect(top(drawn, 4, 0.05).point.y).toBeCloseTo(2, 5);
  const native = create([record("brick", { topY: [1.5, 2.5], faceOffset: -0.012 })], 0, true);
  expect(front(native, 3.25, 0.6).point.z).toBeCloseTo(0.148, 5);
  expect(
    meshes(native).every((m) => m.userData.blockNative && m.material instanceof MeshStandardMaterial),
  ).toBe(true);
});

test("brick and stone show distinct, staggered, mipfiltered bonds in world metres", () => {
  const g = create([record("brick"), record("mixed-masonry")], -1),
    m = brick(g),
    tex = textureOf(m);
  expect(m.userData.dayMaterial.map).toBe(tex);
  expect(tex.minFilter).toBe(LinearMipmapLinearFilter);
  expect(tex.generateMipmaps).toBe(true);
  const { data, width, height } = tex.image;
  expect([width, height]).toEqual([64, 32]);
  const green = (x: number, y: number) => data[(y * width + x) * 4 + 1];
  expect(green(0, 5) - green(8, 5)).toBeGreaterThan(38);
  expect(green(8, 13) - green(0, 13)).toBeGreaterThan(38);
  expect(green(7, 8) - green(7, 6)).toBeGreaterThan(38);
  const stone = meshes(g).find((m) => m.userData.waterwayBankFinish === "mixed-masonry")!;
  expect(textureOf(stone).image.data).not.toEqual(data);
  const uv = m.geometry.getAttribute("uv"),
    pos = m.geometry.getAttribute("position");
  expect(uv.getX(1) - uv.getX(0)).toBeCloseTo((pos.getX(1) - pos.getX(0)) / 1.08, 5);
  expect(uv.getY(3) - uv.getY(0)).toBeCloseTo((pos.getY(3) - pos.getY(0)) / 0.34, 5);
});

test("natural and stone-paved banks slope outwards from the crown on the recorded water side", () => {
  for (const [material, profile] of [
    ["stone", "paved-slope"],
    ["natural", "sand"],
    ["natural", "bank"],
  ]) {
    const g = create(
      [record(material, { profile, waterSide: -1, width: 3, waterY: 0.25, topY: [3, 4] })],
      -9,
    );
    const crest = top(g, 4, 0.06),
      mid = top(g, 4, -1.5),
      toe = top(g, 4, -2.9);
    expect(crest.point.y).toBeGreaterThan(3.45);
    expect(mid.point.y).toBeLessThan(crest.point.y - 1.4);
    expect(toe.point.y).toBeLessThan(mid.point.y - 1.3);
    expect(top(g, 4, 1)).toBeUndefined();
    if (profile === "paved-slope") expect(textureOf(mid.object as Mesh)).toBeInstanceOf(DataTexture);
  }
});

test("Native diagonal banks and optional reeds use cardinal block faces", () => {
  const rec = record("natural", {
    points: [
      [0, 0],
      [12, 9],
    ],
    width: 2.4,
    waterY: 0,
    height: 1.5,
  });
  for (const native of [false, true]) {
    const plain = create([rec], 0, native),
      reed = create([{ ...rec, reed: true }], 0, native);
    const triangles = (g: typeof plain) => meshes(g).reduce((n, m) => n + m.geometry.index!.count / 3, 0);
    expect(triangles(reed)).toBeGreaterThan(triangles(plain));
    if (native)
      for (const m of meshes(reed)) {
        const normal = m.geometry.getAttribute("normal");
        let cardinal = true;
        for (let i = 0; i < normal.count; i++)
          cardinal &&=
            [normal.getX(i), normal.getY(i), normal.getZ(i)].filter((v) => Math.abs(v) > 1e-5).length === 1;
        expect(cardinal).toBe(true);
      }
  }
});

test("eviction of one bank tile leaves the next tile's material map resident", () => {
  const a = brick(create([record("brick")], 0)),
    b = brick(create([record("brick")], 0));
  const tex = textureOf(a),
    other = textureOf(b);
  expect(other).not.toBe(tex);
  expect(other.image.data).toBe(tex.image.data);
  let disposed = 0,
    foreign = 0;
  tex.addEventListener("dispose", () => disposed++);
  other.addEventListener("dispose", () => foreign++);
  a.userData.dayMaterial.dispose();
  expect(disposed).toBe(0);
  a.userData.nightMaterial.dispose();
  expect(disposed).toBe(1);
  expect(foreign).toBe(0);
  b.userData.nightMaterial.dispose();
  other.dispose();
  b.userData.dayMaterial.dispose();
  expect(foreign).toBe(1);
});

test("unusable input emits no geometry and long banks are locally culled", () => {
  expect(
    create(
      [
        record("steel", {
          points: [
            [1, 1],
            [1, 1],
          ],
        }),
        record("stone"),
      ],
      NaN,
    ).children,
  ).toHaveLength(0);
  const g = create(
    [
      record("concrete", {
        points: [
          [10, 2],
          [519, 2],
        ],
        topY: [0, 3],
      }),
    ],
    (_x, _z, water) => (water === "Spree" ? -0.6 : NaN),
  );
  expect(g.children.length).toBeGreaterThan(1);
  expect(meshes(g).every((m) => m.geometry.boundingSphere!.radius < 155)).toBe(true);
});

test("a surveyed brick plinth has a low masonry toe and a turf shoulder in both families", () => {
  for (const native of [false, true]) {
    const g = create(
      [record("brick", { brickPlinthHeight: 1.2, width: 0.9, waterY: 0, height: 3 })],
      0,
      native,
    );
    const toe = front(g, 2.7, 0.75),
      shoulder = front(g, 2.7, 2.3),
      crest = top(g, 2.7, 0.06);
    expect(toe.object.userData.waterwayBankFinish).toBe("brick");
    expect(toe.point.z).toBeCloseTo(0.9, 4);
    expect(shoulder.object.userData.waterwayBankFinish).toBe("plain");
    expect(shoulder.point.z).toBeLessThan(0.7);
    expect(crest.point.y).toBeGreaterThan(2.65);
  }
});

test("only recorded planted sheet piles have a waterline planting shelf in front of the folds", () => {
  for (const native of [false, true]) {
    const bare = create([record("steel")], 0, native);
    const planted = create([record("steel", { reed: true })], 0, native);
    const strip = top(planted, 1.27, 0.82);
    expect(strip.point.y).toBeGreaterThan(0);
    expect(strip.point.y).toBeLessThan(0.23);
    expect(top(bare, 1.27, 0.82)).toBeUndefined();
    expect(front(planted, 1.27, 0.02).point.z).toBeCloseTo(0.89, 4);
    expect(front(bare, 1.27, 0.02).point.z).toBeLessThan(0.4);
  }
});
