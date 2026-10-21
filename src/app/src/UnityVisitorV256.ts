import source from "./data/unityVisitorV256.json";
import nativeSource from "./data/unityVisitorNativeV256.json";
import { letteringStrokePaths } from "./drawnLettering";

type Vec = [number, number, number];
interface Parts {
  native: boolean;
  box(p: Vec, size: Vec, tint: number, yaw?: number): void;
  beam(a: Vec, b: Vec, width: number, height: number, tint: number): void;
}

export const UNITY_VISITOR_V256 = {
  flagAnchor: [226.039773, 57.925456] as const,
  poleHeightM: 28.5,
  flagAreaM2: 60,
  inscription: ["DEUTSCHE EINHEIT", "3. OKTOBER 1990"],
  source,
  nativeSource,
  fittingsStatus: "Reference-based display estimates; existing mast and cloth unchanged",
};

/** Static fittings share the existing public-space instance batch and disposal. */
export function appendUnityVisitorV256(parts: Parts, terrainAt: (x: number, z: number) => number) {
  const [x, z] = UNITY_VISITOR_V256.flagAnchor;
  const y = terrainAt(x, z);
  // The Sir James close reference shows a flush square bronze plate, circular
  // collar and raised circular lettering, not a tall stone pedestal.
  parts.box([x, y + .013, z], [1.66, .026, 1.66], 0x887b58);
  const segments = parts.native ? 40 : 64;
  for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
    for (const [r, tint] of [[.54, 0xaa9463], [.76, 0x675e49]]) {
      if (parts.native) {
        const n = Math.ceil((b - a) * r / .025);
        for (let k = 0; k < n; k++) {
          const t = a + (b - a) * (k + .5) / n;
          parts.box([x + Math.cos(t) * r, y + .036, z + Math.sin(t) * r],
            [.025, .016, .025], tint);
        }
      } else parts.beam([x + Math.cos(a) * r, y + .036, z + Math.sin(a) * r],
          [x + Math.cos(b) * r, y + .036, z + Math.sin(b) * r], .025, .016, tint);
    }
  }
  // Use the project's original stroke alphabet as raised metal, without a
  // texture or imported font. Native letters are independent axis-aligned cells.
  for (const [index, text] of UNITY_VISITOR_V256.inscription.entries()) {
    const paths = letteringStrokePaths(text, .105);
    const all = paths.flat(), lo = Math.min(...all.map(p => p[0])), hi = Math.max(...all.map(p => p[0]));
    const at = (p: number[]): Vec => {
      const a = (p[0] - (lo + hi) / 2) / .64 + (index === 0 ? -Math.PI / 2 : Math.PI / 2);
      const r = .64 + (index === 0 ? p[1] : -p[1]);
      return [x + Math.cos(a) * r, y + .055, z + Math.sin(a) * r];
    };
    for (const path of paths) for (let i = 1; i < path.length; i++) {
      const a = at(path[i - 1]), b = at(path[i]);
      if (!parts.native) parts.beam(a, b, .012, .012, 0xd5c18e);
      else {
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / .025));
        for (let k = 0; k < n; k++) {
          const t = (k + .5) / n;
          parts.box([a[0] + (b[0] - a[0]) * t, a[1], a[2] + (b[2] - a[2]) * t],
            [.023, .012, .023], 0xd5c18e);
        }
      }
    }
  }
  // Every joint is clipped to one retained LoD2 perimeter edge. No hypothetical
  // BIZ, visitor tunnel, entrance position or security equipment is inferred.
  let containerJoints = 0;
  if (parts.native) {
    // The retained native shell has 4 m cells and 4 m height; its roof and
    // exposed perimeter differ from the measured smooth prism in both axes.
    for (const [x, z, y0, top, alongX] of nativeSource.exposedEdges) {
      parts.box([x, top - .07, z],
        alongX ? [nativeSource.cellM, .14, .12] : [.12, .14, nativeSource.cellM], 0xc6cbc9);
      parts.box([x, (y0 + top) / 2, z], [.065, top - y0 - .2, .065], 0x7f8989);
      containerJoints++;
    }
    return { sourceOwner: source.owner, containerJoints, bronzePlaque: true, native: true };
  }
  for (let i = 1; i < source.ring.length; i++) {
    const a = source.ring[i - 1], b = source.ring[i];
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const y0 = source.renderedGroundY, height = source.renderedHeightM, top = y0 + height;
    parts.beam([a[0], top - .07, a[1]], [b[0], top - .07, b[1]], .12, .14, 0xc6cbc9);
    for (let d = 1.5; d < length; d += 3) {
      parts.box([a[0] + dx * d / length, y0 + height / 2, a[1] + dz * d / length],
        [.065, height - .2, .065], 0x7f8989);
      containerJoints++;
    }
  }
  return { sourceOwner: source.owner, containerJoints, bronzePlaque: true, native: parts.native };
}
