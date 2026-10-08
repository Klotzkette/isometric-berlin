import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";

/** Existing v183 DOP-aligned display estimate, never a new surveyed envelope. */
export const CHARLOTTENBURG_CUPOLA_V183 = {
  center: [-5133, -338] as const,
  profile: [[20.7, 7], [22, 7], [31, 7], [32, 7.6], [34, 7], [37.5, 6.1],
    [40.1, 4.4], [41, 2.3], [44.3, 2.2], [45.3, .6]] as const,
};
const profile = CHARLOTTENBURG_CUPOLA_V183.profile;
const [cx, cz] = CHARLOTTENBURG_CUPOLA_V183.center;
const copper = 0x5b8881, stone = 0xc2b995, glazing = 0x465b59;
const colourAt = (y: number, angle: number): number => {
  if (y >= 31) return copper;
  const bay = (angle / (Math.PI * 2) * 16 + 16) % 1;
  return y > 23.1 && y < 29.3 && bay > .15 && bay < .85 ? glazing : stone;
};

/** A hollow single-sheet skin; the open lantern and earlier members survive. */
export function createCharlottenburgCupolaV183(native = false): Mesh {
  if (native) {
    const rows: number[][] = [], step = .4, half = step / 2;
    for (let i = 0; i < profile.length - 1; i++) {
      const [y0, r0] = profile[i], [y1, r1] = profile[i + 1];
      if (y0 === 41) continue; // Open lantern, retained independent supports.
      const slices = Math.ceil((y1 - y0) / step), height = (y1 - y0) / slices;
      for (let j = 0; j < slices; j++) {
        const y = y0 + (j + .5) * height;
        // Keep every cube wholly inside the smallest radius over its course.
        const radius = Math.min(r0 + (r1 - r0) * j / slices, r0 + (r1 - r0) * (j + 1) / slices);
        const bound = Math.ceil(radius / step);
        for (let xi = -bound; xi <= bound; xi++) for (let zi = -bound; zi <= bound; zi++) {
          const x = xi * step, z = zi * step;
          const outer = Math.hypot(Math.abs(x) + half, Math.abs(z) + half);
          if (outer > radius || outer < radius - step * 1.15) continue;
          rows.push([cx + x, y, cz + z, step, height, step, colourAt(y, Math.atan2(z, x))]);
        }
      }
    }
    const mesh = justicePalaceV183Boxes(rows, true);
    mesh.name = "Charlottenburg hollow block-native copper cupola and drum skin";
    Object.assign(mesh.userData, { surfaceOnly: true, hiddenSolidInfill: false, estimatedShell: true, openLantern: true });
    return mesh;
  }
  const positions: number[] = [], colours: number[] = [], color = new Color();
  // Extra drum courses let the opaque dark window fields sit between old piers.
  const courses: (readonly [number, number])[] = [...profile.slice(0, 2), [23.1, 7], [29.3, 7], ...profile.slice(2)];
  const sides = 96;
  for (let i = 0; i < courses.length - 1; i++) {
    const [y0, r0] = courses[i], [y1, r1] = courses[i + 1];
    if (y0 === 41) continue;
    for (let j = 0; j < sides; j++) {
      const a = j * Math.PI * 2 / sides, b = (j + 1) * Math.PI * 2 / sides;
      const q = [[cx + Math.cos(a) * r0, y0, cz + Math.sin(a) * r0],
        [cx + Math.cos(b) * r0, y0, cz + Math.sin(b) * r0],
        [cx + Math.cos(b) * r1, y1, cz + Math.sin(b) * r1],
        [cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1]];
      color.setHex(colourAt((y0 + y1) / 2, (a + b) / 2));
      color.multiplyScalar(.84 + .14 * Math.cos((a + b) / 2 - 2.2));
      for (const k of [0, 1, 2, 0, 2, 3]) { positions.push(...q[k]); colours.push(color.r, color.g, color.b); }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, flatShading: true, roughness: .86 });
  const mesh = new Mesh(geometry, day);
  mesh.name = "Charlottenburg hollow faceted copper cupola and drum skin";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, surfaceOnly: true,
    hiddenSolidInfill: false, estimatedShell: true, openLantern: true };
  return mesh;
}
