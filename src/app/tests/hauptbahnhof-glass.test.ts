import { describe, expect, test } from "bun:test";
import { Box3, Group, InstancedMesh, Mesh, MeshStandardMaterial, Vector3 } from "three";

import {
  createArchitecturalSignature,
  HAUPTBAHNHOF_ANCHOR_WORLD,
  HAUPTBAHNHOF_ROTATION_Y_DEGREES,
  type HauptbahnhofModelSignature,
} from "../src/ArchitecturalLandmarks";

const base = {
  anchor_world: HAUPTBAHNHOF_ANCHOR_WORLD.concat([4.575]) as [number, number, number],
  focus_camera: {
    azimuth_degrees: 52,
    distance_m: 370,
    polar_degrees: 42,
    target_height_m: 21,
  },
  geometry_status: "metric test",
  landmark_name: "Berlin Hauptbahnhof",
  rotation_y_degrees: HAUPTBAHNHOF_ROTATION_Y_DEGREES,
  source_url: "https://www.deutschebahn.com/de/architektur_bahnhof-6878040",
};

const signature: HauptbahnhofModelSignature = {
  ...base,
  east_west_roof_length_m: 321,
  east_west_roof_width_m: 40,
  id: "hauptbahnhof-model",
  kind: "hauptbahnhof_model",
  north_south_hall_length_m: 180,
  north_south_hall_width_m: 42,
  office_bridge_height_m: 46,
};

// The station's own local footprint is roughly this size (roof width and
// office-bridge span dominate the z axis, the full 431 m deck the x
// axis); anything opaque and large that lives above track-deck height
// (~9.8 m) and inside this footprint would read as the "grey box" the
// user rejected in v0.55.
const FOOTPRINT_HALF_X = 280;
const FOOTPRINT_HALF_Z = 110;
// The elevated deck's own rails/ballast/sleepers/platforms are legitimate
// opaque interior structure -- real steel, ballast and concrete, seen
// THROUGH the glass roof above, exactly as the reference photos show.
// The problem the user rejected in v0.55 was specifically opaque
// EXTERIOR envelope volumes at roof height and above (the office-bridge
// roof cap, the mismatched outline box) -- i.e. large, roof-scale masses
// well above the track deck, not the deck furniture itself. So this
// check only looks above the barrel roofs' own base height.
const ROOF_BASE_Y = 10.4;
const LARGE_FOOTPRINT_AREA_M2 = 80;

function isLargeBox(mesh: Mesh): boolean {
  const bounds = new Box3().setFromObject(mesh);
  const size = bounds.getSize(new Vector3());
  return size.x * size.z > LARGE_FOOTPRINT_AREA_M2;
}

describe("step-39: the aboveground Hauptbahnhof is built from glass, not grey boxes", () => {
  test("no opaque large-footprint mesh sits above deck height inside the station footprint", () => {
    const station = createArchitecturalSignature(signature) as Group;
    expect(station).not.toBeNull();
    const offenders: string[] = [];
    station.traverse((child) => {
      if (!(child instanceof Mesh)) {
        return;
      }
      // Instanced structural members (ribs, purlins, mullions) are real
      // thin steel, correctly opaque -- their bounding box spans the
      // whole roof length even though the material itself covers a tiny
      // fraction of that box, so they are not "grey box" volumes. The
      // stationary S-Bahn is real rolling stock visible through the
      // glass, not part of the exterior envelope either.
      if (child instanceof InstancedMesh) {
        return;
      }
      if (child.name.includes("S-Bahn") || child.name.includes("ICE")) {
        return;
      }
      const material = child.material as MeshStandardMaterial | MeshStandardMaterial[];
      const materials = Array.isArray(material) ? material : [material];
      const isOpaque = materials.some(
        (m) => !m.transparent && (m.opacity === undefined || m.opacity >= 0.98),
      );
      if (!isOpaque) {
        return;
      }
      const bounds = new Box3().setFromObject(child);
      const centreX = (bounds.max.x + bounds.min.x) / 2;
      const centreZ = (bounds.max.z + bounds.min.z) / 2;
      const withinFootprint =
        Math.abs(centreX) < FOOTPRINT_HALF_X && Math.abs(centreZ) < FOOTPRINT_HALF_Z;
      // "Above roof-base height" -- the envelope zone, not the interior
      // deck/track/platform furniture below it.
      const aboveRoofBase = bounds.min.y > ROOF_BASE_Y;
      if (withinFootprint && aboveRoofBase && isLargeBox(child)) {
        offenders.push(child.name);
      }
    });
    expect(offenders).toEqual([]);
  });

  test("the east-west roof, north-south hall, entrance facades and office-bridge roof caps are all transparent glass", () => {
    const station = createArchitecturalSignature(signature) as Group;
    const glassNames = [
      "Hauptbahnhof 321 m east-west glass roof",
      "Hauptbahnhof 180 m north-south hall",
      "Hauptbahnhof Europaplatz entrance facade",
      "Hauptbahnhof Washingtonplatz entrance facade",
      "Hauptbahnhof office-bridge roof cap",
    ];
    for (const name of glassNames) {
      const matches = station!.children.filter((child) => child.name === name);
      // Some names (roof cap) occur twice, once per tower; others once.
      expect(matches.length).toBeGreaterThan(0);
      for (const match of matches) {
        const mesh = match as Mesh;
        const material = mesh.material as MeshStandardMaterial;
        expect(material.transparent).toBe(true);
        expect(material.opacity).toBeLessThan(0.9);
      }
    }
  });

  test("the two Bugelbauten body volumes are transparent glass, not opaque towers", () => {
    const station = createArchitecturalSignature(signature) as Group;
    const towers = station!.children.filter(
      (child) => child.name === "Hauptbahnhof 46 m office bridge",
    );
    expect(towers).toHaveLength(2);
    for (const tower of towers) {
      const material = (tower as Mesh).material as MeshStandardMaterial;
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeLessThan(0.9);
    }
  });

  test("no legacy grey/opaque office-bridge outline or spandrel object remains", () => {
    const station = createArchitecturalSignature(signature) as Group;
    // v0.55 drew a mismatched independent outline box and a fully opaque
    // "spandrel" roof cap; both are gone in v0.56 -- the roof cap is now
    // glass (checked above) and there is no separate oversized outline.
    expect(
      station!.children.some((child) => child.name.includes("spandrel")),
    ).toBe(false);
  });
});
