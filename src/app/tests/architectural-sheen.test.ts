import { expect, test } from "bun:test";
import {
  BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShaderLib,
} from "three";
import { presentArchitecturalSheen } from "../src/architecturalSheen";
import { createDomAltesMuseum } from "../src/DomAltesMuseum";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { installFlatUnlitShader } from "../src/drawnBuildings";
import type { VisualMode } from "../src/visualMode";

function compile(material: MeshBasicMaterial | MeshStandardMaterial) {
  const source = material instanceof MeshBasicMaterial ? ShaderLib.basic : ShaderLib.standard;
  const shader = { vertexShader: source.vertexShader, fragmentShader: source.fragmentShader, uniforms: {} } as Parameters<typeof material.onBeforeCompile>[0];
  material.onBeforeCompile(shader, {} as Parameters<typeof material.onBeforeCompile>[1]);
  return shader;
}

test("five authored copper cupolas receive the same daylight finish through the city entry point", () => {
  const museum = createDomAltesMuseum();
  const domes = museum.children.filter((mesh): mesh is Mesh<never, MeshBasicMaterial> =>
    mesh instanceof Mesh && mesh.name.includes("copper") && mesh.name.includes("cupola"));
  expect(domes).toHaveLength(5);
  const originalColors = domes.map(mesh => mesh.material.color.getHex());
  const objects = museum.children.length;
  setIsoNightPresentation(museum, false, true, "day");
  for (const mesh of domes) {
    const shader = compile(mesh.material);
    expect(shader.uniforms.uArchitecturalSheen.value.y).toBeGreaterThan(0);
    expect(shader.fragmentShader).toContain("reflect(-eye, n)");
  }
  expect(museum.children.length).toBe(objects);
  expect(domes.map(mesh => mesh.material.color.getHex())).toEqual(originalColors);
  setIsoNightPresentation(museum, false, true, "flood");
  for (const mesh of domes) expect(compile(mesh.material).uniforms.uArchitecturalSheen.value.length()).toBe(0);
});

test("the same compact mesh and live shader survive all surface mode switches", () => {
  const geometry = new BoxGeometry();
  geometry.deleteAttribute("normal");
  const material = new MeshBasicMaterial({ color: 0x557788, opacity: .32, transparent: true });
  const mesh = new Mesh(geometry, material);
  mesh.name = "LoD2 glass prisms";
  presentArchitecturalSheen(mesh, "day");
  const shader = compile(material);
  expect(shader.vertexShader).toContain("#include <project_vertex>\nvArchitecturalView = mvPosition.xyz");
  const strength = shader.uniforms.uArchitecturalSheen.value;
  const day = strength.clone();
  const version = material.version;
  for (const mode of ["night", "minecraft", "flood", "schwellenraum", "snowstorm"] as VisualMode[]) {
    presentArchitecturalSheen(mesh, mode);
    expect(strength.length()).toBe(0);
    presentArchitecturalSheen(mesh, "day");
    expect(strength.equals(day)).toBeTrue();
  }
  expect(material.version).toBe(version);
  expect(material.opacity).toBe(.32);
  expect(mesh.geometry).toBe(geometry);
  expect(geometry.hasAttribute("normal")).toBeFalse();
});

test("the finish follows authored albedo and leaves unselected materials alone", () => {
  const material = new MeshStandardMaterial(), mesh = new Mesh(new BoxGeometry(), material);
  installFlatUnlitShader(material);
  const oldHook = material.onBeforeCompile;
  for (const name of ["Fernsehturm steel sphere", "Hauptbahnhof vector signage", "tiergarten paving"]) {
    mesh.name = name;
    presentArchitecturalSheen(mesh, "day");
    expect(material.onBeforeCompile).toBe(oldHook);
  }
  mesh.name = "Brandenburg Gate pavilion patinated gable roof";
  presentArchitecturalSheen(mesh, "snowstorm");
  expect(material.onBeforeCompile).toBe(oldHook);
  presentArchitecturalSheen(mesh, "day");
  const shader = compile(material);
  expect(shader.uniforms.uFlatUnlit).toBeDefined();
  expect(shader.uniforms.uArchitecturalSheen).toBeDefined();
  expect(shader.fragmentShader.indexOf("vec3 flatAlbedo")).toBeLessThan(shader.fragmentShader.indexOf("vec3 plane ="));
  expect(shader.fragmentShader.indexOf("vec3 plane =")).toBeLessThan(shader.fragmentShader.indexOf("#include <opaque_fragment>"));
});
