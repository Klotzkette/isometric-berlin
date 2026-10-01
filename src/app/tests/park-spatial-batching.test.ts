import { expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import {
  BufferGeometry, Frustum, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Vector3, type Object3D,
} from "three";
import parkDetailsJson from "../public/mesh/regierungsviertel/park-details.json";
import {
  createParkDetails, PARK_STATIC_INSTANCE_CELL_M, type ParkDetailsPayload,
} from "../src/ParkDetails";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

const payload = parkDetailsJson as unknown as ParkDetailsPayload;

/** Partition-independent digest of every original matrix/color byte. */
function instances(root: Object3D) {
  const families = new Map<string, Buffer[]>();
  let batches = 0, count = 0, bytes = 0;
  root.traverse(object => {
    if (!(object instanceof InstancedMesh)) return;
    batches++; count += object.count;
    bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
    const name = object.userData.staticSpatialSourceName ?? object.name;
    let records = families.get(name);
    if (!records) families.set(name, records = []);
    for (let index = 0; index < object.count; index++) {
      const matrix = object.instanceMatrix.array;
      const color = object.instanceColor?.array;
      records.push(Buffer.concat([
        Buffer.from(matrix.buffer, matrix.byteOffset + index * 64, 64),
        ...(color ? [Buffer.from(color.buffer, color.byteOffset + index * 12, 12)] : []),
      ]));
    }
  });
  const hasher = new Bun.CryptoHasher("sha256");
  for (const [name, records] of [...families].sort(([a], [b]) => a.localeCompare(b))) {
    hasher.update(name);
    for (const record of records.sort(Buffer.compare)) hasher.update(record);
  }
  return { batches, count, bytes, hash: hasher.digest("hex") };
}

function frame(root: Object3D, position: number[], target: number[]) {
  const camera = new PerspectiveCamera(39, 1.6, .25, 20_000);
  camera.position.fromArray(position); camera.lookAt(new Vector3().fromArray(target));
  camera.updateMatrixWorld(true); root.updateMatrixWorld(true);
  const frustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let draws = 0, submittedInstances = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    let visible = true;
    for (let parent: Object3D | null = object; parent; parent = parent.parent) visible &&= parent.visible;
    if (!visible || (object.frustumCulled && !frustum.intersectsObject(object))) return;
    draws++;
    if (object instanceof InstancedMesh) submittedInstances += object.count;
  });
  return { draws, submittedInstances };
}

test("512 m park cells preserve every instance byte and reduce panorama submissions", () => {
  const previous = createParkDetails(payload, { spatialCellM: 256, settledDetail: false });
  const before = instances(previous);
  const wideBefore = frame(previous, [0, 7_000, 7_000], [0, 0, 0]);
  disposeStaticAudit(previous);
  Bun.gc(true);
  const current = createParkDetails(payload, { settledDetail: false });
  const after = instances(current);
  const wideAfter = frame(current, [0, 7_000, 7_000], [0, 0, 0]);
  expect(PARK_STATIC_INSTANCE_CELL_M).toBe(512);
  expect(after.hash).toBe(before.hash);
  expect(after.count).toBe(before.count);
  expect(after.bytes).toBe(before.bytes);
  expect(after.batches).toBeLessThan(before.batches * .5);
  expect(wideAfter.draws).toBeLessThan(wideBefore.draws * .65);
  expect(wideAfter.submittedInstances).toBe(wideBefore.submittedInstances);

  // A cell crossing a close camera boundary remains eligible in its entirety.
  // Every authored instance box lies within the retained conservative cell box.
  const matrix = new Matrix4(), point = new Vector3();
  let checkedInstances = 0, outsideBoxes = 0, outsideSpheres = 0;
  current.traverse(object => {
    if (!(object instanceof InstancedMesh) || !object.userData.staticSpatialCell) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const bounds = object.geometry.boundingBox!;
    for (let index = 0; index < object.count; index++) {
      object.getMatrixAt(index, matrix);
      // The primitive's box encloses all its vertices; its eight transformed
      // corners are enough to prove the cell sphere retains its full envelope.
      for (let corner = 0; corner < 8; corner++) {
        point.set(corner & 1 ? bounds.max.x : bounds.min.x,
          corner & 2 ? bounds.max.y : bounds.min.y,
          corner & 4 ? bounds.max.z : bounds.min.z).applyMatrix4(matrix);
        if (!object.boundingBox!.containsPoint(point)) outsideBoxes++;
        if (point.distanceTo(object.boundingSphere!.center) > object.boundingSphere!.radius + 1e-7) outsideSpheres++;
      }
      checkedInstances++;
    }
  });
  expect(checkedInstances).toBeGreaterThan(400_000);
  expect(outsideBoxes).toBe(0);
  expect(outsideSpheres).toBe(0);
  disposeStaticAudit(current);
}, 60_000);

/** Expand indices back to the complete ordered GPU vertex-attribute stream. */
function expandedGeometry(root: Object3D) {
  const hash = new Bun.CryptoHasher("sha256");
  const digests = new Map<BufferGeometry, string>();
  let sourceCorners = 0, primitiveVertices = 0, storedVertices = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry;
    const corners = geometry.index?.count ?? geometry.getAttribute("position").count;
    if (object instanceof InstancedMesh) {
      sourceCorners += corners * object.count;
      primitiveVertices += geometry.getAttribute("position").count * object.count;
    }
    let digest = digests.get(geometry);
    if (!digest) {
      storedVertices += geometry.getAttribute("position").count;
      const vertices = new Bun.CryptoHasher("sha256");
      vertices.update(JSON.stringify({ groups: geometry.groups, drawRange: geometry.drawRange }));
      for (const name of Object.keys(geometry.attributes).sort()) {
        const attribute = geometry.getAttribute(name);
        vertices.update(JSON.stringify([name, attribute.itemSize, attribute.normalized, attribute.gpuType]));
        const stride = attribute.itemSize * attribute.array.BYTES_PER_ELEMENT;
        const bytes = new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
        const expanded = new Uint8Array(corners * stride);
        for (let corner = 0; corner < corners; corner++) {
          const vertex = geometry.index?.getX(corner) ?? corner;
          expanded.set(bytes.subarray(vertex * stride, (vertex + 1) * stride), corner * stride);
        }
        vertices.update(expanded);
      }
      digest = vertices.digest("hex");
      digests.set(geometry, digest);
    }
    hash.update(object.name); hash.update(digest);
  });
  return { hash: hash.digest("hex"), sourceCorners, primitiveVertices, storedVertices };
}

test("exact park primitive indexing preserves every expanded attribute and triangle order", () => {
  const beforeRoot = createParkDetails(payload, { exactPrimitiveIndex: false, settledDetail: false });
  const before = expandedGeometry(beforeRoot);
  const beforeInstances = instances(beforeRoot);
  disposeStaticAudit(beforeRoot); Bun.gc(true);
  const afterRoot = createParkDetails(payload, { settledDetail: false });
  const after = expandedGeometry(afterRoot);
  expect(after.hash).toBe(before.hash);
  expect(after.sourceCorners).toBe(before.sourceCorners);
  expect(instances(afterRoot)).toEqual(beforeInstances);
  expect(after.primitiveVertices).toBeLessThan(before.primitiveVertices * .5);
  expect(after.storedVertices).toBeLessThan(before.storedVertices);
  disposeStaticAudit(afterRoot);
}, 60_000);
