import { describe, expect, test } from "bun:test";
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import {
  createMinecraftParliamentArchitecture, createParliamentArchitecture,
  jakobKaiserEastUpperContains, jakobKaiserEastUpperDisplayPrism,
  jakobKaiserEastUpperMinecraftContains, parliamentFacadeAxes,
} from "../src/ParliamentArchitecture";
import {
  JAKOB_KAISER_EAST_UPPER_PROFILE, PARLIAMENT_ARCHITECTURE_IDS,
  PARLIAMENT_ARCHITECTURE_PROFILE,
} from "../src/parliamentArchitectureProfile";
import { createIsometricCity, type PrismPayload } from "../src/IsometricCityWorld";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import type { ParliamentVoxelPayload } from "../src/ParliamentArchitecture";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";

const prisms = prismJson as unknown as PrismPayload;
const voxels = voxelJson as unknown as ParliamentVoxelPayload;
const partPayload = { ...prisms, buildings: prisms.buildings.filter((b) => PARLIAMENT_ARCHITECTURE_IDS.has(b.id)) };
const sourceBefore = JSON.stringify(partPayload);

function ringArea(ring: readonly (readonly number[])[]): number {
  return Math.abs(ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2);
}

function finiteGeometry(root: Group): boolean {
  let finite = true;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const attr of Object.values(object.geometry.attributes))
      finite &&= Array.from(attr.array).every(Number.isFinite);
    if (object instanceof InstancedMesh) finite &&= Array.from(object.instanceMatrix.array).every(Number.isFinite);
  });
  return finite;
}

function bytes(root: Group): number {
  let count = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const attr of Object.values(object.geometry.attributes)) count += attr.array.byteLength;
    count += object.geometry.index?.array.byteLength ?? 0;
    if (object instanceof InstancedMesh) count += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
  });
  return count;
}

function sourceCubeSkin(): InstancedMesh {
  const columns: [number, number, number, number][] = [];
  for (const [zi, row] of voxels.building_rows!.entries()) {
    const z = (voxels.grid.min_z_idx + zi + 0.5) * voxels.cell_m;
    if (z < -190 || z > 200) continue;
    for (const [xi, count, y0, y1] of row) for (let i = 0; i < count; i++) {
      const x = (voxels.grid.min_x_idx + xi + i + 0.5) * voxels.cell_m;
      if (x >= 355 && x <= 615) columns.push([x, z, y0 / 10, y1 / 10]);
    }
  }
  const result = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), columns.length);
  const matrix = new Matrix4();
  columns.forEach(([x, z, y0, y1], i) => {
    matrix.makeScale(voxels.cell_m, y1 - y0, voxels.cell_m); matrix.setPosition(x, (y0 + y1) / 2, z);
    result.setMatrixAt(i, matrix);
  });
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

describe("source-bound parliamentary architecture", () => {
  test("uses delivered source edge endpoints and outward/courtyard normals", () => {
    const axes = parliamentFacadeAxes(partPayload);
    expect(axes.length).toBeGreaterThan(100);
    expect(axes.some((a) => a.courtyard && a.sourceId === "FAoRPGwK")).toBeTrue();
    for (const a of axes) {
      const part = partPayload.buildings.find((b) => b.id === a.sourceId)!;
      const rings = [part.ring, ...(part.holes ?? [])];
      for (const endpoint of [a.start, a.end]) expect(rings.some((ring) =>
        ring.some(([x, z]) => Math.abs(x / 10 - endpoint[0]) < 1e-8 && Math.abs(z / 10 - endpoint[1]) < 1e-8))).toBeTrue();
      expect(Math.hypot(...a.normal)).toBeCloseTo(1, 8);
      expect(a.topY).toBe((part.y0_dm + part.h_dm) / 10);
    }
  });

  test("records the verified low-source conflict and exact east-U intersection", () => {
    const p = JAKOB_KAISER_EAST_UPPER_PROFILE;
    const source = prisms.buildings.find((b) => b.id === p.sourcePrismId)!;
    expect(source.h_dm).toBe(43);
    expect(p.topY - p.sourceBaseY).toBe(22);
    expect(p.sourcePodiumHeightM).toBe(4.325);
    expect(ringArea(p.footprintWorld) - ringArea(p.courtyardWorld)).toBeCloseTo(2792.8107139188523, 6);
    expect(Math.min(...p.footprintWorld.map(([x]) => x))).toBe(535);
    expect(jakobKaiserEastUpperContains(585, 60)).toBeTrue();
    expect(jakobKaiserEastUpperContains(560, 65)).toBeFalse();
    expect(jakobKaiserEastUpperContains(560, 27)).toBeFalse();
    expect(jakobKaiserEastUpperContains(530, 60)).toBeFalse();
    const display = jakobKaiserEastUpperDisplayPrism();
    expect(display.y0_dm / 10).toBe(p.bottomY);
    expect((display.y0_dm + display.h_dm) / 10).toBeCloseTo(p.topY, 8);
    expect(display.holes).toHaveLength(1);
  });

  for (const minecraft of [false, true]) for (const mobileLike of [false, true]) {
    test(`${minecraft ? "Minecraft" : "drawn"} ${mobileLike ? "mobile" : "full"} is bounded and finite`, () => {
      const root = minecraft ? createMinecraftParliamentArchitecture(partPayload, { mobileLike, voxels })
        : createParliamentArchitecture(partPayload, { mobileLike });
      expect(finiteGeometry(root)).toBeTrue();
      expect(root.children).toHaveLength(minecraft ? 1 : 2);
      expect(bytes(root)).toBeLessThan(minecraft ? (mobileLike ? 530_000 : 680_000) : 1_380_000);
      expect(root.userData.detailCounts["library curtain glazing"]).toBeGreaterThan(60);
      expect(root.userData.detailCounts["cedar folding shade"]).toBeGreaterThan(300);
      expect(root.userData.detailCounts["JKH hall secondary transom"]).toBeGreaterThan(0);
      expect(root.userData.replacesLoD2).toBeFalse();
      expect(JSON.stringify(partPayload)).toBe(sourceBefore);
      root.traverse((object) => { if (object instanceof Mesh) expect(object.geometry.getAttribute("uv")).toBeUndefined(); });
      const bounds = new Box3().setFromObject(root);
      expect(bounds.min.x).toBeGreaterThan(365); expect(bounds.max.x).toBeLessThan(607);
      expect(bounds.min.z).toBeGreaterThan(-244); expect(bounds.max.z).toBeLessThan(198);
    });
  }

  test("the upper wing's open north court and inner court remain sky-visible in both presentations", () => {
    for (const root of [createParliamentArchitecture(partPayload), createMinecraftParliamentArchitecture(partPayload, { voxels })]) {
      root.updateMatrixWorld(true);
      for (const [x, z] of [[560, 27], [560, 65], [465, 158], [568, 150], [461, -130]]) {
        const ray = new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0), 0, 90);
        expect(ray.intersectObject(root, true)).toHaveLength(0);
      }
    }
  });

  test("Minecraft upper-wing membership exactly matches its represented cube union", () => {
    const root = createMinecraftParliamentArchitecture(partPayload, { voxels });
    const blocks = root.userData.blocks.filter((b: any) => b.role === "JKH east upper display wing");
    expect(blocks).toHaveLength(890);
    for (let x = 531.25; x < 602; x += 1.5) for (let z = 16.25; z < 109; z += 1.5) {
      const actual = blocks.some((b: any) => Math.abs(x - b.centre[0]) < b.size[0] / 2 && Math.abs(z - b.centre[2]) < b.size[2] / 2);
      expect(jakobKaiserEastUpperMinecraftContains(x, z)).toBe(actual);
    }
  });

  test("library crown stays shallow and cannot reintroduce the old 39 m opaque drum", () => {
    const p = PARLIAMENT_ARCHITECTURE_PROFILE.marieElisabethLuedersHaus.libraryCrown;
    for (const make of [createParliamentArchitecture, createMinecraftParliamentArchitecture]) {
      const root = make(partPayload, { voxels });
      const crown = root.userData.blocks.filter((b: any) => b.role.startsWith("library roof") || b.role.startsWith("library shallow"));
      expect(crown.length).toBeGreaterThan(40);
      expect(Math.min(...crown.map((b: any) => b.centre[1] - b.size[1] / 2))).toBeCloseTo(p.baseY, 7);
      expect(Math.max(...crown.map((b: any) => b.centre[1] + b.size[1] / 2))).toBeLessThan(34.3);
      const ray = new Raycaster(new Vector3(370, 36, -139), new Vector3(1, 0, 0), 0, 70);
      expect(ray.intersectObject(root, true)).toHaveLength(0);
    }
  });

  test("the darker crown roof is recessed below its pale rim in both geometries", () => {
    for (const make of [createParliamentArchitecture, createMinecraftParliamentArchitecture]) {
      const root = make(partPayload, { voxels });
      const roof = root.userData.blocks.filter((b: any) => b.role === "library shallow crown roof");
      const rim = root.userData.blocks.filter((b: any) => b.role === "library shallow crown rim");
      expect(roof.length).toBeGreaterThan(0); expect(rim.length).toBeGreaterThan(0);
      const roofTop = Math.max(...roof.map((b: any) => b.centre[1] + b.size[1] / 2));
      const rimTop = Math.min(...rim.map((b: any) => b.centre[1] + b.size[1] / 2));
      // Their footprints intentionally meet; different-coloured horizontal
      // surfaces require positive separation to prevent stationary flicker.
      expect(rimTop - roofTop).toBeGreaterThan(0.075);
    }
  });

  test("visible drawn library panes face outward and sit in front of the actual source body", () => {
    const root = createParliamentArchitecture(partPayload);
    const body = createIsometricCity(partPayload, null, null, null, { includeContext: false });
    const all = new Group(); all.add(body, root); all.updateMatrixWorld(true);
    const panes = root.userData.blocks.filter((b: any) => b.role === "library curtain glazing" && b.normal[0] < -0.5);
    expect(panes.length).toBeGreaterThan(20);
    for (const pane of panes.filter((_: any, i: number) => i % 10 === 0)) {
      const n = new Vector3(pane.normal[0], 0, pane.normal[1]);
      const ray = new Raycaster(new Vector3(...pane.centre).addScaledVector(n, 8), n.negate(), 0, 10);
      const hits = ray.intersectObject(all, true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].object.parent).toBe(root);
    }
  });

  test("Minecraft panes remain outside the actual four-metre source cube skin", () => {
    const root = createMinecraftParliamentArchitecture(partPayload, { voxels });
    const skin = sourceCubeSkin(), all = new Group(); all.add(skin, root); all.updateMatrixWorld(true);
    const panes = root.userData.blocks.filter((b: any) => b.role === "library curtain glazing" && b.normal[0] < -0.5);
    expect(panes.length).toBeGreaterThan(10);
    for (const pane of panes.filter((_: any, i: number) => i % 4 === 0)) {
      const n = new Vector3(pane.normal[0], 0, pane.normal[1]);
      const ray = new Raycaster(new Vector3(...pane.centre).addScaledVector(n, 8), n.negate(), 0, 10);
      const hits = ray.intersectObject(all, true);
      expect(hits.length).toBeGreaterThan(0); expect(hits[0].object).not.toBe(skin);
    }
  });

  test("all five modes collide only with the represented upper wing and retain both court voids", () => {
    let mode: VisualMode = "day";
    const obstacles = compilePedestrianObstacles(partPayload, () => mode);
    for (const next of ["day", "night", "snowstorm", "minecraft", "schwellenraum"] as const) {
      mode = next;
      expect(pedestrianPointIsBlocked(585, 60, 20, obstacles)).toBeTrue();
      expect(pedestrianPointIsBlocked(585, 60, 27.2, obstacles)).toBeFalse();
      expect(pedestrianPointIsBlocked(560, 65, 20, obstacles)).toBeFalse();
      expect(pedestrianPointIsBlocked(560, 27, 20, obstacles)).toBeFalse();
      expect(pedestrianPointIsBlocked(560, 107, 20, obstacles)).toBeFalse();
    }
  });

  test("switching modes reuses the obstacle index without leaving an invisible Minecraft corner", () => {
    let mode: VisualMode = "minecraft";
    const obstacles = compilePedestrianObstacles(partPayload, () => mode);
    const x = 542.5, z = 101.5;
    expect(jakobKaiserEastUpperContains(x, z)).toBeFalse();
    expect(jakobKaiserEastUpperMinecraftContains(x, z)).toBeTrue();
    expect(pedestrianPointIsBlocked(x, z, 20, obstacles)).toBeTrue();
    for (const next of ["day", "night", "snowstorm", "schwellenraum"] as const) {
      mode = next;
      expect(pedestrianPointIsBlocked(x, z, 20, obstacles)).toBeFalse();
    }
    mode = "minecraft";
    expect(pedestrianPointIsBlocked(x, z, 20, obstacles)).toBeTrue();
  });
});
