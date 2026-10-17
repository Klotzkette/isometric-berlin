import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial } from "three";
import source from "./data/altMitteSidewalksV226.json";
import { altMitteTransportGroundV206 } from "./AltMitteTransportV206";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { cutRosenthalerSurfaceV228 } from "./RosenthalerSurfaceAperturesV228";

/** Missing source-width pavement only; existing surfaces and road gaps remain.
 * Native uses independently contained quarter-metre pixels, merged into runs. */
export function createAltMitteSidewalksV226(native = false, openRosenthaler = false): Group {
  const root = new Group();
  root.name = "Source-width Alt-Mitte sidewalk complements v226" + (native ? " native" : "");
  root.userData = { altMitteSidewalksV226: true, sourceSha256: source.sourceSha256,
    sourceGeometryRetained: true, additiveOnly: true, textureFree: true,
    fullStaticDetailOnTouch: true, nativeMinecraft: native, blockNative: native,
    keepInMinecraft: native, counts: source.counts };
  for (const cell of source.cells) {
    const vertexCount = native ? cell.nativeRuns.length * 4 : cell.positions.length / 2;
    if (!vertexCount) continue;
    const positions = new Float32Array(vertexCount * 3);
    const indices = native ? new Uint16Array(cell.nativeRuns.length * 6) : new Uint16Array(cell.indices);
    if (native) {
      cell.nativeRuns.forEach(([ix, iz, count], i) => {
        const x = ix / 4, z = iz / 4, end = (ix + count) / 4;
        const y = altMitteTransportGroundV206((x + end) / 2, z + .125, true) + .025;
        positions.set([x, y, z, end, y, z, end, y, z + .25, x, y, z + .25], i * 12);
        indices.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6);
      });
    } else {
      for (let i = 0; i < cell.positions.length; i += 2) {
        const x = cell.positions[i], z = cell.positions[i + 1];
        positions.set([x, altMitteTransportGroundV206(x, z) + .1, z], i / 2 * 3);
      }
    }
    let geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    if (openRosenthaler) {
      const opened = cutRosenthalerSurfaceV228(geometry, native);
      if (opened !== geometry) { geometry.dispose(); geometry = opened; }
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({ color: 0xd4d0c3, side: DoubleSide });
    const night = new MeshBasicMaterial({ color: 0x252932, side: DoubleSide });
    const mesh = new Mesh(geometry, day);
    mesh.name = `${root.name} ${cell.cell.join(":")}`;
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
      blockNative: native, keepInMinecraft: native, fullStaticDetailOnTouch: true };
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
