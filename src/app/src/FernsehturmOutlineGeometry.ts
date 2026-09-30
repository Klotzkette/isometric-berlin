import {
  BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, SphereGeometry,
} from "three";
import { FERNSEHTURM_PROFILE as P } from "./schlossEastProfile";

/** Initial vector silhouette resolves a documented full-height LoD2-cylinder conflict. */
export function createFernsehturmOutlineMesh(): Mesh {
  const positions: number[] = [], normals: number[] = [], colours: number[] = [];
  const colour = new Color();
  const append = (geometry: BufferGeometry, centerY: number, hex: number) => {
    const flat = geometry.toNonIndexed(), p = flat.getAttribute("position"), n = flat.getAttribute("normal");
    colour.setHex(hex);
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i) + P.x, p.getY(i) + centerY, p.getZ(i) + P.z);
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      const shade = .84 + .16 * Math.max(0, n.getX(i) * .45 + n.getY(i) * .75 + n.getZ(i) * .3);
      colours.push(colour.r * shade, colour.g * shade, colour.b * shade);
    }
    flat.dispose(); geometry.dispose();
  };
  append(new CylinderGeometry(P.shaftBottomRadius, P.footRadius, P.footFlareHeight, 32),
    P.groundY + P.footFlareHeight / 2, 0xc5cbca);
  const shaftHeight = P.shaftTopHeight - P.footFlareHeight;
  append(new CylinderGeometry(P.shaftTopRadius, P.shaftBottomRadius, shaftHeight, 32),
    P.groundY + P.footFlareHeight + shaftHeight / 2, 0xc5cbca);
  append(new SphereGeometry(P.sphereRadius, 32, 20), P.groundY + P.sphereCenterHeight, 0xa2afb2);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const dayMaterial = new MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  const nightMaterial = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .78 });
  const mesh = new Mesh(geometry, dayMaterial);
  mesh.name = "Fernsehturm source-centred narrow shaft and 32 m sphere outline";
  mesh.userData = { dayMaterial, nightMaterial, textureFree: true,
    sourcePartIds: P.sourcePartIds, sourceGeometryUnchanged: false,
    sourceConflict: P.sourceConflict, originalSourceRetained: true,
    proceduralPublishedDimensionSilhouette: true };
  return mesh;
}
