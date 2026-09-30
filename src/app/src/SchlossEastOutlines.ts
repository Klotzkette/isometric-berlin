import {
  BoxGeometry, Color, CylinderGeometry, EdgesGeometry, Group, InstancedMesh,
  LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import voxelData from "./eastOutlineVoxelData.json";
import { SCHLOSS_EAST_SOURCE as source, SCHLOSS_EAST_GROUP_NAME, SCHLOSS_EAST_PARTS,
  SCHLOSS_EAST_PROFILE_KEYS, SCHLOSS_EAST_TONES, FERNSEHTURM_ANTENNA } from "./schlossEastProfile";
import { sourceMesh } from "./BebelplatzBuildingShells";
import { createFernsehturmOutlineMesh } from "./FernsehturmOutlineGeometry";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

// Compatibility export; lightweight callers should import schlossEastProfile.
export { SCHLOSS_EAST_SOURCE, SCHLOSS_EAST_GROUP_NAME, SCHLOSS_EAST_PARTS,
  FERNSEHTURM_ANTENNA } from "./schlossEastProfile";

/** Initial, deliberately undecorated source silhouettes requested for the east extension. */
export function createSchlossEastOutlines(minecraft = false): Group {
  const root = new Group(); root.name = minecraft ? `Block-native ${SCHLOSS_EAST_GROUP_NAME}` : SCHLOSS_EAST_GROUP_NAME;
  root.userData = { textureFree: true, outlineOnly: true, originalSourceRetained: true,
    sourcePartCount: SCHLOSS_EAST_PARTS.length, keepInMinecraft: minecraft, blockNative: minecraft,
    hiddenSolidInfill: false };
  if (!minecraft) for (const key of SCHLOSS_EAST_PROFILE_KEYS) {
    const profile = source.profiles[key], tone = SCHLOSS_EAST_TONES[key];
    const mesh = key === "fernsehturm" ? createFernsehturmOutlineMesh() : sourceMesh(profile.parts, tone);
    root.add(mesh);
    const dayMaterial = new LineBasicMaterial({ color: 0x586663, transparent: true, opacity: .65 });
    const nightMaterial = new LineBasicMaterial({ color: 0x768987 });
    const edges = new LineSegments(new EdgesGeometry(mesh.geometry, 26), dayMaterial);
    edges.name = `${tone.name} measured edges`;
    edges.userData = { dayMaterial, nightMaterial, textureFree: true };
    root.add(edges);
  }
  const mast = FERNSEHTURM_ANTENNA;
  if (minecraft) {
    const geometry = new BoxGeometry(2, 2, 2); geometry.deleteAttribute("uv");
    const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
    const nightMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: .85 });
    const antennaCount = Math.ceil((mast.top - mast.base) / 2);
    const mesh = new InstancedMesh(geometry, dayMaterial, voxelData.cell_count + antennaCount);
    const matrix = new Matrix4(), colour = new Color();
    const cells = voxelData.cells_i32, cell = voxelData.sampling.cell_m;
    for (let i = 0; i < voxelData.cell_count; i++) {
      const offset = i * 4;
      mesh.setMatrixAt(i, matrix.makeTranslation(cells[offset] * cell + cell / 2,
        cells[offset + 1] * cell + cell / 2, cells[offset + 2] * cell + cell / 2));
      mesh.setColorAt(i, colour.setHex(voxelData.palette[cells[offset + 3]]));
    }
    let index = voxelData.cell_count;
    for (let y = mast.base; y < mast.top; y += 2) {
      mesh.setMatrixAt(index, matrix.makeTranslation(mast.x, Math.min(y + 1, mast.top - 1), mast.z));
      mesh.setColorAt(index++, colour.setHex(Math.floor((y - mast.base) / 10) % 2 ? 0xd4d6cb : 0xa36254));
    }
    mesh.name = "Eastern outline exposed source surface cells";
    mesh.userData = { dayMaterial, nightMaterial, textureFree: true, hiddenSolidInfill: false };
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  } else {
    // Antenna is absent above the official mesh; its total height is published.
    // Coarse red/white mast courses are a recognition estimate, not a new survey.
    const courses = 12, height = (mast.top-mast.base)/courses;
    for (let i = 0; i < courses; i++) {
      const radius = 1.45-(i/courses)*1.05;
      const dayMaterial = new MeshBasicMaterial({ color: i%2 ? 0xd4d6cb : 0xa36254 });
      const nightMaterial = new MeshStandardMaterial({ color: dayMaterial.color, roughness: .85 });
      const mesh = new Mesh(new CylinderGeometry(radius*.95,radius,height,8),dayMaterial);
      mesh.geometry.deleteAttribute("uv");
      mesh.position.set(mast.x,mast.base+(i+.5)*height,mast.z);
      mesh.name = "Fernsehturm published-height antenna outline";
      mesh.userData = { dayMaterial,nightMaterial,textureFree: true, proceduralHeightSupplement: true };
      root.add(mesh);
    }
  }
  return freezeStaticSceneTransforms(root);
}
