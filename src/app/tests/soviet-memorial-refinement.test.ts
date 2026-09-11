import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import {
  createIsometricCity,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import {
  compilePedestrianObstacles,
  pedestrianPointIsBlocked,
} from "../src/pedestrianNavigation";
import {
  createSchwellenraumMemorialProtectionIndex,
  schwellenraumProtectedMemorialAt,
} from "../src/schwellenraumMemorialProtection";
import street from "../public/mesh/regierungsviertel/street-details.json";
import { type StreetDetailsPayload } from "../src/TrafficSignals";
import scene from "../public/mesh/regierungsviertel/scene.json";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import {
  createMemorialLandmarks,
  type MemorialLandmark,
} from "../src/MemorialLandmarks";
import {
  createMinecraftSovietMemorial,
  setSovietMemorialSmoothVisibility,
} from "../src/MinecraftSovietMemorial";
import {
  SOVIET_MEMORIAL_SOURCE as source,
  SOVIET_MEMORIAL_PRISM_IDS,
  SOVIET_MEMORIAL_REPLACEMENT_RINGS,
  isSovietMemorialReplacementPoint,
  sovietMemorialLocalXZ,
  sovietMemorialWorldXZ,
  sovietMemorialSolidAt,
  sovietMemorialGroundAt,
  sovietMemorialWalkableAt,
} from "../src/SovietMemorialSource";

const catalog = scene.landmarks.find(
  (l) => l.name === source.name,
)! as MemorialLandmark;
const drawn = () => createMemorialLandmarks([catalog]);
const localRay = (x: number, y: number, fromZ: number, toZ: number) => {
  const [ax, az] = sovietMemorialWorldXZ(x, fromZ),
    [bx, bz] = sovietMemorialWorldXZ(x, toZ);
  return new Raycaster(
    new Vector3(ax, y, az),
    new Vector3(bx - ax, 0, bz - az).normalize(),
    0,
    Math.hypot(bx - ax, bz - az),
  );
};

describe("Soviet memorial source-resolved site and vehicles", () => {
  test("Minecraft tubes face the street and the rotated plinths have matching collision", () => {
    for (const profile of ["full", "mobile"] as const) {
      const root = createMinecraftSovietMemorial(profile);
      root.updateMatrixWorld(true);
      const batch = root.children[0] as InstancedMesh;
      const matrix = new Matrix4(), size = new Vector3(), point = new Vector3();
      let barrels = 0;
      for (let i = 0; i < batch.count; i++) {
        batch.getMatrixAt(i, matrix);
        size.setFromMatrixScale(matrix);
        if (Math.abs(size.x - 0.16) > 1e-5 || Math.abs(size.z - 2.75) > 1e-5) continue;
        barrels++;
        point.setFromMatrixPosition(matrix.multiplyMatrices(batch.matrixWorld, matrix));
        const tank = source.tanks.reduce((nearest, candidate) =>
          Math.hypot(point.x-candidate.worldXZ[0], point.z-candidate.worldXZ[1]) <
          Math.hypot(point.x-nearest.worldXZ[0], point.z-nearest.worldXZ[1]) ? candidate : nearest);
        const [tx, tz] = sovietMemorialLocalXZ(...tank.worldXZ);
        const [bx, bz] = sovietMemorialLocalXZ(point.x, point.z);
        expect(bx).toBeCloseTo(tx, 4);
        expect(bz - tz).toBeCloseTo(2.76, 4);
      }
      expect(barrels).toBe(2);
    }
    for (const tank of source.tanks) {
      const [tx, tz] = sovietMemorialLocalXZ(...tank.worldXZ);
      for (const side of [-1, 1]) {
        const [frontX, frontZ] = sovietMemorialWorldXZ(tx, tz + side * 3.9);
        const [sideX, sideZ] = sovietMemorialWorldXZ(tx + side * 3, tz);
        expect(sovietMemorialSolidAt(frontX, source.groundY + 0.6, frontZ)).toBeTrue();
        expect(sovietMemorialSolidAt(sideX, source.groundY + 0.6, sideZ)).toBeFalse();
      }
    }
  });
  test("places the soldier and four vehicles at their own exact committed OSM coordinates", () => {
    const root = drawn();
    root.updateMatrixWorld(true);
    for (const tank of source.tanks) {
      const vehicle = root.getObjectByName(
        `Soviet memorial T-34 ${tank.side} vehicle`,
      )!;
      const position = vehicle.getWorldPosition(new Vector3());
      expect(position.x).toBeCloseTo(tank.worldXZ[0], 7);
      expect(position.z).toBeCloseTo(tank.worldXZ[1], 7);
      expect(
        root.getObjectByName(
          `Soviet memorial T-34 ${tank.side} turret number ${tank.number} left`,
        )?.userData.lettering,
      ).toBe(tank.number);
      const point = root
        .getObjectByName(`Soviet memorial T-34 ${tank.side} 76 mm barrel`)!
        .getWorldPosition(new Vector3());
      const streetAxis = new Vector3(source.tanks[1].worldXZ[0] - source.tanks[0].worldXZ[0], 0,
        source.tanks[1].worldXZ[1] - source.tanks[0].worldXZ[1]).normalize();
      const towardsStreet = new Vector3(-streetAxis.z, 0, streetAxis.x);
      const barrelDirection = point.clone().sub(position).setY(0).normalize();
      expect(barrelDirection.dot(towardsStreet)).toBeGreaterThan(0.9999);
      expect(Math.abs(barrelDirection.dot(streetAxis))).toBeLessThan(0.0001);
    }
    for (const gun of source.guns) {
      const point = root
        .getObjectByName(`Soviet memorial ML-20 howitzer ${gun.side} carriage`)!
        .getWorldPosition(new Vector3());
      expect(point.x).toBeCloseTo(gun.worldXZ[0], 7);
      expect(point.z).toBeCloseTo(gun.worldXZ[1], 7);
      const muzzle = root
        .getObjectByName(
          `Soviet memorial ML-20 howitzer ${gun.side} muzzle brake`,
        )!
        .getWorldPosition(new Vector3());
      expect(muzzle.z - point.z).toBeGreaterThan(5);
    }
    const left = root
      .getObjectByName("Soviet memorial soldier left boot")!
      .getWorldPosition(new Vector3());
    const right = root
      .getObjectByName("Soviet memorial soldier right boot")!
      .getWorldPosition(new Vector3());
    expect((left.x + right.x) / 2).toBeCloseTo(source.soldierWorldM[0], 7);
    expect((left.z + right.z) / 2).toBeCloseTo(source.soldierWorldM[2], 7);
    expect(
      Math.hypot(catalog.world[0] - left.x, catalog.world[2] - left.z),
    ).toBeGreaterThan(8);
  });
  test("removes the four ghost bodies and roofs from production geometry and walking indexes", () => {
    const payload = prisms as unknown as PrismPayload;
    const buildings = payload.buildings.filter((b) =>
      SOVIET_MEMORIAL_PRISM_IDS.has(b.id),
    );
    expect(
      createIsometricCity(payload, null, null, null, {
        buildings,
        includeContext: false,
      }).children,
    ).toHaveLength(0);
    const index = compilePedestrianObstacles({ buildings });
    expect(index.buildingCount).toBe(0);
    const [x, z] = sovietMemorialWorldXZ(9, 0);
    expect(
      pedestrianPointIsBlocked(x, z, 7, index, {
        interiorSolidAt: sovietMemorialSolidAt,
        walkableInteriorAt: sovietMemorialWalkableAt,
      }),
    ).toBeFalse();
    // The override cannot open a unrelated building even when its XY overlaps.
    expect(sovietMemorialWalkableAt(x, 7, z, "unrelated-building")).toBeFalse();
  });
  test("supports feet at the rendered stair and terrace tops in smooth and block geometry", () => {
    const points = [
      [0, 49],
      [0, 35.3],
      [0, 33.1],
      [0, 30],
      [0, 28],
      [0, 21],
      [9, 5],
      [9, 3],
      [9, 0],
    ];
    for (const root of [drawn(), createMinecraftSovietMemorial("mobile")]) {
      root.updateMatrixWorld(true);
      const meshes: Mesh[] = [];
      root.traverse((o) => {
        if (o instanceof Mesh) meshes.push(o);
      });
      for (const [lx, lz] of points) {
        const [x, z] = sovietMemorialWorldXZ(lx, lz),
          floor = sovietMemorialGroundAt(x, z)!;
        expect(floor).not.toBeNull();
        const hit = new Raycaster(
          new Vector3(x, floor + 0.3, z),
          new Vector3(0, -1, 0),
          0,
          0.5,
        ).intersectObjects(meshes, false)[0];
        expect(hit).toBeDefined();
        // Paving joint strokes stand 19mm proud of their structural support.
        expect(Math.abs(hit.point.y - floor)).toBeLessThanOrEqual(0.021);
      }
    }
    expect(sovietMemorialGroundAt(20, 340)).toBeNull();
    const entries = (street as unknown as StreetDetailsPayload).monuments!;
    const index = createSchwellenraumMemorialProtectionIndex(entries);
    for (const item of [...source.tanks, ...source.guns])
      expect(
        schwellenraumProtectedMemorialAt(
          index,
          item.worldXZ[0],
          7,
          item.worldXZ[1],
        ),
      ).toBeTrue();
    expect(schwellenraumProtectedMemorialAt(index, 30, 7, 340)).toBeFalse();
  });
  test("retains every replaced LoD2 footprint verbatim and confines its source override", () => {
    expect(SOVIET_MEMORIAL_PRISM_IDS.size).toBe(4);
    for (const id of SOVIET_MEMORIAL_PRISM_IDS) {
      const sourcePrism = prisms.buildings.find((b) => b.id === id)!;
      expect(sourcePrism).toBeDefined();
      expect(SOVIET_MEMORIAL_REPLACEMENT_RINGS[id]).toEqual(
        sourcePrism.ring.map(([x, z]) => [x / 10, z / 10]),
      );
    }
    expect(isSovietMemorialReplacementPoint(25, 260)).toBeTrue();
    expect(isSovietMemorialReplacementPoint(200, 300)).toBeFalse();
    expect(isSovietMemorialReplacementPoint(25, 330)).toBeFalse();
  });
  test("leaves actual open bays in both geometries while the represented piers remain solid", () => {
    for (const root of [
      drawn(),
      createMinecraftSovietMemorial("full"),
      createMinecraftSovietMemorial("mobile"),
    ]) {
      root.updateMatrixWorld(true);
      const meshes: Mesh[] = [];
      root.traverse((o) => {
        if (o instanceof Mesh) meshes.push(o);
      });
      for (const x of [-15, -8.7, 8.7, 15]) {
        expect(
          localRay(x, 9, 8, -8).intersectObjects(meshes, false),
        ).toHaveLength(0);
        const [wx, wz] = sovietMemorialWorldXZ(x, 0);
        expect(sovietMemorialSolidAt(wx, 9, wz, 0.1)).toBeFalse();
        expect(sovietMemorialWalkableAt(wx, 9, wz)).toBeTrue();
      }
      for (const [x, z] of source.piers) {
        expect(
          localRay(x, 9, z + 5, z - 5).intersectObjects(meshes, false).length,
        ).toBeGreaterThan(0);
        const [wx, wz] = sovietMemorialWorldXZ(x, z);
        expect(sovietMemorialSolidAt(wx, 9, wz)).toBeTrue();
      }
    }
  });
  test("keeps low lawns, two rear fountains, sloping armour and separate running gear", () => {
    const root = drawn();
    root.updateMatrixWorld(true);
    for (const side of ["west", "east"]) {
      const basin = root
        .getObjectByName(`Soviet memorial ${side} circular garden basin`)!
        .getWorldPosition(new Vector3());
      expect(sovietMemorialLocalXZ(basin.x, basin.z)[1]).toBeCloseTo(-19.5, 7);
      expect(
        new Box3().setFromObject(
          root.getObjectByName(`Soviet memorial ${side} front lawn`)!,
        ).max.y - source.groundY,
      ).toBeLessThan(0.25);
    }
    const west = source.tanks[0].worldXZ,
      east = source.tanks[1].worldXZ;
    expect(Math.hypot(east[0] - west[0], east[1] - west[1])).toBeCloseTo(
      78.0696,
      3,
    );
    for (const tank of source.tanks) {
      const hull = root.getObjectByName(
        `Soviet memorial T-34 ${tank.side} hull`,
      ) as Mesh;
      const pos = hull.geometry.getAttribute("position");
      const bottom: number[] = [],
        top: number[] = [];
      for (let i = 0; i < pos.count; i += 1)
        (pos.getY(i) > 0 ? top : bottom).push(Math.abs(pos.getX(i)));
      expect(Math.max(...top)).toBeLessThan(Math.max(...bottom) * 0.8);
      expect(
        (
          root.getObjectByName(
            `Soviet memorial T-34 ${tank.side} four raised sprocket and idler wheels`,
          ) as InstancedMesh
        ).count,
      ).toBe(4);
    }
  });
  test("uses one bounded block batch and reversibly swaps the Soviet smooth root in all five modes", () => {
    const full = createMinecraftSovietMemorial("full"),
      mobile = createMinecraftSovietMemorial("mobile");
    expect(full.children).toHaveLength(1);
    expect(mobile.children).toHaveLength(1);
    expect(full.userData.blockCount).toBe(693);
    expect(mobile.userData.blockCount).toBe(629);
    const matrix = new Matrix4();
    for (const root of [full, mobile]) {
      const batch = root.children[0] as InstancedMesh;
      expect(batch.geometry.type).toBe("BoxGeometry");
      expect(batch.geometry.getAttribute("position").count).toBe(24);
      expect(root.userData.referenceImagesBundled).toBeFalse();
      for (let i = 0; i < batch.count; i += 1) {
        batch.getMatrixAt(i, matrix);
        expect(matrix.determinant()).toBeGreaterThan(0);
      }
    }
    const root = drawn(),
      memorial = root.getObjectByName(source.name)!;
    for (const mode of [
      "day",
      "minecraft",
      "night",
      "minecraft",
      "snowstorm",
      "schwellenraum",
    ]) {
      setSovietMemorialSmoothVisibility(root, mode !== "minecraft");
      expect(memorial.visible).toBe(mode !== "minecraft");
    }
  });
});
