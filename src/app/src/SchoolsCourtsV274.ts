import {
  BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import data from "./data/schoolsCourtsV274.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { canRefineLennonV250 } from "./LennonV250";
import { canRefineChorinerV250 } from "./ChorinerV250";

export const SCHOOLS_COURTS_V274_BUDGET = Object.freeze({
  ...data.counts, drawnBatches: 8, nativeBatches: 7,
  fullStaticDetailOnTouch: true, textureFree: true,
});

function copperUpperEnvelope(): Mesh {
  const decoded = atob(data.bmsUpperPositions);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(bytes.buffer), 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const dayMaterial = new MeshBasicMaterial({ color: data.bmsUpperColor, side: DoubleSide });
  const nightMaterial = new MeshStandardMaterial({ color: data.bmsUpperColor, side: DoubleSide, roughness: .84, flatShading: true });
  const mesh = new Mesh(geometry, dayMaterial);
  mesh.name = "Berlin Metropolitan School: all five measured copper upper parts";
  mesh.userData = { dayMaterial, nightMaterial, textureFree: true, sourceParent: "DEBE01YYK000047I", sourceGeometryRetained: true, clippedAboveExistingRoof: 23.2 };
  return mesh;
}

/** Seven source-bound sites, independently culled; mobile receives every row. */
export function createSchoolsCourtsV274(native = false, _options: { mobileLike?: boolean } = {}): Group {
  const root = new Group();
  root.name = "Schools and courtyards v274";
  root.userData = { schoolsCourtsV274: true, textureFree: true, sourceGeometryRetained: true,
    fullStaticDetailOnTouch: true, blockNative: native, keepInMinecraft: native,
    renderBudget: SCHOOLS_COURTS_V274_BUDGET, noHiddenSolidInfill: true };
  for (const site of data.sites) {
    // These additions depend on the existing corrected opening register. If
    // its receipt changes, retain that model without a misaligned new overlay.
    if (site.key === "lennon" && !canRefineLennonV250()) continue;
    if (site.key === "choriner" && !canRefineChorinerV250()) continue;
    const rows = (native ? site.nativeRows : site.boxes).map(row => [
      row[0]/1000 + site.origin[0], row[1]/1000 + site.origin[1], row[2]/1000 + site.origin[2],
      row[3]/1000, row[4]/1000, row[5]/1000,
      ...(native ? [] : [row[6]/1e6]), data.palette[row[row.length-1]],
    ]);
    const mesh = justicePalaceV183Boxes(rows, native);
    mesh.name = site.name;
    mesh.userData = { ...mesh.userData, schoolsCourtsV274: true, site: site.key,
      sourceGeometryRetained: true, fullStaticDetailOnTouch: true,
      blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
      noHiddenSolidInfill: true };
    root.add(mesh);
    if (site.key === "metropolitan" && !native) root.add(copperUpperEnvelope());
  }
  return freezeStaticSceneTransforms(root);
}

/** Integrate once in the existing schools descriptor; no residency changes. */
export function appendSchoolsCourtsV274(root: Group, native = false): void {
  if (root.userData.schoolsCourtsV274) return;
  root.add(createSchoolsCourtsV274(native));
  root.userData.schoolsCourtsV274 = true;
}
