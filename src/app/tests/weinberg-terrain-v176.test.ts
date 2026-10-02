import { describe, expect, test } from "bun:test";
import {
  drapeTerrainTriangle, nativeTerrainOffset, terrainGroundAt, terrainOffset,
} from "../src/weinbergTerrainV176";
import { surroundingScopeGroundAt } from "../src/surroundingCityScope";
import { surroundingBuildingSolidAt, type SurroundingNavigation } from "../src/SurroundingCityGeometry";

const area = (t: readonly (readonly number[])[]) => (
  (t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[2][0]-t[0][0])*(t[1][2]-t[0][2])
) / 2;

describe("Weinbergsweg to Zionskirche actual terrain", () => {
  test("cold-start walking sees the surveyed 16.4 metre rise", () => {
    const lower = surroundingScopeGroundAt(2049.95, -1157.12)!;
    const upper = surroundingScopeGroundAt(2231.897, -1706.217)!;
    expect(lower).toBeCloseTo(7.12, 0);
    expect(upper).toBeCloseTo(23.52, 0);
    expect(upper - lower).toBeCloseTo(16.4, 0);
    const route = [[2076.09,-1209.44],[2183.45,-1400.91],[2266.59,-1534.38],[2231.897,-1706.217]];
    for (let i=1;i<route.length;i++) expect(terrainGroundAt(...route[i] as [number,number])).toBeGreaterThan(terrainGroundAt(...route[i-1] as [number,number]));
  });

  test("outside geography and the pre-existing core remain unchanged", () => {
    for (const [x,z] of [[0,0],[1820,-1600],[2600,-1700],[2250,-2100],[2200,-1000],[1850,-1050]]) {
      expect(terrainOffset(x,z)).toBe(0);
      expect(terrainGroundAt(x,z,5.245)).toBe(5.245);
    }
  });

  test("surface subdivision keeps exact XZ coverage, winding and layer separation", () => {
    for (const triangle of [
      [[1820,3,-2060],[2570,3,-1750],[2140,3,-1000]],
      [[2013,3,-1521],[2154,3,-1445],[2244,3,-1688]],
      [[5,3,5],[10,3,5],[10,3,10]],
    ]) {
      const result = drapeTerrainTriangle(triangle);
      expect(result.reduce((sum,t)=>sum+area(t),0)).toBeCloseTo(area(triangle),5);
      for (const t of result) {
        expect(Math.sign(area(t))).toBe(Math.sign(area(triangle)));
        for (const [x,y,z] of t) expect(y).toBeCloseTo(3+terrainOffset(x,z),8);
        const [x,y,z] = [0,1,2].map(axis=>t.reduce((sum,p)=>sum+p[axis],0)/3);
        expect(y).toBeCloseTo(3+terrainOffset(x,z),6);
      }
      const raised = drapeTerrainTriangle(triangle.map(([x,y,z])=>[x,y+.12,z]));
      expect(raised.length).toBe(result.length);
      raised.forEach((t,i)=>t.forEach((p,j)=>expect(p[1]-result[i][j][1]).toBeCloseTo(.12,8)));
    }
  });

  test("the Plansche floor stays below its horizontal water surface", () => {
    for (const native of [false, true]) {
      expect(terrainGroundAt(2132.98,-1408.45,3,native)).toBe(12.4);
      expect(terrainGroundAt(2132.98,-1408.45,3,native)).toBeGreaterThan(12);
    }
  });

  test("native terrain is flat within each visible terrace and available before loading", () => {
    const height = nativeTerrainOffset(2180.2,-1483.8);
    expect(nativeTerrainOffset(2183.8,-1480.2)).toBe(height);
    expect(surroundingScopeGroundAt(2180.2,-1483.8,true)).toBe(3+height);
  });

  test("raised source buildings collide at their new height while courtyards stay open", () => {
    const nav:SurroundingNavigation = {groundY:3,ground:[],water:[],buildings:[{
      sourceId:"fixture",minHeight:0,height:20,groundOffset:16,
      ring:[[0,0],[20,0],[20,20],[0,20]],holes:[[[5,5],[15,5],[15,15],[5,15]]],
    }]};
    expect(surroundingBuildingSolidAt(nav,2,20,2)).toBe(true);
    expect(surroundingBuildingSolidAt(nav,2,5,2)).toBe(false);
    expect(surroundingBuildingSolidAt(nav,10,20,10)).toBe(false);
    expect(surroundingBuildingSolidAt(nav,2,40,2)).toBe(false);
  });
});
