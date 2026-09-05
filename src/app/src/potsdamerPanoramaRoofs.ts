export type PanoramaRoofBox = {
  position: [number, number, number];
  size: [number, number, number];
  rotationY: number;
  color: number;
};

// The two roof-light footprints follow the committed LoD2 atrium plans.
// The shallow camber, glazing subdivision and service cues are procedural
// readings of the owner's Kollhoff panorama, not surveyed roof components.
export const POTSDAMER_PANORAMA_ROOFS = [
  { parentId: "DEBE00YYWk0000CD", center: [206.9, 42.8, 1228.8], width: 16.8, depth: 23.8 },
  { parentId: "DEBE00YYWk0000CB", center: [184.1, 42.7, 1292.7], width: 16.8, depth: 23.8 },
] as const;

/** Thin visible surfaces only; both renderers append to an existing batch. */
export function potsdamerPanoramaRoofBoxes(voxel = false): PanoramaRoofBox[] {
  const boxes: PanoramaRoofBox[] = [];
  const rotationY = -19.6 * Math.PI / 180;
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  const columns = voxel ? 4 : 6;
  const rows = voxel ? 6 : 8;
  for (const roof of POTSDAMER_PANORAMA_ROOFS) {
    const add = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => {
      boxes.push({
        position: [roof.center[0] + x * cosine + z * sine, roof.center[1] + y, roof.center[2] - x * sine + z * cosine],
        size: [w, h, d], rotationY, color,
      });
    };
    const cellX = roof.width / columns;
    const cellZ = roof.depth / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = -roof.width / 2 + (column + 0.5) * cellX;
        const z = -roof.depth / 2 + (row + 0.5) * cellZ;
        const camber = 0.65 * (1 - (2 * x / roof.width) ** 2);
        const color = (row * 7 + column * 3) % 11 === 0 ? 0xb1c2c4 : (row + column) % 3 === 0 ? 0x829da7 : 0x607f90;
        add(x, camber, z, cellX - 0.12, voxel ? 0.4 : 0.12, cellZ - 0.12, color);
      }
    }
    for (const side of [-1, 1]) {
      add(side * (roof.width / 2 + 0.14), -0.15, 0, 0.28, 0.4, roof.depth + 0.55, 0xc3c9c5);
      add(0, -0.15, side * (roof.depth / 2 + 0.14), roof.width + 0.55, 0.4, 0.28, 0xc3c9c5);
      for (let row = 0; row < 4; row += 1) {
        add(side * (roof.width / 2 + 1.1), 0.08, (row - 1.5) * 5.2, 0.8, 0.9, 1.25, 0xd4d7cf);
      }
    }
  }
  return boxes;
}
