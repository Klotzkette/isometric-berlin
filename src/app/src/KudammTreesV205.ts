import { Group, IcosahedronGeometry } from "three";
import source from "./data/kudammTreesV205.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { terrainGroundAt } from "./weinbergTerrainV176";

/** Exact official boulevard positions, partitioned into small static batches. */
export function createKudammTreesV205(native = false): Group {
  const root = new Group();
  root.name = "Kurfürstendamm — official street trees v205";
  root.userData = { textureFree: true, fullStaticDetailOnTouch: true, additiveOnly: true, nativeMinecraft: native };
  const cells = new Map<string, number[][]>();
  for (const tree of source.trees) {
    const key = `${Math.floor(tree[0] / 240)}:${Math.floor(tree[1] / 240)}`;
    const rows = cells.get(key) ?? [];
    rows.push(tree); cells.set(key, rows);
  }
  for (const [key, trees] of cells) {
    const trunks: number[][] = [], crowns: number[][] = [];
    for (const [x, z, height, diameter, trunk] of trees) {
      const ground = terrainGroundAt(x, z, 3, native);
      const crownHeight = Math.min(height * .65, diameter * 1.25);
      const trunkHeight = height - crownHeight * .5;
      const row = (y: number, sx: number, sy: number, sz: number, color: number) =>
        native ? [x, y, z, sx, sy, sz, color] : [x, y, z, sx, sy, sz, 0, color];
      trunks.push(row(ground + trunkHeight / 2, trunk, trunkHeight, trunk, 0x776c52));
      crowns.push(row(ground + height - crownHeight / 2, diameter, crownHeight, diameter, 0x66864b));
    }
    const trunkMesh = justicePalaceV183Boxes(trunks, native);
    const crownMesh = justicePalaceV183Boxes(crowns, native);
    if (!native) {
      crownMesh.geometry.dispose();
      crownMesh.geometry = new IcosahedronGeometry(.5, 1);
      crownMesh.geometry.deleteAttribute("uv");
      crownMesh.computeBoundingBox(); crownMesh.computeBoundingSphere();
    }
    trunkMesh.name = `Ku’damm official trunks ${key}`;
    crownMesh.name = `Ku’damm official crowns ${key}`;
    root.add(trunkMesh, crownMesh);
  }
  return freezeStaticSceneTransforms(root);
}
