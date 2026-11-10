import { expect, test } from "bun:test";
import { InstancedMesh, PerspectiveCamera, Vector3 } from "three";
import { basinGeometryV332, createPublicAmenitiesV332 } from "../src/PublicAmenitiesV332";

test("the drawn basin preserves a hole and the Native surface uses only supplied cardinal cells", () => {
  const basin: Parameters<typeof basinGeometryV332>[0] = [
    "test", "site", 1, 1,
    [[[0, 0], [5, 0], [5, 5], [0, 5]], [[1, 1], [1, 4], [4, 4], [4, 1]]],
    [[0, 0, 5, 1], [0, 1, 1, 4], [4, 1, 5, 4], [0, 4, 5, 5]],
  ];
  for (const native of [false, true]) {
    const mesh = basinGeometryV332(basin, native, 4)!;
    const pos = mesh.getAttribute("position");
    const normal = mesh.getAttribute("normal");
    const index = mesh.getIndex()!;
    let area = 0;
    for (let i = 0; i < index.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map(k => new Vector3().fromBufferAttribute(pos, index.getX(i + k)));
      area += b.sub(a).cross(c.sub(a)).y / 2;
    }
    expect(area).toBe(16);
    expect(normal.getY(0)).toBe(1);
    mesh.dispose();
  }
});

test("resident amenities publish in both families, then release their local geometry", () => {
  const layer = createPublicAmenitiesV332();
  const camera = new PerspectiveCamera();
  camera.position.set(2200, 118, 2540);
  camera.lookAt(2144, 8, 2460);
  const blocked = () => false;
  const support = { ground: () => 5, water: () => false, blocked, hasHost: () => false };
  for (const [at, native] of [[1000, false], [2000, true]] as const) {
    expect(layer.refresh(at, camera, 2144, 2460, native, false, "de", 1, support)).toBe(true);
    expect(layer.root.children.some(child => child.name === "Mapped basin way/128279950:0")).toBe(true);
  }
  layer.refresh(3000, camera, 2144, 2460, false, false, "de", 2, { ...support, ground: () => null });
  expect(layer.root.children).toHaveLength(1);
  expect((layer.root.children[0] as InstancedMesh).count).toBe(0);
  layer.dispose();
  expect(layer.root.children).toHaveLength(0);
});
