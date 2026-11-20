import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Raycaster, Vector3 } from "three";
import { createHumboldthafenRailV369, hasDrawnHumboldthafenV369, hasNativeHumboldthafenV369, isReplacedHumboldthafenPierV369, restoreHumboldthafenWaterV369 } from "../src/HumboldthafenRailV369";
import { createRailNetwork, type RailPayload } from "../src/RailNetwork";
import { replaceEuropacityRailPayloadV313 } from "../src/EuropacityRailV313";
import { hbfLocalToWorldV291, hbfRailCurveAtV291, HBF_CIRCULATION_V291 } from "../src/HbfCirculationV291";
import type { VoxelPayload } from "../src/terrainPayload";
import { bridgeClusters } from "../src/IsometricCityWorld";
import groundJson from "../public/mesh/regierungsviertel/ground-context.json";
import railJson from "../public/mesh/regierungsviertel/rail-lines.json";
import voxelsJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import data from "../src/data/humboldthafenRailV369.json";

const rail = railJson as unknown as RailPayload, voxels = voxelsJson as unknown as VoxelPayload;
const deck = rail.deck_top_y_m, water = voxels.water_top_y_m;
const active = replaceEuropacityRailPayloadV313(rail)!;

describe("Humboldthafenbrücke, east of Hauptbahnhof", () => {
  test("the active rail owner replaces only the seven generated harbour columns and retains the land frames", () => {
    expect(hasDrawnHumboldthafenV369(active)).toBe(true);
    expect(active.piers.filter(([x,z]) => isReplacedHumboldthafenPierV369(x,z))).toEqual(data.retiredPiersDm);
    const group = createRailNetwork(active,voxels)!;
    expect(group.userData.hbfEastSteelSupportCount).toBe(4);
    expect(group.getObjectByName("Humboldthafenbrücke • eight steel tube ribs v369")).toBeDefined();
    const drift = {...active, piers:active.piers.filter(([x,z])=>x!==266 || z!==-7169)};
    expect(hasDrawnHumboldthafenV369(drift)).toBe(false);
    expect(createRailNetwork(drift,voxels)!.getObjectByName("Humboldthafenbrücke • eight steel tube ribs v369")).toBeUndefined();
  });

  test("the 16 measured bearing seats span the two foundations and leave a shipping opening in both families", () => {
    expect(data.foundations.map(f=>f.id)).toEqual(["DEBE00YYYK0000EX","DEBE00YYYK0000Ek"]);
    expect(new Set(data.bearings.flat().map(b=>b.id)).size).toBe(16);
    for(let i=0;i<8;i++) expect(data.bearings[1][i].center[0]-data.bearings[0][i].center[0]).toBeCloseTo(60,-1);
    for(const native of [false,true]) {
      const group = createHumboldthafenRailV369(deck,water,native);
      group.updateMatrixWorld(true);
      for(const x of [55,65,75]) {
        const channel = new Raycaster(new Vector3(x,water+4,-648), new Vector3(0,0,-1), 0,80);
        expect(channel.intersectObject(group,true)).toHaveLength(0);
      }
      for(const footing of data.bearings.flat()) {
        const [x,z]=footing.center;
        const up = new Raycaster(new Vector3(x, water+1.42,z),new Vector3(0,1,0),0,4);
        expect(up.intersectObject(group,true).length).toBeGreaterThan(0);
      }
      const tube = group.getObjectByName("Humboldthafen paired arch tubes, spandrels and cross ties") as InstancedMesh;
      expect(tube.geometry.type).toBe(native ? "BoxGeometry" : "CylinderGeometry");
      const m = new Matrix4();
      if(native) for(const child of group.children as InstancedMesh[]) {
        let largestSkew = 0;
        for(let i=0;i<child.count;i++) {
          child.getMatrixAt(i,m);
          for(const k of [1,2,4,6,8,9]) largestSkew = Math.max(largestSkew,Math.abs(m.elements[k]));
        }
        expect(largestSkew).toBe(0);
      } else {
        tube.getMatrixAt(2,m);
        expect(new Vector3().setFromMatrixScale(m).x).toBeCloseTo(.66,5);
      }
    }
  });

  test("only ground cells previously labelled bridge inside mapped harbour water are restored",()=>{
    expect(hasNativeHumboldthafenV369(voxels)).toBe(true);
    const fresh=restoreHumboldthafenWaterV369(voxels), oldClass=voxels.classes.indexOf("bridge"), newClass=voxels.classes.indexOf("water");
    expect(fresh.building_rows).toBe(voxels.building_rows);
    let changes=0;
    for(let z=0;z<voxels.ground_rows.length;z++) {
      const expected=data.waterRows[String(z) as keyof typeof data.waterRows];
      if(!expected) { if(fresh.ground_rows[z]!==voxels.ground_rows[z]) throw Error("Unexpected terrain copy"); continue; }
      const expand=(row: number[][])=>row.flatMap(([a,n,c])=>Array.from({length:n},(_,i)=>[a+i,c]));
      const before=new Map(expand(voxels.ground_rows[z]).map(([x,c])=>[x,c]));
      const after=new Map(expand(fresh.ground_rows[z]).map(([x,c])=>[x,c]));
      const changed=Array.from(before).filter(([x,c])=>c!==after.get(x));
      expect(changed.map(([x])=>x)).toEqual(expected);
      expect(changed.every(([x,c])=>c===oldClass && after.get(x)===newClass)).toBe(true);
      changes+=changed.length;
    }
    expect(changes).toBe(398);
    const drift={...voxels,grid:{...voxels.grid,min_x_idx:voxels.grid.min_x_idx+1}};
    expect(restoreHumboldthafenWaterV369(drift)).toBe(drift);
  });

  test("the shared raster bridge owner gives up exactly this low-level rail deck on the deployed Drawn ground packet", () => {
    const ground=groundJson as unknown as VoxelPayload;
    expect(hasNativeHumboldthafenV369(ground)).toBe(false);
    const fresh=restoreHumboldthafenWaterV369(ground, false);
    const oldClusters=bridgeClusters(ground), next=bridgeClusters(fresh);
    const cells=new Set(Object.entries(data.waterRows).flatMap(([z,xs])=>xs.map(x=>[x,+z].join(","))));
    const cluster=oldClusters.find(row=>row.length===cells.size && row.every(p=>cells.has(p.join(","))));
    expect(cluster?.length).toBe(398);
    expect(next).toEqual(oldClusters.filter(row=>row!==cluster));
  });

  test("all six Native railheads meet their retained station ends and eastern elevated cells",()=>{
    const group=createHumboldthafenRailV369(deck,water,true);
    const bed=group.getObjectByName("Humboldthafen cardinal bed, bearings and rails") as InstancedMesh;
    group.updateMatrixWorld(true);
    const top=(x:number,z:number)=>{
      const down=new Raycaster(new Vector3(x,25,z),new Vector3(0,-1,0),0,25);
      return down.intersectObject(bed)[0]?.point.y ?? -Infinity;
    };
    for(const [i,track] of data.tracks.entries()) {
      const offset=HBF_CIRCULATION_V291.upperTrackCentresLocalZ[i];
      const [x,y,z]=hbfLocalToWorldV291([163.8,10.53,hbfRailCurveAtV291(163.8)+offset]);
      for(const side of [-.72,.72]) expect(top(x+.04,z+side)).toBeCloseTo(y+.25,2);
      const landing=track.landing;
      for(const side of [-.72,.72]) expect(Math.abs(top(landing.x-.1,track.points.at(-1)![1]+side) - (landing.top+.235))).toBeLessThan(.02);
      for(const at of [90,115,150,180]) {
        const last=track.points.findIndex(p=>p[0]>=at), a=track.points[last-1], b=track.points[last];
        const zz=a[1]+(b[1]-a[1])*(at-a[0])/(b[0]-a[0]);
        expect(top(at,zz)).toBeGreaterThan(14.7);
      }
    }
  });
});
