import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, ShaderLib, Vector3 } from "three";
import {
  createFernsehturmArchitecture,
  createMinecraftFernsehturmArchitecture,
  updateFernsehturmLighting,
} from "../src/FernsehturmArchitecture";
import {
  FERNSEHTURM_DETAIL_PROFILE as P,
  fernsehturmSunReflection,
} from "../src/fernsehturmDetailProfile";
import { FERNSEHTURM_PROFILE as original } from "../src/schlossEastProfile";

function signature(root: ReturnType<typeof createFernsehturmArchitecture>) {
  const arrays: Uint8Array[] = [];
  let bytes = 0,
    draws = 0,
    instances = 0;
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    draws++;
    expect(o.matrixAutoUpdate).toBeFalse();
    for (const a of Object.values(o.geometry.attributes)) {
      bytes += a.array.byteLength;
      arrays.push(new Uint8Array(a.array.buffer));
      expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();
    }
    bytes += o.geometry.index?.array.byteLength ?? 0;
    if (o instanceof InstancedMesh) {
      instances += o.count;
      bytes +=
        o.instanceMatrix.array.byteLength +
        (o.instanceColor?.array.byteLength ?? 0);
      arrays.push(new Uint8Array(o.instanceMatrix.array.buffer));
    }
    for (const m of [o.userData.dayMaterial, o.userData.nightMaterial])
      expect(m.map).toBeNull();
  });
  return {
    bytes,
    draws,
    instances,
    hash: new Bun.CryptoHasher("sha256")
      .update(Buffer.concat(arrays))
      .digest("hex"),
  };
}
describe("Fernsehturm measured silhouette and bounded details", () => {
  test("retains original identity, source ground, 32 m sphere and 368 m height", () => {
    expect(P.x).toBe(original.x);
    expect(P.z).toBe(original.z);
    expect(P.groundY).toBe(original.groundY);
    expect(P.sourcePartIds).toEqual(original.sourcePartIds);
    expect(P.sphereRadius).toBe(16);
    expect(P.totalHeight).toBe(368);
    expect(P.observationLevel).toBe(203);
    expect(P.restaurantLevel).toBe(207);
  });
  for (const native of [false, true])
    test(`complete equal touch/desktop geometry and surface budget (${native})`, () => {
      const create = native
        ? createMinecraftFernsehturmArchitecture
        : createFernsehturmArchitecture;
      const root = create(false),
        stats = signature(root);
      expect(signature(create(true))).toEqual(stats);
      expect(stats.draws).toBe(native ? 3 : 4);
      expect(stats.bytes).toBeLessThan(native ? 2_000_000 : 1_700_000);
      expect(stats.instances).toBeLessThan(native ? 24000 : 1000);
      const box = new Box3().setFromObject(root);
      expect(box.min.y).toBeCloseTo(P.groundY, 3);
      expect(box.max.y).toBeCloseTo(P.groundY + 368, 3);
      expect(box.max.x - P.x).toBeLessThan(17.4);
      expect(P.x - box.min.x).toBeLessThan(17.4);
      expect(root.userData.hiddenSolidInfill).toBeFalse();
      expect(typeof root.userData.setFernsehturmLighting).toBe("function");
      if (native)
        root.traverse((o) => {
          if (o instanceof Mesh) {
            expect(o instanceof InstancedMesh).toBeTrue();
            expect(o.geometry.attributes.position.count).toBe(24);
          }
        });
      console.log({ native, ...stats });
    });
  test("cross follows the sunlight half-vector, with dark opposite/night/overcast sides", () => {
    const sun = new Vector3(-0.4, 0.65, 0.8).normalize(),
      view = new Vector3(-0.4, -0.15, 0.8).normalize(),
      n = sun.clone().add(view).normalize();
    const tangent = new Vector3(n.z, 0, -n.x).normalize(),
      up = n.clone().cross(tangent).normalize();
    const sample = (x: number, y: number) =>
      fernsehturmSunReflection(
        n
          .clone()
          .addScaledVector(tangent, x)
          .addScaledVector(up, y)
          .normalize()
          .toArray(),
        view.toArray(),
        sun.toArray(),
        1,
      );
    expect(sample(0, 0)).toBeGreaterThan(1.2);
    expect(sample(0.2, 0)).toBeGreaterThan(0.5);
    expect(sample(0, 0.2)).toBeGreaterThan(0.5);
    expect(sample(0.2, 0.2)).toBeLessThan(0.01);
    expect(
      fernsehturmSunReflection(n.toArray(), view.toArray(), sun.toArray(), 0),
    ).toBe(0);
    expect(
      fernsehturmSunReflection(n.toArray(), view.toArray(), [0, -1, 0], 1),
    ).toBe(0);
    expect(
      fernsehturmSunReflection(
        n.toArray(),
        view.clone().negate().toArray(),
        sun.toArray(),
        1,
      ),
    ).toBe(0);
    expect(
      fernsehturmSunReflection(
        n.toArray(),
        view.toArray(),
        sun.clone().negate().toArray(),
        1,
      ),
    ).toBe(0);
  });
  test("drawn and native shader use world surface positions, shared live uniforms and no extra pass", () => {
    for (const create of [
      createFernsehturmArchitecture,
      createMinecraftFernsehturmArchitecture,
    ]) {
      const root = create();
      let surfaces = 0;
      root.traverse((o) => {
        if (!(o instanceof Mesh) || !o.userData.sunReflectionSurface) return;
        surfaces++;
        const shader = {
          vertexShader: ShaderLib.basic.vertexShader,
          fragmentShader: ShaderLib.basic.fragmentShader,
          uniforms: {},
        } as any;
        o.userData.dayMaterial.onBeforeCompile(shader, {});
        expect(shader.vertexShader).toContain("instanceMatrix * tvVertex");
        expect(shader.fragmentShader).toContain(
          "cameraPosition - vFernsehturmWorld",
        );
        expect(shader.fragmentShader).toContain("fwidth(tvX)");
        expect(shader.fragmentShader).not.toContain("sampler2D fernsehturm");
        updateFernsehturmLighting(root, [0, 1, 0], 0);
        expect(shader.uniforms.fernsehturmDaylight.value).toBe(0);
        expect(shader.uniforms.fernsehturmSun.value.toArray()).toEqual([
          0, 1, 0,
        ]);
        updateFernsehturmLighting(root, new Vector3(1, 2, 3), 0.45);
        expect(shader.uniforms.fernsehturmDaylight.value).toBe(0.45);
        const dream = {
          vertexShader: ShaderLib.basic.vertexShader,
          fragmentShader: ShaderLib.basic.fragmentShader,
          uniforms: {},
        } as any;
        o.userData.schwellenraumMaterial.onBeforeCompile(dream, {});
        expect(dream.fragmentShader).toContain("tvGlint");
        expect(dream.fragmentShader).toContain("schwellenraumMuted");
        expect(dream.uniforms.fernsehturmDaylight).toBe(
          shader.uniforms.fernsehturmDaylight,
        );
      });
      expect(surfaces).toBe(1);
    }
  });
});
