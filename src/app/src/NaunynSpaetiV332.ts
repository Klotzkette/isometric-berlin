import {
  BufferGeometry, Color, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Uint16BufferAttribute,
} from "three";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const NAUNYN_SPAETI_V332 = Object.freeze({
  title: "Späti 24/7",
  address: "Naunynstraße 76",
  tile: "6_4",
  owner: "DEBE02YY400002Pd",
  worldXZ: Object.freeze([3524.20411471475, 2064.88198677] as const),
  drawnSha256: "f8cb31c723b1b20f971acc96b6a1fe1f649e47f7d0eb69c262671bb16e9d2609",
  nativeSha256: "0e39c684efcae6aa4323d33d52bfed425bb47d31e2664565ae40843c4bea1a10",
});

const LETTERING = "SPÄTI 24/7";
const FRAME = 0xb6ac9c;
const DARK_FASCIA = 0x232021;
const GOLD = 0xffc565;
const AWNING_EDGE = 0x1e6d63;
type XY = readonly [number, number];

/**
 * Fit only the occupied business fascia. Published 6_4 wall and its companions
 * were checked after the actual recipe loader. Sash dimensions and lettering
 * placement are display estimates informed by the operator's exterior photo.
 */
export function createNaunynSpaetiV332(native: boolean): Group {
  const root = new Group();
  root.name = `${NAUNYN_SPAETI_V332.title} — ${NAUNYN_SPAETI_V332.address}`;
  root.userData = {
    textureFree: true, blockNative: native, nativeMinecraft: native,
    sourceWallOwnerV332: NAUNYN_SPAETI_V332.owner,
  };
  if (native) {
    // Independent 2 m cardinal wall cell of the actual native packet.
    root.position.set(3525, 6.02, 2064);
    root.rotation.y = Math.PI;
  } else {
    // The projected point on the surveyed frontage. Local +Z faces the street.
    root.position.set(3524.56124942534, 6.02, 2064.13962810192);
    root.rotation.y = Math.atan2(8.9, -18.5);
  }

  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const tint = new Color();
  const quad = (points: readonly XY[], depth: number, rgb: number): void => {
    const first = positions.length / 3;
    tint.setHex(rgb);
    for (const [x, y] of points) {
      positions.push(x, y, depth);
      colors.push(tint.r, tint.g, tint.b);
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };
  const rectangle = (left: number, bottom: number, right: number, top: number,
    depth: number, rgb: number): void => {
    quad([[left, bottom], [right, bottom], [right, top], [left, top]], depth, rgb);
  };
  const half = native ? .8 : 2.4;
  const height = native ? .24 : .36;
  rectangle(-half, -height, half, height, .047, FRAME);
  rectangle(-half + .035, -height + .035, half - .035, height - .035, .059, DARK_FASCIA);
  rectangle(-half, -height - .052, half, -height - .012, .062, AWNING_EDGE);

  const capHeight = native ? .185 : .44;
  const pixel = .024;
  const cells = new Map<string, XY>();
  for (const stroke of letteringStrokePaths(LETTERING, capHeight)) {
    for (let i = 1; i < stroke.length; i++) {
      const [ax, ay] = stroke[i - 1], [bx, by] = stroke[i];
      const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
      if (length === 0) continue;
      if (native) {
        const count = Math.ceil(length / (pixel * .5));
        for (let step = 0; step <= count; step++) {
          const x = Math.round((ax + dx * step / count) / pixel);
          const y = Math.round((ay + dy * step / count - capHeight / 2) / pixel);
          cells.set(`${x},${y}`, [x * pixel, y * pixel]);
        }
      } else {
        const side = .024;
        const nx = -dy / length * side, ny = dx / length * side;
        const a = ay - capHeight / 2, b = by - capHeight / 2;
        quad([[ax + nx, a + ny], [ax - nx, a - ny], [bx - nx, b - ny], [bx + nx, b + ny]], .071, GOLD);
      }
    }
  }
  for (const [x, y] of cells.values()) {
    const r = pixel / 2;
    rectangle(x - r, y - r, x + r, y + r, .071, GOLD);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(new Uint16BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true });
  const night = native ? day : new MeshStandardMaterial({ vertexColors: true, roughness: .82 });
  const face = new Mesh(geometry, day);
  face.name = "Naunynstraße 76 — storefront fascia and vector title";
  face.userData = { dayMaterial: day, nightMaterial: night, lettering: LETTERING };
  root.add(face);
  return freezeStaticSceneTransforms(root);
}
