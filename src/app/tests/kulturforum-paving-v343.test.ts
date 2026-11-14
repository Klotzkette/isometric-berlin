import { describe, expect, test } from "bun:test";
import { BoxGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial } from "three";
import { createKulturforumPavingV343, kulturforumSupportHeightV343 } from "../src/KulturforumPavingV343";
import source from "../src/data/kulturforumPavingV343.json";

describe("source-supported Philharmonie-West paving", () => {
  test("the joint follows its existing triangle, including sloping terrain", () => {
    const triangle = [-5, 2, 12, 4, 1, 18];
    const plane = (x: number, z: number) => 3 + x * .07 - z * .03;
    const heights = [plane(-5, 2), plane(12, 4), plane(1, 18)];
    for (const [x, z] of [[-5,2],[12,4],[1,18],[2,8],[0,4]])
      expect(kulturforumSupportHeightV343(triangle, heights, 0, x, z)).toBeCloseTo(plane(x,z), 10);
  });

  test("one finite drawn batch uses true-width seams without line ink", () => {
    const ground = (x: number, z: number) => 4 + x * .005 + z * .003;
    const root = createKulturforumPavingV343(ground);
    expect(root.children.length).toBe(1);
    const mesh = root.children[0] as Mesh;
    const p = mesh.geometry.getAttribute("position");
    expect(p.count).toBe(source.counts.drawn * 6);
    for (let i = 0; i < p.count; i += 37) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      expect(x).toBeGreaterThanOrEqual(source.scope[0]);
      expect(x).toBeLessThanOrEqual(source.scope[2]);
      expect(z).toBeGreaterThanOrEqual(source.scope[1]);
      expect(z).toBeLessThanOrEqual(source.scope[3]);
      expect(y).toBeCloseTo(ground(x,z) + source.pavingLiftM + source.separationM, 4);
    }
    expect(mesh.geometry.index).toBeNull();
    expect(mesh.userData.dayMaterial.transparent).toBe(false);
    mesh.geometry.dispose();
  });

  test("native detail is cardinal and independently authored", () => {
    const ground = new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),source.nativeSupports.length);
    const matrix = new Matrix4();
    for (let i = 0; i < source.nativeSupports.length; i++) {
      const [x0,z0,x1,z1] = source.nativeSupports[i];
      matrix.makeScale(x1-x0,.4,z1-z0);
      matrix.setPosition((x0+x1)/2,4 + (i % 3) * .1 - .2,(z0+z1)/2);
      ground.setMatrixAt(i,matrix);
    }
    const root = createKulturforumPavingV343(() => { throw new Error("Native must use actual slab top"); }, true,ground);
    expect(root.children.length).toBe(1);
    const mesh = root.children[0] as InstancedMesh;
    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.count).toBe(source.counts.native);
    expect(source.counts.native).not.toBe(source.counts.drawn);
    const m = mesh.instanceMatrix.array;
    for (let i = 0; i < mesh.count; i += 31) {
      for (const off of [1,2,4,6,8,9]) expect(m[i * 16 + off]).toBe(0);
      expect(m[i * 16]).toBeGreaterThan(0);
      expect(m[i * 16 + 5]).toBeCloseTo(.014,6);
      expect(m[i * 16 + 10]).toBeGreaterThan(0);
    }
    const tops = new Set([3.995,4.095,4.195].map(v=>v.toFixed(3)));
    for (let i=0;i<mesh.count;i++) expect(tops.has(m[i*16+13].toFixed(3))).toBe(true);
    expect(root.userData.nativeGroundSupport.omitted).toBe(0);
    ground.geometry.dispose();
    mesh.geometry.dispose();
  });

  test("unknown native support cannot create floating paving", () => {
    const root = createKulturforumPavingV343(() => { throw new Error("No fallback"); },true);
    expect(root.children.length).toBe(0);
    expect(root.userData.nativeGroundSupport.omitted).toBe(source.counts.native);
  });
});
