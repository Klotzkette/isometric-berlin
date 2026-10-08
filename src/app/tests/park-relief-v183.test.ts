import { expect, test } from "bun:test";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import relief from "../src/data/parkReliefV183.json";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import { coreParkReliefContains, parkReliefAt } from "../src/parkReliefV182";
import { refineCoreParkReliefSurface } from "../src/parkReliefSurfaceV182";
import { refineCoreParkPathPoints } from "../src/ParkDetails";
import { originalFritzGroundAt, parkReliefGroundSlices } from "../src/parkReliefGroundRunsV182";
import { groundTopSampler, smoothGroundTopSampler, type VoxelPayload } from "../src/MinecraftVoxelWorld";

test("Fritz measured peak and finite apron join the existing relief sampler", () => {
  const p = relief.profiles[0];
  let maximum = -Infinity;
  for (let row = 0; row < p.offsets.length; row++) for (let col = 0; col < p.offsets[row].length; col++) {
    const x = p.support[0] + col * p.stepM, z = p.support[1] + row * p.stepM;
    const sampled = parkReliefAt(x, z);
    expect(sampled).toBeCloseTo(3 + p.offsets[row][col], 6);
    maximum = Math.max(maximum, sampled);
  }
  expect(maximum).toBeCloseTo(23.29, 6);
  expect(coreParkReliefContains(-1100, -1100)).toBeTrue();
  expect(parkReliefAt(0, 0, 5.2)).toBe(5.2);
});

test("Fritz local triangulation keeps all old vertices, outside faces, area and winding", () => {
  const source = new BufferGeometry();
  const original = new Float32Array([-1100,0,-1100, -1036,0,-1100, -1100,0,-1036, 0,0,0, 64,0,0, 0,0,64]);
  source.setAttribute("position", new BufferAttribute(original, 3)); source.setIndex([0,1,2,3,4,5]);
  const refined = refineCoreParkReliefSurface(source), p = refined.getAttribute("position"), faces = refined.getIndex()!;
  expect(Array.from(p.array.slice(0, original.length))).toEqual(Array.from(original));
  expect(Array.from(faces.array.slice(-3))).toEqual([3,4,5]);
  let area = 0;
  for (let index = 0; index < faces.count; index += 3) {
    const ids = [faces.getX(index), faces.getX(index + 1), faces.getX(index + 2)];
    const xs = ids.map(id => p.getX(id)), zs = ids.map(id => p.getZ(id));
    const cross = (xs[1]-xs[0])*(zs[2]-zs[0])-(zs[1]-zs[0])*(xs[2]-xs[0]);
    expect(cross).toBeGreaterThan(0); area += cross / 2;
    if (xs[0] < -500) for (let j = 0; j < 3; j++) expect(Math.hypot(xs[j]-xs[(j+1)%3], zs[j]-zs[(j+1)%3])).toBeLessThanOrEqual(4.000001);
  }
  expect(area).toBe(4096);
  source.dispose(); refined.dispose();
});

test("Fritz paths keep exact source anchors and collinear segments through the whole hill", () => {
  const source = [new Vector3(-1400,5,-1100), new Vector3(-600,5,-1100)];
  const points = refineCoreParkPathPoints(source);
  expect(points[0]).toBe(source[0]); expect(points.at(-1)).toBe(source.at(-1));
  for (let i=1; i<points.length; i++) {
    expect(points[i].z).toBe(-1100);
    expect(points[i].x).toBeGreaterThan(points[i-1].x);
    const midpoint = points[i].clone().add(points[i-1]).multiplyScalar(.5);
    if (coreParkReliefContains(midpoint.x, midpoint.z)) expect(points[i].x-points[i-1].x).toBeLessThanOrEqual(2.000001);
  }
});

test("Fritz backing never clips the visible slope and restores the old ends of long runs", () => {
  const payload = ground as VoxelPayload;
  const { min_x_idx: minXIndex, min_z_idx: minZIndex } = payload.grid;
  const cell = payload.cell_m, smooth = smoothGroundTopSampler(payload), nearest = groundTopSampler(payload);
  const xStart = Math.floor(-1450/cell-minXIndex), run = 250, zOffset = Math.floor(-1100/cell-minZIndex);
  const slices = parkReliefGroundSlices(xStart, run, zOffset, { cell, minXIndex, minZIndex,
    strideCells: payload.ground_height.stride_cells, mode:"drawn", nearest, smooth })!;
  expect(slices.length).toBeGreaterThan(20);
  expect(slices.reduce((sum,slice) => sum+slice.run, 0)).toBe(run);
  const oldTop = originalFritzGroundAt((minXIndex+xStart+run/2)*cell, (minZIndex+zOffset)*cell, nearest(xStart+run/2,zOffset));
  expect(slices[0].topY).toBe(oldTop); expect(slices.at(-1)!.topY).toBe(oldTop);
  for (const slice of slices.slice(1,-1)) for (let x=slice.xStart; x<slice.xStart+slice.run; x++) {
    const corners = [smooth(x,zOffset),smooth(x+1,zOffset),smooth(x,zOffset+1),smooth(x+1,zOffset+1)];
    expect(slice.topY).toBeLessThanOrEqual(Math.min(...corners)-.1999);
  }
});
