type Point = readonly [number, number];
export type ClockStroke = readonly [Point, Point];

/** The four gilt dials have radial Roman numerals. These small line members
 * are display detail interpreted from the credited Bulach/Pymouss photographs,
 * not an external font, photographic texture, or surveyed engraving. */
export const GEDAECHTNISKIRCHE_CLOCK_NUMERALS = [
  "XII",
  "I",
  "II",
  "III",
  "IIII",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
] as const;

const GLYPHS: Readonly<Record<string, readonly ClockStroke[]>> = {
  I: [
    [
      [0, -0.28],
      [0, 0.28],
    ],
  ],
  V: [
    [
      [-0.09, 0.28],
      [0, -0.28],
    ],
    [
      [0, -0.28],
      [0.09, 0.28],
    ],
  ],
  X: [
    [
      [-0.09, -0.28],
      [0.09, 0.28],
    ],
    [
      [-0.09, 0.28],
      [0.09, -0.28],
    ],
  ],
};

export const GEDAECHTNISKIRCHE_CLOCK_STROKES: readonly ClockStroke[] =
  GEDAECHTNISKIRCHE_CLOCK_NUMERALS.flatMap((numeral, hour) => {
    const angle = (hour * Math.PI) / 6;
    return [...numeral].flatMap((letter, column) => {
      const x = (column - (numeral.length - 1) / 2) * 0.245;
      const transform = (p: Point): Point => [
        (x + p[0]) * Math.cos(angle) + (2.9 + p[1]) * Math.sin(angle),
        (2.9 + p[1]) * Math.cos(angle) - (x + p[0]) * Math.sin(angle),
      ];
      return GLYPHS[letter].map(([a, b]): ClockStroke => [
        transform(a),
        transform(b),
      ]);
    });
  });
