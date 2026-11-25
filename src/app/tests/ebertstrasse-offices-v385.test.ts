import { describe, expect, test } from "bun:test";
import { Color, Group, Mesh, Raycaster, Vector3 } from "three";
import { createDrawnEbertstrasseOffice } from "../src/EbertstrasseOfficeDrawnV385";
import { createNativeEbertstrasseOffices } from "../src/EbertstrasseOfficesV385";
import { ebertstrasseObstaclesV385, ebertstrasseTerracePrismV385, ebertstrasseTerraceTopV385 } from "../src/ebertstrasseOfficeOwnersV385";
import source from "../../../geo_data/regierungsviertel/ebertstrasse-offices-v385.json";
import { readFileSync } from "node:fs";

const fromWest = new Vector3(1,0,0), down = new Vector3(0,-1,0);
function hit(root: Group, x: number, y: number, z: number, direction: Vector3) {
  return new Raycaster(new Vector3(x,y,z),direction).intersectObject(root,true)
    .find(h => h.object instanceof Mesh);
}
function shade(h: ReturnType<typeof hit>) {
  if (!h?.face) throw Error("No painted facade");
  return new Color().fromBufferAttribute((h.object as Mesh).geometry.getAttribute("color"),h.face.a);
}
describe("Ebertstraße 15 and 15A", () => {
  test("only the seven matching raw parts and 45 local columns are brought down to their terrace decks", () => {
    const raw = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8"));
    const vox = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url),"utf8"));
    const target = new Set([...source.taylor.originalPrisms,...source.magenta.originalPrisms].map(p => p.id));
    const fitted = raw.buildings.filter((b: typeof source.taylor.originalPrisms[number]) => ebertstrasseTerracePrismV385(b) !== b);
    expect(fitted.map((b: {id:string})=>b.id).sort()).toEqual([...target].sort());
    let applied = 0;
    for (let j=0;j<vox.building_rows.length;j++) for(const [i,n,lo,hi,c] of vox.building_rows[j]) {
      const z=vox.grid.min_z_idx+j;
      if(z<210||z>224) continue;
      for(let col=0;col<n;col++) {
        const x=vox.grid.min_x_idx+i+col,top=ebertstrasseTerraceTopV385(x,z,lo,hi,c);
        if(top!==hi) {expect(top).toBe(226);applied++;}
      }
    }
    expect(applied).toBe(45);
    expect(ebertstrasseTerraceTopV385(92,213,46,285,3)).toBe(285);
    expect(ebertstrasseObstaclesV385("kLiMPpr6").length).toBe(6);
    expect(ebertstrasseObstaclesV385("IXQGNVGI").length).toBe(4);
    expect(ebertstrasseObstaclesV385("neighbour")).toEqual([]);
  });
  test("both roofs have open overhead sky beside the set-back occupied floor", () => {
    for (const native of [false,true]) {
      const root=native ? createNativeEbertstrasseOffices() : new Group().add(createDrawnEbertstrasseOffice("telekom","Telekom"),createDrawnEbertstrasseOffice("taylor","Taylor"));
      root.updateMatrixWorld(true);
      // Each ray is on the side deck inside the predecessor's full roof.
      expect(hit(root,366.85,31,885.10,down)).toBeUndefined();
      expect(hit(root,378,31,854,down)).toBeUndefined();
      expect(hit(root,378,31,884,down)?.point.y).toBeCloseTo(26.76,2);
      expect(hit(root,381,31,849,down)?.point.y).toBeCloseTo(25.88,2);
      // No legacy sign on the south wall or enclosed stone top at Ebertstraße.
      const glaze=hit(root,350,13,884.8,fromWest);
      expect(glaze?.point.x).toBeLessThan(native?364:365.4);
      const t=shade(glaze);expect(t.b).toBeGreaterThan(t.r);
    }
  });
  test("the western glass ribbon closes into aluminium at the photographed pinch, in each style", () => {
    for(const root of [createDrawnEbertstrasseOffice("telekom","Telekom"),createNativeEbertstrasseOffices()]){
      root.updateMatrixWorld(true);
      const glass=shade(hit(root,350,12.77,854.55,fromWest));
      const silver=shade(hit(root,350,12.77,862.7,fromWest));
      expect(glass.r).toBeLessThan(.3);
      expect(silver.r).toBeGreaterThan(.49);
      expect(glass.b).toBeGreaterThan(glass.r);
    }
  });
});
