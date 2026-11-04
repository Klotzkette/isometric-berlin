import {
  BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
} from "three";

import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = readonly [number, number, number];

// BBR dimensions, with display anchors read from Berlin's 2025 orthophoto.
// The opened terrace and forecourt share their authored support heights.
// The separate south court retains its delivered local terrain at 5.2 m.
export const BND_PUBLIC_ART_V314 = {
  palms: [
    { x: 287.25, z: -1639.25, groundY: 8.78, height: 22.55 },
    { x: 355.125, z: -1557.875, groundY: 5.2, height: 25.55 },
  ],
  mastDiameter: 0.508,
  crownDiameter: 5.6,
  monolith: { x: 455.4, z: -1686.35, groundY: 8.48, angle: -0.49, length: 20, width: 10, height: 4.3 },
} as const;

const TRUNK_TONES = [0x526752, 0x5c7058, 0x66795e];
const FROND_TONES = [0x4b6840, 0x5a7546, 0x68804b, 0x819058];
const CORTEN_TONES = [0x6c392c, 0x8a4a34, 0xa1583c, 0xb36647, 0xa75d40];

function cortenPoint(along: number, across: number, height: number): Point {
  const { x, z, angle, groundY } = BND_PUBLIC_ART_V314.monolith;
  const c = Math.cos(angle), s = Math.sin(angle);
  return [x + c * along - s * across, groundY + height, z + s * along + c * across];
}

function drawnArt(): Mesh {
  const positions: number[] = [], colors: number[] = [], color = new Color();
  const triangle = (a: Point, b: Point, c: Point, tone: number): void => {
    positions.push(...a, ...b, ...c);
    color.setHex(tone);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  const { mastDiameter, crownDiameter, palms } = BND_PUBLIC_ART_V314;
  for (const [index, palm] of palms.entries()) {
    const { groundY } = palm;
    const crownY = groundY + palm.height - 0.9;
    const tube = new CylinderGeometry(mastDiameter / 2, mastDiameter / 2, crownY - groundY, 10);
    const xyz = tube.getAttribute("position");
    const order = tube.getIndex()!;
    const mastVertex = (vertex: number): Point => [
      palm.x + xyz.getX(vertex),
      (groundY + crownY) / 2 + xyz.getY(vertex),
      palm.z + xyz.getZ(vertex),
    ];
    for (let i = 0; i < order.count; i += 3) {
      triangle(mastVertex(order.getX(i)), mastVertex(order.getX(i + 1)),
        mastVertex(order.getX(i + 2)), TRUNK_TONES[Math.floor(i / 6) % TRUNK_TONES.length]);
    }
    tube.dispose();

    // The artificial crown is a fan of individual folded leaves. Each long
    // blade has an open, staggered edge and a slender central rib.
    for (let leaf = 0; leaf < 21; leaf++) {
      const angle = leaf * Math.PI * 2 / 21 + index * 0.17;
      const dx = Math.cos(angle), dz = Math.sin(angle);
      const tier = leaf % 3;
      const length = crownDiameter / 2 - tier * 0.29;
      const rise = [0.26, 0.54, 0.9][tier], drop = [1.16, 0.46, 0][tier];
      const at = (t: number, side = 0, lift = 0): Point => [
        palm.x + dx * length * t - dz * side,
        crownY + rise * Math.sin(t * Math.PI / 2) - drop * t * t + lift,
        palm.z + dz * length * t + dx * side,
      ];
      for (let rib = 0; rib < 7; rib++) {
        const t = rib / 7, next = (rib + 1) / 7;
        const width = 0.245 * Math.sin((t + 0.075) * Math.PI);
        triangle(at(t, -0.019), at(t, 0.019), at(next), FROND_TONES[(leaf + 1) % 4]);
        for (const sign of [-1, 1]) {
          triangle(at(t), at(next), at(Math.min(1, next + 0.075), sign * width, -0.08),
            FROND_TONES[(leaf + (sign + 1) / 2) % 4]);
        }
      }
    }
  }

  // Six irregular cross sections give the boulder its blunt back, bowed
  // faces and lifted tip. Heights are fitted to the published 4.30 m envelope.
  const sections = [
    [-10, 0.55, 1.20, 1.45, 1.75],
    [-7.9, 3.25, 0.65, 2.30, 3.30],
    [-4.8, 4.45, 0.19, 2.72, 4.05],
    [-1.8, 5.00, 0.00, 2.78, 4.30],
    [2.8, 3.95, 0.48, 2.34, 3.70],
    [6.5, 2.35, 1.03, 2.03, 2.78],
    [10, 0.30, 1.67, 1.95, 2.16],
  ];
  const rings = sections.map(([along, width, foot, shoulder, crest], index) => {
    const skew = [0.8, 0.45, -0.10, 0, -0.55, -0.8, -0.65][index];
    return [
      cortenPoint(along, skew, foot),
      cortenPoint(along, skew - width, shoulder - 0.25),
      cortenPoint(along, skew - width * 0.60, crest - 0.17),
      cortenPoint(along, skew + width * 0.10, crest),
      cortenPoint(along, skew + width * 0.72, crest - 0.56),
      cortenPoint(along, skew + width, shoulder),
    ];
  });
  for (let slice = 0; slice < rings.length - 1; slice++) {
    for (let side = 0; side < rings[slice].length; side++) {
      const next = (side + 1) % rings[slice].length;
      const a = rings[slice], b = rings[slice + 1];
      const tone = CORTEN_TONES[[0, 1, 4, 3, 2, 1][side]];
      triangle(a[side], b[side], b[next], tone);
      triangle(a[side], b[next], a[next], tone);
    }
  }
  for (const ring of [rings[0], rings[rings.length - 1]]) {
    for (let i = 1; i < ring.length - 1; i++) triangle(ring[0], ring[i], ring[i + 1], CORTEN_TONES[1]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const dayMaterial = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const nightMaterial = new MeshStandardMaterial({
    vertexColors: true, side: DoubleSide, roughness: 0.82, metalness: 0.12,
  });
  const mesh = new Mesh(geometry, dayMaterial);
  mesh.name = "BND painted steel palms and weathered Corten monolith";
  mesh.userData = { dayMaterial, nightMaterial, textureFree: true };
  return mesh;
}

function nativeArt() {
  const rows: number[][] = [];
  const { palms, mastDiameter, monolith } = BND_PUBLIC_ART_V314;
  for (const palm of palms) {
    const { groundY } = palm;
    const pole = palm.height - 0.72, crownY = groundY + pole;
    rows.push([palm.x, groundY + pole / 2, palm.z, mastDiameter, pole, mastDiameter, TRUNK_TONES[1]]);
    const visited = new Set<string>();
    for (let direction = 0; direction < 12; direction++) {
      const angle = direction * Math.PI / 6;
      for (let step = 0; step < 6; step++) {
        const radius = step * 0.47, t = step / 5;
        const ix = Math.round(Math.cos(angle) * radius / 0.45);
        const iz = Math.round(Math.sin(angle) * radius / 0.45);
        const iy = Math.round((direction % 2 ? 0.56 * t : 0.40 * t - 1.36 * t * t) / 0.24);
        const key = `${ix},${iy},${iz}`;
        if (visited.has(key)) continue;
        visited.add(key);
        rows.push([palm.x + ix * 0.45, crownY + iy * 0.24, palm.z + iz * 0.45,
          0.45, 0.24, 0.45, FROND_TONES[direction % 4]]);
      }
    }
    rows.push([palm.x, groundY + palm.height - 0.09, palm.z, 0.27, 0.18, 0.27, FROND_TONES[2]]);
  }
  // Cardinal columns independently describe a tapered, lifted stone-like
  // silhouette. No rotated native boxes or smooth-mesh conversion.
  const step = 0.8;
  const c = Math.cos(monolith.angle), s = Math.sin(monolith.angle);
  for (let dx = -10; dx <= 10; dx += step) {
    for (let dz = -7; dz <= 7; dz += step) {
      const u = (dx * c + dz * s) / (monolith.length / 2);
      const v = (-dx * s + dz * c + 0.38 * u) / (monolith.width / 2);
      const radial = u * u + v * v * (1 + 0.48 * u);
      if (radial > 1) continue;
      const bottom = Math.abs(u + 0.18) < 0.15 && Math.abs(v) < 0.20 ? 0
        : Math.round((0.28 + 1.18 * u * u + 0.40 * u) / 0.18) * 0.18;
      const top = Math.round((2.08 + 2.22 * Math.sqrt(1 - radial) - 0.34 * u) / 0.18) * 0.18;
      rows.push([monolith.x + dx, monolith.groundY + (top + bottom) / 2, monolith.z + dz,
        step, top - bottom, step, CORTEN_TONES[Math.abs(Math.round(dx / step + dz / step)) % 4 + 1]]);
    }
  }
  const mesh = justicePalaceV183Boxes(rows, true);
  mesh.name = "BND cardinal palm crowns and Corten monolith";
  return mesh;
}

export function createBndPublicArtV314(native = false): Group {
  const root = new Group();
  root.name = "BND public art v314";
  root.userData = { publicExteriorOnly: true, keepInMinecraft: native, blockNative: native,
    textureFree: true, fullMobileIdentical: true };
  root.add(native ? nativeArt() : drawnArt());
  return freezeStaticSceneTransforms(root);
}
