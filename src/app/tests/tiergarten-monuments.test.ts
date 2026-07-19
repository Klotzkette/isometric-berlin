import { describe, expect, test } from "bun:test";

import { Box3, Group, LineSegments, Mesh, Vector3 } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import {
  MONUMENTS_ALREADY_MODELLED,
  createTiergartenMonuments,
} from "../src/TiergartenMonuments";
import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const street = streetDetails as unknown as StreetDetailsPayload;
const ground = voxelPayload as unknown as VoxelPayload;

describe("drawn Tiergarten monuments (OSM historic layer)", () => {
  const monuments = createTiergartenMonuments(street, ground)!;

  test("the payload carries the requested monuments by name", () => {
    const names = street.monuments!.map((entry) => entry.name).join("|");
    expect(names).toContain("ermordeten Juden Europas");
    expect(names).toContain("Sowjetisches Ehrenmal");
    expect(names).toContain("Verkehrsturm");
    expect(names).toContain("Lessing");
    // The Soviet memorial's surveyed hardware is present too.
    const kinds = street.monuments!.map((entry) => entry.kind);
    expect(kinds.filter((kind) => kind === "tank").length).toBe(2);
    expect(kinds.filter((kind) => kind === "cannon").length).toBe(2);
  });

  test("landmarks the recognition layer already models are skipped here", () => {
    expect(MONUMENTS_ALREADY_MODELLED.test("Denkmal für die ermordeten Juden Europas")).toBe(true);
    expect(MONUMENTS_ALREADY_MODELLED.test("Sowjetisches Ehrenmal Tiergarten")).toBe(true);
    expect(MONUMENTS_ALREADY_MODELLED.test("Verkehrsturm")).toBe(false);
    expect(MONUMENTS_ALREADY_MODELLED.test("Gotthold Ephraim Lessing")).toBe(false);
    // No drawn-monument geometry near the Soviet memorial's colonnade
    // (its recognition model owns that ground; only the two howitzers
    // between the tanks are ours).
    const bodies = monuments.getObjectByName("monument bodies") as Mesh;
    const position = bodies.geometry.getAttribute("position");
    const vertex = new Vector3();
    let tallAtEhrenmal = 0;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        Math.abs(vertex.x - 27.4) < 30 &&
        Math.abs(vertex.z - 258.1) < 30 &&
        vertex.y > 8
      ) {
        tallAtEhrenmal += 1;
      }
    }
    expect(tallAtEhrenmal).toBe(0);
  });

  test("monuments merge into one drawn mesh with ink lines", () => {
    expect(monuments).toBeInstanceOf(Group);
    const bodies = monuments.getObjectByName("monument bodies");
    const ink = monuments.getObjectByName("monument ink lines");
    expect(bodies).toBeInstanceOf(Mesh);
    expect(ink).toBeInstanceOf(LineSegments);
    expect((bodies as Mesh).geometry.getAttribute("color")).toBeDefined();
  });

  test("the Verkehrsturm rises at the surveyed Potsdamer Platz corner", () => {
    const entry = street.monuments!.find((candidate) =>
      candidate.name.includes("Verkehrsturm"),
    )!;
    const bodies = monuments.getObjectByName("monument bodies") as Mesh;
    const position = bodies.geometry.getAttribute("position");
    const vertex = new Vector3();
    let towerTop = 0;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      if (
        Math.abs(vertex.x - entry.x_dm / 10) < 4 &&
        Math.abs(vertex.z - entry.z_dm / 10) < 4
      ) {
        towerTop = Math.max(towerTop, vertex.y);
      }
    }
    // ~8.9 m tower head above the plaza (ground ≈ 34 m NHN offset).
    const groundBounds = new Box3().setFromObject(bodies);
    expect(towerTop - groundBounds.min.y).toBeGreaterThan(7);
  });
});
