import { expect } from "bun:test";
import { BufferAttribute, Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, type Object3D, Vector3 } from "three";
import source from "../../src/data/steglitzV182Source.json";
import nativeSource from "../../src/data/steglitzV182Native.json";
import refinements from "../../src/data/steglitzV246Details.json";
import plaza from "../../src/data/hermannEhlersV247Details.json";
import street from "../../src/data/schlossstrasseV247Details.json";
import fountain from "../../src/data/hermannEhlersFountainV248.json";
import frontage from "../../src/data/albrechtstrasseV248Details.json";
import { steglitzSchoolV250Refinements } from "../../src/steglitzSchoolV250";
import { steglitzWindowsV273NativeRows, steglitzWindowsV273SourceBoxes, steglitzWindowsV273SurfaceColor } from "../../src/steglitzWindowsV273";

/** Reverse the source-indexed school paint/filter and later appended public
 * space rows. All retained old transforms, rod rows and geometry stay live. */
export function restoreSteglitzPreviousV246(root: Object3D, native: boolean): () => void {
  const found: Object3D[] = [];
  root.traverse(node => { if (node.userData.steglitzV182) found.push(node); });
  expect(found).toHaveLength(1);
  const site = found[0], mesh = site.children.find(node => node instanceof InstancedMesh) as InstancedMesh;
  expect(mesh).toBeInstanceOf(InstancedMesh);
  const originalRows = native ? nativeSource.boxes : source.boxes;
  const retained = native ? steglitzWindowsV273NativeRows(nativeSource.boxes) : steglitzWindowsV273SourceBoxes(source.boxes);
  const additions = native
    ? [...steglitzSchoolV250Refinements(refinements.nativeRows, true), ...plaza.nativeRows, ...street.nativeRows, ...fountain.nativeRows, ...frontage.nativeRows]
    : [...steglitzSchoolV250Refinements(refinements.boxes, false), ...plaza.boxes, ...street.boxes, ...fountain.boxes, ...frontage.boxes];
  const saved = { matrix: mesh.instanceMatrix, color: mesh.instanceColor!, count: mesh.count };
  expect(mesh.count).toBe(retained.length + additions.length + (native ? 0 : source.rods.length));
  const matrix = new Matrix4(), size = new Vector3(), color = new Color();
  const matrixRow = (row: number[]) => {
    if (native) matrix.identity(); else matrix.makeRotationY(row[6]);
    matrix.scale(size.set(row[3], row[4], row[5])).setPosition(row[0], row[1], row[2]);
    return matrix.elements.map(Math.fround);
  };
  const tint = (row: number[]) => color.setHex(row[native ? 6 : 7]).toArray().map(Math.fround);
  additions.forEach((row, i) => {
    const index = retained.length + i;
    expect(Array.from(saved.matrix.array.slice(index * 16, index * 16 + 16))).toEqual(matrixRow(row));
    expect(Array.from(saved.color.array.slice(index * 3, index * 3 + 3))).toEqual(tint(row));
  });
  const count = originalRows.length + (native ? 0 : source.rods.length);
  const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
  const liveIndices = new Map(retained.map((row, i) => [row, i]));
  originalRows.forEach((row, i) => {
    const live = native ? i : liveIndices.get(row);
    if (live === undefined) { matrices.set(matrixRow(row), i * 16); colors.set(tint(row), i * 3); }
    else {
      matrices.set(saved.matrix.array.slice(live * 16, live * 16 + 16), i * 16);
      if (native && retained[i][6] !== row[6]) {
        expect(Array.from(saved.color.array.slice(live * 3, live * 3 + 3))).toEqual(tint(retained[i]));
        colors.set(tint(row), i * 3);
      } else colors.set(saved.color.array.slice(live * 3, live * 3 + 3), i * 3);
    }
  });
  if (!native) {
    const first = retained.length + additions.length;
    matrices.set(saved.matrix.array.slice(first * 16), originalRows.length * 16);
    colors.set(saved.color.array.slice(first * 3), originalRows.length * 3);
  }
  mesh.count = count; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16, saved.matrix.normalized, saved.matrix.meshPerAttribute).setUsage(saved.matrix.usage);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3, saved.color.normalized, saved.color.meshPerAttribute).setUsage(saved.color.usage);
  let restoreShell = () => {};
  if (!native) {
    const body = site.children.find(node => node instanceof Mesh && !(node instanceof InstancedMesh)) as Mesh;
    const attrs = { ...body.geometry.attributes };
    const oldLength = source.surfaces.reduce((n, surface) => n + surface.triangles.length * 9, 0);
    const appended = [...plaza.surfaces, ...street.surfaces, ...fountain.surfaces];
    const addedLength = appended.reduce((n, surface) => n + surface.triangles.length * 9, 0);
    expect(attrs.position.array.length).toBe(oldLength + addedLength);
    let cursor = oldLength;
    for (const surface of appended) {
      const rgb = color.setHex(surface.color).toArray().map(Math.fround);
      for (const triangle of surface.triangles) for (const point of triangle) {
        expect(Array.from(attrs.position.array.slice(cursor, cursor + 3))).toEqual(point.map(Math.fround));
        expect(Array.from(attrs.color.array.slice(cursor, cursor + 3))).toEqual(rgb); cursor += 3;
      }
    }
    for (const [name, attr] of Object.entries(attrs)) {
      expect(attr.array.length).toBe(oldLength + addedLength);
      body.geometry.setAttribute(name, new BufferAttribute(attr.array.slice(0, oldLength), attr.itemSize, attr.normalized).setUsage((attr as BufferAttribute).usage));
    }
    const projected = body.geometry.getAttribute("color"); cursor = 0;
    source.surfaces.forEach((surface, i) => {
      const length = surface.triangles.length * 9, currentColor = steglitzWindowsV273SurfaceColor(i, surface.color);
      if (currentColor !== surface.color) {
        const current = color.setHex(currentColor).toArray().map(Math.fround), old = color.setHex(surface.color).toArray().map(Math.fround);
        for (let p = cursor; p < cursor + length; p++) {
          expect(projected.array[p]).toBe(current[(p - cursor) % 3]); projected.array[p] = old[(p - cursor) % 3];
        }
      }
      cursor += length;
    });
    restoreShell = () => { for (const [name, attr] of Object.entries(attrs)) body.geometry.setAttribute(name, attr); };
  }
  return () => { restoreShell(); mesh.count = saved.count; mesh.instanceMatrix = saved.matrix; mesh.instanceColor = saved.color; };
}
