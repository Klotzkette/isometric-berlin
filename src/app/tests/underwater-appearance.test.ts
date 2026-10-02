import { describe, expect, test } from "bun:test";
import { Color, Fog, HemisphereLight, Scene, type ColorRepresentation } from "three";
import { captureAboveWaterAppearance, restoreAboveWaterAppearance, setAboveWaterFog } from "../src/underwaterAppearance";

function fixture() {
  const scene = new Scene();
  const hemisphere = new HemisphereLight();
  let clearColor = new Color(0xdcf3f9), clearAlpha = 0.75;
  const renderer = {
    toneMappingExposure: 1,
    getClearColor: (target: Color) => target.copy(clearColor),
    getClearAlpha: () => clearAlpha,
    setClearColor: (color: ColorRepresentation, alpha = 1) => {
      clearColor = new Color(color); clearAlpha = alpha;
    },
  };
  // Entering and leaving water cannot revisit geometry, materials or GPU queues.
  scene.traverse = () => { throw Error("Whole-city traversal on water crossing"); };
  return { scene, renderer, hemisphere };
}

describe("constant-cost underwater appearance", () => {
  test("restores exact background, fog, clear colour/alpha and exposure repeatedly", () => {
    const { scene, renderer, hemisphere } = fixture();
    scene.background = new Color(0xbadaff);
    scene.fog = new Fog(0x123456, 200, 800);
    hemisphere.intensity = 2.75;
    const background = scene.background, fog = scene.fog;
    for (let i = 0; i < 1000; i++) {
      const snapshot = captureAboveWaterAppearance(scene, renderer, hemisphere);
      scene.background = new Color(0x0b4250);
      scene.fog = new Fog(0x0b4250, 4, 240);
      renderer.setClearColor(0x0b4250, 1);
      renderer.toneMappingExposure = 0.82;
      hemisphere.intensity = 0.9;
      restoreAboveWaterAppearance(snapshot, scene, renderer, hemisphere);
    }
    expect(scene.background).toBe(background);
    expect(scene.fog).toBe(fog);
    expect(renderer.getClearColor(new Color()).getHex()).toBe(0xdcf3f9);
    expect(renderer.getClearAlpha()).toBe(0.75);
    expect(renderer.toneMappingExposure).toBe(1);
    expect(hemisphere.intensity).toBe(2.75);
  });

  test("a real lighting-mode change refreshes the above-water snapshot", () => {
    const { scene, renderer, hemisphere } = fixture();
    const obsoleteDay = captureAboveWaterAppearance(scene, renderer, hemisphere);
    scene.background = new Color(0x07131f);
    scene.fog = null;
    renderer.setClearColor(0x07131f, 1);
    hemisphere.intensity = 0.52;
    // setSceneLighting establishes the new mode before reapplying its water veil.
    const night = captureAboveWaterAppearance(scene, renderer, hemisphere);
    renderer.toneMappingExposure = 0.82;
    hemisphere.intensity = 0.9;
    restoreAboveWaterAppearance(night, scene, renderer, hemisphere);
    expect(renderer.getClearColor(new Color()).getHex()).toBe(0x07131f);
    expect(hemisphere.intensity).toBe(0.52);
    expect(scene.fog).toBeNull();
    expect(night.clearColor).not.toBe(obsoleteDay.clearColor);
    expect(obsoleteDay.clearColor.getHex()).toBe(0xdcf3f9);
  });
});

test("underwater cutaway updates the future fog without recolouring the water veil", () => {
  const { scene, renderer, hemisphere } = fixture();
  scene.background = new Color(0xaedaf0);
  scene.fog = new Fog(0xaedaf0, 200, 1000);
  const above = captureAboveWaterAppearance(scene, renderer, hemisphere);
  scene.background = new Color(0x0b4250);
  const deep = new Fog(0x0b4250, 4, 240);
  scene.fog = deep;
  setAboveWaterFog(scene, above, null);
  expect(scene.fog).toBe(deep);
  restoreAboveWaterAppearance(above, scene, renderer, hemisphere);
  expect(scene.fog).toBeNull();
  expect((scene.background as Color).getHex()).toBe(0xaedaf0);
  // Leaving the cutaway uses the above-water sky colour, even while submerged.
  scene.background = new Color(0x0b4250);
  setAboveWaterFog(scene, above, { near: 200, far: 1000 });
  expect((above.fog as Fog).color.getHex()).toBe(0xaedaf0);
  expect((above.fog as Fog).far).toBe(1000);
});
