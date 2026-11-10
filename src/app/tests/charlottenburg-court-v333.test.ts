import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import {
  charlottenburgCourtV333PreviousPanes,
  createCharlottenburgCourtV333,
} from "../src/CharlottenburgCourtV333";
import previous from "../src/data/districtCourtsV229.json";
import nativeBodies from "../src/data/districtCourtsV229Native.json";
import previousFittings from "../src/data/courtsParkV293.json";

const key = "charlottenburg";
const site = previous.sites.find(site => site.key === key)!;
const fittings = previousFittings.sites.find(site => site.key === key)!;
const body = nativeBodies.sites.find(site => site.key === key)!;

function within(index: number, intervals: number[][]) {
  return intervals.some(([lo, hi]) => index >= lo && index < hi);
}

describe("Charlottenburg measured plaza façade", () => {
  test("only the replayed Drawn fittings retire and the principal pediment and portal are built", () => {
    const result = createCharlottenburgCourtV333(site, false)!;
    expect(result).toBeTruthy();
    expect(result.labels).toBe(site.labels);
    expect(result.rows).toEqual(site.boxes.filter((_, i) => !within(i, [[0, 60], [860, 920], [1200, 1240], [1940, 1956], [2276, 2292], [2420, 2436]])));
    expect(result.rods).toEqual(site.rods.filter((_, i) => !within(i, [[0, 27], [387, 414], [540, 558]])));
    expect(result.root.userData).toMatchObject({
      sourceOwner: "DEBE04YY50000NDH",
      sourceFaces: [29, 41, 0],
      fullStaticDetailOnTouch: true,
      textureFree: true,
    });
    const [members, shapes] = result.root.children as [InstancedMesh, Mesh];
    expect(members.count).toBe(407);
    expect(members.boundingBox?.max.y).toBeLessThan(20);
    expect(shapes.geometry.boundingBox!.max.y).toBeCloseTo(22.79, 3);
    expect(shapes.geometry.attributes.position.count).toBe(1812);
    expect(shapes.geometry.attributes.color.count).toBe(shapes.geometry.attributes.position.count);
    expect(shapes.userData.nightMaterial).toBeDefined();
  });

  test("the inscription starts on the left when viewed from the plaza", () => {
    const { root } = createCharlottenburgCourtV333(site, false)!;
    const { position } = (root.children[1] as Mesh).geometry.attributes;
    const lettering: number[] = [];
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) + 5212.299, z = position.getZ(i) - 1299.852;
      const depth = x * .491222 - z * .871034;
      const y = position.getY(i);
      if (Math.abs(depth - .41) < .002 && y > 19.07 && y < 19.43) {
        lettering.push(-x * .871034 - z * .491222);
      }
    }
    expect(lettering.length).toBeGreaterThan(100);
    expect(lettering[0]).toBeLessThan(-.5);
    expect(lettering.at(-1)).toBeGreaterThan(.5);
  });

  test("each Native fitting is cardinal and anchored to a real preceding façade column", () => {
    const result = createCharlottenburgCourtV333(site, true)!;
    expect(result).toBeTruthy();
    expect(result.labels).toBe(site.labels);
    expect(result.rows).toEqual(site.nativeRows.filter((_, i) => !within(i, [[0, 135], [1935, 2070], [2700, 2790], [4365, 4417], [5195, 5247], [5549, 5591]])));
    expect(result.rods).toEqual([]);
    const mesh = result.root.children[0] as InstancedMesh;
    expect(mesh.count).toBe(1663);
    expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength).toBeLessThan(130 * 1024);
    const columns = Array.from({ length: 36 }, (_, index) => -5231 + index).map(col => {
      const x = col + .5;
      return Math.min(...body.blocks.filter(([cx, y, , width, height]) =>
        x >= cx - width / 2 && x < cx + width / 2 && y - height / 2 <= 3 && y + height / 2 >= 22.6,
      ).map(([, , z, , , depth]) => z - depth / 2));
    });
    const m = new Matrix4(), wrong: number[] = [];
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      const e = m.elements, [x, y, z] = e.slice(12, 15);
      const column = Math.floor(x), front = columns[column + 5231];
      if (
        e[1] || e[2] || e[4] || e[6] || e[8] || e[9] ||
        !Number.isFinite(front) || z > front || front - z > 1.02 ||
        x - e[0] / 2 < column - .001 || x + e[0] / 2 > column + 1.001 ||
        y - e[5] / 2 < 3 || y + e[5] / 2 > 22.8
      ) wrong.push(i);
    }
    expect(wrong).toEqual([]);
  });

  test("both same-count content changes and unknown ownership retain the previous version", () => {
    const boxes = site.boxes.map(row => [...row]);
    boxes[0][1] += .001;
    const nativeRows = site.nativeRows.map(row => [...row]);
    nativeRows[0][1] += .001;
    expect(createCharlottenburgCourtV333({ ...site, boxes }, false)).toBeNull();
    expect(createCharlottenburgCourtV333({ ...site, nativeRows }, true)).toBeNull();
    expect(createCharlottenburgCourtV333({ ...site, owner: "changed" }, false)).toBeNull();

    const covered = charlottenburgCourtV333PreviousPanes(fittings)!;
    expect(Array.from(covered)).toEqual(fittings.panes.flatMap((_, i) => within(i, [[0, 15], [215, 230], [300, 310]]) ? [i] : []));
    const panes = fittings.panes.map(row => [...row]);
    panes[0][0] += .001;
    expect(charlottenburgCourtV333PreviousPanes({ ...fittings, panes })).toBeNull();
  });
});
