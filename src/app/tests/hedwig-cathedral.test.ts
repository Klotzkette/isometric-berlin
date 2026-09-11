import { describe, expect, test } from "bun:test";
import { Box3, BufferGeometry, InstancedMesh, LineSegments, Mesh, Raycaster, Vector3 } from "three";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import source from "../src/bebelplatzBuildingSource.json";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  createHedwigCathedral, createMinecraftHedwigCathedral,
  HEDWIG_CATHEDRAL_PROFILE, hedwigRoofTopAt,
} from "../src/HedwigCathedral";

const payload = ground as unknown as VoxelPayload;

describe("Hedwig Cathedral source-bound recognition", () => {
  test("walking support follows visible dome and portico heights", () => {
    const root = createHedwigCathedral(payload);
    root.updateMatrixWorld(true);
    for (const [x,z] of [[1580.02,382.71],[1588,381],[1570,382],[1598,405],[1568,362]]) {
      const hit = new Raycaster(new Vector3(x,70,z),new Vector3(0,-1,0))
        .intersectObject(root,true).find(({object}) => object instanceof Mesh);
      expect(hit).toBeDefined();
      expect(Math.abs(hedwigRoofTopAt(x,z)! - hit!.point.y)).toBeLessThan(0.12);
    }
    expect(hedwigRoofTopAt(1519,300)).toBeNull();
  });
  test("retains authoritative full envelope and explicitly replaces only the fallback", () => {
    const p = HEDWIG_CATHEDRAL_PROFILE;
    expect(p.osmKey).toBe("way/58608090");
    expect(p.lod2Parent).toBe("DEBE01YYK00000AQ");
    expect(p.replacedOsmPrismIds).toEqual(["58608090"]);
    expect(p.sourceHeightM).toBe(35.62);
    expect(p.sourceTopY).toBe(39.727);
    expect(p.sourceGroundY).toBe(4.107);
    expect(p.sourceConflict).toContain("generalized LoD2 pitched roof");
    expect(p.photographsBundled).toBeFalse();
    expect(p.references).toHaveLength(2);
    const points = source.profiles.hedwig.parts[0].ring.filter(([, z]) => z > 369 && z < 395);
    for (const [x, z] of points) {
      const distance = Math.hypot(x - p.mainCentreWorldM[0], z - p.mainCentreWorldM[1]);
      expect(Math.abs(distance - p.mainRadiusM)).toBeLessThan(0.05);
    }
  });

  test("renders two green hemispherical roofs within the official complete height", () => {
    const root = createHedwigCathedral(payload);
    expect(root.userData.domeCount).toBe(2);
    const bounds = new Box3().setFromObject(root);
    expect(bounds.min.y).toBeCloseTo(4.107, 3);
    expect(bounds.max.y).toBeCloseTo(39.727, 3);
    expect(bounds.min.x).toBeGreaterThan(1553);
    expect(bounds.max.x).toBeLessThan(1605);
    expect(bounds.min.z).toBeGreaterThan(351);
    expect(bounds.max.z).toBeLessThan(416);
    const roof = root.getObjectByName("St Hedwig green copper domes bodies") as Mesh;
    const position = roof.geometry.getAttribute("position");
    const color = roof.geometry.getAttribute("color");
    let main = 0, rear = 0;
    for (let i = 0; i < position.count; i += 1) {
      expect(color.getY(i)).toBeGreaterThan(color.getX(i));
      if (position.getY(i) > 38 && position.getZ(i) < 390) main += 1;
      if (position.getY(i) > 27.5 && position.getZ(i) > 404) rear += 1;
    }
    expect(main).toBeGreaterThan(100);
    expect(rear).toBeGreaterThan(20);
    // Panels must face out/up: an inward winding would disappear from above.
    const a = new Vector3().fromBufferAttribute(position, 0);
    const b = new Vector3().fromBufferAttribute(position, 1);
    const c = new Vector3().fromBufferAttribute(position, 2);
    expect(b.sub(a).cross(c.sub(a)).y).toBeGreaterThan(0);
  });

  test("keeps the complete drawn model static, texture-free and bounded", () => {
    const root = createHedwigCathedral(payload);
    let draws = 0, bytes = 0, vertices = 0;
    root.traverse((object) => {
      expect(object.matrixAutoUpdate).toBeFalse();
      if (!(object instanceof Mesh || object instanceof LineSegments)) return;
      draws += 1;
      const geometry = object.geometry as BufferGeometry;
      for (const attribute of Object.values(geometry.attributes)) {
        bytes += attribute.array.byteLength;
        expect(Array.from(attribute.array).every(Number.isFinite)).toBeTrue();
      }
      bytes += geometry.index?.array.byteLength ?? 0;
      vertices += geometry.getAttribute("position").count;
      if (object instanceof Mesh) {
        expect(object.userData.dayMaterial.map).toBeNull();
        expect(object.userData.nightMaterial.map).toBeNull();
      }
    });
    expect(draws).toBe(4);
    expect(bytes).toBeLessThan(650_000);
    expect(vertices).toBeLessThan(36_000);
    console.log("Hedwig drawn budget", { draws, bytes, vertices });
  });

  test("substitutes one bounded block-native batch in Minecraft", () => {
    const root = createMinecraftHedwigCathedral(payload);
    expect(root.userData.keepInMinecraft).toBeTrue();
    expect(root.userData.surfaceOnly).toBeTrue();
    expect(root.children).toHaveLength(1);
    const mesh = root.children[0] as InstancedMesh;
    expect(mesh).toBeInstanceOf(InstancedMesh);
    expect(mesh.count).toBeGreaterThan(600);
    expect(mesh.count).toBeLessThan(2_300);
    expect(mesh.instanceColor?.count).toBe(mesh.count);
    expect(mesh.userData.dayMaterial.map).toBeNull();
    const bounds = new Box3().setFromObject(root);
    expect(bounds.max.y).toBeLessThanOrEqual(39.728);
    console.log("Hedwig Minecraft blocks", mesh.count);
  });
});
