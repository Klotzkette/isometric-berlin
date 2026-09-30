import {
  BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial,
} from "three";
import source from "./data/hansaplatzBlockStreets.json";
import { groundTopSampler, type VoxelPayload } from "./MinecraftVoxelWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Native road/pavement tops; adjacent equal-height cells share one cuboid. */
export function createHansaplatzBlockStreets(ground: VoxelPayload): Group {
  return createBlockStreetSurfaces(ground, source, "Hansaplatz and Gymnasium block-native streets");
}

export function createBlockStreetSurfaces(ground: VoxelPayload, source: {runs: number[][]; cell_count: number; osm_sha256: string}, name: string, tones = [0x767d7c, 0xc8c5b8, 0xd9d5c8], kerbKind = 2): Group {
  const root = new Group();
  root.name = name;
  root.userData = {
    blockNative: true,
    keepInMinecraft: true,
    textureFree: true,
    hiddenSolidInfill: false,
    sourceCellCount: source.cell_count,
    sourceGeometry: source.osm_sha256,
  };
  const sample = groundTopSampler(ground);
  const { cell_m: cell, grid: { min_x_idx: minX, min_z_idx: minZ } } = ground;
  const heightAt = (x: number, z: number) => sample(x / cell - minX, z / cell - minZ);
  const boxes: [number, number, number, number, number][] = [];
  for (const [x, z, length, kind] of source.runs) {
    let start = 0;
    let height = heightAt(x + 0.5, z + 0.5);
    for (let end = 1; end <= length; end++) {
      const nextHeight = end < length ? heightAt(x + end + 0.5, z + 0.5) : NaN;
      if (nextHeight === height) continue;
      boxes.push([x + (start + end) / 2, height, z + 0.5, end - start, kind]);
      start = end;
      height = nextHeight;
    }
  }
  const material = new MeshBasicMaterial({ color: 0xffffff });
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, boxes.length);
  const matrix = new Matrix4(), colour = new Color();
  for (let i = 0; i < boxes.length; i++) {
    const [x, groundY, z, length, kind] = boxes[i];
    // Only a shallow exposed surface is stored. A kerb remains a low step,
    // never a fence or an additional collision solid across source crossings.
    const thickness = kind === kerbKind ? 0.14 : 0.08;
    const top = groundY + (kind === 0 ? 0.18 : 0.32);
    matrix.makeScale(length, thickness, 1).setPosition(x, top - thickness / 2, z);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, colour.setHex(tones[kind]));
  }
  mesh.name = `${name} exposed top cells`;
  mesh.userData.dayMaterial = material;
  mesh.userData.nightMaterial = new MeshBasicMaterial({ color: 0x626d82 });
  mesh.userData.staticAntiFlicker = true;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
