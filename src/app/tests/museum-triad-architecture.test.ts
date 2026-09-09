import { describe, expect, test } from "bun:test";
import {
  Box3,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  Raycaster,
  Vector3,
} from "three";
import { createMuseumTriadArchitecture } from "../src/MuseumTriadArchitecture";
import {
  MUSEUM_TRIAD_SOURCES,
  MUSEUM_TRIAD_SOURCE,
  MUSEUM_TRIAD_PRISM_IDS,
  museumTriadPartRoofAt,
  museumTriadContains,
  isMuseumTriadReplacementColumn,
  nationalgaleriePorticoWalkableAt,
  nationalgaleriePorticoSolidAt,
  nationalgalerieWalkSurfaceAt,
  NATIONALGALERIE_FRAME,
} from "../src/museumTriadProfile";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
function local(u: number, y: number, v: number): Vector3 {
  const f = NATIONALGALERIE_FRAME,
    c = Math.cos(f.yaw),
    s = Math.sin(f.yaw);
  return new Vector3(f.x + c * u + s * v, y, f.z - s * u + c * v);
}
function metrics(root: Group) {
  let calls = 0,
    instances = 0,
    bytes = 0;
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    calls++;
    for (const a of Object.values(o.geometry.attributes))
      bytes += a.array.byteLength;
    if (o.geometry.index) bytes += o.geometry.index.array.byteLength;
    if (o instanceof InstancedMesh) {
      instances += o.count;
      bytes +=
        o.instanceMatrix.array.byteLength +
        (o.instanceColor?.array.byteLength ?? 0);
    }
  });
  return { calls, instances, bytes };
}
describe("source-bound Museum Island triad", () => {
  test("preserves all 26 metric parts and the three superseded source records", () => {
    expect(MUSEUM_TRIAD_SOURCES.map((s) => s.parts.length)).toEqual([
      12, 13, 1,
    ]);
    expect(MUSEUM_TRIAD_SOURCES.map((s) => s.source_created)).toEqual([
      "2026-03-02",
      "2026-03-02",
      "2026-03-02",
    ]);
    for (const source of MUSEUM_TRIAD_SOURCES)
      expect(source.previous_display_prism).toEqual(
        prisms.buildings.find((p) => p.id === source.previous_display_prism.id),
      );
    expect(
      MUSEUM_TRIAD_SOURCES.map((s) =>
        Math.max(...s.parts.map((p) => p.top_y_m)),
      ),
    ).toEqual([44.876, 34.959, 35.995]);
    expect([...MUSEUM_TRIAD_PRISM_IDS]).toEqual([
      "13659704",
      "18578139",
      "13670733",
    ]);
  });
  test("samples the actual inclined planes rather than the first nearly collinear vertices", () => {
    const p = MUSEUM_TRIAD_SOURCE.pergamon.parts.find(
      (p) => p.id === "DEBE3DKEaAKJ8HLe",
    )!;
    const nearEaves = museumTriadPartRoofAt(p, 1690, -245),
      nearRidge = museumTriadPartRoofAt(p, 1730, -205);
    expect(nearEaves).not.toBeNull();
    expect(nearRidge).not.toBeNull();
    expect(nearRidge!).toBeGreaterThan(nearEaves! + 7);
    let samples = 0;
    for (const s of MUSEUM_TRIAD_SOURCES)
      for (const p of s.parts)
        for (const surface of p.surfaces) {
          if (surface.kind !== "RoofSurface") continue;
          const r = surface.rings[0],
            x = r.reduce((sum, p) => sum + p[0], 0) / r.length,
            z = r.reduce((sum, p) => sum + p[2], 0) / r.length;
          if (!museumTriadContains(p, x, z)) continue;
          const y = museumTriadPartRoofAt(p, x, z);
          expect(y).not.toBeNull();
          expect(y!).toBeGreaterThanOrEqual(p.ground_y_m);
          expect(y!).toBeLessThanOrEqual(p.top_y_m + 0.001);
          samples++;
        }
    expect(samples).toBeGreaterThan(40);
  });
  test("excludes only the original and current source footprints, retaining neighbouring streets and Bode", () => {
    expect(isMuseumTriadReplacementColumn(1591, -283)).toBe(false);
    expect(isMuseumTriadReplacementColumn(1690, -300)).toBe(false);
    expect(isMuseumTriadReplacementColumn(1880, -150)).toBe(false);
    for (const s of MUSEUM_TRIAD_SOURCES)
      for (const p of s.parts) {
        const x = p.ring.reduce((sum, p) => sum + p[0], 0) / p.ring.length,
          z = p.ring.reduce((sum, p) => sum + p[1], 0) / p.ring.length;
        if (museumTriadContains(p, x, z))
          expect(isMuseumTriadReplacementColumn(x, z)).toBe(true);
      }
  });
  test("portico clearance keeps the eight columns and rooftop landing separate", () => {
    const between = local(-12.93, 20, 32.3),
      column = local(-15, 20, 32.3),
      roof = local(-12.93, 35, 32.3);
    expect(
      nationalgaleriePorticoWalkableAt(
        between.x,
        between.y,
        between.z,
        "DEBE01YYK00000rL",
      ),
    ).toBe(true);
    expect(nationalgaleriePorticoSolidAt(between.x, between.z, between.y)).toBe(
      false,
    );
    expect(nationalgaleriePorticoSolidAt(column.x, column.z, column.y)).toBe(
      true,
    );
    expect(
      nationalgaleriePorticoWalkableAt(
        roof.x,
        roof.y,
        roof.z,
        "DEBE01YYK00000rL",
      ),
    ).toBe(false);
    expect(
      nationalgaleriePorticoWalkableAt(
        between.x,
        between.y,
        between.z,
        "neighbour",
      ),
    ).toBe(false);
    expect(nationalgalerieWalkSurfaceAt(between.x, between.z)).toBeCloseTo(
      13.54,
      3,
    );
    for (const side of [-1, 1]) {
      const a = local(side * 6, 0, 51.7),
        b = local(side * 22, 0, 51.7);
      expect(nationalgalerieWalkSurfaceAt(b.x, b.z)!).toBeGreaterThan(
        nationalgalerieWalkSurfaceAt(a.x, a.z)!,
      );
    }
  });
  for (const mobileLike of [false, true])
    for (const minecraft of [false, true])
      test(`${minecraft ? "Minecraft" : "smooth"} ${mobileLike ? "mobile" : "full"} retains facade/portico geometry in a bounded texture-free batch`, () => {
        const root = createMuseumTriadArchitecture({ mobileLike, minecraft });
        root.updateMatrixWorld(true);
        const m = metrics(root);
        expect(m.calls).toBe(minecraft ? 1 : 3);
        expect(m.instances).toBeLessThan(minecraft ? 23000 : 8000);
        expect(m.bytes).toBeLessThan(minecraft ? 1800000 : 800000);
        expect(new Box3().setFromObject(root).max.y).toBeLessThan(45.1);
        root.traverse((o) => {
          if (!(o instanceof Mesh)) return;
          expect(o.geometry.getAttribute("uv")).toBeUndefined();
          expect(o.userData.dayMaterial).toBeDefined();
          expect(o.userData.nightMaterial).toBeDefined();
          expect(o.userData.moonlitMaterial).toBeDefined();
          expect(o.userData.textureFree).toBe(true);
        });
        // This ray passes between two columns toward the inset red portico wall.
        // The old closed LoD2 facade would hit immediately at v=33.2.
        const origin = local(-12.93, 23, 35),
          direction = local(-12.93, 23, 20).sub(origin).normalize();
        const hits = new Raycaster(origin, direction, 0, 20).intersectObjects(
          root.children,
          true,
        );
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].distance).toBeGreaterThan(8.8);
        const hit = hits[0],
          c = new Color();
        (hit.object as InstancedMesh).getColorAt(hit.instanceId!, c);
        expect(c.getHex()).toBe(0x713f3d);
      });
});
