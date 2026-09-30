import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  TorusGeometry,
} from "three";
import { type Builder, paintGeometry } from "./drawnKit";
import { GEDAECHTNISKIRCHE_RUIN_PROFILE as P } from "./gedaechtniskircheRuinProfile";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GEDAECHTNISKIRCHE_RETAINED_WINGS } from "./gedaechtniskircheSourceParts";
import { GEDAECHTNISKIRCHE_CLOCK_STROKES } from "./gedaechtniskircheClock";

const STONE = 0x999387,
  LIGHT = 0xb4ad9e,
  DARK = 0x666760;
const RECESS = 0x303b3c,
  COPPER = 0x657e79,
  GOLD = 0xd1ad4a;
type Point = readonly [number, number];

/** Photographically checked architectural reconstruction, not a measured
 * stone survey. All detail is merged; no image textures or per-frame work. */
export function addGedaechtniskircheRuin(builder: Builder): void {
  const put = (g: BufferGeometry, color: number, ink = false): void => {
    // ExtrudeGeometry emits triangles, while the other kit primitives use
    // indices. Keep the shared batch consistently indexed before merging.
    if (!g.index)
      g.setIndex(
        Array.from({ length: g.getAttribute("position").count }, (_, i) => i),
      );
    g.rotateY(P.rotationY);
    g.translate(P.centerWorldM[0], 5.2, P.centerWorldM[1]);
    paintGeometry(g, color);
    const original = g;
    g = mergeVertices(g, 1e-6);
    original.dispose();
    builder.parts.push(g);
    if (ink) builder.edges.push(new EdgesGeometry(g, 35));
  };
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color = STONE,
    yaw = 0,
    ink = false,
  ): void => {
    const g = new BoxGeometry(w, h, d);
    g.rotateY(yaw);
    g.translate(x, y, z);
    put(g, color, ink);
  };
  const facetBox = (
    u: number,
    y: number,
    r: number,
    w: number,
    h: number,
    d: number,
    yaw: number,
    color = STONE,
  ): void => {
    box(
      u * Math.cos(yaw) + r * Math.sin(yaw),
      y,
      r * Math.cos(yaw) - u * Math.sin(yaw),
      w,
      h,
      d,
      color,
      yaw,
    );
  };
  const cylinder = (
    x: number,
    y: number,
    z: number,
    bottom: number,
    top: number,
    h: number,
    color: number,
    n = 16,
  ): void => {
    const g = new CylinderGeometry(top, bottom, h, n);
    g.translate(x, y, z);
    put(g, color);
  };
  const faceGeometry = (
    g: BufferGeometry,
    yaw: number,
    r: number,
    color: number,
    ink = false,
  ): void => {
    g.translate(0, 0, r);
    g.rotateY(yaw);
    put(g, color, ink);
  };
  const outline = (
    points: readonly Point[],
    holes: Path[],
    yaw: number,
    r: number,
    color: number,
    thickness = 0.65,
  ): void => {
    const s = new Shape();
    s.moveTo(...points[0]);
    for (const point of points.slice(1)) s.lineTo(...point);
    s.closePath();
    s.holes.push(...holes);
    faceGeometry(
      new ExtrudeGeometry(s, {
        depth: thickness,
        bevelEnabled: false,
        curveSegments: 16,
      }),
      yaw,
      r,
      color,
    );
  };
  const circle = (u: number, y: number, radius: number): Path => {
    const p = new Path();
    p.absarc(u, y, radius, 0, Math.PI * 2, true);
    return p;
  };
  const arch = (
    u: number,
    bottom: number,
    spring: number,
    radius: number,
  ): Path => {
    const p = new Path();
    p.moveTo(u - radius, bottom);
    p.lineTo(u - radius, spring);
    p.absarc(u, spring, radius, Math.PI, 0, true);
    p.lineTo(u + radius, bottom);
    p.closePath();
    return p;
  };
  const ring = (
    u: number,
    y: number,
    r: number,
    radius: number,
    tube: number,
    yaw: number,
    color: number,
    half = false,
  ): void => {
    const g = new TorusGeometry(
      radius,
      tube,
      4,
      32,
      half ? Math.PI : Math.PI * 2,
    );
    g.translate(u, y, 0);
    faceGeometry(g, yaw, r, color);
  };
  const archivolt = (
    u: number,
    bottom: number,
    spring: number,
    radius: number,
    yaw: number,
    r: number,
    layers = 2,
  ): void => {
    for (let n = 0; n < layers; n++) {
      const rad = radius + 0.12 + n * 0.28;
      ring(
        u,
        spring,
        r + n * 0.065,
        rad,
        0.14,
        yaw,
        n % 2 === 0 ? LIGHT : DARK,
        true,
      );
      for (const side of [-1, 1])
        facetBox(
          u + side * rad,
          (bottom + spring) / 2,
          r + n * 0.065,
          0.22,
          spring - bottom,
          0.32,
          yaw,
          LIGHT,
        );
    }
  };
  const stroke = (
    a: Point,
    b: Point,
    yaw: number,
    r: number,
    width: number,
    color: number,
  ): void => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const g = new BoxGeometry(width, Math.hypot(dx, dy), 0.2);
    g.rotateZ(-Math.atan2(dx, dy));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
    faceGeometry(g, yaw, r, color);
  };
  const flatStroke = (
    a: Point,
    b: Point,
    yaw: number,
    r: number,
    width: number,
    color: number,
  ): void => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = ((b[1] - a[1]) * width) / (2 * length);
    const dy = ((a[0] - b[0]) * width) / (2 * length);
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new Float32BufferAttribute(
        [
          a[0] - dx,
          a[1] - dy,
          0,
          a[0] + dx,
          a[1] + dy,
          0,
          b[0] + dx,
          b[1] + dy,
          0,
          b[0] - dx,
          b[1] - dy,
          0,
        ],
        3,
      ),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    faceGeometry(g, yaw, r, color);
  };
  // Vertex-coloured ashlar planes carry finer stone variation cheaply. The
  // admission predicate prevents any detail from closing actual openings.
  const masonry = (
    yaw: number,
    r: number,
    w: number,
    bottom: number,
    top: number,
    accept: (u: number, y: number) => boolean,
  ): void => {
    const colors = [0xaaa497, 0x95968d, 0xb2ac9d, 0x81867e, 0x9f9b90, 0xaca99d];
    const pitchY = 0.72,
      pitchX = 1.16;
    for (let row = 0; bottom + row * pitchY < top; row++) {
      const y = bottom + (row + 0.5) * pitchY;
      for (let col = 0; col < Math.ceil(w / pitchX); col++) {
        const u = -w / 2 + (col + 0.5) * pitchX + (row % 2) * pitchX * 0.5;
        const ww = Math.min(pitchX - 0.07, w / 2 - u);
        if (
          ww < 0.1 ||
          y + 0.3 > top ||
          ![-1, 1].every((a) =>
            [-1, 1].every((b) => accept(u + (a * ww) / 2, y + b * 0.32)),
          )
        )
          continue;
        const g = new BufferGeometry();
        g.setAttribute(
          "position",
          new Float32BufferAttribute(
            [
              u - ww / 2,
              y - 0.32,
              0,
              u + ww / 2,
              y - 0.32,
              0,
              u + ww / 2,
              y + 0.32,
              0,
              u - ww / 2,
              y + 0.32,
              0,
            ],
            3,
          ),
        );
        g.setIndex([0, 1, 2, 0, 2, 3]);
        const hash =
          ((row * 73856093) ^
            (col * 19349663) ^
            (Math.round(yaw * 4) * 83492791)) >>>
          0;
        faceGeometry(g, yaw, r, colors[hash % colors.length]);
      }
    }
  };
  // Raised nave/rose opening above the surviving ground-level memorial hall.
  // The modest central entrance is walkable; the former ten-metre ground
  // arch was an erroneous interpretation of the elevated circular breach.
  const door = P.portal,
    rose = P.roseBreach;
  const notOpening = (u: number, y: number): boolean =>
    Math.hypot(u, y - rose.centerHeightM) > rose.radiusM + 0.2 &&
    !(
      Math.abs(u) < door.archRadiusM + 0.2 &&
      y <
        door.springHeightM +
          Math.sqrt(Math.max(0, (door.archRadiusM + 0.2) ** 2 - u * u))
    );
  for (const yaw of [0, Math.PI]) {
    const east = yaw === 0;
    const points: Point[] = [
      [-15.5, 0],
      [-door.archRadiusM, 0],
      [-door.archRadiusM, door.springHeightM],
    ];
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI - (i * Math.PI) / 20;
      points.push([
        Math.cos(a) * door.archRadiusM,
        door.springHeightM + Math.sin(a) * door.archRadiusM,
      ]);
    }
    points.push([door.archRadiusM, 0], [15.5, 0], [15.5, 23], [-15.5, 23]);
    outline(
      points,
      [
        east
          ? arch(0, 8.5, 17, 5.8)
          : circle(0, rose.centerHeightM, rose.radiusM),
      ],
      yaw,
      8.3,
      STONE,
    );
    const eastSolid = (u: number, y: number): boolean =>
      notOpening(u, y) &&
      !(
        Math.abs(u) < 6 &&
        y > 8.3 &&
        y < 17 + Math.sqrt(Math.max(0, 36 - u * u))
      );
    masonry(yaw, 8.97, 31, 0, 23, east ? eastSolid : notOpening);
    archivolt(0, 0, door.springHeightM, door.archRadiusM, yaw, 9.1, 3);
    if (east) archivolt(0, 8.5, 17, 5.8, yaw, 9.05, 3);
    else
      for (const rad of [5.97, 6.26, 6.56])
        ring(0, rose.centerHeightM, 9.05, rad, 0.15, yaw, LIGHT);
    // Radial wedge joints read as carved voussoirs rather than a painted disk.
    for (let i = 0; i < (east ? 24 : 48); i++) {
      const a = (i * Math.PI) / 24;
      if (!east)
        stroke(
          [Math.sin(a) * 5.9, rose.centerHeightM + Math.cos(a) * 5.9],
          [Math.sin(a) * 6.6, rose.centerHeightM + Math.cos(a) * 6.6],
          yaw,
          9.22,
          0.055,
          DARK,
        );
    }
    for (const u of [-11.5, 11.5]) {
      facetBox(u, 11.5, 9.1, 1.35, 23, 0.8, yaw, LIGHT);
      for (const y of [5.5, 14.5]) {
        outline(
          [
            [u - 0.55, y - 1.4],
            [u + 0.55, y - 1.4],
            [u + 0.55, y + 0.8],
            [u - 0.55, y + 0.8],
          ],
          [],
          yaw,
          9.55,
          RECESS,
          0.04,
        );
        archivolt(u, y - 1.4, y + 0.7, 0.55, yaw, 9.65, 1);
      }
    }
    // Large Romanesque gable with three windows and the small rose above.
    if (!east) {
      const holes = [
        arch(-5, 24, 26, 1.25),
        arch(5, 24, 26, 1.25),
        arch(0, 24, 26.1, 1.1),
        circle(0, 29, 1.0),
      ];
      outline(
        [
          [-10.5, 23],
          [10.5, 23],
          [0, 32],
        ],
        holes,
        yaw,
        8.3,
        STONE,
      );
      for (const u of [-5, 0, 5])
        archivolt(u, 24, 26, u === 0 ? 1.1 : 1.25, yaw, 9.05, 2);
      ring(0, 29, 9.05, 1.18, 0.16, yaw, LIGHT);
      for (let petal = 0; petal < 6; petal++) {
        const a = (petal * Math.PI) / 3;
        ring(
          Math.cos(a) * 0.48,
          29 + Math.sin(a) * 0.48,
          9.12,
          0.33,
          0.09,
          yaw,
          LIGHT,
        );
      }
      for (const side of [-1, 1]) {
        stroke([side * 10.6, 23], [0, 32.2], yaw, 9.02, 0.45, DARK);
        stroke([side * 10.6, 23.5], [0, 32.7], yaw, 8.95, 0.35, COPPER);
        for (let k = 1; k < 8; k++) {
          const u = side * (10 - k * 1.17),
            y = 23.7 + k * 0.95;
          ring(u, y, 9.1, 0.42, 0.12, yaw, LIGHT, true);
          facetBox(u - side * 0.42, y - 0.4, 9.1, 0.2, 0.8, 0.2, yaw, LIGHT);
        }
      }
    } else {
      // The nave side is war-damaged vault masonry, not a second restored
      // west rose facade. Preserve uneven shoulders and exposed brick scars.
      for (const side of [-1, 1]) {
        outline(
          [
            [side * 10.5, 23],
            [side * 10.5, 28.4],
            [side * 8.7, 28.4],
            [side * 8.7, 26.9],
            [side * 7.2, 26.9],
            [side * 7.2, 25.7],
            [side * 4.8, 25.7],
            [side * 4.8, 23],
          ],
          [],
          yaw,
          8.3,
          DARK,
        );
        for (let i = 0; i < 14; i++)
          facetBox(
            side * (6 + (i % 4) * 1.1),
            23.4 + Math.floor(i / 4) * 0.6,
            9.02,
            0.78,
            0.42,
            0.13,
            yaw,
            i % 3 ? 0x89715e : 0xa99276,
          );
      }
      ring(0, 17, 8.15, 6.6, 0.55, yaw, 0x89715e, true);
    }
    // Blind arcade across the cornice, clear of the gable window openings.
    for (let u = -14; u <= 14; u += 1.2) {
      ring(u, 22, 9.15, 0.5, 0.12, yaw, LIGHT, true);
      facetBox(u - 0.5, 21.7, 9.15, 0.17, 0.6, 0.18, yaw, LIGHT);
    }
  }
  for (const side of [-1, 1]) {
    box(side * 14.95, 11.5, 0, 1.1, 23, 17, STONE);
    const yaw = (side * Math.PI) / 2;
    masonry(yaw, 15.52, 18, 0, 23, () => true);
    // North/south cross-gable on the lower surviving transept wall.
    outline(
      [
        [-8.9, 23],
        [8.9, 23],
        [0, 30.3],
      ],
      [
        arch(-3.3, 24, 25.6, 0.95),
        arch(3.3, 24, 25.6, 0.95),
        circle(0, 27.6, 1.25),
      ],
      yaw,
      15.0,
      STONE,
    );
    for (const u of [-3.3, 3.3]) archivolt(u, 24, 25.6, 0.95, yaw, 15.7, 2);
    ring(0, 27.6, 15.7, 1.4, 0.17, yaw, LIGHT);
    for (const sign of [-1, 1])
      stroke([sign * 9, 23], [0, 30.5], yaw, 15.7, 0.35, COPPER);
  }
  box(0, 0.8, 0, 28, 0.18, 16, 0xa69e8a); // hall floor, no raised obstruction
  box(0, 7.9, 0, 29, 0.45, 16, 0x766e5b); // retained hall vault/floor below the breach
  // Recessed rear surfaces and vault ribs are visible THROUGH the rose hole.
  for (const z of [-5, 0, 5]) ring(0, 10.0, z, 6.25, 0.2, 0, LIGHT, true);
  // Keep the gable windows open through both faces below the clock shaft.
  box(-10.05, 27, 0, 0.9, 8, 16.4, STONE);
  box(10.05, 27, 0, 0.9, 8, 16.4, STONE);
  box(0, 35.75, 0, 21, 9.5, 16.4, STONE);
  for (let face = 0; face < 4; face++) {
    const yaw = (face * Math.PI) / 2,
      r = face % 2 === 0 ? 8.22 : 10.52,
      w = face % 2 === 0 ? 21 : 16.4;
    masonry(
      yaw,
      r + 0.04,
      w,
      31,
      40,
      (u, y) => Math.hypot(u, y - P.clock.centerHeightM) > 3.75,
    );
    const cy = P.clock.centerHeightM;
    ring(0, cy, r + 0.22, 3.56, 0.22, yaw, LIGHT);
    outline(
      [
        [-3.4, cy - 3.4],
        [3.4, cy - 3.4],
        [3.4, cy + 3.4],
        [-3.4, cy + 3.4],
      ],
      [],
      yaw,
      r + 0.07,
      STONE,
      0.06,
    );
    // Open tracery within the gold clock face, not a solid black clock disk.
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3;
      ring(
        Math.sin(a) * 1.38,
        cy + Math.cos(a) * 1.38,
        r + 0.26,
        0.92,
        0.23,
        yaw,
        RECESS,
      );
    }
    ring(0, cy, r + 0.41, 3.26, 0.075, yaw, GOLD);
    ring(0, cy, r + 0.41, 2.56, 0.075, yaw, GOLD);
    for (let i = 0; i < 60; i++) {
      const a = (i * Math.PI) / 30,
        lo = i % 5 === 0 ? 3.25 : 3.31;
      stroke(
        [Math.sin(a) * lo, cy + Math.cos(a) * lo],
        [Math.sin(a) * 3.46, cy + Math.cos(a) * 3.46],
        yaw,
        r + 0.46,
        i % 5 === 0 ? 0.085 : 0.04,
        GOLD,
      );
    }
    for (const [a, b] of GEDAECHTNISKIRCHE_CLOCK_STROKES)
      flatStroke(
        [a[0], cy + a[1]],
        [b[0], cy + b[1]],
        yaw,
        r + 0.6,
        0.065,
        GOLD,
      );
    for (const [a, len] of [
      [-0.92, 1.9],
      [0.3, 2.7],
    ])
      stroke(
        [0, cy],
        [Math.sin(a) * len, cy + Math.cos(a) * len],
        yaw,
        r + 0.53,
        0.14,
        GOLD,
      );
    ring(0, cy, r + 0.56, 0.24, 0.14, yaw, GOLD);
  }
  for (const x of [-9.7, 9.7])
    for (const z of [-7.6, 7.6]) {
      cylinder(x, 29.5, z, 1.15, 1.15, 7, STONE, 8);
      cylinder(x, 33, z, 1.45, 1.45, 0.5, LIGHT, 8);
      cylinder(x, 35, z, 1.55, 0.08, 4, COPPER, 8);
      for (let side = 0; side < 8; side++) {
        const a = (side * Math.PI) / 4;
        box(
          x + Math.sin(a) * 1.16,
          32,
          z + Math.cos(a) * 1.16,
          0.35,
          1.05,
          0.1,
          RECESS,
          a,
        );
      }
    }
  // Eight-sided upper storeys with genuinely open, differentiated arches.
  const B = P.belfry,
    apothem = B.radiusM * Math.cos(Math.PI / 8),
    fw = 2 * B.radiusM * Math.sin(Math.PI / 8);
  for (let face = 0; face < 8; face++) {
    const yaw = (face * Math.PI) / 4;
    outline(
      [
        [-fw / 2, 40],
        [fw / 2, 40],
        [fw / 2, 43.5],
        [-fw / 2, 43.5],
      ],
      [],
      yaw,
      apothem - 0.5,
      STONE,
    );
    for (const u of [-2.4, 0, 2.4]) {
      outline(
        [
          [u - 0.7, 40.4],
          [u + 0.7, 40.4],
          [u + 0.7, 42],
          [u - 0.7, 42],
        ],
        [],
        yaw,
        apothem + 0.16,
        RECESS,
        0.05,
      );
      archivolt(u, 40.4, 42, 0.7, yaw, apothem + 0.24, 1);
    }
    for (const y of [39.8, 43, 43.6])
      facetBox(0, y, apothem + 0.2, fw + 0.35, 0.4, 0.85, yaw, LIGHT);
    for (let u = -fw / 2 + 0.6; u < fw / 2; u += 1.05)
      facetBox(u, 43, apothem + 0.67, 0.35, 0.4, 0.2, yaw, DARK);
    const holes: Path[] = [];
    if (face % 2 === 0) {
      holes.push(
        arch(-1.5, 44.2, 51.4, 1.18),
        arch(1.5, 44.2, 51.4, 1.18),
        circle(0, 54, 1),
      );
    } else {
      const h = new Path();
      h.moveTo(-2.5, 44.2);
      h.lineTo(-2.5, 51.3);
      h.bezierCurveTo(-3.2, 52.5, -1.5, 53.5, -1.5, 53.5);
      h.bezierCurveTo(-1.4, 55.5, 1.4, 55.5, 1.5, 53.5);
      h.bezierCurveTo(1.5, 53.5, 3.2, 52.5, 2.5, 51.3);
      h.lineTo(2.5, 44.2);
      h.closePath();
      holes.push(h);
    }
    outline(
      [
        [-fw / 2, 43.7],
        [fw / 2, 43.7],
        [fw / 2, 55.2],
        [0, 58.5],
        [-fw / 2, 55.2],
      ],
      holes,
      yaw,
      apothem - 0.65,
      DARK,
    );
    if (face % 2 === 0) {
      for (const u of [-1.5, 1.5])
        archivolt(u, 44.2, 51.4, 1.18, yaw, apothem + 0.12, 2);
      ring(0, 54, apothem + 0.15, 1.18, 0.19, yaw, LIGHT);
    } else {
      for (const side of [-1, 1])
        facetBox(side * 2.7, 48, apothem + 0.12, 0.4, 7.6, 0.5, yaw, LIGHT);
      ring(0, 53.5, apothem + 0.12, 1.63, 0.23, yaw, LIGHT, true);
      for (const side of [-1, 1])
        ring(side * 1.65, 51.6, apothem + 0.12, 1.03, 0.23, yaw, LIGHT, true);
    }
    // Projecting abaci and darker necks articulate the small capitals below
    // the upper archivolts without intruding into their real openings.
    const capitals = face % 2 === 0 ? [-2.92, 0, 2.92] : [-2.85, 2.85];
    const spring = face % 2 === 0 ? 51.4 : 51.3;
    for (const u of capitals) {
      facetBox(u, spring - 0.27, apothem + 0.28, 0.5, 0.3, 0.4, yaw, DARK);
      facetBox(u, spring - 0.04, apothem + 0.32, 0.72, 0.17, 0.55, yaw, LIGHT);
      facetBox(u, 44.4, apothem + 0.25, 0.62, 0.22, 0.5, yaw, LIGHT);
    }
    for (const side of [-1, 1]) {
      stroke(
        [(side * fw) / 2, 55.2],
        [0, 58.5],
        yaw,
        apothem + 0.14,
        0.35,
        LIGHT,
      );
      for (let y = 44.3; y < 55; y += 0.77)
        facetBox(
          side * (fw / 2 - 0.5),
          y,
          apothem + 0.13,
          0.82,
          0.64,
          0.18,
          yaw,
          (Math.round(y * 3) + face) % 3 === 0 ? LIGHT : STONE,
        );
    }
    for (let k = 0; k < 3; k++)
      archivolt(
        (k - 1) * 1.15,
        55.1,
        55.8 + (k === 1 ? 0.8 : 0),
        0.4,
        yaw,
        apothem + 0.11,
        1,
      );
    // Exposed cross ties inside the empty bell stage.
    facetBox(0, 47.5, apothem - 0.9, fw, 0.11, 0.12, yaw, RECESS);
  }
  for (const t of P.sideTurrets) {
    const [x, z] = t.centerLocalM;
    cylinder(
      x,
      t.shaftTopM / 2,
      z,
      t.radiusM,
      t.radiusM,
      t.shaftTopM,
      STONE,
      12,
    );
    for (const y of [8, 21, 27, t.shaftTopM])
      cylinder(x, y, z, t.radiusM + 0.23, t.radiusM + 0.23, 0.45, LIGHT, 12);
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6,
        xx = x + Math.sin(a) * (t.radiusM + 0.06),
        zz = z + Math.cos(a) * (t.radiusM + 0.06);
      box(xx, t.shaftTopM - 2.1, zz, 0.54, 2.55, 0.15, RECESS, a);
      for (let y = 1; y < t.shaftTopM - 4; y += 1.15)
        box(xx, y, zz, 1.13, 0.14, 0.06, LIGHT, a);
    }
    cylinder(
      x,
      (t.shaftTopM + t.roofTopM) / 2,
      z,
      t.radiusM + 0.3,
      0.12,
      t.roofTopM - t.shaftTopM,
      DARK,
      12,
    );
    if (t.crossTopM > t.roofTopM) {
      box(
        x,
        (t.roofTopM + t.crossTopM) / 2,
        z,
        0.26,
        t.crossTopM - t.roofTopM,
        0.26,
        DARK,
      );
      box(x, t.crossTopM - 0.75, z, 1.45, 0.27, 0.28, DARK);
      cylinder(x, t.roofTopM + 0.4, z, 0.42, 0.32, 0.6, DARK, 8);
    }
  }
  // Ornament follows the exact retained OSM apse boundary instead of
  // replacing the rounded projections with another rectangular box.
  for (const wing of GEDAECHTNISKIRCHE_RETAINED_WINGS) {
    if (wing.topY - wing.baseY < 1) continue;
    const ringLocal = wing.ring.map(([wx, wz]): Point => {
      const dx = wx - P.centerWorldM[0],
        dz = wz - P.centerWorldM[1];
      return [
        dx * Math.cos(P.rotationY) - dz * Math.sin(P.rotationY),
        dx * Math.sin(P.rotationY) + dz * Math.cos(P.rotationY),
      ];
    });
    let area = 0;
    for (let i = 0; i < ringLocal.length; i++) {
      const a = ringLocal[i],
        b = ringLocal[(i + 1) % ringLocal.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    for (let i = 0; i < ringLocal.length; i++) {
      const a = ringLocal[i],
        b = ringLocal[(i + 1) % ringLocal.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        mx = (a[0] + b[0]) / 2,
        mz = (a[1] + b[1]) / 2;
      if (len < 0.9 || (Math.abs(mx) < 15.6 && Math.abs(mz) < 9.1)) continue;
      const yaw = -Math.atan2(dz, dx) + (area > 0 ? Math.PI : 0),
        nx = Math.sin(yaw),
        nz = Math.cos(yaw);
      for (const y of [0.7, 7.7, 8.7])
        box(
          mx + nx * 0.15,
          y,
          mz + nz * 0.15,
          len + 0.08,
          0.22,
          0.36,
          LIGHT,
          yaw,
        );
      const count = Math.max(1, Math.floor(len / 2.2));
      for (let col = 0; col < count; col++) {
        const t = (col + 0.5) / count,
          x = a[0] + dx * t + nx * 0.12,
          z = a[1] + dz * t + nz * 0.12,
          w = Math.min(1.1, len / count - 0.15);
        box(x, 4.6, z, w, 4.4, 0.12, RECESS, yaw);
        for (const side of [-1, 1])
          box(
            x + Math.cos(yaw) * side * (w / 2 + 0.1),
            4.6,
            z - Math.sin(yaw) * side * (w / 2 + 0.1),
            0.16,
            4.7,
            0.2,
            LIGHT,
            yaw,
          );
        const g = new TorusGeometry(w / 2 + 0.12, 0.12, 4, 12, Math.PI);
        g.translate(0, 6.8, 0);
        g.rotateY(yaw);
        g.translate(x, 0, z);
        put(g, LIGHT);
      }
    }
  }
  // Tall steep copper sheath: eight faceted hollow walls, stepped broken
  // margins, fine standing seams, and small open dormers. No filled cone.
  const radius = P.crownRadiusM,
    base = P.crownBaseHeightM;
  const ap = radius * Math.cos(Math.PI / 8),
    width = 2 * radius * Math.sin(Math.PI / 8);
  for (let face = 0; face < 8; face++) {
    const yaw = (face * Math.PI) / 4,
      top = P.crownTopHeightsM[face];
    const topL = top - 0.8,
      topR = P.crownTopHeightsM[(face + 1) % 8] - 0.45;
    const points: Point[] = [
      [-width / 2, base],
      [width / 2, base],
      [width / 2, topR],
      [width * 0.12, topR],
      [width * 0.12, top],
      [0, top],
      [-width * 0.1, top],
      [-width * 0.1, topL],
      [-width / 2, topL],
    ];
    const holes = top > 65 ? [arch(0, 61.3, 62.7, 0.55)] : [];
    // Tilt each face inwards by only 0.11 m per metre of rise; preserving
    // the irregular edge and open centre at 71 m.
    const s = new Shape();
    s.moveTo(...points[0]);
    for (const q of points.slice(1)) s.lineTo(...q);
    s.closePath();
    s.holes.push(...holes);
    const g = new ExtrudeGeometry(s, {
      depth: 0.19,
      bevelEnabled: false,
      curveSegments: 12,
    });
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const inset = 0.11 * (p.getY(i) - base);
      p.setX(i, (p.getX(i) * (ap - inset)) / ap);
      p.setZ(i, p.getZ(i) - inset);
    }
    faceGeometry(g, yaw, ap, [COPPER, 0x708a84, 0x607772, 0x81938a][face % 4]);
    for (let k = -3; k <= 3; k++) {
      const u = (k * width) / 8,
        hi = Math.min(topL, topR) - 0.5;
      // Use explicit endpoints so the seam rotation never shifts its base.
      const sg = new BufferGeometry();
      const y0 = base + 0.1,
        y1 = hi;
      const u0 = (u * (ap - 0.11 * (y0 - base))) / ap,
        u1 = (u * (ap - 0.11 * (y1 - base))) / ap;
      sg.setAttribute(
        "position",
        new Float32BufferAttribute(
          [
            u0 - 0.035,
            y0,
            ap - 0.11 * (y0 - base) + 0.23,
            u0 + 0.035,
            y0,
            ap - 0.11 * (y0 - base) + 0.23,
            u1 + 0.035,
            y1,
            ap - 0.11 * (y1 - base) + 0.23,
            u1 - 0.035,
            y1,
            ap - 0.11 * (y1 - base) + 0.23,
          ],
          3,
        ),
      );
      sg.setIndex([0, 1, 2, 0, 2, 3]);
      sg.rotateY(yaw);
      put(sg, 0x435e5a);
    }
    // The sheath is made from metal sheets, not uninterrupted green strips.
    // Horizontal joints stay on the tapered face and split around dormers.
    for (let y = base + 1.8; y < Math.min(topL, topR) - 0.25; y += 1.8) {
      const scale = (ap - 0.11 * (y - base)) / ap;
      const spans: Point[] =
        holes.length && y >= 61.2 && y <= 63.4
          ? [
              [-width / 2, -0.85],
              [0.85, width / 2],
            ]
          : [[-width / 2, width / 2]];
      for (const [left, right] of spans) {
        const g = new BufferGeometry();
        const z = ap - 0.11 * (y - base) + 0.215;
        g.setAttribute(
          "position",
          new Float32BufferAttribute(
            [
              left * scale,
              y - 0.027,
              z,
              right * scale,
              y - 0.027,
              z,
              right * scale,
              y + 0.027,
              z,
              left * scale,
              y + 0.027,
              z,
            ],
            3,
          ),
        );
        g.setIndex([0, 1, 2, 0, 2, 3]);
        g.rotateY(yaw);
        put(g, 0x526d68);
      }
    }
    if (holes.length) {
      const r = ap - 0.11 * (62.5 - base) + 0.23;
      archivolt(0, 61.3, 62.7, 0.6, yaw, r, 1);
      stroke([-0.95, 62.8], [0, 64.4], yaw, r, 0.15, COPPER);
      stroke([0, 64.4], [0.95, 62.8], yaw, r, 0.15, COPPER);
    }
  }
}
