/**
 * A monoline geometric capital alphabet, defined here as polylines rather than
 * pulled from a system font: the drawing must look identical on every machine,
 * and stroked polylines match the ink-line style of the rest of the scene.
 *
 * Lettering is drawn into a canvas texture rather than built from geometry on
 * purpose. Strokes are ~10 cm wide on a 100 m building, so as geometry they
 * would be far below one screen pixel at anything but the closest zoom and
 * would shimmer. A mipmapped texture averages them correctly instead: close up
 * the words are legible, far out the mip chain fades them into a darker band,
 * which is the relief hint real lettering reads as from a distance.
 *
 * Two callers use it today: the Reichstag's bronze dedication and the
 * Starbucks fascia on the Pariser Platz.
 */

import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  type Texture,
} from "three";

/** Space between adjacent letters, as a fraction of the cap height. */
export const LETTERING_TRACKING = 0.34;
/** Stroke weight of the drawn capitals, as a fraction of the cap height. */
export const LETTERING_STROKE = 0.15;

type Polyline = [number, number][];

/**
 * Glyphs on a unit grid: x runs 0..advance, y runs 0 (baseline) to 1 (cap).
 * Curves are pre-flattened; at 60 cm cap height the segments are millimetres.
 */
const GLYPHS: Record<string, { advance: number; strokes: Polyline[] }> = {
  "1": {
    advance: 0.62,
    strokes: [
      [
        [0.08, 0.72],
        [0.34, 1],
        [0.34, 0],
      ],
      [
        [0.08, 0],
        [0.58, 0],
      ],
    ],
  },
  "5": {
    advance: 0.82,
    strokes: [
      [
        [0.74, 1],
        [0.12, 1],
        [0.1, 0.54],
        [0.58, 0.54],
        [0.76, 0.42],
        [0.76, 0.16],
        [0.58, 0.02],
        [0.26, 0],
        [0.08, 0.14],
      ],
    ],
  },
  A: {
    advance: 1,
    strokes: [
      [
        [0.06, 0],
        [0.5, 1],
        [0.94, 0],
      ],
      [
        [0.23, 0.38],
        [0.77, 0.38],
      ],
    ],
  },
  B: {
    advance: 0.92,
    strokes: [
      [
        [0.1, 0],
        [0.1, 1],
      ],
      [
        [0.1, 1],
        [0.56, 1],
        [0.78, 0.88],
        [0.78, 0.64],
        [0.56, 0.52],
        [0.1, 0.52],
      ],
      [
        [0.1, 0.52],
        [0.62, 0.52],
        [0.86, 0.38],
        [0.86, 0.14],
        [0.62, 0],
        [0.1, 0],
      ],
    ],
  },
  C: {
    advance: 0.92,
    strokes: [
      [
        [0.9, 0.84],
        [0.7, 0.98],
        [0.42, 1],
        [0.18, 0.86],
        [0.08, 0.62],
        [0.08, 0.38],
        [0.18, 0.14],
        [0.42, 0],
        [0.7, 0.02],
        [0.9, 0.16],
      ],
    ],
  },
  D: {
    advance: 0.92,
    strokes: [
      [
        [0.08, 0],
        [0.08, 1],
      ],
      [
        [0.08, 1],
        [0.48, 1],
        [0.72, 0.88],
        [0.86, 0.64],
        [0.86, 0.36],
        [0.72, 0.12],
        [0.48, 0],
        [0.08, 0],
      ],
    ],
  },
  E: {
    advance: 0.82,
    strokes: [
      [
        [0.1, 0],
        [0.1, 1],
      ],
      [
        [0.1, 1],
        [0.78, 1],
      ],
      [
        [0.1, 0.52],
        [0.64, 0.52],
      ],
      [
        [0.1, 0],
        [0.78, 0],
      ],
    ],
  },
  G: {
    advance: 0.98,
    strokes: [
      [
        [0.92, 0.82],
        [0.72, 0.98],
        [0.42, 1],
        [0.18, 0.86],
        [0.08, 0.62],
        [0.08, 0.38],
        [0.18, 0.14],
        [0.42, 0],
        [0.72, 0.02],
        [0.9, 0.2],
        [0.9, 0.48],
        [0.56, 0.48],
      ],
    ],
  },
  H: {
    advance: 0.98,
    strokes: [
      [
        [0.1, 0],
        [0.1, 1],
      ],
      [
        [0.88, 0],
        [0.88, 1],
      ],
      [
        [0.1, 0.52],
        [0.88, 0.52],
      ],
    ],
  },
  I: {
    advance: 0.66,
    strokes: [
      [
        [0.08, 1],
        [0.58, 1],
      ],
      [
        [0.33, 1],
        [0.33, 0],
      ],
      [
        [0.08, 0],
        [0.58, 0],
      ],
    ],
  },
  K: {
    advance: 0.94,
    strokes: [
      [
        [0.1, 0],
        [0.1, 1],
      ],
      [
        [0.88, 1],
        [0.1, 0.44],
      ],
      [
        [0.36, 0.62],
        [0.9, 0],
      ],
    ],
  },
  L: {
    advance: 0.8,
    strokes: [
      [
        [0.12, 1],
        [0.12, 0],
        [0.76, 0],
      ],
    ],
  },
  M: {
    advance: 1.08,
    strokes: [
      [
        [0.08, 0],
        [0.08, 1],
        [0.54, 0.26],
        [1, 1],
        [1, 0],
      ],
    ],
  },
  N: {
    advance: 0.98,
    strokes: [
      [
        [0.1, 0],
        [0.1, 1],
        [0.88, 0],
        [0.88, 1],
      ],
    ],
  },
  O: {
    advance: 1,
    strokes: [
      [
        [0.5, 1],
        [0.76, 0.9],
        [0.92, 0.64],
        [0.92, 0.36],
        [0.76, 0.1],
        [0.5, 0],
        [0.24, 0.1],
        [0.08, 0.36],
        [0.08, 0.64],
        [0.24, 0.9],
        [0.5, 1],
      ],
    ],
  },
  P: {
    advance: 0.9,
    strokes: [
      [
        [0.1, 0],
        [0.1, 1],
      ],
      [
        [0.1, 1],
        [0.56, 1],
        [0.8, 0.88],
        [0.8, 0.64],
        [0.56, 0.52],
        [0.1, 0.52],
      ],
    ],
  },
  R: {
    advance: 0.94,
    strokes: [
      [
        [0.1, 0],
        [0.1, 1],
      ],
      [
        [0.1, 1],
        [0.56, 1],
        [0.8, 0.88],
        [0.8, 0.66],
        [0.56, 0.54],
        [0.1, 0.54],
      ],
      [
        [0.46, 0.54],
        [0.9, 0],
      ],
    ],
  },
  S: {
    advance: 0.86,
    strokes: [
      [
        [0.86, 0.86],
        [0.66, 1],
        [0.3, 1],
        [0.1, 0.86],
        [0.1, 0.66],
        [0.28, 0.55],
        [0.66, 0.47],
        [0.84, 0.35],
        [0.84, 0.14],
        [0.62, 0],
        [0.26, 0],
        [0.06, 0.14],
      ],
    ],
  },
  T: {
    advance: 0.9,
    strokes: [
      [
        [0.45, 0],
        [0.45, 1],
      ],
      [
        [0.04, 1],
        [0.86, 1],
      ],
    ],
  },
  U: {
    advance: 0.98,
    strokes: [
      [
        [0.1, 1],
        [0.1, 0.28],
        [0.22, 0.08],
        [0.44, 0],
        [0.62, 0],
        [0.84, 0.08],
        [0.9, 0.28],
        [0.9, 1],
      ],
    ],
  },
  V: {
    advance: 0.98,
    strokes: [
      [
        [0.06, 1],
        [0.49, 0],
        [0.92, 1],
      ],
    ],
  },
  W: {
    advance: 1.24,
    strokes: [
      [
        [0.04, 1],
        [0.28, 0],
        [0.62, 0.62],
        [0.92, 0],
        [1.2, 1],
      ],
    ],
  },
  " ": { advance: 0.5, strokes: [] },
};

export type LetteringGlyph = {
  advanceM: number;
  character: string;
  leftM: number;
};

export type LetteringLayout = {
  capHeightM: number;
  glyphs: LetteringGlyph[];
  strokeWidthM: number;
  totalWidthM: number;
};

/**
 * Set one line of capitals, in metres, starting at x = 0.
 * Throws for characters the drawn alphabet does not cover, so a typo can never
 * silently ship as a gap in the stone.
 */
export function letteringLayout(
  text: string,
  capHeightM: number,
): LetteringLayout {
  const tracking = capHeightM * LETTERING_TRACKING;
  const characters = [...text];
  let cursor = 0;
  const glyphs: LetteringGlyph[] = characters.map((character, index) => {
    const glyph = GLYPHS[character];
    if (!glyph) {
      throw new Error(`The drawn alphabet has no glyph for "${character}"`);
    }
    const advanceM = glyph.advance * capHeightM;
    const leftM = cursor;
    cursor += advanceM + (index === characters.length - 1 ? 0 : tracking);
    return { advanceM, character, leftM };
  });
  return {
    capHeightM,
    glyphs,
    strokeWidthM: capHeightM * LETTERING_STROKE,
    totalWidthM: cursor,
  };
}

export type LetteringTextureOptions = {
  bandHeightM: number;
  bandWidthM: number;
  capHeightM: number;
  fieldColor: string;
  letterColor: string;
  text: string;
  texelsPerMetre?: number;
};

/**
 * Draw one centred line onto a band. Returns null where there is no DOM to
 * draw into (bun's test runner), so models still build headless.
 */
export function createLetteringTexture({
  bandHeightM,
  bandWidthM,
  capHeightM,
  fieldColor,
  letterColor,
  text,
  texelsPerMetre = 79,
}: LetteringTextureOptions): Texture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const width = Math.round(bandWidthM * texelsPerMetre);
  const height = Math.round(bandHeightM * texelsPerMetre);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  const scale = width / bandWidthM;
  context.fillStyle = fieldColor;
  context.fillRect(0, 0, width, height);

  const layout = letteringLayout(text, capHeightM);
  const originX = (bandWidthM - layout.totalWidthM) / 2;
  const baselineY = (bandHeightM - layout.capHeightM) / 2;
  context.strokeStyle = letterColor;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = layout.strokeWidthM * scale;
  for (const glyph of layout.glyphs) {
    for (const stroke of GLYPHS[glyph.character].strokes) {
      context.beginPath();
      stroke.forEach(([gx, gy], index) => {
        const x = (originX + glyph.leftM + gx * layout.capHeightM) * scale;
        // Canvas y grows downward; the glyph grid grows upward from the
        // baseline, and v=0 of the texture is the top of the band.
        const y = height - (baselineY + gy * layout.capHeightM) * scale;
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.stroke();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.magFilter = LinearFilter;
  // Trilinear: without a full mip chain the sub-pixel strokes would alias into
  // exactly the zoom shimmer earlier releases removed.
  texture.minFilter = LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}
