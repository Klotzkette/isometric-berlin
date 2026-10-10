import { describe, expect, test } from "bun:test";

import { Group, InstancedMesh, Matrix4, PerspectiveCamera } from "three";

import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  SIGNAL_CYCLE,
  SIGNAL_CYCLE_SECONDS,
  STREET_DETAILS_FILE,
  type StreetDetailsPayload,
  createTrafficSignals,
  lampsLit,
  signalPhase,
  updateTrafficSignals,
  updateVisibleTrafficSignals,
} from "../src/TrafficSignals";
import { withAltMitteTrafficV206, altMitteSignalPayloadV206 } from "../src/AltMitteTransportV206";
import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const street = streetDetails as unknown as StreetDetailsPayload;
const ground = voxelPayload as unknown as VoxelPayload;

describe("task 07: animated OSM traffic signals", () => {
  test("visible phases wake a still view, with bounded checks and no offscreen uploads", () => {
    const group = createTrafficSignals({ ...street, traffic_signals_dm: [[0, 0]],
      traffic_signal_placements: undefined }, ground)!;
    const camera = new PerspectiveCamera(60, 1, 0.1, 100);
    const y = (group.userData.signalCentres as Float32Array)[1];
    camera.position.set(0, y, 20); camera.lookAt(0, y, 0);
    const lamps = group.getObjectByName("traffic signal lamps") as InstancedMesh;
    expect(updateVisibleTrafficSignals(group, camera, 0, false)).toBe(true);
    const initialVersion = lamps.instanceColor!.version;
    expect(updateVisibleTrafficSignals(group, camera, 200, false)).toBe(false);
    expect(lamps.instanceColor!.version).toBe(initialVersion);
    expect(updateVisibleTrafficSignals(group, camera, 21_000, false)).toBe(true);
    expect(group.userData.lastBuckets[0]).toBe(1);
    expect(updateVisibleTrafficSignals(group, camera, 22_500, false)).toBe(true);
    expect(group.userData.lastBuckets[0]).toBe(2);
    camera.lookAt(0, y, 40);
    const version = lamps.instanceColor!.version;
    expect(updateVisibleTrafficSignals(group, camera, 44_500, false)).toBe(false);
    expect(lamps.instanceColor!.version).toBe(version);
    camera.lookAt(0, y, 0);
    expect(updateVisibleTrafficSignals(group, camera, 45_000, false)).toBe(true);
    expect(group.userData.lastBuckets[0]).toBe(0);
    // User toggles bypass the cadence; they must not wait for the next tick.
    expect(updateVisibleTrafficSignals(group, camera, 45_001, false, false)).toBe(true);
    expect(group.userData.lastBuckets[0]).toBe(-2);
    expect(updateVisibleTrafficSignals(group, camera, 45_002, true, true)).toBe(true);
    expect(group.userData.lastBuckets[0]).toBe(2);
    const parent = new Group(); parent.add(group); parent.visible = false;
    expect(updateVisibleTrafficSignals(group, camera, 90_000, false)).toBe(false);
    expect(group.userData.lastBuckets[0]).toBe(2);
  });

  test("Alt-Mitte keeps all old signals and adds grounded, oriented, hooded heads", () => {
    const merged = withAltMitteTrafficV206(street);
    expect(merged.traffic_signal_placements).toHaveLength(1496);
    const group = createTrafficSignals(merged, ground)!;
    const poles = group.getObjectByName("traffic signal poles") as InstancedMesh;
    const hoods = group.getObjectByName("traffic signal visor hoods v206") as InstancedMesh;
    expect(poles.count).toBe(1496);
    expect(hoods.count).toBe(430 * 5);
    const nativePayload = altMitteSignalPayloadV206();
    const native = createTrafficSignals(nativePayload, null, { native: true })!;
    expect((native.getObjectByName("traffic signal poles") as InstancedMesh).count).toBe(430);
    const heads = native.getObjectByName("traffic signal heads") as InstancedMesh;
    const matrix = new Matrix4();
    for (let i = 0; i < heads.count; i++) {
      heads.getMatrixAt(i, matrix);
      for (const j of [0, 2, 8, 10]) expect(Math.abs(matrix.elements[j] - Math.round(matrix.elements[j]))).toBeLessThan(1e-6);
      expect(matrix.elements[13]).toBeGreaterThan(nativePayload.traffic_signal_placements![i].native_ground_y_m!);
    }
    // A heading points the shallow lit face along +Z after yaw; the back is black.
    const one = { ...nativePayload, traffic_signal_placements: [{ ...nativePayload.traffic_signal_placements![0], heading_rad: Math.PI / 2 }],
      traffic_signals_dm: [nativePayload.traffic_signals_dm[0]] };
    const oriented = createTrafficSignals(one, null)!;
    const lamp = oriented.getObjectByName("traffic signal lamps") as InstancedMesh;
    lamp.getMatrixAt(0, matrix);
    expect(matrix.elements[12]).toBeCloseTo(one.traffic_signal_placements[0].position_dm[0] / 10 + .18, 3);
    expect(matrix.elements[14]).toBeCloseTo(one.traffic_signal_placements[0].position_dm[1] / 10, 3);
    for (const item of [group, native, oriented]) item.traverse(object => {
      const mesh = object as InstancedMesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material?.dispose();
      if (mesh.isInstancedMesh) mesh.dispose();
    });
  });

  test("the payload carries every surveyed signal inside bounds", () => {
    expect(street.schema_version).toBe(7);
    expect(street.traffic_signals_dm.length).toBe(1_328);
    expect(
      new Set(street.traffic_signals_dm.map(([x, z]) => `${x}:${z}`)).size,
    ).toBe(street.traffic_signals_dm.length);
    expect(street.traffic_signal_placements).toHaveLength(1_328);
    const roles = new Map<string, number>();
    for (const placement of street.traffic_signal_placements!) {
      roles.set(placement.placement, (roles.get(placement.placement) ?? 0) + 1);
    }
    expect(Object.fromEntries(roles)).toEqual({
      relocated_verge: 1_093,
      surveyed_verge: 227,
      verified_island: 8,
    });
    expect(
      street.traffic_signal_placements!.filter(
        (entry) =>
          entry.placement === "relocated_verge" &&
          entry.source_on_carriageway === false,
      ).map((entry) => entry.osm_key),
    ).toEqual(["node/3098737953"]);
    expect(STREET_DETAILS_FILE).toBe("street-details.json?schema=7");
    expect(street.source.toLowerCase()).toContain("openstreetmap");
    // Schema v2 also carries the monuments ("alle Denkmäler").
    expect(street.monuments!.length).toBeGreaterThan(40);
  });

  test("the German phase sequence cycles red → red+amber → green → amber", () => {
    expect(signalPhase(0)).toBe(0);
    expect(signalPhase(SIGNAL_CYCLE.red + 0.5)).toBe(1);
    expect(signalPhase(SIGNAL_CYCLE.red + SIGNAL_CYCLE.redAmber + 1)).toBe(2);
    expect(signalPhase(SIGNAL_CYCLE_SECONDS - 1)).toBe(3);
    expect(signalPhase(SIGNAL_CYCLE_SECONDS + 0.25)).toBe(0);
    expect(lampsLit(0)).toEqual([true, false, false]);
    expect(lampsLit(1)).toEqual([true, true, false]);
    expect(lampsLit(2)).toEqual([false, false, true]);
    expect(lampsLit(3)).toEqual([false, true, false]);
  });

  test("every signal becomes one instanced pole + head + three lamps", () => {
    const group = createTrafficSignals(street, ground);
    expect(group).toBeInstanceOf(Group);
    const poles = group!.getObjectByName("traffic signal poles") as InstancedMesh;
    const lamps = group!.getObjectByName("traffic signal lamps") as InstancedMesh;
    const islands = group!.getObjectByName(
      "traffic signal verified island bases",
    ) as InstancedMesh;
    expect(poles.count).toBe(1_328);
    expect(lamps.count).toBe(poles.count * 3);
    expect(islands.count).toBe(8);
    expect(group!.children).toHaveLength(4);
    // Phase offsets differ across junctions (no unison blinking).
    const phases = group!.userData.phases as Float32Array;
    expect(new Set(Array.from(phases, (p) => Math.round(p * 10))).size)
      .toBeGreaterThan(10);
  });

  test("schema-7 matrices use the physical verge anchors while phases remain source-bound", () => {
    const group = createTrafficSignals(street, ground)!;
    const poles = group.getObjectByName("traffic signal poles") as InstancedMesh;
    const renderedSources = group.userData.sourceDm as Array<[number, number]>;
    const moved = street.traffic_signal_placements!.find(
      (entry) => entry.placement === "relocated_verge",
    )!;
    const index = renderedSources.findIndex(
      ([x, z]) => x === moved.source_dm[0] && z === moved.source_dm[1],
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const matrix = new Matrix4();
    poles.getMatrixAt(index, matrix);
    expect(Math.round(matrix.elements[12] * 10)).toBe(moved.position_dm[0]);
    expect(Math.round(matrix.elements[14] * 10)).toBe(moved.position_dm[1]);
    expect(moved.position_dm).not.toEqual(moved.source_dm);

    const phases = group.userData.phases as Float32Array;
    const expectedPhase =
      (Math.abs(
        Math.imul(moved.source_dm[0], 2654435761) ^
          Math.imul(moved.source_dm[1], 40503),
      ) %
        (SIGNAL_CYCLE_SECONDS * 10)) /
      10;
    expect(phases[index]).toBeCloseTo(expectedPhase, 4);
  });

  test("an old cached payload still falls back to its raw source coordinates", () => {
    const legacy = {
      ...street,
      traffic_signal_placements: undefined,
    } satisfies StreetDetailsPayload;
    const group = createTrafficSignals(legacy, ground)!;
    const poles = group.getObjectByName("traffic signal poles") as InstancedMesh;
    const renderedSources = group.userData.sourceDm as Array<[number, number]>;
    const matrix = new Matrix4();
    poles.getMatrixAt(0, matrix);
    expect(Math.round(matrix.elements[12] * 10)).toBe(renderedSources[0][0]);
    expect(Math.round(matrix.elements[14] * 10)).toBe(renderedSources[0][1]);
    expect(
      group.getObjectByName("traffic signal verified island bases"),
    ).toBeUndefined();
  });

  test("animation lights exactly one configuration per signal; reduced motion pins green", () => {
    const group = createTrafficSignals(street, ground)!;
    const lamps = group.getObjectByName("traffic signal lamps") as InstancedMesh;
    updateTrafficSignals(group, 12.5, false);
    const colors = lamps.instanceColor!.array as Float32Array;
    // Some lamp somewhere is bright (an "on" channel above 0.7).
    let bright = 0;
    for (let index = 0; index < colors.length; index += 1) {
      if (colors[index] > 0.7) {
        bright += 1;
      }
    }
    expect(bright).toBeGreaterThan(0);
    // Reduced motion: every signal shows green (lamp 2 bright green).
    updateTrafficSignals(group, 99, true);
    const phases = group.userData.phases as Float32Array;
    for (let index = 0; index < phases.length; index += 1) {
      // Colours live in linear space; 0x30d158's green lands ~0.64.
      const greenG = colors[(index * 3 + 2) * 3 + 1];
      const redR = colors[index * 3 * 3];
      expect(greenG).toBeGreaterThan(0.5);
      expect(redR).toBeLessThan(0.4);
    }
  });

  test("moonlight (lights off) dims every lamp regardless of phase, but keeps the clock running", () => {
    const group = createTrafficSignals(street, ground)!;
    const lamps = group.getObjectByName("traffic signal lamps") as InstancedMesh;
    const colors = lamps.instanceColor!.array as Float32Array;

    // Lights on first, so we know some lamp is genuinely bright beforehand.
    updateTrafficSignals(group, 12.5, false, true);
    let brightBefore = 0;
    for (let index = 0; index < colors.length; index += 1) {
      if (colors[index] > 0.7) {
        brightBefore += 1;
      }
    }
    expect(brightBefore).toBeGreaterThan(0);

    // Licht aus: every lamp of every signal must render as off, no matter
    // which phase its junction happens to be in.
    updateTrafficSignals(group, 12.5, false, false);
    for (let index = 0; index < colors.length; index += 1) {
      expect(colors[index]).toBeLessThan(0.4);
    }
  });

  test("turning the lights back on restores the exact phase the clock reached while dark", () => {
    const group = createTrafficSignals(street, ground)!;
    const lamps = group.getObjectByName("traffic signal lamps") as InstancedMesh;
    const colors = lamps.instanceColor!.array as Float32Array;

    // Establish the true phase configuration lights-on would show at t=40.
    const reference = createTrafficSignals(street, ground)!;
    const referenceLamps = reference.getObjectByName(
      "traffic signal lamps",
    ) as InstancedMesh;
    updateTrafficSignals(reference, 40, false, true);
    const referenceColors = referenceLamps.instanceColor!.array as Float32Array;

    // Same group: lights off throughout, then back on at the same timestamp.
    updateTrafficSignals(group, 12.5, false, false);
    updateTrafficSignals(group, 40, false, false);
    for (let index = 0; index < colors.length; index += 1) {
      expect(colors[index]).toBeLessThan(0.4);
    }
    updateTrafficSignals(group, 40, false, true);
    for (let index = 0; index < colors.length; index += 1) {
      expect(colors[index]).toBeCloseTo(referenceColors[index], 5);
    }
  });
});
