import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import drawn from "./data/westLakesV194.json";
import native from "./data/westLakesV194Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
export { westLakesV194WaterAt, westLakesV194SolidAt } from "./westLakesV194Navigation";

type Site = { key: string; name: string; owners: string[]; positions: number[]; indices: number[]; colors: number[]; boxes: number[][] };

/** Complete mapped horizontal rings, prepared offline; no runtime water voxel grid. */
export function createWestLakesV194(minecraft = false): Group {
  const root = new Group();
  root.name = "Tegeler See, Wannsee and Pfaueninsel v194";
  root.userData = { westLakesV194: true, textureFree: true, sourceGeometryRetained: true, fullStaticDetailOnTouch: true, blockNative: minecraft, keepInMinecraft: minecraft };
  const sites: readonly Site[] = minecraft ? native.sites : drawn.sites;
  for (const site of sites) {
    const group = new Group(); group.name = site.name;
    group.userData = { siteKey: site.key, sourceOwners: site.owners, independentCulling: true };
    if (site.indices.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(site.positions), 3));
      const colors = new Float32Array(site.colors.length * 3), color = new Color();
      site.colors.forEach((value, i) => {
        color.setHex(value);
        // Existing v187 packets use rounded 8-bit linear colours for water/land.
        if (!site.boxes.length) color.setRGB(Math.round(color.r * 255) / 255, Math.round(color.g * 255) / 255, Math.round(color.b * 255) / 255);
        color.toArray(colors, i * 3);
      });
      geometry.setAttribute("color", new BufferAttribute(colors, 3));
      geometry.setIndex(new BufferAttribute(site.positions.length / 3 <= 65535 ? new Uint16Array(site.indices) : new Uint32Array(site.indices), 1));
      geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, flatShading: true });
      const day = minecraft ? night : new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
      const mesh = new Mesh(geometry, day);
      mesh.name = `${site.name}: complete mapped source silhouette`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: minecraft, keepInMinecraft: minecraft };
      group.add(mesh);
    }
    if (site.boxes.length) {
      const detail = justicePalaceV183Boxes(site.boxes, minecraft);
      detail.name = minecraft ? `${site.name}: exterior-only native blocks` : `${site.name}: estimated recognition relief`;
      group.add(detail);
    }
    root.add(group);
  }
  return freezeStaticSceneTransforms(root);
}
