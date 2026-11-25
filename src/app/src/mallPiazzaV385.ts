import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShapeUtils, Vector2 } from "three";

import { mallPiazzaFootwayV385, mallPiazzaPavingHeightV385, mallPiazzaPavingProfileV385 } from "./leipzigerPlatzSourceProfile";

// Split the outline at the local 16 m terrain transition. North and south
// approach the existing sidewalk surfaces at their respective elevations.
function clipZ(points: Vector2[], z: number, keepNorth: boolean): Vector2[] {
  const result: Vector2[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const inside = keepNorth ? a.y <= z : a.y >= z;
    if (inside) result.push(a);
    if (inside !== (keepNorth ? b.y <= z : b.y >= z))
      result.push(a.clone().lerp(b, (z - a.y) / (b.y - a.y)));
  }
  return result;
}

export function createMallPiazzaPavingV385(native: boolean): Mesh {
  const shape = mallPiazzaFootwayV385.map(([x,z]) => new Vector2(x,z));
  const positions: number[] = [];
  for (let band=1; band<mallPiazzaPavingProfileV385.length; band++) {
    const lo = mallPiazzaPavingProfileV385[band-1][0], hi = mallPiazzaPavingProfileV385[band][0];
    const strip = clipZ(clipZ(shape,lo,false),hi,true);
    for (const triangle of ShapeUtils.triangulateShape(strip, []))
      for (const index of triangle.reverse()) {
        const vertex = strip[index];
        positions.push(vertex.x, mallPiazzaPavingHeightV385(vertex.y), vertex.y);
      }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({color:0xd7d3c9, side:DoubleSide});
  const night = new MeshStandardMaterial({color:0xcac5b8, side:DoubleSide, roughness:.76});
  const mesh = new Mesh(geometry,day);
  mesh.name = "Mall Piazza · continuous public stone paving";
  mesh.userData = { blockNative:native, keepInMinecraft:native, textureFree:true, dayMaterial:day, nightMaterial:night, sourceOsmWay:194066305 };
  return mesh;
}
