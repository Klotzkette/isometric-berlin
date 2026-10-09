import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import evidence from "../src/data/bendlerblockV202Evidence.json";
import data from "../src/data/bendlerblockV202.json";
import nav from "../src/data/bendlerblockV202Navigation.json";
import { createBendlerblockV202 } from "../src/BendlerblockV202";
import {
  bendlerblockV202GroundAt, bendlerblockV202PassageAt, bendlerblockV202RoofAt,
  BENDLERBLOCK_V202_PRISM_IDS, isBendlerblockV202ReplacedColumn,
} from "../src/bendlerblockV202Profile";

describe("Bendlerblock exact replacement and open approaches", () => {
  test("source ownership and native suppression require exact IDs and heights", () => {
    expect(BENDLERBLOCK_V202_PRISM_IDS.size).toBe(9);
    expect(nav.parts).toHaveLength(10);
    for (const [x,z,bottom,top] of nav.columns) {
      expect(isBendlerblockV202ReplacedColumn(x,z,bottom,top)).toBe(true);
      expect(isBendlerblockV202ReplacedColumn(x,z,bottom,top+1)).toBe(false);
      expect(isBendlerblockV202ReplacedColumn(x+.1,z,bottom,top)).toBe(false);
    }
    expect(isBendlerblockV202ReplacedColumn(0,0,5.2,30)).toBe(false);
  });

  test("all three passages remain open only below their lintels and within the named owners", () => {
    for (const p of nav.passages) {
      const x=(p.a[0]+p.b[0])/2, z=(p.a[1]+p.b[1])/2;
      expect(bendlerblockV202PassageAt(x,6.9,z)).toBe(true);
      expect(bendlerblockV202PassageAt(x,5.2+p.height,z)).toBe(false);
      expect(bendlerblockV202PassageAt(x,6.9,z,"unrelated-building")).toBe(false);
      expect(bendlerblockV202GroundAt(x,z,5.2)).toBe(5.30);
    }
    expect(bendlerblockV202GroundAt(0,0,5.2)).toBeNull();
  });

  test("exact roof triangles interpolate to the measured source plane", () => {
    for (const part of nav.parts) {
      const triangle = part.roofTriangles.find(t => Math.abs((t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0])) > 1);
      if (!triangle) continue;
      const p=[0,1,2].map(i => triangle.reduce((sum,q) => sum+q[i],0)/3);
      expect(bendlerblockV202RoofAt(p[0],p[2])).toBeGreaterThanOrEqual(p[1]-.001);
    }
    expect(bendlerblockV202RoofAt(-641.563,1214.09)).toBeNull();
  });

  test("native roof support matches actual stepped source skin without changing drawn roofs", () => {
    const root=createBendlerblockV202(true);root.updateMatrixWorld(true);
    const points=[[-816.669667,1360.886], ...nav.parts.map(part=>{
      const t=part.roofTriangles[0];return [t.reduce((s,p)=>s+p[0],0)/3,t.reduce((s,p)=>s+p[2],0)/3];
    })];
    const obstacles=compilePedestrianObstacles({buildings:evidence.previousOwners},()=>"minecraft");
    for(const [x,z] of points){
      const hit=new Raycaster(new Vector3(x,100,z),new Vector3(0,-1,0)).intersectObject(root,true)[0];
      expect(hit).toBeDefined();
      const roof=bendlerblockV202RoofAt(x,z,true)!;
      expect(roof).toBeCloseTo(hit.point.y,4);
      expect(pedestrianPointIsBlocked(x,z,roof,obstacles)).toBeFalse();
    }
    expect(bendlerblockV202RoofAt(-816.669667,1360.886,true)).toBe(30);
    expect(bendlerblockV202RoofAt(-816.669667,1360.886)).toBeCloseTo(28.287,2);
  });

  test("bounded independent native geometry contains no rotated or textured bodies", () => {
    const roots = [createBendlerblockV202(),createBendlerblockV202(true)];
    expect(roots[0].children).toHaveLength(3);
    expect(roots[1].children).toHaveLength(1);
    for (const root of roots) {
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      let bytes=0;
      for (const child of root.children) {
        const mesh=child as Mesh;
        expect(mesh.matrixAutoUpdate).toBe(false);
        expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
        expect(mesh.userData.dayMaterial.map).toBeNull();
        for (const a of Object.values(mesh.geometry.attributes)) bytes+=a.array.byteLength;
        bytes+=mesh.geometry.index?.array.byteLength??0;
        if (mesh instanceof InstancedMesh) bytes+=mesh.instanceMatrix.array.byteLength+mesh.instanceColor!.array.byteLength;
      }
      expect(bytes).toBeLessThan(4*1024*1024);
    }
    const native=roots[1].children[0] as InstancedMesh;
    expect(native.count).toBe(data.blocks.length);
    for(let i=0;i<native.count;i++) for(const j of [1,2,4,6,8,9]) expect(native.instanceMatrix.array[i*16+j]).toBe(0);
  });
});
