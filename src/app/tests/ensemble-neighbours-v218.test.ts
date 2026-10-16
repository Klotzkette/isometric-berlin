import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { planFriedrichstrasseArchitecture } from "../src/FriedrichstrasseArchitecture";
import { ENSEMBLE_NEIGHBOUR_REFINEMENT_V218 as profile, FRIEDRICHSTRASSE_ARCHITECTURE_SOURCE as source } from "../src/friedrichstrasseArchitectureProfile";

describe("v218 Berliner Ensemble neighbours", () => {
  test("retains previous detail outside the documented Neues Haus and v219 corner corrections", () => {
    const retained = planFriedrichstrasseArchitecture().filter(b => b.sourceId !== profile.neuesHausFront.sourceId && !b.role.startsWith("v218 ") && !(b.sourceId === "adrXN9LM" && Math.abs(b.normal[0] - .664363838829922) < 1e-8 && Math.abs(b.normal[1] - .7474093186836577) < 1e-8));
    // Re-captured before v219 from immutable v118, excluding only its one
    // corrected face. The dedicated v219 test freezes the complete complement.
    expect(createHash("sha256").update(JSON.stringify(retained)).digest("hex"))
      .toBe("1d65fa9b2d6383581aa89c76dcc1c90ba6a1a8727a7b98559f62be9d065e10af");
  });

  test("keeps full drawn detail on touch and restricts additions to named owners", () => {
    const plan = planFriedrichstrasseArchitecture();
    expect(planFriedrichstrasseArchitecture({ mobileLike: true })).toEqual(plan);
    const ids = new Set(source.profiles.filter(p => (profile.frontages as readonly string[]).includes(p.key)).flatMap(p => p.ids));
    const details = plan.filter(b => b.role.startsWith("v218 "));
    expect(details.length).toBeGreaterThan(300);
    expect(details.length).toBeLessThan(450);
    expect(details.every(b => ids.has(b.sourceId))).toBeTrue();
    const brick = details.filter(b => b.role.includes("Albrechtstrasse"));
    expect(brick.length).toBeGreaterThan(40);
    expect(brick.every(b => b.normal[0] < -.75)).toBeTrue();
  });

  test("golden court facade and entry survive in drawn and native profiles", () => {
    for (const minecraft of [false, true]) for (const mobileLike of [false, true]) {
      const plan = planFriedrichstrasseArchitecture({ minecraft, mobileLike });
      const facade = plan.filter(b => b.role.startsWith("Neues Haus ") || ["lettering NEUES", "lettering HAUS"].includes(b.role));
      expect(facade.every(b => b.sourceId === profile.neuesHausFront.sourceId)).toBeTrue();
      expect(facade.filter(b => b.role === "Neues Haus golden screen field")).toHaveLength(9);
      expect(facade.filter(b => b.role === "Neues Haus recessed foyer glazing")).toHaveLength(9);
      expect(facade.some(b => b.role === "lettering NEUES")).toBeTrue();
      expect(facade.some(b => b.role === "lettering HAUS")).toBeTrue();
      expect(facade.every(b => b.position.every(Number.isFinite) && b.size.every(v => Number.isFinite(v) && v > 0))).toBeTrue();
      const envelope = source.prisms.find(p => p.id === profile.neuesHausFront.sourceId)!;
      expect(facade.every(b => b.position[1] - b.size[1] / 2 >= envelope.y0_dm / 10 - .05 && b.position[1] + b.size[1] / 2 <= (envelope.y0_dm + envelope.h_dm) / 10)).toBeTrue();
      expect(plan.filter(b => b.role === "v218 Albrechtstrasse triangular window hood").length).toBeGreaterThan(0);
    }
  });
});
