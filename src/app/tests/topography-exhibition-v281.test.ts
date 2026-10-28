import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Mesh, Raycaster, Vector3 } from "three";
import { createTopographyTerrorArchitecture, planTopographyTerror } from "../src/TopographyTerrorArchitecture";
import { TOPOGRAPHY_EXHIBITION_CHAPTERS_V281 as colors, TOPOGRAPHY_EXHIBITION_ROLE_V281 as prefix } from "../src/TopographyExhibitionV281";

// Captured before replacing only the 24 authored white panel proxies. These
// snapshots include every museum, Wall, 72 trench segments, canopy and cellar.
const hashes = {
  drawn: "5eb3281b7e0555895b13214b0423dde00d709e1007c7873f022388fdb528a1af",
  native: "2e738938a85149466697733e57498c649198006dd9fe10a30076537b00eb19cf",
  nativeMobile: "523112c2a75b02d5787296c399c860d15bb372bd8cd21920ccada67766bed76e",
};
describe("v281 open Topography exhibition glazing", () => {
  for (const minecraft of [false, true]) for (const mobileLike of [false, true]) {
    test(`${minecraft ? "native" : "drawn"} ${mobileLike ? "mobile" : "full"} preserves every unrelated block and all source structure`, () => {
      const blocks = planTopographyTerror({ minecraft, mobileLike });
      const other = blocks.filter(b => !b.role.startsWith(prefix));
      expect(createHash("sha256").update(JSON.stringify(other)).digest("hex")).toBe(hashes[minecraft ? mobileLike ? "nativeMobile" : "native" : "drawn"]);
      expect(blocks.filter(b => b.solid)).toHaveLength(941);
      expect(blocks.some(b => b.role === "plain exhibition panel field")).toBeFalse();
      for (const role of ["mapped archaeological trench floor", "archaeological retained wall relief", "trench protective glass canopy", "trench roof transverse frame"])
        expect(blocks.filter(b => b.role === role)).toHaveLength(72);
      const panels = blocks.filter(b => b.role.startsWith(prefix));
      expect(panels).toHaveLength(24 * 8);
      expect(panels.filter(b => b.role === prefix + "chapter marker").map(b => b.color)).toEqual([...colors]);
      expect(panels.every(b => !b.glass && !b.solid)).toBeTrue();
      if (minecraft) expect(panels.every(b => b.yaw === 0)).toBeTrue();
      expect(panels).toEqual(planTopographyTerror({ minecraft, mobileLike: !mobileLike }).filter(b => b.role.startsWith(prefix)));
    });
    test(`${minecraft ? "native" : "drawn"} ${mobileLike ? "mobile" : "full"} actual rendered panels leave clear excavation views`, () => {
      const root = createTopographyTerrorArchitecture({ minecraft, mobileLike, diagnostics: true });
      root.updateMatrixWorld(true);
      const panels = planTopographyTerror({ minecraft, mobileLike }).filter(b => b.role.startsWith(prefix));
      for (let i = 0; i < panels.length; i += 8) {
        const parts = panels.slice(i, i + 8), uprights = parts.filter(b => b.role === prefix + "frame upright");
        const center = new Vector3(...uprights[0].position).add(new Vector3(...uprights[1].position)).multiplyScalar(.5);
        const normal = new Vector3(Math.sin(uprights[0].yaw), 0, Math.cos(uprights[0].yaw));
        expect(new Raycaster(center.clone().addScaledVector(normal, .2), normal.clone().negate(), 0, .4).intersectObject(root, true)).toHaveLength(0);
        // Conservative summed projected occupancy, including complete frame
        // rectangles: at least 65% of every panel remains geometrically empty.
        const width = uprights[0].position.slice(0, 3).reduce((s, v, j) => j === 1 ? s : s + (v - uprights[1].position[j]) ** 2, 0) ** .5 + uprights[0].size[0];
        const opaque = parts.filter(b => b.role !== prefix + "suspension rod").reduce((s, b) => s + b.size[0] * b.size[1], 0);
        expect(opaque / (width * uprights[0].size[1])).toBeLessThan(.35);
      }
      let renderables = 0;
      root.traverse(o => { if (o instanceof Mesh) renderables++; });
      expect(renderables).toBeLessThanOrEqual(11);
    });
  }
});
