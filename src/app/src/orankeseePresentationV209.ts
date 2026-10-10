import {
  BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh,
  Matrix4, Mesh, MeshStandardMaterial,
} from "three";
import cut from "./data/orankeseeMarginV209.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

const receiptKey = "orankeseePresentationCutV209";
const key = (points: readonly number[][]): string => points.map(p => p.map(Math.fround).join(",")).sort().join(";");

function geometry(positions: number[], colors: number[]): BufferGeometry {
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute(positions, 3));
  result.setAttribute("color", new Float32BufferAttribute(colors, 3));
  result.computeVertexNormals(); result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

function drawn(root: Group): void {
  const mesh = root.getObjectByName("extrapolated margin ground");
  if (!(mesh instanceof Mesh) || mesh instanceof InstancedMesh) throw new Error("Orankesee presentation owner missing");
  if (mesh.userData[receiptKey]) return;
  const old = mesh.geometry, p = old.getAttribute("position"), c = old.getAttribute("color");
  if (old.index || !p || !c || Object.keys(old.attributes).sort().join() !== "color,normal,position")
    throw new Error("Orankesee presentation owner changed");
  const expected = new Color(cut.drawnSourceColor).toArray().map(Math.fround);
  const wanted = new Map(cut.drawn.map(r => [key(r.source), r]));
  const matches = new Map<number, typeof cut.drawn[number]>();
  for (let i = 0; i < p.count; i += 3) {
    const points = [0, 1, 2].map(j => [p.getX(i + j), p.getY(i + j), p.getZ(i + j)]);
    const record = wanted.get(key(points));
    if (!record) continue;
    if (![0, 1, 2].every(j => [c.getX(i + j), c.getY(i + j), c.getZ(i + j)].every((v, k) => v === expected[k])))
      throw new Error("Orankesee presentation colour receipt changed");
    matches.set(i, record);
  }
  if (matches.size !== cut.drawn.length || new Set(matches.values()).size !== cut.drawn.length)
    throw new Error("Orankesee presentation triangle receipt changed");
  // Allocate and validate first; the unpublished world's transaction owns the
  // atomic swap. Every unselected vertex attribute is copied byte-for-byte.
  const positions: number[] = [], colors: number[] = [], normals: number[] = [];
  const n = old.getAttribute("normal");
  for (let i = 0; i < p.count; i += 3) {
    const record = matches.get(i);
    if (record) for (const triangle of record.triangles) for (const point of triangle) {
      positions.push(...point); colors.push(c.getX(i), c.getY(i), c.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
    } else for (let j = i; j < i + 3; j++) {
      positions.push(p.getX(j), p.getY(j), p.getZ(j));
      colors.push(c.getX(j), c.getY(j), c.getZ(j));
      normals.push(n.getX(j), n.getY(j), n.getZ(j));
    }
  }
  const replacement = geometry(positions, colors);
  replacement.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  replacement.userData = { ...old.userData, sourceWaterOwner: cut.waterOwner };
  mesh.geometry = replacement;
  mesh.userData[receiptKey] = { triangles: matches.size, sourceVertices: cut.sourceVertexCount };
  old.dispose();
}

function native(root: Group): void {
  const mesh = root.getObjectByName("Voxel extrapolated ground");
  if (!(mesh instanceof InstancedMesh) || !mesh.instanceColor || !(mesh.material instanceof MeshStandardMaterial))
    throw new Error("Orankesee native presentation owner missing");
  if (mesh.userData[receiptKey]) return;
  const matrix = new Matrix4(), expected = new Matrix4(), color = new Color();
  const matches: { index: number; record: typeof cut.native[number]; color: number[] }[] = [];
  for (const record of cut.native) {
    expected.makeScale(...record.size as [number, number, number]);
    expected.setPosition(...record.center as [number, number, number]);
    const tone = new Color(record.color).toArray().map(Math.fround);
    let match = -1;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      if (!matrix.elements.every((v, k) => v === Math.fround(expected.elements[k]))) continue;
      if (match !== -1) throw new Error("Orankesee native presentation owner duplicated");
      mesh.getColorAt(i, color);
      if (!color.toArray().every((v, k) => v === tone[k])) throw new Error("Orankesee native presentation colour receipt changed");
      match = i;
    }
    if (match === -1) throw new Error("Orankesee native presentation instance receipt changed");
    matches.push({ index: match, record, color: tone });
  }
  const positions: number[] = [], colors: number[] = [];
  for (const match of matches) for (const triangle of match.record.triangles) for (const point of triangle) {
    positions.push(...point); colors.push(...match.color);
  }
  const material = mesh.material.clone(); material.vertexColors = true;
  const remaining = new Mesh(geometry(positions, colors), material);
  remaining.name = "Orankesee exact source cut in retained artificial Minecraft margin";
  remaining.userData = { dayMaterial: material, nightMaterial: material, textureFree: true,
    nativeMinecraft: true, keepInMinecraft: true, presentationOnly: true, sourceWaterOwner: cut.waterOwner };
  const zero = new Matrix4().makeScale(0, 0, 0);
  for (const match of matches) mesh.setMatrixAt(match.index, zero);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.add(freezeStaticSceneTransforms(remaining));
  mesh.userData[receiptKey] = { instances: matches.length, sourceVertices: cut.sourceVertexCount };
}

/** Call once on the provisional complete world before required-site publication.
 * Removes only artificial paper/grass above the exact 82-point lake. Existing
 * drawn and native water packets, their levels and their ownership stay intact. */
export function cutOrankeseePresentationV209(root: Group, minecraft = false): void {
  if (minecraft) native(root); else drawn(root);
}
