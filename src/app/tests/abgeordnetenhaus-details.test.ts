import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  Box3, BufferGeometry, Group, InstancedMesh, LineSegments, Matrix4, Mesh,
  Raycaster, Vector3,
} from "three";
import {
  ABGEORDNETENHAUS_DETAIL_BUDGETS as B,
  abgeordnetenhausCentralRing, createAbgeordnetenhausDetails,
  createMinecraftAbgeordnetenhausDetails,
} from "../src/AbgeordnetenhausDetails";
import {
  ABGEORDNETENHAUS_PROFILE as P, abgeordnetenhausDisplayTopAt,
  abgeordnetenhausLocalPoint, abgeordnetenhausMainContains,
  abgeordnetenhausWorldPoint,
} from "../src/abgeordnetenhausProfile";
import { pointInWorldRing } from "../src/chancelleryExtensionProfile";

function stats(root: Group) {
  let draws = 0, bytes = 0, instances = 0;
  const geometries = new Set<BufferGeometry>();
  root.traverse((o) => {
    if (!(o instanceof Mesh || o instanceof LineSegments)) return;
    draws += 1;
    expect(o.matrixAutoUpdate).toBeFalse();
    if (!geometries.has(o.geometry)) {
      geometries.add(o.geometry);
      for (const attribute of Object.values(o.geometry.attributes)) {
        bytes += attribute.array.byteLength;
        expect(Array.from(attribute.array).every(Number.isFinite)).toBeTrue();
      }
      bytes += o.geometry.index?.array.byteLength ?? 0;
    }
    if (o instanceof Mesh) {
      expect(o.userData.civicBuildingDetail).toBeTrue();
      expect(o.userData.dayMaterial.map).toBeNull();
      expect(o.userData.nightMaterial.map).toBeNull();
      expect(o.userData.dayMaterial).not.toBe(o.userData.nightMaterial);
    }
    if (o instanceof InstancedMesh) {
      instances += o.count;
      bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
    }
  });
  return { draws, bytes, instances };
}

function signedArea(ring: readonly (readonly [number, number])[]): number {
  return ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
}

describe("Abgeordnetenhaus source plan and documented reconstruction", () => {
  test("retains every main-plan point and every court; records the faulty source height", () => {
    const payload = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8"));
    const part = payload.buildings.find((p: { id: string }) => p.id === P.mainPrismId);
    expect(P.footprintWorldM).toEqual(part.ring.map((p: number[]) => p.map((v) => v / 10)));
    expect(P.courtyardHolesWorldM).toEqual(part.holes.map((r: number[][]) => r.map((p) => p.map((v) => v / 10))));
    expect(P.footprintWorldM).toHaveLength(51);
    expect(P.courtyardHolesWorldM).toHaveLength(6);
    expect(part.h_dm / 10).toBe(P.sourceHeightM);
    expect(P.sourceHeightM).toBe(3);
    expect(P.displayWallHeightM).toBe(25);
    expect(P.geometryStatus).toContain("non-surveyed");
    expect(P.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test("exact roof triangulation subtracts all six court areas", () => {
    const root = createAbgeordnetenhausDetails();
    const shell = root.children.find((o) => o instanceof Mesh && !(o instanceof InstancedMesh)) as Mesh;
    const positions = shell.geometry.getAttribute("position");
    let roofArea = 0;
    for (let i = 0; i < positions.count; i += 3) {
      if (![i, i + 1, i + 2].every((j) => Math.abs(positions.getY(j) - P.wallTopY) < 1e-5)) continue;
      roofArea += Math.abs(signedArea([0, 1, 2].map((d) => [positions.getX(i + d), positions.getZ(i + d)])));
    }
    const expected = Math.abs(signedArea(P.footprintWorldM))
      - P.courtyardHolesWorldM.reduce((s, ring) => s + Math.abs(signedArea(ring)), 0);
    expect(roofArea).toBeCloseTo(expected, 1);
    for (const ring of P.courtyardHolesWorldM) {
      const x = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      const z = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      expect(abgeordnetenhausMainContains(x, z)).toBeFalse();
      expect(abgeordnetenhausDisplayTopAt(x, z)).toBeNull();
      const ray = new Raycaster(new Vector3(x, 60, z), new Vector3(0, -1, 0));
      expect(ray.intersectObject(root, true)).toHaveLength(0);
    }
  });

  test("front upper mass and glazed hip stay inside the exact source plan", () => {
    const central = abgeordnetenhausCentralRing();
    for (const [x, z] of central) {
      const [u, v] = abgeordnetenhausLocalPoint(x, z);
      expect(Math.abs(u)).toBeLessThanOrEqual(23.700001);
      expect(v).toBeGreaterThanOrEqual(-14.200001);
      expect(P.courtyardHolesWorldM.some((r) => pointInWorldRing(x, z, r))).toBeFalse();
    }
    for (const [u, v] of [[-12, -72], [12, -72], [12, -46], [-12, -46], [0, -64], [0, -54]]) {
      const [x, , z] = abgeordnetenhausWorldPoint(u, 0, v);
      expect(abgeordnetenhausMainContains(x, z)).toBeTrue();
      expect(abgeordnetenhausDisplayTopAt(x, z)).toBeCloseTo(u === 0 ? 33 : P.wallTopY, 5);
    }
  });

  for (const profile of ["full", "mobile"] as const) {
    test(`${profile} preserves the current facade hierarchy in both geometry styles`, () => {
      for (const build of [createAbgeordnetenhausDetails, createMinecraftAbgeordnetenhausDetails]) {
        const root = build(profile);
        expect(root.userData.cueCounts).toMatchObject({
          centralUpperArch: 7, entrancePortal: 3, colossalCorinthianColumn: 6,
          individualWindowPediment: 8, wingGroundArch: 8, flatBalustradeRun: 3,
          glazedHippedPlenaryRoof: 1,
        });
        expect(root.userData.estimatedHeight).toBeTrue();
        expect(new Box3().setFromObject(root).max.y).toBeCloseTo(P.roofTopY, 4);
      }
    });

    test(`${profile} keeps drawn and Minecraft detail within fixed GPU budgets`, () => {
      const drawn = stats(createAbgeordnetenhausDetails(profile));
      expect(drawn.draws).toBe(B.drawnRenderables);
      expect(drawn.instances).toBeLessThan(B[profile].drawnInstances);
      expect(drawn.bytes).toBeLessThan(B[profile].drawnBytes);
      const blocks = stats(createMinecraftAbgeordnetenhausDetails(profile));
      expect(blocks.draws).toBe(B.minecraftRenderables);
      expect(blocks.instances).toBeLessThan(B[profile].minecraftBlocks);
      expect(blocks.bytes).toBeLessThan(profile === "full" ? 270_000 : 220_000);
    });

    test(`${profile} block roof tiles never cover source courtyard interiors`, () => {
      const root = createMinecraftAbgeordnetenhausDetails(profile);
      expect(root.userData.keepInMinecraft).toBeTrue();
      expect(root.children).toHaveLength(1);
      const batch = root.children[0] as InstancedMesh;
      expect(batch.geometry.type).toBe("BoxGeometry");
      const matrix = new Matrix4(), p = new Vector3();
      let tiles = 0;
      for (let i = 0; i < batch.count; i += 1) {
        batch.getMatrixAt(i, matrix);
        if (Math.abs(matrix.elements[5] - 0.44) > 1e-6) continue;
        tiles += 1;
        for (const u of [-0.49, 0, 0.49]) for (const v of [-0.49, 0, 0.49]) {
          p.set(u, 0, v).applyMatrix4(matrix);
          expect(abgeordnetenhausMainContains(p.x, p.z)).toBeTrue();
        }
      }
      expect(tiles).toBe(root.userData.cueCounts.sourceContainedRoofCell);
      for (const ring of P.courtyardHolesWorldM) {
        const x = ring.reduce((s, p) => s + p[0], 0) / ring.length;
        const z = ring.reduce((s, p) => s + p[1], 0) / ring.length;
        expect(new Raycaster(new Vector3(x, 60, z), new Vector3(0, -1, 0)).intersectObject(root, true)).toHaveLength(0);
      }
    });
  }

  test("ships source facts and geometry, with no image loaders or reference photographs", () => {
    const source = readFileSync(new URL("../src/AbgeordnetenhausDetails.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/TextureLoader|CanvasTexture|\.jpe?g|\.png/i);
    expect(P.evidenceUrls).toContain("https://www.parlament-berlin.de/media/download/541");
    expect(P.evidenceUrls).toContain("https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096004");
  });
});
