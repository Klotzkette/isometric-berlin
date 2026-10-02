import { Color, Fog, type HemisphereLight, type Scene, type WebGLRenderer } from "three";

type RendererAppearance = Pick<WebGLRenderer,
  "getClearColor" | "getClearAlpha" | "setClearColor" | "toneMappingExposure">;
export type AboveWaterAppearance = {
  background: Scene["background"];
  fog: Scene["fog"];
  clearColor: Color;
  clearAlpha: number;
  exposure: number;
  hemisphereIntensity: number;
};

/** Keep precisely the settings the underwater veil changes. No city traversal. */
export function captureAboveWaterAppearance(
  scene: Scene, renderer: RendererAppearance, hemisphere: HemisphereLight,
): AboveWaterAppearance {
  return {
    background: scene.background,
    fog: scene.fog,
    clearColor: renderer.getClearColor(new Color()),
    clearAlpha: renderer.getClearAlpha(),
    exposure: renderer.toneMappingExposure,
    hemisphereIntensity: hemisphere.intensity,
  };
}

/** Surfacing restores the same mode without relighting/reuploading its city. */
export function restoreAboveWaterAppearance(
  snapshot: AboveWaterAppearance, scene: Scene,
  renderer: RendererAppearance, hemisphere: HemisphereLight,
): void {
  scene.background = snapshot.background;
  scene.fog = snapshot.fog;
  renderer.setClearColor(snapshot.clearColor, snapshot.clearAlpha);
  renderer.toneMappingExposure = snapshot.exposure;
  hemisphere.intensity = snapshot.hemisphereIntensity;
}

/** Cutaway changes can occur while submerged; preserve that new mode on exit. */
export function setAboveWaterFog(
  scene: Scene, snapshot: AboveWaterAppearance | null,
  range: { near: number; far: number } | null,
): void {
  const background = snapshot ? snapshot.background : scene.background;
  const color = background instanceof Color ? background.getHex() : 0xdcf3f9;
  const fog = range ? new Fog(color, range.near, range.far) : null;
  if (snapshot) snapshot.fog = fog;
  else scene.fog = fog;
}
