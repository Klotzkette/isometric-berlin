import { expect, test } from "bun:test";
import { Color, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import scene from "../public/mesh/regierungsviertel/scene.json";
import raster from "../public/mesh/regierungsviertel/ground-context.json";
import {
  createArchitecturalSignature,
  type BrandenburgGateModelSignature,
} from "../src/ArchitecturalLandmarks";
import { districtStreetTerrainSampler } from "../src/DistrictStreets";
import { createGateForecourtsV374 } from "../src/GateForecourtsV374";
import { createGroundSlabs, type VoxelPayload } from "../src/terrainPayload";
import { ISO_GROUND_SHADES } from "../src/IsometricCityWorld";
import { pointInBrandenburgApproach } from "../src/brandenburgApproachScope";
import { createAltMitteCoreV169FromSource } from "../src/AltMitteCoreV169";
import {
  gateHallColumns,
  gatePavementTopV374,
  gateHallsV374,
  GATE_COLONNADE_PRISMS_V374,
  hallPoint,
} from "../src/BrandenburgGatehouseSourceV374";
import { skylineArchitecturalFinish } from "../src/skylineFinishes";
import { visualModeWalkableInteriorAt } from "../src/visualModePedestrianAccess";
import { addBrandenburgGateWingsV374 } from "../src/BrandenburgGateWingsV374";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import packet from "../src/data/altMitteV169Drawn/packet-014.json";
import receipt from "../src/data/brandenburgGatehouseCoresV374.json";

const ground = raster as unknown as VoxelPayload;
const packetSource = {
  schemaVersion: 1,
  drawnChunks: [{ id: packet.id, packet: packet as unknown as SurroundingCityChunk }],
  minecraftChunks: [],
  sourceParents: [],
} as const;

function toWorld(x: number, y: number, z: number): [number, number, number] {
  const a = (receipt.rotation * Math.PI) / 180;
  return [
    receipt.anchor[0] + x * Math.cos(a) + z * Math.sin(a),
    receipt.anchor[1] + y,
    receipt.anchor[2] - x * Math.sin(a) + z * Math.cos(a),
  ];
}

test("only the 33 measured, reconstructed guardroom faces transfer out of the original packet", () => {
  function build(replace: boolean) {
    return createAltMitteCoreV169FromSource(
      {
        ...packetSource,
        drawnChunks: [...packetSource.drawnChunks],
        minecraftChunks: [],
        sourceParents: [],
      },
      false,
      { gateWingsV374: replace },
    );
  }
  const previous = build(false),
    current = build(true);
  const oldMesh = previous.children[0].children[0] as Mesh;
  const newMesh = current.children[0].children[0] as Mesh;
  expect(current.children[0].userData.gatehouseCoreFacesV374).toBe(33);
  const before = oldMesh.geometry.index!.array,
    after = newMesh.geometry.index!.array;
  expect(before.length).toBe(after.length);
  for (let t = 0; t < before.length / 3; t++) {
    const face = Array.from(after.slice(3 * t, 3 * t + 3));
    if (t >= receipt.firstTriangle && t < receipt.firstTriangle + 33) {
      expect(new Set(face).size).toBe(1);
    } else expect(face).toEqual(Array.from(before.slice(3 * t, 3 * t + 3)));
  }
  const wings = new Group();
  addBrandenburgGateWingsV374(wings);
  const geom = (
    wings.getObjectByName(
      "Brandenburg Gate measured guard rooms and open sandstone entablatures",
    ) as Mesh
  ).geometry;
  const roof = (
    wings.getObjectByName("Brandenburg Gate crossed standing-seam copper roofs") as Mesh
  ).geometry;
  const offsets = [0, 0];
  for (const [a, b, c, role] of receipt.faces) {
    const position = (role ? roof : geom).getAttribute("position");
    for (const v of [a, b, c]) {
      const point = new Vector3().fromBufferAttribute(position, offsets[role]++);
      toWorld(point.x, point.y, point.z).forEach((value, i) => {
        expect(value).toBeCloseTo(receipt.origin[i] + receipt.positionCm[v][i] / 100, 4);
      });
    }
  }
});

test("sandstone, patinated sheet metal and dark glazing keep independent material finishes", () => {
  const group = new Group();
  addBrandenburgGateWingsV374(group);
  for (const [name, expected] of [
    ["Brandenburg Gate measured guard rooms and open sandstone entablatures", "masonry"],
    ["Brandenburg Gate crossed standing-seam copper roofs", "patina"],
    ["Brandenburg Gate open hall fluted sandstone columns", "masonry"],
  ] as const) {
    const mesh = group.getObjectByName(name) as Mesh;
    expect(skylineArchitecturalFinish(mesh)).toBe(expected);
    if (expected === "masonry") expect(mesh.material.metalness).toBe(0);
  }
  expect(
    skylineArchitecturalFinish(
      group.getObjectByName("Brandenburg Gate guardroom portals and divided upper lights") as Mesh,
    ),
  ).toEqual({ glass: [0x414b49] });
});

test("the western cross-halls and eastern porticoes have four-column gables and independent axes", () => {
  for (const hall of gateHallsV374) {
    const columns = gateHallColumns(hall);
    expect(columns).toHaveLength(14);
    const gable = hall.east
      ? hall.x + hall.length / 2 - 0.61
      : hall.z + Math.sign(hall.z) * (hall.length / 2 - 0.61);
    const outer = columns.filter((point) => Math.abs(point[hall.east ? 0 : 1] - gable) < 1e-6);
    expect(outer).toHaveLength(4);
    const [endX, , endZ] = hallPoint(hall, 0, 0, -hall.width / 2 + 0.6);
    expect(
      columns.filter(([x, z]) => Math.abs(hall.east ? z - endZ : x - endX) < 1e-6),
    ).toHaveLength(hall.east ? 6 : 5);
  }
});

test("drawn pedestrians can pass beside either guardroom while the original masonry and lintels stay solid", () => {
  for (const [x, z, owner] of [
    [13.9, -28.87, "ya3usNuH"],
    [13.9, 22.25, "TEHsJHGG"],
    [-2, -25, "QDYNK7dL"],
    [-2, 25, "VpZW4Luf"],
  ] as const) {
    const spot = toWorld(x, 1.6, z);
    expect(visualModeWalkableInteriorAt("day", ...spot, owner)).toBe(true);
    expect(visualModeWalkableInteriorAt("minecraft", ...spot, owner)).toBe(false);
    expect(visualModeWalkableInteriorAt("day", ...toWorld(x, 9.5, z), owner)).toBe(false);
    expect(visualModeWalkableInteriorAt("day", ...spot, "K0000EPx")).toBe(false);
  }
  for (const hall of gateHallsV374) {
    const [x, z] = gateHallColumns(hall)[0];
    expect(
      visualModeWalkableInteriorAt("day", ...toWorld(x, 2, z), GATE_COLONNADE_PRISMS_V374[0]),
    ).toBe(false);
  }
  expect(visualModeWalkableInteriorAt("day", ...toWorld(15, 2, 26.5), "K0000APP")).toBe(false);
});

test("stone substrates cannot pull over the copper in either slope or tier", () => {
  const source = scene.architectural_signatures.find(
    (sig) => sig.id === "brandenburger-tor-model",
  ) as BrandenburgGateModelSignature;
  const gate = createArchitecturalSignature(source)!;
  gate.updateMatrixWorld(true);
  const roof = gate.getObjectByName("Brandenburg Gate crossed standing-seam copper roofs") as Mesh;
  for (const x of [-2, 2])
    for (const z of [-15, -9, -4, 4, 9, 15]) {
      const [wx, , wz] = toWorld(x, 0, z);
      const ray = new Raycaster(new Vector3(wx, 40, wz), new Vector3(0, -1, 0));
      const surfaces = ray.intersectObject(gate, true).filter((hit) => hit.object instanceof Mesh);
      const copper = surfaces.find((hit) => hit.object === roof)!;
      expect(copper.face!.normal.y).toBeGreaterThan(0.9);
      const substrate = surfaces.find(
        (hit) => hit.object !== roof && hit.point.y < copper.point.y - 0.001,
      )!;
      expect(copper.point.y - substrate.point.y).toBeGreaterThan(0.04);
      expect(((substrate.object as Mesh).material as MeshStandardMaterial).polygonOffset).toBe(
        false,
      );
    }
});

test("each photographed colonnade shoe stands on the same DGM and stone finish as the forecourt", () => {
  const sample = districtStreetTerrainSampler(ground);
  for (const hall of gateHallsV374) {
    for (const [x, z] of gateHallColumns(hall)) {
      const [wx, , wz] = toWorld(x, 0, z);
      expect(gatePavementTopV374(x, z) + receipt.anchor[1]).toBeCloseTo(sample(wx, wz) + 0.32, 6);
    }
  }
});

test("both guardhouse floors and all five passages have stone through the old grass openings", () => {
  const mesh = createGateForecourtsV374(districtStreetTerrainSampler(ground));
  const sites = [
    [411.111, 311.004],
    [409.541, 299.757],
    [409.307, 293.338],
  ];
  // Both sides of the five openings plus the measured wedges at the four
  // dividers, both open transverse halls, and their eastern side passages.
  for (const x of [-7.8, -4.5, 0, 4.5, 7.5])
    for (const z of [-12, -8.5, -5.5, -3, 0, 4.5, 6.5, 10, 12.4]) {
      const [wx, , wz] = toWorld(x, 0, z);
      sites.push([wx, wz]);
    }
  for (const [x, z] of [
    [-2, -25],
    [-2, 25],
    [13.9, -28.87],
    [13.9, 22.25],
  ]) {
    const [wx, , wz] = toWorld(x, 0, z);
    sites.push([wx, wz]);
  }
  for (const [x, z] of sites) {
    const hit = new Raycaster(new Vector3(x, 9, z), new Vector3(0, -1, 0)).intersectObject(mesh)[0];
    expect(hit).toBeDefined();
    expect(hit.point.y).toBeGreaterThan(5.02);
    const color = new Color().fromBufferAttribute(mesh.geometry.getAttribute("color"), hit.face!.a);
    expect(Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b)).toBeLessThan(
      0.085,
    );
  }
});

test("the new pavement wins all three actual oblique green pixels above their retained grass slabs", () => {
  const camera = new Vector3(270, 172, 185);
  const slabs = createGroundSlabs(ground, "Drawn ground slabs", ISO_GROUND_SHADES, {
    skipClasses: ["asphalt"],
    skipBridge: true,
    skipWater: true,
    parkRelief: "drawn",
    skipAtWorld: (x, z) => pointInBrandenburgApproach(x, z, ground.cell_m / Math.SQRT2),
  });
  const stone = createGateForecourtsV374(districtStreetTerrainSampler(ground));
  for (const [x, z] of [
    [411.111, 311.004],
    [409.541, 299.757],
    [409.307, 293.338],
  ]) {
    const direction = new Vector3(x, 5, z).sub(camera).normalize();
    const ray = new Raycaster(camera, direction, 0, 500);
    const before = ray.intersectObject(slabs)[0],
      after = ray.intersectObject(stone)[0];
    expect(before.point.y).toBeCloseTo(5, 4);
    expect(after.distance).toBeLessThan(before.distance);
    expect(after.point.y).toBeGreaterThan(5.2);
  }
  slabs.dispose();
  slabs.geometry.dispose();
  stone.geometry.dispose();
});
