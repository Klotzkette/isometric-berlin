import { expect, test } from "bun:test";
import { InstancedMesh, Mesh, ShaderLib, type MeshBasicMaterial } from "three";
import { createSourceStreetSurfaces, type StreetSource } from "../src/DistrictStreets";
import { kerbStoneCourses, presentKerbStoneFinish } from "../src/kerbStoneFinish";
import { createBoulevardTransportV210 } from "../src/BoulevardTransportV210";
import type { VisualMode } from "../src/visualMode";
import type { VoxelPayload } from "../src/terrainPayload";
import groundSource from "../public/mesh/regierungsviertel/ground-context.json";
import hbf from "../src/data/hbfStreetDetailsV252.json";
import realm from "../src/data/reichstagPublicRealmV256.json";
import mitte from "../src/data/mitteRoadsV343.json";

test("stone stations follow bends, repeated points, gaps and the closing joint of a ring", () => {
  const source: StreetSource = { surfaces: [], curbs_m: [
    [[1050,0],[1053,0],[1053,0],[1053,4],[1050,0]], [], [[1060,0],[1062,0]],
    [[1070,0],[6070,0]],
  ], markings_m: [], elevated_path_ids: [], source: {} };
  const group = createSourceStreetSurfaces(groundSource as VoxelPayload, source, "corner");
  const kerb = group.getObjectByName("District raised kerbstones") as Mesh;
  const profile = kerb.geometry.getAttribute("kerbStation");
  const scale = kerb.userData.kerbStoneScale;
  expect(profile.array).toBeInstanceOf(Uint16Array);
  expect(profile.count).toBe(kerb.geometry.getAttribute("position").count);
  for (const [i, expected] of [0,3,3,7,12,0,2,0,5000].entries()) {
    const value = profile.getX(i * 4);
    expect(Math.abs((value - 1) * scale - expected)).toBeLessThanOrEqual(scale / 2);
    for (let corner = 1; corner < 4; corner++) expect(profile.getX(i * 4 + corner)).toBe(value);
  }
  expect(profile.getX(8 * 4)).toBeLessThanOrEqual(65535);
  expect(kerb.geometry.index!.count).toBe(6 * 18);
});

test("authored joint locations retain their own laying patterns", () => {
  const locations = [
    ...hbf.curbCaps.flatMap(line => line.points),
    ...realm.boxes.slice(realm.counts.drawnFountainMembers).map(row => [row[0],row[2]]),
    ...mitte.kerbSeams.flat(),
  ];
  const lines = locations.map(([x,z]) => [[x,z],[x+0.01,z]] as [number,number][]);
  expect(kerbStoneCourses(lines, lines.length * 2).attribute.array.some(Number)).toBeFalse();
});

test("only the daytime kerbstone material uses the profile", () => {
  const source: StreetSource = { surfaces: [], curbs_m: [[[1000,5],[1006,4]]],
    markings_m: [], elevated_path_ids: [], source: {} };
  const group = createSourceStreetSurfaces(groundSource as VoxelPayload, source, "curb");
  const kerb = group.getObjectByName("District raised kerbstones") as Mesh;
  const day = kerb.userData.dayMaterial as MeshBasicMaterial;
  presentKerbStoneFinish(kerb,"day");
  const shader = { ...ShaderLib.basic, uniforms: {} } as Parameters<typeof day.onBeforeCompile>[0];
  day.onBeforeCompile(shader, {} as Parameters<typeof day.onBeforeCompile>[1]);
  expect(shader.vertexShader).toContain("gl_VertexID % 4");
  expect(shader.fragmentShader).toContain("fwidth(course)");
  expect(shader.uniforms.kerbStoneEnabled.value).toBe(1);
  const version = day.version;
  for (const mode of ["night","flood","minecraft","snowstorm","schwellenraum"] as VisualMode[]) {
    presentKerbStoneFinish(kerb,mode);
    expect(shader.uniforms.kerbStoneEnabled.value).toBe(0);
    presentKerbStoneFinish(kerb,"day");
    expect(shader.uniforms.kerbStoneEnabled.value).toBe(1);
  }
  expect(day.version).toBe(version);
  expect(kerb.userData.nightMaterial.customProgramCacheKey()).not.toContain("kerb-stone-course");
});

test("boulevard boxes use their own cross-section while the native street keeps its block materials", () => {
  for (const native of [false, true]) {
    const group = createBoulevardTransportV210(native);
    const curb = group.children.find(object => object.name.startsWith("Retained asphalt boundary curbs")) as InstancedMesh;
    expect(curb.count).toBeGreaterThan(0);
    const material = curb.userData.dayMaterial as MeshBasicMaterial;
    presentKerbStoneFinish(curb, "day");
    expect(material.customProgramCacheKey().includes("kerb-stone-box")).toBe(!native);
    expect(curb.geometry.hasAttribute("kerbStation")).toBeFalse();
    if (!native) {
      const shader = { ...ShaderLib.basic, uniforms: {} } as Parameters<typeof material.onBeforeCompile>[0];
      material.onBeforeCompile(shader, {} as Parameters<typeof material.onBeforeCompile>[1]);
      expect(shader.vertexShader).toContain("position.z + 0.5");
      expect(shader.vertexShader).not.toContain("kerbStation");
    }
  }
});
