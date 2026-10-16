import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import drawn from "./data/townhallV227Envelopes.json";
import blocks from "./data/townhallV227Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Required complete measured replacements and exact mapped peripheral shells.
 * Each hall has its own bounds: invisible boroughs do not keep rendering.
 * Constructor arrays are consumed synchronously, never retained on scene roots. */
export function createDistrictTownhallEnvelopesV227(native = false): Group {
  const root = new Group(); root.name = `District town halls required envelopes v227${native ? " native" : ""}`;
  root.userData = { districtTownhallEnvelopesV227: true, requiredBeforeNavigation: true,
    textureFree: true, fullStaticDetailOnTouch: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native, originalSourceSheetsRetained: true, sourceXZPreserved: true,
    sourceReceipt: "townhall-source-v227.json", exactOwnershipReceipt: "townhallV227Ownership.json" };
  if (native) {
    for (const site of blocks.sites) {
      const mesh = justicePalaceV183Boxes(site.blocks, true); mesh.name = `${site.name} independent source-surface blocks`;
      mesh.userData.townhallKeyV227 = site.key; mesh.userData.sourceOwnerIds = site.owners.slice(); root.add(mesh);
    }
  } else {
    const tint = new Color();
    for (const site of drawn.sites) {
      const length = site.surfaces.reduce((n, s) => n + s.triangles.length * 9, 0);
      const positions = new Float32Array(length), colors = new Float32Array(length); let offset = 0;
      for (const surface of site.surfaces) {
        tint.setHex(surface.color);
        for (const triangle of surface.triangles) for (const p of triangle) {
          positions.set(p, offset); tint.toArray(colors, offset); offset += 3;
        }
      }
      const geometry = new BufferGeometry(); geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("color", new BufferAttribute(colors, 3)); geometry.computeVertexNormals();
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .86 });
      const mesh = new Mesh(geometry, day); mesh.name = `${site.name} complete source shell`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
        townhallKeyV227: site.key, sourceOwnerIds: site.owners.slice() };
      root.add(mesh);
    }
  }
  return freezeStaticSceneTransforms(root);
}
