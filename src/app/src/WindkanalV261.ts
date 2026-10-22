import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import source from "./data/windkanalV261.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const WINDKANAL_V261_PROFILE = Object.freeze({
  owner: source.owner, part: source.part, sourceSha256: source.sourceSha256,
  bounds: source.bounds, curvedRoofFacets: source.roofFacets,
  status: source.status, maxRuntimeBytes: 260_000,
  camera: { position: [10530, 32, 9988], target: [10572, 12, 9954], spanM: 80 },
});

/** A shallow rounded concrete skin and upper ring ribs, never a second pipe.
 * Every official sheet and measured courtyard remains in the city packet. */
export function createWindkanalV261(native = false): Group {
  const root = new Group();
  root.name = "Windkanal rounded outer roof and upper reinforcement rings v261";
  root.userData = { ...WINDKANAL_V261_PROFILE, additiveOnly: true,
    sourceGeometryRetained: true, textureFree: true, fullStaticDetailOnTouch: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native };
  if (native) {
    const model = justicePalaceV183Boxes(source.blocks, true);
    model.name = "Independent one-metre Windkanal contour cells";
    root.add(model);
  } else {
    const positions: number[] = [], colours: number[] = [];
    const tint = new Color(), a = new Vector3(), b = new Vector3(), normal = new Vector3();
    for (const row of source.triangles) {
      const [hex, p, q, r] = row as [number, number[], number[], number[]];
      a.set(q[0]-p[0], q[1]-p[1], q[2]-p[2]);
      b.set(r[0]-p[0], r[1]-p[1], r[2]-p[2]);
      normal.crossVectors(a, b).normalize();
      if (normal.y < 0) normal.negate();
      tint.setHex(hex).multiplyScalar(.78 + normal.y*.15 + normal.x*.08 - normal.z*.06);
      for (const v of [p,q,r]) { positions.push(...v); colours.push(tint.r,tint.g,tint.b); }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .98 });
    const mesh = new Mesh(geometry, day);
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
