import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createArchitecturalSignature, type HauptbahnhofModelSignature } from "../src/ArchitecturalLandmarks";
import { HBF_CIRCULATION_V291, hbfLocalToWorldV291, hbfRailCurveAtV291 } from "../src/HbfCirculationV291";
import { hbfSlabOpeningsV291 } from "../src/HbfGeometryOpeningsV291";

const scene = await Bun.file(new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url)).json() as { architectural_signatures: HauptbahnhofModelSignature[] };
const signature = scene.architectural_signatures.find(s => s.kind === "hauptbahnhof_model")!;

describe("Hauptbahnhof upper-platform curved segment seams v291", () => {
  test("all three real islands stay supported over the complete 224 m course except their authored apertures", () => {
    const root = createArchitecturalSignature(signature)!;
    root.updateMatrixWorld(true);
    const platforms: Mesh[] = [];
    root.traverse(o => { if (o instanceof Mesh && o.name === "Hauptbahnhof upper platform") platforms.push(o); });
    expect(platforms.reduce((n, o) => n + (o instanceof InstancedMesh ? o.count : 1), 0)).toBe(60);
    const top = 10.73, cuts = hbfSlabOpeningsV291(top - .42, top);
    const rayAt = (x: number, z: number) => new Raycaster(new Vector3(...hbfLocalToWorldV291([x, top + .5, z])), new Vector3(0, -1, 0), 0, .8).intersectObjects(platforms, false);
    const inAperture = (x: number, z: number) => cuts.some(c => c.planes.every(p => p[0]*x + p[1]*top + p[2]*z + p[3] >= -1e-7));
    const missing: { x:number; z:number; island:number; offset:number }[] = [];
    let checked = 0, skipped = 0;
    for (const island of HBF_CIRCULATION_V291.upperPlatformCentresLocalZ) {
      for (let quarter = -448; quarter <= 448; quarter++) {
        const courseX = quarter / 4;
        const slope = hbfRailCurveAtV291(courseX + .5) - hbfRailCurveAtV291(courseX - .5);
        const cosine = 1 / Math.hypot(1, slope), sine = slope * cosine;
        for (const offset of [-1.1, 0, 1.1]) {
          // Traverse lanes normal to the curve, including the actual slanted
          // endcaps. A fixed X line through a lateral offset can be beyond a
          // real platform endpoint even while its centreline is still inside.
          const x = courseX - sine * offset;
          const z = hbfRailCurveAtV291(courseX) + island + cosine * offset;
          if (inAperture(x, z)) { skipped++; continue; }
          const hits = rayAt(x, z);
          if (!hits.length || Math.abs(hits[0].point.y - hbfLocalToWorldV291([x, top, z])[1]) > 1e-4)
            missing.push({ x, z, island, offset });
          checked++;
        }
      }
    }
    expect(checked + skipped).toBe(8073);
    expect(checked).toBeGreaterThan(6500);
    expect(skipped).toBeGreaterThan(0);
    expect(missing.slice(0, 20)).toEqual([]);
    // Length correction follows the existing centreline; it must not fill the
    // spaces between islands or create a straight slab across the bowed hall.
    for (const x of [-111, -80, -44.75, 0, 44.75, 80, 111]) {
      for (const offset of [-22.5, -7.5, 7.5, 22.5]) expect(rayAt(x, hbfRailCurveAtV291(x) + offset)).toHaveLength(0);
    }
  }, 60_000);
});
