import { expect, test } from "bun:test";
import ts from "typescript";
import { Group, PerspectiveCamera, Vector3 } from "three";
import { GALLERY_FLIGHT_START_V223 } from "../src/startupView";

const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let initialNavigation: ts.IfStatement | undefined;
const visit = (node: ts.Node) => {
  if (ts.isIfStatement(node) && node.expression.getText(parsed) === "initialNavigationRef.current" &&
      node.thenStatement.getText(parsed).includes("restoreNavigationSnapshot(runtime,")) initialNavigation = node;
  node.forEachChild(visit);
};
visit(parsed);
if (!initialNavigation) throw new Error("Missing production initial camera handover");
const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const seed = new Function("runtime", "initialNavigationRef", "initialFlightStartRef", "initialWalkingStartRef",
  "GALLERY_FLIGHT_START_V223", "restoreNavigationSnapshot", "setModelMaterialState", "setEnvironmentalPresentation",
  "applyPedestrianCamera", "notifyView", "onViewChangeRef", compile(initialNavigation.getText(parsed)));

function runtime() {
  return { camera: new PerspectiveCamera(39), controls: { target: new Vector3() }, marker: { visible: true },
    pedestrian: { enabled: false, requested: false, state: null }, navigationRestored: false };
}
const noop = () => {};

test("ordinary gallery flight is seeded before loading without enabling pedestrian state", () => {
  const value = runtime();
  seed(value, { current: null }, { current: true }, { current: false }, GALLERY_FLIGHT_START_V223,
    () => { throw new Error("Unexpected snapshot restore"); }, noop, noop, noop, noop, { current: noop });
  expect(value.camera.position.toArray()).toEqual(GALLERY_FLIGHT_START_V223.pose.position);
  expect(value.controls.target.toArray()).toEqual(GALLERY_FLIGHT_START_V223.pose.target);
  expect(value.camera.fov).toBe(GALLERY_FLIGHT_START_V223.fov);
  expect(value.pedestrian).toEqual({ enabled: false, requested: false, state: null });
  expect(value.marker.visible).toBeFalse();
});

test("a saved recovery pose takes precedence over the default flight seed", () => {
  const value = runtime(), snapshot = { position: [123, 456, 789] as [number, number, number] };
  seed(value, { current: snapshot }, { current: true }, { current: false }, GALLERY_FLIGHT_START_V223,
    (target: ReturnType<typeof runtime>, saved: typeof snapshot) => target.camera.position.fromArray(saved.position),
    noop, noop, noop, noop, { current: noop });
  expect(value.camera.position.toArray()).toEqual(snapshot.position);
  expect(value.navigationRestored).toBeTrue();
});

test("the ordinary flight arrival waits for the real gallery owner before revealing", () => {
  const declaration = parsed.statements.find(node => ts.isFunctionDeclaration(node) &&
    node.name?.text === "notifyPresentationReadyWhenPossible");
  if (!declaration) throw new Error("Missing production presentation gate");
  const notify = new Function("startupCurtainMayOpen", "currentStartupPresentationStatus", "startSurroundingCity",
    `${compile(declaration.getText(parsed))}; return notifyPresentationReadyWhenPossible;`);
  let starts = 0, ready = 0;
  const gate = notify(() => true, () => "ready", () => { starts++; });
  const value = { disposed: false, contextLost: false, presentationReady: false, openingDetailReady: true,
    openingGalleryRequired: true, outerThinOutlines: null as Group | null, notifyPresentationReady: () => { ready++; } };
  gate(value);
  expect(starts).toBe(1);
  expect(ready).toBe(0);
  expect(value.presentationReady).toBeFalse();
  value.outerThinOutlines = new Group();
  gate(value);
  expect(ready).toBe(1);
  expect(value.presentationReady).toBeTrue();
});
