import { describe, expect, test } from "bun:test";
import { Box3, Group, Mesh, Object3D } from "three";

import {
  type HauptbahnhofModelSignature,
  createArchitecturalSignature,
} from "../src/ArchitecturalLandmarks";

function landmarkGroup(): Object3D {
  const signature: HauptbahnhofModelSignature = {
    anchor_world: [0, 0, 0],
    east_west_roof_length_m: 321,
    east_west_roof_width_m: 40,
    focus_camera: {
      azimuth_degrees: 45,
      distance_m: 200,
      polar_degrees: 60,
      target_height_m: 18,
    },
    geometry_status: "metric test",
    id: "hauptbahnhof-model",
    kind: "hauptbahnhof_model",
    landmark_name: "Berlin Hauptbahnhof",
    north_south_hall_length_m: 180,
    north_south_hall_width_m: 42,
    office_bridge_height_m: 46,
    rotation_y_degrees: 0,
    source: "test",
  } as unknown as HauptbahnhofModelSignature;
  const station = createArchitecturalSignature(signature);
  if (!station) {
    throw new Error("the Hauptbahnhof signature must build");
  }
  return station;
}

/**
 * Objects whose name contains `needle`, excluding the ink-line companions
 * `addBox` emits alongside every solid (they carry the same base name with
 * a " model edges" suffix), so a count here is a count of real bodies.
 */
function named(root: Object3D, needle: string): Object3D[] {
  const hits: Object3D[] = [];
  root.traverse((object) => {
    if (object.name.includes(needle) && !object.name.endsWith("model edges")) {
      hits.push(object);
    }
  });
  return hits;
}

describe("Hauptbahnhof deep level", () => {
  const root = landmarkGroup();

  test("carries the real eight tracks at four island platforms", () => {
    // Berlin Hbf's lower level is Gleis 1-8 at four island platforms. The
    // model used to draw three tracks, which is not a station anyone would
    // recognise from above through the daylight slot.
    expect(named(root, "deep-level island platform")).toHaveLength(4);
    // Two rails per track.
    expect(named(root, "deep-level rail")).toHaveLength(16);
    expect(named(root, "deep-level ballast")).toHaveLength(8);
  });

  test("is a tunnel box, not a floating slab", () => {
    expect(named(root, "deep-level box wall").length).toBeGreaterThanOrEqual(2);
    expect(named(root, "deep-level platform floor").length).toBe(1);
  });

  test("stock stands at the deep platforms and runs north-south", () => {
    const trains = named(root, "deep-level ICE").filter(
      (object) => object instanceof Group,
    );
    expect(trains.length).toBe(2);
    for (const train of trains) {
      // A quarter turn puts the vehicle on the north-south axis; without it
      // the train would lie across its own platforms.
      expect(Math.abs(train.rotation.y - Math.PI / 2)).toBeLessThan(1e-6);
      const box = new Box3().setFromObject(train);
      const size = box.getSize(box.max.clone());
      expect(size.z).toBeGreaterThan(size.x);
    }
  });

  test("a driving car has a raked nose and pantographs, not a flat cap", () => {
    // "Die Züge … das ist zu platt": a bare capsule cap shows a flat disc
    // end-on. Three stacked slices give the power car its rake, and the
    // pantographs read as solid from the angle isometry actually uses.
    // Three slices per cab end, two ends, per train: twelve for the two
    // deep-level ICEs plus six for the S-Bahn standing upstairs, which
    // gains the same nose because both come from one builder.
    expect(named(root, "raked nose").length).toBe(18);
    expect(named(root, "pantograph base").length).toBe(6);
    expect(named(root, "pantograph contact strip").length).toBe(6);
  });

  test("the deep level sits below the concourse it belongs to", () => {
    const floor = named(root, "deep-level platform floor")[0] as Mesh;
    const box = new Box3().setFromObject(floor);
    expect(box.max.y).toBeLessThan(0);
  });
});
