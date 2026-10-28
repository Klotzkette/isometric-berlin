import { expect } from "bun:test";
import { BufferAttribute, BufferGeometry, InstancedMesh, Mesh, type Object3D } from "three";
import receipt from "../../src/data/citadelCrownV230Previous.json";

/** Invert only the recorded crown vertices/cells. Every other live value and
 * the frozen whole-outline signatures remain authoritative. */
export function restoreCitadelPreviousV230(root: Object3D, native: boolean): () => void {
  const name = native ? "Zitadelle: independent block surface interpretation" : "Zitadelle: retained source sheets and mapped grounds";
  const found: Object3D[] = [];
  root.traverse(node => { if (node.name === name) found.push(node); });
  expect(found).toHaveLength(1);
  const mesh = found[0] as Mesh;
  if (native) {
    expect(mesh).toBeInstanceOf(InstancedMesh);
    const detail = mesh as InstancedMesh, saved = detail.instanceMatrix;
    expect(detail.count).toBe(receipt.nativeCount);
    const projected = saved.clone();
    for (const [i, x, y, z, w, h, d] of receipt.nativeRows) {
      const top = Math.min(y + h / 2, receipt.capY), bottom = y - h / 2 >= receipt.capY ? top - h : y - h / 2;
      expect([0, 5, 10, 12, 13, 14].map(j => saved.array[i * 16 + j])).toEqual([w, top - bottom, d, x, (bottom + top) / 2, z].map(Math.fround));
      projected.array[i * 16 + 5] = h; projected.array[i * 16 + 13] = y;
    }
    detail.instanceMatrix = projected;
    return () => { detail.instanceMatrix = saved; };
  }
  const saved = mesh.geometry.getAttribute("position") as BufferAttribute;
  const normal = mesh.geometry.getAttribute("normal"), projected = saved.clone();
  expect(saved.count).toBe(receipt.drawnVertexCount);
  expect(mesh.geometry.index).toBeNull();
  const affected = new Set(receipt.drawnVertices.map(([i]) => Math.floor(i / 3)));
  const check = new BufferGeometry(); check.setAttribute("position", saved); check.computeVertexNormals();
  const expectedNormal = check.getAttribute("normal");
  for (const triangle of affected) for (let p = triangle * 9; p < triangle * 9 + 9; p++)
    expect(normal.array[p]).toBe(expectedNormal.array[p]);
  check.deleteAttribute("position"); check.dispose();
  for (const [i, x, y, z] of receipt.drawnVertices) {
    expect([saved.getX(i), saved.getY(i), saved.getZ(i)]).toEqual([x, receipt.capY, z].map(Math.fround));
    projected.setY(i, y);
  }
  mesh.geometry.setAttribute("position", projected); mesh.geometry.deleteAttribute("normal");
  mesh.geometry.computeVertexNormals();
  const oldNormal = mesh.geometry.getAttribute("normal");
  oldNormal.normalized = normal.normalized;
  for (let p = 0; p < normal.array.length; p++) if (!affected.has(Math.floor(p / 9))) oldNormal.array[p] = normal.array[p];
  return () => { mesh.geometry.setAttribute("position", saved); mesh.geometry.setAttribute("normal", normal); };
}
