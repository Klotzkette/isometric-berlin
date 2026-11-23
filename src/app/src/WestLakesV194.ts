import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { registerTegelShoreV378 } from "./tegelLandscapeShoreLinkV378";
import surveyedCastle from "./data/tegelLandscapeCastleV378.json";
import drawn from "./data/westLakesV194.json";
import native from "./data/westLakesV194Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
export { westLakesV194WaterAt, westLakesV194SolidAt } from "./westLakesV194Navigation";

type Site = { key: string; name: string; owners: string[]; positions: number[]; indices: number[]; colors: number[]; boxes: number[][] };

/** Complete mapped horizontal rings, prepared offline; no runtime water voxel grid. */
export function createWestLakesV194(minecraft = false, reserveCastle = false): Group {
  const root = new Group();
  root.name = "Tegeler See, Wannsee and Pfaueninsel v194";
  root.userData = { westLakesV194: true, textureFree: true, sourceGeometryRetained: true, fullStaticDetailOnTouch: true, blockNative: minecraft, keepInMinecraft: minecraft };
  const sites: readonly Site[] = minecraft ? native.sites : drawn.sites;
  for (const site of sites) {
    if (site.key === "schloss-tegel" && reserveCastle) {
      root.userData.reservedCastleV378 = true;
      continue;
    }
    root.add(createWestLakeSiteV194(site, minecraft));
  }
  return freezeStaticSceneTransforms(root);
}

export function createOpeningCastleV378(minecraft: boolean): Group {
  const sites: readonly Site[] = minecraft ? native.sites : drawn.sites;
  return freezeStaticSceneTransforms(createWestLakeSiteV194(sites.find(site => site.key === "schloss-tegel")!, minecraft));
}

function createWestLakeSiteV194(source: Site, minecraft: boolean): Group {
  // Keep the four historic wind-relief exteriors and window frames. Their
  // previous estimated roof is replaced by the verified CityGML owner.
  const site = source.key !== "schloss-tegel" ? source : minecraft
    ? { ...source, boxes: [...source.boxes, ...surveyedCastle.boxes] }
    : { ...source, positions: surveyedCastle.positions, indices: surveyedCastle.indices, colors: surveyedCastle.colors };
  const group = new Group(); group.name = site.name;
  group.userData = { siteKey: site.key, sourceOwners: site.owners, independentCulling: true };
  if (site.key === "schloss-tegel") group.userData.surveyedCastleV378 = surveyedCastle.id;
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
    if (site.key === "tegel-water") registerTegelShoreV378(mesh,site,minecraft);
    group.add(mesh);
  }
  if (site.boxes.length) {
    const detail = justicePalaceV183Boxes(site.boxes, minecraft);
    detail.name = minecraft ? `${site.name}: exterior-only native blocks` : `${site.name}: estimated recognition relief`;
    group.add(detail);
  }
  return group;
}
