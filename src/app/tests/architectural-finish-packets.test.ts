import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial, ShaderLib } from "three";
import { PackedArchitecturalFinish } from "../src/packedArchitecturalFinish";
import { presentArchitecturalSheen } from "../src/architecturalSheen";
import { buildCityChunkWithPaletteV362 } from "../src/SurroundingCityGeometry";

function compile(material: MeshBasicMaterial) {
  const shader = { ...ShaderLib.basic, uniforms: {} } as Parameters<typeof material.onBeforeCompile>[0];
  material.onBeforeCompile(shader, {} as Parameters<typeof material.onBeforeCompile>[1]);
  return shader;
}

test("sparse wall runs preserve indices in the upper half of a 32-bit uniform", () => {
  const marking = new PackedArchitecturalFinish();
  marking.mark(3, 1);
  marking.mark(300_001, 3);
  marking.mark(300_002, 3);
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(new BufferGeometry(), material);
  expect(marking.attach(mesh)).toBe(0);
  presentArchitecturalSheen(mesh, "day");
  const shader = compile(material);
  const runs = shader.uniforms.uArchitecturalRuns.value;
  expect(runs).toBeInstanceOf(Uint32Array);
  expect(Array.from(runs)).toEqual([3 * 8192, 300_001 * 8192 + 6, 0, 0]);
  expect(shader.uniforms.uArchitecturalRunCount.value).toBe(2);
  presentArchitecturalSheen(mesh, "night");
  expect(shader.uniforms.uArchitecturalSheen.value.length()).toBe(0);
});

test("a densely decorated part budgets one byte for each vertex and keeps gaps untouched", () => {
  const marking = new PackedArchitecturalFinish();
  const geometry = new BufferGeometry();
  const count = 1030;
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  for (let i = 0; i < count; i += 2) marking.mark(i, 4);
  expect(marking.attach(mesh)).toBe(count);
  expect(mesh.userData.architecturalRuns).toBeUndefined();
  const tags = geometry.getAttribute("architecturalFinishId");
  expect(tags.array).toEqual(Uint8Array.from({ length: count }, (_, i) => i % 2 ? 0 : 4));
  presentArchitecturalSheen(mesh, "day");
  expect(compile(mesh.material).vertexShader).toContain("architecturalStrength(architecturalFinishId)");
});

test("the model decoder preserves the IHZ geometry and limits its finish to its own paints", () => {
  const file = new URL("../src/data/ihzV241.json", import.meta.url);
  const { drawn } = JSON.parse(readFileSync(file, "utf8"));
  const build = (packet: typeof drawn) => {
    const steps = buildCityChunkWithPaletteV362(packet, drawn.id);
    let step = steps.next();
    while (!step.done) step = steps.next();
    return step.value;
  };
  const actual = build(drawn);
  const control = build({ ...drawn, meshes: drawn.meshes.map((part: object) => ({ ...part, kind: "unrelated" })) });
  const actualBody = actual.root.children.find(child => child instanceof Mesh) as Mesh;
  const otherBody = control.root.children.find(child => child instanceof Mesh) as Mesh;
  const tags = actualBody.geometry.getAttribute("architecturalFinishId");
  expect(tags).toBeDefined();
  expect(new Set(tags.array)).toEqual(new Set([0, 1, 2, 4]));
  expect(otherBody.geometry.hasAttribute("architecturalFinishId")).toBeFalse();
  expect(actual.geometryBytes - control.geometryBytes).toBe(tags.count);
  expect(actual.bufferCount - control.bufferCount).toBe(1);
  expect(actualBody.geometry.index!.array).toEqual(otherBody.geometry.index!.array);
  expect(actualBody.geometry.getAttribute("color").array).toEqual(otherBody.geometry.getAttribute("color").array);
});
