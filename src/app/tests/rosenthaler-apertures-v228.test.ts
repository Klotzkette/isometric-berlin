import { describe, expect, test } from "bun:test";
import ts from "typescript";
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial } from "three";
import { createAltMitteSidewalksV226 } from "../src/AltMitteSidewalksV226";
import { cutRosenthalerGroundSlabsV228, cutRosenthalerPresentationV228, cutRosenthalerSurfaceV228, rosenthalerGroundComplementV228 } from "../src/RosenthalerSurfaceAperturesV228";
import { ROSENTHALER_STAIRS_V228, ROSENTHALER_V228_OPENINGS, rosenthalerV228FloorAt, rosenthalerV228SolidAt } from "../src/rosenthalerV228Profile";
import { compilePedestrianObstacles, createPedestrianState, stepPedestrian, type PedestrianEnvironment } from "../src/pedestrianNavigation";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";
import { indexGeometryExactly } from "../src/exactGeometryIndex";
import { freezeStaticSceneTransforms } from "../src/staticSceneTransforms";
import { deserializeTransferredObject3D, serializeObject3DForTransfer } from "../src/transferableObject3D";

type Point = [number, number];
function area(ring: number[][]): number {
  const [ox, oz] = ring[0];
  return Math.abs(ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return sum + (a[0] - ox) * (b[1] - oz) - (b[0] - ox) * (a[1] - oz);
  }, 0)) / 2;
}
function intersectsCell(ring: number[][], x: number, z: number): boolean {
  // Independent convex overlap reference, using both polygons' edge normals.
  const box = [[x, z], [x + .25, z], [x + .25, z + .25], [x, z + .25]];
  for (const polygon of [ring, box]) for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], nx = a[1] - b[1], nz = b[0] - a[0];
    const one = ring.map(p => p[0] * nx + p[1] * nz), two = box.map(p => p[0] * nx + p[1] * nz);
    if (Math.max(...one) <= Math.min(...two) + 1e-8 || Math.max(...two) <= Math.min(...one) + 1e-8) return false;
  }
  return true;
}
const openings = ROSENTHALER_V228_OPENINGS;
const rings = openings.map(o => o.ring);
const all = rings.flat();
const bounds = {
  x0: Math.floor(Math.min(...all.map(p => p[0]))) - 2,
  x1: Math.ceil(Math.max(...all.map(p => p[0]))) + 2,
  z0: Math.floor(Math.min(...all.map(p => p[1]))) - 2,
  z1: Math.ceil(Math.max(...all.map(p => p[1]))) + 2,
};
function nativeCells(): Set<string> {
  const cells = new Set<string>();
  for (const ring of rings) {
    const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
    for (let ix = Math.floor(Math.min(...xs) * 4); ix < Math.ceil(Math.max(...xs) * 4); ix++) {
      for (let iz = Math.floor(Math.min(...zs) * 4); iz < Math.ceil(Math.max(...zs) * 4); iz++) {
        if (intersectsCell(ring, ix / 4, iz / 4)) cells.add(`${ix}:${iz}`);
      }
    }
  }
  return cells;
}
function makeSurface(indexed = true): BufferGeometry {
  const { x0, x1, z0, z1 } = bounds;
  const vertices: Point[] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [0, 0], [4, 0], [0, 4]];
  const order = indexed ? vertices.map((_, i) => i) : [0, 2, 1, 0, 3, 2, 4, 6, 5];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float64Array(order.flatMap(i => {
    const [x, z] = vertices[i]; return [x, 2 + x / 100 - z / 200, z];
  })), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float64Array(order.flatMap(i => {
    const [x, z] = vertices[i]; return [x / 5000, -z / 5000, (x - z) / 10000];
  })), 3));
  geometry.setAttribute("sourceScalar", new BufferAttribute(new Float64Array(order.map(i => 3 * vertices[i][0] + 2 * vertices[i][1])), 1));
  if (indexed) geometry.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5]);
  return geometry;
}
function triangleArea(geometry: BufferGeometry, onlyY?: number): number {
  const p = geometry.getAttribute("position"), index = geometry.index;
  let total = 0;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
    if (onlyY !== undefined && ids.some(j => Math.abs(p.getY(j) - onlyY) > 1e-6)) continue;
    total += area(ids.map(j => [p.getX(j), p.getZ(j)]));
  }
  return total;
}

describe("Rosenthaler four precise surface apertures v228", () => {
  test("drawn clipping removes only four mapped areas and interpolates every old attribute", () => {
    for (const indexed of [false, true]) {
      const source = makeSurface(indexed), before = source.clone(), result = cutRosenthalerSurfaceV228(source);
      expect(result).not.toBe(source);
      const count = source.getAttribute("position").count;
      for (const [name, attribute] of Object.entries(source.attributes)) {
        expect(attribute.array).toEqual(before.getAttribute(name).array);
        expect(result.getAttribute(name).array.slice(0, attribute.array.length)).toEqual(attribute.array);
      }
      expect(source.index?.array).toEqual(before.index?.array);
      expect(Array.from(result.index!.array.slice(-3))).toEqual(indexed ? [4, 6, 5] : [6, 7, 8]);
      expect(triangleArea(source) - triangleArea(result)).toBeCloseTo(rings.reduce((sum, ring) => sum + area(ring), 0), 6);
      const p = result.getAttribute("position"), color = result.getAttribute("color"), scalar = result.getAttribute("sourceScalar");
      for (let i = count; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        expect(p.getY(i)).toBeCloseTo(2 + x / 100 - z / 200, 9);
        [x / 5000, -z / 5000, (x - z) / 10000].forEach((v, j) => expect(color.array[i * 3 + j]).toBeCloseTo(v, 10));
        expect(scalar.getX(i)).toBeCloseTo(3 * x + 2 * z, 8);
      }
      const remote = new BoxGeometry(2, 2, 2);
      expect(cutRosenthalerSurfaceV228(remote)).toBe(remote);
      source.dispose(); before.dispose(); result.dispose(); remote.dispose();
    }
  });

  test("native complements conserve the independent quarter-metre cell union with only orthogonal edges", () => {
    const { x0, x1, z0, z1 } = bounds;
    const result = rosenthalerGroundComplementV228([[x0, 4, z0], [x1, 4, z0], [x1, 4, z1], [x0, 4, z1]], true)!;
    expect(result).not.toBeNull();
    let preservedArea = 0;
    for (const polygon of result) {
      preservedArea += area(polygon.map(p => [p[0], p[2]]));
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        expect(Math.abs(a[0] - b[0]) < 1e-8 || Math.abs(a[2] - b[2]) < 1e-8).toBe(true);
        expect(a[0] * 4).toBeCloseTo(Math.round(a[0] * 4), 6);
        expect(a[2] * 4).toBeCloseTo(Math.round(a[2] * 4), 6);
      }
    }
    expect((x1 - x0) * (z1 - z0) - preservedArea).toBeCloseTo(nativeCells().size / 16, 6);
  });

  test("slab replacement keeps unrelated matrices and colors byte-exact; replacement area is conserved", () => {
    for (const native of [false, true]) {
      const { x0, x1, z0, z1 } = bounds, material = new MeshBasicMaterial({ vertexColors: true });
      const slabs = new InstancedMesh(new BoxGeometry(1, 1, 1), material, 3), m = new Matrix4();
      for (const [i, row] of [[(x0 + x1) / 2, 2, (z0 + z1) / 2, x1 - x0, 4, z1 - z0], [0, 1, 0, 5, 2, 6], [4000, 5, -4000, 7, 10, 8]].entries()) {
        m.makeScale(row[3], row[4], row[5]).setPosition(row[0], row[1], row[2]); slabs.setMatrixAt(i, m);
        slabs.setColorAt(i, new Color().setRGB(.2 + i / 10, .3, .4));
      }
      const originalMatrices = slabs.instanceMatrix.array.slice(), originalColors = slabs.instanceColor!.array.slice();
      cutRosenthalerGroundSlabsV228(slabs, native);
      expect(slabs.instanceMatrix.array.slice(16)).toEqual(originalMatrices.slice(16));
      expect(slabs.instanceColor!.array).toEqual(originalColors);
      expect(slabs.children).toHaveLength(1);
      const replacement = slabs.children[0] as Mesh;
      let keptArea = 0;
      if (native) {
        expect(replacement).toBeInstanceOf(InstancedMesh);
        const batch = replacement as InstancedMesh;
        for (let i = 0; i < batch.count; i++) {
          batch.getMatrixAt(i, m);
          for (const k of [1, 2, 4, 6, 8, 9]) expect(m.elements[k]).toBe(0);
          keptArea += m.elements[0] * m.elements[10];
          expect(Array.from(batch.instanceColor!.array.slice(i * 3, i * 3 + 3))).toEqual(Array.from(originalColors.slice(0, 3)));
        }
      } else {
        keptArea = triangleArea(replacement.geometry, 4);
        const colors = replacement.geometry.getAttribute("color");
        for (let i = 0; i < colors.count; i++) expect(Array.from(colors.array.slice(i * 3, i * 3 + 3))).toEqual(Array.from(originalColors.slice(0, 3)));
      }
      const removedArea = native ? nativeCells().size / 16 : rings.reduce((sum, ring) => sum + area(ring), 0);
      expect((x1 - x0) * (z1 - z0) - keptArea).toBeCloseTo(removedArea, native ? 5 : 2);
      cutRosenthalerGroundSlabsV228(slabs, native); expect(slabs.children).toHaveLength(1);
      disposeStaticAudit(slabs);
    }
  });

  test("production owner selector leaves building and unrelated park geometry alone", () => {
    const root = new Group(), smooth = new Group(); smooth.name = "smooth OSM water and parkland";
    const paving = new Mesh(makeSurface(), new MeshBasicMaterial()); paving.name = "smooth paved paths";
    const park = new Mesh(makeSurface(), new MeshBasicMaterial()); park.name = "smooth parks";
    const building = new Mesh(makeSurface(), new MeshBasicMaterial()); building.name = "existing building";
    smooth.add(paving, park); root.add(smooth, building);
    const oldPaving = paving.geometry, oldPark = park.geometry, oldBuilding = building.geometry;
    cutRosenthalerPresentationV228(root);
    expect(paving.geometry).not.toBe(oldPaving); expect(park.geometry).toBe(oldPark); expect(building.geometry).toBe(oldBuilding);
    disposeStaticAudit(root);
  });

  test("actual late pretriangulated road owner is cut before attachment, including standalone roots", async () => {
    // Execute the real constructor without loading its bundler-only ?url asset.
    const text = await Bun.file(new URL("../src/restoredRoadSurfaces.ts", import.meta.url)).text();
    const parsed = ts.createSourceFile("restoredRoadSurfaces.ts", text, ts.ScriptTarget.Latest, true);
    const functions = parsed.statements.filter(ts.isFunctionDeclaration).filter(node => ["bytes", "createRestoredRoadBatch"].includes(node.name?.text ?? ""));
    const compiled = ts.transpileModule(functions.map(node => node.getText(parsed)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const bindings = { exports: {}, BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, indexGeometryExactly, freezeStaticSceneTransforms };
    const create = new Function(...Object.keys(bindings), `${compiled}\nreturn createRestoredRoadBatch;`)(...Object.values(bindings)) as typeof import("../src/restoredRoadSurfaces").createRestoredRoadBatch;
    const encode = (array: Float32Array | Uint32Array) => Buffer.from(array.buffer).toString("base64");
    for (const kind of ["asphalt", "paving"] as const) {
      const {x0, x1, z0, z1} = bounds;
      const original = create({ id: `restored-${kind}-4--3`, kind,
        xz: encode(new Float32Array([x0,z0,x1,z0,x1,z1,x0,z1,0,0,4,0,0,4])),
        indices: encode(new Uint32Array([0,2,1,0,3,2,4,6,5])) }, () => 5.2);
      const packet = serializeObject3DForTransfer(original);
      const root = deserializeTransferredObject3D(structuredClone(packet.object)) as Group;
      expect(root.userData.exactSourceRoad).toBe(true);
      const mesh = root.children[0] as Mesh, before = mesh.geometry, oldPositions = before.getAttribute("position").array.slice();
      const oldArea = triangleArea(before);
      cutRosenthalerPresentationV228(root);
      expect(mesh.geometry).not.toBe(before);
      expect(mesh.geometry.userData.rosenthalerAperturesV228).toBeGreaterThan(0);
      expect(mesh.geometry.getAttribute("position").array.slice(0, oldPositions.length)).toEqual(oldPositions);
      expect(Array.from(mesh.geometry.index!.array.slice(-3))).toEqual([4,6,5]);
      // The production packet is float32 at x≈2 km; its sub-millimetre
      // coordinate rounding contributes at most 0.01 m² across four mouths.
      expect(Math.abs(oldArea - triangleArea(mesh.geometry) - rings.reduce((sum, ring) => sum + area(ring), 0))).toBeLessThan(.01);
      disposeStaticAudit(original); disposeStaticAudit(root);
    }
  });

  test("retained exact road packets contain no Rosenthaler mouths, so no cut metadata is required", async () => {
    // Real retained source, independently bounded: these central packets stop
    // before Rosenthaler Platz. A browser must test actual ray hits, not infer
    // filled mouths from the absence of a late packet's cut metadata.
    const text = await Bun.file(new URL("../src/data/restoredRoadSurfaces.ndjson.txt", import.meta.url)).text();
    let inspected = 0, intersectingBounds = 0;
    for (const line of text.trim().split("\n")) {
      const batch = JSON.parse(line);
      if (!["paving", "asphalt"].includes(batch.kind)) continue;
      const bytes = Buffer.from(batch.xz, "base64"), xz = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < xz.length; i += 2) {
        x0 = Math.min(x0, xz[i]); x1 = Math.max(x1, xz[i]); z0 = Math.min(z0, xz[i + 1]); z1 = Math.max(z1, xz[i + 1]);
      }
      inspected++;
      if (x1 >= bounds.x0 && x0 <= bounds.x1 && z1 >= bounds.z0 && z0 <= bounds.z1) intersectingBounds++;
    }
    expect(inspected).toBeGreaterThan(100);
    expect(intersectingBounds).toBe(0);
  });

  test("late v226 paving opt-in preserves every original attribute and remote index outside the mouth", () => {
    for (const native of [false, true]) {
      const plain = createAltMitteSidewalksV226(native), opened = createAltMitteSidewalksV226(native, true);
      let affected = 0;
      for (let i = 0; i < plain.children.length; i++) {
        const a = (plain.children[i] as Mesh).geometry, b = (opened.children[i] as Mesh).geometry;
        for (const [name, attribute] of Object.entries(a.attributes)) expect(b.getAttribute(name).array.slice(0, attribute.array.length)).toEqual(attribute.array);
        const old = a.index!, next = b.index!;
        if (old.count === next.count && old.array.every((v, i) => v === next.array[i])) continue;
        affected++;
        const position = a.getAttribute("position"), retained = new Set<string>();
        for (let j = 0; j < next.count; j += 3) retained.add(Array.from(next.array.slice(j, j + 3)).join(":"));
        for (let j = 0; j < old.count; j += 3) {
          const ids = Array.from(old.array.slice(j, j + 3));
          const p = ids.map(k => [position.getX(k), position.getY(k), position.getZ(k)]);
          if (rosenthalerGroundComplementV228(p, native) === null) expect(retained.has(ids.join(":"))).toBe(true);
        }
      }
      // This retained v226 packet fills missing sidewalks only. All four
      // existing station mouths fall in older paving, so the opt-in is a
      // deliberate no-op for these current source rows in both branches.
      expect(affected).toBe(0);
      disposeStaticAudit(plain); disposeStaticAudit(opened);
    }
  });

  test("real walking physics descends all four stairs, stays below street level and walks out again", () => {
    const idle = { forward: 0, strafe: 0, turn: 0, look: 0, sprint: false };
    for (const native of [false, true]) {
      const obstacles = compilePedestrianObstacles(prisms, () => native ? "minecraft" : "day");
      for (const stair of ROSENTHALER_STAIRS_V228) {
      const base = native ? stair.nativeSurfaceY : stair.surfaceY;
      const environment: PedestrianEnvironment = {
        bounds: { minX: bounds.x0 - 10, maxX: bounds.x1 + 10, minZ: bounds.z0 - 10, maxZ: bounds.z1 + 10 }, water: [],
        groundAt: () => base, obstacles,
        interiorGroundAt: (x, z) => rosenthalerV228FloorAt(x, z, native),
        interiorSolidAt: (x, y, z, radius) => rosenthalerV228SolidAt(x, y, z, radius, native),
      };
      const u = (x: number, z: number) => (x - stair.top[0]) * stair.ux + (z - stair.top[1]) * stair.uz;
      let state = createPedestrianState(environment, { x: stair.top[0] - stair.ux * .4, z: stair.top[1] - stair.uz * .4, yaw: Math.atan2(stair.ux, -stair.uz), groundYHint: base });
      let steps = 0;
      while (u(state.x, state.z) < stair.length - .55 && steps++ < 400) {
        const move = stepPedestrian(state, { ...idle, forward: 1 }, 1 / 60, environment); expect(move.respawned).toBe(false); state = move.state;
      }
      expect(steps).toBeLessThan(400); expect(state.groundY).toBeCloseTo(base - stair.descent, 6);
      for (let i = 0; i < 60; i++) state = stepPedestrian(state, idle, 1 / 60, environment).state;
      expect(state.groundY).toBeCloseTo(base - stair.descent, 6); expect(state.grounded).toBe(true);
      steps = 0;
      while (u(state.x, state.z) > -.3 && steps++ < 400) {
        const move = stepPedestrian(state, { ...idle, forward: -1 }, 1 / 60, environment); expect(move.respawned).toBe(false); state = move.state;
      }
      expect(steps).toBeLessThan(400); expect(state.groundY).toBeCloseTo(base, 6); expect(u(state.x, state.z)).toBeLessThan(-.3);
      }
    }
  });
});
