/** Record the removed raster hosts and the outer envelope of the actual twin ramps. */
import { Matrix4, Mesh, Vector3, type InstancedMesh } from "three";
import { createTunnelPortalApproachTester, createTunnelPortals } from "../src/TunnelPortals";
import { pointInHbfNorthRailCut } from "../src/HbfNorthApproachProfile";
import scene from "../public/mesh/regierungsviertel/scene.json";
import raster from "../public/mesh/regierungsviertel/ground-context.json";

const portal = scene.tiergartentunnel;
const inside = createTunnelPortalApproachTester(portal, raster.cell_m / Math.SQRT2);
const cells: number[][] = [];
for (let z = -800; z < -744; z += 4) {
  for (let x = -236; x < -200; x += 4) {
    if (!inside(x + 2, z + 2) || pointInHbfNorthRailCut(x + 2, z + 2, 4 / Math.SQRT2)) continue;
    const col = x / 4 - raster.grid.min_x_idx, row = z / 4 - raster.grid.min_z_idx;
    const host = raster.ground_rows[row].find(([start, n]) => start <= col && col < start + n);
    if (host && ["grass", "plazaBrick"].includes(raster.classes[host[2]])) cells.push([x, z]);
  }
}
const root = createTunnelPortals(portal);
root.updateMatrixWorld(true);
const support: number[][] = [], owners: string[] = [];
const matrix = new Matrix4(), point = new Vector3();
root.traverse(object => {
  if (!(object instanceof Mesh) || !object.name.includes("invalidenstrasse")) return;
  owners.push(object.name);
  const positions = object.geometry.getAttribute("position");
  const instances = object as InstancedMesh;
  for (let n = 0; n < (instances.isInstancedMesh ? instances.count : 1); n++) {
    if (instances.isInstancedMesh) {
      instances.getMatrixAt(n, matrix);
      matrix.premultiply(object.matrixWorld);
    } else matrix.copy(object.matrixWorld);
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      support.push([point.x, point.z]);
    }
  }
});
if (!owners.length || !cells.length) throw Error("Missing physical portal geometry");
console.log(JSON.stringify({ cells, owners, support }));
