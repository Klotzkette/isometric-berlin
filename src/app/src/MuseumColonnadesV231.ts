import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import data from "./data/colonnadesV231.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** One shared, lightly fluted shaft. Sections are explicitly estimated details;
 * roof vertices and horizontal source alignment are never modified by this. */
function shaftGeometry(): BufferGeometry {
  const positions: number[] = [], colors: number[] = [];
  const rings = [[0, .44], [.025, .44], [.04, .38], [.17, .39], [.80, .34], [.94, .32], [.955, .40], [1, .47]];
  const count = 64;
  const vertex = (level: number, radial: number): number[] => {
    const [y, r] = rings[level], angle = radial * Math.PI * 2 / count;
    const flute = level > 1 && level < 6 ? (radial % 4 === 2 ? .91 : 1) : 1;
    return [Math.cos(angle) * r * flute, y, Math.sin(angle) * r * flute];
  };
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < count; i++) {
    const a = vertex(j, i), b = vertex(j, i + 1), c = vertex(j + 1, i), d = vertex(j + 1, i + 1);
    const angle = (i + .5) * Math.PI * 2 / count;
    const shade = .86 + .13 * Math.cos(angle - .7) + (i % 4 === 1 ? -.07 : 0);
    for (const p of [a, c, b, b, c, d]) { positions.push(...p); colors.push(shade, shade, shade); }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

function materialPair(vertexColors = false) {
  return {
    dayMaterial: new MeshBasicMaterial({ color: 0xffffff, vertexColors, side: DoubleSide }),
    nightMaterial: new MeshStandardMaterial({ color: 0xffffff, vertexColors, side: DoubleSide, roughness: .88 }),
  };
}

/** Open historic galleries. All construction rows are consumed synchronously;
 * no decoded weak JSON site is captured by a scene node or callback. */
export function createMuseumColonnadesV231(native = false): Group {
  const root = new Group(); root.name = `Museumsinsel open colonnades v231${native ? " native" : ""}`;
  const common = { museumColonnadesV231: true, requiredBeforeNavigation: true,
    textureFree: true, fullStaticDetailOnTouch: true, blockNative: native,
    nativeMinecraft: native, keepInMinecraft: native, siteKey: "kolonnadenhof" };
  root.userData = { ...common, sourceReceipt: "colonnades-v231-source.json",
    exactOwnershipReceipt: "colonnadesCorePreviousV231.json" };
  for (const site of data.sites) {
    if (native) {
      const mesh = justicePalaceV183Boxes(site.nativeRows, true);
      mesh.name = "Open colonnades independent orthogonal blocks";
      Object.assign(mesh.userData, common); root.add(mesh); continue;
    }
    const triangles: { color: number; points: number[][] }[] = [];
    for (const surface of site.roofs) for (const points of surface.triangles) triangles.push({ color: surface.color, points });
    for (const points of site.floorTriangles) triangles.push({ color: 0xbfb6a4, points });
    // Three low restored pavilion caps; subdivisions only concern this explicitly
    // estimated recognition detail. Complete measured flat roofs stay underneath.
    for (const [x, y, z, radius, rise] of site.domes) {
      const p = (i: number, j: number): number[] => {
        const theta = i * Math.PI * 2 / 32, phi = j * Math.PI / 16;
        return [x + radius * Math.cos(phi) * Math.cos(theta), y + rise * Math.sin(phi), z + radius * Math.cos(phi) * Math.sin(theta)];
      };
      for (let j = 0; j < 8; j++) for (let i = 0; i < 32; i++) {
        const shade = .91 + .12 * Math.cos((i + .5) * Math.PI / 16 - .7);
        const color = new Color(0x797d76).multiplyScalar(shade).getHex();
        triangles.push({ color, points: [p(i, j), p(i + 1, j), p(i, j + 1)] },
          { color, points: [p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)] });
      }
    }
    const positions = new Float32Array(triangles.length * 9), colors = new Float32Array(positions.length);
    const color = new Color(); let offset = 0;
    for (const t of triangles) {
      color.setHex(t.color);
      for (const p of t.points) { positions.set(p, offset); color.toArray(colors, offset); offset += 3; }
    }
    const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("color", new BufferAttribute(colors, 3)); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    const materials = materialPair(true), roof = new Mesh(g, materials.dayMaterial);
    roof.name = "Complete measured colonnade roofs, upper fascia and walkable paving";
    roof.userData = { ...common, ...materials }; root.add(roof);
    const beams = justicePalaceV183Boxes(site.boxes); beams.name = "Shallow coffer beams, plinths and abaci";
    Object.assign(beams.userData, common); root.add(beams);
    const shaftMaterials = materialPair(true), shafts = new InstancedMesh(shaftGeometry(), shaftMaterials.dayMaterial, 0);
    const matrices = new Float32Array(site.columns.length * 16), tones = new Float32Array(site.columns.length * 3), matrix = new Matrix4();
    site.columns.forEach(([x, z, floor, top, , tone], i) => {
      matrix.makeScale(1, top - floor - .03, 1); matrix.setPosition(x, floor + .18, z);
      matrix.toArray(matrices, i * 16); color.setHex(tone).toArray(tones, i * 3);
    });
    shafts.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
    shafts.instanceColor = new InstancedBufferAttribute(tones, 3); shafts.count = site.columns.length;
    shafts.computeBoundingBox(); shafts.computeBoundingSphere();
    shafts.name = "Open paired fluted stone columns";
    shafts.userData = { ...common, ...shaftMaterials }; root.add(shafts);
  }
  return freezeStaticSceneTransforms(root);
}
