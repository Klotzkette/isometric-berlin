import {
  GendarmenmarktFacadeBuilder,
  perimeterEdgeLength,
  type PerimeterFacadeEdge,
} from "./GendarmenmarktFacadeBuilder";

import { LeipzigerVoxelFrontV385 } from "./leipzigerVoxelFrontV385";

// The two street elevations photographed by KPMB. The endpoints and base
// are exterior surface vertices of the named Berlin LoD2 building parts.
export const canadaSquareFrontV385: PerimeterFacadeEdge = {
  startXZ: [385.909, 984.756],
  endXZ: [404.669, 962.634],
  outwardSide: 1,
  wallBaseY: 5.2,
  wallTopY: 27.23,
  street: "Leipziger Platz",
  prismId: "DEBE3DYO57c7Jtdb",
};
const ebertFront: PerimeterFacadeEdge = {
  startXZ: [353.874, 955.829],
  endXZ: [357.474, 932.798],
  outwardSide: -1,
  wallBaseY: 5.0,
  wallTopY: 31.53,
  street: "Ebertstraße",
  prismId: "DEBE3DXLyhYfJwcC",
};
const limestone = 0xd8cbb2,
  silver = 0xa6aaa0,
  shadow = 0x4f5654,
  glass = 0x637675,
  brass = 0x998365;

const voxelSquare = new LeipzigerVoxelFrontV385(
  "square",
  canadaSquareFrontV385.startXZ,
  canadaSquareFrontV385.endXZ,
  1,
);
const voxelEbert = new LeipzigerVoxelFrontV385(
  "ebert",
  ebertFront.startXZ,
  ebertFront.endXZ,
  -1,
);

class CanadianFrontBuilder extends GendarmenmarktFacadeBuilder {
  override face(
    edge: PerimeterFacadeEdge,
    u: number,
    y: number,
    width: number,
    height: number,
    depth: number,
    color: number,
    out = 0.2,
  ): void {
    if (!this.minecraft) {
      super.face(edge, u, y, width, height, depth, color, out);
      return;
    }
    const profile = edge === canadaSquareFrontV385 ? voxelSquare : voxelEbert;
    profile.panels(u, y, width, height, depth, out, (center, size, yaw) =>
      this.box(center, size, color, yaw),
    );
  }

  override point(
    edge: PerimeterFacadeEdge,
    u: number,
    y: number,
    out: number,
  ): [number, number, number] {
    if (this.minecraft) {
      const p = (
        edge === canadaSquareFrontV385 ? voxelSquare : voxelEbert
      ).point(u, y, out);
      if (p) return p;
    }
    return super.point(edge, u, y, out);
  }
}

function squareFront(b: GendarmenmarktFacadeBuilder): void {
  const edge = canadaSquareFrontV385,
    width = perimeterEdgeLength(edge),
    middle = width / 2;
  b.face(edge, middle, 16.18, width - 0.06, 21.96, 0.12, limestone, 0.12);
  // The photograph shows three broad glazed bays with external horizontal
  // louvers between two narrow stone wings; the two upper rows have eight axes.
  const wing = width * 0.129,
    pitch = (width - 2 * wing) / 3;
  for (let bay = 0; bay < 3; bay++) {
    const u = wing + (bay + 0.5) * pitch,
      w = pitch - 0.87;
    b.face(edge, u, 8.13, w, 5.5, 0.1, shadow, 0.24);
    b.face(edge, u, 8.23, w - 0.18, 5.22, 0.08, glass, 0.32);
    b.face(edge, u, 9.82, w, 0.18, 0.14, brass, 0.4);
    b.face(edge, u, 7.55, 0.1, 4.28, 0.1, brass, 0.41);
    b.face(edge, u, 15.58, w, 8.7, 0.1, shadow, 0.24);
    for (let row = 0; row < 10; row++)
      b.face(edge, u, 11.52 + row * 0.88, w - 0.2, 0.26, 0.25, silver, 0.4);
    for (const side of [-1, 1])
      b.face(
        edge,
        u + side * (w / 2 - 0.13),
        15.58,
        0.13,
        8.74,
        0.2,
        shadow,
        0.46,
      );
  }
  for (const x of [wing / 2, width - wing / 2]) {
    for (const y of [7.6, 12.75, 15.7, 18.69]) {
      b.face(edge, x, y, 2.06, y < 9 ? 4.25 : 2.27, 0.1, glass, 0.25);
      b.face(edge, x, y + 0.26, 2.06, 0.1, 0.12, silver, 0.34);
    }
  }
  for (const y of [21.74, 25.0]) {
    for (let bay = 0; bay < 8; bay++) {
      const u = ((bay + 0.5) * width) / 8;
      b.face(edge, u, y, 2.16, 2.38, 0.1, glass, 0.24);
      b.face(edge, u, y - 0.68, 2.16, 0.13, 0.1, silver, 0.33);
    }
  }
  // The source top of this narrow edge slopes from the 22 m street cornice
  // toward the setback. Fit the high panes entirely inside its roof profile.
  const upperRoof = [
    [0, 27.23],
    [10.3, 33.88],
    [19.18, 31.76],
    [24.19, 30.56],
    [28.93, 29.42],
  ];
  for (let bay = 0; bay < 8; bay++) {
    const u = ((bay + 0.5) * width) / 8;
    const hi = upperRoof.findIndex((point) => point[0] >= u);
    if (hi < 1) continue;
    const [a, bound] = [upperRoof[hi - 1], upperRoof[hi]];
    const top = a[1] + ((bound[1] - a[1]) * (u - a[0])) / (bound[0] - a[0]);
    for (const y of [28.55, 31.3]) {
      if (y + 1.5 > top) continue;
      b.face(edge, u, y, 2.08, 2.08, 0.1, glass, 0.22);
      b.face(edge, u, y - 0.58, 2.08, 0.12, 0.1, silver, 0.31);
    }
  }
  for (const fraction of [0.3, 0.555]) {
    const u = width * fraction;
    b.beam(
      b.point(edge, u, 10.3, 0.38),
      b.point(edge, u, 13.7, 2.04),
      0.08,
      brass,
    );
    const x = u - 0.6,
      h = 0.66;
    for (const [dx, w, c] of [
      [-0.45, 0.3, 0xb7282c],
      [0, 0.6, 0xebe8de],
      [0.45, 0.3, 0xb7282c],
    ])
      b.face(edge, x + dx, 13.23, w, h, 0.035, c, 2.01);
    // Small six-lobed silhouette on the white field, also legible on a block flag.
    b.face(edge, x, 13.23, 0.11, 0.41, 0.04, 0xb7282c, 2.05);
    b.face(edge, x, 13.23, 0.29, 0.12, 0.04, 0xb7282c, 2.05);
    for (const sign of [-1, 1])
      b.face(edge, x + sign * 0.078, 13.29, 0.075, 0.13, 0.04, 0xb7282c, 2.05);
  }
}

function ebertStreetFront(b: GendarmenmarktFacadeBuilder): void {
  const edge = ebertFront,
    width = perimeterEdgeLength(edge),
    center = width / 2;
  b.face(edge, center, 18.24, width - 0.05, 26.46, 0.12, limestone, 0.12);
  const opening = width * 0.79;
  b.face(edge, center, 18.06, opening, 25.46, 0.1, shadow, 0.24);
  b.face(edge, center, 8.06, opening - 0.22, 5.38, 0.1, glass, 0.31);
  b.face(edge, center, 12.71, opening - 0.22, 3.63, 0.1, 0x8e8e77, 0.31);
  for (let column = 0; column < 9; column++) {
    const u = center - opening / 2 + ((column + 0.5) * opening) / 9;
    b.face(edge, u, 10.24, 0.13, 9.28, 0.1, brass, 0.4);
  }
  for (let row = 0; row < 29; row++)
    b.face(
      edge,
      center,
      15.18 + row * 0.54,
      opening - 0.14,
      0.16,
      0.22,
      silver,
      0.4,
    );
  for (const side of [-1, 1])
    b.face(
      edge,
      center + (side * opening) / 2,
      18.1,
      0.18,
      25.35,
      0.2,
      shadow,
      0.43,
    );
}

/** Only the two photographed public street faces; the original building owns its volume. */
export function createCanadianPublicFrontsV385(native: boolean) {
  const b = new CanadianFrontBuilder(native, false, 0);
  squareFront(b);
  ebertStreetFront(b);
  return b.finish(
    "Canadian Embassy · Leipziger Platz and Ebertstraße public elevations",
  );
}
