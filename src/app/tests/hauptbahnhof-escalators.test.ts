import { describe, expect, test } from "bun:test";
import { Box3, Group, Object3D } from "three";

import {
  type HauptbahnhofModelSignature,
  createArchitecturalSignature,
} from "../src/ArchitecturalLandmarks";

function station(): Object3D {
  const signature = {
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
  const group = createArchitecturalSignature(signature);
  if (!group) {
    throw new Error("the Hauptbahnhof signature must build");
  }
  return group;
}

function named(root: Object3D, needle: string): Object3D[] {
  const hits: Object3D[] = [];
  root.traverse((object) => {
    if (object.name.includes(needle) && !object.name.endsWith("model edges")) {
      hits.push(object);
    }
  });
  return hits;
}

describe("Hauptbahnhof escalator descent", () => {
  const root = station();

  test("every flight is a detailed run, not a tilted plank", () => {
    // Two arms x three gaps x two edges = twelve flights; each carries
    // step ridges, two glass balustrades, two handrails and two comb
    // plates ("Rolltreppenwege in die Tiefe").
    const flights = named(root, "escalator run").filter(
      (object) => object instanceof Group && object.name.endsWith("run"),
    );
    expect(flights).toHaveLength(12);
    expect(named(root, "instanced step ridges")).toHaveLength(12);
    expect(
      named(root, "Hauptbahnhof escalator run glass balustrade"),
    ).toHaveLength(24);
    expect(named(root, "handrail")).toHaveLength(24);
    expect(named(root, "upper comb plate")).toHaveLength(12);
    expect(named(root, "lower comb plate")).toHaveLength(12);
  });

  test("the deepest flights land on the inner island platforms", () => {
    // A flight down to -15 m that stayed at x = +-5.2 would land on a
    // TRACK. The deep flights walk outward to the platform centres at
    // +-9.5 m, so the path ends where a passenger can stand.
    const deepFlights = named(root, "escalator run")
      .filter(
        (object) => object instanceof Group && object.name.endsWith("run"),
      )
      .filter((flight) => {
        const box = new Box3().setFromObject(flight);
        return box.min.y < -12;
      });
    expect(deepFlights.length).toBe(4);
    for (const flight of deepFlights) {
      const box = new Box3().setFromObject(flight);
      const outerReach = Math.max(Math.abs(box.min.x), Math.abs(box.max.x));
      expect(outerReach).toBeGreaterThan(8.2);
    }
  });

  test("the descent is continuous from the gallery to the deep station", () => {
    // The three gap levels chain +4.6 -> 0 -> -5.4 -> -15: the top of the
    // highest flight and the bottom of the deepest one span the full
    // vertical route a passenger rides.
    const flights = named(root, "escalator run").filter(
      (object) => object instanceof Group && object.name.endsWith("run"),
    );
    const all = new Box3();
    for (const flight of flights) {
      all.union(new Box3().setFromObject(flight));
    }
    expect(all.max.y).toBeGreaterThan(4.0);
    expect(all.min.y).toBeLessThan(-14.0);
  });
});
