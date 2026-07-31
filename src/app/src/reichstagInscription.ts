/**
 * "DEM DEUTSCHEN VOLKE" — the bronze dedication on the architrave of the
 * Reichstag's west portico (Peter Behrens' letters, cast 1916 by S. A. Loevy).
 *
 * Only the Reichstag's own facts live here; the alphabet and the canvas
 * renderer are shared with the other drawn lettering in [[drawnLettering]].
 */

import {
  createLetteringTexture,
  letteringLayout,
  type LetteringLayout,
} from "./drawnLettering";
import type { Texture } from "three";

export const REICHSTAG_DEDICATION = "DEM DEUTSCHEN VOLKE";

/** Letter height. The real bronze capitals stand about 60 cm tall. */
export const DEDICATION_CAP_HEIGHT_M = 0.62;

export function dedicationLayout(
  text: string = REICHSTAG_DEDICATION,
  capHeightM: number = DEDICATION_CAP_HEIGHT_M,
): LetteringLayout {
  return letteringLayout(text, capHeightM);
}

export type DedicationTextureOptions = {
  bandHeightM: number;
  bandWidthM: number;
  fieldColor: string;
  letterColor: string;
  texelsPerMetre?: number;
};

export function createDedicationTexture(
  options: DedicationTextureOptions,
): Texture | null {
  return createLetteringTexture({
    ...options,
    capHeightM: DEDICATION_CAP_HEIGHT_M,
    text: REICHSTAG_DEDICATION,
  });
}
