import { describe, expect, test } from "bun:test";
import {
  InstancedMesh,
  LineSegments,
  type Material,
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
  instancedMeshes: 66,
  mappedMaterials: 9,
  meshes: 1_446,
  objects: 1_841,
  transparentMaterials: 1,
  triangles: 125_921,
  vertices: 172_864,
};

function geometryBudget(root: Object3D): ParkGeometryBudget {
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
    budget.vertices += position?.count ?? 0;
    budget.triangles += index ? index.count / 3 : (position?.count ?? 0) / 3;
    for (const attribute of Object.values(object.geometry.attributes)) {
      budget.geometryBytes += attribute.array.byteLength;
    }
    if (index) {
      budget.geometryBytes += index.array.byteLength;
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
  test("keeps the frozen production full budget and explicit full equivalent", () => {
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

  test("retains every path, tree and playground anchor in a small static budget", () => {
    const mobile = createParkDetails(payload, { detailProfile: "mobile" });
    const budget = geometryBudget(mobile);
    expect(budget).toEqual({
      geometryBytes: 3_640_306,
      instanceBytes: 8_001_332,
      instances: 107_237,
      instancedMeshes: 8,
      mappedMaterials: 0,
      meshes: 68,
      objects: 76,
      transparentMaterials: 0,
      triangles: 86_535,
      vertices: 97_585,
    });
    expect(drawableCount(mobile)).toBe(72);
    expect(drawableCount(mobile)).toBeLessThanOrEqual(150);
    expect(budget.instances).toBeLessThan(FROZEN_FULL_BUDGET.instances * 0.25);
    expect(budget.instanceBytes).toBeLessThan(
      FROZEN_FULL_BUDGET.instanceBytes * 0.25,
    );

    const pathMeshes = mobile.children.filter((child) =>
      child.name.endsWith("batched path ribbons"),
    ) as Mesh[];
    const expectedPathVertices = payload.paths.reduce(
      (sum, path) => {
        const points = smoothParkPathPoints(path).filter(
          (point, index, entries) =>
            index === 0 ||
            Math.hypot(
              point.x - entries[index - 1].x,
              point.z - entries[index - 1].z,
            ) >= 0.05,
        );
        return sum + (points.length >= 2 ? points.length * 2 : 0);
      },
      0,
    );
    expect(mobile.userData.pathCount).toBe(payload.paths.length);
    expect(
      pathMeshes.reduce(
        (sum, mesh) => sum + mesh.geometry.getAttribute("position").count,
        0,
      ),
    ).toBe(expectedPathVertices);
    expect(
      new Set(
        pathMeshes.map((mesh) =>
          String(
            (Array.isArray(mesh.material)
              ? mesh.material[0]
              : mesh.material
            ).userData.pathMaterialCode,
          ),
        ),
      ),
    ).toEqual(new Set(payload.paths.map((path) => path.m)));
    for (const mesh of pathMeshes) {
      expect(mesh.geometry.getAttribute("uv").count).toBe(
        mesh.geometry.getAttribute("position").count,
      );
    }

    const trunks = mobile.getObjectByName(
      "Mobile park instanced coarse tree trunks",
    ) as InstancedMesh;
    const crowns = mobile.getObjectByName(
      "Mobile park instanced one-crown tree anchors",
    ) as InstancedMesh;
    const sourceTrees = decodeTrees(payload.trees, payload.tree_vocabulary);
    expect(trunks).toBeInstanceOf(InstancedMesh);
    expect(crowns).toBeInstanceOf(InstancedMesh);
    expect(trunks.count + mobile.userData.signatureTreeCount).toBe(
      mobile.userData.treeCount,
    );
    expect(crowns.count + mobile.userData.signatureTreeCount).toBe(
      mobile.userData.treeCount,
    );
    expect(
      mobile.userData.treeCount +
        mobile.userData.suppressedConstructionTreeCount +
        mobile.userData.suppressedTunnelApproachTreeCount,
    ).toBe(sourceTrees.length);
    const sourceAnchors = new Set(
      sourceTrees.map(
        (tree) =>
          `${Math.fround(tree.position[0])}:${Math.fround(tree.position[2])}`,
      ),
    );
    const matrix = new Matrix4();
    const trunkPosition = new Vector3();
    const crownPosition = new Vector3();
    let allAnchorMatricesFinite = true;
    let allCrownAnchorsMatchTrunks = true;
    let everyRenderedAnchorIsSourced = true;
    for (let index = 0; index < trunks.count; index += 1) {
      trunks.getMatrixAt(index, matrix);
      allAnchorMatricesFinite &&= finiteArray(matrix.elements);
      trunkPosition.setFromMatrixPosition(matrix);
      crowns.getMatrixAt(index, matrix);
      allAnchorMatricesFinite &&= finiteArray(matrix.elements);
      crownPosition.setFromMatrixPosition(matrix);
      allCrownAnchorsMatchTrunks &&=
        crownPosition.x === trunkPosition.x &&
        crownPosition.z === trunkPosition.z;
      everyRenderedAnchorIsSourced &&= sourceAnchors.has(
        `${trunkPosition.x}:${trunkPosition.z}`,
      );
    }
    expect(allAnchorMatricesFinite).toBeTrue();
    expect(allCrownAnchorsMatchTrunks).toBeTrue();
    expect(everyRenderedAnchorIsSourced).toBeTrue();

    expect(
      mobile.getObjectByName("Berlin park timber batched path ribbons"),
    ).toBeInstanceOf(Mesh);
    expect(
      mobile.getObjectByName(
        "OSM exact Großer Tiergarten scrub-area footprints",
      ),
    ).toBeInstanceOf(Mesh);
    expect(
      mobile.getObjectByName("OSM finite Tiergarten hedge course bodies"),
    ).toBeInstanceOf(InstancedMesh);
    expect(
      mobile.getObjectByName(
        "OSM polygon-bounded diverse Tiergarten shrub clumps",
      ),
    ).toBeUndefined();
    expect(
      mobile.getObjectByName("OSM finite Tiergarten hedge foliage lobes"),
    ).toBeUndefined();
    expect(
      mobile.getObjectByName(
        "Geoportal Berlin official public-lighting masts",
      ),
    ).toBeInstanceOf(InstancedMesh);
    expect(
      mobile.getObjectByName(
        "Geoportal Berlin night-only instanced street-light cones",
      ),
    ).toBeUndefined();
    expect(
      mobile.getObjectByName(
        "Mobile official Vorderlandmauer coarse continuous courses",
      ),
    ).toBeInstanceOf(InstancedMesh);
    const footprintMeshes = mobile.children.filter((child) =>
      child.name.startsWith("Mobile batched "),
    ) as Mesh[];
    const expectedFootprintVertices = payload.playgrounds.reduce(
      (sum, playground) => {
        const outline = playground.outline.filter(
          (point, index) =>
            index === 0 ||
            point[0] !== playground.outline[index - 1][0] ||
            point[2] !== playground.outline[index - 1][2],
        );
        if (
          outline.length > 2 &&
          outline[0][0] === outline.at(-1)?.[0] &&
          outline[0][2] === outline.at(-1)?.[2]
        ) {
          outline.pop();
        }
        return sum + outline.length;
      },
      0,
    );
    expect(
      footprintMeshes.reduce(
        (sum, mesh) =>
          sum + mesh.geometry.getAttribute("position").count,
        0,
      ),
    ).toBe(expectedFootprintVertices);
    expect(
      footprintMeshes.reduce(
        (sum, mesh) => sum + mesh.userData.playgroundFootprintCount,
        0,
      ),
    ).toBe(payload.playgrounds.length);
    expect(
      new Set(
        footprintMeshes.flatMap((mesh) => mesh.userData.playgroundIds),
      ),
    ).toEqual(new Set(payload.playgrounds.map((entry) => entry.id)));
    const playgroundAnchors = mobile.getObjectByName(
      "Mobile mapped playground source anchors",
    ) as InstancedMesh;
    expect(playgroundAnchors).toBeInstanceOf(InstancedMesh);
    expect(playgroundAnchors.count).toBe(payload.playgrounds.length);
    expect(new Set(playgroundAnchors.userData.playgroundIds)).toEqual(
      new Set(payload.playgrounds.map((entry) => entry.id)),
    );
    const luiseninsel = mobile.getObjectByName(
      "Spielplatz an der Luiseninsel OSM playground details",
    );
    expect(luiseninsel?.userData.mobileSignature).toBeTrue();
    expect(luiseninsel?.children.length).toBeGreaterThan(0);
    expect(mobile.userData.mobilePlaygroundFootprintCount).toBe(
      payload.playgrounds.length,
    );
    expect(mobile.userData.mobilePlaygroundSourceAnchorCount).toBe(
      payload.playgrounds.length,
    );

    let allGeometryFinite = true;
    let allMaterialsOpaque = true;
    let allMaterialsTextureless = true;
    let allObjectsStatic = true;
    mobile.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        for (const attribute of Object.values(object.geometry.attributes)) {
          allGeometryFinite &&= finiteArray(attribute.array);
        }
        const index = object.geometry.getIndex();
        if (index) {
          allGeometryFinite &&= finiteArray(index.array);
        }
      }
      if (object instanceof InstancedMesh) {
        allGeometryFinite &&= finiteArray(object.instanceMatrix.array);
        if (object.instanceColor) {
          allGeometryFinite &&= finiteArray(object.instanceColor.array);
        }
      }
      const material = (
        object as Object3D & { material?: Material | Material[] }
      ).material;
      if (material) {
        const materials = Array.isArray(material) ? material : [material];
        for (const surface of materials) {
          allMaterialsOpaque &&= !surface.transparent && surface.opacity === 1;
          if ("map" in surface) {
            allMaterialsTextureless &&= surface.map === null;
          }
        }
      }
      allObjectsStatic &&=
        object.userData.snowOnly !== true &&
        object.userData.settledOnly !== true &&
        object.userData.nightOnly !== true;
    });
    expect(allGeometryFinite).toBeTrue();
    expect(allMaterialsOpaque).toBeTrue();
    expect(allMaterialsTextureless).toBeTrue();
    expect(allObjectsStatic).toBeTrue();
    expect(mobile.userData.shrubClusterCount).toBe(0);
    expect(mobile.userData.hedgeAreaClusterCount).toBe(0);
    expect(mobile.userData.eggCount).toBe(0);
  });
});
