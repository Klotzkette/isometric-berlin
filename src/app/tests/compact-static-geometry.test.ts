import { expect, test } from "bun:test";
import { BoxGeometry, BufferGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { compactStaticGeometry, compactStaticGeometrySteps } from "../src/compactStaticGeometry";
import { completeCooperatively } from "../src/cooperativeWork";
import { addBox, createBuilder, finishDrawnGroup } from "../src/drawnKit";
import { deserializeTransferredObject3D, serializeObject3DForTransfer } from "../src/transferableObject3D";

function renderedBytes(geometry: BufferGeometry): string[] {
  return Object.entries(geometry.attributes).map(([name, attribute]) => {
    const stride = attribute.itemSize * attribute.array.BYTES_PER_ELEMENT;
    const bytes = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
    const hasher = new Bun.CryptoHasher("sha256");
    for (let i = 0; i < (geometry.index?.count ?? attribute.count); i++) {
      const vertex = geometry.index?.getX(i) ?? i;
      hasher.update(bytes.subarray(vertex * stride, (vertex + 1) * stride));
    }
    return `${name}:${hasher.digest("hex")}`;
  });
}

test("publication compacts opted-in bodies and contours with identical rays and transferred primitives", () => {
  const builder = createBuilder();
  for (let i = 0; i < 24; i++) addBox(builder, 0xbca987, i * 2, 0, 0, 1, 2, 3, i * 0.13);
  const root = finishDrawnGroup(builder, { name: "immutable fixture" })!;
  root.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(0, 8, 0), new Vector3(0, -1, 0));
  const hits = () => ray.intersectObject(root, true).map(hit => [hit.distance, ...hit.point.toArray()]);
  const beforeHits = hits();
  expect(beforeHits.length).toBeGreaterThan(0);
  const before = root.children.map(object => renderedBytes((object as Mesh).geometry));
  let savings = 0;
  root.traverse(object => { savings += compactStaticGeometry(object); });
  expect(savings).toBeGreaterThan(5_000);
  expect(root.children.map(object => renderedBytes((object as Mesh).geometry))).toEqual(before);
  expect(hits()).toEqual(beforeHits);
  const positions = root.children.map(object => (object as Mesh).geometry.getAttribute("position"));
  root.traverse(object => { expect(compactStaticGeometry(object)).toBe(0); });
  expect(root.children.map(object => (object as Mesh).geometry.getAttribute("position"))).toEqual(positions);
  const transferred = deserializeTransferredObject3D(serializeObject3DForTransfer(root).object);
  expect(transferred.children.map(object => renderedBytes((object as Mesh).geometry))).toEqual(before);
  transferred.traverse(object => { expect(compactStaticGeometry(object)).toBe(0); });
});

test("unmarked authored or animated layouts remain untouched", () => {
  const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  const original = mesh.geometry.getAttribute("position");
  const root = new Group(); root.add(mesh);
  root.traverse(object => { expect(compactStaticGeometry(object)).toBe(0); });
  expect(mesh.geometry.getAttribute("position")).toBe(original);
});

test("cooperative preparation preserves every primitive and leaves unpublished work cancellable", async () => {
  const root = new Group();
  for (let index = 0; index < 12; index++) {
    const builder = createBuilder();
    addBox(builder, 0xbca987, index * 2, 0, 0, 1, 2, 3);
    root.add(finishDrawnGroup(builder, { name: `batch ${index}` })!);
  }
  const meshes: Mesh[] = [];
  root.traverse(object => { if (object instanceof Mesh) meshes.push(object); });
  const before = meshes.map(object => renderedBytes(object.geometry));
  let tasks = 0;
  await expect(completeCooperatively(compactStaticGeometrySteps(root), {
    budgetMs: 0,
    yieldTask: async () => { tasks++; },
    isCancelled: () => tasks === 3,
  })).rejects.toMatchObject({ name: "AbortError" });
  const completed = meshes.filter(object => object.geometry.userData.exactIndexPending === false);
  expect(completed.length).toBeGreaterThan(0);
  expect(completed.length).toBeLessThan(meshes.length);
  const positions = completed.map(object => object.geometry.getAttribute("position"));
  await completeCooperatively(compactStaticGeometrySteps(root), {
    budgetMs: 0, yieldTask: async () => {}, isCancelled: () => false,
  });
  expect(meshes.map(object => renderedBytes(object.geometry))).toEqual(before);
  expect(completed.map(object => object.geometry.getAttribute("position"))).toEqual(positions);
});
