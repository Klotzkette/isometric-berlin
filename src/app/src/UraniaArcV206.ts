import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import source from "./data/uraniaArcV206.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { createUraniaSourceRoofV188 } from "./UraniaLuetzowV188";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const URANIA_ARC_V206_GROUP = "Urania photo refinement and Arc de 124,5° v206";
export const URANIA_ARC_V206_SOURCE_OWNER = source.sourceOwner;
type Triangle = { points: readonly number[][]; color: number };

function sheets(triangles: readonly Triangle[]): Mesh {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(triangles.length * 9);
  const colors = new Float32Array(positions.length), color = new Color();
  triangles.forEach((t, i) => {
    color.setHex(t.color);
    t.points.forEach((point, j) => {
      positions.set(point, i * 9 + j * 3);
      color.toArray(colors, i * 9 + j * 3);
    });
  });
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .84, flatShading: true });
  const mesh = new Mesh(geometry, day);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, surfaceOnly: true };
  return mesh;
}

/** Two local bounds, final-size arrays, identical architecture on touch devices. */
export function createUraniaArcV206(minecraft = false): Group {
  const root = new Group(); root.name = URANIA_ARC_V206_GROUP;
  root.userData = { textureFree: true, fullStaticDetailOnTouch: true,
    sourceGeometryRetained: true, exactOwnerReplacement: source.sourceOwner,
    sourceParent: source.sourceParent, sourceHeightM: source.sourceHeightM,
    nativeMinecraft: minecraft, blockNative: minecraft, keepInMinecraft: minecraft,
    sourceSha256: source.sourceSha256, estimateStatus: source.estimates };
  for (const site of source.sites) {
    const group = new Group(); group.name = site.name;
    group.userData = { siteId: site.id, groundY: source.groundY, fullStaticDetailOnTouch: true };
    if (minecraft) {
      const blocks = justicePalaceV183Boxes(site.nativeBlocks, true);
      blocks.name = `${site.name}: native surface blocks`;
      blocks.userData.surfaceOnly = true;
      group.add(blocks);
    } else {
      const skin = sheets(site.triangles);
      skin.name = `${site.name}: source and recognition sheets`;
      group.add(skin);
      if (site.boxes.length) {
        const members = justicePalaceV183Boxes(site.boxes);
        members.name = "Urania: mirror joints, recessed door frames and yellow/magenta panels";
        group.add(members);
      }
      if (site.id === "urania-v206") group.add(createUraniaSourceRoofV188());
    }
    root.add(group);
  }
  return freezeStaticSceneTransforms(root);
}
