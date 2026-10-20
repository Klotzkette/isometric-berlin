import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Matrix4, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import data from "../src/data/danzigerTramV249.json";
import { appendDanzigerTramV249, finishDanzigerTramV249, danzigerTramGroundAtV249, danzigerTramSolidAtV249 } from "../src/DanzigerTramV249";
import { terrainGroundAt } from "../src/weinbergTerrainV176";
import { justicePalaceV183Boxes } from "../src/justicePalaceV183Batches";
import { createNorthV185 } from "../src/NorthV185";
import { appendNorthShopfrontsV254 } from "../src/NorthShopfrontsV254";

describe("Danziger v249 additive tram batch", () => {
  for (const native of [false,true]) {
    test(`${native ? "native" : "drawn"}: complete eastern rails follow actual retained terrain`, () => {
      const rows: number[][] = []; appendDanzigerTramV249(rows,native);
      const mesh = justicePalaceV183Boxes(rows,native);
      finishDanzigerTramV249(mesh,rows,native);
      const paths = native ? data.nativeRails : data.rails;
      const matrix = new Matrix4(), point = new Vector3();
      let index = 0, raised = 0;
      for (const path of paths) for (let j=1;j<path.length;j++,index++) {
        const a = path[j-1], b = path[j], row = rows[index];
        mesh.getMatrixAt(index,matrix);
        const expected = terrainGroundAt(row[0],row[2],3,native)+.20;
        expect(matrix.elements[13]).toBeCloseTo(expected,3);
        if (expected > 4) raised++;
        if (!native) for (const [p,side] of [[a,-1],[b,1]] as const) {
          // Remove the 15mm overlap beyond the exact source segment endpoints.
          point.set(side*.5*(row[3]-.015)/row[3],0,0).applyMatrix4(matrix);
          expect(point.x).toBeCloseTo(p[0],3);
          expect(point.z).toBeCloseTo(p[1],3);
          expect(point.y).toBeCloseTo(terrainGroundAt(p[0],p[1])+.20,4);
        }
      }
      expect(raised).toBeGreaterThan(100);
      // The actual existing Husemann floor is flat in both independent modes.
      for (const [x,z] of [[3292,-2224],[3262,-2281],[3229,-2290]])
        expect(terrainGroundAt(x,z,3,native)).toBe(3);
      mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); mesh.userData.nightMaterial.dispose();
    });

    test(`${native ? "native" : "drawn"}: existing rows retained, no extra batch, finite geometry`, () => {
      const prefix = [1,2,3,4,5,6,...(native ? [0xaaaaaa] : [0,0xaaaaaa])];
      const rows = [prefix]; appendDanzigerTramV249(rows,native);
      expect(rows[0]).toBe(prefix); expect(prefix[0]).toBe(1);
      expect(rows.length-1).toBe(native ? data.counts.nativeRows : data.counts.drawnRows);
      const root = createNorthV185(native);
      const meshes = root.children.filter(m => m.userData.northV185 === "hagenauer");
      expect(meshes.length).toBe(1);
      const count = (meshes[0] as ReturnType<typeof justicePalaceV183Boxes>).count;
      // Exact pre-v249 matrix/colour receipts, read independently from HEAD's
      // constructor. Old geometry must be a byte-identical complete prefix.
      const oldCount = native ? 2283 : 1370;
      const shops: number[][] = []; appendNorthShopfrontsV254(shops, native);
      expect(count).toBe(oldCount+shops.length+rows.length-1);
      const mesh = meshes[0] as ReturnType<typeof justicePalaceV183Boxes>;
      const hash = createHash("sha256");
      for (const [attribute,width] of [[mesh.instanceMatrix,16],[mesh.instanceColor!,3]] as const) {
        hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,oldCount*width*4));
      }
      expect(hash.digest("hex")).toBe(native ?
        "9826a49fe2d10a9cc00df9a15ab4c229205daa1efcce477ce7ef4c2d862e40ad" :
        "5c5ed927bece5eebac408bb273e0ae65b02d1fdb504556dd046d090029d78c72");
      // The complete v249 tail remains identical despite the new casing rows
      // inserted before it, including the slope-adjusted drawn rail matrices.
      const tramRows = rows.slice(1), expected = justicePalaceV183Boxes(tramRows, native);
      finishDanzigerTramV249(expected, tramRows, native);
      const start = count - tramRows.length;
      expect(Array.from(mesh.instanceMatrix.array.slice(start * 16))).toEqual(Array.from(expected.instanceMatrix.array));
      expect(Array.from(mesh.instanceColor!.array.slice(start * 3))).toEqual(Array.from(expected.instanceColor!.array));
      expected.geometry.dispose(); (expected.material as MeshBasicMaterial).dispose(); expected.userData.nightMaterial.dispose();
      const matrix = new Matrix4();
      if (native) for (let i=0; i<count; i++) {
        (meshes[0] as ReturnType<typeof justicePalaceV183Boxes>).getMatrixAt(i,matrix);
        for (const k of [1,2,4,6,8,9]) expect(matrix.elements[k]).toBe(0);
      }
      root.traverse(o => {
        const mesh = o as ReturnType<typeof justicePalaceV183Boxes>;
        mesh.geometry?.dispose();
        if (mesh.material) (mesh.material as MeshBasicMaterial).dispose();
        mesh.userData.nightMaterial?.dispose();
      });
    });

    test(`${native ? "native" : "drawn"}: platform ray support and granular obstacles agree`, () => {
      const rows: number[][] = []; appendDanzigerTramV249(rows,native);
      const fixtures = native ? data.nativeBoxes : data.boxes;
      for (const floor of data.floors) {
        const ring = floor.ring;
        const x = ring.reduce((s,p)=>s+p[0],0)/ring.length;
        const z = ring.reduce((s,p)=>s+p[1],0)/ring.length;
        expect(danzigerTramGroundAtV249(x,z,native)).toBe(3.4);
        const floorRows = native ? fixtures.slice(...floor.native as [number,number]) :
          fixtures.filter(r=>Math.abs(r[1]+r[4]/2-3.4)<.00001);
        const mesh = justicePalaceV183Boxes(floorRows,native);
        mesh.updateMatrixWorld(true);
        const hit = new Raycaster(new Vector3(x,8,z),new Vector3(0,-1,0)).intersectObject(mesh,false)[0];
        expect(hit?.point.y).toBeCloseTo(3.4,4);
        mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); mesh.userData.nightMaterial.dispose();
      }
      for (const s of data.solids) {
        const r = data.nativeBoxes[s.native[0]];
        const x = native ? r[0] : s.ring.reduce((sum,p)=>sum+p[0],0)/s.ring.length;
        const z = native ? r[2] : s.ring.reduce((sum,p)=>sum+p[1],0)/s.ring.length;
        expect(danzigerTramSolidAtV249(x,(s.low+s.high)/2,z,0,native)).toBe(true);
        expect(danzigerTramSolidAtV249(x,10,z,0,native)).toBe(false);
      }
      expect(danzigerTramGroundAtV249(3200,-2320,native)).toBeNull();
      expect(danzigerTramSolidAtV249(3200,4,-2320,.3,native)).toBe(false);
      expect(danzigerTramGroundAtV249(-3500,6800,native)).toBeNull();
    });
  }
});
