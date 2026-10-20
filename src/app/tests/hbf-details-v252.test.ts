import { describe, expect, test } from "bun:test";
import { Box3, Group, InstancedMesh, Matrix4, Vector3 } from "three";
import { createArchitecturalSignature, type HauptbahnhofModelSignature } from "../src/ArchitecturalLandmarks";
import { hbfFlightEndpointsV252, hbfNativeDescentCuesV252, HBF_DETAILS_V252 } from "../src/HbfDetailsV252";
import { hauptbahnhofGroundAt } from "../src/HauptbahnhofNavigation";
import { createHbfNorthApproach } from "../src/HbfNorthApproach";

const signature = {
  id: "hauptbahnhof-model", kind: "hauptbahnhof_model", landmark_name: "Berlin Hauptbahnhof",
  anchor_world: [0, 0, 0], rotation_y_degrees: 0,
  east_west_roof_length_m: 321, east_west_roof_width_m: 40,
  north_south_hall_length_m: 180, north_south_hall_width_m: 42,
  office_bridge_height_m: 46, source: "test", geometry_status: "metric test",
  focus_camera: { azimuth_degrees: 45, distance_m: 200, polar_degrees: 60, target_height_m: 18 },
} as unknown as HauptbahnhofModelSignature;

describe("Bounded Hauptbahnhof v252 street and descent recognition", () => {
  const root = createArchitecturalSignature(signature)!;
  root.updateMatrixWorld(true);
  const flights: Group[] = [];
  root.traverse(o => { if (o instanceof Group && o.name === "Hauptbahnhof escalator run") flights.push(o); });

  test("adds horizontal tread caps to the twelve existing ridge batches", () => {
    expect(flights).toHaveLength(12);
    let count = 0;
    const local = new Matrix4(), world = new Matrix4();
    for (const flight of flights) {
      const ridges = flight.getObjectByName("Hauptbahnhof escalator run instanced step ridges") as InstancedMesh;
      const added = flight.userData.hbfV252HorizontalTreadCount as number;
      expect(added).toBeGreaterThan(15);
      for (let i = ridges.count - added; i < ridges.count; i++) {
        ridges.getMatrixAt(i, local);
        world.multiplyMatrices(ridges.matrixWorld, local);
        // Horizontal top means its local Y axis stays vertical, despite the
        // parent following the inclined and sideways-drifting carrier.
        const normal = new Vector3(0, 1, 0).transformDirection(world);
        expect(normal.y).toBeCloseTo(1, 6);
      }
      count += added;
    }
    expect(count).toBe(312);
  });

  test("corrects only the four exactly receipted unsupported deep flights", () => {
    let deep = 0;
    for (const flight of flights) {
      const { from, to } = flight.userData.hbfV252Endpoints;
      if (to[1] > -10) continue;
      deep++;
      expect(Math.abs(from[2])).toBe(HBF_DETAILS_V252.deepTopZ);
      expect(Math.abs(to[2])).toBe(HBF_DETAILS_V252.deepBottomZ);
      expect(from[1]).toBe(-5.15);
      expect(to[1]).toBe(-14.055);
      // Both horizontal comb plates fit the existing slabs, including their
      // full 2.2 m length. Nothing reaches the outer deep-platform track ends.
      expect(Math.abs(from[2]) - 2.1).toBeGreaterThan(68.4);
      expect(Math.abs(to[2]) + 2.1).toBeLessThan(84);
      const worldPoint = (p: number[]) => {
        const yaw = 21.82 * Math.PI / 180;
        return [-119.936 + p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw),
          4.575 + p[1], -683.307 - p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw)];
      };
      for (const p of [from, to]) {
        const w = worldPoint(p);
        expect(hauptbahnhofGroundAt("day", w[0], w[2], w[1])).toBeCloseTo(w[1], 5);
      }
    }
    expect(deep).toBe(4);
    expect(hbfFlightEndpointsV252([5.2, -5.4, 76.1], [9.5, -14.53, 93.347]).corrected).toBe(false);
    expect(hbfFlightEndpointsV252([0, -5.4, 76], [0, -14.53, 93.347]).corrected).toBe(false);
  });

  test("keeps native cues on its actual intact concourse floor", () => {
    const cues = hbfNativeDescentCuesV252(1.32);
    expect(cues).toHaveLength(40);
    for (const cue of cues) {
      expect(cue.position[1] - cue.size[1] / 2).toBeGreaterThan(1.32);
      expect(cue.position[1] + cue.size[1] / 2).toBeLessThan(1.4);
      expect(Math.abs(cue.position[0]) + cue.size[0] / 2).toBeLessThan(7);
    }
  });

  test("adds street members inside the two existing batches without materials or textures", () => {
    for (const native of [false, true]) {
      const street = createHbfNorthApproach(() => 5.2, native);
      expect(street.children).toHaveLength(native ? 1 : 2);
      expect(street.userData.hbfStreetDetailsV252).toBe(HBF_DETAILS_V252.source);
      const members = street.children[0] as InstancedMesh;
      const matrix = new Matrix4();
      let found = 0;
      for (let i = 0; i < members.count; i++) {
        members.getMatrixAt(i, matrix);
        const box = new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5)).applyMatrix4(matrix);
        if (box.min.z < -935 || box.max.z > -390) continue;
        found++;
        if (native) expect([matrix.elements[1], matrix.elements[2], matrix.elements[4],
          matrix.elements[6], matrix.elements[8], matrix.elements[9]].every(v => Math.abs(v) < 1e-6)).toBe(true);
      }
      expect(found).toBeGreaterThan(300);
    }
  });
});
