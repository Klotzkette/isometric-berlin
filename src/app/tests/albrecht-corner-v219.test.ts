import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { planFriedrichstrasseArchitecture, planFriedrichstrasseArchitectureV281Control, type FriedrichstrasseBlock } from "../src/FriedrichstrasseArchitecture";
import { ALBRECHT_CORNER_V219 as corner, FRIEDRICHSTRASSE_ARCHITECTURE_SOURCE as source } from "../src/friedrichstrasseArchitectureProfile";

const onFace = (b: FriedrichstrasseBlock) => b.sourceId === corner.sourceId && b.normal.every((n, i) => Math.abs(n - corner.normal[i]) < 1e-8);

describe("Albrechtstraße 12 photographed corner v219", () => {
  test("preserves the complete ordered v118 plan outside exactly one exterior edge", () => {
    // Captured before editing from c6f7f9d4, including all v218 additions.
    // The full v281 control preserves that plan before its two audited transfers.
    for (const [minecraft, mobileLike, expected] of [
      [false, false, "3c100bf4c3ac6e1b98332aa782cfc28ede88849068fb0e2b808abc5659015c8c"],
      [false, true, "3c100bf4c3ac6e1b98332aa782cfc28ede88849068fb0e2b808abc5659015c8c"],
      [true, false, "ecff86f2b110aed1fe8c61bf99ff30d81677efe58af04e662764ab9050aa4f19"],
      [true, true, "83bd84eecbe23074a63c873bedad6e906cf9c61ecec7774549dd436c529c353d"],
    ] as const) {
      const retained = planFriedrichstrasseArchitectureV281Control({ minecraft, mobileLike }).filter(b => !onFace(b));
      expect(createHash("sha256").update(JSON.stringify(retained)).digest("hex")).toBe(expected);
    }
  });

  test("has two divided axes, plain piers and one top terrace in both families", () => {
    for (const minecraft of [false, true]) {
      const plan = planFriedrichstrasseArchitecture({ minecraft });
      const details = plan.filter(b => b.role.startsWith("v219 "));
      expect(details).toHaveLength(118);
      expect(details.every(onFace)).toBeTrue();
      expect(plan.filter(onFace).some(b => b.role.includes("historic hood") || b.role.includes("historic shallow balcony"))).toBeFalse();
      expect(details.filter(b => b.role === "v219 Albrecht corner glazing")).toHaveLength(10);
      expect(details.filter(b => b.role === "v219 Albrecht corner fanlight")).toHaveLength(10);
      const terrace = details.filter(b => b.role === "v219 Albrecht single terrace parapet");
      expect(terrace).toHaveLength(2);
      expect(terrace[0].position[1]).toBe(terrace[1].position[1]);
      const owner = source.prisms.find(p => p.id === corner.sourceId)!;
      expect(details.every(b => b.position.every(Number.isFinite) && b.size.every(v => Number.isFinite(v) && v > 0) && b.position[1] - b.size[1] / 2 >= owner.y0_dm / 10 - .02 && b.position[1] + b.size[1] / 2 <= (owner.y0_dm + owner.h_dm) / 10)).toBeTrue();
      expect(planFriedrichstrasseArchitecture({ minecraft, mobileLike: true }).filter(onFace)).toEqual(plan.filter(onFace));
    }
  });
});
