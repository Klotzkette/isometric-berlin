import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Color, Group, InstancedMesh, Material, Mesh, Raycaster, Vector3 } from "three";
import { createEurefCampusV262, EUREF_V262_PROFILE } from "../src/EurefCampusV262";
import { eurefV262GroundAt, eurefV262SolidAt } from "../src/eurefV262Navigation";
import { createSurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import data from "../src/data/eurefV262.json";
import transfers from "../src/data/eurefTransfersV262.json";
import { prepareEurefTransfersV262 } from "../src/eurefTransfersV262";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

function finish<T>(it: Generator<void, T>): T { let n = it.next(); while (!n.done) n = it.next(); return n.value; }
function loadTransfer(key: string): SurroundingCityChunk {
  const [mode, id] = key.split(":");
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/euref262-${id}.${mode}.json.gz`, import.meta.url))).toString());
}

function dispose(root: Group): void {
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    o.geometry.dispose();
    for (const m of new Set([o.material, o.userData.dayMaterial, o.userData.nightMaterial])) if (m instanceof Material) m.dispose();
    if (o instanceof InstancedMesh) o.dispose();
  });
}

describe("source-bound EUREF campus v262", () => {
  test("atomic runtime transfer preserves encoded input and activates every complete source part", () => {
    for (const key of transfers.keys) {
      const [mode, id] = key.split(":"), native = mode === "minecraft", original = loadTransfer(key), snapshot = JSON.stringify(original);
      const receipt = transfers.packets[key as keyof typeof transfers.packets];
      const prepared = finish(prepareEurefTransfersV262(original, id, native));
      expect(prepared).not.toBe(original);
      expect(finish(prepareEurefTransfersV262(prepared, id, native))).toBe(prepared);
      expect(prepared.meshes).toBe(original.meshes);
      expect(prepared.lines).toBe(original.lines);
      expect(prepared.nav).toBe(original.nav);
      const decoded = createSurroundingCityChunk(original, id, native);
      try {
        expect(decoded.root.userData.eurefTransferredTrianglesV262).toBe(receipt.records.reduce((n, r) => n + r.triangles.length, 0));
        expect(decoded.root.userData.eurefTransferredLineSegmentsV262 ?? 0).toBe(receipt.segments.length);
        expect(decoded.nav.buildings.filter(b => receipt.retiredOwners.includes(b.sourceId))).toEqual(receipt.buildings);
        expect(decoded.nav.buildings.filter(b => !receipt.retiredOwners.includes(b.sourceId))).toEqual(original.nav.buildings.filter(b => !receipt.retiredOwners.includes(b.sourceId)));
        expect(JSON.stringify(original)).toBe(snapshot);
      } finally { disposeSurroundingCityRoot(decoded.root); }
      const missing = structuredClone(original);
      missing.meshes.splice(receipt.replacements[0].mesh, 1);
      expect(finish(prepareEurefTransfersV262(missing, id, native))).toBe(missing);
      const changed = structuredClone(original);
      changed.meshes[receipt.replacements[0].mesh].colors += "AA==";
      expect(finish(prepareEurefTransfersV262(changed, id, native))).toBe(changed);
      const changedSource = structuredClone(original);
      changedSource.meshes[receipt.records[0].mesh].indices += "AA==";
      expect(finish(prepareEurefTransfersV262(changedSource, id, native))).toBe(changedSource);
      const changedNav = structuredClone(original);
      changedNav.nav.groundY += 1;
      expect(finish(prepareEurefTransfersV262(changedNav, id, native))).toBe(changedNav);
      if (original.lines) {
        const changedInk = structuredClone(original);
        changedInk.lines!.positions += "AA==";
        expect(finish(prepareEurefTransfersV262(changedInk, id, native))).toBe(changedInk);
      }
    }
  });

  test("complete identical touch detail stays finite, static, texture free and in budget", () => {
    expect(data.buildings).toHaveLength(19);
    for (const native of [false, true]) {
      const root = createEurefCampusV262(native), touch = createEurefCampusV262(native, { mobileLike: true });
      try {
        expect(root.children).toHaveLength(1);
        const mesh = root.children[0] as InstancedMesh, mobile = touch.children[0] as InstancedMesh;
        expect(mesh.instanceMatrix.array).toEqual(mobile.instanceMatrix.array);
        expect(mesh.instanceColor!.array).toEqual(mobile.instanceColor!.array);
        expect(mesh.count).toBe(native ? 24666 : 15278);
        expect(mesh.matrixAutoUpdate).toBe(false);
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        expect(mesh.userData.dayMaterial).not.toBe(mesh.userData.nightMaterial);
        expect(mesh.userData.dayMaterial.map).toBeNull();
        expect(mesh.userData.nightMaterial.map).toBeNull();
        let bytes = mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
        for (const a of Object.values(mesh.geometry.attributes)) bytes += a.array.byteLength;
        bytes += mesh.geometry.index!.array.byteLength;
        expect(bytes).toBeLessThan(EUREF_V262_PROFILE.budgetBytes);
        expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
        expect(mesh.boundingBox!.min.x).toBeGreaterThan(-1345);
        expect(mesh.boundingBox!.max.x).toBeLessThan(-980);
        expect(mesh.boundingBox!.min.z).toBeGreaterThan(3950);
        expect(mesh.boundingBox!.max.z).toBeLessThan(4315);
        const counts = mesh.userData.roleCounts;
        expect(counts["gasometer-frame-post"]).toBe(24);
        expect(counts["gasometer-post-collar"]).toBe(144);
        expect(counts["gasometer-current-glazing"]).toBeGreaterThan(1000);
        expect(counts["haus14-curved-window-ribbon"]).toBeGreaterThan(100);
        if (!native) {
          expect(counts["gasometer-ring-girder"]).toBe(168);
          expect(counts["gasometer-cross-brace"]).toBe(288);
        } else for (let i = 0; i < mesh.count; i++) for (const axis of [1, 2, 4, 6, 8, 9]) {
          if (mesh.instanceMatrix.array[i * 16 + axis] !== 0) throw new Error(`rotated native block ${i}`);
        }
      } finally { dispose(root); dispose(touch); }
    }
  });

  test("frame and parapet navigation follows the drawn and native members while upper cage stays open", () => {
    const [cx, y, cz] = data.gasometer.center;
    for (const native of [false, true]) {
      const r = native ? data.gasometer.nativeFrameRadiusEstimateM : data.gasometer.frameRadiusEstimateM;
      for (let i = 0; i < 24; i++) {
        const a = 2 * Math.PI * i / 24;
        expect(eurefV262SolidAt(cx + Math.cos(a) * r, y + 72, cz + Math.sin(a) * r, 0, native)).toBe(true);
      }
      expect(eurefV262SolidAt(cx, y + 72, cz, 0, native)).toBe(false);
      expect(eurefV262SolidAt(cx + r + 4, y + 72, cz, 0, native)).toBe(false);
      expect(eurefV262SolidAt(cx, y + 80, cz, 0, native)).toBe(false);
      expect(eurefV262GroundAt(cx, cz, native)).toBeNull();
      expect(eurefV262GroundAt(cx + 50, cz, native)).toBeNull();
      const ring = data.buildings.find(b => b.kind === "gasometer")!.rings[0];
      for (let i = 0; i < ring.length; i += 9) {
        const a = ring[i], b = ring[(i + 1) % ring.length], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        const length = Math.hypot(mx - cx, mz - cz), nx = (mx - cx) / length, nz = (mz - cz) / length;
        expect(eurefV262GroundAt(mx, mz, native)).toBe(y + 66);
        const offset = native ? 1.81 : .27;
        expect(eurefV262SolidAt(mx + nx * offset, y + 66.6, mz + nz * offset, 0, native)).toBe(true);
      }
    }
  });

  test("current glazing clears the actual retained coarse cylinder in both decoded modes", () => {
    const [cx, ground, cz] = data.gasometer.center;
    const ring = data.buildings.find(b => b.kind === "gasometer")!.rings[0];
    for (const native of [false, true]) {
      const mode = native ? "minecraft" : "drawn";
      const packet = JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/euref262--3_8.${mode}.json.gz`, import.meta.url))).toString());
      const decoded = createSurroundingCityChunk(packet, "-3_8", native), details = createEurefCampusV262(native), root = new Group();
      root.add(decoded.root, details); root.updateMatrixWorld(true);
      const ray = new Raycaster(), actual = new Color(), glass = [new Color(0x617D86), new Color(0x485F6D)];
      let visibleGlass = 0;
      try {
        for (let i = 1; i < ring.length; i += 7) {
          const a = ring[i], b = ring[(i + 1) % ring.length], x = a[0] * .65 + b[0] * .35, z = a[1] * .65 + b[1] * .35;
          const normal = new Vector3(x - cx, 0, z - cz).normalize(), target = new Vector3(x, ground + 16 + 5.5 * 49.484 / 13, z);
          ray.set(target.clone().addScaledVector(normal, 7), normal.clone().negate());
          const first = ray.intersectObject(root, true)[0];
          expect(first.object.parent).toBe(details);
          (first.object as InstancedMesh).getColorAt(first.instanceId!, actual);
          if (glass.some(c => Math.abs(c.r - actual.r) + Math.abs(c.g - actual.g) + Math.abs(c.b - actual.b) < 1e-5)) visibleGlass++;
        }
        // Wider native stair steps can cover a sample with a steel member;
        // every sample above still has to clear the retained coarse shell.
        expect(visibleGlass).toBeGreaterThanOrEqual(7);
      } finally { disposeSurroundingCityRoot(decoded.root); dispose(details); }
    }
  });
});
