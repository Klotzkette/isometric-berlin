import { describe, expect, test } from "bun:test";
import overrides from "./fixtures/static-native-model-overrides-v147.json";
import baseline from "./fixtures/static-native-models-v141.json";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";
import { createNativeAuditModel, nativeModelCases } from "./helpers/staticModelFactories";

describe("static-detail restoration preserves the existing native Minecraft models", () => {
  for (const entry of nativeModelCases) for (const profile of ["full", "mobile"] as const) {
    test(`${entry[0]} ${profile} matches the pre-restoration geometry and materials`, async () => {
      const module = await import(`../src/${entry[0]}.ts`);
      const root = createNativeAuditModel(module, entry, profile);
      expect(staticGeometryAudit(root)).toEqual(
        overrides[`${entry[0]}/${profile}` as keyof typeof overrides] ?? baseline[`${entry[0]}/${profile}` as keyof typeof baseline],
      );
      disposeStaticAudit(root);
    });
  }
});
