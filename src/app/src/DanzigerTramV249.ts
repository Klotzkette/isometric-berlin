import data from "./data/danzigerTramV249.json";
import { InstancedMesh, Matrix4, Vector3 } from "three";
import { terrainGroundAt } from "./weinbergTerrainV176";

/** Append into the existing NorthV185 hagenauer instance batch. No new material,
 * mesh, descriptor, texture, timer or per-frame allocation is introduced. */
export function appendDanzigerTramV249(rows: number[][], native: boolean): void {
  const paths = native ? data.nativeRails : data.rails;
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i];
    const dx = bx - ax, dz = bz - az;
    if (native) {
      const y = terrainGroundAt((ax + bx) / 2, (az + bz) / 2, 3, true) + .20;
      rows.push([(ax + bx) / 2, y, (az + bz) / 2,
        Math.abs(dx) + .10, .08, Math.abs(dz) + .10, 0xadb7bc]);
    } else {
      const ay = terrainGroundAt(ax, az) + .20, by = terrainGroundAt(bx, bz) + .20;
      // The offline path splits precisely at existing DGM triangle edges.
      // The ninth transient row value supplies the slope after shared batching.
      rows.push([(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2,
        Math.hypot(dx, by-ay, dz) + .015, .08, .075, -Math.atan2(dz, dx), 0xadb7bc,
        Math.atan2(by-ay, Math.hypot(dx, dz))]);
    }
  }
  for (const row of native ? data.nativeBoxes : data.boxes) rows.push(row);
}

/** Orient only the newly appended drawn rails; the complete old matrix prefix
 * and all native matrices remain untouched. No second mesh/buffer is retained. */
export function finishDanzigerTramV249(mesh: InstancedMesh, rows: number[][], native: boolean): void {
  if (native) return;
  const matrix = new Matrix4(), pitch = new Matrix4(), scale = new Vector3();
  let changed = false;
  for (let i = rows.length-data.counts.drawnRows; i < rows.length; i++) {
    const row = rows[i];
    if (row.length !== 9 || Math.abs(row[8]) < 1e-10) continue;
    matrix.makeRotationY(row[6]).multiply(pitch.makeRotationZ(row[8]));
    matrix.scale(scale.set(row[3],row[4],row[5]));
    matrix.setPosition(row[0],row[1],row[2]);
    mesh.setMatrixAt(i,matrix); changed = true;
  }
  if (changed) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  }
}

function inRing(x: number, z: number, ring: number[][], radius = 0): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) inside = !inside;
    if (radius > 0) {
      const dx = b[0]-a[0], dz = b[1]-a[1];
      const t = Math.max(0, Math.min(1, ((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      if ((x-a[0]-t*dx)**2+(z-a[1]-t*dz)**2 <= radius*radius) return true;
    }
  }
  return inside;
}

function inNativeRange(x: number, z: number, range: number[], radius = 0): boolean {
  for (let i = range[0]; i < range[1]; i++) {
    const r = data.nativeBoxes[i];
    if (Math.abs(x-r[0]) <= r[3]/2+radius && Math.abs(z-r[2]) <= r[5]/2+radius) return true;
  }
  return false;
}

const outsideStop = (x: number, z: number, radius = 0) =>
  x < 3188-radius || x > 3335+radius || z < -2307-radius || z > -2253+radius;

/** Only the two represented platform floors; railheads remain a 9cm step. */
export function danzigerTramGroundAtV249(x: number, z: number, native = false): number | null {
  if (outsideStop(x,z)) return null;
  for (const floor of data.floors) {
    if (native ? inNativeRange(x,z,floor.native) : inRing(x,z,floor.ring)) return floor.top;
  }
  return null;
}

/** Match the represented static vehicle, shelter posts/panels and furniture.
 * Open platform ends and the street stay accessible in either family. */
export function danzigerTramSolidAtV249(
  x: number, y: number, z: number, radius = 0, native = false,
): boolean {
  if (outsideStop(x,z,radius)) return false;
  for (const solid of data.solids) {
    if (y+radius < solid.low || y-radius > solid.high) continue;
    if (native ? inNativeRange(x,z,solid.native,radius) : inRing(x,z,solid.ring,radius)) return true;
  }
  return false;
}
