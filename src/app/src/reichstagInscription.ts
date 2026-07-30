/**
 * "DEM DEUTSCHEN VOLKE" — the bronze dedication on the architrave of the
 * Reichstag's west portico (Peter Behrens' letters, cast 1916 by S. A. Loevy).
 *
 * The line is drawn into a canvas texture rather than built from geometry on
 * purpose. Letter strokes are ~10 cm wide on a 100 m building, so as geometry
 * they would be far below one screen pixel at anything but the closest zoom and
 * would shimmer exactly the way this round is removing shimmer elsewhere. A
 * mipmapped texture averages the strokes correctly instead: close up the words
 * are legible, far out the mip chain fades them into a darker band on the
 * architrave, which is the relief hint the real stone reads as from a distance.
 *
 * The glyphs are a monoline geometric capital defined here as polylines, not a
 * system font: the drawing must look the same on every machine, and stroked
 * polylines match the ink-line style of the rest of the scene.
 */

import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  type Texture,
} from "three";

export const REICHSTAG_DEDICATION = "DEM DEUTSCHEN VOLKE";

/** Letter height. The real bronze capitals stand about 60 cm tall. */
export const DEDICATION_CAP_HEIGHT_M = 0.62;
/** Space between adjacent letters, as a fraction of the cap height. */
export const DEDICATION_TRACKING = 0.34;
/** Stroke weight of the drawn capitals, as a fraction of the cap height. */
export const DEDICATION_STROKE = 0.15;

type Polyline = [number, number][];

/**
 * Glyphs on a unit grid: x runs 0..advance, y runs 0 (baseline) to 1 (cap).
 * Curves are pre-flattened; at 60 cm cap height the segments are millimetres.
 */
const GLYPHS: Record<string, { advance: number; strokes: Polyline[] }> = {
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
  " ": { advance: 0.5, strokes: [] },
};

export type DedicationGlyph = {
  advanceM: number;
  character: string;
  leftM: number;
};

export type DedicationLayout = {
  capHeightM: number;
  glyphs: DedicationGlyph[];
  strokeWidthM: number;
  totalWidthM: number;
};

/**
 * Lay the dedication out around z = 0 on the architrave, in metres.
 * Throws for characters the drawn alphabet does not cover, so a typo can
 * never silently ship as a gap in the stone.
 */
export function dedicationLayout(
  text: string = REICHSTAG_DEDICATION,
  capHeightM: number = DEDICATION_CAP_HEIGHT_M,
): DedicationLayout {
  const tracking = capHeightM * DEDICATION_TRACKING;
  const characters = [...text];
  let cursor = 0;
  const glyphs: DedicationGlyph[] = characters.map((character, index) => {
    const glyph = GLYPHS[character];
    if (!glyph) {
      throw new Error(`Reichstag dedication has no drawn glyph for "${character}"`);
    }
    const advanceM = glyph.advance * capHeightM;
    const leftM = cursor;
    cursor += advanceM + (index === characters.length - 1 ? 0 : tracking);
    return { advanceM, character, leftM };
  });
  return {
    capHeightM,
    glyphs,
    strokeWidthM: capHeightM * DEDICATION_STROKE,
    totalWidthM: cursor,
  };
}

export type DedicationTextureOptions = {
  bandHeightM: number;
  bandWidthM: number;
  fieldColor: string;
  letterColor: string;
  texelsPerMetre?: number;
};

/**
 * Draw the dedication onto the architrave field. Returns null where there is
 * no DOM to draw into (bun's test runner), so the model still builds headless.
 */
export function createDedicationTexture({
  bandHeightM,
  bandWidthM,
  fieldColor,
  letterColor,
  texelsPerMetre = 79,
}: DedicationTextureOptions): Texture | null {
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

  const layout = dedicationLayout();
  const originX = (bandWidthM - layout.totalWidthM) / 2;
  const baselineY = (bandHeightM - layout.capHeightM) / 2;
  context.strokeStyle = letterColor;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = layout.strokeWidthM * scale;
  for (const glyph of layout.glyphs) {
    const strokes = GLYPHS[glyph.character].strokes;
    for (const stroke of strokes) {
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
  // exactly the zoom shimmer this release removes.
  texture.minFilter = LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}
