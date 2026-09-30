import {
  BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import { sourceMesh } from "./BebelplatzBuildingShells";
import { bebelplatzPartBounds, bebelplatzPartRoofAt } from "./bebelplatzBuildingProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { GENDARMENMARKT_PERIMETER_BUILDINGS } from "./gendarmenmarktPerimeterProfile";
import { gendarmenmarktFacadeStyle } from "./GendarmenmarktPerimeterFacades";
export { createGendarmenmarktPerimeterFacades } from "./GendarmenmarktPerimeterFacades";

export const GENDARMENMARKT_PERIMETER_SHELLS_NAME = "Complete official Gendarmenmarkt perimeter envelopes";
export const MINECRAFT_GENDARMENMARKT_PERIMETER_SHELLS_NAME = "Block-native official Gendarmenmarkt perimeter envelopes";

/** Original official planes preserve complete roof forms and all open courts. */
export function createGendarmenmarktPerimeterShells(): Group {
  const root = new Group(); root.name = GENDARMENMARKT_PERIMETER_SHELLS_NAME;
  root.userData = { sourceBound: true, sourceGeometryUnchanged: true, textureFree: true,
    fullAndMobileIdentical: true };
  for (const building of GENDARMENMARKT_PERIMETER_BUILDINGS) {
    const style = gendarmenmarktFacadeStyle(building.key);
    const porch = building.officialParts.filter(p => p.id === "DEBE3DaxQzUzfwX8");
    const normal = building.officialParts.filter(p => p.id !== "DEBE3DaxQzUzfwX8");
    for (const [parts, wall, roof] of [[normal, style.wall, style.roof], [porch, 0x607779, 0x465351]] as const) {
      if (!parts.length) continue;
      const mesh = sourceMesh(parts, { wall, roof, name: building.name });
      mesh.position.y = building.displayYTranslationM;
      mesh.userData.buildingKey = building.key;
      root.add(mesh);
    }
  }
  return freezeStaticSceneTransforms(root);
}

/** Union-of-parts outer skin: roof cells and exposed wall courses, no buried fill. */
export function createMinecraftGendarmenmarktPerimeterShells(): Group {
  const root = new Group(); root.name = MINECRAFT_GENDARMENMARKT_PERIMETER_SHELLS_NAME;
  root.userData = { sourceBound: true, textureFree: true, keepInMinecraft: true,
    blockNative: true, surfaceOnly: true, hiddenSolidInfill: false };
  const cell = 2.5, matrix = new Matrix4(), tint = new Color();
  const matrices: number[] = [], colors: number[] = [];
  const add = (x: number, y: number, z: number, width: number, height: number, depth: number, color: number) => {
    matrix.makeScale(width, height, depth).setPosition(x, y, z);
    matrices.push(...matrix.elements);
    tint.setHex(color); colors.push(tint.r, tint.g, tint.b);
  };
  for (const building of GENDARMENMARKT_PERIMETER_BUILDINGS) {
    const bounds = building.officialParts.map(bebelplatzPartBounds);
    const x0 = Math.floor(Math.min(...bounds.map(b => b[0])) / cell);
    const x1 = Math.ceil(Math.max(...bounds.map(b => b[2])) / cell);
    const z0 = Math.floor(Math.min(...bounds.map(b => b[1])) / cell);
    const z1 = Math.ceil(Math.max(...bounds.map(b => b[3])) / cell);
    const style = gendarmenmarktFacadeStyle(building.key);
    const partBases = building.officialParts.map(part => part.surfaces.some(s => s.kind === "WallSurface")
      ? part.ground_y_m : Math.min(...part.surfaces.flatMap(s => s.rings.flatMap(r => r.map(p => p[1])))) - .2);
    const columns = new Map<string, { top: number; bottom: number }>();
    for (let ix = x0; ix < x1; ix++) for (let iz = z0; iz < z1; iz++) {
      let top = -Infinity, bottom = Infinity;
      building.officialParts.forEach((part, i) => {
        const roof = bebelplatzPartRoofAt(part, (ix + .5) * cell, (iz + .5) * cell);
        if (roof === null) return;
        top = Math.max(top, roof + building.displayYTranslationM);
        bottom = Math.min(bottom, partBases[i] + building.displayYTranslationM);
      });
      if (top > bottom) columns.set(`${ix},${iz}`, { top, bottom });
    }
    for (const [key, { top, bottom }] of columns) {
      const [ix, iz] = key.split(",").map(Number), x = (ix + .5) * cell, z = (iz + .5) * cell;
      const roof = Math.min(.55, top - bottom);
      add(x, top - roof / 2, z, cell, roof, cell, style.roof);
      const lowNeighbour = Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) =>
        columns.get(`${ix + dx},${iz + dz}`)?.top ?? bottom));
      const start = Math.max(bottom, lowNeighbour), height = top - roof - start;
      if (height > .1) {
        const courses = Math.ceil(height / 3.5), pitch = height / courses;
        for (let i = 0; i < courses; i++) add(x, start + (i + .5) * pitch, z, cell, pitch, cell, style.wall);
      }
    }
  }
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const nightMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: .87, flatShading: true });
  const mesh = new InstancedMesh(geometry, dayMaterial, 0);
  mesh.instanceMatrix = new InstancedBufferAttribute(new Float32Array(matrices), 16);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(colors), 3);
  mesh.count = matrices.length / 16;
  mesh.name = "Source-bound perimeter roof and exposed wall cells";
  mesh.userData = { dayMaterial, nightMaterial, textureFree: true, surfaceOnly: true };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
