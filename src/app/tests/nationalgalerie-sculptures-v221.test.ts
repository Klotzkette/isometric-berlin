import { describe, expect, test } from "bun:test";
import { Box3, Group, InstancedMesh, Material, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { createNeueNationalgalerieV183 } from "../src/NeueNationalgalerieV183";
import { createCalderTetesEtQueueV221, createMooreArcherV221 } from "../src/NationalgalerieSculpturesV221";
import { CALDER_FOOT_CONTACTS_V221, NATIONALGALERIE_SCULPTURES_V221 as P } from "../src/nationalgalerieSculpturesV221Profile";
import { NATIONALGALERIE_TERRACE_RING_V183, NATIONALGALERIE_V183 } from "../src/neueNationalgalerieV183Profile";
import gallerySource from "../src/data/neueNationalgalerieV183Source.json";
import { pointInWorldRing } from "../src/chancelleryExtensionProfile";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { neueNationalgalerieGroundAtV217, neueNationalgalerieSolidAtV217 } from "../src/neueNationalgalerieWalkV217";
import { geometryPreservationV206 } from "./helpers/geometryPreservationV206";
import { detachNationalgalerieSculpturesV221, nationalgalerieSculpturesV221 } from "./helpers/nationalgalerieSculpturesV221";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";
import historical from "./fixtures/outline-preservation-v220-audit.json";
import artworkTrees from "./fixtures/nationalgalerie-v221-sculpture-trees.json";
import apronSource from "../src/data/nationalgalerieApronV221Source.json";
import { NATIONALGALERIE_APRON_V221, nationalgalerieApronContainsV221 } from "../src/nationalgalerieApronV221Profile";

function meshes(root: Group): Mesh[] {
  const found: Mesh[] = [];
  root.traverse(object => { if (object instanceof Mesh) found.push(object); });
  return found;
}

function worldVertices(root: Group): Vector3[] {
  root.updateMatrixWorld(true);
  const result: Vector3[] = [], instance = new Matrix4();
  for (const mesh of meshes(root)) {
    const position = mesh.geometry.getAttribute("position");
    for (let i = 0; i < (mesh instanceof InstancedMesh ? mesh.count : 1); i++) {
      const matrix = mesh.matrixWorld.clone();
      if (mesh instanceof InstancedMesh) { mesh.getMatrixAt(i, instance); matrix.multiply(instance); }
      for (let j = 0; j < position.count; j++) result.push(new Vector3().fromBufferAttribute(position, j).applyMatrix4(matrix));
    }
  }
  return result;
}

describe("two Nationalgalerie terrace sculptures v221", () => {
  for (const native of [false, true]) test(`${native ? "native" : "drawn"}: every new sculpture buffer and material matches its bounded complete-tree receipt`, () => {
    for (const [index, factory] of [createCalderTetesEtQueueV221, createMooreArcherV221].entries()) {
      const sculpture = factory(native), saved = artworkTrees.profiles[native ? "minecraft" : "day"][index];
      try {
        expect(geometryPreservationV206(sculpture)).toEqual(saved.records);
        expect(staticGeometryAudit(sculpture)).toEqual(saved.audit);
      } finally { disposeStaticAudit(sculpture); }
    }
  });

  for (const native of [false, true]) test(`${native ? "native" : "drawn"}: exactly two distinct, compact, static artwork owners preserve the complete v220 gallery`, () => {
    const gallery = createNeueNationalgalerieV183(native);
    try {
      const addition = nationalgalerieSculpturesV221(gallery, native);
      const artworks = addition.children.filter(child => child.userData.sculptureId) as Group[];
      expect(artworks.map(child => child.userData.sculptureId)).toEqual(["calder-tetes-et-queue", "moore-archer"]);
      expect(artworks.map(child => child.userData.artist)).toEqual(["Alexander Calder", "Henry Moore"]);
      expect(artworks[0].name).toBe("Alexander Calder — Têtes et Queue (1965)");
      expect(artworks[1].name).toBe("Henry Moore — Three Way Piece No. 2: Archer (1964)");
      expect(addition.children.filter(child => child.userData.exactPavingComplement)).toHaveLength(1);
      expect(addition.children).toHaveLength(3);
      const audit = staticGeometryAudit(addition), renderables = artworks.flatMap(meshes);
      expect(renderables).toHaveLength(2);
      expect(audit.budget.draws).toBe(3);
      expect(audit.budget.bytes).toBeLessThan(P.maxGpuBytes[native ? "minecraft" : "drawn"]);
      expect(audit.budget.bytes).toBeGreaterThan(50_000);
      expect(addition.userData.gpuBytes).toBe(audit.budget.bytes);
      expect(addition.userData.fullAndMobileIdentical).toBe(true);
      expect(addition.userData.fullStaticDetailOnTouch).toBe(true);
      addition.traverse(object => expect(object.matrixAutoUpdate).toBe(false));
      for (const mesh of renderables) {
        expect(mesh instanceof InstancedMesh).toBe(native);
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        for (const attribute of Object.values(mesh.geometry.attributes))
          expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
        for (const material of [mesh.material, mesh.userData.dayMaterial, mesh.userData.nightMaterial] as Material[]) {
          expect(material).toBeInstanceOf(Material);
          expect(Object.values(material).some(value => value && typeof value === "object" && "isTexture" in value)).toBe(false);
        }
        if (mesh instanceof InstancedMesh) {
          expect(mesh.count).toBeGreaterThan(100);
          expect(mesh.geometry.getAttribute("position").count).toBe(24);
          for (let i = 0; i < mesh.count; i++) for (const k of [1, 2, 4, 6, 8, 9])
            expect(mesh.instanceMatrix.array[i * 16 + k]).toBe(0);
        } else expect(mesh.geometry.getAttribute("position").count).toBeGreaterThan(1_000);
      }
      const complete = staticGeometryAudit(gallery), originalChildren = [...gallery.children];
      const restore = detachNationalgalerieSculpturesV221(gallery, native);
      try {
        const old = historical.modes[native ? "minecraft" : "day"].current.staticGallery;
        expect(staticGeometryAudit(gallery)).toEqual(old);
        expect(complete.budget.bytes).toBe(old.budget.bytes + audit.budget.bytes);
        expect(complete.budget.draws).toBe(old.budget.draws + 3);
      } finally { restore(); }
      expect(gallery.children).toEqual(originalChildren);
      expect(staticGeometryAudit(gallery)).toEqual(complete);
    } finally { disposeStaticAudit(gallery); }
  });

  for (const native of [false, true]) test(`${native ? "native" : "drawn"}: mapped sculpture placement stays outside pavilion owners with grounded compact silhouettes`, () => {
    const gallery = createNeueNationalgalerieV183(native);
    try {
      const addition = nationalgalerieSculpturesV221(gallery, native);
      for (const [i, profile] of [P.calder, P.moore].entries()) {
        const sculpture = addition.children[i] as Group;
        expect(sculpture.position.toArray()).toEqual([profile.centerXZ[0], profile.baseY, profile.centerXZ[1]]);
        expect(profile.baseY).toBe(NATIONALGALERIE_V183.terraceTopY);
        const points = worldVertices(sculpture), bounds = new Box3().setFromPoints(points);
        expect(bounds.min.y).toBeCloseTo(profile.baseY, 5);
        expect(bounds.max.y - bounds.min.y).toBeCloseTo(profile.heightM, native ? 0 : 1);
        for (const point of points) {
          for (const part of gallerySource.parts.filter(part => part.id !== "MSMgX8rD")) {
            expect(pointInWorldRing(point.x, point.z, part.ring.map(([x, z]) => [x / 10, z / 10]))).toBe(false);
          }
        }
        for (const point of points) expect(pointInWorldRing(point.x, point.z, NATIONALGALERIE_TERRACE_RING_V183)
          || nationalgalerieApronContainsV221(point.x, point.z)).toBe(true);
      }
    } finally { disposeStaticAudit(gallery); }
  });

  for (const native of [false, true]) test(`${native ? "native" : "drawn"}: exact missing OSM terrace complement supports Moore without changing the retained podium or stairs`, () => {
    const gallery = createNeueNationalgalerieV183(native);
    try {
      const addition = nationalgalerieSculpturesV221(gallery, native);
      const apron = addition.children.find(child => child.userData.exactPavingComplement) as Group;
      expect(apron).toBeDefined();
      expect(apron.userData.sourceKey).toBe("relation/21583");
      expect(apronSource.subtractedSourceId).toBe("MSMgX8rD");
      expect(apronSource.subtractedRingXZ).toEqual(NATIONALGALERIE_TERRACE_RING_V183);
      expect(apronSource.holesXZ).toHaveLength(0);
      const ring = apronSource.ringXZ;
      const area = Math.abs(ring.reduce((sum, a, i) => {
        const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1];
      }, 0)) / 2;
      expect(area).toBeCloseTo(2792.130814231289, 6);
      expect(area).toBeCloseTo(apronSource.areaM2, 6);
      expect(apronSource.stairEnvelopeIntersectionAreaM2).toBe(0);
      expect(apronSource.stairEnvelopeDistanceM).toBeGreaterThan(20);
      const expected = artworkTrees.apron[native ? "minecraft" : "day"];
      expect(geometryPreservationV206(apron)).toEqual(expected.records);
      expect(staticGeometryAudit(apron)).toEqual(expected.audit);
      expect(new Box3().setFromObject(apron).min.y).toBeCloseTo(NATIONALGALERIE_APRON_V221.groundY, 5);
      expect(new Box3().setFromObject(apron).max.y).toBeCloseTo(NATIONALGALERIE_APRON_V221.terraceTopY, 5);
      const c = Math.cos(P.calder.yaw), s = Math.sin(P.calder.yaw);
      for (const foot of CALDER_FOOT_CONTACTS_V221) {
        const x = P.calder.centerXZ[0] + c * foot.x + s * foot.z;
        const z = P.calder.centerXZ[1] - s * foot.x + c * foot.z;
        const hits = new Raycaster(new Vector3(x, P.calder.baseY + .1, z), new Vector3(0, -1, 0), 0, .2)
          .intersectObjects(gallery.children.filter(child => child !== addition), true);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].point.y).toBeCloseTo(P.calder.baseY, 5);
      }
      // Every circular pedestal contact rests on rendered support in both families.
      for (let i = 0; i < 32; i++) {
        const angle = i / 32 * Math.PI * 2;
        const x = P.moore.centerXZ[0] + Math.cos(angle) * P.moore.pedestalRadiusM;
        const z = P.moore.centerXZ[1] + Math.sin(angle) * P.moore.pedestalRadiusM;
        expect(nationalgalerieApronContainsV221(x, z)).toBe(true);
        const hits = new Raycaster(new Vector3(x, P.moore.baseY + .1, z), new Vector3(0, -1, 0), 0, .2).intersectObject(apron, true);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].point.y).toBeCloseTo(P.moore.baseY, 5);
        expect(neueNationalgalerieSolidAtV217(x, P.moore.baseY - 1, z, .28)).toBe(true);
      }
    } finally { disposeStaticAudit(gallery); }
  });

  for (const native of [false, true]) test(`${native ? "native" : "drawn"}: Calder keeps open legs and Moore a hollow pedestal and upper notch`, () => {
    const calder = createCalderTetesEtQueueV221(native), moore = createMooreArcherV221(native);
    try {
      calder.updateMatrixWorld(true); moore.updateMatrixWorld(true);
      const calderSize = new Box3().setFromObject(calder).getSize(new Vector3());
      expect(Math.abs(calderSize.x - 4.7)).toBeLessThan(native ? .15 : .00001);
      expect(Math.abs(calderSize.y - 5.5)).toBeLessThan(.00001);
      expect(Math.abs(calderSize.z - 3.3)).toBeLessThan(native ? .15 : .00001);
      const hits = (root: Group, position: number[], direction: number[], distance: number) =>
        new Raycaster(new Vector3(...position), new Vector3(...direction), 0, distance).intersectObject(root, true);
      expect(calder.userData.uprightHeads).toBe(6);
      expect(calder.userData.splitFeet).toBe(7);
      expect(hits(calder, [0, .2, -4], [0, 0, 1], 8)).toHaveLength(0);
      expect(hits(calder, [0, 2.8, -3], [0, 0, 1], 6).length).toBeGreaterThan(0);
      expect(moore.userData.interlockingMembers).toBe(3);
      expect(moore.userData.hollowPedestal).toBe(true);
      expect(hits(moore, [0, .4, 0], [1, 0, 0], .8)).toHaveLength(0);
      expect(hits(moore, [-2, .4, 0], [1, 0, 0], 4).length).toBeGreaterThanOrEqual(4);
      expect(hits(moore, [0, 2.8, -3], [0, 0, 1], 6)).toHaveLength(0);
    } finally { disposeStaticAudit(calder); disposeStaticAudit(moore); }
  });

  test("mode changes retain the static sculpture geometry and both full drawn constructions match", () => {
    const gallery = createNeueNationalgalerieV183(), second = createNeueNationalgalerieV183();
    try {
      const addition = nationalgalerieSculpturesV221(gallery), other = nationalgalerieSculpturesV221(second);
      const original = geometryPreservationV206(addition);
      expect(staticGeometryAudit(other)).toEqual(staticGeometryAudit(addition));
      for (const mode of ["day", "night", "snowstorm", "schwellenraum", "flood"] as const) {
        setIsoNightPresentation(gallery, mode === "night", true, mode);
        expect(geometryPreservationV206(addition)).toEqual(original);
        expect(meshes(addition).every(mesh => mesh.visible)).toBe(true);
      }
    } finally { disposeStaticAudit(gallery); disposeStaticAudit(second); }
  });

  test("walking blocks the seven steel contacts and circular pedestal while retaining their lower openings and nearby terrace", () => {
    const c = Math.cos(P.calder.yaw), s = Math.sin(P.calder.yaw);
    expect(CALDER_FOOT_CONTACTS_V221).toHaveLength(7);
    for (const foot of CALDER_FOOT_CONTACTS_V221) {
      const x = P.calder.centerXZ[0] + c * foot.x + s * foot.z;
      const z = P.calder.centerXZ[1] - s * foot.x + c * foot.z;
      expect(neueNationalgalerieSolidAtV217(x, P.calder.baseY + .3, z, .28)).toBe(true);
    }
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2;
      const x = P.moore.centerXZ[0] + Math.cos(angle), z = P.moore.centerXZ[1] + Math.sin(angle);
      expect(neueNationalgalerieSolidAtV217(x, P.moore.baseY + .3, z, .28)).toBe(true);
    }
    for (const profile of [P.calder, P.moore]) {
      expect(neueNationalgalerieSolidAtV217(profile.centerXZ[0], profile.baseY + .3, profile.centerXZ[1], .28)).toBe(false);
      expect(neueNationalgalerieSolidAtV217(profile.centerXZ[0] + 3.5, profile.baseY + .3, profile.centerXZ[1], .28)).toBe(false);
    }
    expect(neueNationalgalerieGroundAtV217(P.calder.centerXZ[0], P.calder.centerXZ[1], P.calder.baseY))
      .toBe(NATIONALGALERIE_V183.floorY);
    expect(neueNationalgalerieGroundAtV217(P.moore.centerXZ[0], P.moore.centerXZ[1], P.moore.baseY))
      .toBe(NATIONALGALERIE_V183.floorY);
  });
});
