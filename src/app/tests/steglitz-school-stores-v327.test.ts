import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Group, InstancedMesh, Matrix4, Mesh } from "three";
import data from "../src/data/steglitzSchoolStoresV327.json";
import {
  createSteglitzSchoolStoresV327,
  steglitzLidlV327GroundAt,
  steglitzLidlV327SolidAt,
} from "../src/SteglitzSchoolStoresV327";

test("both real model families fit the late geometry budget and Native members stay cardinal", () => {
  const budgets: number[] = [];
  for (const native of [false, true]) {
    const model = createSteglitzSchoolStoresV327(native)!;
    expect(model).toBeInstanceOf(Group);
    expect(model.children).toHaveLength(native ? 1 : 2);
    let bytes = 0;
    const matrix = new Matrix4();
    model.traverse(member => {
      if (!(member instanceof Mesh)) return;
      for (const attribute of Object.values(member.geometry.attributes)) bytes += attribute.array.byteLength;
      bytes += member.geometry.index?.array.byteLength ?? 0;
      if (member instanceof InstancedMesh) {
        bytes += member.instanceMatrix.array.byteLength + (member.instanceColor?.array.byteLength ?? 0);
        if (native) for (let i = 0; i < member.count; i++) {
          member.getMatrixAt(i, matrix);
          expect([1, 2, 4, 6, 8, 9].every(k => matrix.elements[k] === 0)).toBe(true);
        }
      }
      member.geometry.dispose();
    });
    expect(bytes).toBeLessThan(130 * 1024);
    budgets.push(bytes);
  }
  expect(budgets).toEqual([52576, 109784]);
});

test("Lidl navigation follows the active private model, open parking and the reached roof", () => {
  const x = -2960, z = 6640;
  for (const native of [false, true]) {
    const model = createSteglitzSchoolStoresV327(native)!;
    expect(steglitzLidlV327SolidAt(model, x, 9, z)).toBe(false);
    const scene = new Group().add(model);
    scene.updateMatrixWorld(true);
    expect(steglitzLidlV327SolidAt(model, x, 9, z)).toBe(true);
    expect(steglitzLidlV327SolidAt(model, x, 4, z)).toBe(false);
    expect(steglitzLidlV327SolidAt(model, -3150, 9, 6650)).toBe(false);
    expect(steglitzLidlV327GroundAt(model, x, z)).toBeNull();
    expect(steglitzLidlV327GroundAt(model, x, z, 3)).toBeNull();
    expect(steglitzLidlV327GroundAt(model, x, z, data.roofY - .66)).toBeNull();
    expect(steglitzLidlV327GroundAt(model, x, z, data.roofY - .64)).toBe(data.roofY);
    expect(steglitzLidlV327GroundAt(model.clone(true), x, z, data.roofY)).toBeNull();
    scene.visible = false;
    expect(steglitzLidlV327GroundAt(model, x, z, data.roofY)).toBeNull();
    scene.visible = true;
    (model.children[0] as Mesh).geometry.dispose();
    expect(steglitzLidlV327SolidAt(model, x, 9, z)).toBe(false);
    expect(steglitzLidlV327GroundAt(model, x, z, data.roofY)).toBeNull();
  }
});

test("altered source never admits visual or walking additions", () => {
  const original = data.roofY;
  try {
    data.roofY += .1;
    expect(createSteglitzSchoolStoresV327(false)).toBeNull();
    expect(createSteglitzSchoolStoresV327(true)).toBeNull();
  } finally {
    data.roofY = original;
  }
});

test("all delivered ground and Aldi predecessors retain their complete bytes", () => {
  const evidence = JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/steglitz-school-stores-v327-evidence.json", import.meta.url), "utf8"));
  expect(evidence.official.mensaWallSheets).toHaveLength(30);
  expect(evidence.aldiRetainedOwners).toEqual(["DEBE06AL2xD0000Z", "DEBE06AL2xD0001P"]);
  const hashes = Object.entries(evidence.retainedPacketsSha256);
  expect(hashes).toHaveLength(8);
  for (const [file, sha] of hashes) {
    const bytes = readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${file}`, import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha);
  }
});
