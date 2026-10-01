import { expect, test } from "bun:test";
import ts from "typescript";
import {
  BoxGeometry, BufferGeometry, Group, InstancedMesh, Line, LineBasicMaterial,
  LineLoop, LineSegments, Material, Mesh, Points, PointsMaterial, Scene, Texture,
  UnsignedByteType, WebGLRenderTarget,
} from "three";
import { createSnowstorm } from "../src/SnowstormEffects";
import { preservedBackbufferRequired, stableWebglMemoryProfile } from "../src/renderQuality";
import { objectMaterialsIncludingTransferredAlternates } from "../src/transferableObject3D";
import {
  createMinecraftMaterialState, releaseMinecraftMaterialBindings,
} from "../src/visual-modes/minecraft/materialMode";

const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const disposal = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "disposeObject3D");
if (!disposal) throw new Error("Missing production viewer disposal");
const compiled = ts.transpileModule(disposal.getText(parsed), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const bindings = {
  Mesh, InstancedMesh, Line, Points, Material, Texture,
  objectMaterialsIncludingTransferredAlternates, releaseMinecraftMaterialBindings,
};
const dispose = new Function(...Object.keys(bindings), `${compiled}; return disposeObject3D;`)(...Object.values(bindings));

function disposalHost(root: Group | Scene) {
  let released: Group | Scene | undefined;
  const runtime = {
    gpuWarmup: { release: (value: typeof root) => { released = value; } },
    minecraftMaterialState: createMinecraftMaterialState(),
    schwellenraumTowerSteam: null,
  };
  return { run: () => dispose(runtime, root), get released() { return released; } };
}

function disposals(resource: BufferGeometry | Material | Texture): () => number {
  let count = 0;
  (resource as Material).addEventListener("dispose", () => { count++; });
  return () => count;
}

test("viewer teardown frees shared line/point buffers, alternate materials and images exactly once", () => {
  const root = new Group();
  const parent = new Scene(); parent.add(root);
  const geometry = new BoxGeometry();
  let imageCloses = 0;
  const texture = new Texture({ close: () => { imageCloses++; } });
  const assigned = new PointsMaterial({ map: texture });
  const alternate = new PointsMaterial({ map: texture });
  const lineMaterial = new LineBasicMaterial();
  const points = new Points(geometry, [assigned, assigned]);
  points.userData.dayMaterial = assigned;
  points.userData.nightMaterial = alternate;
  const line = new Line(geometry, lineMaterial);
  line.userData.dayMaterial = lineMaterial;
  line.userData.schwellenraumMaterial = alternate;
  root.add(points, line, new LineSegments(geometry, lineMaterial), new LineLoop(geometry, lineMaterial));
  root.visible = false;
  const counts = [geometry, texture, assigned, alternate, lineMaterial].map(disposals);
  expect(objectMaterialsIncludingTransferredAlternates(points)).toEqual([assigned, alternate]);
  expect(objectMaterialsIncludingTransferredAlternates(line)).toEqual([lineMaterial, alternate]);
  const host = disposalHost(root);
  host.run();
  expect(host.released).toBe(root);
  expect(counts.map(count => count())).toEqual([1, 1, 1, 1, 1]);
  expect(imageCloses).toBe(1);
  expect(root.children).toHaveLength(0);
  expect(root.parent).toBeNull();
  expect(parent.children).toHaveLength(0);
  host.run();
  expect(counts.map(count => count())).toEqual([1, 1, 1, 1, 1]);
  expect(imageCloses).toBe(1);
});

test("production mobile snowfall retires its Points geometry, material and procedural texture", () => {
  const snow = createSnowstorm(true);
  const points = snow.air.children.find(object => object instanceof Points) as Points;
  expect(points).toBeInstanceOf(Points);
  expect(snow.flakeMaterial.map).toBeInstanceOf(Texture);
  const geometryCount = disposals(points.geometry);
  const materialCount = disposals(snow.flakeMaterial);
  const textureCount = disposals(snow.flakeMaterial.map!);
  disposalHost(snow.group).run();
  expect([geometryCount(), materialCount(), textureCount()]).toEqual([1, 1, 1]);
  expect(snow.group.children).toHaveLength(0);
});

test("only the final canvas loses its unused depth attachment; city targets retain depth", () => {
  let rendererOptions: ts.Expression | undefined;
  let target: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isNewExpression(node) && node.expression.getText(parsed) === "WebGLRenderer") {
      rendererOptions = node.arguments?.[0];
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === "composerTarget") target = node.initializer;
    node.forEachChild(visit);
  };
  visit(parsed);
  if (!rendererOptions || !target) throw new Error("Missing production render targets");
  const evaluate = new Function("webglMemoryProfile", "preservedBackbufferRequired", "navigator", "WebGLRenderTarget", "UnsignedByteType",
    `return { options: (${rendererOptions.getText(parsed)}), city: (${target.getText(parsed)}) };`);
  for (const coarsePointer of [true, false]) {
    const result = evaluate(stableWebglMemoryProfile(coarsePointer), preservedBackbufferRequired,
      { userAgent: "iPhone Safari" }, WebGLRenderTarget, UnsignedByteType);
    expect(result.options.depth).toBe(false);
    expect(result.options.preserveDrawingBuffer).toBe(true);
    expect(result.city.depthBuffer).toBe(true);
    expect(result.city.clone().depthBuffer).toBe(true);
    expect(result.city.samples).toBe(0);
    expect(result.city.texture.type).toBe(UnsignedByteType);
    result.city.dispose();
  }
});
