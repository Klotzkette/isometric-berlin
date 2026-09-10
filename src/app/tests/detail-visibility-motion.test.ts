import { describe, expect, test } from "bun:test";
import ts from "typescript";
import {
  BoxGeometry, Group, InstancedMesh, LineBasicMaterial, LineSegments,
  Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3,
} from "three";
import * as fade from "../src/fineDetailFade";
import * as visibility from "../src/detailVisibility";
import {
  applyMinecraftVisibility, minecraftOwnsVisibility, restoreMinecraftVisibility,
} from "../src/MinecraftVisibility";
import { createSonyCenterSurroundings } from "../src/SonyCenterSurroundings";
import { createWilhelmStresemannDetails } from "../src/WilhelmStresemannDetails";

const source = await Bun.file(
  process.env.DETAIL_VISIBILITY_REFERENCE ?? new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();
const functions = [
  "collectFarZoomAntiFlickerTargets", "appendFarZoomAntiFlickerTargets",
  "forgetFarZoomAntiFlickerTargets", "invalidateFarZoomAntiFlickerCache",
  "updateFarZoomAntiFlicker",
];
const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = functions.map((name) => {
  const node = parsed.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  if (!node) throw new Error(`Missing production function ${name}`);
  return node.getText(parsed);
});
// The old reference has no ownership-release helper. Its absence is retained
// when replaying old movement, while current production executes the helper.
const restoreDeclaration = parsed.statements.find((entry) =>
  ts.isFunctionDeclaration(entry) && entry.name?.text === "restoreFarZoomDetailVisibility",
);
declarations.push(restoreDeclaration?.getText(parsed) ?? "function restoreFarZoomDetailVisibility() {}");
functions.push("restoreFarZoomDetailVisibility");
const sceneInvalidation = parsed.statements.find((entry) =>
  ts.isFunctionDeclaration(entry) && entry.name?.text === "invalidateScenePresentation",
);
if (sceneInvalidation) declarations.push(sceneInvalidation.getText(parsed).replace(/^export\s+/, ""));
const compiled = ts.transpileModule(declarations.join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const bindings = {
  ...fade, ...visibility, LineSegments, LineBasicMaterial, minecraftOwnsVisibility,
  // Sign animation and material shader installation are independent of the
  // object-visibility contract; collection and frame decisions run unchanged.
  isBerlinerEnsembleRoofSignTarget: () => false,
  updateBerlinerEnsembleRoofSign: () => {},
  assignStableInkRenderOrder: () => {},
  stabilizeInkLineMaterial: (material: LineBasicMaterial) => {
    material.userData.stableInkAuthoredOpacity = material.opacity;
    material.userData.stableInkAppliedOpacity = null;
  },
};
const production = new Function(...Object.keys(bindings), `${compiled}; return { ${functions.join(", ")} };`)(...Object.values(bindings));

function host() {
  const runtime = {
    camera: new PerspectiveCamera(16, 1, 0.05, 18_000),
    isoWorld: new Group(), voxelWorld: new Group(), signatures: new Group(),
    civicDetails: new Group(), centralDetails: new Group(), cityStaffage: new Group(),
    fineDetailObjects: [] as visibility.DistanceDetailTarget[],
    microDetailObjects: [] as visibility.DistanceDetailTarget[],
    inkLineMaterials: new Set<LineBasicMaterial>(),
    inkLineObjects: [] as LineSegments[],
    fineDetailVisible: true, microDetailVisible: false,
    renderInvalidated: false, shadowInvalidated: false,
    farZoomAntiFlickerDistanceM: Number.NaN,
    farZoomAntiFlickerFovDegrees: Number.NaN,
    farZoomAntiFlickerViewportHeightPx: Number.NaN,
    farZoomAntiFlickerCameraPosition: new Vector3(Number.NaN, Number.NaN, Number.NaN),
    berlinerEnsembleRoofSignTargets: [], berlinerEnsembleRoofSignElapsedSeconds: 0,
  };
  return {
    runtime,
    collect: () => production.collectFarZoomAntiFlickerTargets(runtime),
    append: (root: Group) => production.appendFarZoomAntiFlickerTargets(runtime, root),
    forget: (root: Group) => production.forgetFarZoomAntiFlickerTargets(runtime, root),
    update: (target: Vector3) => production.updateFarZoomAntiFlicker(runtime, runtime.camera.position.distanceTo(target), 900),
    restore: () => production.restoreFarZoomDetailVisibility(runtime),
    invalidate: () => production.invalidateFarZoomAntiFlickerCache(runtime),
  };
}

function detail(name = "Bertolt Brecht seated figure and installation fine detail") {
  const mesh = new Mesh(new BoxGeometry(2, 4, 2), new MeshBasicMaterial());
  mesh.name = name;
  mesh.position.y = 2;
  mesh.userData.detailFadeM = [34, 105];
  return mesh;
}

describe("existing detail during actual viewer camera motion", () => {
  test("a pure pan at identical orbit radius reveals close ornament in the same frame", () => {
    const run = host();
    const object = detail();
    run.runtime.isoWorld.add(object);
    run.collect();
    run.runtime.camera.position.set(500, 2, 25);
    expect(run.update(new Vector3(500, 2, -475))).toBeTrue();
    expect(object.visible).toBeFalse();
    run.runtime.camera.position.set(0, 2, 25);
    run.runtime.camera.lookAt(0, 2, -475);
    run.runtime.camera.updateMatrixWorld();
    const projected = new Vector3(0, 2, 0).project(run.runtime.camera);
    expect(Math.abs(projected.x)).toBeLessThan(1);
    expect(Math.abs(projected.y)).toBeLessThan(1);
    expect(Math.abs(projected.z)).toBeLessThan(1);
    expect(run.update(new Vector3(0, 2, -475))).toBeTrue();
    expect(object.visible).toBeTrue();
    expect(run.update(new Vector3(0, 2, -475))).toBeFalse();
  });

  test("orbiting at unchanged radius immediately resolves a nearby object", () => {
    const run = host();
    const object = detail();
    object.position.x = 475;
    run.runtime.isoWorld.add(object);
    run.collect();
    const target = new Vector3(0, 2, 0);
    run.runtime.camera.position.set(-500, 2, 0);
    run.update(target);
    expect(object.visible).toBeFalse();
    run.runtime.camera.position.set(500, 2, 0);
    run.runtime.camera.lookAt(target);
    run.runtime.camera.updateMatrixWorld();
    expect(run.update(target)).toBeTrue();
    expect(object.visible).toBeTrue();
  });

  test("world bounds include nested transforms and distant instance matrices", () => {
    const run = host();
    const group = new Group();
    group.name = "Bertolt Brecht seated figure and installation fine detail";
    group.userData.detailFadeM = [34, 105];
    group.position.set(500, 0, -300);
    const mesh = new InstancedMesh(new BoxGeometry(2, 4, 2), new MeshBasicMaterial(), 1);
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(700, 2, 300));
    group.add(mesh);
    run.runtime.isoWorld.add(group);
    run.collect();
    run.runtime.camera.position.set(1200, 2, 25);
    run.update(new Vector3(1200, 2, -475));
    expect(group.visible).toBeTrue();
    expect(run.runtime.fineDetailObjects[0].bounds.min.x).toBe(1199);
    expect(run.runtime.fineDetailObjects[0].bounds.max.x).toBe(1201);
  });

  test("real complete Sony and Wilhelmstrasse facades remain present across far pans", () => {
    const run = host();
    const sony = createSonyCenterSurroundings();
    const wilhelm = createWilhelmStresemannDetails();
    run.runtime.isoWorld.add(sony, wilhelm);
    run.collect();
    const objects = [...run.runtime.fineDetailObjects, ...run.runtime.microDetailObjects];
    expect(objects.some(({ object }) => object === sony || object === wilhelm)).toBeFalse();
    const before: Array<{ object: Mesh; geometry: unknown; count: number }> = [];
    run.runtime.isoWorld.traverse((object) => {
      if (object instanceof Mesh) before.push({ object, geometry: object.geometry, count: object instanceof InstancedMesh ? object.count : 1 });
    });
    expect(before.length).toBeGreaterThan(10);
    for (const x of [-5000, 0, 5000]) {
      run.runtime.camera.position.set(x, 2000, 7000);
      run.update(new Vector3(x, 0, 0));
      expect(sony.visible).toBeTrue();
      expect(wilhelm.visible).toBeTrue();
      for (const entry of before) {
        expect(entry.object.visible).toBeTrue();
        expect(entry.object.geometry).toBe(entry.geometry);
        expect(entry.object instanceof InstancedMesh ? entry.object.count : 1).toBe(entry.count);
      }
    }
  });

  test("voxel policy keeps a hidden smooth branch hidden through close movement and restores Day", () => {
    const run = host();
    const object = detail();
    run.runtime.centralDetails.add(object);
    run.collect();
    run.runtime.camera.position.set(0, 2, 500);
    run.update(new Vector3(0, 2, 0));
    expect(object.visible).toBeFalse();
    run.restore();
    expect(object.visible).toBeTrue();
    applyMinecraftVisibility(run.runtime, true);
    expect(object.visible).toBeFalse();
    run.runtime.camera.position.set(0, 2, 25);
    run.update(new Vector3(0, 2, -475));
    expect(object.visible).toBeFalse();
    run.restore();
    restoreMinecraftVisibility(run.runtime);
    run.invalidate();
    run.update(new Vector3(0, 2, -475));
    expect(object.visible).toBeTrue();
  });

  test("distance visibility never enables an authored hidden lamp", () => {
    const run = host();
    const lamp = detail("Reichstagspräsidentenpalais micro facade details lamps");
    lamp.visible = false;
    run.runtime.isoWorld.add(lamp);
    run.collect();
    run.runtime.camera.position.set(0, 2, 25);
    run.update(new Vector3(0, 2, -475));
    expect(lamp.visible).toBeFalse();
    run.restore();
    lamp.visible = true;
    run.invalidate();
    run.update(new Vector3(0, 2, -475));
    expect(lamp.visible).toBeTrue();
    run.restore();
    lamp.visible = false;
    run.invalidate();
    run.update(new Vector3(0, 2, -475));
    expect(lamp.visible).toBeFalse();
  });
});


test("streamed district registration and eviction leave the retained city cache untouched", () => {
  const run = host();
  const retainedDetail = detail();
  const sharedInk = new LineBasicMaterial();
  const retainedLine = new LineSegments(new BoxGeometry(1, 1, 1), sharedInk);
  run.runtime.isoWorld.add(retainedDetail, retainedLine);
  run.collect();
  run.runtime.camera.position.set(500, 2, 25);
  run.update(new Vector3(500, 2, -475));
  expect(retainedDetail.visible).toBeFalse();
  const retainedTarget = run.runtime.fineDetailObjects[0];
  const incomingDetail = detail();
  const incomingLine = new LineSegments(new BoxGeometry(2, 2, 2), sharedInk);
  const incoming = new Group().add(incomingDetail, incomingLine);
  run.runtime.isoWorld.add(incoming);
  let sceneScans = 0;
  const originalTraverse = run.runtime.isoWorld.traverse;
  run.runtime.isoWorld.traverse = function (callback) {
    sceneScans++;
    originalTraverse.call(this, callback);
  };
  let gpuEnqueues = 0;
  Object.assign(run.runtime, {gpuWarmup: {enqueue: () => gpuEnqueues++}});
  run.append(incoming);
  expect(run.runtime.fineDetailObjects).toHaveLength(2);
  expect(run.runtime.fineDetailObjects[0]).toBe(retainedTarget);
  expect(retainedDetail.visible).toBeFalse();
  expect(run.runtime.inkLineObjects).toEqual([retainedLine, incomingLine]);
  run.forget(incoming);
  expect(run.runtime.fineDetailObjects).toEqual([retainedTarget]);
  expect(run.runtime.inkLineObjects).toEqual([retainedLine]);
  expect(run.runtime.inkLineMaterials.has(sharedInk)).toBeTrue();
  expect(sceneScans).toBe(0);
  expect(gpuEnqueues).toBe(0);
});
