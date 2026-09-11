import { describe, expect, test } from "bun:test";
import ts from "typescript";
import { Vector2, Vector3 } from "three";
import { isPedestrianJumpKey, isReservedBrowserChord } from "../src/keyboardShortcuts";
import {
  heldNavigationInput,
  holdNavigationKey,
  isPedestrianHighJumpDoubleActivation,
} from "../src/navigationInput";

const parse = async (name: string) => ts.createSourceFile(name,
  await Bun.file(new URL(`../src/${name}`, import.meta.url)).text(),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const app = await parse("App.tsx");
const viewer = await parse("ThreeViewer.tsx");

function findArrow(source: ts.SourceFile, name: string): ts.ArrowFunction {
  let result: ts.ArrowFunction | undefined;
  const visit = (node: ts.Node): void => {
    if ((ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) &&
      node.name.getText(source) === name && node.initializer && ts.isArrowFunction(node.initializer)) {
      result = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!result) throw new Error(`Missing actual ${name} handler`);
  return result;
}

function bind(source: ts.SourceFile, name: string, values: Record<string, unknown>) {
  const code = ts.transpileModule(`(${findArrow(source, name).getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(values), `return ${code}`)(...Object.values(values));
}

describe("walking keyboard focus and jump routing", () => {
  test("entering each world transfers button focus so Space jumps instead of toggling walking off", () => {
    for (const mode of ["day", "night", "snowstorm", "minecraft", "schwellenraum"]) {
      let focused: FocusTarget;
      class FocusTarget {
        isContentEditable = false;
        constructor(readonly tagName: string) {}
        focus(): void { focused = this; }
      }
      const canvas = new FocusTarget("CANVAS");
      const button = new FocusTarget("BUTTON");
      focused = button;
      const runtime = {
        lightingMode: mode, renderer: { domElement: canvas },
        ensurePedestrianWater: () => {},
      };
      const runtimeRef = { current: runtime };
      const enter = bind(viewer, "setPedestrianMode", {
        runtimeRef, pedestrianModeRef: { current: false },
        flightInputRef: { current: new Vector3() },
        panInputRef: { current: new Vector2() }, orbitInputRef: { current: new Vector2() },
        pedestrianInputRef: { current: {} }, PEDESTRIAN_IDLE_INPUT: {},
        activatePedestrianMode: () => true, deactivatePedestrianMode: () => true,
        emitPedestrianPose: () => {}, notifyView: () => {}, onViewChangeRef: { current: () => {} },
      });
      const jumps: boolean[] = [];
      let now = 1_000;
      const keyDown = bind(app, "handleKeyDown", {
        HTMLElement: FocusTarget, isReservedBrowserChord, isPedestrianJumpKey,
        isPedestrianMode: true, viewerMode: "three", isReferenceOpen: false,
        isHelpOpen: false, isRepositoryOpen: false, isReady: true,
        performance: { now: () => now }, lastPedestrianJumpActivationAtRef: { current: 0 },
        isPedestrianHighJumpDoubleActivation, triggerPedestrianJump: (higher: boolean) => jumps.push(higher),
      });
      let prevented = 0;
      const space = (repeat = false) => ({
        target: focused, key: " ", code: "Space", repeat,
        ctrlKey: false, metaKey: false, altKey: false,
        preventDefault: () => { prevented += 1; },
      });
      // Native buttons still keep their keyboard activation semantics.
      keyDown(space());
      expect(jumps).toHaveLength(0);
      expect(enter(true)).toBeTrue();
      expect(focused).toBe(canvas);
      keyDown(space());
      expect(jumps).toEqual([false]);
      keyDown(space(true));
      expect(jumps).toEqual([false]);
      now = 1_200;
      keyDown(space());
      expect(jumps).toEqual([false, true]);
      expect(prevented).toBe(3);

      button.focus();
      bind(viewer, "focusNavigation", { runtimeRef })();
      expect(focused).toBe(canvas);
    }
  });
});

describe("hover keyboard height and movement routing", () => {
  test("real keyboard handlers preserve movement and look while height keys change", () => {
    const heldFlightKeysRef = { current: new Set<string>() };
    let flight = { strafe: 0, forward: 0, vertical: 0 };
    let orbit = { horizontal: 0, vertical: 0 };
    let resets = 0;
    const updateHeldNavigation = bind(app, "updateHeldNavigation", {
      isPedestrianMode: false,
      heldFlightKeysRef,
      heldNavigationInput,
      setPanInput: () => {},
      setFlightInput: (strafe: number, forward: number, vertical: number) => {
        flight = { strafe, forward, vertical };
      },
      setOrbitInput: (horizontal: number, vertical: number) => {
        orbit = { horizontal, vertical };
      },
    });
    const navigationKey = bind(app, "navigationKey", { isPedestrianJumpKey });
    const keyDown = bind(app, "handleKeyDown", {
      HTMLElement: class {},
      isReservedBrowserChord,
      isPedestrianJumpKey,
      isPedestrianMode: false,
      isHelpOpen: false,
      isRepositoryOpen: false,
      isReady: true,
      navigationKey,
      heldFlightKeysRef,
      holdNavigationKey,
      updateHeldNavigation,
      language: "en",
      setStatus: () => {},
      resetToDefaultView: () => { resets += 1; },
    });
    const keyUp = bind(app, "handleKeyUp", {
      navigationKey,
      NAVIGATION_KEYS: ["Shift", "Space", "w", "a", "ArrowUp", "ArrowRight"],
      heldFlightKeysRef,
      updateHeldNavigation,
    });
    const event = (key: string, shiftKey = false, repeat = false) => ({
      key,
      code: key === " " ? "Space" : "",
      shiftKey,
      repeat,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target: null,
      preventDefault: () => {},
    });

    keyDown(event("w"));
    keyDown(event("Shift", true));
    keyDown(event("A", true));
    keyDown(event("ArrowUp", true));
    expect(flight).toEqual({ strafe: -1, forward: 1, vertical: -1 });
    expect(orbit).toEqual({ horizontal: 0, vertical: 1 });
    keyDown(event("W", true, true));
    expect(flight.vertical).toBe(-1);

    keyDown(event(" ", true));
    expect(flight).toEqual({ strafe: -1, forward: 1, vertical: 0 });
    keyUp(event("Shift"));
    keyDown(event("ArrowRight"));
    expect(flight).toEqual({ strafe: -1, forward: 1, vertical: 1 });
    expect(orbit).toEqual({ horizontal: 1, vertical: 1 });
    keyUp(event(" "));
    expect(flight).toEqual({ strafe: -1, forward: 1, vertical: 0 });

    for (const key of ["w", "a", "ArrowUp", "ArrowRight"]) keyUp(event(key));
    expect(flight).toEqual({ strafe: 0, forward: 0, vertical: 0 });
    expect(orbit).toEqual({ horizontal: 0, vertical: 0 });
    expect(resets).toBe(0);
  });
});
