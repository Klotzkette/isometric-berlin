import { describe, expect, test } from "bun:test";
import { Box3, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createPotsdamerTrafficTower, planPotsdamerTrafficTower, setPotsdamerTrafficTowerPresentation, updatePotsdamerTrafficTower } from "../src/PotsdamerTrafficTower";
import { POTSDAMER_TRAFFIC_TOWER_PROFILE as P, POTSDAMER_TOWER_DRAWN_NAME, POTSDAMER_TOWER_MINECRAFT_NAME, POTSDAMER_TOWER_CYCLE_SECONDS, POTSDAMER_TOWER_SIGNAL_CYCLE, potsdamerTowerLamps, potsdamerTowerPhase } from "../src/potsdamerTrafficTowerProfile";
import street from "../public/mesh/regierungsviertel/street-details.json";
import { applyLightingToRoot } from "../src/ThreeViewer";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
function lamps(root: Group): InstancedMesh[] { const result: InstancedMesh[] = []; root.traverse(o => { if (o instanceof InstancedMesh && o.name === "traffic tower animated lamps") result.push(o); }); return result; }
function colors(mesh: InstancedMesh): number[] { const result: number[] = [], c = new Color(); for (let i = 0; i < mesh.count; i++) { mesh.getColorAt(i, c); result.push(c.getHex()); } return result; }
function budget(root: Group): { calls: number; bytes: number; instances: number } {
  const buffers = new Set<ArrayBufferLike>(); let calls = 0, instances = 0;
  root.traverse(o => { if (!(o instanceof Mesh)) return; calls++;
    for (const attr of Object.values(o.geometry.attributes)) buffers.add(attr.array.buffer);
    if (o.geometry.index) buffers.add(o.geometry.index.array.buffer);
    if (o instanceof InstancedMesh) { instances += o.count; buffers.add(o.instanceMatrix.array.buffer); if (o.instanceColor) buffers.add(o.instanceColor.array.buffer); }
  }); return { calls, bytes: [...buffers].reduce((n, b) => n + b.byteLength, 0), instances };
}
describe("Potsdamer Platz present-day traffic tower", () => {
  test("retains OSM centroid with five supports, five clocks and published height", () => {
    const source = street.monuments.find(m => m.osm_key === P.osmKey)!;
    expect(source.name).toBe("Verkehrsturm");
    expect(Math.hypot(P.worldXZ[0] - source.x_dm / 10, P.worldXZ[1] - source.z_dm / 10)).toBeLessThan(.025);
    expect(P.sourceRingXZ).toHaveLength(6); expect(P.heightM).toBe(8.5);
    const parts = planPotsdamerTrafficTower();
    for (const role of ["open steel support", "clock white face", "glass cabin window"]) expect(parts.filter(p => p.role === role)).toHaveLength(5);
    expect(parts.filter(p => p.role === "lamp black housing")).toHaveLength(15);
    expect(parts.filter(p => p.role === "lamp black housing").every(p => p.position[1] === P.signalCentreM)).toBe(true);
    expect(parts.filter(p => p.role === "clock minute hand").every(p => p.roll !== undefined)).toBe(true);
    for (const mobileLike of [false, true]) { const root = createPotsdamerTrafficTower(0, { mobileLike }); const bounds = new Box3().setFromObject(root); expect(bounds.min.y).toBeCloseTo(0, 5); expect(bounds.max.y).toBeCloseTo(8.5, 5); }
  });
  test("bounded texture-free full/mobile geometry obeys vertex and instance colour contracts", () => {
    for (const mobileLike of [false, true]) {
      const root = createPotsdamerTrafficTower(0, { mobileLike });
      const drawn = root.getObjectByName(POTSDAMER_TOWER_DRAWN_NAME) as Group, minecraft = root.getObjectByName(POTSDAMER_TOWER_MINECRAFT_NAME) as Group;
      expect(budget(drawn).calls).toBe(3); expect(budget(minecraft).calls).toBe(3);
      expect(budget(drawn).bytes).toBeLessThan(500_000); expect(budget(minecraft).bytes).toBeLessThan(150_000);
      expect(budget(minecraft).instances).toBeLessThan(mobileLike ? 1_010 : 1_800);
      root.traverse(o => { if (!(o instanceof Mesh)) return; expect(o.geometry.getAttribute("uv")).toBeUndefined();
        for (const m of [o.userData.dayMaterial, o.userData.nightMaterial]) { expect(m.map).toBeNull(); expect(m.vertexColors).toBe(!!o.geometry.getAttribute("color")); }
      });
      minecraft.traverse(o => { if (!(o instanceof Mesh)) return; expect(o).toBeInstanceOf(InstancedMesh); expect(o.geometry).toHaveProperty("type", "BoxGeometry");
        const matrix = new Matrix4(); for (let i = 0; i < (o as InstancedMesh).count; i++) { (o as InstancedMesh).getMatrixAt(i, matrix); for (const j of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[j]).toBe(0); }
      });
    }
  });
  test("open middle remains empty and fifteen lenses are in front of their housings", () => {
    for (const mobileLike of [false, true]) for (const minecraft of [false, true]) {
      const root = createPotsdamerTrafficTower(0, { mobileLike }); root.updateMatrixWorld(true);
      const active = root.getObjectByName(minecraft ? POTSDAMER_TOWER_MINECRAFT_NAME : POTSDAMER_TOWER_DRAWN_NAME)!;
      for (const axis of [new Vector3(1, 0, 0), new Vector3(0, 0, 1)]) {
        const from = new Vector3(P.worldXZ[0], 2, P.worldXZ[1]).addScaledVector(axis, -3);
        expect(new Raycaster(from, axis, 0, 6).intersectObject(active, true)).toHaveLength(0);
      }
      for (let face = 0; face < 5; face++) for (let lamp = 0; lamp < 3; lamp++) {
        const yaw = P.firstFaceYaw + face * Math.PI * 2 / 5, u = (lamp - 1) * .32, normal = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const target = new Vector3(P.worldXZ[0] + Math.cos(yaw) * u, P.signalCentreM, P.worldXZ[1] - Math.sin(yaw) * u);
        const hit = new Raycaster(target.addScaledVector(normal, 2), normal.negate(), 0, 1.5).intersectObject(active, true)[0];
        expect(hit?.object.name, `${mobileLike}/${minecraft} face ${face} lamp ${lamp}`).toBe("traffic tower animated lamps");
      }
    }
  });
  test("all phases repeat and exact unsurveyed timing is labelled approximate", () => {
    expect(Object.values(POTSDAMER_TOWER_SIGNAL_CYCLE).reduce((a, b) => a + b, 0)).toBe(POTSDAMER_TOWER_CYCLE_SECONDS);
    expect([0, 16, 18, 32, 36].map(t => potsdamerTowerPhase(t))).toEqual([0, 1, 2, 3, 0]);
    expect(potsdamerTowerPhase(-.1)).toBe(3); expect(potsdamerTowerPhase(Number.NaN)).toBe(0); expect(potsdamerTowerLamps(1)).toEqual([true, true, false]);
    for (let face = 0; face < 5; face++) for (let t = 0; t < 36; t += .5) expect(potsdamerTowerPhase(t, face)).toBe(potsdamerTowerPhase(t + 36, face));
    expect(P.signalStatus).toContain("approximation");
  });
  test("updates only phase boundaries, preserves mode continuity, respects lights and reduced motion", () => {
    const root = createPotsdamerTrafficTower(), a = lamps(root); expect(a).toHaveLength(2);
    expect(updatePotsdamerTrafficTower(root, .5, false)).toBe(false);
    const initial = a.map(m => m.instanceColor!.version); expect(updatePotsdamerTrafficTower(root, 16.1, false)).toBe(true);
    expect(a.map(m => m.instanceColor!.version)).toEqual(initial.map(v => v + 1)); expect(colors(a[0])).toEqual(colors(a[1]));
    const c = colors(a[0]);
    for (const mode of ["day", "night", "snowstorm", "schwellenraum", "minecraft", "day"] as const) {
      applyLightingToRoot(root, mode, true); setIsoNightPresentation(root, mode === "night", true, mode); setPotsdamerTrafficTowerPresentation(root, mode);
      expect(root.getObjectByName(POTSDAMER_TOWER_DRAWN_NAME)!.visible).toBe(mode !== "minecraft"); expect(root.getObjectByName(POTSDAMER_TOWER_MINECRAFT_NAME)!.visible).toBe(mode === "minecraft");
      expect(updatePotsdamerTrafficTower(root, 16.1, false)).toBe(false); expect(colors(a[0])).toEqual(c); expect((a[0].material as MeshBasicMaterial).toneMapped).toBe(false);
    }
    expect(updatePotsdamerTrafficTower(root, 18.1, false, false)).toBe(true); expect(colors(a[0]).slice(0, 3)).toEqual([0x371713, 0x34280e, 0x123823]);
    expect(updatePotsdamerTrafficTower(root, 18.1, false, true)).toBe(true); expect(colors(a[0]).slice(0, 3)).toEqual([0x371713, 0x34280e, 0x35ed75]);
    updatePotsdamerTrafficTower(root, 0, true); const stable = colors(a[0]);
    for (const t of [2, 19, 100]) expect(updatePotsdamerTrafficTower(root, t, true)).toBe(false); expect(colors(a[0])).toEqual(stable);
  });
});
