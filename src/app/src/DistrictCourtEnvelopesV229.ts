import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import drawn from "./data/districtCourtsV229Envelopes.json";
import blocks from "./data/districtCourtsV229Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

// The generator reserves this tone for original RoofSurface sheets. Bake one
// constant facing tone per source triangle: unlit rendering must still reveal
// Wedding's measured roof slopes, without adding facets or changing vertices.
const SOURCE_ROOF_TONE = 0x7f7970;
function roofFacingShade(triangle: number[][]): number {
  const [a, b, c] = triangle;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz);
  if (length < 1e-9) return 1;
  const upward = ny < 0 ? -1 : 1;
  return 1 + .3 * upward * (.65 * nx + .76 * nz) / length;
}

/** Required measured source sheets and explicitly labelled fallback envelopes.
 * Each site has its own bounds: invisible boroughs do not keep rendering.
 * Constructor arrays are consumed synchronously, never retained on scene roots. */
export function createDistrictCourtEnvelopesV229(native = false): Group {
  const root = new Group(); root.name = `Current court required envelopes v229${native ? " native" : ""}`;
  root.userData = { districtCourtEnvelopesV229: true, requiredBeforeNavigation: true,
    textureFree: true, fullStaticDetailOnTouch: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native, originalSourceSheetsRetained: true, sourceXZPreserved: true,
    sourceReceipt: "district-courts-source-v229.json", exactOwnershipReceipt: "districtCourtsV229Ownership.json" };
  if (native) {
    for (const site of blocks.sites) {
      const mesh = justicePalaceV183Boxes(site.blocks, true); mesh.name = `${site.name} independent source-surface blocks`;
      Object.assign(mesh.userData, { districtCourtEnvelopesV229: true, siteKey: site.key,
        nativeMinecraft: true, requiredBeforeNavigation: true, sourceOwnerIds: site.owners.slice() }); root.add(mesh);
    }
  } else {
    const tint = new Color();
    for (const site of drawn.sites) {
      const length = site.surfaces.reduce((n, s) => n + s.triangles.length * 9, 0);
      const positions = new Float32Array(length), colors = new Float32Array(length); let offset = 0;
      for (const surface of site.surfaces) {
        for (const triangle of surface.triangles) {
          tint.setHex(surface.color);
          if (surface.color === SOURCE_ROOF_TONE) tint.multiplyScalar(roofFacingShade(triangle));
          for (const p of triangle) {
            positions.set(p, offset); tint.toArray(colors, offset); offset += 3;
          }
        }
      }
      const geometry = new BufferGeometry(); geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("color", new BufferAttribute(colors, 3)); geometry.computeVertexNormals();
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .86 });
      const mesh = new Mesh(geometry, day); mesh.name = `${site.name} complete source shell`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
        districtCourtEnvelopesV229: true, siteKey: site.key, requiredBeforeNavigation: true,
        sourceOwnerIds: site.owners.slice() };
      root.add(mesh);
    }
  }
  return freezeStaticSceneTransforms(root);
}
