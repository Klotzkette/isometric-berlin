import { Group } from "three";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import type { SurroundingChunkGeometry } from "./SurroundingCityGeometry";
import { terrainGroundAt } from "./weinbergTerrainV176";
import {
  Batch,
  mix,
  lift,
  railing,
  ribbon,
  drawCrossingV378,
  type P,
  type WaterwayCrossingV378,
} from "./waterwayBridgeGeometryV378";
import { coreCrossingsV378 } from "./waterwayReplacementV378";
import { registerLandwehrFloorsV378 } from "./waterwayFloorsV378";
type XZ = number[];
type SourceLine = [number, number, number, number[][]];
export interface WaterwayPacketV378 {
  lines: SourceLine[];
  bridges: WaterwayCrossingV378[];
  core: number[];
  gates: [string, number[][]][];
}

const walkTones = [
  0xbab5a6, 0x777976, 0xbcb9ac, 0xb5b3ad, 0xaaa59a, 0xbcae94, 0xc5bba3,
  0x9f927a, 0x94a07d, 0xd2c4a4, 0xa18b72, 0x979b99,
];
const canopy = [0x607c50, 0x61794c, 0x788752, 0x6c8459, 0x798d5d, 0x728556];
function bush(
  batch: Batch,
  p: P,
  r: number,
  height: number,
  native: boolean,
  seed: number,
) {
  const sides = native ? 4 : 6,
    phase = native ? Math.PI / 4 : (seed % 11) * 0.21;
  const hue = Math.abs(seed) % canopy.length;
  const rings = [0, 0.62, 0.88].map((h, level) =>
    Array.from({ length: sides }, (_, i): P => {
      const k = phase + (i * 2 * Math.PI) / sides;
      const shape = level === 0 ? 0.77 : level === 1 ? 1 : 0.56;
      return [
        p[0] + Math.cos(k) * r * shape,
        p[1] + h * height,
        p[2] + Math.sin(k) * r * shape * 0.87,
      ];
    }),
  );
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    for (let y = 0; y < 2; y++)
      batch.face(
        [rings[y][i], rings[y][j], rings[y + 1][j], rings[y + 1][i]],
        canopy[(hue + (i % 3 === 0 ? 2 : 0) + y) % canopy.length],
      );
    batch.face(
      [rings[2][i], rings[2][j], [p[0], p[1] + height, p[2]]],
      canopy[(hue + 2) % canopy.length],
    );
  }
}

function bankLine(batch: Batch, row: SourceLine, origin: XZ, native: boolean) {
  const [kind, tone, w, encoded] = row;
  const pts = encoded.map((v): P => {
    const x = origin[0] + v[0] / 10,
      z = origin[1] + v[1] / 10;
    return [
      x,
      v.length > 2 ? v[native ? 3 : 2] / 10 : terrainGroundAt(x, z, 3, native),
      z,
    ];
  });
  if (kind === 5) {
    for (const p of pts) {
      const seed = Math.abs(Math.round(p[0] * 7 + p[2] * 13));
      bush(
        batch,
        p,
        1.12 + (seed % 10) * 0.09,
        0.84 + (seed % 13) * 0.085,
        native,
        seed,
      );
    }
    return;
  }
  if (pts.length < 2) return;
  if (kind <= 1) {
    ribbon(
      batch,
      pts.map((p) => lift(p, 0.225)),
      w / 10,
      walkTones[tone] ?? walkTones[0],
    );
    return;
  }
  if (kind <= 3) {
    railing(batch, pts, w / 10, kind === 3);
    return;
  }
  // The mapped hedge follows the line continuously, even where no height was supplied.
  let next = 0,
    at = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (!l) continue;
    while (next < at + l) {
      const p = mix(a, b, (next - at) / l);
      bush(batch, p, 0.91, w / 10, native, Math.abs(Math.round(p[0] + p[2])));
      next += 1.22;
    }
    at += l;
  }
}

export function createWaterwaysV378(
  packet: WaterwayPacketV378,
  host: string,
  native: boolean,
) {
  const cell = /^water378-(-?\d+)_(-?\d+)$/.exec(host);
  if (!cell) throw Error("Invalid shoreline cell " + host);
  const origin = [Number(cell[1]) * 1024, Number(cell[2]) * 1024],
    root = new Group();
  root.name =
    (native ? "Minecraft" : "Drawn") +
    " mapped shore and Landwehrkanal crossings " +
    host;
  const banks = new Batch(),
    spans = new Batch();
  for (const row of packet.lines) bankLine(banks, row, origin, native);
  const bridges = native
    ? [...packet.bridges, ...packet.core.map((i) => coreCrossingsV378[i])]
    : packet.bridges;
  for (const bridge of bridges) drawCrossingV378(spans, bridge, native);
  for (const [, points] of packet.gates) {
    // Hinge/sill positions at the actual gate ends; the survey contains no
    // live gate state, so the navigation channel remains open between them.
    for (const [x, z] of [points[0], points[points.length - 1]])
      spans.beam([x, -1.3, z], [x, 3.09, z], 0.38, 0.38, 0x6f7771);
  }
  const bankMesh = banks.mesh("Surveyed bank paths, railings and scrub");
  const bridgeMesh = spans.mesh("Landwehrkanal openings and lock details");
  if (bankMesh) root.add(bankMesh);
  if (bridgeMesh) root.add(bridgeMesh);
  root.userData = {
    waterwaysV378: true,
    bridgeNames: bridges.map((r) => r.name),
  };
  return root;
}

export async function attachWaterwaysV378(
  entry: SurroundingChunkGeometry,
  host: string,
  native: boolean,
  signal: AbortSignal,
) {
  const c = /^water378-(-?\d+)_(-?\d+)$/.exec(host);
  if (!c) return;
  signal.throwIfAborted();
  const name =
    "r" + Math.floor(Number(c[1]) / 4) + "_" + Math.floor(Number(c[2]) / 4);
  const { default: region } = await import(`./data/waterwaysV378/${name}.json`);
  signal.throwIfAborted();
  const packet = region[host] as WaterwayPacketV378 | undefined;
  if (packet) {
    attachWorldSpaceDetail(entry, createWaterwaysV378(packet, host, native));
    // Core bridge bodies exist before any visible shoreline packet. Register
    // resident-only navigation for the additional outer and native structures.
    const rows = native
      ? [...packet.bridges, ...packet.core.map((i) => coreCrossingsV378[i])]
      : packet.bridges;
    registerLandwehrFloorsV378(entry.root, rows, native);
  }
}
