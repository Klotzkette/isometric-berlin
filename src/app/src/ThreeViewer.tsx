import {
  TOUCH,
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
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { applyArchitecturalInkMode } from "./architecturalInk";
import {
  type ArchitecturalSignature,
  type FocusCamera,
  createArchitecturalSignature,
  createIceOnRails,
  focusCameraForSignature,
} from "./ArchitecturalLandmarks";
import {
  createArdHauptstadtstudioRoofCollision,
} from "./ArdHauptstadtstudioCollision";
import { reichstagspraesidentenpalaisDetailSolidAt } from "./Reichstagspraesidentenpalais";
import { createHistoricParkBridgeCollision } from "./HistoricParkBridgeCollision";
import { createHauptbahnhofGrillstand } from "./HauptbahnhofGrillstand";
import { createMeiningerHotel } from "./MeiningerHotel";
import { createChancelleryExtension } from "./ChancelleryExtension";
import { createCityRecognitionRefinements } from "./CityRecognitionRefinements";
import { createCivicLandmarks } from "./CivicLandmarks";
import {
  centralCivicDetailsVisible,
  centralCivicFocusCamera,
  createCentralCivicDetails,
} from "./CentralCivicDetails";
import {
  berlinerEnsemblePublicArtSolidAt,
  setBerlinerEnsemblePublicArtSnow,
} from "./BerlinerEnsembleMemorials";
import {
  berlinerEnsembleRoofSignMotionDecision,
  collectBerlinerEnsembleRoofSignTargets,
  isBerlinerEnsembleRoofSignOnScreen,
  isBerlinerEnsembleRoofSignTarget,
  updateBerlinerEnsembleRoofSign,
} from "./BerlinerEnsemble";
import {
  createTunnelInteriorTester,
  createTunnelPortals,
  setTunnelPortalPresentation,
  tunnelMouthViews,
  type TunnelPortalApproach,
  type TunnelPortalCourse,
  type TunnelPortalId,
} from "./TunnelPortals";
import {
  createKrolloperSculptureEnsemble,
  createMemorialLandmarks,
  memorialFocusDistance,
} from "./MemorialLandmarks";
import {
  TIERGARTEN_LITERARY_MEMORIALS_PROFILE,
  setTiergartenLiteraryMemorialsSnow,
  tiergartenLiteraryMemorialSolidAt,
} from "./TiergartenLiteraryMemorials";
import {
  QUEER_RAINBOW_MEMORIAL_PROFILE,
  createQueerRainbowMemorial,
  setQueerRainbowMemorialSnow,
} from "./QueerRainbowMemorial";
import {
  CSD_ATTACK_MEMORIAL_PROFILE,
  createCsdAttackMemorial,
  csdAttackMemorialSolidAt,
  setCsdAttackMemorialSnow,
} from "./CsdAttackMemorial";
import {
  createCulturalLandmarks,
  culturalFocusCamera,
} from "./CulturalLandmarks";
import { setStarbucksPariserPlatzSnow } from "./StarbucksPariserPlatz";
import {
  createExpandedCityDetails,
  expandedCityFocusCamera,
} from "./ExpandedCityDetails";
import {
  setInvalidenfriedhofSnow,
} from "./InvalidenfriedhofDetails";
import { createSonyCenterForumRoof } from "./SonyCenterForumRoof";
import { createSpreebogenPark } from "./SpreebogenPark";
import {
  type ParkDetailsPayload,
  createParkDetails,
  parkDetailFocusDistance,
  setParkDetailsFocus,
  setParkSnowPresentation,
  setParkSettledDetail,
} from "./ParkDetails";
import { runBoundedTasks } from "./boundedTaskPool";
import {
  CAMERA_TARGET_CROSSING_MIN_M,
  PINCH_TARGET_CROSSING_ZONE_M,
  REGIERUNGSVIERTEL_FLIGHT_BOUNDS,
  type SignedPinchDolly,
  advanceSignedPinchDolly,
  type CameraPose,
  captureCameraPose,
  classifyTwoFingerGesture,
  continuousFlightSpeeds,
  createSignedPinchDolly,
  screenRelativeFlightDelta,
  stabilizeCameraRig,
  decayPanMomentum,
  twoFingerPanFlight,
  viewHeadingFlightDelta,
  zoomCameraAtScreenPoint,
} from "./cameraNavigation";
import {
  PEDESTRIAN_EYE_HEIGHT_M,
  PEDESTRIAN_FOV_DEGREES,
  PEDESTRIAN_IDLE_INPUT,
  PEDESTRIAN_VIEW_DISTANCE_M,
  addPedestrianParkObstacles,
  compilePedestrianWater,
  createPedestrianEnvironment,
  createPedestrianState,
  jumpPedestrian,
  lookPedestrian,
  pedestrianViewDirection,
  setPedestrianYaw,
  stepPedestrian,
  type PedestrianEnvironment,
  type PedestrianInput,
  type PedestrianSpawn,
  type PedestrianState,
} from "./pedestrianNavigation";
import { resolveSchwellenraumFlightTranslation } from "./schwellenraumNavigation";
import {
  createSchwellenraumInteriors,
  schwellenraumInteriorGroundAt,
  schwellenraumInteriorSolidAt,
  schwellenraumProtectedAt,
  setSchwellenraumInteriorsPresentation,
} from "./SchwellenraumInteriors";
import { federalStateRepresentationSolidAt } from "./FederalStateRepresentations";
import {
  createSchwellenraumMemorialProtectionIndex,
  schwellenraumProtectedMemorialAt,
} from "./schwellenraumMemorialProtection";
import {
  DEFAULT_THREE_CAMERA_OFFSET,
  DEFAULT_THREE_TARGET_WORLD,
} from "./resetView";
import { CRISPNESS_PROFILES } from "./crispnessProfile";
import {
  FINE_DETAIL_LAYER_NAMES,
  INK_LINE_REFERENCE_FEATURE_M,
  MICRO_DETAIL_LAYER_NAMES,
  inkLineFadeOpacity,
  nextInkLineFadeState,
  nextFineDetailVisible,
  nextMicroDetailVisible,
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
import { meshReplacementsFor, stripReplacedGeometry } from "./meshReplacements";
import { minecraftFogRange } from "./minecraftFog";
import { setQuadrigaMode } from "./Quadriga";
import { PRESENTATION_TONE } from "./presentationTone";
import {
  type PrismPayload,
  type SurfacePayload,
  SURFACE_WORLD_FILE,
  PRISM_WORLD_FILE,
  createIsometricCity,
  setIsoNightPresentation,
} from "./IsometricCityWorld";
import {
  DESKTOP_INITIAL_BUILDING_COUNT,
  MOBILE_INITIAL_BUILDING_COUNT,
  MOBILE_TOTAL_BUILDING_LIMIT,
  progressiveWorldStopPolicy,
  progressiveWorldTransition,
  progressiveWorldVisibilityTransition,
  releaseProgressiveWorldBatches,
  splitProgressiveBuildings,
  tryProgressiveWorkerOperation,
  type ProgressiveWorldState,
  type ProgressiveWorldWorkerInput,
  type ProgressiveWorldWorkerOutput,
} from "./progressiveWorld";
import {
  deserializeTransferredObject3D,
  objectMaterialsIncludingTransferredAlternates,
} from "./transferableObject3D";
import {
  GROUND_CONTEXT_FILE,
  type VoxelPayload,
  VOXEL_WORLD_FILE,
  WATER_TOP_Y,
  buildColumnToneLookup,
  createMinecraftVoxelWorld,
  smoothGroundTopSampler,
} from "./MinecraftVoxelWorld";
import { setMinecraftArchitecturePresentation } from "./MinecraftArchitecturalLandmarks";
import {
  applyMinecraftVisibility,
  restoreMinecraftVisibility,
  type MinecraftVisibilityRoots,
} from "./MinecraftVisibility";
import {
  minecraftHeroCollisionEnabled,
  minecraftHeroGroundAt,
  minecraftHeroSolidAt,
  reconcileMinecraftHeroCameraRig,
  resolveMinecraftHeroFlightTranslation,
} from "./MinecraftHeroNavigation";
import {
  invalidenfriedhofPedestrianSolidAt,
  visualModeWalkableInteriorAt,
} from "./visualModePedestrianAccess";
import {
  type MinecraftMobField,
  createMinecraftMobs,
  setMinecraftMobsVisible,
  updateMinecraftMobs,
} from "./MinecraftMobs";
import {
  RAIL_LINES_FILE,
  type RailPayload,
  createRailNetwork,
} from "./RailNetwork";
import {
  createTramCatenary,
  createUndergroundNetwork,
  setUndergroundPresentation,
} from "./UndergroundNetwork";
import { createCityStaffage } from "./CityStaffage";
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
  ACTIVE_MOTION_FRAME_INTERVAL_MS,
  renderFrameRequired,
  renderInteractionActive,
  renderPixelRatio,
  stableWebglMemoryProfile,
  stableViewportSize,
} from "./renderQuality";
import { browserUsesMobileViewerProfile } from "./viewerResidency";
import { shouldUseSettledSurface } from "./surfaceQuality";
import { fetchJsonWithRetry } from "./resilientFetch";
import {
  civicFlagFrameIntervalMs,
  setWindFlagWinterPresentation,
  updateWindFlags,
} from "./WindFlags";
import {
  type ModerateRain,
  createModerateRain,
  setRainPresentation,
  updateModerateRain,
} from "./WeatherEffects";
import {
  type Snowstorm,
  createSnowstorm,
  setSnowstormPresentation,
  snowfallAnimationActive,
  updateSnowstorm,
} from "./SnowstormEffects";
import {
  type PedestrianTouchTap,
  isPedestrianJumpDoubleTap,
  isPedestrianTouchTap,
  pedestrianWheelForwardInput,
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
import {
  SCHWELLENRAUM_SKY_COLOR,
  createSchwellenraumPraesentation,
  schwellenraumObjektmodus,
  setSchwellenraumDatenSchutz,
  setSchwellenraumPraesentation,
} from "./visual-modes/schwellenraum/presentation";
import {
  countSchwellenraumMovingFlags,
  schwellenraumMotionDecision,
  updateSchwellenraumMovingFlags,
} from "./visual-modes/schwellenraum/motion";
import {
  SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS,
  SCHWELLENRAUM_WATER_INITIAL_TIME_SECONDS,
  setSchwellenraumWaterAtmospherePresentation,
  updateSchwellenraumWaterAtmosphere,
} from "./visual-modes/schwellenraum/waterAtmosphere";
import {
  createSchwellenraumStaticPropCollision,
  installSchwellenraumStaticProps,
} from "./visual-modes/schwellenraum/staticProps";
import {
  installUnterDenLindenMedianRefinement,
} from "./visual-modes/schwellenraum/unterDenLindenMedian";
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
  portal_approaches?: Partial<Record<TunnelPortalId, TunnelPortalApproach>>;
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
  pedestrianMode: boolean;
  precipitationEnabled: boolean;
  progressLabel: string;
  sceneUrl: string;
  selectedLandmark: string;
  onError: (message: string) => void;
  onPedestrianRespawn: () => void;
  onPedestrianSprintToggle: () => void;
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
  setOrbitInput: (horizontal: number, vertical: number) => void;
  setPanInput: (horizontal: number, vertical: number) => void;
  setPedestrianMode: (enabled: boolean) => boolean;
  setPedestrianSprint: (enabled: boolean) => void;
  setUnderside: (enabled: boolean) => void;
  tiltBy: (degrees: number) => void;
  zoomBy: (factor: number) => void;
  jumpPedestrian: () => boolean;
};

type PedestrianRuntime = {
  cameraDirty: boolean;
  enabled: boolean;
  environment: PedestrianEnvironment | null;
  requested: boolean;
  savedFov: number;
  savedNear: number;
  savedPose: CameraPose | null;
  savedUnderside: boolean;
  state: PedestrianState | null;
};

type Runtime = {
  baseSurfaceReady: boolean;
  camera: PerspectiveCamera;
  centralDetails: Group;
  cityStaffage: Group;
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
  minecraftMobs: MinecraftMobField | null;
  modelMaterials: Set<MeshStandardMaterial>;
  monuments: Group;
  schwellenraumInteriors: Group;
  schwellenraumPraesentation: Group;
  berlinerEnsembleRoofSignElapsedSeconds: number;
  berlinerEnsembleRoofSignLastFrameAt: number;
  berlinerEnsembleRoofSignTargets: Object3D[];
  schwellenraumFlagElapsedSeconds: number;
  schwellenraumLastFlagFrameAt: number;
  schwellenraumLastWaterFrameAt: number;
  schwellenraumMovingFlagCount: number;
  schwellenraumWaterElapsedSeconds: number;
  schwellenraumWaterLightCount: number;
  parkDetails: Group;
  pedestrian: PedestrianRuntime;
  presentationReady: boolean;
  notifyPresentationReady: () => void;
  rain: ModerateRain;
  reducedMotion: boolean;
  precipitationEnabled: boolean;
  snowstorm: Snowstorm;
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
  cameraInsideTunnel: boolean;
  tunnelInteriorAt: ((x: number, y: number, z: number) => boolean) | null;
  tunnelPortals: Group;
  tunnelPoints: TunnelPayload["points"] | null;
  tunnelPortalCourse: TunnelPortalCourse | null;
  tunnelPortalInteriorVisible: boolean;
  groundPayloadPromise?: Promise<VoxelPayload>;
  prismPayloadPromise?: Promise<PrismPayload>;
  railPayloadPromise?: Promise<RailPayload>;
  streetPayloadPromise?: Promise<StreetDetailsPayload>;
  surfacePayloadPromise?: Promise<SurfacePayload>;
  voxelPayloadPromise?: Promise<VoxelPayload>;
  progressiveWorldBatches: Group[];
  progressiveWorldInput?: ProgressiveWorldWorkerInput;
  progressiveWorldState: ProgressiveWorldState;
  progressiveWorldStartCancel?: () => void;
  progressiveWorldWorker?: Worker;
  loadSignal: AbortSignal;
  ensurePhotoSurface: () => void;
  ensurePedestrianWater: () => void;
  photoSurfaceState: "failed" | "idle" | "loading" | "ready";
  reportCoreProgress: (loaded: number, total: number) => void;
  startDeferredDetails: () => void;
  trafficSignals?: Group | null;
  tramCatenary: Group;
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
  microDetailObjects: Object3D[];
  microDetailVisible: boolean;
  /** Explicit lens owned by the active curated landmark close-up. */
  focusedCameraFov: number | null;
  voxelWorld: Group | null;
  voxelWorldState: "failed" | "idle" | "loading";
  lightingMode: LightingMode;
  nightLightsOn: boolean;
  underside: boolean;
  undergroundNetwork: Group;
  underwater: boolean;
};

function minecraftVisibilityRoots(runtime: Runtime): MinecraftVisibilityRoots {
  return {
    centralDetails: runtime.centralDetails,
    cityStaffage: runtime.cityStaffage,
    civicDetails: runtime.civicDetails,
    signatures: runtime.signatures,
  };
}

function refreshSchwellenraumMovingFlagCount(runtime: Runtime): void {
  runtime.schwellenraumMovingFlagCount = countSchwellenraumMovingFlags([
    runtime.signatures,
    runtime.civicDetails,
  ]);
}

/**
 * Translate the camera and its focal point as one rigid body. Schwellenraum
 * and Minecraft use the metric pedestrian collision field in full 3D; the
 * other visual modes retain the established bounded camera movement exactly.
 */
function applyBoundedCameraRigTranslation(
  runtime: Runtime,
  requested: Vector3,
): Vector3 {
  const boundedTarget = runtime.controls.target
    .clone()
    .add(requested)
    .clamp(
      REGIERUNGSVIERTEL_FLIGHT_BOUNDS.min,
      REGIERUNGSVIERTEL_FLIGHT_BOUNDS.max,
    );
  const boundedRequest = boundedTarget.sub(runtime.controls.target);
  let applied = boundedRequest;
  if (
    (runtime.lightingMode === "schwellenraum" ||
      minecraftHeroCollisionEnabled(runtime.lightingMode)) &&
    runtime.pedestrian.environment
  ) {
    const resolver = minecraftHeroCollisionEnabled(runtime.lightingMode)
      ? resolveMinecraftHeroFlightTranslation
      : resolveSchwellenraumFlightTranslation;
    const resolved = resolver(
      runtime.camera.position,
      boundedRequest,
      runtime.pedestrian.environment,
    );
    applied = new Vector3(
      resolved.applied.x,
      resolved.applied.y,
      resolved.applied.z,
    );
  }
  runtime.controls.target.add(applied);
  runtime.camera.position.add(applied);
  runtime.camera.updateMatrixWorld();
  return applied;
}

/** Keep a direct Minecraft orbit/dolly/pan pose outside metric solids. */
function reconcileMinecraftCameraRig(
  runtime: Runtime,
  previousCamera: Vector3,
  previousTarget: Vector3,
): boolean {
  if (
    runtime.pedestrian.enabled ||
    !minecraftHeroCollisionEnabled(runtime.lightingMode) ||
    !runtime.pedestrian.environment
  ) {
    return false;
  }
  const reconciled = reconcileMinecraftHeroCameraRig(
    {
      camera: previousCamera,
      target: previousTarget,
    },
    {
      camera: runtime.camera.position,
      target: runtime.controls.target,
    },
    runtime.pedestrian.environment,
  );
  runtime.camera.position.set(
    reconciled.camera.x,
    reconciled.camera.y,
    reconciled.camera.z,
  );
  runtime.controls.target.set(
    reconciled.target.x,
    reconciled.target.y,
    reconciled.target.z,
  );
  runtime.camera.lookAt(runtime.controls.target);
  runtime.camera.updateMatrixWorld();
  return reconciled.blocked;
}

function flyCameraRigInViewPlane(
  runtime: Runtime,
  horizontal: number,
  vertical: number,
): Vector3 {
  return applyBoundedCameraRigTranslation(
    runtime,
    screenRelativeFlightDelta(
      runtime.camera,
      runtime.controls.target,
      horizontal,
      vertical,
    ),
  );
}

function flyCameraRigAlongViewHeading(
  runtime: Runtime,
  strafe: number,
  forward: number,
): Vector3 {
  return applyBoundedCameraRigTranslation(
    runtime,
    viewHeadingFlightDelta(
      runtime.camera,
      runtime.controls.target,
      strafe,
      forward,
    ),
  );
}

type WorldLoadState = "failed" | "idle" | "loading";
export type StartupPresentationStatus = "fallback" | "pending" | "ready";

/**
 * Resolve what may be shown while the requested drawn world is loading.
 *
 * The photogrammetric Berlin mesh is an explicit failure fallback, never a
 * startup placeholder. Returning ``pending`` keeps it behind the opaque
 * startup curtain from the first WebGL frame; this prevents the old photo
 * surface from flashing before Day/Night/Snow/Schwellenraum or Minecraft is
 * ready.
 */
export function startupPresentationStatus({
  isoWorldReady,
  isoWorldState,
  lightingMode,
  voxelWorldReady,
  voxelWorldState,
}: {
  isoWorldReady: boolean;
  isoWorldState: WorldLoadState;
  lightingMode: LightingMode;
  voxelWorldReady: boolean;
  voxelWorldState: WorldLoadState;
}): StartupPresentationStatus {
  if (lightingMode === "minecraft") {
    if (voxelWorldReady) {
      return "ready";
    }
    return voxelWorldState === "failed" ? "fallback" : "pending";
  }
  if (isoWorldReady) {
    return "ready";
  }
  return isoWorldState === "failed" ? "fallback" : "pending";
}

export function startupCurtainMayOpen(
  status: StartupPresentationStatus,
  baseSurfaceReady: boolean,
): boolean {
  return status === "ready" || (status === "fallback" && baseSurfaceReady);
}

/** Heavy photogrammetry is demand-only, never part of the normal first load. */
export function photographicSurfaceNeeded(
  status: StartupPresentationStatus,
  underside: boolean,
  coarsePointer = false,
): boolean {
  // Phones use the authored tunnel/network cutaway without allocating the
  // legacy 31 MiB photographic shell.  It is especially harmful after a
  // WebGL memory failure, where loading another large scene is the opposite
  // of recovery.  Desktop retains the richer underside/failure fallback.
  if (coarsePointer) return false;
  return underside || status === "fallback";
}

export function presentationFogRange(
  mode: LightingMode,
  underside: boolean,
): { far: number; near: number } | null {
  // Weather and horizon haze belong to the exterior. Reusing them below the
  // city made the Snowstorm cutaway nearly blank and unnecessarily softened
  // Minecraft's route lines. The underground keeps one clear spatial
  // contract in every mode; route palettes still carry the mode distinction.
  if (underside) return null;
  if (mode === "minecraft") return minecraftFogRange();
  if (mode === "snowstorm") return { near: 540, far: 2_250 };
  return null;
}

type HeroDetailGroup = {
  group: Group;
  lastUsed: number;
  loadedFiles: number;
  loading: boolean;
};

// Match the pre-manifest camera to the public default focus. The regular
// landmark-focus path replaces this with the Reichstag's authored camera as
// soon as scene.json is available; both poses stand over the Platz der
// Republik lawn, so the startup curtain cannot reveal a framing jump.
const DEFAULT_TARGET = new Vector3(...DEFAULT_THREE_TARGET_WORLD);
const DEFAULT_CAMERA_OFFSET = new Vector3(...DEFAULT_THREE_CAMERA_OFFSET);
const DETAIL_RAISE_M = 0.035;
const WATER_LEVEL_Y = WATER_TOP_Y;
const UNDERWATER_COLOR = 0x0b4250;

function applyPedestrianCamera(runtime: Runtime): boolean {
  const state = runtime.pedestrian.state;
  if (!runtime.pedestrian.enabled || !state) {
    return false;
  }
  const direction = pedestrianViewDirection(state);
  runtime.camera.position.set(
    state.x,
    state.groundY + PEDESTRIAN_EYE_HEIGHT_M + state.jumpOffset,
    state.z,
  );
  runtime.controls.target
    .copy(runtime.camera.position)
    .add(
      new Vector3(direction.x, direction.y, direction.z).multiplyScalar(
        PEDESTRIAN_VIEW_DISTANCE_M,
      ),
    );
  runtime.camera.lookAt(runtime.controls.target);
  runtime.camera.updateMatrixWorld();
  runtime.renderInvalidated = true;
  runtime.pedestrian.cameraDirty = false;
  return true;
}

function activatePedestrianMode(runtime: Runtime): boolean {
  runtime.pedestrian.requested = true;
  const environment = runtime.pedestrian.environment;
  if (!environment) {
    return false;
  }
  if (!runtime.pedestrian.enabled) {
    runtime.pedestrian.savedPose = captureCameraPose(
      runtime.camera,
      runtime.controls.target,
    );
    runtime.pedestrian.savedFov = runtime.camera.fov;
    runtime.pedestrian.savedNear = runtime.camera.near;
    runtime.pedestrian.savedUnderside = runtime.underside;
  }
  runtime.cancelPanGlide?.();
  runtime.tunnelPortalInteriorVisible = false;
  runtime.marker.visible = false;
  runtime.pedestrian.enabled = true;
  const viewDirection = new Vector3();
  runtime.camera.getWorldDirection(viewDirection);
  const currentGroundPoint = [
    runtime.camera.position,
    runtime.controls.target,
  ].find((point) => {
    return (
      point.x >= environment.bounds.minX &&
      point.x <= environment.bounds.maxX &&
      point.z >= environment.bounds.minZ &&
      point.z <= environment.bounds.maxZ &&
      environment.groundAt(point.x, point.z) !== null
    );
  });
  const spawn: PedestrianSpawn | undefined = currentGroundPoint
    ? {
        groundYHint: runtime.camera.position.y - PEDESTRIAN_EYE_HEIGHT_M,
        pitch: Math.asin(MathUtils.clamp(viewDirection.y, -1, 1)),
        x: currentGroundPoint.x,
        yaw: Math.atan2(viewDirection.x, -viewDirection.z),
        z: currentGroundPoint.z,
      }
    : undefined;
  runtime.pedestrian.state = createPedestrianState(environment, spawn);
  runtime.pedestrian.cameraDirty = true;
  runtime.controls.enabled = false;
  runtime.camera.fov = PEDESTRIAN_FOV_DEGREES;
  runtime.camera.near = 0.08;
  runtime.camera.updateProjectionMatrix();
  setModelMaterialState(runtime, false);
  setEnvironmentalPresentation(runtime);
  applyPedestrianCamera(runtime);
  return true;
}

function syncPedestrianTunnelPresentation(
  runtime: Runtime,
  insideTunnel: boolean,
): void {
  setTunnelPresentation(runtime.tunnel, false, insideTunnel);
  setTunnelPortalPresentation(
    runtime.tunnelPortals,
    false,
    voxelModeActive(runtime),
    insideTunnel,
  );
  setEnvironmentalPresentation(runtime);
  runtime.renderInvalidated = true;
}

function deactivatePedestrianMode(runtime: Runtime): boolean {
  runtime.pedestrian.requested = false;
  if (!runtime.pedestrian.enabled) {
    return false;
  }
  const savedPose = runtime.pedestrian.savedPose;
  runtime.pedestrian.enabled = false;
  runtime.pedestrian.state = null;
  runtime.pedestrian.cameraDirty = false;
  runtime.controls.enabled = true;
  runtime.camera.fov = runtime.pedestrian.savedFov;
  runtime.camera.near = runtime.pedestrian.savedNear;
  runtime.camera.updateProjectionMatrix();
  if (savedPose) {
    runtime.camera.position.copy(savedPose.position);
    runtime.controls.target.copy(savedPose.target);
  }
  setModelMaterialState(runtime, runtime.pedestrian.savedUnderside);
  runtime.controls.update();
  runtime.camera.updateMatrixWorld();
  runtime.pedestrian.savedPose = null;
  runtime.renderInvalidated = true;
  setEnvironmentalPresentation(runtime);
  return true;
}

function nudgePedestrian(
  runtime: Runtime,
  strafe: number,
  forward: number,
): boolean {
  const environment = runtime.pedestrian.environment;
  let state = runtime.pedestrian.state;
  if (!runtime.pedestrian.enabled || !environment || !state) {
    return false;
  }
  const wasInsideTunnel = state.insideTunnel;
  let changed = false;
  for (let index = 0; index < 7; index += 1) {
    const result = stepPedestrian(
      state,
      { forward, look: 0, sprint: false, strafe, turn: 0 },
      0.05,
      environment,
    );
    state = result.state;
    changed ||= result.changed;
    if (result.respawned) {
      break;
    }
  }
  runtime.pedestrian.state = state;
  runtime.pedestrian.cameraDirty ||= changed;
  if (state.insideTunnel !== wasInsideTunnel) {
    syncPedestrianTunnelPresentation(runtime, state.insideTunnel);
  }
  if (changed) {
    applyPedestrianCamera(runtime);
  }
  return changed;
}

function triggerPedestrianJump(runtime: Runtime): boolean {
  const state = runtime.pedestrian.state;
  if (!runtime.pedestrian.enabled || !state) {
    return false;
  }
  const next = jumpPedestrian(state);
  if (next === state) {
    return false;
  }
  runtime.pedestrian.state = next;
  runtime.pedestrian.cameraDirty = true;
  runtime.renderInvalidated = true;
  markSurfaceInteraction(runtime, 220);
  return true;
}

function isTunnelPortalFocus(name: string): boolean {
  return name.includes("Tiergartentunnel") || name === "Spreebogen";
}

function schwellenraumWaterRoots(runtime: Runtime): Object3D[] {
  const roots: Object3D[] = [
    runtime.signatures,
    runtime.centralDetails,
    runtime.civicDetails,
    runtime.monuments,
    runtime.culturalDetails,
    runtime.parkDetails,
  ];
  if (runtime.isoWorld) roots.push(runtime.isoWorld);
  return roots;
}

function setEnvironmentalPresentation(runtime: Runtime): void {
  const obstructed =
    runtime.underside ||
    runtime.underwater ||
    runtime.pedestrian.state?.insideTunnel === true ||
    runtime.cameraInsideTunnel;
  const rainChanged = setRainPresentation(runtime.rain, {
    enabled: runtime.precipitationEnabled,
    mode: runtime.lightingMode,
    obstructed,
  });
  const mobsChanged = setMinecraftMobsVisible(
    runtime.minecraftMobs,
    runtime.lightingMode === "minecraft" && !obstructed,
  );
  const snowChanged = setSnowstormPresentation(runtime.snowstorm, {
    enabled: runtime.precipitationEnabled,
    mode: runtime.lightingMode,
    obstructed,
  });
  const schwellenraumChanged = setSchwellenraumPraesentation(
    runtime.schwellenraumPraesentation,
    runtime.lightingMode,
    obstructed || runtime.underside,
  );
  const waterWasVisible = runtime.schwellenraumWaterLightCount > 0;
  const waterAtmosphere = setSchwellenraumWaterAtmospherePresentation(
    schwellenraumWaterRoots(runtime),
    runtime.lightingMode,
    obstructed || runtime.underside,
  );
  runtime.schwellenraumWaterLightCount = waterAtmosphere.visibleCount;
  if (waterAtmosphere.visibleCount > 0) {
    updateSchwellenraumWaterAtmosphere(
      schwellenraumWaterRoots(runtime),
      runtime.schwellenraumWaterElapsedSeconds,
      runtime.reducedMotion,
    );
    if (!waterWasVisible) {
      // Entering the mode or resurfacing shows the already established
      // sample first. The next change waits one complete bounded interval.
      runtime.schwellenraumLastWaterFrameAt = performance.now();
    }
  }
  const interiorsVisible =
    runtime.lightingMode === "schwellenraum" && !runtime.underside;
  const interiorsChanged =
    runtime.schwellenraumInteriors.visible !== interiorsVisible;
  setSchwellenraumInteriorsPresentation(
    runtime.schwellenraumInteriors,
    interiorsVisible,
  );
  if (
    rainChanged ||
    mobsChanged ||
    snowChanged ||
    schwellenraumChanged ||
    waterAtmosphere.changed ||
    interiorsChanged
  ) {
    runtime.renderInvalidated = true;
  }
}

export function shouldUseUnderwaterPresentation({
  cameraY,
  insideTunnel,
  underside,
}: {
  cameraY: number;
  insideTunnel: boolean;
  underside: boolean;
}): boolean {
  return cameraY < WATER_LEVEL_Y - 0.2 && !insideTunnel && !underside;
}

function setUnderwaterPresentation(
  runtime: Runtime,
  underwater: boolean,
): void {
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
  setEnvironmentalPresentation(runtime);
}

let lastSurfaceQualityDataset = "";

function currentStartupPresentationStatus(
  runtime: Runtime,
): StartupPresentationStatus {
  return startupPresentationStatus({
    isoWorldReady: runtime.isoWorld !== null,
    isoWorldState: runtime.isoWorldState,
    lightingMode: runtime.lightingMode,
    voxelWorldReady: runtime.voxelWorld !== null,
    voxelWorldState: runtime.voxelWorldState,
  });
}

function notifyPresentationReadyWhenPossible(runtime: Runtime): void {
  if (
    runtime.disposed ||
    runtime.presentationReady ||
    !startupCurtainMayOpen(
      currentStartupPresentationStatus(runtime),
      runtime.baseSurfaceReady,
    )
  ) {
    return;
  }
  runtime.presentationReady = true;
  runtime.notifyPresentationReady();
}

function setSurfacePresentation(
  runtime: Runtime,
  interactionTierLocked: boolean,
): void {
  const settled = shouldUseSettledSurface({
    coarsePointer: runtime.coarsePointer,
    detailReady: runtime.settledSurfaceReady,
    interactionTierLocked,
  });
  // The voxel block world (Minecraft) and the drawn isometric city
  // (Day/Night/Snow/Schwellenraum) each fully replace the photogrammetry
  // surfaces. While
  // either requested world is still pending, the old photo surface remains
  // hidden as well: it is a failure fallback, not a startup placeholder.
  // Once a drawn world is ready, the sole exception is
  // from the underside, where the faded photo shell is the designed
  // cutaway context around the Tiergartentunnel (both drawn worlds hide
  // below the horizon, which otherwise left the tunnel floating in a
  // void).
  const startupStatus = currentStartupPresentationStatus(runtime);
  const replaced =
    startupStatus === "pending" ||
    (startupStatus === "ready" && !runtime.underside);
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
  const surfaceQuality =
    startupStatus === "pending"
      ? "startup-hidden"
      : startupStatus === "ready"
        ? runtime.lightingMode === "minecraft"
          ? "voxel-world"
          : "drawn-isometric"
        : settled
          ? "settled-7m-plus"
          : "interaction-2_3m";
  if (surfaceQuality !== lastSurfaceQualityDataset) {
    lastSurfaceQualityDataset = surfaceQuality;
    runtime.renderer.domElement.dataset.surfaceQuality = surfaceQuality;
  }
}

function markSurfaceInteraction(
  runtime: Runtime,
  durationMs = 650,
  preserveTunnelFocus = false,
): void {
  if (runtime.tunnelPortalInteriorVisible && !preserveTunnelFocus) {
    runtime.tunnelPortalInteriorVisible = false;
    setTunnelPortalPresentation(
      runtime.tunnelPortals,
      runtime.underside,
      voxelModeActive(runtime),
      false,
    );
  }
  if (!preserveTunnelFocus) {
    runtime.focusedCameraFov = null;
  }
  runtime.interactionUntil = Math.max(
    runtime.interactionUntil,
    performance.now() + durationMs,
  );
  runtime.renderInvalidated = true;
}

/** Authored civic signatures remain available in every surface mode. */
export function civicDetailsVisible(underside: boolean): boolean {
  return !underside;
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
    setFlatUnlit(
      material,
      mode === "day" || mode === "snowstorm" || mode === "schwellenraum",
    );
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
        material.userData.flatClean =
          material.transparent ||
          material.userData.preserveAuthoredDark === true
            ? 0
            : 1;
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
  runtime.microDetailObjects = [];
  runtime.berlinerEnsembleRoofSignTargets = [];
  const fineDetailNames = new Set(FINE_DETAIL_LAYER_NAMES);
  const microDetailNames = new Set(MICRO_DETAIL_LAYER_NAMES);
  const roots: Array<Object3D | null> = [
    runtime.isoWorld,
    runtime.voxelWorld,
    runtime.signatures,
    runtime.civicDetails,
    runtime.centralDetails,
    runtime.monuments,
    runtime.culturalDetails,
    runtime.parkDetails,
    runtime.cityStaffage,
    runtime.tramCatenary,
    runtime.undergroundNetwork,
    runtime.tunnel,
    runtime.tunnelPortals,
    ...[...runtime.detailGroups.values()].map((entry) => entry.group),
  ];
  const inkLines: Array<LineSegments<BufferGeometry, LineBasicMaterial>> = [];
  for (const root of roots) {
    root?.traverse((object) => {
      if (
        object instanceof LineSegments &&
        object.material instanceof LineBasicMaterial
      ) {
        stabilizeInkLineMaterial(object.material);
        runtime.inkLineMaterials.add(object.material);
        inkLines.push(object);
      }
      if (fineDetailNames.has(object.name)) {
        runtime.fineDetailObjects.push(object);
      }
      if (microDetailNames.has(object.name)) {
        runtime.microDetailObjects.push(object);
      }
      if (isBerlinerEnsembleRoofSignTarget(object)) {
        runtime.berlinerEnsembleRoofSignTargets.push(object);
      }
    });
  }
  updateBerlinerEnsembleRoofSign(
    runtime.berlinerEnsembleRoofSignTargets,
    runtime.berlinerEnsembleRoofSignElapsedSeconds,
  );
  assignStableInkRenderOrder(inkLines);
}

function registerBerlinerEnsembleRoofSignTargets(
  runtime: Runtime,
  root: Object3D,
): void {
  for (const target of collectBerlinerEnsembleRoofSignTargets(root)) {
    if (!runtime.berlinerEnsembleRoofSignTargets.includes(target)) {
      runtime.berlinerEnsembleRoofSignTargets.push(target);
    }
  }
  updateBerlinerEnsembleRoofSign(
    runtime.berlinerEnsembleRoofSignTargets,
    runtime.berlinerEnsembleRoofSignElapsedSeconds,
  );
}

/**
 * Lock transparent ink to a deterministic order inside its authored layer.
 *
 * Three.js otherwise falls back to camera-space depth for objects sharing a
 * renderOrder. Nearly co-planar facade and roof lines can exchange places
 * while orbiting, changing blended pixels even though their geometry is
 * static. The tiny rank stays inside the original layer and is independent of
 * the camera; object ids are stable for the lifetime of the scene.
 */
export const STABLE_INK_RENDER_ORDER_SPAN = 1e-4;

export function assignStableInkRenderOrder(
  lines: ReadonlyArray<LineSegments<BufferGeometry, LineBasicMaterial>>,
): void {
  const layers = new Map<
    number,
    Array<LineSegments<BufferGeometry, LineBasicMaterial>>
  >();
  for (const line of lines) {
    const storedOrder = line.userData.stableInkBaseRenderOrder;
    const baseOrder =
      typeof storedOrder === "number" && Number.isFinite(storedOrder)
        ? storedOrder
        : Number.isFinite(line.renderOrder)
          ? line.renderOrder
          : 0;
    line.userData.stableInkBaseRenderOrder = baseOrder;
    const layer = layers.get(baseOrder) ?? [];
    layer.push(line);
    layers.set(baseOrder, layer);
  }
  for (const [baseOrder, layer] of layers) {
    layer.sort((left, right) => left.id - right.id);
    const denominator = layer.length + 1;
    layer.forEach((line, index) => {
      line.renderOrder =
        baseOrder + (STABLE_INK_RENDER_ORDER_SPAN * (index + 1)) / denominator;
    });
  }
}

/**
 * Make a drawn line temporally stable without letting it show through walls.
 *
 * Transparent LineBasicMaterial objects are depth-sorted every frame. Leaving
 * depthWrite enabled made overlapping facade/roof strokes alternately occlude
 * one another as the camera moved. They still depth-test against opaque city
 * geometry, but no longer rewrite depth among themselves. Alpha-to-coverage
 * lets the composer's four MSAA samples soften a one-pixel line edge.
 */
export function stabilizeInkLineMaterial(material: LineBasicMaterial): void {
  if (typeof material.userData.stableInkAuthoredOpacity !== "number") {
    material.userData.stableInkAuthoredOpacity = material.opacity;
    material.userData.stableInkAppliedOpacity = null;
  }
  if (material.userData.temporallyStableInk === true) {
    return;
  }
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousProgramCacheKey = material.customProgramCacheKey();
  material.userData.temporallyStableInk = true;
  material.transparent = true;
  material.depthTest = true;
  material.depthWrite = false;
  material.alphaToCoverage = true;
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer);
    shader.vertexShader = stabilizeInkVertexShader(shader.vertexShader);
  };
  material.customProgramCacheKey = () =>
    `${previousProgramCacheKey}|stable-ink-view-bias-v1`;
  material.needsUpdate = true;
}

/**
 * Pull co-planar drawing ink three centimetres towards the camera in view
 * space. EdgesGeometry shares its vertices with the facade or roof it traces;
 * without this small physical bias, depth precision can make the carrier
 * surface and its outline alternate while orbiting. A view-space metre value
 * stays constant at every zoom and remains far too small to reveal ink through
 * a real wall.
 */
export const STABLE_INK_VIEW_BIAS_M = 0.03;

export function stabilizeInkVertexShader(vertexShader: string): string {
  const projectVertex = "#include <project_vertex>";
  if (
    !vertexShader.includes(projectVertex) ||
    vertexShader.includes("stableInkViewBias")
  ) {
    return vertexShader;
  }
  return vertexShader.replace(
    projectVertex,
    `${projectVertex}
  float stableInkViewBias = ${STABLE_INK_VIEW_BIAS_M.toFixed(3)};
  mvPosition.z += stableInkViewBias;
  gl_Position = projectionMatrix * mvPosition;`,
  );
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
    const state = nextInkLineFadeState({
      authoredOpacity: material.userData.stableInkAuthoredOpacity as number,
      currentOpacity: material.opacity,
      fadeOpacity: opacity,
      lastAppliedOpacity:
        typeof material.userData.stableInkAppliedOpacity === "number"
          ? material.userData.stableInkAppliedOpacity
          : null,
    });
    material.userData.stableInkAuthoredOpacity = state.authoredOpacity;
    material.userData.stableInkAppliedOpacity = state.appliedOpacity;
    if (Math.abs(material.opacity - state.appliedOpacity) > 1e-6) {
      material.opacity = state.appliedOpacity;
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
  const microDetailVisible = nextMicroDetailVisible({
    distanceM,
    visible: runtime.microDetailVisible,
  });
  if (runtime.microDetailVisible !== microDetailVisible) {
    runtime.microDetailVisible = microDetailVisible;
    changed = true;
  }
  for (const object of runtime.microDetailObjects) {
    if (object.visible !== microDetailVisible) {
      object.visible = microDetailVisible;
      changed = true;
    }
  }
  return changed;
}

export function applyLightingToRoot(
  root: Object3D,
  mode: LightingMode,
  lightsOn = true,
): void {
  const seen = new Set<MeshStandardMaterial>();
  root.traverse((object) => {
    // A protected memorial subtree always resolves to ordinary Day. Walking
    // the ancestry also catches unnamed meshes below a named memorial root.
    const objectMode = schwellenraumObjektmodus(mode, object);
    if (object.userData.nightOnly === true) {
      // "Licht aus" turns every night-only artificial-light prop (uplights,
      // point lights, glow cones) off along with the emissive materials
      // above — the moonlit look keeps none of them.
      object.visible = objectMode === "night" && lightsOn;
    }
    // Hero-model ink follows the shared three-level register in every surface
    // mode; purposeful glass, bronze and masonry accents retain their identity.
    if (
      object instanceof LineSegments &&
      (object.material as LineBasicMaterial).userData?.modeInk === true
    ) {
      applyArchitecturalInkMode(
        object.material as LineBasicMaterial,
        objectMode,
      );
    }
    if (!(object instanceof Mesh)) {
      return;
    }
    // Drawn accessory kits keep exact unlit paint for day/snow and a separate
    // lit material for night. Most of those kits live under isoWorld and are
    // switched there; expansion details are a sibling recognition layer, so
    // the scene-wide lighting pass must honour the same contract as well.
    const dayMaterial = object.userData.dayMaterial as
      MeshBasicMaterial | MeshStandardMaterial | undefined;
    const nightMaterial = object.userData.nightMaterial as
      MeshBasicMaterial | MeshStandardMaterial | undefined;
    if (dayMaterial && nightMaterial) {
      object.material = objectMode === "night" ? nightMaterial : dayMaterial;
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
      setBuildingColorMode(object.geometry, objectMode !== "night");
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial && !seen.has(material)) {
        seen.add(material);
        applyMaterialLighting(material, objectMode, lightsOn);
      }
    }
  });
}

function setSceneLighting(
  runtime: Runtime,
  mode: LightingMode,
  lightsOn = true,
): void {
  const enteringSchwellenraum =
    mode === "schwellenraum" && runtime.lightingMode !== "schwellenraum";
  // Release only the visibility values owned by the previous voxel filter
  // before the target mode's lighting and night-only policies run.
  restoreMinecraftVisibility(minecraftVisibilityRoots(runtime));
  runtime.renderInvalidated = true;
  runtime.lightingMode = mode;
  runtime.nightLightsOn = lightsOn;
  const isNight = mode === "night";
  const isMoonlit = isNight && !lightsOn;
  const isMinecraft = mode === "minecraft";
  const isSnowstorm = mode === "snowstorm";
  const isSchwellenraum = mode === "schwellenraum";
  if (!isMinecraft) {
    setMinecraftMaterialPresentation(
      runtime.scene,
      runtime.minecraftMaterialState,
      false,
    );
  }
  // Moonlight keeps the same dark register as ordinary night — the request
  // was for the artificial lights to disappear, not for a different sky.
  const sky = isNight
    ? 0x07131f
    : isMinecraft
      ? 0xaedaf0
      : isSnowstorm
        ? 0xc9d5dc
        : isSchwellenraum
          ? SCHWELLENRAUM_SKY_COLOR
          : 0xdcf3f9;
  runtime.scene.background = new Color(sky);
  // No fog in the drawn modes ("verschwindet alles in einem Nebel …
  // das will ich überhaupt nicht"): the ivory model stays crisp to the
  // horizon. Only Minecraft keeps its genre haze.
  const fogRange = presentationFogRange(mode, runtime.underside);
  runtime.scene.fog = fogRange
    ? new Fog(sky, fogRange.near, fogRange.far)
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
    isMoonlit
      ? 0x4a6690
      : isNight
        ? 0x5877a4
        : isMinecraft
          ? 0xeef9ff
          : isSnowstorm
            ? 0xe7eef1
            : 0xffffff,
  );
  // Day's hemisphere ground half is nearly as bright as its sky half. A
  // HemisphereLight weights a VERTICAL face at the midpoint of the two, so
  // the old dark 0x8e9589 half was what dropped every lit landmark wall to
  // a mid grey while the unlit prisms beside it stayed ivory. Two different
  // brightness worlds in one drawing; now they agree.
  runtime.hemisphere.groundColor.setHex(
    isMoonlit
      ? 0x050b12
      : isNight
        ? 0x08120f
        : isMinecraft
          ? 0x8ea084
          : isSnowstorm
            ? 0xc8d1d4
            : 0xe4e6e0,
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
  runtime.hemisphere.intensity = isMoonlit
    ? 0.4
    : isNight
      ? 0.52
      : isMinecraft
        ? 2.05
        : isSnowstorm
          ? 2.45
          : 2.75;
  // A near-white key: the old amber 0xffdda3 crushed the blue channel of
  // every cream facade and turned the Chancellery lemon-yellow. Moonlight
  // pushes the key further into cool silver-blue — authored colour, not a
  // curve — consistent with a single distant moon instead of city glow.
  runtime.sun.color.setHex(
    isMoonlit
      ? 0xaecbef
      : isNight
        ? 0x91b9ed
        : isMinecraft
          ? 0xfffaf0
          : isSnowstorm
            ? 0xdce8ed
            : 0xfff8ea,
  );
  // Day's key is deliberately gentle. With the ambient half carrying the
  // brightness, the sun only has to supply the direction of the light —
  // the same job `isoFaceShade` does for the unlit prisms. A strong key
  // would reintroduce the blob shadows the owner rejected.
  runtime.sun.intensity = isMoonlit
    ? 0.62
    : isNight
      ? 0.85
      : isMinecraft
        ? 2.2
        : isSnowstorm
          ? 0.24
          : 0.62;
  runtime.skyFill.color.setHex(
    isMoonlit
      ? 0x53699a
      : isNight
        ? 0x6c82ae
        : isMinecraft
          ? 0x9fd8f2
          : isSnowstorm
            ? 0xb9ced8
            : 0xb6dcff,
  );
  runtime.skyFill.intensity = isMoonlit
    ? 0.16
    : isNight
      ? 0.2
      : isMinecraft
        ? 0.5
        : isSnowstorm
          ? 0.28
          : 0.12;
  runtime.sun.position.set(
    isMinecraft ? 760 : -760,
    980,
    isMinecraft ? -720 : 720,
  );
  for (const material of runtime.modelMaterials) {
    applyMaterialLighting(material, mode, lightsOn);
  }
  applyLightingToRoot(runtime.signatures, mode, lightsOn);
  // The Quadriga carries its own three palettes in one geometry (day,
  // night and the winter set the snow mode will use), so it is switched
  // by repainting vertices rather than by relighting a material. Voxel
  // mode keeps the flat day paint: the block world has its own look and
  // the toon pass leaves an unlit material alone anyway.
  const quadriga = runtime.signatures.getObjectByName("Quadriga mit Victoria");
  if (quadriga instanceof Group) {
    setQuadrigaMode(
      quadriga,
      isNight ? "night" : isSnowstorm ? "winter" : "day",
    );
  }
  applyLightingToRoot(runtime.centralDetails, mode, lightsOn);
  applyLightingToRoot(runtime.civicDetails, mode, lightsOn);
  applyLightingToRoot(runtime.monuments, mode, lightsOn);
  applyLightingToRoot(runtime.schwellenraumInteriors, mode, lightsOn);
  applyLightingToRoot(runtime.culturalDetails, mode, lightsOn);
  applyLightingToRoot(runtime.parkDetails, mode, lightsOn);
  applyLightingToRoot(runtime.cityStaffage, mode, lightsOn);
  applyLightingToRoot(runtime.tramCatenary, mode, lightsOn);
  setUndergroundPresentation(runtime.undergroundNetwork, mode);
  setParkSnowPresentation(runtime.parkDetails, isSnowstorm);
  setQueerRainbowMemorialSnow(runtime.monuments, isSnowstorm);
  setCsdAttackMemorialSnow(runtime.monuments, isSnowstorm);
  setInvalidenfriedhofSnow(runtime.culturalDetails, isSnowstorm);
  setStarbucksPariserPlatzSnow(runtime.culturalDetails, isSnowstorm);
  setBerlinerEnsemblePublicArtSnow(runtime.centralDetails, isSnowstorm);
  // Cloth uses one continuous low-frequency clock across mode changes. Do not
  // rewrite it to a start pose here: the next cadence tick must continue from
  // the visible pose rather than jumping Day -> Night/Snow/Minecraft.
  if (enteringSchwellenraum) {
    runtime.schwellenraumWaterElapsedSeconds =
      SCHWELLENRAUM_WATER_INITIAL_TIME_SECONDS;
    runtime.schwellenraumLastWaterFrameAt = 0;
  }
  refreshSchwellenraumMovingFlagCount(runtime);
  if (runtime.trafficSignals) {
    updateTrafficSignals(
      runtime.trafficSignals,
      0,
      false,
      mode !== "night" || lightsOn,
    );
  }
  if (isMinecraft) {
    const completedVoxelMode = voxelModeActive(runtime);
    if (completedVoxelMode) {
      // Park details can finish before the voxel payload. Release any toon
      // fallback bindings they acquired while Minecraft was pending, then
      // skip that hidden, high-cardinality root during the scene traversal.
      releaseMinecraftMaterialBindings(
        runtime.parkDetails,
        runtime.minecraftMaterialState,
      );
      for (const child of runtime.scene.children) {
        if (child !== runtime.parkDetails) {
          setMinecraftMaterialPresentation(
            child,
            runtime.minecraftMaterialState,
            true,
          );
        }
      }
    } else {
      setMinecraftMaterialPresentation(
        runtime.scene,
        runtime.minecraftMaterialState,
        true,
      );
    }
    if (runtime.underside) {
      // Keep the contextual underside shell photographic and quiet. Toon
      // shading on its double-sided 13% surfaces reads as metallic shards.
      setMinecraftMaterialPresentation(
        runtime.interactionSurface,
        runtime.minecraftMaterialState,
        false,
      );
      setMinecraftMaterialPresentation(
        runtime.settledSurface,
        runtime.minecraftMaterialState,
        false,
      );
    }
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
  setTunnelPortalPresentation(
    runtime.tunnelPortals,
    runtime.underside,
    voxelMode,
    runtime.pedestrian.state?.insideTunnel === true ||
      runtime.cameraInsideTunnel,
  );
  // Drawn recognition models complement the prisms. Minecraft keeps the
  // non-building signatures, but the hero architecture below has dedicated
  // block-native replacements inside the voxel world.
  const recognitionVisible = !runtime.underside && !voxelMode;
  runtime.signatures.visible = !runtime.underside;
  runtime.centralDetails.visible = centralCivicDetailsVisible(
    runtime.underside,
  );
  runtime.cityStaffage.visible = !runtime.underside;
  setMinecraftArchitecturePresentation(
    runtime.signatures,
    runtime.centralDetails,
    voxelMode,
  );
  for (const signature of runtime.signatures.children) {
    if (
      signature.name ===
      "Measured MEININGER Hotel Hauptbahnhof recognition model"
    ) {
      signature.visible = !isMinecraft;
    }
  }
  runtime.civicDetails.visible = civicDetailsVisible(runtime.underside);
  applyMinecraftVisibility(minecraftVisibilityRoots(runtime), voxelMode);
  // Visibility restoration must happen first. Otherwise a Minecraft-saved
  // `false` can overwrite the re-enabled winter batch on Minecraft -> Snow.
  setWindFlagWinterPresentation(runtime.signatures, isSnowstorm);
  setWindFlagWinterPresentation(runtime.civicDetails, isSnowstorm);
  runtime.monuments.visible = !runtime.underside;
  setTiergartenLiteraryMemorialSmoothVisibility(
    runtime.monuments,
    !voxelMode,
  );
  setTiergartenLiteraryMemorialsSnow(runtime.monuments, isSnowstorm);
  runtime.culturalDetails.visible = recognitionVisible;
  runtime.parkDetails.visible = recognitionVisible;
  for (const detail of runtime.detailGroups.values()) {
    detail.group.visible = recognitionVisible && !isoMode;
  }
  // Both drawn worlds (prisms and voxels) use the flat isometric FOV;
  // only the photographic fallback keeps the 39° perspective.
  const targetFov = runtime.pedestrian.enabled
    ? PEDESTRIAN_FOV_DEGREES
    : (runtime.focusedCameraFov ??
      (isoMode || voxelMode ? ISO_FOV_DEGREES : PHOTO_FOV_DEGREES));
  if (runtime.camera.fov !== targetFov) {
    // Dolly-zoom: pull the camera back exactly as much as the narrower
    // FOV magnifies, so the framing survives the projection change.
    const scale = fovDollyScale(runtime.camera.fov, targetFov);
    const offset = runtime.camera.position
      .clone()
      .sub(runtime.controls.target)
      .multiplyScalar(scale);
    runtime.controls.maxDistance =
      2600 * fovDollyScale(PHOTO_FOV_DEGREES, targetFov);
    runtime.controls.minDistance = CAMERA_TARGET_CROSSING_MIN_M;
    runtime.camera.position.copy(runtime.controls.target).add(offset);
    runtime.camera.far = 16_000;
    runtime.camera.fov = targetFov;
    runtime.camera.updateProjectionMatrix();
  }
  if (runtime.isoWorld) {
    setIsoNightPresentation(runtime.isoWorld, isNight, lightsOn, mode);
  }
  if (runtime.underwater) {
    runtime.underwater = false;
    setUnderwaterPresentation(runtime, true);
  }
  setEnvironmentalPresentation(runtime);
}

function voxelModeActive(runtime: Runtime): boolean {
  return runtime.lightingMode === "minecraft" && runtime.voxelWorld !== null;
}

function setTiergartenLiteraryMemorialSmoothVisibility(
  root: Object3D | null,
  visible: boolean,
): void {
  if (!root) return;
  for (const profile of [
    TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe,
    TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing,
  ]) {
    const memorial = root.getObjectByName(profile.name);
    if (memorial?.userData.tiergartenLiteraryMemorialSmooth === true) {
      memorial.visible = visible;
    }
  }
}

function voxelWorldIntentActive(runtime: Runtime): boolean {
  return runtime.lightingMode === "minecraft";
}

function isoWorldIntentActive(runtime: Runtime): boolean {
  return runtime.lightingMode !== "minecraft";
}

type MutableRootSnapshot = {
  children: Map<
    Object3D,
    { userData: Record<string, unknown>; visible: boolean }
  >;
  root: Group;
  userData: Record<string, unknown>;
  visible: boolean;
};

type PedestrianAttachmentSnapshot = {
  cameraDirty: boolean;
  cameraFar: number;
  cameraFov: number;
  cameraNear: number;
  cameraPosition: Vector3;
  cameraTarget: Vector3;
  controlsEnabled: boolean;
  controlsMaxDistance: number;
  controlsMinDistance: number;
  enabled: boolean;
  environment: PedestrianEnvironment | null;
  markerVisible: boolean;
  requested: boolean;
  savedFov: number;
  savedNear: number;
  savedPose: CameraPose | null;
  savedUnderside: boolean;
  state: PedestrianState | null;
  tunnelPortalInteriorVisible: boolean;
  underside: boolean;
};

type ProgressiveWorldSnapshot = {
  batches: Group[];
  input: ProgressiveWorldWorkerInput | undefined;
  state: ProgressiveWorldState;
  worker: Worker | undefined;
};

function captureMutableRootSnapshots(roots: Group[]): MutableRootSnapshot[] {
  return roots.map((root) => ({
    children: new Map(
      root.children.map((child) => [
        child,
        { userData: { ...child.userData }, visible: child.visible },
      ]),
    ),
    root,
    userData: { ...root.userData },
    visible: root.visible,
  }));
}

function rollbackMutableRoots(
  runtime: Runtime,
  snapshots: MutableRootSnapshot[],
): void {
  for (const snapshot of snapshots) {
    for (const child of [...snapshot.root.children]) {
      if (!snapshot.children.has(child)) {
        disposeObject3D(runtime, child);
      }
    }
    snapshot.root.userData = { ...snapshot.userData };
    snapshot.root.visible = snapshot.visible;
    for (const [child, state] of snapshot.children) {
      child.userData = { ...state.userData };
      child.visible = state.visible;
    }
  }
}

function capturePedestrianAttachment(
  runtime: Runtime,
): PedestrianAttachmentSnapshot {
  return {
    cameraDirty: runtime.pedestrian.cameraDirty,
    cameraFar: runtime.camera.far,
    cameraFov: runtime.camera.fov,
    cameraNear: runtime.camera.near,
    cameraPosition: runtime.camera.position.clone(),
    cameraTarget: runtime.controls.target.clone(),
    controlsEnabled: runtime.controls.enabled,
    controlsMaxDistance: runtime.controls.maxDistance,
    controlsMinDistance: runtime.controls.minDistance,
    enabled: runtime.pedestrian.enabled,
    environment: runtime.pedestrian.environment,
    markerVisible: runtime.marker.visible,
    requested: runtime.pedestrian.requested,
    savedFov: runtime.pedestrian.savedFov,
    savedNear: runtime.pedestrian.savedNear,
    savedPose: runtime.pedestrian.savedPose,
    savedUnderside: runtime.pedestrian.savedUnderside,
    state: runtime.pedestrian.state,
    tunnelPortalInteriorVisible: runtime.tunnelPortalInteriorVisible,
    underside: runtime.underside,
  };
}

function restorePedestrianAttachment(
  runtime: Runtime,
  snapshot: PedestrianAttachmentSnapshot,
): void {
  runtime.pedestrian.cameraDirty = snapshot.cameraDirty;
  runtime.pedestrian.enabled = snapshot.enabled;
  runtime.pedestrian.environment = snapshot.environment;
  // Rollback never revokes the visitor's walking-mode request. If no prior
  // environment existed this coherently returns to requested-but-pending.
  runtime.pedestrian.requested = snapshot.requested;
  runtime.pedestrian.savedFov = snapshot.savedFov;
  runtime.pedestrian.savedNear = snapshot.savedNear;
  runtime.pedestrian.savedPose = snapshot.savedPose;
  runtime.pedestrian.savedUnderside = snapshot.savedUnderside;
  runtime.pedestrian.state = snapshot.state;
  runtime.camera.position.copy(snapshot.cameraPosition);
  runtime.controls.target.copy(snapshot.cameraTarget);
  runtime.camera.far = snapshot.cameraFar;
  runtime.camera.fov = snapshot.cameraFov;
  runtime.camera.near = snapshot.cameraNear;
  runtime.camera.updateProjectionMatrix();
  runtime.controls.enabled = snapshot.controlsEnabled;
  runtime.controls.maxDistance = snapshot.controlsMaxDistance;
  runtime.controls.minDistance = snapshot.controlsMinDistance;
  runtime.controls.update();
  runtime.marker.visible = snapshot.markerVisible;
  runtime.tunnelPortalInteriorVisible = snapshot.tunnelPortalInteriorVisible;
  runtime.underside = snapshot.underside;
  runtime.renderInvalidated = true;
}

function captureProgressiveWorld(runtime: Runtime): ProgressiveWorldSnapshot {
  return {
    batches: [...runtime.progressiveWorldBatches],
    input: runtime.progressiveWorldInput,
    state: runtime.progressiveWorldState,
    worker: runtime.progressiveWorldWorker,
  };
}

function restoreProgressiveWorld(
  runtime: Runtime,
  snapshot: ProgressiveWorldSnapshot,
): void {
  cancelScheduledProgressiveWorld(runtime);
  if (
    runtime.progressiveWorldWorker &&
    runtime.progressiveWorldWorker !== snapshot.worker
  ) {
    runtime.progressiveWorldWorker.terminate();
  }
  const retained = new Set(snapshot.batches);
  for (const batch of [...runtime.progressiveWorldBatches]) {
    if (!retained.has(batch)) {
      disposeObject3D(runtime, batch);
    }
  }
  runtime.progressiveWorldBatches = [...snapshot.batches];
  runtime.progressiveWorldWorker = snapshot.worker;
  runtime.progressiveWorldState = snapshot.state;
  if (snapshot.input) {
    runtime.progressiveWorldInput = snapshot.input;
  } else {
    delete runtime.progressiveWorldInput;
  }
}

function restoreWorldPresentationAfterRollback(
  runtime: Runtime,
  underside: boolean,
): void {
  try {
    setModelMaterialState(runtime, underside);
    setSceneLighting(runtime, runtime.lightingMode, runtime.nightLightsOn);
  } catch (error: unknown) {
    if (import.meta.env.DEV) {
      console.error("Failed to restore world presentation after rollback", error);
    }
  }
}

/**
 * The drawn isometric city replaces the photogrammetry in DAY and NIGHT
 * mode once its LoD2-prism payload has loaded (night simply relights the
 * same drawn prisms and brightens the ink). Minecraft owns the voxel
 * world.
 */
function isoModeActive(runtime: Runtime): boolean {
  return (
    (runtime.lightingMode === "day" ||
      runtime.lightingMode === "night" ||
      runtime.lightingMode === "snowstorm" ||
      runtime.lightingMode === "schwellenraum") &&
    runtime.isoWorld !== null
  );
}

/**
 * Load and attach the drawn isometric city (LoD2 prisms + shared ground
 * slabs). Idempotent; on failure the photographic day pipeline stays.
 */
// Payloads are fetched and parsed exactly once per session. Drawn modes use a
// compact ground-only sibling; Minecraft's building/tree instances stay lazy.
function fetchPrismPayload(runtime: Runtime): Promise<PrismPayload> {
  runtime.prismPayloadPromise ??= fetchJsonWithRetry<PrismPayload>(
    new URL(PRISM_WORLD_FILE, runtime.sceneRootUrl),
    { signal: runtime.loadSignal },
  ).catch((error: unknown) => {
    runtime.prismPayloadPromise = undefined;
    throw error;
  });
  return runtime.prismPayloadPromise;
}

function fetchGroundPayload(runtime: Runtime): Promise<VoxelPayload> {
  runtime.groundPayloadPromise ??= fetchJsonWithRetry<VoxelPayload>(
    new URL(GROUND_CONTEXT_FILE, runtime.sceneRootUrl),
    { signal: runtime.loadSignal },
  ).catch((error: unknown) => {
    runtime.groundPayloadPromise = undefined;
    throw error;
  });
  return runtime.groundPayloadPromise;
}

function fetchStreetPayload(runtime: Runtime): Promise<StreetDetailsPayload> {
  runtime.streetPayloadPromise ??= fetchJsonWithRetry<StreetDetailsPayload>(
    new URL(STREET_DETAILS_FILE, runtime.sceneRootUrl),
    { signal: runtime.loadSignal },
  ).catch((error: unknown) => {
    runtime.streetPayloadPromise = undefined;
    throw error;
  });
  return runtime.streetPayloadPromise;
}

function fetchSurfacePayload(runtime: Runtime): Promise<SurfacePayload> {
  runtime.surfacePayloadPromise ??= fetchJsonWithRetry<SurfacePayload>(
    new URL(SURFACE_WORLD_FILE, runtime.sceneRootUrl),
    { signal: runtime.loadSignal },
  ).catch((error: unknown) => {
    runtime.surfacePayloadPromise = undefined;
    throw error;
  });
  return runtime.surfacePayloadPromise;
}

function fetchRailPayload(runtime: Runtime): Promise<RailPayload> {
  runtime.railPayloadPromise ??= fetchJsonWithRetry<RailPayload>(
    new URL(RAIL_LINES_FILE, runtime.sceneRootUrl),
    { signal: runtime.loadSignal },
  ).catch((error: unknown) => {
    runtime.railPayloadPromise = undefined;
    throw error;
  });
  return runtime.railPayloadPromise;
}

function fetchVoxelPayload(runtime: Runtime): Promise<VoxelPayload> {
  runtime.voxelPayloadPromise ??= fetchJsonWithRetry<VoxelPayload>(
    new URL(VOXEL_WORLD_FILE, runtime.sceneRootUrl),
    { signal: runtime.loadSignal },
  ).catch((error: unknown) => {
    runtime.voxelPayloadPromise = undefined;
    throw error;
  });
  return runtime.voxelPayloadPromise;
}

/**
 * Start the immutable payload transfers while the small scene manifest and
 * authored recognition geometry are being prepared. Construction still waits
 * for the manifest's tunnel course; only network and JSON parsing move
 * earlier. Failed speculative requests are swallowed here and retried through
 * the ordinary finite-retry path when the requested world is attached.
 */
function primeRequestedWorldPayloads(
  runtime: Runtime,
  mode: LightingMode,
): void {
  const requests =
    mode === "minecraft"
      ? [fetchVoxelPayload(runtime), fetchPrismPayload(runtime)]
      : [
          fetchPrismPayload(runtime),
          fetchGroundPayload(runtime),
          fetchStreetPayload(runtime),
          fetchSurfacePayload(runtime),
          fetchRailPayload(runtime),
        ];
  for (const request of requests) {
    void request.catch(() => undefined);
  }
}

const PROGRESSIVE_WORLD_WARNING =
  "Die verfeinerte Stadtgeometrie konnte nicht vollständig ergänzt werden; der bereits geladene exakte Nahbereich bleibt bedienbar.";

function failProgressiveWorld(
  runtime: Runtime,
  worker: Worker,
  warn: (message: string) => void,
): void {
  if (worker !== runtime.progressiveWorldWorker) return;
  worker.terminate();
  runtime.progressiveWorldWorker = undefined;
  runtime.progressiveWorldState = progressiveWorldStopPolicy("error").nextState;
  // Successfully attached exact batches stay visible. They are now owned by
  // isoWorld and will be disposed with it; only the restart bookkeeping ends.
  runtime.progressiveWorldBatches = [];
  runtime.renderInvalidated = true;
  if (runtime.coarsePointer) runtime.startDeferredDetails();
  warn(PROGRESSIVE_WORLD_WARNING);
}

function markProgressiveWorldUnavailable(
  runtime: Runtime,
  warn: (message: string) => void,
): void {
  runtime.progressiveWorldWorker = undefined;
  runtime.progressiveWorldState = progressiveWorldStopPolicy("error").nextState;
  runtime.renderInvalidated = true;
  if (runtime.coarsePointer) runtime.startDeferredDetails();
  warn(PROGRESSIVE_WORLD_WARNING);
}

function cancelScheduledProgressiveWorld(runtime: Runtime): void {
  runtime.progressiveWorldStartCancel?.();
  runtime.progressiveWorldStartCancel = undefined;
}

function stopProgressiveWorld(runtime: Runtime): void {
  cancelScheduledProgressiveWorld(runtime);
  runtime.progressiveWorldWorker?.terminate();
  runtime.progressiveWorldWorker = undefined;
  runtime.progressiveWorldState = progressiveWorldStopPolicy("pause").nextState;
  releaseProgressiveWorldBatches(
    runtime.progressiveWorldBatches,
    (batch) => disposeObject3D(runtime, batch),
  );
  collectFarZoomAntiFlickerTargets(runtime);
  runtime.renderInvalidated = true;
}

function startProgressiveWorld(
  runtime: Runtime,
  warn: (message: string) => void,
): void {
  const input = runtime.progressiveWorldInput;
  if (
    runtime.disposed ||
    document.hidden ||
    !isoWorldIntentActive(runtime) ||
    !input ||
    runtime.progressiveWorldState !== "idle"
  ) {
    return;
  }
  const construction = tryProgressiveWorkerOperation(
    () =>
      new Worker(new URL("./progressiveWorld.worker.ts", import.meta.url), {
        name: "isometric-progressive-world",
        type: "module",
      }),
  );
  if (!construction.ok) {
    markProgressiveWorldUnavailable(runtime, warn);
    return;
  }
  const worker = construction.value;
  runtime.progressiveWorldWorker = worker;
  runtime.progressiveWorldState = "loading";
  worker.onmessage = (
    event: MessageEvent<ProgressiveWorldWorkerOutput>,
  ): void => {
    if (runtime.disposed || worker !== runtime.progressiveWorldWorker) return;
    if (document.hidden) {
      stopProgressiveWorld(runtime);
      return;
    }
    const message = event.data;
    if (message.type === "batch") {
      let object: Object3D;
      try {
        object = deserializeTransferredObject3D(message.object);
      } catch {
        failProgressiveWorld(runtime, worker, warn);
        return;
      }
      if (!(object instanceof Group) || !runtime.isoWorld) {
        disposeObject3D(runtime, object);
        failProgressiveWorld(runtime, worker, warn);
        return;
      }
      // Materialise against the mode active at ATTACH time. Day ↔ Night ↔
      // Snow ↔ Schwellenraum changes therefore never flash a stale batch.
      setIsoNightPresentation(
        object,
        runtime.lightingMode === "night",
        runtime.nightLightsOn,
        runtime.lightingMode,
      );
      object.userData.progressiveWorldBatch = true;
      runtime.progressiveWorldBatches.push(object);
      runtime.isoWorld.add(object);
      registerBerlinerEnsembleRoofSignTargets(runtime, object);
      // Water is commonly the first exact progressive surface batch. Install
      // the light-only Schwellenraum veil in the same task, before any frame
      // can expose an uninitialised or day-bright overlay.
      setEnvironmentalPresentation(runtime);
      runtime.renderInvalidated = true;
      return;
    }
    if (message.type === "error") {
      failProgressiveWorld(runtime, worker, warn);
      return;
    }
    worker.terminate();
    runtime.progressiveWorldWorker = undefined;
    runtime.progressiveWorldState =
      progressiveWorldStopPolicy("complete").nextState;
    collectFarZoomAntiFlickerTargets(runtime);
    runtime.renderInvalidated = true;
    performance.mark("isometric-city-exact-ready");
    if (runtime.coarsePointer) runtime.startDeferredDetails();
  };
  worker.onerror = (): void => {
    failProgressiveWorld(runtime, worker, warn);
  };
  const posted = tryProgressiveWorkerOperation(() => worker.postMessage(input));
  if (!posted.ok) failProgressiveWorld(runtime, worker, warn);
}

/**
 * Let the committed mobile preview paint and release constructor temporaries
 * before another realm starts building exact batches. The input stays owned
 * by Runtime; this scheduler never clones the multi-megabyte payloads.
 */
function scheduleProgressiveWorld(
  runtime: Runtime,
  warn: (message: string) => void,
): void {
  if (
    runtime.disposed ||
    document.hidden ||
    !isoWorldIntentActive(runtime) ||
    !runtime.progressiveWorldInput ||
    runtime.progressiveWorldState !== "idle" ||
    runtime.progressiveWorldStartCancel
  ) {
    return;
  }
  let cancelled = false;
  let cancelScheduled = (): void => undefined;
  const start = (): void => {
    if (cancelled) return;
    if (runtime.progressiveWorldStartCancel === cancelScheduled) {
      runtime.progressiveWorldStartCancel = undefined;
    }
    startProgressiveWorld(runtime, warn);
  };
  const requestIdle = (
    window as unknown as {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    }
  ).requestIdleCallback;
  if (typeof requestIdle === "function") {
    const handle = requestIdle(start, { timeout: 1_500 });
    cancelScheduled = () => {
      cancelled = true;
      (
        window as unknown as {
          cancelIdleCallback?: (handle: number) => void;
        }
      ).cancelIdleCallback?.(handle);
    };
  } else {
    const handle = window.setTimeout(start, 120);
    cancelScheduled = () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }
  runtime.progressiveWorldStartCancel = cancelScheduled;
}

function applyProgressiveWorldMode(
  runtime: Runtime,
  mode: LightingMode,
  warn: (message: string) => void,
): void {
  const transition = progressiveWorldTransition(
    mode,
    runtime.progressiveWorldState,
  );
  if (transition === "resume") {
    if (runtime.coarsePointer) {
      scheduleProgressiveWorld(runtime, warn);
    } else {
      startProgressiveWorld(runtime, warn);
    }
    return;
  }
  if (transition === "pause") {
    stopProgressiveWorld(runtime);
  } else if (mode === "minecraft") {
    cancelScheduledProgressiveWorld(runtime);
  }
}

function ensureIsoWorld(
  runtime: Runtime,
  warn: (message: string) => void,
): void {
  if (runtime.isoWorldState !== "idle") {
    return;
  }
  runtime.isoWorldState = "loading";
  const totalParts = 6;
  let loadedParts = 0;
  runtime.reportCoreProgress(0, totalParts);
  const tracked = async <T,>(task: Promise<T>): Promise<T> => {
    try {
      return await task;
    } finally {
      loadedParts += 1;
      runtime.reportCoreProgress(loadedParts, totalParts);
    }
  };
  let provisionalIsoWorld: Group | null = null;
  let provisionalPedestrianEnvironment: PedestrianEnvironment | null = null;
  let mutableRootSnapshots: MutableRootSnapshot[] | null = null;
  let pedestrianSnapshot: PedestrianAttachmentSnapshot | null = null;
  let progressiveSnapshot: ProgressiveWorldSnapshot | null = null;
  let originalIsoWorld: Group | null = null;
  let originalTrafficSignals: Group | null | undefined;
  void Promise.all([
    tracked(fetchPrismPayload(runtime)),
    tracked(fetchGroundPayload(runtime)).catch(() => null),
    tracked(fetchStreetPayload(runtime)).catch(() => null),
    tracked(fetchSurfacePayload(runtime)).catch(() => null),
    tracked(fetchRailPayload(runtime)).catch(() => null),
  ])
    .then(([prisms, ground, street, surfaces, rail]) => {
      if (runtime.disposed) {
        return;
      }
      // Day can be left while the shared payloads are still in flight. The
      // fulfilled promises stay cached, but Minecraft must not pay the smooth
      // city's construction/worker peak for a world it will keep hidden.
      if (!isoWorldIntentActive(runtime)) {
        runtime.isoWorldState = "idle";
        return;
      }
      mutableRootSnapshots = captureMutableRootSnapshots([
        runtime.signatures,
        runtime.cityStaffage,
        runtime.undergroundNetwork,
        runtime.tramCatenary,
        runtime.schwellenraumPraesentation,
      ]);
      pedestrianSnapshot = capturePedestrianAttachment(runtime);
      progressiveSnapshot = captureProgressiveWorld(runtime);
      originalIsoWorld = runtime.isoWorld;
      originalTrafficSignals = runtime.trafficSignals;
      const memorialProtection =
        createSchwellenraumMemorialProtectionIndex(street?.monuments);
      if (ground && surfaces) {
        const pedestrianEnvironment = createPedestrianEnvironment(
          ground,
          surfaces,
          runtime.tunnelPortalCourse,
          prisms,
        );
        provisionalPedestrianEnvironment = pedestrianEnvironment;
        const ardRoofCollision =
          createArdHauptstadtstudioRoofCollision(prisms);
        const historicParkBridgeCollision =
          createHistoricParkBridgeCollision(ground);
        const staticPropSolidAt = createSchwellenraumStaticPropCollision(
          pedestrianEnvironment.groundAt,
          memorialProtection,
        );
        pedestrianEnvironment.walkableInteriorAt = (x, y, z, sourceId) => {
          return visualModeWalkableInteriorAt(
            runtime.lightingMode,
            x,
            y,
            z,
            sourceId,
          );
        };
        pedestrianEnvironment.protectedVolumeAt = (x, y, z) =>
          runtime.lightingMode === "schwellenraum" &&
          (schwellenraumProtectedAt(x, y, z) ||
            schwellenraumProtectedMemorialAt(memorialProtection, x, y, z));
        pedestrianEnvironment.interiorSolidAt = (x, y, z, radius) => {
          if (
            csdAttackMemorialSolidAt(x, y, z, radius) ||
            berlinerEnsemblePublicArtSolidAt(x, y, z, radius) ||
            tiergartenLiteraryMemorialSolidAt(x, y, z, radius) ||
            invalidenfriedhofPedestrianSolidAt(x, y, z, radius)
          ) {
            return true;
          }
          if (runtime.lightingMode === "schwellenraum") {
            return (
              schwellenraumInteriorSolidAt(x, y, z, radius) ||
              staticPropSolidAt(x, y, z, radius) ||
              federalStateRepresentationSolidAt(x, y, z, radius) ||
              reichstagspraesidentenpalaisDetailSolidAt(x, y, z, radius) ||
              historicParkBridgeCollision.solidAt(x, y, z, radius) ||
              ardRoofCollision?.solidAt(x, y, z, radius) === true
            );
          }
          return (
            minecraftHeroCollisionEnabled(runtime.lightingMode) &&
            minecraftHeroSolidAt(x, y, z, radius)
          );
        };
        pedestrianEnvironment.interiorGroundAt = (x, z, currentGroundY) => {
          if (minecraftHeroCollisionEnabled(runtime.lightingMode)) {
            return minecraftHeroGroundAt(x, z);
          }
          if (runtime.lightingMode !== "schwellenraum") {
            return null;
          }
          const hint = Number.isFinite(currentGroundY)
            ? currentGroundY!
            : (pedestrianEnvironment.groundAt(x, z) ?? 0);
          return schwellenraumInteriorGroundAt(x, z, hint);
        };
        installSchwellenraumStaticProps(
          runtime.schwellenraumPraesentation,
          pedestrianEnvironment.groundAt,
        );
        const terrainSample = smoothGroundTopSampler(ground);
        installUnterDenLindenMedianRefinement(
          runtime.schwellenraumPraesentation,
          surfaces,
          (x, z) =>
            terrainSample(
              x / ground.cell_m - ground.grid.min_x_idx,
              z / ground.cell_m - ground.grid.min_z_idx,
            ),
        );
      }
      const initialBuildingCount = runtime.coarsePointer
        ? MOBILE_INITIAL_BUILDING_COUNT
        : DESKTOP_INITIAL_BUILDING_COUNT;
      const buildingPartition = splitProgressiveBuildings(
        prisms.buildings,
        initialBuildingCount,
        undefined,
        runtime.coarsePointer
          ? MOBILE_TOTAL_BUILDING_LIMIT
          : Number.POSITIVE_INFINITY,
      );
      const initialBuildings = buildingPartition.initial;
      const mobileWorkerBuildings = runtime.coarsePointer
        ? buildingPartition.remaining.flat()
        : [];
      const progressiveInput: ProgressiveWorldWorkerInput | null =
        runtime.coarsePointer
          ? mobileWorkerBuildings.length > 0
            ? {
                detailProfile: "mobile",
                initialBuildingCount: 0,
                prismPayload: {
                  ...prisms,
                  buildings: mobileWorkerBuildings,
                },
                type: "build",
              }
            : null
          : ground && surfaces
            ? {
                ground,
                detailProfile: "full",
                initialBuildingCount,
                prismPayload: prisms,
                sceneRootUrl: runtime.sceneRootUrl.toString(),
                surfaces,
                tunnel: runtime.tunnelPortalCourse,
                type: "build",
              }
            : null;
      const isoWorld = createIsometricCity(
        prisms,
        ground,
        runtime.tunnelPortalCourse,
        surfaces,
        {
          buildings: initialBuildings,
          retainRasterAsphalt: runtime.coarsePointer,
          retainRasterWater: runtime.coarsePointer,
          smoothSurfaces:
            runtime.coarsePointer || progressiveInput ? null : undefined,
        },
      );
      provisionalIsoWorld = isoWorld;
      // Metric bridge profiles are recognition geometry, not a soft surface
      // layer. Keep them beside the hero signatures so Golda-Meir, Moltke,
      // Gustav-Heinemann and Sandkrug retain their real proportions in the
      // block mode as well as in Day/Night/Snow/Schwellenraum.
      const bridges = isoWorld.getObjectByName(
        "drawn bridge structures",
      );
      if (bridges) {
        runtime.signatures.add(bridges);
      }
      if (ground && street) {
        // Task 07: the real OSM traffic signals join the drawn city, so
        // they inherit its day/night/voxel/underside visibility.
        const signals = createTrafficSignals(street, ground);
        if (signals) {
          isoWorld.add(signals);
          runtime.trafficSignals = signals;
          updateTrafficSignals(
            signals,
            0,
            false,
            runtime.lightingMode !== "night" || runtime.nightLightsOn,
          );
        }
        // Every OSM monument in the quarter, drawn ("alle Denkmäler").
        const monuments = createTiergartenMonuments(street, ground);
        if (monuments) {
          isoWorld.add(monuments);
        }
        // The quarter's three filling stations, canopy and all.
        const fuel = createFuelStations(street, ground);
        if (fuel) {
          isoWorld.add(fuel);
        }
        // Capital Beach on the Ludwig-Erhard-Ufer and the beer gardens.
        const venues = createRiversideVenues(street, ground);
        if (venues) {
          isoWorld.add(venues);
        }
      }
      if (ground) {
        // Two source-bound Berlin passenger-vessel envelopes on committed OSM
        // waterway axes. Their positions are explicit static display
        // compositions, not live vessel observations or AIS tracks.
        isoWorld.add(createVessels(ground.water_top_y_m ?? undefined));
        // The 2026 interim seat of the Bundespräsidialamt, too new for LoD2.
        // Like the surveyed bridge signatures it remains visible in Minecraft,
        // where the old LoD2/voxel mass cannot represent its new bent outline.
        const office = createSpreebogenOffice(ground);
        if (office) {
          runtime.signatures.add(office);
        }
        const spreebogenPark = createSpreebogenPark(ground);
        markAuthoredFlatUnlit(spreebogenPark);
        runtime.signatures.add(spreebogenPark);
        applyLightingToRoot(
          spreebogenPark,
          runtime.lightingMode,
          runtime.nightLightsOn,
        );
        if (runtime.lightingMode === "minecraft") {
          setMinecraftMaterialPresentation(
            spreebogenPark,
            runtime.minecraftMaterialState,
            true,
          );
        }
        // Current OSM footprints and the installed South Bridge define the
        // western Kanzlerpark extension; temporary site detail stays labelled.
        const extension = createChancelleryExtension(ground);
        if (extension) {
          markAuthoredFlatUnlit(extension);
          runtime.signatures.add(extension);
        }
        // The hotel's exact LoD2 shell is suppressed from the generic prism
        // batch and rebuilt with its current OSM ten-storey facade plus the
        // owner-photographed entrance. Minecraft retains the source voxels.
        const meininger = createMeiningerHotel(ground);
        markAuthoredFlatUnlit(meininger);
        runtime.signatures.add(meininger);
        // Source-audited micro-architecture for the wider presentation radius:
        // landmark facades, Tiergarten bridges/memorials and exact mapped shop
        // fronts. The four merged batches stay visible in all surface modes;
        // Minecraft applies its own material presentation below.
        const refinements = createCityRecognitionRefinements(ground);
        markAuthoredFlatUnlit(refinements);
        runtime.signatures.add(refinements);
        const staffage = createCityStaffage(ground);
        if (staffage) {
          runtime.cityStaffage.add(staffage);
        }
      }
      if (ground && rail) {
        // The Stadtbahn viaduct carries the tracks off both ends of the
        // Hauptbahnhof instead of letting them stop in mid-air.
        const railway = createRailNetwork(rail, ground);
        if (railway) {
          isoWorld.add(railway);
        }
        // Task 37: the stationary ICE used to stand on the Hauptbahnhof
        // model's own stub track, which pointed off the east gable at
        // open water over the Humboldthafen. It now rides a real
        // viaduct_tracks centreline near the station, in the same
        // world-space frame as the railway above (not nested inside the
        // rotated/translated station model group).
        const ice = createIceOnRails(rail);
        if (ice) {
          isoWorld.add(ice);
        }
        // OSM node/2231321435 fixes the small Grillstand HBF beneath the
        // western Stadtbahn approach. It stays beside the architectural
        // signatures so its photo-bounded recognition details survive every
        // surface mode while still disappearing in the underground cutaway.
        const grillstand = createHauptbahnhofGrillstand(ground, rail);
        if (grillstand) {
          markAuthoredFlatUnlit(grillstand);
          runtime.signatures.add(grillstand);
        }
        const underground = createUndergroundNetwork(rail);
        if (underground) {
          runtime.undergroundNetwork.add(underground);
        }
        const catenary = createTramCatenary(rail, ground);
        if (catenary) {
          runtime.tramCatenary.add(catenary);
        }
      }
      // Publish the complete preview root atomically. The progressive worker
      // is deliberately started only after this pointer and scene attachment
      // exist; any later failure rolls both it and its batches back below.
      runtime.isoWorld = isoWorld;
      runtime.scene.add(isoWorld);
      runtime.progressiveWorldInput = progressiveInput ?? undefined;
      collectFarZoomAntiFlickerTargets(runtime);
      loadedParts += 1;
      runtime.reportCoreProgress(loadedParts, totalParts);
      performance.mark("isometric-city-preview-ready");
      setSceneLighting(runtime, runtime.lightingMode, runtime.nightLightsOn);
      if (provisionalPedestrianEnvironment) {
        runtime.pedestrian.environment = provisionalPedestrianEnvironment;
        runtime.ensurePedestrianWater = () => undefined;
        if (runtime.pedestrian.requested) {
          activatePedestrianMode(runtime);
        }
      }
      if (
        setSchwellenraumDatenSchutz(
          runtime.schwellenraumPraesentation,
          memorialProtection,
        )
      ) {
        runtime.renderInvalidated = true;
      }
      markSurfaceInteraction(runtime, 400, true);
      if (!runtime.coarsePointer) {
        runtime.startDeferredDetails();
        applyProgressiveWorldMode(runtime, runtime.lightingMode, warn);
      } else {
        applyProgressiveWorldMode(runtime, runtime.lightingMode, warn);
      }
      if (runtime.coarsePointer && !progressiveInput) {
        runtime.startDeferredDetails();
      }
      provisionalIsoWorld = null;
      provisionalPedestrianEnvironment = null;
      mutableRootSnapshots = null;
      pedestrianSnapshot = null;
      progressiveSnapshot = null;
      // Open the startup curtain only after every synchronous attachment
      // hook has succeeded and the rollback transaction has been committed.
      // A consumer callback must never turn a ready world into a rollback.
      try {
        notifyPresentationReadyWhenPossible(runtime);
      } catch (error: unknown) {
        if (import.meta.env.DEV) {
          console.error("Failed to notify drawn-world readiness", error);
        }
      }
    })
    .catch((error: unknown) => {
      const transactionStarted = pedestrianSnapshot !== null;
      const rollbackUnderside =
        pedestrianSnapshot?.underside ?? runtime.underside;
      if (progressiveSnapshot) {
        restoreProgressiveWorld(runtime, progressiveSnapshot);
        progressiveSnapshot = null;
      }
      if (
        provisionalIsoWorld &&
        runtime.isoWorld === provisionalIsoWorld
      ) {
        runtime.isoWorld = originalIsoWorld;
      }
      if (mutableRootSnapshots) {
        rollbackMutableRoots(runtime, mutableRootSnapshots);
        mutableRootSnapshots = null;
      }
      if (provisionalIsoWorld) {
        disposeObject3D(runtime, provisionalIsoWorld);
        provisionalIsoWorld = null;
      }
      if (transactionStarted) {
        runtime.trafficSignals = originalTrafficSignals;
      }
      if (pedestrianSnapshot) {
        restorePedestrianAttachment(runtime, pedestrianSnapshot);
        pedestrianSnapshot = null;
      }
      provisionalPedestrianEnvironment = null;
      if (transactionStarted) {
        collectFarZoomAntiFlickerTargets(runtime);
      }
      if (import.meta.env.DEV) {
        console.error("Failed to attach drawn isometric world", error);
      }
      if (runtime.disposed) {
        return;
      }
      runtime.renderInvalidated = true;
      if (!isoWorldIntentActive(runtime)) {
        runtime.isoWorldState = "idle";
        restoreWorldPresentationAfterRollback(runtime, rollbackUnderside);
        notifyPresentationReadyWhenPossible(runtime);
        return;
      }
      runtime.isoWorldState = "failed";
      restoreWorldPresentationAfterRollback(runtime, rollbackUnderside);
      runtime.ensurePhotoSurface();
      notifyPresentationReadyWhenPossible(runtime);
      warn(
        "Die gezeichnete Isometrie konnte nicht geladen werden; die fotografische Tagesansicht bleibt aktiv.",
      );
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
  // The portal cut is part of the voxel world's immutable instance layout.
  // Wait for scene.json instead of constructing a Minecraft deep-link frame
  // without the tunnel course and permanently roofing both approaches.
  if (
    runtime.tunnelPortalCourse === null ||
    runtime.voxelWorldState !== "idle"
  ) {
    return;
  }
  runtime.voxelWorldState = "loading";
  runtime.reportCoreProgress(0, 3);
  let loadedParts = 0;
  const tracked = async <T,>(task: Promise<T>): Promise<T> => {
    try {
      return await task;
    } finally {
      loadedParts += 1;
      runtime.reportCoreProgress(loadedParts, 3);
    }
  };
  let provisionalVoxelWorld: Group | null = null;
  let provisionalMinecraftMobs: MinecraftMobField | null = null;
  let provisionalEnvironment: PedestrianEnvironment | null = null;
  let pedestrianSnapshot: PedestrianAttachmentSnapshot | null = null;
  void Promise.all([
    tracked(fetchVoxelPayload(runtime)),
    // The prism payload carries each building's sampled real colour;
    // the block city snaps those onto the Minecraft palette so it
    // stops being one cream-coloured mass.
    tracked(fetchPrismPayload(runtime)).catch(() => null),
  ])
    .then(([payload, prisms]) => {
      if (runtime.disposed) {
        return;
      }
      // A visitor can leave Minecraft while these cached payload requests are
      // in flight. Do not turn that quick switch into a synchronous multi-
      // million-instance allocation hidden behind Day; a later Minecraft
      // entry retries immediately from the fulfilled fetch promises.
      if (!voxelWorldIntentActive(runtime)) {
        runtime.voxelWorldState = "idle";
        return;
      }
      pedestrianSnapshot = capturePedestrianAttachment(runtime);
      provisionalVoxelWorld = createMinecraftVoxelWorld(
        payload,
        prisms ? buildColumnToneLookup(prisms) : null,
        runtime.tunnelPortalCourse,
        { detailProfile: runtime.coarsePointer ? "mobile" : "full" },
      );
      provisionalMinecraftMobs = createMinecraftMobs(
        payload,
        !runtime.coarsePointer,
      );
      // Minecraft can be the cold-start mode, in which case the drawn-world
      // builder has not yet created the shared navigation environment. Load
      // only the water polygons in the background; block presentation stays
      // on the existing fast voxel+prism critical path.
      if (prisms && runtime.pedestrian.environment === null) {
        provisionalEnvironment = createPedestrianEnvironment(
          payload,
          { water: [] },
          runtime.tunnelPortalCourse,
          prisms,
        );
        provisionalEnvironment.walkableInteriorAt = (x, y, z, sourceId) =>
          visualModeWalkableInteriorAt(
            runtime.lightingMode,
            x,
            y,
            z,
            sourceId,
          );
        provisionalEnvironment.interiorSolidAt = (x, y, z, radius) =>
          csdAttackMemorialSolidAt(x, y, z, radius) ||
          berlinerEnsemblePublicArtSolidAt(x, y, z, radius) ||
          tiergartenLiteraryMemorialSolidAt(x, y, z, radius) ||
          invalidenfriedhofPedestrianSolidAt(x, y, z, radius) ||
          (minecraftHeroCollisionEnabled(runtime.lightingMode) &&
            minecraftHeroSolidAt(x, y, z, radius));
        provisionalEnvironment.interiorGroundAt = (x, z) =>
          minecraftHeroCollisionEnabled(runtime.lightingMode)
            ? minecraftHeroGroundAt(x, z)
            : null;
      }

      // Commit only after every expensive constructor succeeds. Anything
      // below that can still throw is guarded by the chain's rollback, so a
      // partial group can never masquerade as a ready voxel world.
      runtime.voxelWorld = provisionalVoxelWorld;
      runtime.minecraftMobs = provisionalMinecraftMobs;
      runtime.scene.add(provisionalVoxelWorld);
      runtime.scene.add(provisionalMinecraftMobs.group);
      registerBerlinerEnsembleRoofSignTargets(
        runtime,
        provisionalVoxelWorld,
      );
      loadedParts += 1;
      runtime.reportCoreProgress(loadedParts, 3);
      setSceneLighting(runtime, runtime.lightingMode, runtime.nightLightsOn);
      if (provisionalEnvironment) {
        runtime.pedestrian.environment = provisionalEnvironment;
        const environment = provisionalEnvironment;
        let waterRequestStarted = false;
        runtime.ensurePedestrianWater = () => {
          if (
            waterRequestStarted ||
            runtime.disposed ||
            runtime.pedestrian.environment !== environment
          ) {
            return;
          }
          waterRequestStarted = true;
          void fetchSurfacePayload(runtime)
            .then((surfaces) => {
              if (
                !runtime.disposed &&
                runtime.pedestrian.environment === environment
              ) {
                environment.water = compilePedestrianWater(surfaces);
              }
            })
            // Building, portal and terrain collision are already live; only
            // water respawn waits for a later drawn-world retry after failure.
            .catch(() => undefined);
        };
        if (runtime.pedestrian.requested) {
          runtime.ensurePedestrianWater();
          activatePedestrianMode(runtime);
        }
      }
      markSurfaceInteraction(runtime, 400, true);
      // A Minecraft-only visit never renders the smooth park layer. Day's
      // successful loader calls the same idempotent hook later, so cold voxel
      // starts must not download/build a large group merely to hide it.
      provisionalVoxelWorld = null;
      provisionalMinecraftMobs = null;
      provisionalEnvironment = null;
      pedestrianSnapshot = null;
      // As above, readiness is the final, non-transactional publication step.
      try {
        notifyPresentationReadyWhenPossible(runtime);
      } catch (error: unknown) {
        if (import.meta.env.DEV) {
          console.error("Failed to notify voxel-world readiness", error);
        }
      }
    })
    .catch((error: unknown) => {
      const rollbackUnderside =
        pedestrianSnapshot?.underside ?? runtime.underside;
      if (provisionalMinecraftMobs) {
        if (runtime.minecraftMobs === provisionalMinecraftMobs) {
          runtime.minecraftMobs = null;
        }
        disposeObject3D(runtime, provisionalMinecraftMobs.group);
        provisionalMinecraftMobs = null;
      }
      if (provisionalVoxelWorld) {
        if (runtime.voxelWorld === provisionalVoxelWorld) {
          runtime.voxelWorld = null;
        }
        disposeObject3D(runtime, provisionalVoxelWorld);
        provisionalVoxelWorld = null;
      }
      if (pedestrianSnapshot) {
        restorePedestrianAttachment(runtime, pedestrianSnapshot);
        pedestrianSnapshot = null;
      }
      provisionalEnvironment = null;
      if (runtime.disposed) {
        return;
      }
      if (import.meta.env.DEV) {
        console.error("Failed to attach Minecraft voxel world", error);
      }
      runtime.renderInvalidated = true;
      if (!voxelWorldIntentActive(runtime)) {
        // An inactive world's optional loader must not wake the heavyweight
        // photographic fallback. Keep the cached request and retry next time.
        runtime.voxelWorldState = "idle";
        restoreWorldPresentationAfterRollback(runtime, rollbackUnderside);
        notifyPresentationReadyWhenPossible(runtime);
        return;
      }
      runtime.voxelWorldState = "failed";
      restoreWorldPresentationAfterRollback(runtime, rollbackUnderside);
      runtime.ensurePhotoSurface();
      notifyPresentationReadyWhenPossible(runtime);
      warn(
        "Die Voxel-Welt konnte nicht geladen werden; der Minecraft-Modus nutzt die Block-Materialien.",
      );
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
  mesh.position
    .copy(start)
    .add(end)
    .multiplyScalar(0.5)
    .addScaledVector(normal, offset);
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
  const lampGeometry = new BoxGeometry(1.55, 0.12, 0.36);
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
  const fanGeometry = new TorusGeometry(0.82, 0.12, 8, 20);
  const fanMaterial = tunnelMaterial(
    new MeshBasicMaterial({ color: 0xb8c3c8, side: DoubleSide }),
    0.25,
    0.96,
  );
  const bladeGeometry = new BoxGeometry(0.68, 0.08, 0.18);
  const bladeMaterial = tunnelMaterial(
    new MeshBasicMaterial({ color: 0xa5b1b7, side: DoubleSide }),
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

      const lampCount = Math.max(1, Math.floor(segmentLength / 15));
      const normal = new Vector3(
        -delta.z / segmentLength,
        0,
        delta.x / segmentLength,
      );
      for (let lamp = 1; lamp <= lampCount; lamp += 1) {
        const position = start.clone().lerp(end, lamp / (lampCount + 1));
        position
          .addScaledVector(normal, offset)
          .add(new Vector3(0, height / 2 - 0.35, 0));
        instance.position.copy(position);
        instance.rotation.set(0, Math.atan2(delta.x, delta.z), 0);
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

  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 2) {
    const point = points[pointIndex];
    const before = points[Math.max(0, pointIndex - 1)];
    const after = points[Math.min(points.length - 1, pointIndex + 1)];
    const direction = after.clone().sub(before);
    const routeLength = Math.hypot(direction.x, direction.z) || 1;
    const routeNormal = new Vector3(
      -direction.z / routeLength,
      0,
      direction.x / routeLength,
    );
    const yaw = Math.atan2(direction.x, direction.z);
    instance.position.copy(point).add(new Vector3(0, 6, 0));
    instance.rotation.set(0, 0, 0);
    instance.scale.set(1, 1, 1);
    instance.updateMatrix();
    shaftMatrices.push(instance.matrix.clone());

    for (const side of [-1, 1]) {
      const fanPosition = point
        .clone()
        .addScaledVector(routeNormal, side * (width / 2 + 0.85))
        .add(new Vector3(0, height / 2 - 1.05, 0));
      instance.position.copy(fanPosition);
      instance.rotation.set(0, yaw, 0);
      instance.updateMatrix();
      fanMatrices.push(instance.matrix.clone());
      for (let bladeIndex = 0; bladeIndex < 4; bladeIndex += 1) {
        const angle = (bladeIndex / 4) * Math.PI * 2;
        instance.position
          .copy(fanPosition)
          .addScaledVector(routeNormal, Math.cos(angle) * 0.34)
          .add(new Vector3(0, Math.sin(angle) * 0.34, 0));
        instance.rotation.set(0, yaw, angle);
        instance.updateMatrix();
        bladeMatrices.push(instance.matrix.clone());
      }
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
  material.userData.tunnelInteriorOpacity = 1;
  return material;
}

export function setTunnelPresentation(
  tunnel: Group,
  underside: boolean,
  interior = false,
): void {
  tunnel.visible = underside || interior;
  tunnel.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    if (typeof object.userData.tunnelLayerOrder !== "number") {
      object.userData.tunnelLayerOrder = object.renderOrder;
    }
    object.renderOrder =
      (interior ? 0 : underside ? 14 : 10) + object.userData.tunnelLayerOrder;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      const opacity = interior
        ? material.userData.tunnelInteriorOpacity
        : underside
          ? material.userData.tunnelUndersideOpacity
          : material.userData.tunnelSurfaceOpacity;
      if (typeof opacity === "number") {
        material.opacity = opacity;
        material.depthTest = interior;
        material.depthWrite = interior && opacity >= 0.99;
        material.needsUpdate = true;
      }
    }
  });
}

function setModelMaterialState(runtime: Runtime, underside: boolean): void {
  runtime.underside = underside;
  if (
    photographicSurfaceNeeded(
      currentStartupPresentationStatus(runtime),
      underside,
      runtime.coarsePointer,
    )
  ) {
    runtime.ensurePhotoSurface();
  }
  runtime.renderInvalidated = true;
  const fogRange = presentationFogRange(runtime.lightingMode, underside);
  const fogColor =
    runtime.scene.background instanceof Color
      ? runtime.scene.background.getHex()
      : 0xdcf3f9;
  runtime.scene.fog = fogRange
    ? new Fog(fogColor, fogRange.near, fogRange.far)
    : null;
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
  setTunnelPresentation(
    runtime.tunnel,
    underside,
    runtime.pedestrian.state?.insideTunnel === true ||
      runtime.cameraInsideTunnel,
  );
  const voxelMode = voxelModeActive(runtime);
  const isoMode = isoModeActive(runtime);
  if (runtime.voxelWorld) {
    runtime.voxelWorld.visible = voxelMode && !underside;
  }
  if (runtime.isoWorld) {
    runtime.isoWorld.visible = isoMode && !underside;
  }
  runtime.undergroundNetwork.visible = underside;
  runtime.cityStaffage.visible = !underside;
  runtime.tramCatenary.visible = !underside;
  if (voxelMode && underside) {
    // Entering the underside without changing mode must apply the same shell
    // exception as setSceneLighting above.
    setMinecraftMaterialPresentation(
      runtime.interactionSurface,
      runtime.minecraftMaterialState,
      false,
    );
    setMinecraftMaterialPresentation(
      runtime.settledSurface,
      runtime.minecraftMaterialState,
      false,
    );
  }
  setTunnelPortalPresentation(
    runtime.tunnelPortals,
    underside,
    voxelMode,
    runtime.pedestrian.state?.insideTunnel === true ||
      runtime.cameraInsideTunnel,
  );
  const recognitionVisible = !underside && !voxelMode;
  runtime.signatures.visible = !underside;
  runtime.centralDetails.visible = centralCivicDetailsVisible(underside);
  setMinecraftArchitecturePresentation(
    runtime.signatures,
    runtime.centralDetails,
    voxelMode,
  );
  runtime.civicDetails.visible = civicDetailsVisible(underside);
  applyMinecraftVisibility(minecraftVisibilityRoots(runtime), voxelMode);
  runtime.monuments.visible = !underside;
  setTiergartenLiteraryMemorialSmoothVisibility(
    runtime.monuments,
    !voxelMode,
  );
  runtime.culturalDetails.visible = recognitionVisible;
  runtime.parkDetails.visible = recognitionVisible;
  for (const detail of runtime.detailGroups.values()) {
    detail.group.visible = recognitionVisible && !isoMode;
  }
  setEnvironmentalPresentation(runtime);
}

function notifyView(
  runtime: Runtime,
  callback: (angles: ViewAngles) => void,
): void {
  const pedestrian = runtime.pedestrian.state;
  callback({
    azimuthDegrees:
      runtime.pedestrian.enabled && pedestrian
        ? MathUtils.radToDeg(-pedestrian.yaw)
        : MathUtils.radToDeg(runtime.controls.getAzimuthalAngle()),
    polarDegrees:
      runtime.pedestrian.enabled && pedestrian
        ? 90 - MathUtils.radToDeg(pedestrian.pitch)
        : MathUtils.radToDeg(runtime.controls.getPolarAngle()),
    underside: runtime.pedestrian.enabled ? false : runtime.underside,
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
    case "WELT Balloon":
      return 104;
    case "DKB Campus Upbeat":
      return 76;
    case "KPMG Europacity":
      return 42;
    case "Siegessäule":
      return 72;
    case "Queer Rainbow Memorial Berlin":
      return 7.2;
    case "Goethe-Denkmal":
      return (
        TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe.worldM[1] +
        TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe.totalHeightM +
        1.2
      );
    case "Lessing-Denkmal":
      return (
        TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing.worldM[1] +
        TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing.totalHeightM +
        1.2
      );
    default:
      return 18;
  }
}

function setOrbitAngles(
  runtime: Runtime,
  angles: { azimuth?: number; polar?: number },
): void {
  const previousCamera = runtime.camera.position.clone();
  const previousTarget = runtime.controls.target.clone();
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
  reconcileMinecraftCameraRig(runtime, previousCamera, previousTarget);
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
    // Assigned and every serializer-supported alternate (including the dark
    // moonlit water) share one Set, so Minecraft pause/resume cycles dispose
    // each material and its textures exactly once.
    for (const material of objectMaterialsIncludingTransferredAlternates(object)) {
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
      applyMaterialLighting(
        material,
        runtime.lightingMode,
        runtime.nightLightsOn,
      );
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
      setBuildingColorMode(
        object.geometry,
        runtime.lightingMode === "day" ||
          runtime.lightingMode === "snowstorm" ||
          runtime.lightingMode === "schwellenraum",
      );
    }
  });
  if (detail) {
    gltf.scene.position.y += DETAIL_RAISE_M;
  }
  stripSkyArtefacts(gltf.scene, skyArtefactsFor(file.file));
  stripReplacedGeometry(gltf.scene, meshReplacementsFor(file.file));
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
      pedestrianMode,
      precipitationEnabled,
      progressLabel,
      sceneUrl,
      selectedLandmark,
      onError,
      onPedestrianRespawn,
      onPedestrianSprintToggle,
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
    // Desktop arrows/buttons use screen-plane pan, while Alt/Option and the
    // orbit joystick feed a separate angular input. Keeping these distinct
    // preserves direct movement without turning key-repeat into camera jumps.
    const panInputRef = useRef(new Vector2());
    const orbitInputRef = useRef(new Vector2());
    const pedestrianInputRef = useRef<PedestrianInput>({
      ...PEDESTRIAN_IDLE_INPUT,
    });
    const lightingModeRef = useRef(lightingMode);
    const pedestrianModeRef = useRef(pedestrianMode);
    const nightLightsOnRef = useRef(nightLightsOn);
    const precipitationEnabledRef = useRef(precipitationEnabled);
    const onErrorRef = useRef(onError);
    const onPedestrianRespawnRef = useRef(onPedestrianRespawn);
    const onPedestrianSprintToggleRef = useRef(onPedestrianSprintToggle);
    const onReadyRef = useRef(onReady);
    const onWarningRef = useRef(onWarning);
    const onViewChangeRef = useRef(onViewChange);
    const [progress, setProgress] = useState({ loaded: 0, total: 1 });
    const [presentationReady, setPresentationReady] = useState(false);

    useEffect(() => {
      activeRef.current = active;
      const runtime = runtimeRef.current;
      if (active && runtime) {
        runtime.schwellenraumLastWaterFrameAt = performance.now();
        runtime.renderInvalidated = true;
      }
    }, [active]);

    useEffect(() => {
      pedestrianModeRef.current = pedestrianMode;
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }
      flightInputRef.current.set(0, 0, 0);
      panInputRef.current.set(0, 0);
      orbitInputRef.current.set(0, 0);
      pedestrianInputRef.current = { ...PEDESTRIAN_IDLE_INPUT };
      if (pedestrianMode) {
        runtime.ensurePedestrianWater();
        activatePedestrianMode(runtime);
      } else {
        deactivatePedestrianMode(runtime);
      }
    }, [pedestrianMode]);

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
        (lightingMode === "day" ||
          lightingMode === "night" ||
          lightingMode === "snowstorm" ||
          lightingMode === "schwellenraum") &&
        runtime.tunnelPoints !== null
      ) {
        // Before the scene manifest has delivered the tunnel centreline
        // we wait: the manifest handler calls ensureIsoWorld itself, and
        // starting early would permanently miss the tunnel trace.
        ensureIsoWorld(runtime, onWarningRef.current);
      }
      if (lightingMode === "minecraft" && runtime.tunnelPoints !== null) {
        ensureVoxelWorld(runtime, onWarningRef.current);
      }
      applyProgressiveWorldMode(runtime, lightingMode, onWarningRef.current);
      if (
        runtime.coarsePointer &&
        isoWorldIntentActive(runtime) &&
        (runtime.progressiveWorldState === "complete" ||
          runtime.progressiveWorldState === "failed" ||
          !runtime.progressiveWorldInput)
      ) {
        runtime.startDeferredDetails();
      }
      setSceneLighting(runtime, lightingMode, nightLightsOn);
      notifyPresentationReadyWhenPossible(runtime);
    }, [lightingMode, nightLightsOn]);

    useEffect(() => {
      precipitationEnabledRef.current = precipitationEnabled;
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }
      runtime.precipitationEnabled = precipitationEnabled;
      setEnvironmentalPresentation(runtime);
    }, [precipitationEnabled]);

    useEffect(() => {
      onErrorRef.current = onError;
      onPedestrianRespawnRef.current = onPedestrianRespawn;
      onPedestrianSprintToggleRef.current = onPedestrianSprintToggle;
      onReadyRef.current = onReady;
      onWarningRef.current = onWarning;
      onViewChangeRef.current = onViewChange;
    }, [
      onError,
      onPedestrianRespawn,
      onPedestrianSprintToggle,
      onReady,
      onWarning,
      onViewChange,
    ]);

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
      const desiredFov =
        cameraPreset?.fov_degrees ??
        (isoModeActive(runtime) || voxelModeActive(runtime)
          ? ISO_FOV_DEGREES
          : PHOTO_FOV_DEGREES);
      runtime.focusedCameraFov = cameraPreset?.fov_degrees ?? null;
      if (runtime.camera.fov !== desiredFov) {
        runtime.camera.fov = desiredFov;
        runtime.camera.updateProjectionMatrix();
      }
      let cameraOffset: Vector3;
      if (cameraPreset) {
        target.y += cameraPreset.target_height_m;
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
          : (parkDetailFocusDistance(name) ??
            memorialFocusDistance(name) ??
            190);
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
      runtime.tunnelPortalInteriorVisible = isTunnelPortalFocus(name);
      setTunnelPortalPresentation(
        runtime.tunnelPortals,
        runtime.underside,
        voxelModeActive(runtime),
        runtime.tunnelPortalInteriorVisible ||
          runtime.pedestrian.state?.insideTunnel === true ||
          runtime.cameraInsideTunnel,
      );
      const markerHeight = markerHeightForLandmark(name);
      runtime.marker.position.copy(target).setY(markerHeight);
      // A floating selection halo above a road portal reads as a stray object
      // in the sky. The framed mouth itself is the unambiguous focus target.
      runtime.marker.visible = !runtime.tunnelPortalInteriorVisible;
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
        currentStartupPresentationStatus(runtime) === "fallback" &&
        !runtime.underside;
      for (const [heroName, entry] of runtime.detailGroups) {
        entry.group.visible = heroVisibleAllowed && heroName === name;
        if (heroName === name) {
          entry.lastUsed = runtime.detailClock;
        }
      }
      const detail = runtime.heroByName.get(name);
      if (heroVisibleAllowed && detail && !runtime.detailGroups.has(name)) {
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
          if (runtime.pedestrian.enabled) {
            nudgePedestrian(
              runtime,
              MathUtils.clamp(horizontal, -1, 1),
              MathUtils.clamp(vertical, -1, 1),
            );
            notifyView(runtime, onViewChangeRef.current);
            return;
          }
          markSurfaceInteraction(runtime);
          flyCameraRigInViewPlane(runtime, horizontal, vertical);
          runtime.controls.update();
          notifyView(runtime, onViewChangeRef.current);
        },
        flyForwardBy: (strafe, forward) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          if (runtime.pedestrian.enabled) {
            nudgePedestrian(runtime, strafe, forward);
            notifyView(runtime, onViewChangeRef.current);
            return;
          }
          markSurfaceInteraction(runtime);
          flyCameraRigAlongViewHeading(runtime, strafe, forward);
          runtime.controls.update();
          notifyView(runtime, onViewChangeRef.current);
        },
        focusLandmark,
        reset: () => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          if (runtime.pedestrian.enabled && runtime.pedestrian.environment) {
            runtime.pedestrian.state = createPedestrianState(
              runtime.pedestrian.environment,
            );
            runtime.pedestrian.cameraDirty = true;
            applyPedestrianCamera(runtime);
            notifyView(runtime, onViewChangeRef.current);
            return;
          }
          markSurfaceInteraction(runtime);
          runtime.controls.target.copy(DEFAULT_TARGET);
          runtime.camera.position
            .copy(DEFAULT_TARGET)
            .add(DEFAULT_CAMERA_OFFSET);
          setModelMaterialState(runtime, false);
          runtime.controls.update();
          notifyView(runtime, onViewChangeRef.current);
        },
        rotateBy: (degrees) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          if (runtime.pedestrian.enabled && runtime.pedestrian.state) {
            runtime.pedestrian.state = lookPedestrian(
              runtime.pedestrian.state,
              MathUtils.degToRad(degrees),
              0,
            );
            runtime.pedestrian.cameraDirty = true;
            applyPedestrianCamera(runtime);
            notifyView(runtime, onViewChangeRef.current);
            return;
          }
          markSurfaceInteraction(runtime);
          setOrbitAngles(runtime, {
            azimuth:
              runtime.controls.getAzimuthalAngle() +
              MathUtils.degToRad(degrees),
          });
          notifyView(runtime, onViewChangeRef.current);
        },
        setFlightInput: (strafe, forward, vertical) => {
          const runtime = runtimeRef.current;
          if (runtime?.pedestrian.enabled) {
            pedestrianInputRef.current = {
              ...pedestrianInputRef.current,
              forward: MathUtils.clamp(forward, -1, 1),
              strafe: MathUtils.clamp(strafe, -1, 1),
            };
            flightInputRef.current.set(0, 0, 0);
            if (Math.abs(strafe) > 1e-6 || Math.abs(forward) > 1e-6) {
              markSurfaceInteraction(runtime, 220);
            }
            return;
          }
          if (
            runtime &&
            (Math.abs(strafe) > 1e-6 ||
              Math.abs(forward) > 1e-6 ||
              Math.abs(vertical) > 1e-6)
          ) {
            markSurfaceInteraction(runtime, 220);
          }
          flightInputRef.current.set(
            MathUtils.clamp(strafe, -1, 1),
            MathUtils.clamp(vertical, -1, 1),
            MathUtils.clamp(forward, -1, 1),
          );
        },
        setOrbitInput: (horizontal, vertical) => {
          const runtime = runtimeRef.current;
          if (runtime?.pedestrian.enabled) {
            pedestrianInputRef.current = {
              ...pedestrianInputRef.current,
              look: MathUtils.clamp(vertical, -1, 1),
              turn: MathUtils.clamp(horizontal, -1, 1),
            };
            orbitInputRef.current.set(0, 0);
            if (Math.abs(horizontal) > 1e-6 || Math.abs(vertical) > 1e-6) {
              markSurfaceInteraction(runtime, 220);
            }
            return;
          }
          if (
            runtime &&
            (Math.abs(horizontal) > 1e-6 || Math.abs(vertical) > 1e-6)
          ) {
            markSurfaceInteraction(runtime, 220);
          }
          orbitInputRef.current.set(
            MathUtils.clamp(horizontal, -1, 1),
            MathUtils.clamp(vertical, -1, 1),
          );
        },
        setPanInput: (horizontal, vertical) => {
          const runtime = runtimeRef.current;
          if (runtime?.pedestrian.enabled) {
            panInputRef.current.set(0, 0);
            return;
          }
          if (
            runtime &&
            (Math.abs(horizontal) > 1e-6 || Math.abs(vertical) > 1e-6)
          ) {
            markSurfaceInteraction(runtime, 220);
          }
          panInputRef.current.set(
            MathUtils.clamp(horizontal, -1, 1),
            MathUtils.clamp(vertical, -1, 1),
          );
        },
        setAzimuth: (degrees) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          if (runtime.pedestrian.enabled && runtime.pedestrian.state) {
            runtime.pedestrian.state = setPedestrianYaw(
              runtime.pedestrian.state,
              -MathUtils.degToRad(degrees),
            );
            runtime.pedestrian.cameraDirty = true;
            applyPedestrianCamera(runtime);
            notifyView(runtime, onViewChangeRef.current);
            return;
          }
          markSurfaceInteraction(runtime);
          setOrbitAngles(runtime, { azimuth: MathUtils.degToRad(degrees) });
          notifyView(runtime, onViewChangeRef.current);
        },
        setPedestrianMode: (enabled) => {
          const runtime = runtimeRef.current;
          pedestrianModeRef.current = enabled;
          flightInputRef.current.set(0, 0, 0);
          panInputRef.current.set(0, 0);
          orbitInputRef.current.set(0, 0);
          pedestrianInputRef.current = { ...PEDESTRIAN_IDLE_INPUT };
          if (!runtime) {
            return false;
          }
          if (enabled) {
            runtime.ensurePedestrianWater();
          }
          const changed = enabled
            ? activatePedestrianMode(runtime)
            : deactivatePedestrianMode(runtime);
          if (changed) {
            notifyView(runtime, onViewChangeRef.current);
          }
          return changed;
        },
        setPedestrianSprint: (enabled) => {
          pedestrianInputRef.current = {
            ...pedestrianInputRef.current,
            sprint: enabled,
          };
        },
        setUnderside: (enabled) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          if (runtime.pedestrian.enabled) {
            deactivatePedestrianMode(runtime);
            pedestrianInputRef.current = { ...PEDESTRIAN_IDLE_INPUT };
          }
          markSurfaceInteraction(runtime);
          setModelMaterialState(runtime, enabled);
          if (enabled) {
            // The old button first focused the south road-tunnel portal, so
            // the underside opened inside one bore and the wider U-/S-Bahn
            // cutaway was effectively undiscoverable. Frame the central
            // underground network from below; tunnel travel itself is manual.
            const theta = runtime.controls.getAzimuthalAngle();
            // Brandenburg Gate is where the U5 and the North-South S-Bahn
            // cross; centring just west of it puts both source routes, their
            // stations and the Tiergartentunnel in one readable cutaway.
            runtime.controls.target.set(430, -8, 360);
            const offset = new Vector3().setFromSpherical(
              new Spherical(2_150, MathUtils.degToRad(128), theta),
            );
            runtime.camera.position.copy(runtime.controls.target).add(offset);
            runtime.controls.update();
          } else {
            runtime.controls.target.copy(DEFAULT_TARGET);
            runtime.camera.position
              .copy(DEFAULT_TARGET)
              .add(DEFAULT_CAMERA_OFFSET);
            runtime.controls.update();
          }
          notifyView(runtime, onViewChangeRef.current);
        },
        tiltBy: (degrees) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
          if (runtime.pedestrian.enabled && runtime.pedestrian.state) {
            runtime.pedestrian.state = lookPedestrian(
              runtime.pedestrian.state,
              0,
              -MathUtils.degToRad(degrees),
            );
            runtime.pedestrian.cameraDirty = true;
            applyPedestrianCamera(runtime);
            notifyView(runtime, onViewChangeRef.current);
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
          if (!runtime || runtime.pedestrian.enabled) {
            return;
          }
          markSurfaceInteraction(runtime);
          const previousCamera = runtime.camera.position.clone();
          const previousTarget = runtime.controls.target.clone();
          const offset = runtime.camera.position
            .clone()
            .sub(runtime.controls.target);
          offset.multiplyScalar(1 / factor);
          offset.clampLength(
            runtime.controls.minDistance,
            runtime.controls.maxDistance,
          );
          runtime.camera.position.copy(runtime.controls.target).add(offset);
          reconcileMinecraftCameraRig(
            runtime,
            previousCamera,
            previousTarget,
          );
          runtime.controls.update();
        },
        jumpPedestrian: () => {
          const runtime = runtimeRef.current;
          return runtime ? triggerPedestrianJump(runtime) : false;
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
      setPresentationReady(false);
      let disposed = false;
      let frame = 0;
      let resizeObserver: ResizeObserver | null = null;
      const loadController = new AbortController();
      const coarsePointer = browserUsesMobileViewerProfile();
      const webglMemoryProfile = stableWebglMemoryProfile(coarsePointer);
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      let renderer: WebGLRenderer;
      try {
        renderer = new WebGLRenderer({
          antialias: webglMemoryProfile.antialias,
          powerPreference: "high-performance",
          // The viewer intentionally stops drawing once a still scene is
          // settled. Safari/iOS may discard an unpreserved WebGL backbuffer
          // between compositor passes, producing a blank/old-frame flash even
          // though no scene state changed. Preserve the last complete frame.
          preserveDrawingBuffer: true,
        });
      } catch (error: unknown) {
        loadController.abort();
        onErrorRef.current(
          error instanceof Error
            ? `WebGL 2 konnte nicht gestartet werden: ${error.message}`
            : "WebGL 2 konnte nicht gestartet werden.",
        );
        return;
      }
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = PRESENTATION_TONE.day.toneMapping;
      renderer.toneMappingExposure = PRESENTATION_TONE.day.exposure;
      renderer.shadowMap.enabled = true;
      // PCF filtering removes the hard one-texel shadow crawl that otherwise
      // reads as a second outline while the camera moves across detailed roofs.
      renderer.shadowMap.type = PCFShadowMap;
      renderer.setPixelRatio(1);
      renderer.domElement.className = "three-canvas";
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute("aria-label", canvasAriaLabel);
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
      // Desktop retains the established 4x half-float composer. On coarse
      // pointers the final SMAA pass below owns edge smoothing, avoiding both
      // renderer MSAA and two full-size multisampled half-float targets. At a
      // tablet viewport those persistent targets alone can otherwise consume
      // hundreds of MiB and trigger Safari WebGL context loss.
      const composerTarget = new WebGLRenderTarget(1, 1, {
        samples: webglMemoryProfile.composerSamples,
        type: webglMemoryProfile.halfFloatComposer
          ? HalfFloatType
          : UnsignedByteType,
      });
      const composer = new EffectComposer(renderer, composerTarget);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(crispPass);
      // Keep SMAA permanently last and enabled in every visual mode: on
      // desktop it removes remaining stair steps after the MSAA resolve; on
      // mobile it is the single bounded anti-aliasing stage. In both cases,
      // motion and rest must use the exact same pixel pipeline, otherwise the
      // anti-aliasing transition itself becomes a visible flash.
      const smaaPass = new SMAAPass();
      smaaPass.enabled = true;
      composer.addPass(smaaPass);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(DEFAULT_TARGET);
      // Direct orbiting stops on the exact pointer-up frame. OrbitControls'
      // exponential damping kept changing the camera by sub-pixel amounts for
      // several seconds after the visitor had stopped, so dense ink appeared
      // to flicker in an otherwise still view. Touch panning keeps its bounded
      // custom momentum below; mouse/pen rotation remains strictly 1:1.
      controls.enableDamping = false;
      controls.zoomToCursor = true;
      controls.rotateSpeed = 1.08;
      controls.zoomSpeed = 1.12;
      controls.panSpeed = 1.16;
      controls.minDistance = CAMERA_TARGET_CROSSING_MIN_M;
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
      const centralDetails = new Group();
      centralDetails.name = "Pending central transit and civic details";
      scene.add(centralDetails);
      const monuments = new Group();
      monuments.name = "Verified memorial detail models";
      scene.add(monuments);
      const culturalDetails = new Group();
      culturalDetails.name = "Pending cultural and Spree details";
      scene.add(culturalDetails);
      const parkDetails = new Group();
      parkDetails.name = "Pending OSM park details";
      scene.add(parkDetails);
      const cityStaffage = new Group();
      cityStaffage.name = "Sparse city life presentation layer";
      scene.add(cityStaffage);
      const tramCatenary = new Group();
      tramCatenary.name = "Mapped tram overhead layer";
      scene.add(tramCatenary);
      const undergroundNetwork = new Group();
      undergroundNetwork.name = "Underground passenger cutaway layer";
      undergroundNetwork.visible = false;
      scene.add(undergroundNetwork);
      const rain = createModerateRain(coarsePointer);
      scene.add(rain.group);
      const snowstorm = createSnowstorm(coarsePointer);
      scene.add(snowstorm.group);
      const schwellenraumPraesentation = createSchwellenraumPraesentation();
      scene.add(schwellenraumPraesentation);
      const schwellenraumInteriors = createSchwellenraumInteriors();
      scene.add(schwellenraumInteriors);
      const runtime: Runtime = {
        baseSurfaceReady: false,
        camera,
        centralDetails,
        cityStaffage,
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
        minecraftMobs: null,
        modelMaterials: new Set(),
        monuments,
        schwellenraumInteriors,
        schwellenraumPraesentation,
        berlinerEnsembleRoofSignElapsedSeconds: 0.9,
        berlinerEnsembleRoofSignLastFrameAt: 0,
        berlinerEnsembleRoofSignTargets: [],
        schwellenraumFlagElapsedSeconds: 0.9,
        schwellenraumLastFlagFrameAt: 0,
        schwellenraumLastWaterFrameAt: 0,
        schwellenraumMovingFlagCount: 0,
        schwellenraumWaterElapsedSeconds:
          SCHWELLENRAUM_WATER_INITIAL_TIME_SECONDS,
        schwellenraumWaterLightCount: 0,
        parkDetails,
        pedestrian: {
          cameraDirty: false,
          enabled: false,
          environment: null,
          requested: pedestrianModeRef.current,
          savedFov: camera.fov,
          savedNear: camera.near,
          savedPose: null,
          savedUnderside: false,
          state: null,
        },
        presentationReady: false,
        notifyPresentationReady: () => {
          if (disposed) {
            return;
          }
          setPresentationReady(true);
          onReadyRef.current();
        },
        rain,
        reducedMotion,
        precipitationEnabled: precipitationEnabledRef.current,
        loadSignal: loadController.signal,
        ensurePhotoSurface: () => undefined,
        ensurePedestrianWater: () => undefined,
        photoSurfaceState: "idle",
        progressiveWorldBatches: [],
        progressiveWorldState: "idle",
        reportCoreProgress: (loaded, total) => {
          if (!disposed) {
            setProgress({ loaded, total });
          }
        },
        startDeferredDetails: () => undefined,
        snowstorm,
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
        cameraInsideTunnel: false,
        tunnelPortals: new Group(),
        tunnelInteriorAt: null,
        tunnelPoints: null,
        tunnelPortalCourse: null,
        tunnelPortalInteriorVisible: false,
        tramCatenary,
        isoWorld: null,
        isoWorldState: "idle",
        inkLineMaterials: new Set(),
        fineDetailObjects: [],
        fineDetailVisible: true,
        microDetailObjects: [],
        microDetailVisible: false,
        focusedCameraFov: null,
        voxelWorld: null,
        voxelWorldState: "idle",
        lightingMode: lightingModeRef.current,
        nightLightsOn: nightLightsOnRef.current,
        underside: false,
        undergroundNetwork,
        underwater: false,
      };
      runtimeRef.current = runtime;
      setSceneLighting(
        runtime,
        lightingModeRef.current,
        nightLightsOnRef.current,
      );

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
      let signedPinchDolly: SignedPinchDolly | null = null;
      // Pan momentum: finger velocity at release keeps the map gliding
      // with an exponential ease-out (decayPanMomentum).
      const panVelocity = { x: 0, y: 0 };
      let panVelocitySampleAt = performance.now();
      const panMomentum = { x: 0, y: 0 };
      // Browsers do not reliably synthesise dblclick on a touch-action:none
      // canvas. Completed taps are tracked separately for orbit zoom and the
      // pedestrian jump so switching modes cannot replay a stale gesture.
      let lastViewerTapAt = 0;
      let lastViewerTapX = 0;
      let lastViewerTapY = 0;
      let lastPedestrianTap: PedestrianTouchTap | null = null;
      let lastPedestrianSprintToggleAt = Number.NEGATIVE_INFINITY;
      const requestPedestrianSprintToggle = () => {
        const now = performance.now();
        if (now - lastPedestrianSprintToggleAt < 400) {
          return;
        }
        lastPedestrianSprintToggleAt = now;
        onPedestrianSprintToggleRef.current();
      };
      let previousThreeFingerCenter: { x: number; y: number } | null = null;
      let controlsInteracting = false;
      const lastDirectControlCamera = camera.position.clone();
      const lastDirectControlTarget = controls.target.clone();
      let touchInteracting = false;
      let lastTouchActivityAt = Number.NEGATIVE_INFINITY;
      let pedestrianLookPointer: {
        cancelled: boolean;
        id: number;
        maxTravelPx: number;
        pointerType: string;
        startedAt: number;
        startX: number;
        startY: number;
        x: number;
        y: number;
      } | null = null;
      let lastSafeCameraPose = captureCameraPose(camera, controls.target);
      let appliedWidth = 0;
      let appliedHeight = 0;
      let appliedPixelRatio = 0;
      const resize = (force = false) => {
        const bounds = host.getBoundingClientRect();
        if (bounds.width < 1 || bounds.height < 1) {
          return;
        }
        const { width, height } = stableViewportSize(
          bounds.width,
          bounds.height,
        );
        const pixelRatio = renderPixelRatio({
          coarsePointer,
          devicePixelRatio: window.devicePixelRatio,
          height,
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
          crispResolution.set(width * pixelRatio, height * pixelRatio);
        }
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
        const previousCamera = camera.position.clone();
        const previousTarget = controls.target.clone();
        zoomCameraAtScreenPoint(
          camera,
          controls.target,
          ndcX,
          ndcY,
          factor,
          controls.minDistance,
          controls.maxDistance,
        );
        reconcileMinecraftCameraRig(
          runtime,
          previousCamera,
          previousTarget,
        );
      };
      let trackpadPanSequenceUntil = Number.NEGATIVE_INFINITY;
      let wheelEndTimer: number | null = null;
      const onWheelNavigation = (event: WheelEvent): void => {
        if (runtime.pedestrian.enabled) {
          event.preventDefault();
          event.stopImmediatePropagation();
          renderer.domElement.focus({ preventScroll: true });
          const forward = pedestrianWheelForwardInput(event);
          if (
            Math.abs(forward) > 1e-6 &&
            nudgePedestrian(runtime, 0, forward)
          ) {
            markSurfaceInteraction(runtime, 220);
            notifyView(runtime, onViewChangeRef.current);
          }
          return;
        }
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
        panMomentum.x = 0;
        panMomentum.y = 0;
        if (intent === "trackpad-pinch") {
          const factor = MathUtils.clamp(
            Math.exp(-event.deltaY * 0.016),
            0.78,
            1.28,
          );
          zoomAtClientPoint({ x: event.clientX, y: event.clientY }, factor);
        } else {
          trackpadPanSequenceUntil = now + 180;
          // Pixel wheel deltas run opposite to physical finger travel under
          // natural scrolling. Invert them before applying the same direct-
          // manipulation contract as a two-finger touch pan.
          const { strafe, forward } = twoFingerPanFlight(
            -event.deltaX,
            -event.deltaY,
          );
          flyCameraRigAlongViewHeading(runtime, strafe, forward);
        }
        controls.update();
        markSurfaceInteraction(runtime);
        if (wheelEndTimer !== null) {
          window.clearTimeout(wheelEndTimer);
        }
        wheelEndTimer = window.setTimeout(() => {
          wheelEndTimer = null;
          if (!runtime.disposed) {
            notifyView(runtime, onViewChangeRef.current);
          }
        }, 180);
      };
      const onPointerDown = (event: PointerEvent) => {
        panMomentum.x = 0;
        panMomentum.y = 0;
        if (runtime.pedestrian.enabled) {
          if (
            pedestrianLookPointer ||
            (event.pointerType !== "touch" && event.button !== 0)
          ) {
            if (event.pointerType === "touch") {
              lastPedestrianTap = null;
              if (pedestrianLookPointer) {
                pedestrianLookPointer.cancelled = true;
              }
            }
            return;
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          if (event.pointerType === "touch") {
            lastTouchActivityAt = performance.now();
          }
          renderer.domElement.focus({ preventScroll: true });
          try {
            renderer.domElement.setPointerCapture?.(event.pointerId);
          } catch {
            // Some WebKit and synthetic pointer sequences reject capture even
            // though the pointerdown itself is valid. Looking still works
            // while the pointer remains over the canvas.
          }
          pedestrianLookPointer = {
            cancelled: false,
            id: event.pointerId,
            maxTravelPx: 0,
            pointerType: event.pointerType,
            startedAt: performance.now(),
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX,
            y: event.clientY,
          };
          controlsInteracting = true;
          touchInteracting = event.pointerType === "touch";
          markSurfaceInteraction(runtime);
          return;
        }
        lastPedestrianTap = null;
        if (event.pointerType === "touch" && touchPoints.size === 0) {
          const now = performance.now();
          if (
            now - lastViewerTapAt < 340 &&
            Math.hypot(
              event.clientX - lastViewerTapX,
              event.clientY - lastViewerTapY,
            ) < 32
          ) {
            lastViewerTapAt = 0;
            zoomAtClientPoint({ x: event.clientX, y: event.clientY }, 1.5);
            controls.update();
            markSurfaceInteraction(runtime);
            notifyView(runtime, onViewChangeRef.current);
          } else {
            lastViewerTapAt = now;
            lastViewerTapX = event.clientX;
            lastViewerTapY = event.clientY;
          }
        }
        if (event.pointerType !== "touch") {
          renderer.domElement.focus({ preventScroll: true });
          return;
        }
        lastTouchActivityAt = performance.now();
        touchPoints.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        if (touchPoints.size === 2) {
          customTouchGestureActive = true;
          controlsInteracting = false;
          touchInteracting = true;
          controls.enabled = false;
          markSurfaceInteraction(runtime);
          previousTwoFingerGesture = twoFingerGesture();
          twoFingerStart = previousTwoFingerGesture;
          twoFingerMode = "undecided";
          signedPinchDolly = null;
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
          previousTwoFingerGesture = null;
          twoFingerStart = null;
          twoFingerMode = "undecided";
          signedPinchDolly = null;
          const points = [...touchPoints.values()];
          previousThreeFingerCenter = {
            x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
            y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
          };
        }
      };
      const onPointerMove = (event: PointerEvent) => {
        if (
          runtime.pedestrian.enabled &&
          pedestrianLookPointer?.id === event.pointerId &&
          runtime.pedestrian.state
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const deltaX = event.clientX - pedestrianLookPointer.x;
          const deltaY = event.clientY - pedestrianLookPointer.y;
          pedestrianLookPointer.maxTravelPx = Math.max(
            pedestrianLookPointer.maxTravelPx,
            Math.hypot(
              event.clientX - pedestrianLookPointer.startX,
              event.clientY - pedestrianLookPointer.startY,
            ),
          );
          pedestrianLookPointer.x = event.clientX;
          pedestrianLookPointer.y = event.clientY;
          if (deltaX !== 0 || deltaY !== 0) {
            runtime.pedestrian.state = lookPedestrian(
              runtime.pedestrian.state,
              deltaX * 0.0034,
              -deltaY * 0.0031,
            );
            runtime.pedestrian.cameraDirty = true;
            markSurfaceInteraction(runtime, 220);
          }
          return;
        }
        if (!touchPoints.has(event.pointerId)) {
          return;
        }
        lastTouchActivityAt = performance.now();
        touchPoints.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
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
            flyCameraRigAlongViewHeading(runtime, strafe, forward);
            // Remember the finger velocity so release can glide out.
            const now = performance.now();
            const dt = Math.max(1, now - panVelocitySampleAt) / 1000;
            panVelocity.x = deltaX / dt;
            panVelocity.y = deltaY / dt;
            panVelocitySampleAt = now;
          } else {
            // Far from the focal plane, preserve the world point below the
            // midpoint. Close to it, switch to a signed dolly so a continued
            // spread can pass through the ground and emerge on the underside
            // instead of becoming stuck at OrbitControls' positive radius.
            const pinchRatio = MathUtils.clamp(
              current.distance / previousTwoFingerGesture.distance,
              0.86,
              1.16,
            );
            if (Math.abs(pinchRatio - 1) > 0.002) {
              if (
                !signedPinchDolly &&
                pinchRatio > 1 &&
                camera.position.distanceTo(controls.target) <=
                  PINCH_TARGET_CROSSING_ZONE_M
              ) {
                signedPinchDolly = createSignedPinchDolly(
                  camera,
                  controls.target,
                );
              }
              if (signedPinchDolly) {
                const previousCamera = camera.position.clone();
                const previousTarget = controls.target.clone();
                const signedDistance = advanceSignedPinchDolly(
                  camera,
                  controls.target,
                  signedPinchDolly,
                  pinchRatio,
                  controls.minDistance,
                  controls.maxDistance,
                );
                const blocked = reconcileMinecraftCameraRig(
                  runtime,
                  previousCamera,
                  previousTarget,
                );
                if (blocked) {
                  signedPinchDolly = createSignedPinchDolly(
                    camera,
                    controls.target,
                  );
                } else {
                  const underside = signedDistance < 0;
                  if (underside !== runtime.underside) {
                    setModelMaterialState(runtime, underside);
                  }
                }
              } else {
                zoomAtClientPoint(current.center, pinchRatio);
              }
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
          controls.getPolarAngle() +
            (center.y - previousThreeFingerCenter.y) * 0.006,
          0.08,
          Math.PI - 0.08,
        );
        setOrbitAngles(runtime, {
          azimuth:
            controls.getAzimuthalAngle() +
            (center.x - previousThreeFingerCenter.x) * 0.008,
          polar,
        });
        if (polar > Math.PI / 2 !== runtime.underside) {
          setModelMaterialState(runtime, polar > Math.PI / 2);
        }
        previousThreeFingerCenter = center;
      };
      const onPointerUp = (event: PointerEvent) => {
        if (pedestrianLookPointer?.id === event.pointerId) {
          const finishedPointer = pedestrianLookPointer;
          pedestrianLookPointer = null;
          controlsInteracting = false;
          touchInteracting = false;
          if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
            try {
              renderer.domElement.releasePointerCapture?.(event.pointerId);
            } catch {
              // A cancelled or already-released pointer needs no cleanup.
            }
          }
          if (
            finishedPointer.pointerType === "touch" &&
            !finishedPointer.cancelled
          ) {
            const endedAt = performance.now();
            const tap: PedestrianTouchTap = {
              at: endedAt,
              durationMs: endedAt - finishedPointer.startedAt,
              maxTravelPx: Math.max(
                finishedPointer.maxTravelPx,
                Math.hypot(
                  finishedPointer.x - finishedPointer.startX,
                  finishedPointer.y - finishedPointer.startY,
                ),
              ),
              x: finishedPointer.x,
              y: finishedPointer.y,
            };
            if (isPedestrianJumpDoubleTap(lastPedestrianTap, tap)) {
              lastPedestrianTap = null;
              triggerPedestrianJump(runtime);
            } else {
              lastPedestrianTap = isPedestrianTouchTap(tap) ? tap : null;
            }
          } else {
            lastPedestrianTap = null;
          }
          notifyView(runtime, onViewChangeRef.current);
          return;
        }
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
            signedPinchDolly = null;
            panVelocity.x = 0;
            panVelocity.y = 0;
            panVelocitySampleAt = performance.now();
            return;
          }
          previousTwoFingerGesture = null;
          twoFingerStart = null;
          twoFingerMode = "undecided";
          signedPinchDolly = null;
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
          }
          controls.enabled = !runtime.pedestrian.enabled;
          notifyView(runtime, onViewChangeRef.current);
          return;
        }
        if (touchPoints.size < 3) {
          controls.enabled = !runtime.pedestrian.enabled;
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
        // Never retain the first half of a pedestrian double-tap across a
        // hidden tab, mode transition or cancelled browser gesture.
        lastPedestrianTap = null;
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
        signedPinchDolly = null;
        previousThreeFingerCenter = null;
        customTouchGestureActive = false;
        controlsInteracting = false;
        touchInteracting = false;
        panMomentum.x = 0;
        panMomentum.y = 0;
        pedestrianLookPointer = null;
        controls.enabled = !runtime.pedestrian.enabled;
        notifyView(runtime, onViewChangeRef.current);
      };
      const onVisibilityChange = () => {
        if (document.hidden) {
          resetTouchGesture();
          cancelScheduledProgressiveWorld(runtime);
          if (
            progressiveWorldVisibilityTransition(
              true,
              runtime.progressiveWorldState,
            ) === "pause"
          ) {
            stopProgressiveWorld(runtime);
          }
        } else {
          runtime.berlinerEnsembleRoofSignLastFrameAt = performance.now();
          runtime.schwellenraumLastWaterFrameAt = performance.now();
          runtime.renderInvalidated = true;
          if (
            progressiveWorldVisibilityTransition(
              false,
              runtime.progressiveWorldState,
            ) === "resume"
          ) {
            applyProgressiveWorldMode(
              runtime,
              runtime.lightingMode,
              onWarningRef.current,
            );
          }
          if (
            runtime.coarsePointer &&
            isoWorldIntentActive(runtime) &&
            (runtime.progressiveWorldState === "complete" ||
              runtime.progressiveWorldState === "failed" ||
              !runtime.progressiveWorldInput)
          ) {
            runtime.startDeferredDetails();
          }
        }
      };
      const onPageHide = () => {
        resetTouchGesture();
        cancelScheduledProgressiveWorld(runtime);
        if (runtime.progressiveWorldState === "loading") {
          stopProgressiveWorld(runtime);
        }
      };
      const onPageShow = (event: PageTransitionEvent) => {
        if (!event.persisted) return;
        resize(true);
        onVisibilityChange();
      };
      const onDoubleClick = (event: MouseEvent) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        renderer.domElement.focus({ preventScroll: true });
        if (runtime.pedestrian.enabled) {
          // A touch double-tap is the jump gesture. Ignore the synthetic
          // mouse dblclick that some mobile browsers dispatch afterwards so
          // the same gesture never toggles sprint as a side effect.
          if (performance.now() - lastTouchActivityAt < 700) {
            return;
          }
          requestPedestrianSprintToggle();
          markSurfaceInteraction(runtime);
          return;
        }
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
        if (pedestrianLookPointer?.id === event.pointerId) {
          pedestrianLookPointer.cancelled = true;
        }
        onPointerUp(event);
      };
      renderer.domElement.addEventListener("pointerup", onPointerUp, true);
      renderer.domElement.addEventListener(
        "pointercancel",
        onPointerCancel,
        true,
      );
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
      window.addEventListener("pagehide", onPageHide);
      window.addEventListener("pageshow", onPageShow);
      document.addEventListener("visibilitychange", onVisibilityChange);
      const onControlsStart = () => {
        lastDirectControlCamera.copy(camera.position);
        lastDirectControlTarget.copy(controls.target);
        controlsInteracting = true;
        markSurfaceInteraction(runtime);
      };
      const onControlsChange = () => {
        if (controlsInteracting) {
          reconcileMinecraftCameraRig(
            runtime,
            lastDirectControlCamera,
            lastDirectControlTarget,
          );
        }
        lastDirectControlCamera.copy(camera.position);
        lastDirectControlTarget.copy(controls.target);
      };
      const onControlsEnd = () => {
        controlsInteracting = false;
        lastDirectControlCamera.copy(camera.position);
        lastDirectControlTarget.copy(controls.target);
        markSurfaceInteraction(runtime);
        notifyView(runtime, onViewChangeRef.current);
      };
      controls.addEventListener("start", onControlsStart);
      controls.addEventListener("change", onControlsChange);
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

      let lastRenderedAt = Number.NEGATIVE_INFINITY;
      let lastAnimateAt = Number.NEGATIVE_INFINITY;
      let wasFlying = false;
      let wasPanning = false;
      let wasOrbiting = false;
      let wasWalking = false;
      const applyContinuousPedestrian = (dtSeconds: number): boolean => {
        const pedestrian = runtime.pedestrian;
        const environment = pedestrian.environment;
        const state = pedestrian.state;
        if (!pedestrian.enabled || !environment || !state) {
          if (wasWalking) {
            wasWalking = false;
            notifyView(runtime, onViewChangeRef.current);
          }
          return false;
        }
        const input = pedestrianInputRef.current;
        const inputActive =
          Math.abs(input.forward) > 1e-6 ||
          Math.abs(input.strafe) > 1e-6 ||
          Math.abs(input.turn) > 1e-6 ||
          Math.abs(input.look) > 1e-6;
        const result = stepPedestrian(state, input, dtSeconds, environment);
        pedestrian.state = result.state;
        if (result.state.insideTunnel !== state.insideTunnel) {
          syncPedestrianTunnelPresentation(runtime, result.state.insideTunnel);
        }
        if (result.respawned) {
          onPedestrianRespawnRef.current();
        }
        const changed = result.changed || pedestrian.cameraDirty;
        if (changed) {
          applyPedestrianCamera(runtime);
          markSurfaceInteraction(runtime, 220);
        }
        if (inputActive || !result.state.grounded) {
          wasWalking = true;
        } else if (wasWalking) {
          wasWalking = false;
          notifyView(runtime, onViewChangeRef.current);
        }
        return changed;
      };
      const applyContinuousFlight = (dtSeconds: number): boolean => {
        const input = flightInputRef.current;
        if (input.lengthSq() < 1e-6) {
          if (wasFlying) {
            wasFlying = false;
            notifyView(runtime, onViewChangeRef.current);
          }
          return false;
        }
        wasFlying = true;
        const distance = camera.position.distanceTo(controls.target);
        const { horizontal: speed, vertical: verticalSpeed } =
          continuousFlightSpeeds(distance);
        const heading = controls.target.clone().sub(camera.position);
        heading.y = 0;
        if (heading.lengthSq() < 1e-6) {
          camera.getWorldDirection(heading);
          heading.y = 0;
        }
        heading.normalize();
        const right = new Vector3()
          .crossVectors(heading, camera.up)
          .normalize();
        const move = heading
          .multiplyScalar(input.z * speed * dtSeconds)
          .add(right.multiplyScalar(input.x * speed * dtSeconds));
        move.y += input.y * verticalSpeed * dtSeconds;
        applyBoundedCameraRigTranslation(runtime, move);
        markSurfaceInteraction(runtime, 220);
        return true;
      };
      const applyContinuousPan = (dtSeconds: number): boolean => {
        const input = panInputRef.current;
        if (input.lengthSq() < 1e-6) {
          if (wasPanning) {
            wasPanning = false;
            notifyView(runtime, onViewChangeRef.current);
          }
          return false;
        }
        wasPanning = true;
        camera.updateMatrixWorld();
        const distance = camera.position.distanceTo(controls.target);
        const { horizontal: speed } = continuousFlightSpeeds(distance);
        const right = new Vector3()
          .setFromMatrixColumn(camera.matrixWorld, 0)
          .normalize();
        const up = new Vector3()
          .setFromMatrixColumn(camera.matrixWorld, 1)
          .normalize();
        const move = right
          .multiplyScalar(input.x * speed * dtSeconds)
          .add(up.multiplyScalar(input.y * speed * dtSeconds));
        applyBoundedCameraRigTranslation(runtime, move);
        markSurfaceInteraction(runtime, 220);
        return true;
      };
      const applyContinuousOrbit = (dtSeconds: number): boolean => {
        const input = orbitInputRef.current;
        if (input.lengthSq() < 1e-6) {
          if (wasOrbiting) {
            wasOrbiting = false;
            notifyView(runtime, onViewChangeRef.current);
          }
          return false;
        }
        wasOrbiting = true;
        const nextPolar = MathUtils.clamp(
          controls.getPolarAngle() -
            MathUtils.degToRad(input.y * 38 * dtSeconds),
          0.08,
          Math.PI - 0.08,
        );
        setOrbitAngles(runtime, {
          azimuth:
            controls.getAzimuthalAngle() +
            MathUtils.degToRad(input.x * 52 * dtSeconds),
          polar: nextPolar,
        });
        const underside = nextPolar > Math.PI / 2;
        if (underside !== runtime.underside) {
          setModelMaterialState(runtime, underside);
        }
        markSurfaceInteraction(runtime, 220);
        return true;
      };
      const roofSignScreenScratch = new Vector3();
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
          !runtime.pedestrian.enabled &&
          !controls.enabled &&
          (!customTouchGestureActive ||
            touchPoints.size < 2 ||
            timestamp - lastTouchActivityAt > 10_000)
        ) {
          resetTouchGesture();
        }
        const pedestrianMoving = applyContinuousPedestrian(dtSeconds);
        const panning = runtime.pedestrian.enabled
          ? false
          : applyContinuousPan(dtSeconds);
        const orbiting = runtime.pedestrian.enabled
          ? false
          : applyContinuousOrbit(dtSeconds);
        const flying =
          !runtime.pedestrian.enabled && applyContinuousFlight(dtSeconds);
        const controlsChanged = runtime.pedestrian.enabled
          ? false
          : controls.update();
        const directInputActive = renderInteractionActive({
          controls: controlsInteracting,
          touch: touchInteracting,
          // Every wheel event invalidates one frame itself. Keeping a virtual
          // wheel interaction alive for 180 ms only redrew identical frames
          // after the trackpad had stopped and reopened the shimmer window.
          wheel: false,
        });
        const stabilized = runtime.pedestrian.enabled
          ? { changed: false, pose: lastSafeCameraPose, recovered: false }
          : stabilizeCameraRig(
              camera,
              controls.target,
              lastSafeCameraPose,
              controls.minDistance,
              controls.maxDistance,
            );
        if (!runtime.pedestrian.enabled) {
          lastSafeCameraPose = stabilized.pose;
        }
        if (stabilized.recovered) {
          resetTouchGesture();
        }
        const stability = minecraftStabilityPolicy(runtime.lightingMode);
        const flagFrameIntervalMs = civicFlagFrameIntervalMs(
          runtime.coarsePointer,
        );
        const movingFlagCount =
          stability.animateWind &&
          !runtime.underside &&
          runtime.fineDetailVisible &&
          document.visibilityState !== "hidden"
            ? runtime.schwellenraumMovingFlagCount
            : 0;
        const schwellenraumMotion = schwellenraumMotionDecision({
          flagFrameIntervalMs,
          lastFlagFrameAt: runtime.schwellenraumLastFlagFrameAt,
          lastWaterFrameAt: runtime.schwellenraumLastWaterFrameAt,
          minecraftMobsVisible: runtime.minecraftMobs?.group.visible === true,
          mode: runtime.lightingMode,
          movingFlagCount,
          rainVisible: runtime.rain.group.visible,
          reducedMotion,
          snowVisible: snowfallAnimationActive(runtime.snowstorm),
          timestamp,
          waterLightCount: runtime.schwellenraumWaterLightCount,
        });
        const roofSignMotion = berlinerEnsembleRoofSignMotionDecision({
          enabled: runtime.berlinerEnsembleRoofSignTargets.length > 0,
          fineDetailVisible: runtime.fineDetailVisible,
          frameIntervalMs: flagFrameIntervalMs,
          hidden: document.visibilityState === "hidden",
          lastFrameAt: runtime.berlinerEnsembleRoofSignLastFrameAt,
          onScreen: isBerlinerEnsembleRoofSignOnScreen(
            runtime.berlinerEnsembleRoofSignTargets,
            camera,
            roofSignScreenScratch,
          ),
          reducedMotion,
          timestamp,
          underside: runtime.underside,
        });
        const environmentalMotion =
          schwellenraumMotion.environmentalMotion ||
          roofSignMotion.environmentalMotion;
        // A still camera must let Minecraft settle to one calm frame instead
        // of re-voxelising forever (the "Flirren"); motion still drives the
        // active cadence through the terms below.
        const cameraMoving =
          flying ||
          panning ||
          orbiting ||
          pedestrianMoving ||
          directInputActive ||
          controlsChanged ||
          stabilized.changed;
        const isMoving =
          cameraMoving ||
          stability.forceContinuousRender ||
          environmentalMotion;
        // Resolution and official-surface tiers are fixed for a viewport and
        // mode. Input must never resize the canvas or replace the complete
        // city/tree surface underneath a moving camera.
        setSurfacePresentation(runtime, stability.pinInteractionSurface);
        // Far-zoom anti-flicker (v0.53.0): ink lines and small accessory
        // layers are dampened by a pure function of distance, so the picture
        // is identical for a given standoff no matter how the camera got
        // there, and never re-pops when motion stops.
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
        const renderRequired = renderFrameRequired({
          cameraMoving,
          environmentalMotion,
          presentationChanged: farDetailChanged,
          renderInvalidated: runtime.renderInvalidated,
        });
        if (!renderRequired) {
          return;
        }
        const frameIntervalMs = isMoving ? ACTIVE_MOTION_FRAME_INTERVAL_MS : 0;
        if (timestamp - lastRenderedAt < frameIntervalMs) {
          return;
        }
        lastRenderedAt = timestamp;
        // The cutaway also engages when the camera itself flies into the
        // Tiergartentunnel tube, not only when orbiting below the horizon.
        const physicallyInsideTunnel =
          runtime.pedestrian.state?.insideTunnel === true ||
          (!runtime.pedestrian.enabled &&
            runtime.tunnelInteriorAt?.(
              camera.position.x,
              camera.position.y,
              camera.position.z,
            ) === true);
        if (physicallyInsideTunnel !== runtime.cameraInsideTunnel) {
          runtime.cameraInsideTunnel = physicallyInsideTunnel;
          if (!runtime.pedestrian.enabled) {
            setTunnelPresentation(
              runtime.tunnel,
              runtime.underside,
              physicallyInsideTunnel,
            );
            setTunnelPortalPresentation(
              runtime.tunnelPortals,
              runtime.underside,
              voxelModeActive(runtime),
              physicallyInsideTunnel,
            );
            setEnvironmentalPresentation(runtime);
          }
        }
        const framedPortal = runtime.tunnelPortalInteriorVisible;
        const underside =
          !runtime.pedestrian.enabled &&
          !framedPortal &&
          controls.getPolarAngle() > Math.PI / 2;
        if (underside !== runtime.underside) {
          setModelMaterialState(runtime, underside);
          notifyView(runtime, onViewChangeRef.current);
        }
        setUnderwaterPresentation(
          runtime,
          shouldUseUnderwaterPresentation({
            cameraY: camera.position.y,
            insideTunnel: physicallyInsideTunnel || framedPortal,
            underside,
          }),
        );
        if (schwellenraumMotion.animateOrdinaryEnvironment) {
          updateModerateRain(
            runtime.rain,
            reducedMotion ? dtSeconds * 0.45 : dtSeconds,
            controls.target,
            runtime.lightingMode,
          );
          updateSnowstorm(
            runtime.snowstorm,
            reducedMotion ? dtSeconds * 0.38 : dtSeconds,
            controls.target,
          );
          if (runtime.minecraftMobs?.group.visible) {
            updateMinecraftMobs(
              runtime.minecraftMobs,
              reducedMotion ? dtSeconds * 0.35 : dtSeconds,
            );
          }
        } else {
          if (schwellenraumMotion.animateWaterLight) {
            runtime.schwellenraumWaterElapsedSeconds +=
              SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS / 1_000;
            updateSchwellenraumWaterAtmosphere(
              schwellenraumWaterRoots(runtime),
              runtime.schwellenraumWaterElapsedSeconds,
              reducedMotion,
            );
            runtime.schwellenraumLastWaterFrameAt = timestamp;
          }
        }
        if (schwellenraumMotion.animateFlags) {
          runtime.schwellenraumFlagElapsedSeconds += flagFrameIntervalMs / 1000;
          updateSchwellenraumMovingFlags(
            [runtime.signatures, runtime.civicDetails],
            runtime.schwellenraumFlagElapsedSeconds,
          );
          runtime.schwellenraumLastFlagFrameAt = timestamp;
        }
        if (roofSignMotion.animate) {
          runtime.berlinerEnsembleRoofSignElapsedSeconds +=
            flagFrameIntervalMs / 1_000;
          updateBerlinerEnsembleRoofSign(
            runtime.berlinerEnsembleRoofSignTargets,
            runtime.berlinerEnsembleRoofSignElapsedSeconds,
          );
          runtime.berlinerEnsembleRoofSignLastFrameAt = timestamp;
        }
        // Momentum glide: the released pan eases out smoothly.
        if (
          !runtime.pedestrian.enabled &&
          (panMomentum.x !== 0 || panMomentum.y !== 0) &&
          touchPoints.size === 0
        ) {
          const { strafe, forward } = twoFingerPanFlight(
            panMomentum.x * dtSeconds,
            panMomentum.y * dtSeconds,
          );
          flyCameraRigAlongViewHeading(runtime, strafe, forward);
          const decayed = decayPanMomentum(panMomentum, dtSeconds);
          panMomentum.x = decayed.x;
          panMomentum.y = decayed.y;
          if (panMomentum.x === 0 && panMomentum.y === 0 && touchInteracting) {
            touchInteracting = false;
          }
          markSurfaceInteraction(runtime, 220);
        }
        // Every profile is deliberately neutral: world-space ink carries the
        // drawing, and screen-neighbour sharpening is forbidden because it
        // amplifies sub-pixel motion. Keep this no-op pass disabled instead of
        // spending one full-screen half-float read/write on every frame. Day,
        // Night and Minecraft all use the same RenderPass -> SMAA chain during
        // movement and at rest, so this performance win cannot create a
        // quality-switch flash.
        crispPass.enabled = false;
        composer.render();
        runtime.renderInvalidated = false;
      };
      animate();

      const sceneManifestPromise = fetchJsonWithRetry<SceneManifest>(sceneUrl, {
        signal: loadController.signal,
      });
      primeRequestedWorldPayloads(runtime, lightingModeRef.current);
      void sceneManifestPromise
        .then(async (manifest) => {
          if (disposed) {
            return;
          }
          runtime.landmarkByName = new Map(
            manifest.landmarks.map((landmark) => [landmark.name, landmark]),
          );
          runtime.civicDetails.removeFromParent();
          runtime.civicDetails = createCivicLandmarks(manifest.landmarks);
          runtime.civicDetails.visible = civicDetailsVisible(runtime.underside);
          markAuthoredFlatUnlit(runtime.civicDetails);
          scene.add(runtime.civicDetails);
          applyLightingToRoot(
            runtime.civicDetails,
            runtime.lightingMode,
            runtime.nightLightsOn,
          );
          updateWindFlags(
            runtime.civicDetails,
            runtime.schwellenraumFlagElapsedSeconds,
          );
          refreshSchwellenraumMovingFlagCount(runtime);
          if (runtime.lightingMode === "minecraft") {
            setMinecraftMaterialPresentation(
              runtime.civicDetails,
              runtime.minecraftMaterialState,
              true,
            );
          }
          runtime.centralDetails.removeFromParent();
          runtime.centralDetails = createCentralCivicDetails(
            manifest.landmarks,
          );
          runtime.centralDetails.visible = centralCivicDetailsVisible(
            runtime.underside,
          );
          scene.add(runtime.centralDetails);
          applyLightingToRoot(
            runtime.centralDetails,
            runtime.lightingMode,
            runtime.nightLightsOn,
          );
          setBerlinerEnsemblePublicArtSnow(
            runtime.centralDetails,
            runtime.lightingMode === "snowstorm",
          );
          if (runtime.lightingMode === "minecraft") {
            setMinecraftMaterialPresentation(
              runtime.centralDetails,
              runtime.minecraftMaterialState,
              true,
            );
          }
          setMinecraftArchitecturePresentation(
            runtime.signatures,
            runtime.centralDetails,
            voxelModeActive(runtime),
          );
          applyMinecraftVisibility(
            minecraftVisibilityRoots(runtime),
            voxelModeActive(runtime),
          );
          setWindFlagWinterPresentation(
            runtime.civicDetails,
            runtime.lightingMode === "snowstorm",
          );
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
            distance_m: 32,
            fov_degrees: 30,
            polar_degrees: 78,
            target_height_m: 25,
            target_world: [417.9, 4.73, 301.42],
          });
          // The generic park camera leaves the Luiseninsel buried under a
          // canopy at quarter scale. A high, close garden view reveals the
          // water ring, Schmuckbeete and paired marble figures together.
          runtime.focusCameraByName.set("Luiseninsel", {
            azimuth_degrees: 24,
            distance_m: 126,
            fov_degrees: 34,
            polar_degrees: 39,
            target_height_m: 0,
            target_world: [-495.66, 4.35, 879.81],
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
          // Both Hauptbahnhof crossings are long, low structures. The generic
          // 190 m landmark framing made their construction unreadable, so use
          // stable oblique views that show deck, side girder and supports at
          // once without cropping either bank.
          runtime.focusCameraByName.set("Gustav-Heinemann-Brücke", {
            azimuth_degrees: 65,
            distance_m: 122,
            polar_degrees: 63,
            target_height_m: 0,
            target_world: [-36.9, 8, -445.17],
          });
          runtime.focusCameraByName.set("Hugo-Preuß-Brücke", {
            azimuth_degrees: 35,
            distance_m: 138,
            polar_degrees: 61,
            target_height_m: 0,
            target_world: [57.3, 8, -517.71],
          });
          // The forecourt wings span roughly 72 m (T-34 hulls at +/-33 m,
          // ML-20 howitzers farther in at +/-24 m); a south approach at 145 m
          // with a steep polar
          // angle is the framing that keeps both wings in frame at once
          // instead of cropping one tank and one gun off-screen, which is
          // what the generic distance-only fallback used to do.
          runtime.focusCameraByName.set("Sowjetisches Ehrenmal Tiergarten", {
            // Spherical azimuth 0 is +z: the Strasse des 17. Juni side.
            azimuth_degrees: 0,
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
            manifest.hero_details.map((detail) => [
              detail.landmark_name,
              detail,
            ]),
          );
          for (const signature of manifest.architectural_signatures ?? []) {
            const model = createArchitecturalSignature(signature);
            if (model) {
              markAuthoredFlatUnlit(model);
              runtime.signatures.add(model);
            }
            const focusCamera = focusCameraForSignature(signature);
            if (focusCamera) {
              runtime.focusCameraByName.set(
                signature.landmark_name,
                focusCamera,
              );
            }
          }
          applyLightingToRoot(
            runtime.signatures,
            runtime.lightingMode,
            runtime.nightLightsOn,
          );
          updateWindFlags(
            runtime.signatures,
            runtime.schwellenraumFlagElapsedSeconds,
          );
          refreshSchwellenraumMovingFlagCount(runtime);
          if (runtime.lightingMode === "minecraft") {
            setMinecraftMaterialPresentation(
              runtime.signatures,
              runtime.minecraftMaterialState,
              true,
            );
          }
          setMinecraftArchitecturePresentation(
            runtime.signatures,
            runtime.centralDetails,
            voxelModeActive(runtime),
          );
          applyMinecraftVisibility(
            minecraftVisibilityRoots(runtime),
            voxelModeActive(runtime),
          );
          setWindFlagWinterPresentation(
            runtime.signatures,
            runtime.lightingMode === "snowstorm",
          );
          runtime.monuments.removeFromParent();
          runtime.monuments = createMemorialLandmarks(manifest.landmarks);
          runtime.monuments.add(createKrolloperSculptureEnsemble());
          runtime.monuments.add(createQueerRainbowMemorial());
          runtime.monuments.add(createCsdAttackMemorial());
          runtime.monuments.add(createSonyCenterForumRoof());
          runtime.focusCameraByName.set(QUEER_RAINBOW_MEMORIAL_PROFILE.name, {
            azimuth_degrees: -18,
            distance_m: 20,
            fov_degrees: 39,
            polar_degrees: 72,
            target_height_m: 2.1,
            target_world: [...QUEER_RAINBOW_MEMORIAL_PROFILE.worldM],
          });
          runtime.focusCameraByName.set(CSD_ATTACK_MEMORIAL_PROFILE.name, {
            azimuth_degrees: -124,
            distance_m: 23,
            fov_degrees: 39,
            polar_degrees: 70,
            target_height_m: 2.1,
            target_world: [...CSD_ATTACK_MEMORIAL_PROFILE.worldM],
          });
          runtime.monuments.userData.modelCount =
            runtime.monuments.children.length;
          markAuthoredFlatUnlit(runtime.monuments);
          setQueerRainbowMemorialSnow(
            runtime.monuments,
            runtime.lightingMode === "snowstorm",
          );
          setCsdAttackMemorialSnow(
            runtime.monuments,
            runtime.lightingMode === "snowstorm",
          );
          setTiergartenLiteraryMemorialSmoothVisibility(
            runtime.monuments,
            !voxelModeActive(runtime),
          );
          setTiergartenLiteraryMemorialsSnow(
            runtime.monuments,
            runtime.lightingMode === "snowstorm",
          );
          scene.add(runtime.monuments);
          applyLightingToRoot(
            runtime.monuments,
            runtime.lightingMode,
            runtime.nightLightsOn,
          );
          // The monuments arrive independently of the drawn-world/park
          // builders. Register their thin guard, offerings and bench slats
          // immediately so a cold Minecraft start receives the same stable
          // far-distance fade as Day without waiting for a later park load.
          collectFarZoomAntiFlickerTargets(runtime);
          runtime.culturalDetails.removeFromParent();
          runtime.culturalDetails = createCulturalLandmarks(manifest.landmarks);
          const expandedDetails = createExpandedCityDetails(manifest.landmarks);
          setInvalidenfriedhofSnow(
            expandedDetails,
            runtime.lightingMode === "snowstorm",
          );
          const tillaDurieux = expandedDetails.getObjectByName(
            "Tilla-Durieux-Park lawn sculpture",
          );
          if (tillaDurieux) {
            // Terrain remains terrain in Minecraft too. Keep the authored
            // counter-slope with the mode-independent signature layer while
            // the rest of the fine cultural props can still be culled.
            tillaDurieux.removeFromParent();
            runtime.signatures.add(tillaDurieux);
            applyLightingToRoot(
              tillaDurieux,
              runtime.lightingMode,
              runtime.nightLightsOn,
            );
          }
          runtime.culturalDetails.add(expandedDetails);
          scene.add(runtime.culturalDetails);
          setStarbucksPariserPlatzSnow(
            runtime.culturalDetails,
            runtime.lightingMode === "snowstorm",
          );
          applyLightingToRoot(
            runtime.culturalDetails,
            runtime.lightingMode,
            runtime.nightLightsOn,
          );
          // Cultural details arrive after the initial anti-flicker scan. Add
          // the thin storefront mullions, lettering and Adlon facade accents
          // immediately so late-loaded close detail remains stable at range.
          collectFarZoomAntiFlickerTargets(runtime);
          if (runtime.lightingMode === "minecraft") {
            setMinecraftMaterialPresentation(
              scene,
              runtime.minecraftMaterialState,
              true,
            );
          }
          applyMinecraftVisibility(
            minecraftVisibilityRoots(runtime),
            voxelModeActive(runtime),
          );
          for (const landmark of manifest.landmarks) {
            const focusCamera = culturalFocusCamera(landmark.name);
            if (focusCamera) {
              runtime.focusCameraByName.set(landmark.name, focusCamera);
            }
            const expandedFocusCamera = expandedCityFocusCamera(landmark);
            if (expandedFocusCamera) {
              runtime.focusCameraByName.set(landmark.name, expandedFocusCamera);
            }
            const centralFocusCamera = centralCivicFocusCamera(landmark);
            if (centralFocusCamera) {
              runtime.focusCameraByName.set(landmark.name, centralFocusCamera);
            }
          }
          let deferredDetailsStarted = false;
          runtime.startDeferredDetails = () => {
            if (deferredDetailsStarted || !manifest.park_details?.file) {
              return;
            }
            if (
              runtime.coarsePointer &&
              (document.hidden ||
                !isoWorldIntentActive(runtime) ||
                runtime.progressiveWorldState === "loading" ||
                runtime.progressiveWorldStartCancel !== undefined ||
                (runtime.progressiveWorldInput !== undefined &&
                  runtime.progressiveWorldState === "idle"))
            ) {
              return;
            }
            deferredDetailsStarted = true;
            const loadParkDetails = (): void => {
              if (runtime.disposed) {
                return;
              }
              if (
                runtime.coarsePointer &&
                (document.hidden || !isoWorldIntentActive(runtime))
              ) {
                deferredDetailsStarted = false;
                return;
              }
              const parkUrl = new URL(
                manifest.park_details!.file,
                runtime.sceneRootUrl,
              );
              void fetchJsonWithRetry<ParkDetailsPayload>(parkUrl, {
                signal: loadController.signal,
              })
                .then((payload) => {
                  if (runtime.disposed) {
                    return;
                  }
                  if (
                    runtime.coarsePointer &&
                    (document.hidden || !isoWorldIntentActive(runtime))
                  ) {
                    deferredDetailsStarted = false;
                    return;
                  }
                  if (runtime.pedestrian.environment) {
                    addPedestrianParkObstacles(
                      runtime.pedestrian.environment,
                      payload,
                      runtime.tunnelPortalCourse,
                    );
                  }
                  const details = createParkDetails(payload, {
                    detailProfile: runtime.coarsePointer ? "mobile" : "full",
                    settledDetail: !runtime.coarsePointer,
                    tunnel: manifest.tiergartentunnel ?? null,
                  });
                  runtime.parkDetails.removeFromParent();
                  runtime.parkDetails = details;
                  const voxelMode = voxelModeActive(runtime);
                  details.visible = !runtime.underside && !voxelMode;
                  setParkDetailsFocus(details, selectedRef.current);
                  scene.add(details);
                  applyLightingToRoot(
                    details,
                    runtime.lightingMode,
                    runtime.nightLightsOn,
                  );
                  if (
                    runtime.lightingMode === "minecraft" &&
                    !voxelMode
                  ) {
                    // Only the smooth fallback needs toon clones. A completed
                    // voxel world keeps this large deferred layer hidden, so
                    // cloning thousands of its materials would waste mobile
                    // memory without producing a pixel.
                    setMinecraftMaterialPresentation(
                      details,
                      runtime.minecraftMaterialState,
                      true,
                    );
                  }
                  setEnvironmentalPresentation(runtime);
                  collectFarZoomAntiFlickerTargets(runtime);
                  runtime.renderInvalidated = true;
                })
                .catch((error: unknown) => {
                  if (
                    !runtime.disposed &&
                    !(
                      error instanceof DOMException &&
                      error.name === "AbortError"
                    )
                  ) {
                    onWarningRef.current(
                      error instanceof Error
                        ? error.message
                        : "Optionale Parkdetails konnten nicht geladen werden.",
                    );
                  }
                });
            };
            const requestIdle = (
              window as unknown as {
                requestIdleCallback?: (
                  callback: IdleRequestCallback,
                  options?: IdleRequestOptions,
                ) => number;
              }
            ).requestIdleCallback;
            if (typeof requestIdle === "function") {
              requestIdle(loadParkDetails, { timeout: 3_000 });
            } else {
              window.setTimeout(loadParkDetails, 1_200);
            }
          };
          runtime.tunnel = createTunnel(manifest.tiergartentunnel);
          runtime.tunnelPoints = manifest.tiergartentunnel.points;
          runtime.tunnelPortalCourse = manifest.tiergartentunnel;
          runtime.tunnelInteriorAt = createTunnelInteriorTester(
            manifest.tiergartentunnel,
          );
          scene.add(runtime.tunnel);
          runtime.tunnelPortals.removeFromParent();
          runtime.tunnelPortals = createTunnelPortals(
            manifest.tiergartentunnel,
          );
          // Portal-mouth presets use a low exterior stand on the measured
          // approach. Entering the connected bore remains entirely manual.
          const mouthViews = tunnelMouthViews(manifest.tiergartentunnel);
          if (mouthViews) {
            runtime.focusCameraByName.set(
              "Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz)",
              mouthViews.south,
            );
            runtime.focusCameraByName.set(
              "Kemperplatz / Tiergartentunnel",
              mouthViews.kemperplatz ?? mouthViews.south,
            );
            runtime.focusCameraByName.set(
              "Spreebogen",
              mouthViews.invalidenstrasse ?? mouthViews.north,
            );
          }
          markAuthoredFlatUnlit(runtime.tunnelPortals);
          scene.add(runtime.tunnelPortals);
          runtime.tunnelPortalInteriorVisible = isTunnelPortalFocus(
            selectedRef.current,
          );
          setTunnelPortalPresentation(
            runtime.tunnelPortals,
            runtime.underside,
            voxelModeActive(runtime),
            runtime.tunnelPortalInteriorVisible,
          );
          applyLightingToRoot(
            runtime.tunnelPortals,
            runtime.lightingMode,
            runtime.nightLightsOn,
          );
          runtime.ensurePhotoSurface = () => {
            if (
              runtime.disposed ||
              runtime.photoSurfaceState === "loading" ||
              runtime.photoSurfaceState === "ready" ||
              runtime.photoSurfaceState === "failed"
            ) {
              return;
            }
            if (runtime.coarsePointer) {
              // Never answer a mobile OOM/context-loss path by allocating the
              // old photogrammetry.  Report once so App can remount the lean
              // renderer and, if that also fails, offer an explicit 2D action.
              runtime.photoSurfaceState = "failed";
              onErrorRef.current(
                "Die mobile 3D-Welt konnte nicht stabil geladen werden.",
              );
              return;
            }
            runtime.photoSurfaceState = "loading";
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
            let loadedBaseTiles = 0;
            setProgress({ loaded: 0, total: sortedTiles.length });
            void runBoundedTasks(
              sortedTiles,
              coarsePointer ? 1 : 2,
              async (file) => {
                const loaded = await loadModelWithRetry(
                  runtime,
                  file,
                  runtime.interactionSurface,
                  { detail: false },
                );
                if (!loaded || runtime.disposed) {
                  return;
                }
                loadedBaseTiles += 1;
                runtime.baseSurfaceReady = true;
                setProgress((current) => ({
                  ...current,
                  loaded: current.loaded + 1,
                }));
                setSurfacePresentation(runtime, true);
                notifyPresentationReadyWhenPossible(runtime);
              },
              { shouldStop: () => runtime.disposed },
            )
              .then((failures) => {
                if (runtime.disposed) {
                  return;
                }
                if (loadedBaseTiles === 0) {
                  throw new Error(
                    "Keine 3D-Ersatzkachel konnte geladen werden",
                  );
                }
                runtime.photoSurfaceState = "ready";
                if (failures.length > 0) {
                  setProgress((current) => ({
                    ...current,
                    total: Math.max(
                      current.loaded,
                      current.total - failures.length,
                    ),
                  }));
                  onWarningRef.current(
                    `${failures.length} optionale 3D-Ersatzkachel(n) konnten nicht geladen werden.`,
                  );
                }
                setSurfacePresentation(runtime, true);
                notifyPresentationReadyWhenPossible(runtime);
              })
              .catch((error: unknown) => {
                if (runtime.disposed) {
                  return;
                }
                runtime.photoSurfaceState = "failed";
                const message =
                  error instanceof Error
                    ? error.message
                    : "Die 3D-Ersatzansicht konnte nicht geladen werden.";
                if (currentStartupPresentationStatus(runtime) === "fallback") {
                  onErrorRef.current(message);
                } else {
                  onWarningRef.current(message);
                }
              });
          };

          focusLandmark(selectedRef.current, true);
          // Build exactly the world requested for the first visible frame.
          // Switching mode later triggers the other lazy builder through the
          // lighting effect. The 31 MiB photographic shell remains a true
          // failure/underside fallback and is never downloaded invisibly.
          if (lightingModeRef.current === "minecraft") {
            ensureVoxelWorld(runtime, onWarningRef.current);
          } else {
            ensureIsoWorld(runtime, onWarningRef.current);
          }
          setModelMaterialState(runtime, runtime.underside);
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
        loadController.abort();
        cancelScheduledProgressiveWorld(runtime);
        runtime.progressiveWorldWorker?.terminate();
        runtime.progressiveWorldWorker = undefined;
        runtime.progressiveWorldState = "idle";
        runtime.progressiveWorldBatches = [];
        window.cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        renderer.domElement.removeEventListener(
          "pointerdown",
          onPointerDown,
          true,
        );
        renderer.domElement.removeEventListener(
          "pointermove",
          onPointerMove,
          true,
        );
        renderer.domElement.removeEventListener("pointerup", onPointerUp, true);
        renderer.domElement.removeEventListener(
          "pointercancel",
          onPointerCancel,
          true,
        );
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
        renderer.domElement.removeEventListener(
          "webglcontextlost",
          onContextLost,
        );
        window.removeEventListener("pointerup", onPointerUp, true);
        window.removeEventListener("pointercancel", onPointerCancel, true);
        window.removeEventListener("blur", resetTouchGesture);
        window.removeEventListener("pagehide", onPageHide);
        window.removeEventListener("pageshow", onPageShow);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        controls.removeEventListener("start", onControlsStart);
        controls.removeEventListener("change", onControlsChange);
        controls.removeEventListener("end", onControlsEnd);
        if (wheelEndTimer !== null) {
          window.clearTimeout(wheelEndTimer);
        }
        if (runtime.markerTimer !== null) {
          window.clearTimeout(runtime.markerTimer);
        }
        controls.dispose();
        flightInputRef.current.set(0, 0, 0);
        panInputRef.current.set(0, 0);
        orbitInputRef.current.set(0, 0);
        pedestrianInputRef.current = { ...PEDESTRIAN_IDLE_INPUT };
        setMinecraftMaterialPresentation(
          scene,
          runtime.minecraftMaterialState,
          false,
        );
        disposeObject3D(runtime, scene);
        crispPass.dispose();
        smaaPass.dispose();
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
        className={`${active ? "three-viewer is-active" : "three-viewer"}${presentationReady ? " is-presentation-ready" : ""}`}
        aria-hidden={!active}
      >
        {!presentationReady ? (
          <div className="three-startup-curtain" aria-hidden="true" />
        ) : null}
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
