import { ExtrudeGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape } from "three";
import { GendarmenmarktFacadeBuilder as Builder } from "./GendarmenmarktFacadeBuilder";
import { NATIONALGALERIE_APRON_V221 as P, NATIONALGALERIE_APRON_V221_RING as ring } from "./nationalgalerieApronV221Profile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

const COLOR = 0xb4b0a5;

function intersections(z: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + (z - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
  }
  return xs.sort((a, b) => a - b);
}

/** Additive upper terrace only; source polygon excludes pavement and old stairs. */
export function createNationalgalerieApronV221(native = false): Group {
  const name = "Nationalgalerie exact OSM northeast terrace apron v221";
  let root: Group;
  let rowCount = 0;
  if (native) {
    const builder = new Builder(true);
    const levels = [...new Set(ring.map(p => p[1]))].sort((a, b) => a - b);
    for (let band = 1; band < levels.length; band++) {
      const lo = levels[band - 1], hi = levels[band];
      const rows = Math.ceil((hi - lo) / P.nativeRowPitchM), depth = (hi - lo) / rows;
      for (let row = 0; row < rows; row++) {
        const z0 = lo + row * depth, z1 = z0 + depth;
        const epsilon = Math.min(1e-8, depth / 100);
        const a = intersections(z0 + epsilon), b = intersections(z1 - epsilon);
        // Vertex-aligned bands keep topology stable; inward endpoint bounds
        // ensure no native row extends onto adjacent street-level pavement.
        if (a.length !== b.length) throw new Error("Apron scanline topology changed inside a vertex band");
        for (let i = 0; i + 1 < a.length; i += 2) {
          const left = Math.max(a[i], b[i]) + 1e-6, right = Math.min(a[i + 1], b[i + 1]) - 1e-6;
          if (right <= left) continue;
          builder.box([(left + right) / 2, (P.groundY + P.terraceTopY) / 2, (z0 + z1) / 2],
            [right - left, P.terraceTopY - P.groundY, depth], COLOR);
          rowCount++;
        }
      }
    }
    root = builder.finish(name);
  } else {
    root = new Group(); root.name = name;
    const shape = new Shape();
    ring.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    shape.closePath();
    const geometry = new ExtrudeGeometry(shape, { depth: P.terraceTopY - P.groundY, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, P.groundY, 0); geometry.deleteAttribute("uv");
    const dayMaterial = new MeshBasicMaterial({ color: COLOR });
    const nightMaterial = new MeshStandardMaterial({ color: COLOR, roughness: .95, flatShading: true });
    const mesh = new Mesh(geometry, dayMaterial); mesh.name = name + " exact solid";
    mesh.userData = { dayMaterial, nightMaterial, textureFree: true };
    root.add(mesh);
  }
  let gpuBytes = 0, instanceCount = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const name of Object.keys(object.geometry.attributes)) gpuBytes += object.geometry.getAttribute(name).array.byteLength;
    gpuBytes += object.geometry.index?.array.byteLength ?? 0;
    if (object instanceof InstancedMesh) {
      gpuBytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
      instanceCount += object.count;
    }
  });
  root.userData = {
    ...root.userData, sourceKey: P.sourceKey, source: P.source,
    exactPavingComplement: true, sourceAreaM2: P.areaM2,
    groundY: P.groundY, terraceTopY: P.terraceTopY, walkY: P.walkY,
    verticalStatus: P.verticalStatus, nativeRowPitchM: native ? P.nativeRowPitchM : 0,
    rowCount, blockNative: native, keepInMinecraft: native,
    textureFree: true, fullAndMobileIdentical: true, gpuBytes, instanceCount,
  };
  return freezeStaticSceneTransforms(root);
}
