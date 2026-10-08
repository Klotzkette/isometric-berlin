import { describe, expect, test } from "bun:test";
import { InstancedMesh, Raycaster, Vector3 } from "three";
import {
  chancelleryLoggiaMembersV192, createApproachMemberBatchV192,
  hauptbahnhofNativePortalMembersV192, hauptbahnhofPortalMembersV192,
} from "../src/GovernmentApproachesV192";
import { HAUPTBAHNHOF_ACCESS as ACCESS } from "../src/HauptbahnhofAccessProfile";
import { createArchitecturalSignature, type ArchitecturalSignature } from "../src/ArchitecturalLandmarks";
import { createMinecraftArchitecturalLandmarks, MINECRAFT_ARCHITECTURAL_PROFILES as NATIVE } from "../src/MinecraftArchitecturalLandmarks";
import scene from "../public/mesh/regierungsviertel/scene.json";

function bytes(mesh: InstancedMesh): number {
  return Object.values(mesh.geometry.attributes).reduce((sum, a) => sum + a.array.byteLength, 0)
    + (mesh.geometry.index?.array.byteLength ?? 0)
    + mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
}

describe("bounded source-referenced entrance and loggia metalwork v192", () => {
  test("all twelve drawn door apertures retain their original full clear width", () => {
    for (const side of [-1, 1]) {
      const mesh = createApproachMemberBatchV192("portal", hauptbahnhofPortalMembersV192(side * ACCESS.facadeLocalZ));
      mesh.updateMatrixWorld(true);
      for (const center of ACCESS.doorCentresLocalX) for (const dx of [-1.149, 0, 1.149]) for (const y of [0.5, 1.8, 4.89]) {
        const ray = new Raycaster(new Vector3(center + dx, y, side * 94), new Vector3(0, 0, -side), 0, 8);
        expect(ray.intersectObject(mesh)).toHaveLength(0);
      }
      expect(mesh.count).toBe(18);
      expect(bytes(mesh)).toBeLessThan(2500);
      expect((mesh.material as { map?: unknown }).map).toBeFalsy();
    }
  });

  test("native portals retain their broad opening and use only chunky boxes", () => {
    const profile = NATIVE.hauptbahnhof;
    const entrance = profile.entrances.northSouth;
    for (const side of [-1, 1]) {
      const members = hauptbahnhofNativePortalMembersV192(side * entrance.endLocalZ,
        profile.publicFloorTopLocalY, entrance.clearHeightM, entrance.clearHalfWidthM);
      const mesh = createApproachMemberBatchV192("native test", members);
      mesh.updateMatrixWorld(true);
      for (const x of [-5.99, 0, 5.99]) for (const y of [1.33, 3, 9.09]) {
        const ray = new Raycaster(new Vector3(x, y, side * 94), new Vector3(0, 0, -side), 0, 8);
        expect(ray.intersectObject(mesh)).toHaveLength(0);
      }
      expect(members).toHaveLength(3);
      expect(members.every(m => Math.min(...m.size) >= 0.5)).toBe(true);
    }
  });

  test("loggia additions stay within the old balcony/sill and below the columns", () => {
    for (const native of [false, true]) {
      const members = chancelleryLoggiaMembersV192(66.373, 0.042, 55.211, native);
      expect(members).toHaveLength(native ? 6 : 26);
      for (const m of members) {
        expect(m.position[1] - m.size[1] / 2).toBeGreaterThanOrEqual(10.5);
        expect(m.position[1] + m.size[1] / 2).toBeLessThan(12.8);
        expect(Math.abs(m.position[2] - 0.042) + m.size[2] / 2).toBeLessThan(14.6);
      }
      const mesh = createApproachMemberBatchV192("loggia", members);
      expect(bytes(mesh)).toBeLessThan(3000);
      expect(mesh.geometry.getAttribute("position").count).toBe(24);
    }
  });

  test("production factories attach three small drawn batches and append native cues", () => {
    const signatures = scene.architectural_signatures as unknown as ArchitecturalSignature[];
    let count = 0, memory = 0;
    for (const signature of signatures.filter(s => ["hauptbahnhof_model", "chancellery_model"].includes(s.kind))) {
      createArchitecturalSignature(signature).traverse(o => {
        if (!o.userData.governmentApproachesV192) return;
        const mesh = o as InstancedMesh;
        count += 1; memory += bytes(mesh);
        expect(mesh.userData.keepInMinecraft).toBe(false);
      });
    }
    expect(count).toBe(3);
    expect(memory).toBeLessThan(8000);
    const root = createMinecraftArchitecturalLandmarks();
    let v192Instances = 0;
    root.traverse(o => {
      if (!(o as InstancedMesh).isInstancedMesh) return;
      for (const [cue, amount] of Object.entries(o.userData.cueCounts ?? {})) {
        if (cue.includes("v192")) v192Instances += amount as number;
      }
    });
    expect(v192Instances).toBeGreaterThan(0);
    expect(v192Instances).toBeLessThan(40);
  });
});
