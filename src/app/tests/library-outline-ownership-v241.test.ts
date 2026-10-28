import { expect, test } from "bun:test";
import { createOutlineLandmarksV182, disposeOutlineConstruction } from "../src/OutlineLandmarksV182";
import { createLibrariesV202, LIBRARIES_V202_GROUP } from "../src/LibrariesV202";
import { outlineSignature } from "./helpers/outlineConstructionSignature";

for (const enabled of [false, true]) test(`library ownership ${enabled ? "required production" : "standalone default"} survives mode changes`, () => {
  const root = enabled ? createOutlineLandmarksV182("day", undefined, { architectureV241: true })
    : createOutlineLandmarksV182("day");
  try {
    for (const mode of ["day", "minecraft", "day"] as const) {
      root.userData.setMode(mode);
      const libraries = root.children.filter(child => child.name.startsWith(LIBRARIES_V202_GROUP));
      expect(libraries).toHaveLength(enabled ? 0 : 1);
      if (!enabled) {
        const reference = createLibrariesV202(mode === "minecraft");
        try { expect(outlineSignature(libraries[0])).toEqual(outlineSignature(reference)); }
        finally { disposeOutlineConstruction(reference); }
        const index = root.children.indexOf(libraries[0]);
        expect(root.children[index - 1].name).toContain("Central");
        expect(root.children[index + 1].name).toContain("Pergamon");
      }
    }
  } finally { disposeOutlineConstruction(root); }
}, 60000);

test("lazy production caller explicitly transfers library ownership through both wrappers", async () => {
  const outer = await Bun.file(new URL("../src/OuterThinOutlines.ts", import.meta.url)).text();
  const viewer = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
  expect(outer).toContain("createOutlineLandmarksV182Steps(mode, beforeLandmarkRelease, ownership)");
  expect(outer).toContain("createOuterThinOutlinesSteps(mode, beforeLandmarkRelease, ownership)");
  expect(viewer).toContain("}, { architectureV241: true, bayerCampusV277: true }), {");
});
