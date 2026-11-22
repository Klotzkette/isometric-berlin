import { expect, test } from "bun:test";
import { Group, Mesh, Vector3 } from "three";
import { createAltMitteCoreV169FromSource } from "../src/AltMitteCoreV169";
import {
  gateHallColumns,
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
