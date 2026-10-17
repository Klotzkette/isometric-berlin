import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import drawn from "./data/hospitalV228Envelopes.json";
import blocks from "./data/hospitalV228Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Required exact mapped parts with explicitly estimated storey heights.
 * Each campus has its own bounds: invisible boroughs do not keep rendering.
 * Constructor arrays are consumed synchronously, never retained on scene roots. */
export function createHospitalEnvelopesV228(native = false): Group {
  const root = new Group(); root.name = `Hospital campuses required envelopes v228${native ? " native" : ""}`;
  root.userData = { hospitalEnvelopesV228: true, requiredBeforeNavigation: true,
    textureFree: true, fullStaticDetailOnTouch: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native, originalSourceSheetsRetained: true, sourceXZPreserved: true,
    sourceReceipt: "hospitals-source-v228.json", sourceSuppressionIds: [] };
  if (native) {
    for (const site of blocks.sites) {
      const mesh = justicePalaceV183Boxes(site.blocks, true); mesh.name = `${site.name} independent source-surface blocks`;
      Object.assign(mesh.userData, { hospitalEnvelopesV228: true, siteKey: site.key,
        nativeMinecraft: true, requiredBeforeNavigation: true, sourceOwnerIds: site.owners.slice() }); root.add(mesh);
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
        hospitalEnvelopesV228: true, siteKey: site.key, requiredBeforeNavigation: true,
        sourceOwnerIds: site.owners.slice() };
      root.add(mesh);
    }
  }
  return freezeStaticSceneTransforms(root);
}
