import { expect, spyOn, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, Line, LineSegments,
  Material, Mesh, MeshBasicMaterial, Object3D, Points,
} from "three";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import { disposeSurroundingCityRoot as publicDisposer } from "../src/SurroundingCity";
import { buildAltMitteCoreV169Steps, type AltMitteCoreV169Source } from "../src/AltMitteCoreV169";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { freezeStaticSceneTransforms } from "../src/staticSceneTransforms";

const published = "264fa95b6f73ad6759edfe28134ab043a510407c";
const oldSource = (path: string) => execFileSync("git", ["show", `${published}:src/app/src/${path}`],
  { cwd: new URL("../../..", import.meta.url), encoding: "utf8" });
function declaration(source: string, name: string) {
  const ast = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  if (!node) throw Error(`Missing published function ${name}`);
  return node.getText(ast);
}
function executable(source: string, name: string, bindings: Record<string, unknown>) {
  const code = ts.transpileModule(declaration(source, name).replace(/^export\s+/, ""),
    { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(bindings), `${code}\nreturn ${name};`)(...Object.values(bindings));
}
const originalDisposer = executable(oldSource("SurroundingCity.ts"), "disposeSurroundingCityRoot",
  { InstancedMesh, Material, Mesh, Line, Points }) as typeof disposeSurroundingCityRoot;

test("the shared utility preserves the exact published body and public function identity", () => {
  const source = readFileSync(new URL("../src/disposeSurroundingCityRootV323.ts", import.meta.url), "utf8");
  expect(declaration(source, "disposeSurroundingCityRoot")).toBe(declaration(oldSource("SurroundingCity.ts"), "disposeSurroundingCityRoot"));
  expect(publicDisposer).toBe(disposeSurroundingCityRoot);
  const ast = ts.createSourceFile("utility.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  expect(ast.statements.filter(ts.isImportDeclaration).map(node => (node.moduleSpecifier as ts.StringLiteral).text)).toEqual(["three"]);
  const core = readFileSync(new URL("../src/AltMitteCoreV169.ts", import.meta.url), "utf8");
  expect(declaration(core, "buildAltMitteCoreV169Steps")).toBe(declaration(oldSource("AltMitteCoreV169.ts"), "buildAltMitteCoreV169Steps"));
});

function rootFixture() {
  const root = new Group(), trace: string[] = [], geometries: BufferGeometry[] = [];
  const geometry = (name: string) => {
    const value = new BufferGeometry().setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    value.addEventListener("dispose", () => trace.push(`geometry:${name}`)); geometries.push(value); return value;
  };
  const material = (name: string) => { const value = new MeshBasicMaterial(); value.addEventListener("dispose", () => trace.push(`material:${name}`)); return value; };
  const shared = geometry("shared"), pointGeometry = geometry("points"), a = material("a"), b = material("b"), extra = material("extra"), ignored = material("non-render-object");
  const mesh = new Mesh(shared, a), multi = new Mesh(shared, [a, b]), instances = new InstancedMesh(shared, a, 1), line = new LineSegments(shared, b), points = new Points(pointGeometry, a), other = new Object3D();
  instances.addEventListener("dispose", () => trace.push("instances"));
  mesh.userData.nightMaterial = extra; instances.userData.nightMaterial = extra; points.userData.dayMaterial = b; other.userData.material = ignored;
  for (const [label, object] of [["root", root], ["mesh", mesh], ["other", other]] as const) object.userData.disposeZooAnimalsV282 = () => trace.push(`zoo:${label}`);
  root.add(mesh, multi, instances, line, points, other);
  return { root, trace, geometries, arrays: geometries.map(g => g.getAttribute("position").array), a, b, extra, ignored };
}
test("shared geometry visits, deduplicated materials, userdata, Zoo callbacks and all render kinds match published203", () => {
  const current = rootFixture(), original = rootFixture();
  disposeSurroundingCityRoot(current.root); originalDisposer(original.root);
  expect(current.trace).toEqual(original.trace);
  expect(current.trace.filter(item => item === "geometry:shared")).toHaveLength(4);
  expect(current.trace.filter(item => item === "instances")).toHaveLength(1);
  for (const name of ["a", "b", "extra"]) expect(current.trace.filter(item => item === `material:${name}`)).toHaveLength(1);
  expect(current.trace).not.toContain("material:non-render-object");
  expect(current.trace.filter(item => item.startsWith("zoo:"))).toEqual(["zoo:root", "zoo:mesh", "zoo:other"]);
  expect(current.root.children).toHaveLength(0); expect(original.root.children).toHaveLength(0);
  current.geometries.forEach((g, i) => expect(g.getAttribute("position").array).toBe(current.arrays[i]));
  current.ignored.dispose(); original.ignored.dispose();
});

const encode = (array: Uint8Array | Uint16Array | Uint32Array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");
function packet(x: number): SurroundingCityChunk {
  return { schemaVersion: 1, origin: [x, -10, -128], meshes: [{ kind: "source-shell", positionType: "u16cm",
    positions: encode(new Uint16Array([0, 1500, 0, 3200, 2500, 0, 0, 1500, 3200])),
    colors: encode(new Uint8Array([120, 140, 150, 120, 140, 150, 120, 140, 150])),
    indices: encode(new Uint32Array([0, 1, 2])) }], lines: { positions: encode(new Uint16Array([0, 1500, 0, 3200, 2500, 0])) },
    nav: { groundY: 5.2, ground: [], water: [], buildings: [] } };
}
const source: AltMitteCoreV169Source = { schemaVersion: 1, sourceParents: [{ id: "fixture-official-family" }],
  drawnChunks: [{ id: "west", packet: packet(128) }, { id: "east", packet: packet(1024) }],
  minecraftChunks: [{ id: "west", packet: packet(128) }, { id: "east", packet: packet(1024) }] };
const oldBuild = executable(oldSource("AltMitteCoreV169.ts"), "buildAltMitteCoreV169Steps", {
  Group, buildSurroundingCityChunk, freezeStaticSceneTransforms, disposeSurroundingCityRoot: originalDisposer,
  ALT_MITTE_V169_GROUP: "Alt-Mitte complete resident source envelopes", ALT_MITTE_V169_NATIVE_GROUP: "Alt-Mitte complete resident native source envelopes",
}) as typeof buildAltMitteCoreV169Steps;
function cancellationTrace(build: typeof buildAltMitteCoreV169Steps, stop: number, native: boolean) {
  const trace: string[] = [], geometry = spyOn(BufferGeometry.prototype, "dispose").mockImplementation(function (this: BufferGeometry) {
    trace.push(`geometry:${this.getAttribute("position")?.count}:${this.index?.count ?? 0}`);
  }), material = spyOn(Material.prototype, "dispose").mockImplementation(function (this: Material) { trace.push(`material:${this.type}`); });
  const steps = build(source, native);
  try { for (let i = 0; i < stop; i++) if (steps.next().done) throw Error("Unexpected complete fixture"); steps.return(undefined as never); return trace; }
  finally { steps.return(undefined as never); geometry.mockRestore(); material.mockRestore(); }
}
test("actual packet cancellation at every checkpoint retains the original Drawn and Native cleanup", () => {
  for (const native of [false, true]) {
    const steps = buildAltMitteCoreV169Steps(source, native); let step = steps.next(), checkpoints = 0;
    while (!step.done) { checkpoints++; step = steps.next(); }
    disposeSurroundingCityRoot(step.value);
    expect(checkpoints).toBeGreaterThan(2);
    for (let stop = 1; stop <= checkpoints; stop++) expect(cancellationTrace(buildAltMitteCoreV169Steps, stop, native)).toEqual(cancellationTrace(oldBuild, stop, native));
  }
});
