/** Original illustrative animal silhouettes in metres, never measured animal data.
 * All boxes are independent cardinal solids; feet rest at Y=0 and faces point +X.
 * Placement, current zoo stock and animation belong to the caller, not this atlas.
 */
export const ZOO_ANIMAL_SPECIES_V282 = Object.freeze([
  'elephant-asian', 'elephant-african', 'condor', 'lion', 'tiger', 'wolf',
  'rabbit', 'chicken', 'penguin', 'pelican', 'snake', 'alligator', 'seal',
  'bison', 'flamingo', 'camel', 'giraffe', 'hippo', 'zebra', 'ibis', 'bear',
  'lemur', 'gorilla', 'orangutan', 'chimpanzee', 'stork', 'marabou',
  'manatee', 'walrus',
] as const);

export type ZooAnimalSpeciesV282 = typeof ZOO_ANIMAL_SPECIES_V282[number];
export interface ZooAnimalBoxV282 {
  readonly x: number; readonly y: number; readonly z: number;
  readonly w: number; readonly h: number; readonly d: number;
  readonly color: number; readonly part: string;
}

const BLACK = 0x242725, WHITE = 0xe4e0cc, HORN = 0xcac1a0;
const cache = new Map<string, readonly ZooAnimalBoxV282[]>();

export interface ZooAnimalChamferedBoxV282 {
  readonly positions: readonly number[];
  readonly indices: readonly number[];
}
let chamferedBox: ZooAnimalChamferedBoxV282 | undefined;

/** Independent drawn primitive with softened edges and full central contact
 * planes at ±0.5. Limb/neck attachments are authored against these planes;
 * an inscribed sphere would pull the body away from those attachment points.
 */
export function zooAnimalChamferedBoxV282(): ZooAnimalChamferedBoxV282 {
  if (chamferedBox) return chamferedBox;
  const positions: number[] = [], indices: number[] = [], vertices = new Map<string, number>();
  const inner = .44, outer = .5;
  const face = (points: number[][]): void => {
    const a = points[0], b = points[1], c = points[2];
    const ab = b.map((value, axis) => value - a[axis]);
    const ac = c.map((value, axis) => value - a[axis]);
    const normal = [ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (normal.reduce((sum, value, axis) => sum + value * a[axis], 0) < 0) points.reverse();
    const polygon = points.map(point => {
      const key = point.join(',');
      let index = vertices.get(key);
      if (index === undefined) { index = positions.length / 3; vertices.set(key, index); positions.push(...point); }
      return index;
    });
    for (let i = 1; i < polygon.length - 1; i++) indices.push(polygon[0], polygon[i], polygon[i + 1]);
  };
  // Six full-size face planes, twelve edge bevels and eight corner triangles.
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    face([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
      const p = [0, 0, 0]; p[axis] = sign * outer;
      p[(axis + 1) % 3] = u * inner; p[(axis + 2) % 3] = v * inner; return p;
    }));
  }
  for (let axis = 0; axis < 3; axis++) for (const a of [-1, 1]) for (const b of [-1, 1]) {
    face([[-inner, outer, inner], [-inner, inner, outer],
      [inner, inner, outer], [inner, outer, inner]].map(([length, u, v]) => {
      const p = [0, 0, 0]; p[axis] = length;
      p[(axis + 1) % 3] = a * u; p[(axis + 2) % 3] = b * v; return p;
    }));
  }
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    face([[outer, inner, inner], [inner, outer, inner], [inner, inner, outer]]
      .map(p => [p[0] * x, p[1] * y, p[2] * z]));
  }
  chamferedBox = Object.freeze({ positions: Object.freeze(positions), indices: Object.freeze(indices) });
  return chamferedBox;
}

/** Lazily built, deeply immutable geometry shared by every individual of a species. */
export function zooAnimalShapeV282(species: ZooAnimalSpeciesV282,
  variant?: string): readonly ZooAnimalBoxV282[] {
  const supported = species === 'bear' ? ['polar', 'sun', 'spectacled']
    : species === 'penguin' ? ['king', 'african', 'humboldt']
    : species === 'lemur' ? ['red-ruffed', 'black-and-white-ruffed', 'collared']
    : species === 'camel' ? ['dromedary'] : species === 'stork' ? ['black'] : [];
  const coat = variant && supported.includes(variant) ? variant : '';
  const key = `${species}:${coat}`;
  const found = cache.get(key);
  if (found) return found;
  const rows: ZooAnimalBoxV282[] = [];
  const box = (part: string, color: number, x: number, y: number, z: number,
    w: number, h: number, d: number): void => { rows.push({ part, color, x, y, z, w, h, d }); };
  const eyes = (x: number, y: number, z: number, size = .06): void => {
    for (const side of [-1, 1]) box('head', BLACK, x, y, side * z, size, size, size);
  };
  const legs = (x: number, z: number, height: number, width: number, color: number,
    footColor = color): void => {
    for (const front of [false, true]) for (const left of [false, true]) {
      const part = `leg-${front ? 'front' : 'back'}-${left ? 'left' : 'right'}`;
      box(part, color, front ? x : -x, height / 2, left ? z : -z, width, height, width);
      box(part, footColor, (front ? x : -x) + width * .13, width * .2,
        left ? z : -z, width * 1.26, width * .4, width * 1.08);
    }
  };
  const quad = (color: number, length: number, bodyH: number, width: number,
    legH: number, legW: number): number => {
    box('body', color, 0, legH + bodyH / 2 - .025, 0, length, bodyH, width);
    legs(length * .34, width * .32, legH, legW, color);
    return legH + bodyH - .025;
  };
  const tail = (color: number, x: number, y: number, length: number, width: number): void => {
    box('tail', color, x - length / 2, y, 0, length, width, width);
  };
  const bird = (color: number, wingColor: number, bodyL: number, bodyH: number,
    bodyW: number, legH: number, neckH: number, headSize: number, beakL: number,
    beakColor: number): number => {
    box('body', color, 0, legH + bodyH / 2, 0, bodyL, bodyH, bodyW);
    for (const side of [-1, 1]) {
      box(side < 0 ? 'wing-right' : 'wing-left', wingColor, -.04,
        legH + bodyH / 2, side * bodyW * .48, bodyL * .88, bodyH * .8, bodyW * .18);
      const part = side < 0 ? 'leg-back-right' : 'leg-back-left';
      box(part, beakColor, 0, legH / 2, side * bodyW * .26, .055, legH, .055);
      box(part, beakColor, .055, .025, side * bodyW * .26, .19, .05, .09);
    }
    const headY = legH + bodyH + neckH - headSize * .2;
    box('head', color, bodyL * .3, legH + bodyH - .04 + neckH / 2,
      0, headSize * .55, neckH + .08, headSize * .6);
    box('head', color, bodyL * .3, headY, 0, headSize, headSize, headSize);
    box('head', beakColor, bodyL * .3 + (headSize + beakL) / 2 - .01,
      headY - .03, 0, beakL, headSize * .25, headSize * .32);
    eyes(bodyL * .3 + headSize * .25, headY + headSize * .12, headSize * .48, .045);
    tail(wingColor, -bodyL / 2 + .025, legH + bodyH * .45, bodyL * .32, bodyW * .28);
    return headY;
  };

  switch (species) {
    case 'elephant-asian': case 'elephant-african': {
      const african = species === 'elephant-african';
      const skin = african ? 0x8e8b7c : 0x969186;
      const length = african ? 3.6 : 3.1, top = quad(skin, length, 1.9, 1.7, 1.25, .45);
      box('head', skin, length / 2 - .05, top - .25, 0, 1.1, 1.3, 1.18);
      for (const side of [-1, 1]) {
        box('head', skin, length / 2 - .43, top - .3, side * .85,
          african ? .82 : .55, african ? 1.65 : 1.05, .27);
        box('head', HORN, length / 2 + .67, top - .83, side * .38, .65, .15, .15);
        box('head', HORN, length / 2 + .96, top - .72, side * .38, .14, .28, .14);
      }
      box('head', skin, length / 2 + .57, top - .65, 0, .34, 1.2, .4);
      box('head', skin, length / 2 + .65, top - 1.48, 0, .3, .65, .33);
      box('head', skin, length / 2 + .82, top - 1.83, 0, .55, .25, .3);
      eyes(length / 2 + .46, top - .18, .57, .09);
      box('tail', skin, -length / 2 - .07, top - .7, 0, .14, 1.05, .14);
      box('tail', BLACK, -length / 2 - .07, top - 1.22, 0, .19, .2, .19);
      break;
    }
    case 'lion': case 'tiger': case 'wolf': case 'zebra': {
      const lion = species === 'lion', tiger = species === 'tiger';
      const zebra = species === 'zebra';
      const color = lion ? 0xb68b4d : tiger ? 0xd28c3d : zebra ? 0xe0dece : 0xaca797;
      const length = zebra ? 1.8 : lion || tiger ? 1.65 : 1.25;
      const top = quad(color, length, zebra ? .68 : .48, zebra ? .63 : .47,
        zebra ? .94 : .58, zebra ? .16 : .14);
      const hx = length / 2 + (zebra ? -.04 : .13), hy = top + (zebra ? .39 : .02);
      if (zebra) box('head', color, hx - .1, top + .2, 0, .44, .76, .38);
      if (lion) box('head', 0x73502d, hx - .1, hy, 0, .65, .76, .7);
      if (!zebra && !lion) box('head', color, length / 2 - .02, top - .07, 0, .38, .42, .38);
      box('head', color, hx + .12, hy, 0, zebra ? .48 : .44, .4, .38);
      box('head', zebra ? 0x6b655b : color, hx + .38, hy - .1, 0, .35, .22, .28);
      box('head', BLACK, hx + .56, hy - .09, 0, .06, .12, .2);
      for (const side of [-1, 1]) box('head', color, hx + .04,
        hy + (zebra ? .31 : .26), side * .14, .12, zebra ? .32 : .18, .12);
      eyes(hx + .25, hy + .06, .195, .055);
      tail(color, -length / 2, top - .15, zebra ? .6 : .8, .09);
      if (lion || zebra) box('tail', lion ? 0x73502d : BLACK,
        -length / 2 - (zebra ? .58 : .78), top - .2, 0, .14, .24, .16);
      if (tiger || zebra) {
        for (const x of [-.6, -.3, 0, .3, .6]) for (const side of [-1, 1])
          box('body', BLACK, x, top - .22, side * (zebra ? .318 : .239),
            .09, zebra ? .56 : .41, .02);
        for (const x of [-.45, -.05, .35]) box('body', BLACK, x, top + .004,
          0, .09, .02, zebra ? .63 : .47);
        if (zebra) box('head', BLACK, hx - .29, top + .41, 0, .06, .6, .1);
      } else if (species === 'wolf') {
        box('body', 0x727366, -.12, top - .08, 0, .88, .18, .38);
        box('head', WHITE, hx + .3, hy - .17, 0, .39, .12, .28);
      }
      break;
    }
    case 'rabbit': {
      quad(0xa69a81, .43, .28, .3, .12, .09);
      box('head', 0xa69a81, .24, .38, 0, .26, .28, .25);
      for (const side of [-1, 1]) {
        box('head', 0xa69a81, .2, .64, side * .08, .095, .33, .075);
        box('head', 0xc29a94, .25, .65, side * .08, .012, .23, .045);
      }
      eyes(.32, .43, .12, .045);
      box('head', 0xc18a86, .38, .36, 0, .04, .035, .06);
      box('tail', WHITE, -.25, .3, 0, .14, .15, .15);
      break;
    }
    case 'chicken': {
      const y = bird(0xb68b54, 0x71583f, .44, .34, .3, .16, .11, .18, .12, 0xb99b4c);
      box('head', 0xa53d32, .13, y + .13, 0, .17, .1, .06);
      box('head', 0xa53d32, .23, y - .12, 0, .06, .15, .06);
      box('tail', 0x4b5248, -.27, .48, 0, .17, .36, .19);
      break;
    }
    case 'penguin': {
      box('body', 0x303b3b, 0, .45, 0, .44, .72, .43);
      box('body', WHITE, .225, .45, 0, .04, .57, .3);
      box('head', 0x303b3b, .06, .94, 0, .35, .34, .35);
      box('head', 0xb89144, .3, .91, 0, .18, .1, .14);
      eyes(.17, 1, .17, .045);
      for (const side of [-1, 1]) {
        box(side < 0 ? 'wing-right' : 'wing-left', 0x303b3b, -.02, .5,
          side * .25, .18, .54, .09);
        box(side < 0 ? 'leg-back-right' : 'leg-back-left', 0xa99258,
          .07, .05, side * .13, .3, .1, .15);
      }
      tail(0x303b3b, -.2, .2, .22, .12);
      break;
    }
    case 'condor': {
      bird(0x393c39, 0x202723, .82, .44, .43, .25, .18, .22, .16, 0xaaa28c);
      box('head', WHITE, .24, .7, 0, .32, .12, .34);
      box('head', 0x9f8d79, .24, .91, 0, .22, .2, .21);
      box('head', 0x8b725d, .25, 1.04, 0, .12, .1, .08);
      for (const side of [-1, 1]) {
        const part = side < 0 ? 'wing-right' : 'wing-left';
        box(part, BLACK, -.08, .64, side * .65, .65, .14, .93);
        box(part, WHITE, -.2, .72, side * .72, .3, .04, .8);
        for (let feather = 0; feather < 4; feather++) box(part, BLACK,
          -.3 + feather * .15, .63, side * (1.24 + feather * .025), .13, .12, .42);
      }
      break;
    }
    case 'pelican': {
      const y = bird(0xdedbcc, 0xa8aaa0, .86, .5, .5, .22, .48, .25, .61, 0xc2a362);
      box('head', 0xc9ad76, .66, y - .13, 0, .53, .17, .17);
      break;
    }
    case 'flamingo': {
      const y = bird(0xd9988c, 0xc77978, .55, .33, .31, .85, .52, .18, .14, 0xbd8a80);
      box('head', BLACK, .37, y - .08, 0, .1, .14, .075);
      break;
    }
    case 'ibis': {
      const y = bird(0xaaa697, 0x343d3d, .5, .36, .34, .4, .18, .2, .17, 0x424a46);
      box('head', BLACK, .39, y - .08, 0, .12, .1, .07);
      box('head', BLACK, .46, y - .15, 0, .06, .13, .06);
      break;
    }
    case 'stork': case 'marabou': {
      const marabou = species === 'marabou';
      const y = bird(marabou ? 0x7e8179 : coat === 'black' ? 0x333e38 : 0xe4e2d5, 0x353b38, .7, .5,
        .4, marabou ? .98 : .82, marabou ? .48 : .57, .24,
        marabou ? .53 : .43, marabou ? 0x9b947b : 0xb66f55);
      if (coat === 'black') box('body', WHITE, .01, .86, 0, .62, .16, .41);
      if (marabou) {
        box('head', 0xaa8e80, .21, y, 0, .25, .25, .25);
        box('head', 0xaa8e80, .29, y - .25, 0, .17, .36, .17);
      }
      break;
    }
    case 'snake': {
      // Connected right-angle bends, rather than a straight floating cylinder.
      const color = 0x8a8d53;
      box('body', color, -.25, .1, -.25, 1.05, .2, .18);
      box('body', color, -.69, .1, .02, .18, .2, .55);
      box('body', color, -.15, .1, .26, 1.25, .2, .18);
      box('body', color, .41, .1, .01, .18, .2, .52);
      box('head', color, .62, .12, -.18, .45, .24, .27);
      // Eyes are on the offset head, not on the centreline of the coil.
      for (const side of [-1, 1]) box('head', BLACK, .76, .2, -.18 + side * .13, .04, .04, .04);
      tail(color, -.77, .1, .26, .09);
      break;
    }
    case 'alligator': {
      const color = 0x737b51;
      quad(color, 1.65, .34, .63, .16, .21);
      box('head', color, 1.08, .35, 0, .58, .27, .48);
      box('head', color, 1.55, .28, 0, .55, .15, .33);
      eyes(1.2, .48, .19, .075);
      tail(color, -.8, .29, .6, .37);
      tail(color, -1.4, .25, .52, .23);
      tail(color, -1.92, .23, .4, .12);
      for (const x of [-.6, -.25, .1, .45]) box('body', 0x4d5738, x, .51, 0, .17, .13, .25);
      break;
    }
    case 'seal': case 'walrus': case 'manatee': {
      const walrus = species === 'walrus', manatee = species === 'manatee';
      const color = walrus ? 0xa18a74 : manatee ? 0x969e91 : 0x6e7f80;
      const length = walrus ? 2.1 : manatee ? 2.3 : 1.55;
      const height = walrus ? .95 : manatee ? .75 : .55;
      box('body', color, 0, height / 2, 0, length, height, walrus ? 1 : .74);
      box('head', color, length / 2, height * .68, 0, .6, height * .7, .62);
      box('head', walrus ? 0xbaa18a : color, length / 2 + .3, height * .53,
        0, .24, .26, .45);
      eyes(length / 2 + .21, height * .86, .29, .07);
      for (const side of [-1, 1]) {
        box(side < 0 ? 'leg-front-right' : 'leg-front-left', color,
          length * .28, .09, side * .54, .42, .18, .6);
        if (walrus) box('head', HORN, length / 2 + .35, .34, side * .18, .12, .63, .13);
      }
      tail(color, -length / 2, .18, .4, .3);
      box('tail', color, -length / 2 - .46, .14, 0, manatee ? .55 : .33, .22,
        manatee ? .9 : .73);
      if (walrus) for (const side of [-1, 1]) for (const y of [.49, .57, .65])
        box('head', 0xd8c8a5, length / 2 + .39, y, side * .29, .045, .025, .23);
      break;
    }
    case 'bison': {
      const top = quad(0x705640, 1.9, .83, .84, .62, .23);
      box('body', 0x594a3a, .42, top + .17, 0, .95, .58, .9);
      box('head', 0x4d4133, 1.05, 1.1, 0, .7, .7, .58);
      box('head', 0x4d4133, 1.17, .64, 0, .28, .45, .32);
      box('head', BLACK, 1.44, 1, 0, .14, .22, .4);
      eyes(1.25, 1.26, .28, .065);
      for (const side of [-1, 1]) {
        box('head', HORN, 1.03, 1.39, side * .36, .16, .13, .25);
        box('head', HORN, 1.03, 1.51, side * .46, .11, .3, .1);
      }
      tail(0x705640, -.94, 1.1, .44, .09);
      break;
    }
    case 'camel': {
      const color = 0xb79a6e, top = quad(color, 2.1, .72, .7, 1.15, .18);
      for (const x of coat === 'dromedary' ? [0] : [-.53, .48]) {
        box('body', color, x, top + .14, 0, .7, .36, .64);
        box('body', color, x, top + .36, 0, .4, .18, .4);
      }
      box('head', color, 1.1, top + .23, 0, .36, 1.08, .38);
      box('head', color, 1.34, top + .74, 0, .75, .32, .32);
      box('head', 0x786349, 1.7, top + .69, 0, .15, .16, .26);
      for (const side of [-1, 1]) box('head', color, 1.11, top + .94, side * .17, .14, .2, .14);
      eyes(1.36, top + .82, .16, .06);
      box('tail', color, -1.1, 1.41, 0, .12, .76, .12);
      break;
    }
    case 'giraffe': {
      const color = 0xc7aa68, top = quad(color, 1.9, .78, .72, 1.75, .19);
      box('head', color, .73, top + .85, 0, .48, 1.95, .44);
      box('head', color, .94, top + 1.86, 0, .95, .4, .4);
      for (const side of [-1, 1]) {
        box('head', color, .62, top + 2.13, side * .12, .09, .3, .09);
        box('head', 0x69523a, .62, top + 2.29, side * .12, .12, .1, .12);
        box('head', color, .58, top + 1.98, side * .32, .27, .13, .27);
        for (const x of [-.6, -.1, .4]) box('body', 0x977245,
          x, top - .35, side * .368, .28, .43, .022);
        for (let y = .2; y < 1.8; y += .4) box('head', 0x977245,
          .73, top + y, side * .228, .3, .22, .022);
      }
      eyes(1.11, top + 1.95, .2, .07);
      box('tail', color, -.98, 1.8, 0, .11, 1.05, .11);
      box('tail', 0x69523a, -.98, 1.28, 0, .18, .26, .18);
      break;
    }
    case 'hippo': {
      const color = 0x9a9189, top = quad(color, 2.3, 1.1, 1.25, .36, .32);
      box('head', color, 1.27, top - .26, 0, .86, .8, 1.05);
      box('head', color, 1.75, top - .49, 0, .62, .53, 1.1);
      for (const side of [-1, 1]) {
        box('head', color, 1.22, top + .14, side * .34, .18, .23, .17);
        box('head', BLACK, 1.93, top - .2, side * .32, .12, .06, .1);
      }
      eyes(1.51, top + .04, .45, .085);
      tail(color, -1.14, .87, .36, .13);
      break;
    }
    case 'bear': {
      const color = coat === 'polar' ? 0xe0ddc8
        : coat === 'sun' || coat === 'spectacled' ? 0x3c3a31 : 0x725d49;
      const top = quad(color, 1.65, .83, .8, .58, .28);
      box('head', color, .92, top - .13, 0, .61, .59, .59);
      box('head', coat === 'polar' ? 0xd8d4bf : 0x9a8768,
        1.28, top - .29, 0, .37, .23, .34);
      box('head', BLACK, 1.48, top - .28, 0, .08, .13, .22);
      for (const side of [-1, 1]) box('head', color, .83, top + .2, side * .22, .18, .19, .18);
      eyes(1.11, top - .02, .285, .065);
      box('tail', color, -.88, .95, 0, .18, .2, .2);
      if (coat === 'sun') {
        box('body', 0xd5bc88, .827, .92, 0, .03, .11, .4);
        for (const side of [-1, 1]) box('body', 0xd5bc88,
          .827, 1.02, side * .24, .03, .21, .12);
      }
      if (coat === 'spectacled') for (const side of [-1, 1]) {
        box('head', 0xcbbb95, 1.1, top - .02, side * .298, .19, .17, .024);
        box('head', BLACK, 1.11, top - .02, side * .314, .065, .065, .025);
      }
      break;
    }
    case 'lemur': {
      const color = coat === 'red-ruffed' ? 0xa45232 : coat === 'black-and-white-ruffed'
        ? 0xe2decb : coat === 'collared' ? 0x8c8b74 : 0x8c9187;
      quad(color, .65, .28, .3, .27, .07);
      box('head', coat ? BLACK : WHITE, .39, .61, 0, .26, .29, .26);
      box('head', BLACK, .56, .55, 0, .16, .1, .13);
      for (const side of [-1, 1]) {
        box('head', coat ? color : WHITE, .33, .79, side * .12, .1, .16, .1);
        box('head', coat ? 0xb9a46c : BLACK, .49, .67, side * .12, .065, .08, .06);
      }
      if (coat) for (const side of [-1, 1]) box('head', coat === 'collared' ? 0xaf8250
        : coat === 'red-ruffed' ? 0xb65b36 : WHITE, .32, .63, side * .17, .18, .31, .12);
      if (coat === 'red-ruffed') box('head', WHITE, .265, .74, 0, .06, .11, .18);
      if (coat === 'collared') box('head', 0xaf8250, .33, .46, 0, .2, .08, .34);
      for (let i = 0; i < 10; i++) box('tail', coat === 'collared' ? 0x696452 : !coat && i % 2 ? WHITE : BLACK,
        -.4 - i * .083, .48 + i * .11, 0, .18, .18, .14);
      break;
    }
    case 'gorilla': case 'orangutan': case 'chimpanzee': {
      const gorilla = species === 'gorilla', orangutan = species === 'orangutan';
      const color = orangutan ? 0x9b6039 : gorilla ? 0x444c49 : 0x504e43;
      const skin = orangutan ? 0x8c7761 : 0x8b8170;
      const width = gorilla ? .88 : orangutan ? .75 : .55;
      const bodyY = gorilla ? .89 : .96, bodyH = gorilla ? .95 : .88;
      box('body', color, 0, bodyY, 0, gorilla ? .75 : .55, bodyH, width);
      if (gorilla) box('body', 0x858982, -.38, bodyY + .07, 0, .05, .61, .67);
      box('head', color, .15, bodyY + bodyH / 2 + .14, 0, .49, .51, .46);
      box('head', skin, .4, bodyY + bodyH / 2 + .1, 0, .1, .3, .34);
      box('head', skin, .47, bodyY + bodyH / 2 + .02, 0, .15, .13, .24);
      eyes(.45, bodyY + bodyH / 2 + .19, .13, .055);
      for (const side of [-1, 1]) {
        const arm = side < 0 ? 'leg-front-right' : 'leg-front-left';
        const leg = side < 0 ? 'leg-back-right' : 'leg-back-left';
        const armZ = side * (width / 2 + .1), armH = orangutan ? 1.2 : 1.04;
        box(arm, color, .12, armH / 2 + .08, armZ, .25, armH, .25);
        box(arm, skin, .22, .1, armZ, .35, .2, .26);
        box(leg, color, -.16, .28, side * width * .27, .25, .56, .25);
        box(leg, skin, -.07, .07, side * width * .27, .4, .14, .26);
        if (orangutan) box('head', color, .23, bodyY + bodyH / 2 + .1,
          side * .29, .3, .42, .19);
      }
      break;
    }
    default: throw new Error(`Unknown zoo animal species: ${String(species)}`);
  }
  if (species === 'penguin' && coat) {
    if (coat === 'king') for (const side of [-1, 1]) {
      box('head', 0xd5af4e, .19, .91, side * .176, .12, .14, .016);
      box('body', 0xd5af4e, .225, .77, side * .11, .04, .17, .11);
    } else {
      box('body', BLACK, .249, .57, 0, .018, .06, .29);
      if (coat === 'humboldt') box('head', 0xb68d87, .22, .93, 0, .06, .07, .24);
      else for (const side of [-1, 1]) box('head', WHITE, .085, 1.03,
        side * .178, .23, .045, .018);
    }
  }
  const scale = species === 'bear'
    ? coat === 'polar' ? 1.14 : coat === 'sun' ? .63 : coat === 'spectacled' ? .82 : 1
    : species === 'penguin'
      ? coat === 'king' ? 1.16 : coat === 'african' ? .7 : coat === 'humboldt' ? .77 : 1
      : 1;
  const result = Object.freeze(rows.map(row => Object.freeze(scale === 1 ? row : {
    ...row, x: row.x * scale, y: row.y * scale, z: row.z * scale,
    w: row.w * scale, h: row.h * scale, d: row.d * scale,
  })));
  cache.set(key, result);
  return result;
}
