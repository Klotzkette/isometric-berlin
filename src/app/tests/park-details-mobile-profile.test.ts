import { describe, expect, test } from "bun:test";
import {
  BufferGeometry,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  type Object3D,
  Vector3,
} from "three";

import parkDetailsJson from "../public/mesh/regierungsviertel/park-details.json";
import {
  type ParkDetailsPayload,
  createParkDetails,
  decodeTrees,
  smoothParkPathPoints,
} from "../src/ParkDetails";

import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const payload = parkDetailsJson as unknown as ParkDetailsPayload;

type ParkGeometryBudget = {
  geometryBytes: number;
  instanceBytes: number;
  instances: number;
  instancedMeshes: number;
  mappedMaterials: number;
  meshes: number;
  objects: number;
  transparentMaterials: number;
  triangles: number;
  vertices: number;
};

const FROZEN_FULL_BUDGET: ParkGeometryBudget = {
  geometryBytes: 6_428_830,
  instanceBytes: 33_793_136,
  instances: 450_029,
  instancedMeshes: 5_373,
  mappedMaterials: 9,
  meshes: 6_753,
  objects: 7_173,
  transparentMaterials: 1,
  triangles: 125_921,
  vertices: 172_864,
};

function geometryBudget(root: Object3D): ParkGeometryBudget {
  // Spatial batches share their original geometry; count resident resources,
  // not the same vertex/index buffer once again for every culled cell.
  const geometries = new Set<BufferGeometry>();
  const buffers = new Set<ArrayBufferLike>();
  const budget: ParkGeometryBudget = {
    geometryBytes: 0,
    instanceBytes: 0,
    instances: 0,
    instancedMeshes: 0,
    mappedMaterials: 0,
    meshes: 0,
    objects: 0,
    transparentMaterials: 0,
    triangles: 0,
    vertices: 0,
  };
  root.traverse((object) => {
    budget.objects += 1;
    if (!(object instanceof Mesh)) {
      return;
    }
    budget.meshes += 1;
    const position = object.geometry.getAttribute("position");
    const index = object.geometry.getIndex();
    if (!geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      budget.vertices += position?.count ?? 0;
      budget.triangles += index ? index.count / 3 : (position?.count ?? 0) / 3;
    }
    for (const attribute of Object.values(object.geometry.attributes)) {
      if (!buffers.has(attribute.array.buffer)) {
        buffers.add(attribute.array.buffer);
        budget.geometryBytes += attribute.array.buffer.byteLength;
      }
    }
    if (index && !buffers.has(index.array.buffer)) {
      buffers.add(index.array.buffer);
      budget.geometryBytes += index.array.buffer.byteLength;
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const surface of materials) {
      if ("map" in surface && surface.map) {
        budget.mappedMaterials += 1;
      }
      if (surface.transparent || surface.opacity < 1) {
        budget.transparentMaterials += 1;
      }
    }
    if (object instanceof InstancedMesh) {
      budget.instancedMeshes += 1;
      budget.instances += object.count;
      budget.instanceBytes += object.instanceMatrix.array.byteLength;
      budget.instanceBytes += object.instanceColor?.array.byteLength ?? 0;
    }
  });
  return budget;
}

function instanceBatches(root: Object3D | undefined): InstancedMesh[] {
  expect(root).toBeDefined();
  const result: InstancedMesh[] = [];
  root?.traverse((object) => {
    if (object instanceof InstancedMesh) result.push(object);
  });
  expect(result.length).toBeGreaterThan(0);
  return result;
}

function* instanceMatrices(meshes: InstancedMesh[]): Generator<Matrix4> {
  const matrix = new Matrix4();
  for (const mesh of meshes) {
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      yield matrix;
    }
  }
}

function instanceCount(meshes: InstancedMesh[]): number {
  return meshes.reduce((total, mesh) => total + mesh.count, 0);
}

function finiteArray(values: ArrayLike<number>): boolean {
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) {
      return false;
    }
  }
  return true;
}

function drawableCount(root: Object3D): number {
  let count = 0;
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      count += 1;
    }
  });
  return count;
}

describe("coarse-pointer ParkDetails profile", () => {
  test("keeps geometry/instance storage unchanged with the full spatial batch budget", () => {
    const implicit = createParkDetails(payload, { settledDetail: false });
    const explicit = createParkDetails(payload, {
      detailProfile: "full",
      settledDetail: false,
    });
    expect(geometryBudget(implicit)).toEqual(FROZEN_FULL_BUDGET);
    expect(geometryBudget(explicit)).toEqual(FROZEN_FULL_BUDGET);
    expect(explicit.userData).toEqual(implicit.userData);
    expect(explicit.children.map((child) => child.name)).toEqual(
      implicit.children.map((child) => child.name),
    );
  });

  test("touch retains the full path, tree, shrub, wall and playground geometry", () => {
    Bun.gc(true);
    const full = createParkDetails(payload, { detailProfile: "full", settledDetail: false });
    const fullAudit = staticGeometryAudit(full);
    const fullDraws = drawableCount(full);
    const fullMetadata = full.userData;
    disposeStaticAudit(full);
    const mobile = createParkDetails(payload, { detailProfile: "mobile", settledDetail: false });
    expect(geometryBudget(mobile)).toEqual(FROZEN_FULL_BUDGET);
    expect(staticGeometryAudit(mobile)).toEqual(fullAudit);
    expect(drawableCount(mobile)).toBe(fullDraws);
    expect(mobile.userData).toEqual(fullMetadata);

    const paths = mobile.children.filter(child => child.name.endsWith("batched path ribbons")) as Mesh[];
    const expectedPathVertices = payload.paths.reduce((sum, path) => {
      const points = smoothParkPathPoints(path).filter((point, index, entries) =>
        index === 0 || Math.hypot(point.x - entries[index - 1].x, point.z - entries[index - 1].z) >= 0.05);
      return sum + (points.length >= 2 ? points.length * 2 : 0);
    }, 0);
    expect(paths.reduce((sum, mesh) => sum + mesh.geometry.getAttribute("position").count, 0)).toBe(expectedPathVertices);
    expect(mobile.userData.pathCount).toBe(payload.paths.length);
    expect(mobile.userData.playgroundCount).toBe(payload.playgrounds.length);
    const playgrounds = mobile.children.filter(child => child.name.endsWith("OSM playground details"));
    expect(playgrounds).toHaveLength(payload.playgrounds.length);
    expect(mobile.getObjectByName("Spielplatz an der Luiseninsel OSM playground details")?.children.length).toBeGreaterThan(1);

    const trees = decodeTrees(payload.trees, payload.tree_vocabulary);
    const trunks = instanceBatches(mobile.getObjectByName("OSM instanced granular tree trunks"));
    expect(instanceCount(trunks) + mobile.userData.signatureTreeCount).toBe(mobile.userData.treeCount);
    expect(mobile.userData.treeCount + mobile.userData.suppressedConstructionTreeCount + mobile.userData.suppressedTunnelApproachTreeCount).toBe(trees.length);
    const anchors = new Set(trees.map(tree => `${Math.fround(tree.position[0])}:${Math.fround(tree.position[2])}`));
    const position = new Vector3();
    for (const matrix of instanceMatrices(trunks)) {
      expect(finiteArray(matrix.elements)).toBeTrue();
      position.setFromMatrixPosition(matrix);
      expect(anchors.has(`${position.x}:${position.z}`)).toBeTrue();
    }
    for (const name of [
      "OSM instanced granular tree fork branches",
      "OSM polygon-bounded diverse Tiergarten shrub clumps",
      "OSM finite Tiergarten hedge foliage lobes",
      "Geoportal Berlin official public-lighting masts",
      "Official Vorderlandmauer double row of individual granite setts",
      "Snowstorm-only tree crown snow caps",
    ]) instanceBatches(mobile.getObjectByName(name));
    expect(mobile.userData.wallStoneCount).toBe(41_354);
    expect(mobile.userData.shrubClusterCount).toBe(3_535);
    expect(mobile.userData.hedgeAreaClusterCount).toBe(208);
    mobile.traverse(object => {
      if (!(object instanceof Mesh || object instanceof LineSegments)) return;
      for (const attribute of Object.values(object.geometry.attributes)) expect(finiteArray(attribute.array)).toBeTrue();
      if (object instanceof InstancedMesh) expect(finiteArray(object.instanceMatrix.array)).toBeTrue();
    });
    disposeStaticAudit(mobile);
  });

  test("settled touch foliage also keeps every full crown subdivision", () => {
    const full = createParkDetails(payload, { detailProfile: "full", settledDetail: true });
    const expected = staticGeometryAudit(full);
    expect(expected.budget.instances).toBe(500_033);
    disposeStaticAudit(full);
    const mobile = createParkDetails(payload, { detailProfile: "mobile", settledDetail: true });
    expect(staticGeometryAudit(mobile)).toEqual(expected);
    expect(mobile.userData.settledOfficialTreeDetailFaces).toBeGreaterThan(0);
    disposeStaticAudit(mobile);
  });
});
