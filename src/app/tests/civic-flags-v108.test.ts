import { describe, expect, test } from "bun:test";
import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Vector3,
} from "three";
import {
  type ArchitecturalSignature,
  createArchitecturalSignature,
} from "../src/ArchitecturalLandmarks";
import { createCivicLandmarks } from "../src/CivicLandmarks";
import { applyMinecraftVisibility } from "../src/MinecraftVisibility";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import { createSpreebogenOffice } from "../src/SpreebogenOffice";
import {
  CIVIC_FLAG_WIND_PROFILE,
  civicFlagFrameIntervalMs,
  civicWindFlagsOnScreen,
  collectCivicWindFlagTargets,
  createCivicWindFlagScreenScratch,
  markWindFlag,
  updateCivicWindFlags,
} from "../src/WindFlags";
import { nextFineDetailVisible } from "../src/fineDetailFade";
import { renderFrameRequired } from "../src/renderQuality";
import { schwellenraumMotionDecision } from "../src/visual-modes/schwellenraum/motion";
import type { VisualMode } from "../src/visualMode";
import groundPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import scenePayload from "../public/mesh/regierungsviertel/scene.json";

const scene = scenePayload as unknown as {
  architectural_signatures: ArchitecturalSignature[];
};
const VISUAL_MODES: VisualMode[] = ["day", "night", "minecraft", "snowstorm", "schwellenraum"];
const signatures = new Group();
const reichstag = createArchitecturalSignature(scene.architectural_signatures.find(
  (signature) => signature.kind === "reichstag_model",
)!)!;
const chancellery = createArchitecturalSignature(scene.architectural_signatures.find(
  (signature) => signature.kind === "chancellery_model",
)!)!;
const office = createSpreebogenOffice(groundPayload as unknown as VoxelPayload)!;
signatures.add(reichstag, chancellery, office);
const civic = createCivicLandmarks([
  { name: "Schweizerische Botschaft", world: [-5.654743, 8, -246.494572] },
  { name: "Fahne der Einheit", world: [226.039773, 8, 57.925456] },
]);

/** Sample the rendered triangle surface, not the animation formula. */
function surfaceZ(mesh: Mesh, x: number, y: number): number | null {
  const positions = mesh.geometry.getAttribute("position");
  const indices = mesh.geometry.index;
  for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
    const [a, b, c] = [0, 1, 2].map((offset) => indices?.getX(i + offset) ?? i + offset);
    const ax = positions.getX(a), ay = positions.getY(a);
    const bx = positions.getX(b), by = positions.getY(b);
    const cx = positions.getX(c), cy = positions.getY(c);
    const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(denominator) < 1e-12) continue;
    const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
    const v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator;
    const w = 1 - u - v;
    if (Math.min(u, v, w) < -1e-5) continue;
    return u * positions.getZ(a) + v * positions.getZ(b) + w * positions.getZ(c);
  }
  return null;
}

function surfaceSnapshot(mesh: Mesh): number[] {
  return Array.from(mesh.geometry.getAttribute("position").array);
}

describe("v1.0.8 civic cloth and idle rendering", () => {
  test("keeps all nine physical flags within the bounded shared cloth budget", () => {
    const targets = collectCivicWindFlagTargets([signatures, civic]);
    let bytes = 0;
    for (const { mesh } of targets) {
      for (const attribute of Object.values(mesh.geometry.attributes)) {
        bytes += attribute.array.byteLength;
      }
      bytes += mesh.geometry.index?.array.byteLength ?? 0;
      bytes += (mesh.userData.windFlag?.basePositions as Float32Array | undefined)?.byteLength ?? 0;
      if (mesh instanceof InstancedMesh) bytes += mesh.instanceMatrix.array.byteLength;
    }
    expect(targets).toHaveLength(30);
    expect(bytes).toBeLessThan(350_000);
  });

  test("advances visible day cloth after the global fine-detail tier fades, on desktop and mobile", () => {
    const geometry = new PlaneGeometry(10, 6, 8, 3);
    geometry.translate(5, 0, 0);
    const flag = new Mesh(geometry, new MeshBasicMaterial());
    markWindFlag(flag, 10, { kind: "germany" });
    const root = new Group();
    root.add(flag);
    const targets = collectCivicWindFlagTargets([root]);
    const camera = new PerspectiveCamera(40, 1.5, 0.1, 8000);
    camera.position.set(5, 0, 1350);
    camera.lookAt(5, 0, 0);
    expect(nextFineDetailVisible({ distanceM: 1350, visible: true })).toBeFalse();
    const onScreen = civicWindFlagsOnScreen(targets, camera, 900,
      createCivicWindFlagScreenScratch());
    expect(onScreen).toBeTrue();
    for (const coarsePointer of [false, true]) {
      for (const mode of VISUAL_MODES) {
        const interval = civicFlagFrameIntervalMs(coarsePointer);
        let lastFrameAt = 0;
        let elapsed = 0.9;
        let rendered = 0;
        updateCivicWindFlags([root], elapsed);
        const before = surfaceSnapshot(flag);
        for (let timestamp = 0; timestamp < 1000; timestamp += 1000 / 60) {
          const decision = schwellenraumMotionDecision({
            flagFrameIntervalMs: interval,
            lastFlagFrameAt: lastFrameAt,
            lastPariserPlatzFrameAt: 0,
            lastWaterFrameAt: 0,
            minecraftMobsVisible: false,
            mode,
            movingFlagCount: onScreen ? targets.length : 0,
            pariserPlatzEntitiesOnScreen: false,
            pariserPlatzEntityCount: 0,
            pariserPlatzFrameIntervalMs: 0,
            rainVisible: false,
            reducedMotion: false,
            snowVisible: false,
            timestamp,
            waterLightCount: 0,
          });
          if (!renderFrameRequired({ cameraMoving: false,
            environmentalMotion: decision.environmentalMotion,
            presentationChanged: false, renderInvalidated: false })) continue;
          elapsed += interval / 1000;
          updateCivicWindFlags([root], elapsed);
          lastFrameAt = timestamp;
          rendered += 1;
        }
        expect(rendered, `${mode}:${coarsePointer}`).toBeGreaterThanOrEqual(7);
        expect(rendered, `${mode}:${coarsePointer}`).toBeLessThanOrEqual(12);
        expect(surfaceSnapshot(flag), `${mode}:${coarsePointer}`).not.toEqual(before);
      }
    }
  });

  test("does not wake the city for hidden, behind-camera or subpixel flags", () => {
    const flag = new Mesh(new PlaneGeometry(2.2, 2.2), new MeshBasicMaterial());
    flag.geometry.translate(1.1, 0, 0);
    markWindFlag(flag, 2.2, { kind: "switzerland" });
    const root = new Group();
    const wrapper = new Group();
    root.add(wrapper);
    wrapper.add(flag);
    const targets = collectCivicWindFlagTargets([root]);
    const camera = new PerspectiveCamera(40, 1.5, 0.1, 8000);
    const scratch = createCivicWindFlagScreenScratch();
    camera.position.set(1, 0, 100);
    camera.lookAt(1, 0, 0);
    expect(civicWindFlagsOnScreen(targets, camera, 900, scratch)).toBeTrue();
    wrapper.visible = false;
    expect(civicWindFlagsOnScreen(targets, camera, 900, scratch)).toBeFalse();
    wrapper.visible = true;
    camera.lookAt(1, 0, 200);
    expect(civicWindFlagsOnScreen(targets, camera, 900, scratch)).toBeFalse();
    camera.position.z = 4000;
    camera.lookAt(1, 0, 0);
    expect(civicWindFlagsOnScreen(targets, camera, 900, scratch)).toBeFalse();
  });

  test("keeps the actual German stripe seams joined throughout the wind cycle", () => {
    const first = reichstag.children.find((child) => child.name.includes("German flag stripe 1")) as Mesh;
    const second = reichstag.getObjectByName(first.name.replace("stripe 1", "stripe 2")) as Mesh;
    for (const elapsed of [0.9, 2.1, 4.7, 8.2]) {
      updateCivicWindFlags([reichstag], elapsed);
      reichstag.updateWorldMatrix(true, true);
      const a = first.geometry.getAttribute("position");
      const b = second.geometry.getAttribute("position");
      for (const x of [0, 1, 2, 3, 4]) {
        const ai = Array.from({ length: a.count }, (_, i) => i).filter((i) => Math.abs(a.getX(i) - x) < 1e-5);
        const bi = Array.from({ length: b.count }, (_, i) => i).filter((i) => Math.abs(b.getX(i) - x) < 1e-5);
        if (!ai.length || !bi.length) continue;
        const lower = ai.reduce((best, i) => a.getY(i) < a.getY(best) ? i : best);
        const upper = bi.reduce((best, i) => b.getY(i) > b.getY(best) ? i : best);
        const worldA = new Vector3().fromBufferAttribute(a, lower).applyMatrix4(first.matrixWorld);
        const worldB = new Vector3().fromBufferAttribute(b, upper).applyMatrix4(second.matrixWorld);
        expect(worldA.distanceTo(worldB)).toBeLessThan(1e-5);
      }
    }
  });

  test("keeps the actual presidential border and eagle attached to the curved gold surface", () => {
    const gold = office.getObjectByName("Amtssitz presidential standard gold field") as Mesh;
    const border = office.getObjectByName("Amtssitz presidential standard red border") as Mesh;
    for (const elapsed of [0.9, 2.4, 5.1, 9.8]) {
      updateCivicWindFlags([office], elapsed);
      for (const x of [0.26, 0.59, 1.15, 1.73, 2.09]) {
        expect(surfaceZ(gold, x, 0)! - surfaceZ(border, x, 1.15)!).toBeCloseTo(0.014, 5);
      }
      for (const face of ["front", "back"]) {
        const eagle = office.getObjectByName(`Amtssitz presidential standard federal eagle ${face}`) as Mesh;
        const positions = eagle.geometry.getAttribute("position");
        let sampled = 0;
        for (let i = 0; i < positions.count; i += 1) {
          const goldZ = surfaceZ(gold, positions.getX(i), positions.getY(i));
          if (goldZ === null) continue;
          expect(positions.getZ(i) - goldZ).toBeCloseTo(face === "front" ? 0.014 : -0.042, 5);
          sampled += 1;
        }
        expect(sampled).toBeGreaterThan(100);
      }
    }
  });

  test("carries twelve EU stars on each face in the same cloth transform", () => {
    const field = reichstag.children.find((child) => child.name.endsWith("European Union flag")) as Mesh;
    const stars = reichstag.getObjectByName(`${field.name} stars`) as InstancedMesh;
    expect(stars.count).toBe(24);
    const matrix = new Matrix4();
    for (const elapsed of [1.2, 3.3, 7.8]) {
      updateCivicWindFlags([reichstag], elapsed);
      reichstag.updateWorldMatrix(true, true);
      for (let i = 0; i < stars.count; i += 1) {
        stars.getMatrixAt(i, matrix);
        const local = new Vector3().setFromMatrixPosition(matrix)
          .applyMatrix4(stars.matrixWorld).applyMatrix4(field.matrixWorld.clone().invert());
        const clothZ = surfaceZ(field, local.x, local.y);
        expect(clothZ).not.toBeNull();
        expect(local.z - clothZ!).toBeCloseTo(i < 12 ? 0.025 : -0.025, 5);
      }
    }
  });

  test("keeps both Swiss crosses on the same cloth surface without changing its square outline", () => {
    const field = civic.getObjectByName("Swiss Embassy animated red flag field") as Mesh;
    for (const elapsed of [0.9, 2.4, 6.8]) {
      updateCivicWindFlags([civic], elapsed);
      for (const face of ["front", "back"]) {
        for (const axis of ["horizontal", "vertical"]) {
          const cross = civic.getObjectByName(`Swiss Embassy animated white flag cross ${axis} ${face}`) as Mesh;
          const position = cross.geometry.getAttribute("position");
          for (let i = 0; i < position.count; i += 1) {
            const fieldZ = surfaceZ(field, position.getX(i), position.getY(i));
            expect(fieldZ).not.toBeNull();
            expect(position.getZ(i) - fieldZ!).toBeCloseTo(0, 5);
          }
        }
      }
      const bounds = field.userData.windFlag.basePositions as Float32Array;
      const xs = Array.from(bounds).filter((_, index) => index % 3 === 0);
      const ys = Array.from(bounds).filter((_, index) => index % 3 === 1);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2.2, 5);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(2.2, 5);
    }
  });

  test("retains one animated artwork set through actual Minecraft filtering", () => {
    const roots = { signatures, civicDetails: civic, centralDetails: new Group(), cityStaffage: new Group() };
    const before = collectCivicWindFlagTargets([signatures, civic]);
    applyMinecraftVisibility(roots, true);
    const snapshot = before.filter((target) => !(target.mesh instanceof InstancedMesh))
      .map((target) => surfaceSnapshot(target.mesh));
    updateCivicWindFlags([signatures, civic], 10.9);
    before.forEach(({ mesh }) => {
      for (let ancestor = mesh as import("three").Object3D | null; ancestor; ancestor = ancestor.parent) {
        expect(ancestor.visible, mesh.name).toBeTrue();
      }
    });
    expect(before.filter((target) => !(target.mesh instanceof InstancedMesh))
      .map((target) => surfaceSnapshot(target.mesh))).not.toEqual(snapshot);
    applyMinecraftVisibility(roots, false);
    expect(collectCivicWindFlagTargets([signatures, civic])).toHaveLength(before.length);
    expect(CIVIC_FLAG_WIND_PROFILE.maxAmplitudeWidthRatio).toBeLessThan(0.07);
  });
});
