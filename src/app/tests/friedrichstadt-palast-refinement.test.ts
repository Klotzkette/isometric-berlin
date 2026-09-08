import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import {
  createFriedrichstadtPalast, createMinecraftFriedrichstadtPalast,
  friedrichstadtPalastContains, friedrichstadtPalastSolidAt,
  friedrichstadtPalastTopAt, FRIEDRICHSTADT_PALAST_GLASS_LAYER_NAME,
  FRIEDRICHSTADT_PALAST_MINECRAFT_NAME, FRIEDRICHSTADT_PALAST_ROOT_NAME,
  palastFacadePoint, planFriedrichstadtPalast, setFriedrichstadtMinecraftPresentation,
} from "../src/FriedrichstadtPalastDetails";
import { createFriedrichstadtAndTearPalaces, TEAR_PALACE_ROOT_NAME } from "../src/FriedrichstadtAndTearPalaces";

describe("Friedrichstadt-Palast visible source-bound close refinement", () => {
  test("front, foyer returns and function-wing panes are actually outside the drawn and block skins", () => {
    for (const profile of ["full", "mobile"] as const) for (const minecraft of [false, true]) {
      const root = minecraft ? createMinecraftFriedrichstadtPalast(profile) : createFriedrichstadtPalast(profile);
      const plan = planFriedrichstadtPalast(profile, minecraft);
      const mesh = (minecraft ? root.children[0] : root.getObjectByName(FRIEDRICHSTADT_PALAST_GLASS_LAYER_NAME)) as InstancedMesh;
      const offset = minecraft ? mesh.count - plan.glass.length - plan.sign.length : 0;
      root.updateMatrixWorld(true);
      const matrix = new Matrix4();
      const roles = new Map<string, number>();
      for (const [index, b] of plan.glass.entries()) {
        if (!["concrete-glass-aggregate", "central-glazed-vitrine", "foyer-return-glass-aggregate", "function-wing-window"].includes(b.role)) continue;
        // Sample every bay/edge, without repeating every tiny glass cell.
        if (b.role.includes("aggregate") && index % 7) continue;
        if (b.role === "function-wing-window" && index % 4) continue;
        mesh.getMatrixAt(index + offset, matrix); matrix.premultiply(mesh.matrixWorld);
        const target = new Vector3().setFromMatrixPosition(matrix);
        if (b.role === "function-wing-window") target.add(new Vector3(.3, .2, 0).applyQuaternion(b.rotation));
        const normal = b.outward ? new Vector3(b.outward[0], 0, b.outward[1])
          : new Vector3(...palastFacadePoint(0, 0, 1)).sub(new Vector3(...palastFacadePoint(0, 0, 0)));
        const ray = new Raycaster(target.clone().addScaledVector(normal, 3), normal.clone().negate(), 0, 5);
        const first = ray.intersectObject(root, true)[0];
        expect(first?.object.name, `${profile}/${minecraft}/${b.role}/${index}`).toBe(mesh.name);
        expect(first?.instanceId, `${profile}/${minecraft}/${b.role}/${index}`).toBe(index + offset);
        roles.set(b.role, (roles.get(b.role) ?? 0) + 1);
      }
      expect([...roles.keys()].sort()).toEqual(["central-glazed-vitrine", "concrete-glass-aggregate", "foyer-return-glass-aggregate", "function-wing-window"].sort());
    }
  });

  test("roof walking matches actual main and stage surfaces, with the street approach open", () => {
    const root = createFriedrichstadtPalast(); root.updateMatrixWorld(true);
    for (const [u, inward] of [[0, 10], [-20, 35], [20, 50], [-1.5, 62], [-8, 54], [5, 70]]) {
      const [x, , z] = palastFacadePoint(u, 0, -inward);
      const expected = friedrichstadtPalastTopAt(x, z);
      const hit = new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0)).intersectObject(root, true)[0];
      expect(expected).not.toBeNull();
      expect(Math.abs(hit.point.y - expected!)).toBeLessThan(.06);
      expect(friedrichstadtPalastSolidAt(x, z, 6, 1.8)).toBeTrue();
      expect(friedrichstadtPalastSolidAt(x, z, expected!, 1.8)).toBeFalse();
    }
    for (const u of [-20, -10, 0, 10, 20]) {
      const [x, , z] = palastFacadePoint(u, 0, 4.5);
      expect(friedrichstadtPalastContains(x, z)).toBeFalse();
      expect(friedrichstadtPalastTopAt(x, z)).toBeNull();
      expect(friedrichstadtPalastSolidAt(x, z, 5.2)).toBeFalse();
    }
    expect(friedrichstadtPalastTopAt(1200, -540, "unrelated-source")).toBeNull();
  });

  test("mode switching reveals exactly one Palast and never toggles the separate Tränenpalast", () => {
    const root = createFriedrichstadtAndTearPalaces("mobile");
    const smooth = root.getObjectByName(FRIEDRICHSTADT_PALAST_ROOT_NAME)!;
    const blocks = root.getObjectByName(FRIEDRICHSTADT_PALAST_MINECRAFT_NAME)!;
    const tear = root.getObjectByName(TEAR_PALACE_ROOT_NAME)!;
    for (const minecraft of [true, false, true, false]) {
      setFriedrichstadtMinecraftPresentation(root, minecraft);
      expect(smooth.visible).toBe(!minecraft); expect(blocks.visible).toBe(minecraft); expect(tear.visible).toBeTrue();
    }
    const full = createFriedrichstadtPalast("full"), mobile = createFriedrichstadtPalast("mobile");
    for (const root of [full, mobile, blocks]) root.traverse(o => {
      if (!(o instanceof Mesh)) return;
      expect(o.geometry.getAttribute("uv")).toBeUndefined();
      if (o instanceof InstancedMesh) {
        expect(o.instanceColor).not.toBeNull();
        expect((o.material as MeshBasicMaterial).vertexColors).toBeFalse();
      }
    });
    const fullPlan = planFriedrichstadtPalast("full"), mobilePlan = planFriedrichstadtPalast("mobile");
    expect(fullPlan.glass.filter(b => b.role === "faceted-foyer-pane")).toHaveLength(16);
    expect(mobilePlan.glass.filter(b => b.role === "faceted-foyer-pane")).toHaveLength(16);
    expect(fullPlan.glass.filter(b => b.role === "foyer-return-pane")).toHaveLength(12);
    expect(mobilePlan.glass.filter(b => b.role === "foyer-return-pane")).toHaveLength(12);
  });
});
