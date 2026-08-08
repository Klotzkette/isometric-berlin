import {
  TOUCH,
  Box3,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Fog,
  FrontSide,
  Group,
  HalfFloatType,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Material,
  Matrix4,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PCFShadowMap,
  RingGeometry,
  Scene,
  Shape,
  Spherical,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  type ArchitecturalSignature,
  type FocusCamera,
  createArchitecturalSignature,
  createIceOnRails,
  focusCameraForSignature,
} from "./ArchitecturalLandmarks";
import { createCivicLandmarks } from "./CivicLandmarks";
import { createTunnelPortals, tunnelMouthViews } from "./TunnelPortals";
import {
  createMemorialLandmarks,
  memorialFocusDistance,
} from "./MemorialLandmarks";
import {
  createCulturalLandmarks,
  culturalFocusCamera,
} from "./CulturalLandmarks";
import {
  type ParkDetailsPayload,
  createParkDetails,
  parkDetailFocusDistance,
  setParkDetailsFocus,
  setParkSettledDetail,
} from "./ParkDetails";
import { runBoundedTasks } from "./boundedTaskPool";
import {
  REGIERUNGSVIERTEL_FLIGHT_BOUNDS,
  captureCameraPose,
  cameraPoseDeltaM,
  classifyTwoFingerGesture,
  flyCameraAlongViewHeading,
  flyCameraInViewPlane,
  stabilizeCameraRig,
  decayPanMomentum,
  twoFingerPanFlight,
  zoomCameraAtScreenPoint,
} from "./cameraNavigation";
import { CRISPNESS_PROFILES, crispZoomScale } from "./crispnessProfile";
import {
  FINE_DETAIL_LAYER_NAMES,
  INK_LINE_REFERENCE_FEATURE_M,
  inkLineFadeOpacity,
  nextFineDetailVisible,
  projectedPixelSize,
} from "./fineDetailFade";
import {
  applyDrawnFacade,
  flattenBuildingVertexColors,
  HERO_FACADE_ANCHORS,
  installFlatUnlitShader,
  isDrawnFacadeCandidate,
  setBuildingColorMode,
  setFlatUnlit,
  type Rgb,
} from "./drawnBuildings";
import { heroDetailEvictions } from "./heroDetailCache";
import { skyArtefactsFor, stripSkyArtefacts } from "./meshArtefacts";
import { minecraftFogRange } from "./minecraftFog";
import { PRESENTATION_TONE } from "./presentationTone";
import {
  type PrismPayload,
  type SurfacePayload,
  SURFACE_WORLD_FILE,
  ISO_INK_COLOR,
  ISO_NIGHT_INK_COLOR,
  PRISM_WORLD_FILE,
  createIsometricCity,
  setIsoNightPresentation,
} from "./IsometricCityWorld";
import {
  type VoxelPayload,
  VOXEL_WORLD_FILE,
  WATER_TOP_Y,
  buildColumnToneLookup,
  createMinecraftVoxelWorld,
} from "./MinecraftVoxelWorld";
import {
  RAIL_LINES_FILE,
  type RailPayload,
  createRailNetwork,
} from "./RailNetwork";
import {
  STREET_DETAILS_FILE,
  type StreetDetailsPayload,
  createTrafficSignals,
  updateTrafficSignals,
} from "./TrafficSignals";
import { createFuelStations } from "./FuelStations";
import { createRiversideVenues } from "./RiversideVenues";
import { createSpreebogenOffice } from "./SpreebogenOffice";
import { createVessels } from "./Vessels";
import { createTiergartenMonuments } from "./TiergartenMonuments";
import {
  INTERACTION_COALESCE_MS,
  nextPixelRatioMode,
  nextSettledDetailMode,
  renderInteractionActive,
  renderPixelRatio,
} from "./renderQuality";
import { shouldUseSettledSurface } from "./surfaceQuality";
import { updateWindFlags } from "./WindFlags";
import {
  THREE_MOUSE_GESTURE_SETTINGS,
  wheelNavigationIntent,
} from "./viewerGestures";
import type { VisualMode } from "./visualMode";
import {
  createMinecraftMaterialState,
  disposeMinecraftMaterialState,
  releaseMinecraftMaterialBindings,
  setMinecraftMaterialPresentation,
  type MinecraftMaterialState,
} from "./visual-modes/minecraft/materialMode";
import { minecraftStabilityPolicy } from "./visual-modes/minecraft/stability";
import crispFragment from "./crisp.frag?raw";
import postprocessVertex from "./visual-modes/minecraft/postprocess.vert?raw";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type MeshFile = {
  file: string;
  source_bounds_epsg25833: [[number, number, number], [number, number, number]];
};

type SceneLandmark = {
  name: string;
  role: string;
  world: [number, number, number];
};

type HeroDetail = {
  id: string;
  landmark_name: string;
  files: MeshFile[];
};

export type TunnelPayload = {
  clear_height_m: number;
  clear_width_each_direction_m: number;
  depth_status: string;
  geometry_status: string;
  points: [number, number, number][];
};

type SceneManifest = {
  architectural_signatures?: ArchitecturalSignature[];
  base_tiles: MeshFile[];
  hero_details: HeroDetail[];
  landmarks: SceneLandmark[];
  park_details?: {
    file: string;
    geometry_status: string;
    source: string;
  };
  source: { attribution: string };
  surface_detail_tiles?: MeshFile[];
  tiergartentunnel: TunnelPayload;
};

type ViewAngles = {
  azimuthDegrees: number;
  polarDegrees: number;
  underside: boolean;
};

export type LightingMode = VisualMode;

type ThreeViewerProps = {
  active: boolean;
  canvasAriaLabel: string;
  lightingMode: LightingMode;
  // Only meaningful while lightingMode === "night"; day/minecraft ignore it.
  // See nightLighting.ts for the persisted preference this mirrors.
  nightLightsOn: boolean;
  progressLabel: string;
  sceneUrl: string;
  selectedLandmark: string;
  onError: (message: string) => void;
  onReady: () => void;
  onWarning: (message: string) => void;
  onViewChange: (angles: ViewAngles) => void;
};

export type ThreeViewerHandle = {
  flyBy: (horizontal: number, vertical: number) => void;
  flyForwardBy: (strafe: number, forward: number) => void;
  focusLandmark: (name: string, immediate?: boolean) => void;
  reset: () => void;
  rotateBy: (degrees: number) => void;
  setAzimuth: (degrees: number) => void;
  setFlightInput: (strafe: number, forward: number, vertical: number) => void;
  setUnderside: (enabled: boolean) => void;
  tiltBy: (degrees: number) => void;
  zoomBy: (factor: number) => void;
};

type Runtime = {
  camera: PerspectiveCamera;
  civicDetails: Group;
  coarsePointer: boolean;
  controls: OrbitControls;
  composer: EffectComposer;
  crispPass: ShaderPass;
  culturalDetails: Group;
  detailClock: number;
  detailGroups: Map<string, HeroDetailGroup>;
  disposed: boolean;
  focusCameraByName: Map<string, FocusCamera>;
  hemisphere: HemisphereLight;
  heroByName: Map<string, HeroDetail>;
  interactionSurface: Group;
  interactionUntil: number;
  landmarkByName: Map<string, SceneLandmark>;
  loader: GLTFLoader;
  marker: Group;
  markerTimer: number | null;
  minecraftMaterialState: MinecraftMaterialState;
  modelMaterials: Set<MeshStandardMaterial>;
  monuments: Group;
  parkDetails: Group;
  renderer: WebGLRenderer;
  /** A visual mutation waiting for one deterministic on-demand render. */
  renderInvalidated: boolean;
  scene: Scene;
  sceneRootUrl: URL;
  signatures: Group;
  skyFill: DirectionalLight;
  settledSurface: Group;
  settledSurfaceReady: boolean;
  sun: DirectionalLight;
  tunnel: Group;
  tunnelBounds: Box3 | null;
  tunnelPortals: Group;
  tunnelPoints: TunnelPayload["points"] | null;
  prismPayloadPromise?: Promise<PrismPayload>;
  voxelPayloadPromise?: Promise<VoxelPayload>;
  trafficSignals?: Group | null;
  cancelPanGlide?: () => void;
  isoWorld: Group | null;
  isoWorldState: "failed" | "idle" | "loading";
  // Far-zoom anti-flicker (v0.53.0): every ink-line LineSegments material
  // drawn by drawnKit's finishDrawnGroup ("<name> ink lines") collected
  // once per isoWorld (re)build, so its opacity can be dampened by
  // projected pixel width every frame without re-walking the scene graph.
  inkLineMaterials: Set<LineBasicMaterial>;
  // Small accessory layers (lane markings, railings, window-band mullions)
  // that only read as detail up close; hidden past FINE_DETAIL_HIDE_DISTANCE_M
  // with hysteresis so they do not blink at the boundary.
  fineDetailObjects: Object3D[];
  fineDetailVisible: boolean;
  voxelWorld: Group | null;
  voxelWorldState: "failed" | "idle" | "loading";
  lightingMode: LightingMode;
  nightLightsOn: boolean;
  underside: boolean;
  underwater: boolean;
};

type HeroDetailGroup = {
  group: Group;
  lastUsed: number;
  loadedFiles: number;
  loading: boolean;
};

const DEFAULT_TARGET = new Vector3(-110, 12, -165);
const DEFAULT_CAMERA_OFFSET = new Vector3(540, 430, 650);
const DETAIL_RAISE_M = 0.035;
const WATER_LEVEL_Y = WATER_TOP_Y;
const UNDERWATER_COLOR = 0x0b4250;

export function shouldUseUnderwaterPresentation({
  cameraY,
  insideTunnel,
  underside,
}: {
  cameraY: number;
  insideTunnel: boolean;
  underside: boolean;
}): boolean {
  return (
    cameraY < WATER_LEVEL_Y - 0.2 &&
    !insideTunnel &&
    !underside
  );
}

function setUnderwaterPresentation(runtime: Runtime, underwater: boolean): void {
  if (runtime.underwater === underwater) {
    return;
  }
  runtime.underwater = underwater;
  if (underwater) {
    const deep = new Color(UNDERWATER_COLOR);
    runtime.scene.background = deep;
    runtime.scene.fog = new Fog(deep.getHex(), 4, 240);
    // Underwater dims the whole plate a little; with no film curve this is
    // a straight linear scale, not a curve shift.
    runtime.renderer.toneMappingExposure = 0.82;
    runtime.hemisphere.intensity = 0.9;
  } else {
    setSceneLighting(runtime, runtime.lightingMode, runtime.nightLightsOn);
  }
}

let lastSurfaceQualityDataset = "";
function setSurfacePresentation(runtime: Runtime, interacting: boolean): void {
  const settled = shouldUseSettledSurface({
    coarsePointer: runtime.coarsePointer,
    detailReady: runtime.settledSurfaceReady,
    interacting,
  });
  // The voxel block world (Minecraft) and the drawn isometric city
  // (Day/Night) each fully replace the photogrammetry surfaces — except
  // from the underside, where the faded photo shell is the designed
  // cutaway context around the Tiergartentunnel (both drawn worlds hide
  // below the horizon, which otherwise left the tunnel floating in a
  // void).
  const replaced =
    (voxelModeActive(runtime) || isoModeActive(runtime)) &&
    !runtime.underside;
  const interactionVisible = !settled && !replaced;
  const settledVisible = settled && !replaced;
  const changed =
    runtime.interactionSurface.visible !== interactionVisible ||
    runtime.settledSurface.visible !== settledVisible;
  runtime.interactionSurface.visible = interactionVisible;
  runtime.settledSurface.visible = settledVisible;
  if (changed) {
    runtime.renderInvalidated = true;
  }
  setParkSettledDetail(runtime.parkDetails, settled);
  const surfaceQuality = settled ? "settled-7m-plus" : "interaction-2_3m";
  if (surfaceQuality !== lastSurfaceQualityDataset) {
    lastSurfaceQualityDataset = surfaceQuality;
    runtime.renderer.domElement.dataset.surfaceQuality = surfaceQuality;
  }
}

/**
 * Extends the interaction window. It deliberately does *not* switch the
 * surfaces itself.
 *
 * v0.50.0 gave the settled-detail tier hysteresis in the frame loop, but this
 * helper still called setSurfacePresentation(runtime, true) straight away, and
 * every navigation button and load completion goes through here. So a single
 * rotate or pan click forced the coarse interaction surface (and dropped the
 * park microcrowns) that same instant, and the hysteretic decision in the
 * frame loop put them back a frame or two later — one full blink of the ground
 * and the whole Tiergarten canopy per click, which is exactly the "flackert
 * wenn man hin und her bewegt" report. The frame loop is now the only writer;
 * this only moves the deadline it reads.
 */
function markSurfaceInteraction(runtime: Runtime, durationMs = 650): void {
  runtime.interactionUntil = Math.max(
    runtime.interactionUntil,
    performance.now() + durationMs,
  );
  runtime.renderInvalidated = true;
}

function createSelectionMarker(): Group {
  const group = new Group();
  const ring = new Mesh(
    new RingGeometry(1.5, 2.25, 48),
    new MeshBasicMaterial({
      color: 0xffc45d,
      depthTest: false,
      side: DoubleSide,
      transparent: true,
      opacity: 0.94,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 20;
  group.add(ring);
  return group;
}

// The cool moonlight floor every artificial-light material falls back to
// when "Licht aus" is active: no warm self-light, just enough of a flat,
// bluish-silver emissive to keep the authored geometry legible without
// reintroducing anything that reads as a lit window, lamp or sign.
const MOONLIGHT_EMISSIVE = 0x1c2636;
const MOONLIGHT_EMISSIVE_INTENSITY = 0.22;

export function applyMaterialLighting(
  material: MeshStandardMaterial,
  mode: LightingMode,
  lightsOn = true,
): void {
  if (!material.userData.appearanceCaptured) {
    material.userData.appearanceCaptured = true;
    material.userData.dayEmissive = material.emissive.getHex();
    material.userData.dayEmissiveIntensity = material.emissiveIntensity;
  }
  // Round-6: drawn building facades render UNLIT in day mode via the flat-unlit
  // shader (see installFlatUnlitShader). The shader outputs the material's own
  // albedo directly — the baked per-vertex real colour for vertex-kind tiles,
  // or the flat sampled tone for textured hero segments — so scene lights never
  // shade a building: every face is one flat tone, no gradient, no blob-shadow
  // from the lumpy photogrammetry. The albedo is preserved (never forced black),
  // so each building keeps its real colour. Night/minecraft turn the unlit
  // toggle off and light normally; the switch is lossless because it only flips
  // a uniform plus the emissive term.
  const isDrawn = material.userData.drawnFacadeApplied === true;
  const drawnKind = material.userData.drawnKind as string | undefined;
  const drawnFlat = material.userData.dayFlatColor as number | undefined;
  if (isDrawn) {
    setFlatUnlit(material, mode === "day");
    // Flat-kind facades restore their stored flat tone as the albedo in every
    // mode; vertex-kind facades keep the neutral white multiplier set at load
    // so the baked per-vertex colour shows through untinted.
    if (drawnKind === "flat" && typeof drawnFlat === "number") {
      material.color.setHex(drawnFlat);
    }
  }
  if (mode === "night") {
    const nightEmissive = material.userData.nightEmissive;
    if (typeof nightEmissive === "number") {
      if (lightsOn) {
        material.emissive.setHex(nightEmissive);
        material.emissiveIntensity =
          material.userData.nightEmissiveIntensity ?? 1;
      } else {
        // "Licht aus": every material carrying an authored artificial-light
        // emissive (window strips, lamp heads, lampions, dome glow, …) goes
        // dark. This is the single choke point for "alle künstlichen
        // Lichter aus" — nothing downstream needs its own lights-off branch.
        material.emissive.setHex(0x000000);
        material.emissiveIntensity = 0;
      }
    } else if (material.userData.sourceMaterial) {
      if (isDrawn) {
        // A cool, restrained self-light floor keeps the official building
        // surface legible after dark. It applies only to materials already
        // classified as drawn facades, never to terrain, vegetation or water.
        // Moonlight keeps a comparable but cooler, dimmer floor so the
        // silhouette stays legible without reading as an artificial light.
        material.emissive.setHex(lightsOn ? 0x7088a7 : MOONLIGHT_EMISSIVE);
        material.emissiveIntensity = lightsOn
          ? material.map
            ? 0.38
            : 0.34
          : MOONLIGHT_EMISSIVE_INTENSITY;
      } else {
        material.emissive.setHex(material.userData.dayEmissive ?? 0x000000);
        material.emissiveIntensity = material.map ? 0.035 : 0.015;
      }
    }
  } else {
    material.emissive.setHex(material.userData.dayEmissive ?? 0x000000);
    material.emissiveIntensity = material.userData.dayEmissiveIntensity ?? 1;
  }
  material.needsUpdate = true;
}

/**
 * Give a group of hand-authored landmark meshes the same flat-unlit day
 * treatment as the photogrammetric buildings: keep each material's authored real
 * colour as the albedo (drawnKind "vertex" → no colour rewrite) and render it
 * unlit in day mode so it shows one flat tone with no directional shading, while
 * the clean-up floor lifts near-black authored roofs into a readable dark grey.
 * Night/minecraft toggle the unlit uniform off and light normally, so window
 * emitters and the Minecraft look are untouched. Used for the civic-detail
 * landmarks (e.g. the Schweizerische Botschaft) which are authored models, not
 * photogrammetry, and would otherwise keep a shaded, near-black roof.
 */
export function markAuthoredFlatUnlit(root: Object3D): void {
  const seen = new Set<MeshStandardMaterial>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial && !seen.has(material)) {
        seen.add(material);
        installFlatUnlitShader(material);
        material.userData.drawnKind = "vertex";
        // Opaque stone receives the gentle ivory clean-up. Transparent hero
        // glass keeps its authored colour/transmission and only drops the
        // directional light gradient.
        material.userData.flatClean = material.transparent ? 0 : 1;
        material.userData.drawnFacadeApplied = true;
      }
    }
  });
}

/**
 * Walk a freshly (re)built isoWorld once and collect the two ingredient
 * lists the far-zoom anti-flicker pass needs every frame: every ink-line
 * LineSegments material (so its opacity can be dampened by projected
 * pixel width without a second scene walk) and every named fine-detail
 * object (so its visibility can follow distance with hysteresis). See
 * fineDetailFade.ts for why this is opacity/visibility, not geometry
 * resizing or LOD swapping.
 */
function collectFarZoomAntiFlickerTargets(runtime: Runtime): void {
  runtime.inkLineMaterials.clear();
  runtime.fineDetailObjects = [];
  if (!runtime.isoWorld) {
    return;
  }
  const fineDetailNames = new Set(FINE_DETAIL_LAYER_NAMES);
  runtime.isoWorld.traverse((object) => {
    if (
      object instanceof LineSegments &&
      object.material instanceof LineBasicMaterial
    ) {
      object.material.transparent = true;
      runtime.inkLineMaterials.add(object.material);
    }
    if (fineDetailNames.has(object.name)) {
      runtime.fineDetailObjects.push(object);
    }
  });
}

/**
 * Per-frame far-zoom anti-flicker update: dampens every collected ink line
 * by its own projected pixel width (mip-safe opacity fade, never a
 * geometry change) and toggles the fine-detail layers with hysteresis so
 * a camera parked at the boundary distance does not blink.
 */
function updateFarZoomAntiFlicker(
  runtime: Runtime,
  distanceM: number,
  viewportHeightPx: number,
): boolean {
  const fovDegrees = runtime.camera.fov;
  const px = projectedPixelSize(
    INK_LINE_REFERENCE_FEATURE_M,
    distanceM,
    viewportHeightPx,
    fovDegrees,
  );
  const opacity = inkLineFadeOpacity(px);
  let changed = false;
  for (const material of runtime.inkLineMaterials) {
    if (Math.abs(material.opacity - opacity) > 1e-6) {
      material.opacity = opacity;
      changed = true;
    }
  }
  const fineDetailVisible = nextFineDetailVisible({
    distanceM,
    visible: runtime.fineDetailVisible,
  });
  if (runtime.fineDetailVisible !== fineDetailVisible) {
    runtime.fineDetailVisible = fineDetailVisible;
    changed = true;
  }
  for (const object of runtime.fineDetailObjects) {
    if (object.visible !== fineDetailVisible) {
      object.visible = fineDetailVisible;
      changed = true;
    }
  }
  return changed;
}

function applyLightingToRoot(
  root: Object3D,
  mode: LightingMode,
  lightsOn = true,
): void {
  const seen = new Set<MeshStandardMaterial>();
  root.traverse((object) => {
    if (object.userData.nightOnly === true) {
      // "Licht aus" turns every night-only artificial-light prop (uplights,
      // point lights, glow cones) off along with the emissive materials
      // above — the moonlit look keeps none of them.
      object.visible = mode === "night" && lightsOn;
    }
    // Hero-model ink follows the city ink: fine grey pencil by day,
    // moonlit blue at night (materials tagged modeInk).
    if (
      object instanceof LineSegments &&
      (object.material as LineBasicMaterial).userData?.modeInk === true
    ) {
      (object.material as LineBasicMaterial).color.setHex(
        mode === "night" ? ISO_NIGHT_INK_COLOR : ISO_INK_COLOR,
      );
    }
    if (!(object instanceof Mesh)) {
      return;
    }
    // Swap flattened building geometry between its flat day colours and the
    // original per-vertex photogrammetry colours: day = piecewise-constant flat
    // faces, night/minecraft = original lit look (lossless mode switch).
    if (object.geometry?.userData?.flatColorsBuilt === true) {
      // Flat quantised block colours in BOTH drawn day and Minecraft. Only
      // night restores the raw photogrammetry colours, where the dim blue
      // rig hides the photo grain anyway. Minecraft used to restore them
      // too, which put a warm khaki PHOTO SMEAR across every hero facade —
      // measured as 98 000 px of #b6b084 on the Chancellery, and the actual
      // source of "warum … diese hässlichen Fassaden". Flat faces are also
      // simply more minecrafty than a photograph.
      setBuildingColorMode(object.geometry, mode !== "night");
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial && !seen.has(material)) {
        seen.add(material);
        applyMaterialLighting(material, mode, lightsOn);
      }
    }
  });
}

function setSceneLighting(
  runtime: Runtime,
  mode: LightingMode,
  lightsOn = true,
): void {
  runtime.renderInvalidated = true;
  runtime.lightingMode = mode;
  runtime.nightLightsOn = lightsOn;
  const isNight = mode === "night";
  const isMoonlit = isNight && !lightsOn;
  const isMinecraft = mode === "minecraft";
  if (!isMinecraft) {
    setMinecraftMaterialPresentation(
      runtime.scene,
      runtime.minecraftMaterialState,
      false,
    );
  }
  // Moonlight keeps the same dark register as ordinary night — the request
  // was for the artificial lights to disappear, not for a different sky.
  const sky = isNight ? 0x07131f : isMinecraft ? 0xaedaf0 : 0xdcf3f9;
  runtime.scene.background = new Color(sky);
  // No fog in the drawn modes ("verschwindet alles in einem Nebel …
  // das will ich überhaupt nicht"): the ivory model stays crisp to the
  // horizon. Only Minecraft keeps its genre haze.
  const voxelFog = minecraftFogRange();
  runtime.scene.fog = isMinecraft
    ? new Fog(sky, voxelFog.near, voxelFog.far)
    : null;
  // Tone response per mode: the drawn modes reproduce authored paint with
  // no film curve, Minecraft keeps ACES for its lit cubes. See
  // presentationTone.ts for the measurements behind that split.
  const tone = PRESENTATION_TONE[mode];
  runtime.renderer.toneMapping = tone.toneMapping;
  runtime.renderer.toneMappingExposure = tone.exposure;
  // "Licht aus" keeps the authored-colour contract (NoToneMapping/exposure
  // 1, see presentationTone.ts) and only recolours the ambient rig itself:
  // a cooler, slightly dimmer hemisphere/key/fill so the whole city reads
  // as lit by the moon alone, while staying comfortably above black so the
  // isometric drawing (silhouettes, ink lines, isoFaceShade steps) stays
  // legible — "man sieht nur noch die Isometrie".
  runtime.hemisphere.color.setHex(
    isMoonlit ? 0x4a6690 : isNight ? 0x5877a4 : isMinecraft ? 0xeef9ff : 0xffffff,
  );
  // Day's hemisphere ground half is nearly as bright as its sky half. A
  // HemisphereLight weights a VERTICAL face at the midpoint of the two, so
  // the old dark 0x8e9589 half was what dropped every lit landmark wall to
  // a mid grey while the unlit prisms beside it stayed ivory. Two different
  // brightness worlds in one drawing; now they agree.
  runtime.hemisphere.groundColor.setHex(
    isMoonlit ? 0x050b12 : isNight ? 0x08120f : isMinecraft ? 0x8ea084 : 0xe4e6e0,
  );
  // Without a film curve the drawn modes need light levels that land BELOW
  // clipping on their own: the previous 2.52/2.72 rig relied on the ACES
  // shoulder to pull an over-driven scene back into range, which is exactly
  // what greyed the ivory. Minecraft keeps strong shadow sides on its cubes.
  // Day is calibrated so a LIT up-facing surface reproduces its own paint
  // tone: (hemisphere + sun · n·l) / π ≈ 1.07 for a top face, dropping to
  // ≈ 0.76 on a shadow side. Lit content (trees, park details, monuments)
  // therefore agrees tonally with the unlit prisms and ground instead of
  // being multiplied by an arbitrary rig, and the face-to-face step reads
  // as the same axonometric plasticity `isoFaceShade` draws by hand.
  runtime.hemisphere.intensity = isMoonlit ? 0.4 : isNight ? 0.52 : isMinecraft ? 2.05 : 2.75;
  // A near-white key: the old amber 0xffdda3 crushed the blue channel of
  // every cream facade and turned the Chancellery lemon-yellow. Moonlight
  // pushes the key further into cool silver-blue — authored colour, not a
  // curve — consistent with a single distant moon instead of city glow.
  runtime.sun.color.setHex(
    isMoonlit ? 0xaecbef : isNight ? 0x91b9ed : isMinecraft ? 0xfffaf0 : 0xfff8ea,
  );
  // Day's key is deliberately gentle. With the ambient half carrying the
  // brightness, the sun only has to supply the direction of the light —
  // the same job `isoFaceShade` does for the unlit prisms. A strong key
  // would reintroduce the blob shadows the owner rejected.
  runtime.sun.intensity = isMoonlit ? 0.62 : isNight ? 0.85 : isMinecraft ? 2.2 : 0.62;
  runtime.skyFill.color.setHex(
    isMoonlit ? 0x53699a : isNight ? 0x6c82ae : isMinecraft ? 0x9fd8f2 : 0xb6dcff,
  );
  runtime.skyFill.intensity = isMoonlit ? 0.16 : isNight ? 0.2 : isMinecraft ? 0.5 : 0.12;
  runtime.sun.position.set(
    isMinecraft ? 760 : -760,
    980,
    isMinecraft ? -720 : 720,
  );
  for (const material of runtime.modelMaterials) {
    applyMaterialLighting(material, mode, lightsOn);
  }
  applyLightingToRoot(runtime.signatures, mode, lightsOn);
  applyLightingToRoot(runtime.civicDetails, mode, lightsOn);
  applyLightingToRoot(runtime.monuments, mode, lightsOn);
  applyLightingToRoot(runtime.culturalDetails, mode, lightsOn);
  applyLightingToRoot(runtime.parkDetails, mode, lightsOn);
  if (isMinecraft) {
    setMinecraftMaterialPresentation(
      runtime.scene,
      runtime.minecraftMaterialState,
      true,
    );
  }
  runtime.crispPass.enabled = false;
  const crispness = CRISPNESS_PROFILES[isNight ? "night" : "day"];
  runtime.crispPass.uniforms.strength.value = crispness.strength;
  runtime.crispPass.uniforms.saturation.value = crispness.saturation;
  runtime.crispPass.uniforms.contrast.value = crispness.contrast;
  runtime.crispPass.uniforms.edgeStrength.value = crispness.edgeStrength;
  // True voxel Minecraft: once the LoD2 block world is loaded, it fully
  // REPLACES the photogrammetry surfaces and the recognition layers —
  // the city is cubes, nothing else. Until the payload arrives (or if it
  // fails) the toon-material presentation stays as the fallback.
  const voxelMode = voxelModeActive(runtime);
  const isoMode = isoModeActive(runtime);
  if (runtime.voxelWorld) {
    runtime.voxelWorld.visible = voxelMode && !runtime.underside;
  }
  if (runtime.isoWorld) {
    runtime.isoWorld.visible = isoMode && !runtime.underside;
  }
  // The approaches are the sole surface portal geometry. Never draw them
  // through an underside/cutaway view, where their forced surface depth would
  // otherwise make an underground tube look like it broke through the ground.
  runtime.tunnelPortals.visible = !runtime.underside;
  // Recognition models (dome, gate, memorials, park trees…) are drawn
  // geometry — they stay ON in the drawn isometric city and complement
  // the prisms; only the voxel world and the underside hide them. The
  // photographic hero crops additionally hide in the drawn city.
  const recognitionVisible = !runtime.underside && !voxelMode;
  // Landmarks must survive the block world ("nicht um Detailverlust
  // gebeten"): architectural signatures and the memorial models stay
  // visible in Minecraft too (they get the toon treatment); only the
  // softer cultural/park layers and photo crops step aside there.
  runtime.signatures.visible = !runtime.underside;
  runtime.civicDetails.visible = recognitionVisible;
  runtime.monuments.visible = !runtime.underside;
  runtime.culturalDetails.visible = recognitionVisible;
  runtime.parkDetails.visible = recognitionVisible;
  for (const detail of runtime.detailGroups.values()) {
    detail.group.visible = recognitionVisible && !isoMode;
  }
  // Both drawn worlds (prisms and voxels) use the flat isometric FOV;
  // only the photographic fallback keeps the 39° perspective.
  const targetFov =
    isoMode || voxelMode ? ISO_FOV_DEGREES : PHOTO_FOV_DEGREES;
  if (runtime.camera.fov !== targetFov) {
    // Dolly-zoom: pull the camera back exactly as much as the narrower
    // FOV magnifies, so the framing survives the projection change.
    const scale = fovDollyScale(runtime.camera.fov, targetFov);
    const offset = runtime.camera.position
      .clone()
      .sub(runtime.controls.target)
      .multiplyScalar(scale);
    runtime.controls.maxDistance = 2600 * fovDollyScale(PHOTO_FOV_DEGREES, targetFov);
    runtime.controls.minDistance = 30 * fovDollyScale(PHOTO_FOV_DEGREES, targetFov);
    runtime.camera.position.copy(runtime.controls.target).add(offset);
    runtime.camera.far = 16_000;
    runtime.camera.fov = targetFov;
    runtime.camera.updateProjectionMatrix();
  }
  if (runtime.isoWorld) {
    setIsoNightPresentation(runtime.isoWorld, isNight, lightsOn);
  }
  if (runtime.underwater) {
    runtime.underwater = false;
    setUnderwaterPresentation(runtime, true);
  }
}

function voxelModeActive(runtime: Runtime): boolean {
  return runtime.lightingMode === "minecraft" && runtime.voxelWorld !== null;
}

/**
 * The drawn isometric city replaces the photogrammetry in DAY and NIGHT
 * mode once its LoD2-prism payload has loaded (night simply relights the
 * same drawn prisms and brightens the ink). Minecraft owns the voxel
 * world.
 */
function isoModeActive(runtime: Runtime): boolean {
  return (
    (runtime.lightingMode === "day" || runtime.lightingMode === "night") &&
    runtime.isoWorld !== null
  );
}

/**
 * Load and attach the drawn isometric city (LoD2 prisms + shared ground
 * slabs). Idempotent; on failure the photographic day pipeline stays.
 */
// The multi-MB prism/voxel payloads are fetched and parsed exactly
// once per session, shared by the drawn-city and block-world paths
// (a ?theme=minecraft deep link used to download both files twice).
function fetchPrismPayload(runtime: Runtime): Promise<PrismPayload> {
  runtime.prismPayloadPromise ??= fetch(
    new URL(PRISM_WORLD_FILE, runtime.sceneRootUrl).toString(),
  ).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json() as Promise<PrismPayload>;
  });
  return runtime.prismPayloadPromise;
}

function fetchVoxelPayload(runtime: Runtime): Promise<VoxelPayload> {
  runtime.voxelPayloadPromise ??= fetch(
    new URL(VOXEL_WORLD_FILE, runtime.sceneRootUrl).toString(),
  ).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json() as Promise<VoxelPayload>;
  });
  return runtime.voxelPayloadPromise;
}

function ensureIsoWorld(runtime: Runtime, warn: (message: string) => void): void {
  if (runtime.isoWorldState !== "idle") {
    return;
  }
  runtime.isoWorldState = "loading";
  void Promise.all([
    fetchPrismPayload(runtime),
    fetchVoxelPayload(runtime).catch(() => null),
    fetch(new URL(STREET_DETAILS_FILE, runtime.sceneRootUrl).toString())
      .then((response) =>
        response.ok ? (response.json() as Promise<StreetDetailsPayload>) : null,
      )
      .catch(() => null),
    fetch(new URL(SURFACE_WORLD_FILE, runtime.sceneRootUrl).toString())
      .then((response) =>
        response.ok ? (response.json() as Promise<SurfacePayload>) : null,
      )
      .catch(() => null),
    fetch(new URL(RAIL_LINES_FILE, runtime.sceneRootUrl).toString())
      .then((response) =>
        response.ok ? (response.json() as Promise<RailPayload>) : null,
      )
      .catch(() => null),
  ])
    .then(([prisms, ground, street, surfaces, rail]) => {
      if (runtime.disposed) {
        return;
      }
      runtime.isoWorld = createIsometricCity(
        prisms,
        ground,
        runtime.tunnelPoints,
        surfaces,
      );
      if (ground && street) {
        // Task 07: the real OSM traffic signals join the drawn city, so
        // they inherit its day/night/voxel/underside visibility.
        const signals = createTrafficSignals(street, ground);
        if (signals) {
          runtime.isoWorld.add(signals);
          runtime.trafficSignals = signals;
        }
        // Every OSM monument in the quarter, drawn ("alle Denkmäler").
        const monuments = createTiergartenMonuments(street, ground);
        if (monuments) {
          runtime.isoWorld.add(monuments);
        }
        // The quarter's three filling stations, canopy and all.
        const fuel = createFuelStations(street, ground);
        if (fuel) {
          runtime.isoWorld.add(fuel);
        }
        // Capital Beach on the Ludwig-Erhard-Ufer and the beer gardens.
        const venues = createRiversideVenues(street, ground);
        if (venues) {
          runtime.isoWorld.add(venues);
        }
      }
      if (ground) {
        // Staffage the owner asked for: a barge in the Humboldthafen and
        // an excursion yacht on the Spree. No OSM source for either.
        runtime.isoWorld.add(
          createVessels(ground.water_top_y_m ?? undefined),
        );
        // The 2026 interim seat of the Bundespräsidialamt, too new for LoD2.
        const office = createSpreebogenOffice(ground);
        if (office) {
          runtime.isoWorld.add(office);
        }
      }
      if (ground && rail) {
        // The Stadtbahn viaduct carries the tracks off both ends of the
        // Hauptbahnhof instead of letting them stop in mid-air.
        const railway = createRailNetwork(rail, ground);
        if (railway) {
          runtime.isoWorld.add(railway);
        }
        // Task 37: the stationary ICE used to stand on the Hauptbahnhof
        // model's own stub track, which pointed off the east gable at
        // open water over the Humboldthafen. It now rides a real
        // viaduct_tracks centreline near the station, in the same
        // world-space frame as the railway above (not nested inside the
        // rotated/translated station model group).
        const ice = createIceOnRails(rail);
        if (ice) {
          runtime.isoWorld.add(ice);
        }
      }
      collectFarZoomAntiFlickerTargets(runtime);
      runtime.scene.add(runtime.isoWorld);
      setSceneLighting(runtime, runtime.lightingMode, runtime.nightLightsOn);
      markSurfaceInteraction(runtime, 400);
    })
    .catch(() => {
      if (!runtime.disposed) {
        runtime.isoWorldState = "failed";
        warn(
          "Die gezeichnete Isometrie konnte nicht geladen werden; die fotografische Tagesansicht bleibt aktiv.",
        );
      }
    });
}

/**
 * Lazy-load and attach the LoD2 block world for Minecraft mode.
 * Idempotent; until it arrives (or on failure) the toon presentation on
 * the photographic mesh is the fallback. Called both on mode switches
 * and at scene init, so a fresh `?theme=minecraft` load gets blocks too.
 */
function ensureVoxelWorld(
  runtime: Runtime,
  warn: (message: string) => void,
): void {
  if (runtime.voxelWorldState !== "idle") {
    return;
  }
  runtime.voxelWorldState = "loading";
  void Promise.all([
    fetchVoxelPayload(runtime),
    // The prism payload carries each building's sampled real colour;
    // the block city snaps those onto the Minecraft palette so it
    // stops being one cream-coloured mass.
    fetchPrismPayload(runtime).catch(() => null),
  ])
    .then(([payload, prisms]) => {
      if (runtime.disposed) {
        return;
      }
      runtime.voxelWorld = createMinecraftVoxelWorld(
        payload,
        prisms ? buildColumnToneLookup(prisms) : null,
      );
      runtime.scene.add(runtime.voxelWorld);
      setSceneLighting(runtime, runtime.lightingMode, runtime.nightLightsOn);
      markSurfaceInteraction(runtime, 400);
    })
    .catch(() => {
      if (!runtime.disposed) {
        runtime.voxelWorldState = "failed";
        warn(
          "Die Voxel-Welt konnte nicht geladen werden; der Minecraft-Modus nutzt die Block-Materialien.",
        );
      }
    });
}

// Narrower FOV flattens the perspective toward a true isometric look
// while the drawn city is active; the photographic modes keep 39°.
const PHOTO_FOV_DEGREES = 39;
// 16° with dolly compensation: the drawn city reads near-axonometric —
// verticals stay vertical-ish, blocks stop looking "gedrückt" — while
// the perspective camera machinery (controls, fly, focus) stays.
const ISO_FOV_DEGREES = 16;

/** Dolly factor that keeps the framed view identical across FOVs. */
function fovDollyScale(fromDegrees: number, toDegrees: number): number {
  return (
    Math.tan(MathUtils.degToRad(fromDegrees) / 2) /
    Math.tan(MathUtils.degToRad(toDegrees) / 2)
  );
}

function segmentMesh(
  geometry: BoxGeometry,
  material: MeshPhysicalMaterial | MeshBasicMaterial,
  start: Vector3,
  end: Vector3,
  offset: number,
): Mesh {
  const delta = end.clone().sub(start);
  const length = Math.hypot(delta.x, delta.z) || 1;
  const normal = new Vector3(-delta.z / length, 0, delta.x / length);
  const mesh = new Mesh(geometry, material);
  mesh.scale.z = length;
  mesh.position.copy(start).add(end).multiplyScalar(0.5).addScaledVector(normal, offset);
  mesh.rotation.y = Math.atan2(delta.x, delta.z);
  return mesh;
}

function addInstancedMeshes(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  material: Material,
  matrices: Matrix4[],
  renderOrder = 0,
): void {
  if (matrices.length === 0) {
    return;
  }
  const mesh = new InstancedMesh(geometry, material, matrices.length);
  mesh.name = name;
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.renderOrder = renderOrder;
  group.add(mesh);
}

export function createTunnel(payload: TunnelPayload): Group {
  const group = new Group();
  group.name = "Tiergartentunnel cutaway";
  const width = payload.clear_width_each_direction_m;
  const height = payload.clear_height_m;
  const casingMaterial = tunnelMaterial(
    new MeshPhysicalMaterial({
      color: 0x5e98aa,
      emissive: 0x246f84,
      emissiveIntensity: 1.25,
      metalness: 0.12,
      roughness: 0.72,
      side: DoubleSide,
    }),
    0.19,
    0.58,
  );
  const roadMaterial = tunnelMaterial(
    new MeshPhysicalMaterial({
      color: 0x30464f,
      emissive: 0x162d35,
      emissiveIntensity: 0.72,
      roughness: 0.9,
      side: DoubleSide,
    }),
    0.16,
    0.82,
  );
  const lightMaterial = tunnelMaterial(
    new MeshBasicMaterial({ color: 0xffe59b }),
    0.46,
    1,
  );
  const lightStripMaterial = tunnelMaterial(
    new MeshBasicMaterial({ color: 0xffe3a1 }),
    0.3,
    0.82,
  );
  const casingGeometry = new BoxGeometry(width, height, 1);
  const roadGeometry = new BoxGeometry(width - 0.7, 0.28, 1);
  const lightStripGeometry = new BoxGeometry(0.12, 0.1, 1);
  const lampGeometry = new SphereGeometry(0.95, 12, 8);
  const laneMarkGeometry = new BoxGeometry(0.16, 0.06, 1);
  const laneMarkMaterial = tunnelMaterial(
    new MeshBasicMaterial({ color: 0xe8e4d4 }),
    0.22,
    0.92,
  );
  const shaftGeometry = new CylinderGeometry(2.4, 2.4, 12, 20, 1, true);
  const shaftMaterial = tunnelMaterial(
    new MeshPhysicalMaterial({
      color: 0x85949c,
      metalness: 0.36,
      roughness: 0.5,
      side: DoubleSide,
    }),
    0.22,
    0.74,
  );
  const fanGeometry = new TorusGeometry(1.65, 0.28, 10, 28);
  const fanMaterial = tunnelMaterial(
    new MeshBasicMaterial({ color: 0xffd978, side: DoubleSide }),
    0.25,
    0.96,
  );
  const bladeGeometry = new BoxGeometry(1.3, 0.12, 0.3);
  const bladeMaterial = tunnelMaterial(
    new MeshBasicMaterial({ color: 0xffd978, side: DoubleSide }),
    0.25,
    0.96,
  );
  // Portal headwall: a rectangular concrete frame around each tube mouth so
  // the entrance reads as a real portal instead of an abruptly cut-open box
  // (requirement #5). The frame is one extruded ring (outer rectangle with a
  // tube-sized hole) instanced once per tube per visible endpoint.
  const portalJamb = 1.4;
  const portalOuterW = width + portalJamb * 2;
  const portalOuterH = height + portalJamb * 2;
  const portalShape = new Shape();
  portalShape.moveTo(-portalOuterW / 2, -portalOuterH / 2);
  portalShape.lineTo(portalOuterW / 2, -portalOuterH / 2);
  portalShape.lineTo(portalOuterW / 2, portalOuterH / 2);
  portalShape.lineTo(-portalOuterW / 2, portalOuterH / 2);
  portalShape.lineTo(-portalOuterW / 2, -portalOuterH / 2);
  const portalHole = new Shape();
  portalHole.moveTo(-width / 2, -height / 2);
  portalHole.lineTo(width / 2, -height / 2);
  portalHole.lineTo(width / 2, height / 2);
  portalHole.lineTo(-width / 2, height / 2);
  portalHole.lineTo(-width / 2, -height / 2);
  portalShape.holes.push(portalHole);
  const portalGeometry = new ExtrudeGeometry(portalShape, {
    depth: 1.6,
    bevelEnabled: false,
    steps: 1,
  });
  portalGeometry.translate(0, 0, -0.8);
  const portalMaterial = tunnelMaterial(
    new MeshPhysicalMaterial({
      color: 0x74797f,
      emissive: 0x2c3237,
      emissiveIntensity: 0.6,
      metalness: 0.18,
      roughness: 0.82,
      side: DoubleSide,
    }),
    0.24,
    0.86,
  );
  const portalMatrices: Matrix4[] = [];
  const points = payload.points.map((point) => new Vector3(...point));
  const lampMatrices: Matrix4[] = [];
  const laneMarkMatrices: Matrix4[] = [];
  const shaftMatrices: Matrix4[] = [];
  const fanMatrices: Matrix4[] = [];
  const bladeMatrices: Matrix4[] = [];
  const instance = new Object3D();

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const delta = end.clone().sub(start);
    const segmentLength = Math.hypot(delta.x, delta.z);
    for (const side of [-1, 1]) {
      const offset = side * (width / 2 + 0.85);
      const casing = segmentMesh(
        casingGeometry,
        casingMaterial,
        start,
        end,
        offset,
      );
      group.add(casing);
      const road = segmentMesh(roadGeometry, roadMaterial, start, end, offset);
      road.position.y -= height / 2 - 0.26;
      group.add(road);
      for (const wallSide of [-1, 1]) {
        const strip = segmentMesh(
          lightStripGeometry,
          lightStripMaterial,
          start,
          end,
          offset + wallSide * (width / 2 - 0.55),
        );
        strip.name = "Tiergartentunnel continuous safety-light strip";
        strip.position.y += height / 2 - 0.48;
        strip.renderOrder = 12;
        group.add(strip);
      }

      const lampCount = Math.max(1, Math.floor(segmentLength / 24));
      const normal = new Vector3(-delta.z / segmentLength, 0, delta.x / segmentLength);
      for (let lamp = 1; lamp <= lampCount; lamp += 1) {
        const position = start.clone().lerp(end, lamp / (lampCount + 1));
        position.addScaledVector(normal, offset).add(new Vector3(0, height / 2 - 0.35, 0));
        instance.position.copy(position);
        instance.rotation.set(0, 0, 0);
        instance.scale.set(1, 1, 1);
        instance.updateMatrix();
        lampMatrices.push(instance.matrix.clone());
      }
      const markCount = Math.max(1, Math.floor(segmentLength / 16));
      for (let mark = 1; mark <= markCount; mark += 1) {
        instance.position
          .copy(start)
          .lerp(end, mark / (markCount + 1))
          .addScaledVector(normal, offset)
          .add(new Vector3(0, -height / 2 + 0.46, 0));
        instance.rotation.set(0, Math.atan2(delta.x, delta.z), 0);
        instance.scale.set(
          1,
          1,
          Math.min(5.5, segmentLength / (markCount + 1) / 2),
        );
        instance.updateMatrix();
        laneMarkMatrices.push(instance.matrix.clone());
      }
    }
  }

  addInstancedMeshes(
    group,
    "Tiergartentunnel instanced ceiling lights",
    lampGeometry,
    lightMaterial,
    lampMatrices,
    12,
  );
  addInstancedMeshes(
    group,
    "Tiergartentunnel instanced dashed lane markings",
    laneMarkGeometry,
    laneMarkMaterial,
    laneMarkMatrices,
    11,
  );

  for (const point of points.filter((_, index) => index % 2 === 0)) {
    instance.position.copy(point).add(new Vector3(0, 6, 0));
    instance.rotation.set(0, 0, 0);
    instance.scale.set(1, 1, 1);
    instance.updateMatrix();
    shaftMatrices.push(instance.matrix.clone());

    const fanPosition = point.clone().add(new Vector3(0, 11.8, 0));
    instance.position.copy(fanPosition);
    instance.rotation.set(Math.PI / 2, 0, 0);
    instance.updateMatrix();
    fanMatrices.push(instance.matrix.clone());
    for (let bladeIndex = 0; bladeIndex < 4; bladeIndex += 1) {
      const angle = (bladeIndex / 4) * Math.PI * 2;
      instance.position.copy(fanPosition).add(
        new Vector3(Math.cos(angle) * 0.72, 0, Math.sin(angle) * 0.72),
      );
      instance.rotation.set(0, -angle, 0);
      instance.updateMatrix();
      bladeMatrices.push(instance.matrix.clone());
    }
  }
  // Portal frames at the two visible endpoints (north/south mouths), one per
  // tube. The terminal segment gives the facing direction so the headwall
  // sits square across each tube opening.
  if (points.length >= 2) {
    const endpoints: { point: Vector3; delta: Vector3 }[] = [
      { point: points[0], delta: points[1].clone().sub(points[0]) },
      {
        point: points[points.length - 1],
        delta: points[points.length - 1].clone().sub(points[points.length - 2]),
      },
    ];
    for (const { point, delta } of endpoints) {
      const length = Math.hypot(delta.x, delta.z) || 1;
      const yaw = Math.atan2(delta.x, delta.z);
      const normal = new Vector3(-delta.z / length, 0, delta.x / length);
      for (const side of [-1, 1]) {
        const offset = side * (width / 2 + 0.85);
        instance.position.copy(point).addScaledVector(normal, offset);
        instance.rotation.set(0, yaw, 0);
        instance.scale.set(1, 1, 1);
        instance.updateMatrix();
        portalMatrices.push(instance.matrix.clone());
      }
    }
  }
  addInstancedMeshes(
    group,
    "Tiergartentunnel instanced portal frames",
    portalGeometry,
    portalMaterial,
    portalMatrices,
    13,
  );
  addInstancedMeshes(
    group,
    "Tiergartentunnel instanced ventilation shafts",
    shaftGeometry,
    shaftMaterial,
    shaftMatrices,
  );
  addInstancedMeshes(
    group,
    "Tiergartentunnel instanced ventilation fan rings",
    fanGeometry,
    fanMaterial,
    fanMatrices,
  );
  addInstancedMeshes(
    group,
    "Tiergartentunnel instanced ventilation fan blades",
    bladeGeometry,
    bladeMaterial,
    bladeMatrices,
  );
  setTunnelPresentation(group, false);
  return group;
}

function tunnelMaterial<T extends Material>(
  material: T,
  surfaceOpacity: number,
  undersideOpacity: number,
): T {
  material.depthTest = false;
  material.depthWrite = false;
  material.opacity = surfaceOpacity;
  material.transparent = true;
  material.userData.tunnelSurfaceOpacity = surfaceOpacity;
  material.userData.tunnelUndersideOpacity = undersideOpacity;
  return material;
}

export function setTunnelPresentation(tunnel: Group, underside: boolean): void {
  tunnel.visible = underside;
  tunnel.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    if (typeof object.userData.tunnelLayerOrder !== "number") {
      object.userData.tunnelLayerOrder = object.renderOrder;
    }
    object.renderOrder =
      (underside ? 14 : 10) + object.userData.tunnelLayerOrder;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      const opacity = underside
        ? material.userData.tunnelUndersideOpacity
        : material.userData.tunnelSurfaceOpacity;
      if (typeof opacity === "number") {
        material.opacity = opacity;
        material.needsUpdate = true;
      }
    }
  });
}

function setModelMaterialState(runtime: Runtime, underside: boolean): void {
  runtime.underside = underside;
  runtime.renderInvalidated = true;
  if (underside) {
    runtime.marker.visible = false;
  }
  for (const material of runtime.modelMaterials) {
    material.side = underside ? DoubleSide : FrontSide;
    material.transparent = underside;
    material.opacity = underside ? 0.13 : 1;
    material.depthWrite = !underside;
    material.needsUpdate = true;
  }
  setTunnelPresentation(runtime.tunnel, underside);
  const voxelMode = voxelModeActive(runtime);
  const isoMode = isoModeActive(runtime);
  if (runtime.voxelWorld) {
    runtime.voxelWorld.visible = voxelMode && !underside;
  }
  if (runtime.isoWorld) {
    runtime.isoWorld.visible = isoMode && !underside;
  }
  runtime.tunnelPortals.visible = !underside;
  const recognitionVisible = !underside && !voxelMode;
  runtime.signatures.visible = !underside;
  runtime.civicDetails.visible = recognitionVisible;
  runtime.monuments.visible = !underside;
  runtime.culturalDetails.visible = recognitionVisible;
  runtime.parkDetails.visible = recognitionVisible;
  for (const detail of runtime.detailGroups.values()) {
    detail.group.visible = recognitionVisible && !isoMode;
  }
}

function notifyView(runtime: Runtime, callback: (angles: ViewAngles) => void): void {
  callback({
    azimuthDegrees: MathUtils.radToDeg(runtime.controls.getAzimuthalAngle()),
    polarDegrees: MathUtils.radToDeg(runtime.controls.getPolarAngle()),
    underside: runtime.underside,
  });
}

function markerHeightForLandmark(name: string): number {
  switch (name) {
    case "Reichstagsgebäude":
      return 62;
    case "Berlin Hauptbahnhof":
      return 58;
    case "Bundeskanzleramt":
      return 50;
    case "Carillon im Tiergarten":
      return 46;
    case "TIPI am Kanzleramt":
      return 23;
    case "Brandenburger Tor":
      return 34;
    default:
      return 18;
  }
}

function setOrbitAngles(
  runtime: Runtime,
  angles: { azimuth?: number; polar?: number },
): void {
  const offset = runtime.camera.position.clone().sub(runtime.controls.target);
  const spherical = new Spherical().setFromVector3(offset);
  if (angles.azimuth !== undefined) {
    spherical.theta = angles.azimuth;
  }
  if (angles.polar !== undefined) {
    spherical.phi = MathUtils.clamp(angles.polar, 0.06, Math.PI - 0.06);
  }
  offset.setFromSpherical(spherical);
  runtime.camera.position.copy(runtime.controls.target).add(offset);
  runtime.controls.update();
}

function disposeObject3D(runtime: Runtime, root: Object3D): void {
  releaseMinecraftMaterialBindings(root, runtime.minecraftMaterialState);
  const geometries = new Set<Mesh["geometry"]>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const closeableImages = new Set<{ close: () => void }>();
  root.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) {
      return;
    }
    if (object instanceof InstancedMesh) {
      // Releases instanceMatrix/instanceColor GPU buffers explicitly.
      object.dispose();
    }
    geometries.add(object.geometry);
    // The drawn worlds keep a day/night material pair in userData; the
    // inactive one must be disposed too, not only the assigned one.
    for (const key of ["dayMaterial", "nightMaterial"] as const) {
      const stored = object.userData[key];
      if (stored instanceof Material) {
        materials.add(stored);
      }
    }
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of objectMaterials) {
      materials.add(material);
      for (const value of Object.values(
        material as unknown as Record<string, unknown>,
      )) {
        if (value instanceof Texture) {
          textures.add(value);
          const image = value.source.data as { close?: () => void } | undefined;
          if (typeof image?.close === "function") {
            closeableImages.add(image as { close: () => void });
          }
        }
      }
    }
  });
  root.removeFromParent();
  root.clear();
  for (const geometry of geometries) {
    geometry.dispose();
  }
  for (const texture of textures) {
    texture.dispose();
  }
  for (const image of closeableImages) {
    image.close();
  }
  for (const material of materials) {
    if (material instanceof MeshStandardMaterial) {
      runtime.modelMaterials.delete(material);
    }
    material.dispose();
  }
}

function evictHeroDetails(runtime: Runtime, activeName: string): void {
  const limit = runtime.coarsePointer ? 1 : 2;
  const evictions = heroDetailEvictions(
    [...runtime.detailGroups].map(([name, entry]) => ({
      lastUsed: entry.lastUsed,
      loading: entry.loading,
      name,
    })),
    activeName,
    limit,
  );
  for (const name of evictions) {
    const entry = runtime.detailGroups.get(name);
    if (!entry) {
      continue;
    }
    runtime.detailGroups.delete(name);
    disposeObject3D(runtime, entry.group);
  }
}

async function loadModel(
  runtime: Runtime,
  file: MeshFile,
  parent: Group | Scene,
  { detail, facadeAnchor }: { detail: boolean; facadeAnchor?: Rgb },
): Promise<boolean> {
  if (runtime.disposed) {
    return false;
  }
  const url = new URL(file.file, runtime.sceneRootUrl).toString();
  const gltf = await runtime.loader.loadAsync(url);
  if (runtime.disposed) {
    disposeObject3D(runtime, gltf.scene);
    return false;
  }
  gltf.scene.traverse((object: Object3D) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    object.receiveShadow = true;
    object.castShadow = detail && !runtime.coarsePointer;
    if (!detail && !object.geometry.getAttribute("normal")) {
      object.geometry.computeVertexNormals();
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    let flattenGeometry = false;
    for (const sourceMaterial of materials) {
      const material = sourceMaterial as MeshStandardMaterial;
      material.side = FrontSide;
      // Buildings are drawn, never photographic. applyDrawnFacade turns the
      // baked aerial photo into a rendered architectural drawing — posterised
      // gouache tones plus inked window/cornice lines — so the facade keeps its
      // articulation without any photo look; the crisp edge pass adds the clean
      // silhouette outline. Geometry is untouched (≤ 1 px hero-centre contract).
      // Vegetation/cut-out cards are exempt (post-v0.5.6 fix): stripping their
      // alpha texture turned trees into solid light-blue quads, so they keep
      // their maps and stay recognisable.
      if (isDrawnFacadeCandidate(material)) {
        applyDrawnFacade(material, { anchor: facadeAnchor });
        if (material.userData.drawnKind === "vertex") {
          flattenGeometry = true;
        }
      }
      material.emissive.set(0x2b3130);
      material.emissiveIntensity = 0.07;
      material.userData.sourceMaterial = true;
      applyMaterialLighting(material, runtime.lightingMode, runtime.nightLightsOn);
      if (detail) {
        // Hero-detail tiles are a higher-resolution copy of the same building
        // that already exists in the base/surface tile beneath them. Two
        // near-coplanar textured copies z-fight — this was the flicker on the
        // Brandenburger Tor and other landmark facades. A weak -1/-1 offset
        // left near-vertical facades (viewed edge-on, where the depth slope is
        // largest) still fighting, so bias the detail copy decisively toward
        // the camera. This is a depth-only bias: it never displaces the mesh,
        // so the <= 1 px hero-centre contract is untouched.
        material.polygonOffset = true;
        material.polygonOffsetFactor = -4;
        material.polygonOffsetUnits = -8;
      }
      material.side = runtime.underside ? DoubleSide : FrontSide;
      material.transparent = runtime.underside;
      material.opacity = runtime.underside ? 0.13 : 1;
      material.depthWrite = !runtime.underside;
      material.needsUpdate = true;
      runtime.modelMaterials.add(material);
    }
    // Flatten the baked per-vertex photogrammetry colours into piecewise-
    // constant flat faces (zero gradient within a face) for the drawn day look,
    // keeping the originals for the lossless night/minecraft restore. Applied
    // once per mesh geometry; vegetation/water vertices are left soft inside.
    if (flattenGeometry && object.geometry.getAttribute("color")) {
      flattenBuildingVertexColors(object.geometry);
      setBuildingColorMode(object.geometry, runtime.lightingMode === "day");
    }
  });
  if (detail) {
    gltf.scene.position.y += DETAIL_RAISE_M;
  }
  stripSkyArtefacts(gltf.scene, skyArtefactsFor(file.file));
  parent.add(gltf.scene);
  // Render-on-demand must also cover streaming geometry: after an otherwise
  // quiet frame a completed loader is the event that makes the new tile visible.
  runtime.renderInvalidated = true;
  if (runtime.lightingMode === "minecraft") {
    setMinecraftMaterialPresentation(
      gltf.scene,
      runtime.minecraftMaterialState,
      true,
    );
  }
  return true;
}

async function loadModelWithRetry(
  runtime: Runtime,
  file: MeshFile,
  parent: Group | Scene,
  options: { detail: boolean; facadeAnchor?: Rgb },
): Promise<boolean> {
  try {
    return await loadModel(runtime, file, parent, options);
  } catch (firstError: unknown) {
    if (runtime.disposed) {
      return false;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    try {
      return await loadModel(runtime, file, parent, options);
    } catch {
      throw firstError;
    }
  }
}

export const ThreeViewer = forwardRef<ThreeViewerHandle, ThreeViewerProps>(
  function ThreeViewer(
    {
      active,
      canvasAriaLabel,
      lightingMode,
      nightLightsOn,
      progressLabel,
      sceneUrl,
      selectedLandmark,
      onError,
      onReady,
      onWarning,
      onViewChange,
    },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const runtimeRef = useRef<Runtime | null>(null);
    const selectedRef = useRef(selectedLandmark);
    const activeRef = useRef(active);
    // Continuous flight input (x = strafe, y = vertical, z = forward),
    // integrated per frame in the animate loop with velocity smoothing.
    const flightInputRef = useRef(new Vector3());
    const lightingModeRef = useRef(lightingMode);
    const nightLightsOnRef = useRef(nightLightsOn);
    const onErrorRef = useRef(onError);
    const onReadyRef = useRef(onReady);
    const onWarningRef = useRef(onWarning);
    const onViewChangeRef = useRef(onViewChange);
    const [progress, setProgress] = useState({ loaded: 0, total: 1 });

    useEffect(() => {
      activeRef.current = active;
    }, [active]);

    useEffect(() => {
      runtimeRef.current?.renderer.domElement.setAttribute(
        "aria-label",
        canvasAriaLabel,
      );
    }, [canvasAriaLabel]);

    useEffect(() => {
      lightingModeRef.current = lightingMode;
      nightLightsOnRef.current = nightLightsOn;
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }
      if (
        (lightingMode === "day" || lightingMode === "night") &&
        runtime.tunnelPoints !== null
      ) {
        // Before the scene manifest has delivered the tunnel centreline
        // we wait: the manifest handler calls ensureIsoWorld itself, and
        // starting early would permanently miss the tunnel trace.
        ensureIsoWorld(runtime, onWarningRef.current);
      }
      if (lightingMode === "minecraft") {
        ensureVoxelWorld(runtime, onWarningRef.current);
      }
      setSceneLighting(runtime, lightingMode, nightLightsOn);
    }, [lightingMode, nightLightsOn]);

    useEffect(() => {
      onErrorRef.current = onError;
      onReadyRef.current = onReady;
      onWarningRef.current = onWarning;
      onViewChangeRef.current = onViewChange;
    }, [onError, onReady, onWarning, onViewChange]);

    const focusLandmark = (name: string, immediate = false): void => {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }
      const landmark = runtime.landmarkByName.get(name);
      if (!landmark) {
        return;
      }
      markSurfaceInteraction(runtime);
      // A leftover glide would drift the camera off the fresh focus.
      runtime.cancelPanGlide?.();
      setParkDetailsFocus(runtime.parkDetails, name);
      const cameraPreset = runtime.focusCameraByName.get(name);
      const target = new Vector3(
        ...(cameraPreset?.target_world ?? landmark.world),
      );
      let cameraOffset: Vector3;
      if (cameraPreset) {
        target.y += cameraPreset.target_height_m;
        if (
          cameraPreset.fov_degrees !== undefined
          && runtime.camera.fov !== cameraPreset.fov_degrees
        ) {
          runtime.camera.fov = cameraPreset.fov_degrees;
          runtime.camera.updateProjectionMatrix();
        }
        cameraOffset = new Vector3().setFromSpherical(
          new Spherical(
            cameraPreset.distance_m,
            MathUtils.degToRad(cameraPreset.polar_degrees),
            MathUtils.degToRad(cameraPreset.azimuth_degrees),
          ),
        );
      } else {
        const currentDirection = runtime.camera.position
          .clone()
          .sub(runtime.controls.target)
          .normalize();
        const distance = name.includes("Tiergartentunnel")
          ? 460
          : (parkDetailFocusDistance(name) ?? memorialFocusDistance(name) ?? 190);
        cameraOffset = currentDirection.multiplyScalar(distance);
      }
      // Focus distances are authored for the 39° photo lens. The narrow
      // axonometric lens needs the same dolly compensation as the mode
      // switch, except for an explicitly photographic close-up such as a
      // tunnel mouth: scaling that stand would move it out over the canal.
      if (cameraPreset?.fov_degrees === undefined) {
        cameraOffset.multiplyScalar(
          fovDollyScale(PHOTO_FOV_DEGREES, runtime.camera.fov),
        );
      }
      runtime.controls.target.copy(target);
      runtime.camera.position.copy(target).add(cameraOffset);
      const markerHeight = markerHeightForLandmark(name);
      runtime.marker.position.copy(target).setY(markerHeight);
      runtime.marker.visible = true;
      if (runtime.markerTimer !== null) {
        window.clearTimeout(runtime.markerTimer);
      }
      runtime.markerTimer = window.setTimeout(() => {
        if (!runtime.disposed) {
          runtime.marker.visible = false;
          runtime.renderInvalidated = true;
        }
        runtime.markerTimer = null;
      }, 2400);
      runtime.controls.update(immediate ? 1 : undefined);
      notifyView(runtime, onViewChangeRef.current);

      runtime.detailClock += 1;
      // Hero photo crops never show in the voxel block world, in the
      // drawn isometric city, or from the underside.
      const heroVisibleAllowed =
        !voxelModeActive(runtime) &&
        !isoModeActive(runtime) &&
        !runtime.underside;
      for (const [heroName, entry] of runtime.detailGroups) {
        entry.group.visible = heroVisibleAllowed && heroName === name;
        if (heroName === name) {
          entry.lastUsed = runtime.detailClock;
        }
      }
      const detail = runtime.heroByName.get(name);
      if (detail && !runtime.detailGroups.has(name)) {
        const facadeAnchor = HERO_FACADE_ANCHORS[detail.id];
        const group = new Group();
        group.name = `${name} high detail`;
        const entry: HeroDetailGroup = {
          group,
          lastUsed: runtime.detailClock,
          loadedFiles: 0,
          loading: true,
        };
        runtime.detailGroups.set(name, entry);
        runtime.scene.add(group);
        evictHeroDetails(runtime, name);
        setProgress((current) => ({
          loaded: current.loaded,
          total: current.total + detail.files.length,
        }));
        void runBoundedTasks(
          detail.files,
          2,
          async (file) => {
            if (
              (await loadModelWithRetry(runtime, file, group, {
                detail: true,
                facadeAnchor,
              })) &&
              !runtime.disposed
            ) {
              entry.loadedFiles += 1;
              setProgress((current) => ({
                ...current,
                loaded: current.loaded + 1,
              }));
            }
          },
          {
            shouldStop: () =>
              runtime.disposed ||
              (runtime.coarsePointer && selectedRef.current !== name),
          },
        ).then((failures) => {
          if (runtime.disposed) {
            return;
          }
          entry.loading = false;
          const interruptedOnMobile =
            runtime.coarsePointer &&
            failures.length === 0 &&
            entry.loadedFiles < detail.files.length;
          if (interruptedOnMobile) {
            const shouldRestart = selectedRef.current === name;
            runtime.detailGroups.delete(name);
            disposeObject3D(runtime, group);
            setProgress((current) => ({
              loaded: Math.max(0, current.loaded - entry.loadedFiles),
              total: Math.max(0, current.total - detail.files.length),
            }));
            if (shouldRestart) {
              focusLandmark(name);
            }
            return;
          }
          if (failures.length > 0) {
            runtime.detailGroups.delete(name);
            disposeObject3D(runtime, group);
            setProgress((current) => ({
              loaded: Math.max(0, current.loaded - entry.loadedFiles),
              total: Math.max(0, current.total - detail.files.length),
            }));
            onWarningRef.current(
              `${name}: ${failures.length} Detaildatei(en) konnten nicht geladen werden; Basis-3D bleibt aktiv.`,
            );
            return;
          }
          evictHeroDetails(runtime, selectedRef.current);
        });
      }
      evictHeroDetails(runtime, name);
    };

    useImperativeHandle(
      ref,
      () => ({
        flyBy: (horizontal, vertical) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          markSurfaceInteraction(runtime);
          flyCameraInViewPlane(
            runtime.camera,
            runtime.controls.target,
            horizontal,
            vertical,
          );
          runtime.controls.update();
          notifyView(runtime, onViewChangeRef.current);
        },
        flyForwardBy: (strafe, forward) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          markSurfaceInteraction(runtime);
          flyCameraAlongViewHeading(
            runtime.camera,
            runtime.controls.target,
            strafe,
            forward,
          );
          runtime.controls.update();
          notifyView(runtime, onViewChangeRef.current);
        },
        focusLandmark,
        reset: () => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          markSurfaceInteraction(runtime);
          runtime.controls.target.copy(DEFAULT_TARGET);
          runtime.camera.position.copy(DEFAULT_TARGET).add(DEFAULT_CAMERA_OFFSET);
          setModelMaterialState(runtime, false);
          runtime.controls.update();
          notifyView(runtime, onViewChangeRef.current);
        },
        rotateBy: (degrees) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          markSurfaceInteraction(runtime);
          setOrbitAngles(runtime, {
            azimuth:
              runtime.controls.getAzimuthalAngle() + MathUtils.degToRad(degrees),
          });
          notifyView(runtime, onViewChangeRef.current);
        },
        setFlightInput: (strafe, forward, vertical) => {
          flightInputRef.current.set(
            MathUtils.clamp(strafe, -1, 1),
            MathUtils.clamp(vertical, -1, 1),
            MathUtils.clamp(forward, -1, 1),
          );
        },
        setAzimuth: (degrees) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          markSurfaceInteraction(runtime);
          setOrbitAngles(runtime, { azimuth: MathUtils.degToRad(degrees) });
          notifyView(runtime, onViewChangeRef.current);
        },
        setUnderside: (enabled) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          markSurfaceInteraction(runtime);
          setModelMaterialState(runtime, enabled);
          setOrbitAngles(runtime, {
            polar: MathUtils.degToRad(enabled ? 122 : 58),
          });
          notifyView(runtime, onViewChangeRef.current);
        },
        tiltBy: (degrees) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          markSurfaceInteraction(runtime);
          const polar = MathUtils.clamp(
            runtime.controls.getPolarAngle() + MathUtils.degToRad(degrees),
            0.08,
            Math.PI - 0.08,
          );
          setOrbitAngles(runtime, { polar });
          const underside = polar > Math.PI / 2;
          setModelMaterialState(runtime, underside);
          notifyView(runtime, onViewChangeRef.current);
        },
        zoomBy: (factor) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          markSurfaceInteraction(runtime);
          const offset = runtime.camera.position.clone().sub(runtime.controls.target);
          offset.multiplyScalar(1 / factor);
          offset.clampLength(runtime.controls.minDistance, runtime.controls.maxDistance);
          runtime.camera.position.copy(runtime.controls.target).add(offset);
          runtime.controls.update();
        },
      }),
      [progress.total],
    );

    useEffect(() => {
      selectedRef.current = selectedLandmark;
      focusLandmark(selectedLandmark);
    }, [selectedLandmark]);

    useEffect(() => {
      const host = hostRef.current;
      if (!host) {
        return;
      }
      let disposed = false;
      let frame = 0;
      let resizeObserver: ResizeObserver | null = null;
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      // Antialias everywhere: touch devices previously rendered without
      // MSAA, which made straight roof edges shimmer on retina phones.
      const renderer = new WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = PRESENTATION_TONE.day.toneMapping;
      renderer.toneMappingExposure = PRESENTATION_TONE.day.exposure;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.setPixelRatio(1);
      renderer.domElement.className = "three-canvas";
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute(
        "aria-label",
        canvasAriaLabel,
      );
      host.append(renderer.domElement);

      const scene = new Scene();
      scene.background = new Color(0xdcf3f9);
      scene.fog = new Fog(0xdcf3f9, 1100, 2550);
      // Day levels; setSceneLighting re-applies the per-mode rig on the
      // first frame. Kept in range on their own — no film curve compresses
      // an over-driven scene back down any more.
      const hemisphere = new HemisphereLight(0xffffff, 0xe4e6e0, 2.75);
      scene.add(hemisphere);
      const sun = new DirectionalLight(0xfff8ea, 0.62);
      sun.position.set(-760, 980, 720);
      sun.castShadow = !coarsePointer;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -1100;
      sun.shadow.camera.right = 1100;
      sun.shadow.camera.top = 1300;
      sun.shadow.camera.bottom = -1300;
      sun.shadow.bias = -0.00035;
      sun.shadow.normalBias = 0.018;
      scene.add(sun);
      const skyFill = new DirectionalLight(0xb6dcff, 0.24);
      skyFill.position.set(620, 430, -680);
      scene.add(skyFill);

      const camera = new PerspectiveCamera(39, 1, 0.25, 6000);
      camera.position.copy(DEFAULT_TARGET).add(DEFAULT_CAMERA_OFFSET);
      // The Minecraft look is now built entirely in world space from the toon
      // block materials + palette (setMinecraftMaterialPresentation). The old
      // screen-space NEAREST voxel post-process was removed: when the camera
      // zoomed out it re-sampled the scene into coarse screen pixels every
      // frame, which flimmered/aliased badly in the distance. Minecraft now
      // renders through the same composer path as Day, so it stays as calm as
      // Day mode while zooming, panning and orbiting.
      const crispPass = new ShaderPass({
        uniforms: {
          contrast: { value: CRISPNESS_PROFILES.day.contrast },
          edgeStrength: { value: CRISPNESS_PROFILES.day.edgeStrength },
          resolution: { value: new Vector2(1, 1) },
          saturation: { value: CRISPNESS_PROFILES.day.saturation },
          strength: { value: CRISPNESS_PROFILES.day.strength },
          tDiffuse: { value: null },
        },
        vertexShader: postprocessVertex,
        fragmentShader: crispFragment,
      });
      crispPass.enabled = false;
      // Hard MSAA floor for the settled post-process chain. v0.55.0: raised
      // the coarse-pointer floor from 2x to 4x. A retina phone's native
      // devicePixelRatio (often 3) is capped well below that by
      // renderPixelRatio's mobile budget (see renderQuality.ts), so the
      // composer was resolving dense, high-frequency line patterns -- the
      // ground's kerb/grid ink, roof glazing seams -- at a coarser physical
      // sample grid than desktop while feeding the *same* screen-space
      // unsharp+edge pass (crisp.frag). That combination is exactly the
      // moire mechanism users photographed on iPhones: too few samples per
      // final pixel to resolve a fine repeating line pattern, then a
      // sharpening filter amplifying whatever aliasing survived. 4x on both
      // tiers removes the gap; the cost is one texture's worth of MSAA
      // storage, not a per-frame shading cost, so it does not compete with
      // the pixel-ratio budget that actually protects phone frame rate.
      const composerTarget = new WebGLRenderTarget(1, 1, {
        samples: 4,
        type: HalfFloatType,
      });
      const composer = new EffectComposer(renderer, composerTarget);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(crispPass);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(DEFAULT_TARGET);
      controls.enableDamping = true;
      // v0.5.5: a lighter damping factor lets the orbit/tilt glide to rest
      // (more inertia) and higher rotate/pan speeds make the one-finger tilt
      // and two-finger drag feel effortless on touch.
      controls.dampingFactor = 0.065;
      controls.zoomToCursor = true;
      controls.rotateSpeed = 0.82;
      controls.zoomSpeed = 0.9;
      controls.panSpeed = 0.9;
      controls.minDistance = 30;
      controls.maxDistance = 2600;
      controls.minPolarAngle = 0.06;
      controls.maxPolarAngle = Math.PI - 0.06;
      controls.screenSpacePanning = true;
      controls.mouseButtons = THREE_MOUSE_GESTURE_SETTINGS;
      controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE };
      controls.update();

      const interactionSurface = new Group();
      interactionSurface.name = "Official interaction surface (2.3M faces)";
      scene.add(interactionSurface);
      const settledSurface = new Group();
      settledSurface.name = "Official settled surface (6.0M faces)";
      settledSurface.visible = false;
      scene.add(settledSurface);
      const marker = createSelectionMarker();
      marker.visible = false;
      scene.add(marker);
      const signatures = new Group();
      signatures.name = "Dimensioned architectural signatures";
      scene.add(signatures);
      const civicDetails = new Group();
      civicDetails.name = "Pending civic landmark details";
      scene.add(civicDetails);
      const monuments = new Group();
      monuments.name = "Verified memorial detail models";
      scene.add(monuments);
      const culturalDetails = new Group();
      culturalDetails.name = "Pending cultural and Spree details";
      scene.add(culturalDetails);
      const parkDetails = new Group();
      parkDetails.name = "Pending OSM park details";
      scene.add(parkDetails);
      const runtime: Runtime = {
        camera,
        civicDetails,
        coarsePointer,
        composer,
        controls,
        crispPass,
        culturalDetails,
        detailClock: 0,
        detailGroups: new Map(),
        disposed: false,
        focusCameraByName: new Map(),
        hemisphere,
        heroByName: new Map(),
        interactionSurface,
        interactionUntil: 0,
        landmarkByName: new Map(),
        loader: new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),
        marker,
        markerTimer: null,
        minecraftMaterialState: createMinecraftMaterialState(),
        modelMaterials: new Set(),
        monuments,
        parkDetails,
        renderer,
        renderInvalidated: true,
        scene,
        sceneRootUrl: new URL(".", new URL(sceneUrl, window.location.href)),
        signatures,
        skyFill,
        settledSurface,
        settledSurfaceReady: false,
        sun,
        tunnel: new Group(),
        tunnelPortals: new Group(),
        tunnelBounds: null,
        tunnelPoints: null,
        isoWorld: null,
        isoWorldState: "idle",
        inkLineMaterials: new Set(),
        fineDetailObjects: [],
        fineDetailVisible: true,
        voxelWorld: null,
        voxelWorldState: "idle",
        lightingMode: lightingModeRef.current,
        nightLightsOn: nightLightsOnRef.current,
        underside: false,
        underwater: false,
      };
      runtimeRef.current = runtime;
      setSceneLighting(runtime, lightingModeRef.current, nightLightsOnRef.current);

      const touchPoints = new Map<number, { x: number; y: number }>();
      let customTouchGestureActive = false;
      let previousTwoFingerGesture: {
        angle: number;
        center: { x: number; y: number };
        distance: number;
      } | null = null;
      // Gesture lock ("jeder Blödmann sofort bedienen"): a two-finger
      // gesture is EITHER a pan OR a zoom, decided once with hysteresis
      // and held until the fingers lift. Mixing the two on every move
      // made panning zoom whenever the finger distance jittered.
      let twoFingerMode: "undecided" | "pan" | "zoom" = "undecided";
      let twoFingerStart: {
        center: { x: number; y: number };
        distance: number;
      } | null = null;
      // Pan momentum: finger velocity at release keeps the map gliding
      // with an exponential ease-out (decayPanMomentum).
      const panVelocity = { x: 0, y: 0 };
      let panVelocitySampleAt = performance.now();
      const panMomentum = { x: 0, y: 0 };
      // Double-tap zoom for touch: browsers don't reliably synthesise
      // dblclick on a touch-action:none canvas, so we detect it from
      // pointer timestamps/positions ourselves.
      let lastTapAt = 0;
      let lastTapX = 0;
      let lastTapY = 0;
      let previousThreeFingerCenter: { x: number; y: number } | null = null;
      let controlsInteracting = false;
      let touchInteracting = false;
      let wheelInteracting = false;
      let lastTouchActivityAt = performance.now();
      let settleUntil = 0;
      let lastSafeCameraPose = captureCameraPose(camera, controls.target);
      // Resolution mode currently applied to the canvas, plus the hysteresis
      // clocks the governor in the frame loop reads. Never write the
      // interaction flags straight into renderPixelRatio: see the governor
      // comment in renderQuality.ts for why that flickers during a wheel zoom.
      let pixelRatioInteracting = false;
      let interactionDeadline = 0;
      let inputActiveSince: number | null = null;
      let inputIdleSince: number | null = 0;
      // Same idea for the settled-detail tier, on its own clocks because it
      // follows camera motion rather than raw input.
      let surfaceInteracting = false;
      let movingSince: number | null = null;
      let stillSince: number | null = 0;
      let appliedWidth = 0;
      let appliedHeight = 0;
      let appliedPixelRatio = 0;
      const resize = (force = false) => {
        const { width, height } = host.getBoundingClientRect();
        if (width < 1 || height < 1) {
          return;
        }
        const pixelRatio = renderPixelRatio({
          coarsePointer,
          devicePixelRatio: window.devicePixelRatio,
          height,
          interacting: pixelRatioInteracting,
          width,
        });
        if (
          !force &&
          width === appliedWidth &&
          height === appliedHeight &&
          pixelRatio === appliedPixelRatio
        ) {
          // Re-applying the same size still reallocates the composer's MSAA
          // targets, which costs a frame. Nothing changed, so do nothing.
          return;
        }
        appliedWidth = width;
        appliedHeight = height;
        appliedPixelRatio = pixelRatio;
        renderer.setPixelRatio(pixelRatio);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        composer.setPixelRatio(pixelRatio);
        composer.setSize(width, height);
        runtime.renderInvalidated = true;
        const crispResolution = crispPass.uniforms.resolution.value;
        if (crispResolution instanceof Vector2) {
          // Anchored to the settled resolution, never to the one currently
          // applied. crisp.frag steps one texel (stepUv = 1/resolution), so
          // feeding it the live ratio made the unsharp halo and the edge
          // outline widen the instant the governor dropped resolution for a
          // gesture and snap back when it restored — a sharpness pop at both
          // ends of every drag, on top of the resampling itself. Anchored, the
          // pass covers the same screen area at either resolution, so the
          // switch changes only the sampling quality and stays invisible.
          const settledPixelRatio = renderPixelRatio({
            coarsePointer,
            devicePixelRatio: window.devicePixelRatio,
            height,
            interacting: false,
            width,
          });
          crispResolution.set(width * settledPixelRatio, height * settledPixelRatio);
        }
      };
      const noteInteractionInput = (): void => {
        interactionDeadline = performance.now() + INTERACTION_COALESCE_MS;
      };
      const twoFingerGesture = () => {
        const points = [...touchPoints.values()].slice(0, 2);
        if (points.length !== 2) {
          return null;
        }
        const dx = points[1].x - points[0].x;
        const dy = points[1].y - points[0].y;
        return {
          angle: Math.atan2(dy, dx),
          center: {
            x: (points[0].x + points[1].x) / 2,
            y: (points[0].y + points[1].y) / 2,
          },
          distance: Math.max(1, Math.hypot(dx, dy)),
        };
      };
      const zoomAtClientPoint = (
        point: { x: number; y: number },
        factor: number,
      ): void => {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) {
          return;
        }
        const ndcX = ((point.x - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((point.y - rect.top) / rect.height) * 2 + 1;
        zoomCameraAtScreenPoint(
          camera,
          controls.target,
          ndcX,
          ndcY,
          factor,
          controls.minDistance,
          controls.maxDistance,
        );
      };
      let trackpadPanSequenceUntil = Number.NEGATIVE_INFINITY;
      let wheelEndTimer: number | null = null;
      const onWheelNavigation = (event: WheelEvent): void => {
        const now = performance.now();
        const intent = wheelNavigationIntent(
          event,
          now < trackpadPanSequenceUntil,
        );
        if (intent === "mouse-wheel-zoom") {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        renderer.domElement.focus({ preventScroll: true });
        const wheelSequenceStarting = !wheelInteracting;
        wheelInteracting = true;
        if (wheelSequenceStarting) {
          noteInteractionInput();
        }
        panMomentum.x = 0;
        panMomentum.y = 0;
        if (intent === "trackpad-pinch") {
          const factor = MathUtils.clamp(
            Math.exp(-event.deltaY * 0.012),
            0.82,
            1.22,
          );
          zoomAtClientPoint(
            { x: event.clientX, y: event.clientY },
            factor,
          );
        } else {
          trackpadPanSequenceUntil = now + 180;
          // Pixel wheel deltas run opposite to physical finger travel under
          // natural scrolling. Invert them before applying the same direct-
          // manipulation contract as a two-finger touch pan.
          const { strafe, forward } = twoFingerPanFlight(
            -event.deltaX,
            -event.deltaY,
          );
          flyCameraAlongViewHeading(
            camera,
            controls.target,
            strafe,
            forward,
          );
        }
        controls.update();
        markSurfaceInteraction(runtime);
        settleUntil = now + 650;
        if (wheelEndTimer !== null) {
          window.clearTimeout(wheelEndTimer);
        }
        wheelEndTimer = window.setTimeout(() => {
          wheelEndTimer = null;
          wheelInteracting = false;
          noteInteractionInput();
          if (!runtime.disposed) {
            notifyView(runtime, onViewChangeRef.current);
          }
        }, 180);
      };
      const onPointerDown = (event: PointerEvent) => {
        panMomentum.x = 0;
        panMomentum.y = 0;
        if (event.pointerType === "touch" && touchPoints.size === 0) {
          const now = performance.now();
          if (
            now - lastTapAt < 340 &&
            Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < 32
          ) {
            lastTapAt = 0;
            zoomAtClientPoint({ x: event.clientX, y: event.clientY }, 1.5);
            controls.update();
            markSurfaceInteraction(runtime);
            notifyView(runtime, onViewChangeRef.current);
          } else {
            lastTapAt = now;
            lastTapX = event.clientX;
            lastTapY = event.clientY;
          }
        }
        if (event.pointerType !== "touch") {
          renderer.domElement.focus({ preventScroll: true });
          return;
        }
        lastTouchActivityAt = performance.now();
        touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touchPoints.size === 2) {
          customTouchGestureActive = true;
          controlsInteracting = false;
          touchInteracting = true;
          controls.enabled = false;
          markSurfaceInteraction(runtime);
          noteInteractionInput();
          previousTwoFingerGesture = twoFingerGesture();
          twoFingerStart = previousTwoFingerGesture;
          twoFingerMode = "undecided";
          panVelocity.x = 0;
          panVelocity.y = 0;
          panVelocitySampleAt = performance.now();
          previousThreeFingerCenter = null;
          return;
        }
        if (touchPoints.size >= 3) {
          customTouchGestureActive = true;
          controlsInteracting = false;
          touchInteracting = true;
          controls.enabled = false;
          markSurfaceInteraction(runtime);
          noteInteractionInput();
          previousTwoFingerGesture = null;
          twoFingerStart = null;
          twoFingerMode = "undecided";
          const points = [...touchPoints.values()];
          previousThreeFingerCenter = {
            x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
            y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
          };
        }
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!touchPoints.has(event.pointerId)) {
          return;
        }
        lastTouchActivityAt = performance.now();
        touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touchPoints.size === 2 && previousTwoFingerGesture) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const current = twoFingerGesture();
          if (!current) {
            return;
          }
          // A two-finger swipe pans with direct manipulation: the content
          // under the fingers follows them (finger right → content right,
          // finger down → content down), never rotating or tilting. The rig
          // travels opposite the finger delta — see twoFingerPanFlight.
          // Rotation stays on the on-screen buttons, the keyboard and the
          // mouse-drag; a three-finger gesture still tilts deliberately.
          if (twoFingerStart && twoFingerMode === "undecided") {
            twoFingerMode = classifyTwoFingerGesture({
              panTravel: Math.hypot(
                current.center.x - twoFingerStart.center.x,
                current.center.y - twoFingerStart.center.y,
              ),
              pinchTravel: Math.abs(current.distance - twoFingerStart.distance),
            });
            // An unclassified gesture moves NOTHING. Applying the pan branch
            // while still undecided dollied the rig forward at the start of
            // every pinch ("geht nach vorne statt näher ran"), and the drift
            // stayed even once the pinch was recognised. On decision the
            // baseline restarts here, so the dead-zone travel that identified
            // the gesture is not replayed as a jump.
            previousTwoFingerGesture = current;
            panVelocity.x = 0;
            panVelocity.y = 0;
            panVelocitySampleAt = performance.now();
            markSurfaceInteraction(runtime);
            return;
          }
          if (twoFingerMode === "pan") {
            // Direct-manipulation pan: content follows the fingers.
            const deltaX = current.center.x - previousTwoFingerGesture.center.x;
            const deltaY = current.center.y - previousTwoFingerGesture.center.y;
            const { strafe, forward } = twoFingerPanFlight(deltaX, deltaY);
            flyCameraAlongViewHeading(camera, controls.target, strafe, forward);
            // Remember the finger velocity so release can glide out.
            const now = performance.now();
            const dt = Math.max(1, now - panVelocitySampleAt) / 1000;
            panVelocity.x = deltaX / dt;
            panVelocity.y = deltaY / dt;
            panVelocitySampleAt = now;
          } else {
            // Locked pinch zoom: preserve the world point under the finger
            // midpoint so the map never jumps toward the screen centre.
            const pinchRatio = MathUtils.clamp(
              current.distance / previousTwoFingerGesture.distance,
              0.86,
              1.16,
            );
            if (Math.abs(pinchRatio - 1) > 0.002) {
              zoomAtClientPoint(current.center, pinchRatio);
            }
          }
          controls.update();
          previousTwoFingerGesture = current;
          markSurfaceInteraction(runtime);
          return;
        }
        if (touchPoints.size < 3 || !previousThreeFingerCenter) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        const points = [...touchPoints.values()];
        const center = {
          x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
          y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
        };
        const polar = MathUtils.clamp(
          controls.getPolarAngle() + (center.y - previousThreeFingerCenter.y) * 0.006,
          0.08,
          Math.PI - 0.08,
        );
        setOrbitAngles(runtime, {
          azimuth:
            controls.getAzimuthalAngle() +
            (center.x - previousThreeFingerCenter.x) * 0.008,
          polar,
        });
        if ((polar > Math.PI / 2) !== runtime.underside) {
          setModelMaterialState(runtime, polar > Math.PI / 2);
        }
        previousThreeFingerCenter = center;
      };
      const onPointerUp = (event: PointerEvent) => {
        if (!touchPoints.has(event.pointerId)) {
          return;
        }
        lastTouchActivityAt = performance.now();
        // A finished two-finger pan hands its velocity to the glide.
        if (
          touchPoints.size === 2 &&
          twoFingerMode === "pan" &&
          performance.now() - panVelocitySampleAt < 120
        ) {
          panMomentum.x = panVelocity.x;
          panMomentum.y = panVelocity.y;
        }
        touchPoints.delete(event.pointerId);
        if (customTouchGestureActive) {
          if (touchPoints.size >= 2) {
            previousThreeFingerCenter = null;
            previousTwoFingerGesture = twoFingerGesture();
            twoFingerStart = previousTwoFingerGesture;
            twoFingerMode = "undecided";
            panVelocity.x = 0;
            panVelocity.y = 0;
            panVelocitySampleAt = performance.now();
            return;
          }
          previousTwoFingerGesture = null;
          twoFingerStart = null;
          twoFingerMode = "undecided";
          previousThreeFingerCenter = null;
          if (touchPoints.size >= 1) {
            // 2→1 finger: fingers rarely leave the glass together, so the
            // last one used to be handed straight to OrbitControls and
            // spun the view at the end of every pinch. The gesture stays
            // owned (controls disabled) until every finger has lifted;
            // touching down again re-arms the two-finger path above.
            markSurfaceInteraction(runtime);
            return;
          }
          customTouchGestureActive = false;
          controlsInteracting = false;
          if (panMomentum.x === 0 && panMomentum.y === 0) {
            touchInteracting = false;
            noteInteractionInput();
          }
          settleUntil = performance.now() + 650;
          controls.enabled = true;
          notifyView(runtime, onViewChangeRef.current);
          return;
        }
        if (touchPoints.size < 3) {
          controls.enabled = true;
          notifyView(runtime, onViewChangeRef.current);
        }
      };
      runtime.cancelPanGlide = () => {
        panMomentum.x = 0;
        panMomentum.y = 0;
        panVelocity.x = 0;
        panVelocity.y = 0;
      };
      const resetTouchGesture = () => {
        if (
          touchPoints.size === 0 &&
          !customTouchGestureActive &&
          !touchInteracting &&
          panMomentum.x === 0 &&
          panMomentum.y === 0
        ) {
          return;
        }
        touchPoints.clear();
        previousTwoFingerGesture = null;
        previousThreeFingerCenter = null;
        customTouchGestureActive = false;
        controlsInteracting = false;
        touchInteracting = false;
        panMomentum.x = 0;
        panMomentum.y = 0;
        settleUntil = performance.now() + 650;
        controls.enabled = true;
        setSurfacePresentation(runtime, false);
        noteInteractionInput();
        notifyView(runtime, onViewChangeRef.current);
      };
      const onVisibilityChange = () => {
        if (document.hidden) {
          resetTouchGesture();
        }
      };
      const onDoubleClick = (event: MouseEvent) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        renderer.domElement.focus({ preventScroll: true });
        zoomAtClientPoint({ x: event.clientX, y: event.clientY }, 1.5);
        controls.update();
        markSurfaceInteraction(runtime);
        notifyView(runtime, onViewChangeRef.current);
      };
      renderer.domElement.addEventListener("pointerdown", onPointerDown, true);
      renderer.domElement.addEventListener("pointermove", onPointerMove, true);
      const onPointerCancel = (event: PointerEvent) => {
        // A cancelled gesture (iOS system gesture) must not hand out
        // flick momentum — zero the sampled velocity first.
        panVelocity.x = 0;
        panVelocity.y = 0;
        onPointerUp(event);
      };
      renderer.domElement.addEventListener("pointerup", onPointerUp, true);
      renderer.domElement.addEventListener("pointercancel", onPointerCancel, true);
      // NOTE deliberately no "lostpointercapture" listener: touch
      // pointers get implicit capture, so it fires on EVERY normal
      // finger lift and used to wipe the whole gesture state (killing
      // pan momentum on real devices). pointerup/pointercancel plus the
      // blur/visibility resets cover all genuine loss paths.
      renderer.domElement.addEventListener("dblclick", onDoubleClick);
      renderer.domElement.addEventListener("wheel", onWheelNavigation, {
        capture: true,
        passive: false,
      });
      window.addEventListener("pointerup", onPointerUp, true);
      window.addEventListener("pointercancel", onPointerCancel, true);
      window.addEventListener("blur", resetTouchGesture);
      document.addEventListener("visibilitychange", onVisibilityChange);
      const onControlsStart = () => {
        controlsInteracting = true;
        markSurfaceInteraction(runtime);
        noteInteractionInput();
      };
      const onControlsEnd = () => {
        controlsInteracting = false;
        settleUntil = performance.now() + 650;
        markSurfaceInteraction(runtime);
        notifyView(runtime, onViewChangeRef.current);
        noteInteractionInput();
      };
      controls.addEventListener("start", onControlsStart);
      controls.addEventListener("end", onControlsEnd);
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(host);
      resize();

      const onContextLost = (event: Event) => {
        event.preventDefault();
        if (!disposed) {
          onErrorRef.current(
            "WebGL-Kontext verloren; die Detailkarte bleibt verfügbar und 3D kann erneut geöffnet werden.",
          );
        }
      };
      renderer.domElement.addEventListener("webglcontextlost", onContextLost);

      const activeFrameIntervalMs = coarsePointer ? 1000 / 30 : 0;
      let lastRenderedAt = Number.NEGATIVE_INFINITY;
      let lastAnimateAt = Number.NEGATIVE_INFINITY;
      const flightVelocity = new Vector3();
      let wasFlying = false;
      // OrbitControls damps exponentially and can report microscopic changes
      // forever. Three tiny (< 1 mm) consecutive updates are sub-pixel at the
      // widest permitted Day view, so flush the final damping state exactly
      // once and let the renderer remain on that resolved frame.
      const CAMERA_REST_EPSILON_M = 0.001;
      const CAMERA_REST_FRAMES = 3;
      let passiveDampingFrames = 0;
      let previousCameraPose = captureCameraPose(camera, controls.target);
      const applyContinuousFlight = (dtSeconds: number): boolean => {
        const input = flightInputRef.current;
        flightVelocity.lerp(input, 1 - Math.exp(-dtSeconds * 7));
        if (input.lengthSq() < 1e-6 && flightVelocity.lengthSq() < 1e-4) {
          flightVelocity.set(0, 0, 0);
          if (wasFlying) {
            wasFlying = false;
            notifyView(runtime, onViewChangeRef.current);
          }
          return false;
        }
        wasFlying = true;
        const distance = camera.position.distanceTo(controls.target);
        const speed = MathUtils.clamp(distance * 1.3, 36, 620);
        const verticalSpeed = MathUtils.clamp(distance * 0.85, 16, 230);
        const heading = controls.target.clone().sub(camera.position);
        heading.y = 0;
        if (heading.lengthSq() < 1e-6) {
          camera.getWorldDirection(heading);
          heading.y = 0;
        }
        heading.normalize();
        const right = new Vector3().crossVectors(heading, camera.up).normalize();
        const move = heading
          .multiplyScalar(flightVelocity.z * speed * dtSeconds)
          .add(right.multiplyScalar(flightVelocity.x * speed * dtSeconds));
        move.y += flightVelocity.y * verticalSpeed * dtSeconds;
        const nextTarget = controls.target
          .clone()
          .add(move)
          .clamp(
            REGIERUNGSVIERTEL_FLIGHT_BOUNDS.min,
            REGIERUNGSVIERTEL_FLIGHT_BOUNDS.max,
          );
        const applied = nextTarget.sub(controls.target);
        controls.target.add(applied);
        camera.position.add(applied);
        camera.updateMatrixWorld();
        markSurfaceInteraction(runtime, 220);
        return true;
      };
      const animate = (timestamp = 0) => {
        if (disposed) {
          return;
        }
        frame = window.requestAnimationFrame(animate);
        if (!activeRef.current) {
          return;
        }
        const dtSeconds = MathUtils.clamp(
          (timestamp - lastAnimateAt) / 1000,
          0,
          0.1,
        );
        lastAnimateAt = timestamp;
        if (
          !controls.enabled &&
          (!customTouchGestureActive ||
            touchPoints.size < 2 ||
            timestamp - lastTouchActivityAt > 10_000)
        ) {
          resetTouchGesture();
        }
        const flying = applyContinuousFlight(dtSeconds);
        let controlsChanged = controls.update();
        const afterControlsPose = captureCameraPose(camera, controls.target);
        const directInputActive = renderInteractionActive({
          controls: controlsInteracting,
          touch: touchInteracting,
          wheel: wheelInteracting,
        });
        if (
          controlsChanged &&
          !flying &&
          !directInputActive &&
          cameraPoseDeltaM(previousCameraPose, afterControlsPose) <=
            CAMERA_REST_EPSILON_M
        ) {
          passiveDampingFrames += 1;
          if (passiveDampingFrames >= CAMERA_REST_FRAMES) {
            // A damping-disabled update commits OrbitControls' internal
            // spherical state without another eased sub-pixel step.
            controls.enableDamping = false;
            controls.update();
            controls.enableDamping = true;
            controlsChanged = false;
            passiveDampingFrames = 0;
          }
        } else {
          passiveDampingFrames = 0;
        }
        previousCameraPose = captureCameraPose(camera, controls.target);
        const stabilized = stabilizeCameraRig(
          camera,
          controls.target,
          lastSafeCameraPose,
          controls.minDistance,
          controls.maxDistance,
        );
        lastSafeCameraPose = stabilized.pose;
        if (stabilized.recovered) {
          resetTouchGesture();
        }
        const stability = minecraftStabilityPolicy(runtime.lightingMode);
        // A still camera must let Minecraft settle to one calm frame instead
        // of re-voxelising forever (the "Flirren"); motion still drives the
        // active cadence through the terms below.
        const cameraMoving =
          flying ||
          renderInteractionActive({
            controls: controlsInteracting,
            touch: touchInteracting,
            wheel: wheelInteracting,
          }) ||
          controlsChanged ||
          stabilized.changed ||
          marker.visible ||
          timestamp < runtime.interactionUntil ||
          timestamp < settleUntil;
        const isMoving = cameraMoving || stability.forceContinuousRender;
        // Resolution governor: one hysteretic decision per frame instead of a
        // resize on every OrbitControls start/end pair. A wheel dolly fires
        // both events per tick, so applying them directly swapped the canvas
        // resolution twice per tick while zooming.
        const inputActive =
          timestamp < interactionDeadline ||
          renderInteractionActive({
            controls: controlsInteracting,
            touch: touchInteracting,
            wheel: wheelInteracting,
          });
        if (inputActive) {
          inputActiveSince ??= timestamp;
          inputIdleSince = null;
        } else {
          inputIdleSince ??= timestamp;
          inputActiveSince = null;
        }
        const wantInteractingPixelRatio = nextPixelRatioMode({
          activeSinceMs: inputActiveSince,
          applied: pixelRatioInteracting,
          idleSinceMs: inputIdleSince,
          inputActive,
          nowMs: timestamp,
        });
        if (wantInteractingPixelRatio !== pixelRatioInteracting) {
          pixelRatioInteracting = wantInteractingPixelRatio;
          resize();
        }
        if (cameraMoving) {
          movingSince ??= timestamp;
          stillSince = null;
        } else {
          stillSince ??= timestamp;
          movingSince = null;
        }
        surfaceInteracting = nextSettledDetailMode({
          activeSinceMs: movingSince,
          applied: surfaceInteracting,
          idleSinceMs: stillSince,
          inputActive: cameraMoving,
          nowMs: timestamp,
        });
        // Minecraft keeps the chunky interaction surface at all times so the
        // detail tier never swaps on settle (the visible "Zusammensetzen").
        setSurfacePresentation(
          runtime,
          surfaceInteracting || stability.pinInteractionSurface,
        );
        // Strength of the Day/Night crisp/edge pass: a pure function of how far
        // the camera stands off, never of whether it is moving, and never
        // time-eased. v0.39.0 made the *target* distance-driven but still let
        // the applied value chase it with a ~143 ms time constant. A still
        // camera reached the target, so static views looked calm — but during a
        // zoom the applied strength permanently lagged the view and then
        // snapped forward when the motion stopped, which is the sharpening pop
        // users read as flicker. crispZoomScale is already a smoothstep, so
        // reading it directly is smooth by construction and, more importantly,
        // makes the picture identical for a given standoff no matter how the
        // camera got there. Minecraft owns the composer for its voxel pass and
        // keeps a fixed profile.
        const crispTargetScale =
          runtime.lightingMode === "minecraft"
            ? 0
            : crispZoomScale(camera.position.distanceTo(controls.target));
        // Far-zoom anti-flicker (v0.53.0): ink lines and small accessory
        // layers are dampened by the same standoff-only reasoning as
        // crispTargetScale above -- a pure function of distance, so the
        // picture is identical for a given standoff no matter how the
        // camera got there, and never re-pops when motion stops.
        const farDetailChanged = updateFarZoomAntiFlicker(
          runtime,
          camera.position.distanceTo(controls.target),
          renderer.domElement.clientHeight || window.innerHeight,
        );
        // Day/Night used to repaint at 12 fps while the view was still.
        // That kept animated flags and signal buffers changing beneath a
        // nominally fixed far camera, making fine ink edges shimmer. A static
        // scene now receives one render for a real mutation and then holds its
        // framebuffer exactly; RAF remains alive for input and loaders.
        const renderRequired =
          cameraMoving || runtime.renderInvalidated || farDetailChanged;
        if (!renderRequired) {
          return;
        }
        const frameIntervalMs = isMoving ? activeFrameIntervalMs : 0;
        if (timestamp - lastRenderedAt < frameIntervalMs) {
          return;
        }
        lastRenderedAt = timestamp;
        // The cutaway also engages when the camera itself flies into the
        // Tiergartentunnel tube, not only when orbiting below the horizon.
        const insideTunnel =
          runtime.tunnelBounds !== null &&
          runtime.tunnelBounds.containsPoint(camera.position);
        const underside = controls.getPolarAngle() > Math.PI / 2 || insideTunnel;
        if (underside !== runtime.underside) {
          setModelMaterialState(runtime, underside);
          notifyView(runtime, onViewChangeRef.current);
        }
        setUnderwaterPresentation(
          runtime,
          shouldUseUnderwaterPresentation({
            cameraY: camera.position.y,
            insideTunnel,
            underside,
          }),
        );
        if (marker.visible) {
          const pulse = 1 + Math.sin(timestamp * 0.006) * 0.08;
          marker.scale.setScalar(pulse);
        }
        if (isMoving) {
          const windTime =
            reducedMotion || !stability.animateWind ? 0.9 : timestamp / 1000;
          updateWindFlags(runtime.signatures, windTime);
          updateWindFlags(runtime.civicDetails, windTime);
        }
        if (isMoving && runtime.isoWorld?.visible && runtime.trafficSignals) {
          updateTrafficSignals(
            runtime.trafficSignals,
            timestamp / 1000,
            reducedMotion,
            runtime.lightingMode !== "night" || runtime.nightLightsOn,
          );
        }
        // Momentum glide: the released pan eases out smoothly.
        if (
          (panMomentum.x !== 0 || panMomentum.y !== 0) &&
          touchPoints.size === 0
        ) {
          const { strafe, forward } = twoFingerPanFlight(
            panMomentum.x * dtSeconds,
            panMomentum.y * dtSeconds,
          );
          flyCameraAlongViewHeading(camera, controls.target, strafe, forward);
          const decayed = decayPanMomentum(panMomentum, dtSeconds);
          panMomentum.x = decayed.x;
          panMomentum.y = decayed.y;
          if (
            panMomentum.x === 0 &&
            panMomentum.y === 0 &&
            touchInteracting
          ) {
            touchInteracting = false;
            noteInteractionInput();
          }
          markSurfaceInteraction(runtime, 220);
        }
        if (runtime.lightingMode === "minecraft") {
          // Minecraft renders through the same composer path as Day/Night — no
          // screen-space voxel grid to flimmer when zoomed out. The blocky look
          // comes from the world-space toon materials; the crisp/edge pass adds
          // the clean isometric block outline at a fixed strength (no settle
          // ramp needed, since the world-space look is stable at every zoom).
          const profile = CRISPNESS_PROFILES.minecraft;
          crispPass.enabled = true;
          crispPass.uniforms.strength.value = profile.strength;
          crispPass.uniforms.edgeStrength.value = profile.edgeStrength;
          crispPass.uniforms.saturation.value = profile.saturation;
          crispPass.uniforms.contrast.value = profile.contrast;
          composer.render();
        } else {
          // Day/Night: always render through the composer so the colour and
          // anti-aliasing pipeline is identical whether the camera moves or
          // settles. At crispBlend === 0 the pass is a pure passthrough
          // (strength/edge 0, saturation/contrast 1), at 1 it applies the full
          // authored profile.
          const profile =
            CRISPNESS_PROFILES[runtime.lightingMode === "night" ? "night" : "day"];
          const crispBlend = crispTargetScale;
          crispPass.enabled = true;
          // v0.55.0 moire fix: the unsharp+edge pass reads exactly one
          // texel either side of centre (crisp.frag), so its gain against
          // a fine repeating line pattern (ground kerb/grid ink, roof
          // glazing seams) scales with how many *screen* pixels fall on
          // one physical display pixel. A phone's native devicePixelRatio
          // (2-3) packs display pixels far tighter than the render
          // resolution the mobile budget allows (renderQuality.ts caps it
          // well below native for frame-rate reasons), so the browser's
          // own upscale from render size to native size re-samples an
          // already-sharpened, already fine-pitched pattern -- textbook
          // moire. Damping edgeStrength on coarse pointers only (desktop
          // crispness stays exactly as authored/pinned in
          // crispnessProfile.test.ts) removes the gain that turns that
          // resample into visible banding without touching the unsharp
          // `strength` term that carries the line drawing's crispness.
          const edgeMoireGuard = runtime.coarsePointer ? 0.55 : 1;
          crispPass.uniforms.strength.value = profile.strength * crispBlend;
          crispPass.uniforms.edgeStrength.value =
            profile.edgeStrength * crispBlend * edgeMoireGuard;
          crispPass.uniforms.saturation.value =
            1 + (profile.saturation - 1) * crispBlend;
          crispPass.uniforms.contrast.value =
            1 + (profile.contrast - 1) * crispBlend;
          composer.render();
        }
        runtime.renderInvalidated = false;
      };
      animate();

      const manifestController = new AbortController();
      void fetch(sceneUrl, { signal: manifestController.signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`3D scene manifest: HTTP ${response.status}`);
          }
          return (await response.json()) as SceneManifest;
        })
        .then(async (manifest) => {
          if (disposed) {
            return;
          }
          runtime.landmarkByName = new Map(
            manifest.landmarks.map((landmark) => [landmark.name, landmark]),
          );
          runtime.civicDetails.removeFromParent();
          runtime.civicDetails = createCivicLandmarks(manifest.landmarks);
          markAuthoredFlatUnlit(runtime.civicDetails);
          scene.add(runtime.civicDetails);
          applyLightingToRoot(runtime.civicDetails, runtime.lightingMode, runtime.nightLightsOn);
          if (runtime.lightingMode === "minecraft") {
            setMinecraftMaterialPresentation(
              runtime.civicDetails,
              runtime.minecraftMaterialState,
              true,
            );
          }
          runtime.focusCameraByName.set("Schweizerische Botschaft", {
            azimuth_degrees: -42,
            distance_m: 88,
            polar_degrees: 52,
            target_height_m: 9,
            target_world: [-5.21648, 3.86, -244.099765],
          });
          runtime.focusCameraByName.set("Fahne der Einheit", {
            azimuth_degrees: -40,
            distance_m: 76,
            polar_degrees: 58,
            target_height_m: 14,
            target_world: [226.039773, 4.18, 57.925456],
          });
          runtime.focusCameraByName.set("Spielplatz an der Luiseninsel", {
            azimuth_degrees: -30,
            distance_m: 82,
            polar_degrees: 38,
            target_height_m: 0,
            target_world: [-324, 4.05, 886],
          });
          // The Goldelse stands 67 m up and faces west down the Straße des
          // 17. Juni, so the camera has to come at her from the west and stay
          // near her own height; the default overhead framing shows her back.
          runtime.focusCameraByName.set("Siegessäule", {
            azimuth_degrees: -70,
            distance_m: 66,
            polar_degrees: 80,
            target_height_m: 63,
            target_world: [-1459, 2.1, 456],
          });
          // The team drives east over the attic, so a south-east three-quarter
          // view at their own height is the one that lets you count four
          // horses; the default overview reduces them to one bronze lump.
          runtime.focusCameraByName.set("Quadriga mit Victoria", {
            azimuth_degrees: 42,
            distance_m: 52,
            polar_degrees: 72,
            target_height_m: 25,
            target_world: [417.9, 4.73, 301.42],
          });
          // South-east of the basin, looking back along the wedge: the plunge
          // face is nearest and the crown recedes to the low north entrance.
          runtime.focusCameraByName.set("Invalidenpark / Sinkende Mauer", {
            azimuth_degrees: 38,
            distance_m: 78,
            polar_degrees: 64,
            target_height_m: 3,
            target_world: [358, 5.3, -1150],
          });
          // The forecourt is 94 m wide (T-34s at +/-33 m, ML-20 howitzers
          // at +/-44.5 m); a south approach at 145 m with a steep polar
          // angle is the framing that keeps both wings in frame at once
          // instead of cropping one tank and one gun off-screen, which is
          // what the generic distance-only fallback used to do.
          runtime.focusCameraByName.set("Sowjetisches Ehrenmal Tiergarten", {
            azimuth_degrees: 180,
            distance_m: 145,
            polar_degrees: 68,
            target_height_m: 3,
            target_world: [26.57719945925055, 4.79, 245.32870413176715],
          });
          // v0.58.0: the ensemble is three separate OSM points spread
          // across ~55 m E-W and ~125 m N-S (Koenigin Luise at the south,
          // Friedrich Wilhelm III across the water to the north-west,
          // Jung-Wilhelm on the small island to the north-east), so a
          // camera at the sight's own centroid used the generic distance
          // fallback and left all three marble figures too small and
          // half-hidden by trees to read. Pull back and look north from
          // south of Luise's own pedestal so all three read in one frame.
          runtime.focusCameraByName.set("Königin-Luise-Denkmal (Luiseninsel)", {
            azimuth_degrees: 8,
            distance_m: 95,
            polar_degrees: 62,
            target_height_m: 3.5,
            target_world: [-488.2, 5.2, 889.2],
          });
          // Richard Wagner is an OSM artwork point with no dedicated sight
          // entry, so it never had a focus preset at all and only ever
          // showed at the generic ~190 m overview distance -- far too
          // far to tell the canopy roof from the marble group under it.
          runtime.focusCameraByName.set("Richard Wagner", {
            azimuth_degrees: 20,
            distance_m: 34,
            polar_degrees: 66,
            target_height_m: 4,
            target_world: [-672.1, 5.2, 967.2],
          });
          runtime.heroByName = new Map(
            manifest.hero_details.map((detail) => [detail.landmark_name, detail]),
          );
          for (const signature of manifest.architectural_signatures ?? []) {
            const model = createArchitecturalSignature(signature);
            if (model) {
              markAuthoredFlatUnlit(model);
              runtime.signatures.add(model);
            }
            const focusCamera = focusCameraForSignature(signature);
            if (focusCamera) {
              runtime.focusCameraByName.set(signature.landmark_name, focusCamera);
            }
          }
          applyLightingToRoot(runtime.signatures, runtime.lightingMode, runtime.nightLightsOn);
          if (runtime.lightingMode === "minecraft") {
            setMinecraftMaterialPresentation(
              runtime.signatures,
              runtime.minecraftMaterialState,
              true,
            );
          }
          runtime.monuments.removeFromParent();
          runtime.monuments = createMemorialLandmarks(manifest.landmarks);
          markAuthoredFlatUnlit(runtime.monuments);
          scene.add(runtime.monuments);
          applyLightingToRoot(runtime.monuments, runtime.lightingMode, runtime.nightLightsOn);
          runtime.culturalDetails.removeFromParent();
          runtime.culturalDetails = createCulturalLandmarks(manifest.landmarks);
          scene.add(runtime.culturalDetails);
          applyLightingToRoot(runtime.culturalDetails, runtime.lightingMode, runtime.nightLightsOn);
          if (runtime.lightingMode === "minecraft") {
            setMinecraftMaterialPresentation(
              scene,
              runtime.minecraftMaterialState,
              true,
            );
          }
          for (const landmark of manifest.landmarks) {
            const focusCamera = culturalFocusCamera(landmark.name);
            if (focusCamera) {
              runtime.focusCameraByName.set(landmark.name, focusCamera);
            }
          }
          if (manifest.park_details?.file) {
            const parkUrl = new URL(
              manifest.park_details.file,
              runtime.sceneRootUrl,
            );
            void fetch(parkUrl, { signal: manifestController.signal })
              .then(async (response) => {
                if (!response.ok) {
                  throw new Error(`Parkdetails: HTTP ${response.status}`);
                }
                return (await response.json()) as ParkDetailsPayload;
              })
              .then((payload) => {
                if (runtime.disposed) {
                  return;
                }
                const details = createParkDetails(payload, {
                  settledDetail: !runtime.coarsePointer,
                });
                runtime.parkDetails.removeFromParent();
                runtime.parkDetails = details;
                details.visible = !runtime.underside;
                setParkDetailsFocus(details, selectedRef.current);
                scene.add(details);
                applyLightingToRoot(details, runtime.lightingMode, runtime.nightLightsOn);
                if (runtime.lightingMode === "minecraft") {
                  setMinecraftMaterialPresentation(
                    details,
                    runtime.minecraftMaterialState,
                    true,
                  );
                }
                settleUntil = performance.now() + 350;
              })
              .catch((error: unknown) => {
                if (
                  !runtime.disposed &&
                  !(error instanceof DOMException && error.name === "AbortError")
                ) {
                  onWarningRef.current(
                    error instanceof Error
                      ? error.message
                      : "Optionale Parkdetails konnten nicht geladen werden.",
                  );
                }
              });
          }
          runtime.tunnel = createTunnel(manifest.tiergartentunnel);
          runtime.tunnelPoints = manifest.tiergartentunnel.points;
          scene.add(runtime.tunnel);
          runtime.tunnelPortals.removeFromParent();
          runtime.tunnelPortals = createTunnelPortals(manifest.tiergartentunnel);
          // Bore-view presets ("man muss … tief hineinschauen können"):
          // both tunnel sights aim straight into their bore from a low,
          // axis-near stand up the ramp, derived from the same centreline
          // the ramps are built from.
          const mouthViews = tunnelMouthViews(manifest.tiergartentunnel);
          if (mouthViews) {
            runtime.focusCameraByName.set(
              "Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz)",
              mouthViews.south,
            );
            runtime.focusCameraByName.set(
              "Kemperplatz / Tiergartentunnel",
              mouthViews.south,
            );
            runtime.focusCameraByName.set("Spreebogen", mouthViews.north);
          }
          markAuthoredFlatUnlit(runtime.tunnelPortals);
          scene.add(runtime.tunnelPortals);
          applyLightingToRoot(runtime.tunnelPortals, runtime.lightingMode, runtime.nightLightsOn);
          runtime.tunnelBounds = new Box3()
            .setFromObject(runtime.tunnel)
            .expandByScalar(5);
          // Day is the default mode: bring the drawn isometric city in
          // as soon as the scene manifest is known. A `?theme=minecraft`
          // deep link starts in Minecraft with no mode change ever
          // firing, so the block world must load here as well.
          ensureIsoWorld(runtime, onWarningRef.current);
          if (lightingModeRef.current === "minecraft") {
            ensureVoxelWorld(runtime, onWarningRef.current);
          }
          setModelMaterialState(runtime, runtime.underside);
          setProgress({ loaded: 0, total: manifest.base_tiles.length });

          const selected = runtime.landmarkByName.get(selectedRef.current);
          const distanceFromSelection = (file: MeshFile): number => {
            if (!selected) {
              return 0;
            }
            const bounds = file.source_bounds_epsg25833;
            const centerX = (bounds[0][0] + bounds[1][0]) / 2 - 389_500;
            const centerZ = 5_820_000 - (bounds[0][1] + bounds[1][1]) / 2;
            return Math.hypot(
              centerX - selected.world[0],
              centerZ - selected.world[2],
            );
          };
          const sortedTiles = [...manifest.base_tiles].sort(
            (left, right) =>
              distanceFromSelection(left) - distanceFromSelection(right),
          );
          focusLandmark(selectedRef.current, true);
          let readyNotified = false;
          let loadedBaseTiles = 0;
          const baseFailures = await runBoundedTasks(
            sortedTiles,
            coarsePointer ? 1 : 3,
            async (file) => {
              const loaded = await loadModelWithRetry(
                runtime,
                file,
                runtime.interactionSurface,
                { detail: false },
              );
              if (!loaded || disposed) {
                return;
              }
              loadedBaseTiles += 1;
              setProgress((current) => ({
                ...current,
                loaded: current.loaded + 1,
              }));
              if (!readyNotified) {
                readyNotified = true;
                onReadyRef.current();
              }
            },
            { shouldStop: () => runtime.disposed },
          );
          if (disposed) {
            return;
          }
          if (loadedBaseTiles === 0) {
            throw new Error("Keine 3D-Basiskachel konnte geladen werden");
          }
          if (baseFailures.length > 0) {
            setProgress((current) => ({
              ...current,
              total: Math.max(current.loaded, current.total - baseFailures.length),
            }));
            onWarningRef.current(
              `${baseFailures.length} Basiskachel(n) konnten nach zwei Versuchen nicht geladen werden.`,
            );
          }
          if (!disposed && !readyNotified) {
            onReadyRef.current();
          }
          const surfaceTiles = manifest.surface_detail_tiles ?? [];
          if (!coarsePointer && surfaceTiles.length > 0) {
            const sortedSurfaceTiles = [...surfaceTiles].sort(
              (left, right) =>
                distanceFromSelection(left) - distanceFromSelection(right),
            );
            void runBoundedTasks(
              sortedSurfaceTiles,
              1,
              async (file) => {
                await loadModelWithRetry(
                  runtime,
                  file,
                  runtime.settledSurface,
                  { detail: false },
                );
              },
              { shouldStop: () => runtime.disposed },
            ).then((failures) => {
              if (runtime.disposed) {
                return;
              }
              if (failures.length > 0) {
                disposeObject3D(runtime, runtime.settledSurface);
                onWarningRef.current(
                  `${failures.length} Oberflächen-Detailkachel(n) konnten nicht geladen werden; die flüssige 2,3-Millionen-Flächen-Stufe bleibt aktiv.`,
                );
                return;
              }
              runtime.settledSurfaceReady = true;
              settleUntil = performance.now() + 180;
              markSurfaceInteraction(runtime, 180);
            });
          }
        })
        .catch((error: unknown) => {
          if (
            !disposed &&
            !(error instanceof DOMException && error.name === "AbortError")
          ) {
            onErrorRef.current(
              error instanceof Error ? error.message : "3D scene failed",
            );
          }
        });

      return () => {
        disposed = true;
        runtime.disposed = true;
        manifestController.abort();
        window.cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown, true);
        renderer.domElement.removeEventListener("pointermove", onPointerMove, true);
        renderer.domElement.removeEventListener("pointerup", onPointerUp, true);
        renderer.domElement.removeEventListener("pointercancel", onPointerCancel, true);
        renderer.domElement.removeEventListener(
          "lostpointercapture",
          resetTouchGesture,
          true,
        );
        renderer.domElement.removeEventListener("dblclick", onDoubleClick);
        renderer.domElement.removeEventListener(
          "wheel",
          onWheelNavigation,
          true,
        );
        renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
        window.removeEventListener("pointerup", onPointerUp, true);
        window.removeEventListener("pointercancel", onPointerUp, true);
        window.removeEventListener("blur", resetTouchGesture);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        controls.removeEventListener("start", onControlsStart);
        controls.removeEventListener("end", onControlsEnd);
        if (wheelEndTimer !== null) {
          window.clearTimeout(wheelEndTimer);
        }
        if (runtime.markerTimer !== null) {
          window.clearTimeout(runtime.markerTimer);
        }
        controls.dispose();
        setMinecraftMaterialPresentation(
          scene,
          runtime.minecraftMaterialState,
          false,
        );
        disposeObject3D(runtime, scene);
        crispPass.dispose();
        composer.dispose();
        disposeMinecraftMaterialState(runtime.minecraftMaterialState);
        renderer.dispose();
      // Release the WebGL context immediately: iOS Safari's context
      // pool is tiny, and repeated map<->3D toggles could otherwise
      // exhaust it before GC runs.
      renderer.forceContextLoss();
        renderer.domElement.remove();
        runtimeRef.current = null;
      };
    }, [sceneUrl]);

    const percentage = Math.min(
      100,
      Math.round((progress.loaded / Math.max(1, progress.total)) * 100),
    );
    return (
      <div
        ref={hostRef}
        className={active ? "three-viewer is-active" : "three-viewer"}
        aria-hidden={!active}
      >
        {percentage < 100 ? (
          <div className="three-progress" role="status">
            <span>{progressLabel}</span>
            <strong>{percentage}%</strong>
            <div aria-hidden="true">
              <span style={{ width: `${percentage}%` }} />
            </div>
          </div>
        ) : null}
      </div>
    );
  },
);
