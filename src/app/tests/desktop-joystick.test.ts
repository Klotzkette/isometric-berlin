import { describe, expect, test } from "bun:test";
import { MathUtils, Vector2, Vector3 } from "three";
import ts from "typescript";
import { createPedestrianState, PEDESTRIAN_IDLE_INPUT, stepPedestrian } from "../src/pedestrianNavigation";

const appText = await Bun.file(new URL("../src/App.tsx", import.meta.url)).text();
const viewerText = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const styles = await Bun.file(new URL("../src/styles.css", import.meta.url)).text();
const app = ts.createSourceFile("App.tsx", appText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const viewer = ts.createSourceFile("ThreeViewer.tsx", viewerText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function matchingNodes<T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] {
  const matches: T[] = [];
  const visit = (node: ts.Node): void => {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return matches;
}

// Execute the actual small input adapters, with their runtime refs supplied,
// rather than reproducing their mappings in the test or loading WebGL/React.
function evaluateArrow(source: ts.SourceFile, arrow: ts.ArrowFunction, bindings: Record<string, unknown>): (...args: number[]) => void {
  const compiled = ts.transpileModule(`(${arrow.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(bindings), `return ${compiled}`)(...Object.values(bindings));
}

describe("shared desktop and mobile movement joystick", () => {
  test("the only joystick drives actual flight/walking input without changing orbit or look", () => {
    const pads = matchingNodes(app, ts.isJsxSelfClosingElement)
      .filter((node) => node.tagName.getText(app) === "FlightJoystick");
    expect(pads).toHaveLength(1);
    const input = pads[0].attributes.properties.find((node) =>
      ts.isJsxAttribute(node) && node.name.getText(app) === "onInput") as ts.JsxAttribute;
    const padArrow = (input.initializer as ts.JsxExpression).expression as ts.ArrowFunction;
    const appAdapter = matchingNodes(app, ts.isVariableDeclaration)
      .find((node) => node.name.getText(app) === "setFlightInput")!;
    const appArrow = (appAdapter.initializer as ts.CallExpression).arguments[0] as ts.ArrowFunction;
    const viewerAdapter = matchingNodes(viewer, ts.isPropertyAssignment)
      .find((node) => node.name.getText(viewer) === "setFlightInput")!;
    const viewerArrow = viewerAdapter.initializer as ts.ArrowFunction;

    for (const walking of [false, true]) {
      const flightInputRef = { current: new Vector3() };
      const orbitInputRef = { current: new Vector2(0.2, -0.3) };
      const pedestrianInputRef = { current: { ...PEDESTRIAN_IDLE_INPUT } };
      const handle = evaluateArrow(viewer, viewerArrow, {
        MathUtils, flightInputRef, orbitInputRef, pedestrianInputRef,
        runtimeRef: { current: { pedestrian: { enabled: walking } } },
        markSurfaceInteraction: () => {},
      });
      const setFlightInput = evaluateArrow(app, appArrow, {
        setIsTouring: () => {}, threeViewerRef: { current: { setFlightInput: handle } },
      });
      const padInput = evaluateArrow(app, padArrow, {
        setFlightInput,
        setOrbitInput: () => { throw new Error("Joystick must not orbit"); },
      });
      for (const [strafe, forward] of [[0, 1], [0, -1], [-1, 0], [1, 0], [0.3, 0.6], [0, 0]]) {
        padInput(strafe, forward);
        expect(orbitInputRef.current.toArray()).toEqual([0.2, -0.3]);
        expect(pedestrianInputRef.current.turn).toBe(0);
        expect(pedestrianInputRef.current.look).toBe(0);
        if (walking) {
          expect(flightInputRef.current.toArray()).toEqual([0, 0, 0]);
          const environment = { bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, groundAt: () => 4, water: [] };
          const state = createPedestrianState(environment, { x: 0, z: 0, yaw: 0 });
          const moved = stepPedestrian(state, pedestrianInputRef.current, 0.04, environment).state;
          expect(Math.sign(moved.x)).toBe(Math.sign(strafe));
          expect(Math.sign(-moved.z) || 0).toBe(Math.sign(forward));
          expect(moved.yaw).toBe(0);
        } else {
          expect(flightInputRef.current.toArray()).toEqual([strafe, 0, forward]);
        }
      }
    }
  });

  test("keeps pointer release, cancellation, mode resets and the distinct mouse/touch shortcuts", () => {
    const control = appText.slice(appText.indexOf("function FlightJoystick("), appText.indexOf("function HoldControlButton("));
    expect(control).toContain("inputRef.current(0, 0)");
    expect(control).toContain("[disabled, resetKey, touchDoubleTapEnabled, release]");
    expect(control).toContain('event.pointerType === "mouse" &&');
    expect(control).toContain('window.addEventListener("blur", reset)');
    expect(control).toContain('document.addEventListener("visibilitychange", visibility)');
    for (const event of ["onPointerUp", "onPointerCancel", "onLostPointerCapture"]) {
      const handler = control.slice(control.indexOf(`${event}=`));
      expect(handler).toContain("release();");
    }
    const padStart = appText.indexOf("<FlightJoystick");
    const pad = appText.slice(padStart, appText.indexOf("<PedestrianMiniMap", padStart));
    expect(pad).toContain("resetKey={lightingMode}");
    expect(pad).toContain("isPedestrianMode ? togglePedestrianSprint : undefined");
    expect(pad).toContain("isPedestrianMode ? () => triggerPedestrianJump() : undefined");
    expect(pad).not.toContain("setOrbitInput");
  });

  test("one wrapper retains desktop, compact, touch and mirrored dock placements", () => {
    expect(styles).not.toContain("orbit-joystick");
    const desktop = styles.slice(styles.indexOf(".flight-joystick-wrap {"), styles.indexOf(".pedestrian-jump-button {"));
    expect(desktop).toContain("display: block");
    expect(desktop).toContain("left: 306px");
    expect(desktop).toContain("right: 306px");
    expect(desktop).toContain("--joystick-size: 82px");
    const compact = styles.slice(styles.indexOf("@media (max-width: 1024px) {", styles.indexOf(".app-shell--pedestrian .three-canvas:active")), styles.indexOf(".flight-joystick {", styles.indexOf(".app-shell--pedestrian .three-canvas:active")));
    expect(compact).toContain("left: 14px");
    expect(compact).toContain("right: 14px");
    expect(compact).toContain("--joystick-size: 108px");
    expect(compact).toContain("env(safe-area-inset-bottom, 0px)");
    expect(styles).toContain("width: 128px");
    expect(styles).toContain("left: 442px");
    expect(styles).toContain("right: 442px");
  });
});
