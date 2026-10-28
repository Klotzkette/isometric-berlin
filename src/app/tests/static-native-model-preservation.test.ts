import { describe, expect, test } from "bun:test";
import overridesV218 from "./fixtures/static-native-model-overrides-v218.json";
import overridesV219 from "./fixtures/static-native-model-overrides-v219.json";
import auditV219 from "./fixtures/minecraft-world-v219-baseline-audit.json";
import overridesV166 from "./fixtures/static-native-model-overrides-v166.json";
import overridesV204 from "./fixtures/static-native-model-overrides-v204.json";
import overridesV148 from "./fixtures/static-native-model-overrides-v148.json";
import overridesV157 from "./fixtures/static-native-model-overrides-v157.json";
import overrides from "./fixtures/static-native-model-overrides-v147.json";
import baseline from "./fixtures/static-native-models-v141.json";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";
import { createNativeAuditModel, nativeModelCases } from "./helpers/staticModelFactories";
import { auditRohwedderBeforeV281, auditTopographyBeforeV281 } from "./helpers/rohwedderTopographyV281Replay";

describe("static-detail restoration preserves the existing native Minecraft models", () => {
  test("v219 native overrides retain the exact v218 chain and both profile budgets", () => {
    expect(Object.keys(overridesV219)).toEqual([
      "FriedrichstrasseArchitecture/full", "FriedrichstrasseArchitecture/mobile",
      "LuisenCorridorArchitecture/full", "LuisenCorridorArchitecture/mobile",
    ]);
    for (const key of Object.keys(overridesV219) as (keyof typeof overridesV219)[]) {
      expect(auditV219.static.native.before[key]).toEqual(overridesV218[key]);
      expect(auditV219.static.native.current[key]).toEqual(overridesV219[key]);
      const before = overridesV218[key].budget, current = overridesV219[key].budget;
      const delta = key.startsWith("FriedrichstrasseArchitecture/") ? 58 : -2;
      expect(current.instances - before.instances).toBe(delta);
      expect(current.bytes - before.bytes).toBe(delta * 76);
      expect(current.draws).toBe(before.draws);
      expect(current.vertices).toBe(before.vertices);
    }
  });
  for (const entry of nativeModelCases) for (const profile of ["full", "mobile"] as const) {
    test(`${entry[0]} ${profile} matches the pre-restoration geometry and materials`, async () => {
      const module = await import(`../src/${entry[0]}.ts`);
      const root = createNativeAuditModel(module, entry, profile);
      const observed = entry[0] === "FriedrichstrasseArchitecture"
        ? (await import("./helpers/friedrichstrasseV281Replay")).auditFriedrichstrasseBeforeV281(root, profile)
        : entry[0] === "RohwedderHausArchitecture" ? auditRohwedderBeforeV281(root, profile, true)
        : entry[0] === "TopographyTerrorArchitecture" ? auditTopographyBeforeV281(root, profile, true)
        : entry[0] === "FriedrichstadtPalastDetails"
        ? (await import("./helpers/palastV274Replay")).auditPalastBeforeV274(root, profile)
        : staticGeometryAudit(root);
      expect(observed).toEqual(
        // v281 restores exactly 99 retired generic-grid rows for this audit;
        // every live retained byte still has to reproduce the full old hash.
        // v219 changes only the two exact corners; its immutable v118 capture
        // reproduces all four v218 native baselines, which remain frozen.
        // v218 refines only source-verified Ensemble/Luisen street fronts.
        // Independent HEAD factory audits still match the frozen v141 baselines;
        // exact owner/edge preservation is covered by the dedicated v218 tests.
        // v204 splits the exact same MuseumTriad instance rows into two owners.
        // pergamon-reveal.test.ts compares all four unordered pre-v204 buffer
        // content snapshots; bytes, instances and geometry vertices are unchanged.
        // v166 records the independently reproduced v160/v165 MuseumLenne baseline.
        // See docs/native-museum-preservation-v166.md; historical fixtures remain intact.
        overridesV219[`${entry[0]}/${profile}` as keyof typeof overridesV219] ?? overridesV218[`${entry[0]}/${profile}` as keyof typeof overridesV218] ?? overridesV204[`${entry[0]}/${profile}` as keyof typeof overridesV204] ?? overridesV166[`${entry[0]}/${profile}` as keyof typeof overridesV166] ?? overridesV157[`${entry[0]}/${profile}` as keyof typeof overridesV157] ?? overridesV148[`${entry[0]}/${profile}` as keyof typeof overridesV148] ?? overrides[`${entry[0]}/${profile}` as keyof typeof overrides] ?? baseline[`${entry[0]}/${profile}` as keyof typeof baseline],
      );
      disposeStaticAudit(root);
    });
  }
});
