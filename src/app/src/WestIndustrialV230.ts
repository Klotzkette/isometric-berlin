import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import drawn from "./data/westIndustrialV230Envelopes.json";
import blocks from "./data/westIndustrialV230Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { westernIndustrialLetteringV230 } from "./westernIndustrialLetteringV230";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

// Constant facing tone reveals original roof slopes without changing geometry.
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
export function createWestIndustrialV230(native = false): Group {
  const root = new Group(); root.name = `Western industrial source shells v230${native ? " native" : ""}`;
  root.userData = { westIndustrialV230: true, requiredBeforeNavigation: true,
    textureFree: true, fullStaticDetailOnTouch: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native, originalSourceSheetsRetained: true, sourceXZPreserved: true,
    sourceReceipt: "west-industrial-source-v230.json", exactOwnershipReceipt: "westIndustrialV230Ownership.json" };
  if (native) {
    for (const site of blocks.sites) {
      const mesh = justicePalaceV183Boxes(site.blocks, true); mesh.name = `${site.name} independent source-surface blocks`;
      Object.assign(mesh.userData, { westIndustrialV230: true, siteKey: site.siteKey, chunkKey: site.key,
        nativeMinecraft: true, requiredBeforeNavigation: true, sourceOwnerIds: site.owners.slice() }); root.add(mesh);
      if(site.labels.length){
        const letters = westernIndustrialLetteringV230(site.labels, true);
        Object.assign(letters.userData,{westIndustrialV230:true,siteKey:site.siteKey,chunkKey:site.key,nativeMinecraft:true});root.add(letters);
      }
    }
  } else {
    const tint = new Color();
    for (const site of drawn.sites) {
      const length = site.surfaces.reduce((n, s) => n + s.triangles.length * 9, 0);
      const positions = new Float32Array(length), colors = new Float32Array(length); let offset = 0;
      for (const surface of site.surfaces) {
        for (const triangle of surface.triangles) {
          tint.setHex(surface.color);
          if ("roof" in surface && surface.roof) tint.multiplyScalar(roofFacingShade(triangle));
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
        westIndustrialV230: true, siteKey: site.siteKey, chunkKey: site.key, requiredBeforeNavigation: true,
        sourceOwnerIds: site.owners.slice() };
      root.add(mesh);
      const fits = justicePalaceV183Boxes(site.boxes, false);
      fits.name = `${site.name} source-wall recognition`;
      fits.userData = {...fits.userData, westIndustrialV230: true, siteKey: site.siteKey, chunkKey: site.key};
      root.add(fits);
      if(site.labels.length){
        const letters = westernIndustrialLetteringV230(site.labels, false);
        Object.assign(letters.userData,{westIndustrialV230:true,siteKey:site.siteKey,chunkKey:site.key});root.add(letters);
      }
    }
  }
  return freezeStaticSceneTransforms(root);
}
