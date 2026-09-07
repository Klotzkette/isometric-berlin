import { describe, expect, test } from "bun:test";
import ts from "typescript";
import { Vector2, Vector3 } from "three";
import { isPedestrianJumpKey, isReservedBrowserChord } from "../src/keyboardShortcuts";
import { isPedestrianHighJumpDoubleActivation } from "../src/navigationInput";

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
