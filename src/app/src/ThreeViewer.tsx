import {
  MOUSE,
  TOUCH,
  ACESFilmicToneMapping,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Fog,
  FrontSide,
  Group,
  HemisphereLight,
  InstancedMesh,
  LineSegments,
  Material,
  Matrix4,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  PerspectiveCamera,
  PCFShadowMap,
  RingGeometry,
  RGBAFormat,
  Scene,
  Spherical,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
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
  focusCameraForSignature,
} from "./ArchitecturalLandmarks";
import { createCivicLandmarks } from "./CivicLandmarks";
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
  captureCameraPose,
  flyCameraInViewPlane,
  stabilizeCameraRig,
} from "./cameraNavigation";
import { heroDetailEvictions } from "./heroDetailCache";
import { renderPixelRatio } from "./renderQuality";
import { shouldUseSettledSurface } from "./surfaceQuality";
import { updateWindFlags } from "./WindFlags";
import type { VisualMode } from "./visualMode";
import {
  createMinecraftMaterialState,
  disposeMinecraftMaterialState,
  releaseMinecraftMaterialBindings,
  setMinecraftMaterialPresentation,
  type MinecraftMaterialState,
} from "./visual-modes/minecraft/materialMode";
import { createPaletteLutData } from "./visual-modes/minecraft/palette";
import postprocessFragment from "./visual-modes/minecraft/postprocess.frag?raw";
import postprocessVertex from "./visual-modes/minecraft/postprocess.vert?raw";
import shimmerFragment from "./visual-modes/minecraft/shimmer.frag?raw";
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
  lightingMode: LightingMode;
  sceneUrl: string;
  selectedLandmark: string;
  onError: (message: string) => void;
  onReady: () => void;
  onWarning: (message: string) => void;
  onViewChange: (angles: ViewAngles) => void;
};

export type ThreeViewerHandle = {
  flyBy: (horizontal: number, vertical: number) => void;
  focusLandmark: (name: string, immediate?: boolean) => void;
  reset: () => void;
  rotateBy: (degrees: number) => void;
  setAzimuth: (degrees: number) => void;
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
  minecraftPass: ShaderPass;
  minecraftPaletteTexture: DataTexture;
  modelMaterials: Set<MeshStandardMaterial>;
  monuments: Group;
  parkDetails: Group;
  renderer: WebGLRenderer;
  scene: Scene;
  sceneRootUrl: URL;
  signatures: Group;
  skyFill: DirectionalLight;
  settledSurface: Group;
  settledSurfaceReady: boolean;
  sun: DirectionalLight;
  tunnel: Group;
  lightingMode: LightingMode;
  underside: boolean;
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

function setSurfacePresentation(runtime: Runtime, interacting: boolean): void {
  const settled = shouldUseSettledSurface({
    coarsePointer: runtime.coarsePointer,
    detailReady: runtime.settledSurfaceReady,
    interacting,
  });
  runtime.interactionSurface.visible = !settled;
  runtime.settledSurface.visible = settled;
  setParkSettledDetail(runtime.parkDetails, settled);
  runtime.renderer.domElement.dataset.surfaceQuality = settled
    ? "settled-7m-plus"
    : "interaction-2_3m";
}

function markSurfaceInteraction(runtime: Runtime, durationMs = 650): void {
  runtime.interactionUntil = Math.max(
    runtime.interactionUntil,
    performance.now() + durationMs,
  );
  setSurfacePresentation(runtime, true);
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

function applyMaterialLighting(
  material: MeshStandardMaterial,
  mode: LightingMode,
): void {
  if (!material.userData.appearanceCaptured) {
    material.userData.appearanceCaptured = true;
    material.userData.dayEmissive = material.emissive.getHex();
    material.userData.dayEmissiveIntensity = material.emissiveIntensity;
  }
  if (mode === "night") {
    const nightEmissive = material.userData.nightEmissive;
    if (typeof nightEmissive === "number") {
      material.emissive.setHex(nightEmissive);
      material.emissiveIntensity =
        material.userData.nightEmissiveIntensity ?? 1;
    } else if (material.userData.sourceMaterial) {
      material.emissiveIntensity = material.map ? 0.035 : 0.015;
    }
  } else {
    material.emissive.setHex(material.userData.dayEmissive ?? 0x000000);
    material.emissiveIntensity =
      material.userData.dayEmissiveIntensity ?? 1;
  }
  material.needsUpdate = true;
}

function applyLightingToRoot(root: Object3D, mode: LightingMode): void {
  const seen = new Set<MeshStandardMaterial>();
  root.traverse((object) => {
    if (object.userData.nightOnly === true) {
      object.visible = mode === "night";
    }
    if (!(object instanceof Mesh)) {
      return;
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial && !seen.has(material)) {
        seen.add(material);
        applyMaterialLighting(material, mode);
      }
    }
  });
}

function setSceneLighting(runtime: Runtime, mode: LightingMode): void {
  runtime.lightingMode = mode;
  const isNight = mode === "night";
  const isMinecraft = mode === "minecraft";
  if (!isMinecraft) {
    setMinecraftMaterialPresentation(
      runtime.scene,
      runtime.minecraftMaterialState,
      false,
    );
  }
  const sky = isNight ? 0x07131f : isMinecraft ? 0xaedaf0 : 0xc9eaf3;
  runtime.scene.background = new Color(sky);
  runtime.scene.fog = new Fog(sky, isNight ? 900 : isMinecraft ? 1450 : 1100, 2550);
  runtime.renderer.toneMappingExposure = isNight ? 0.82 : isMinecraft ? 1.38 : 1.22;
  runtime.hemisphere.color.setHex(isNight ? 0x5877a4 : isMinecraft ? 0xeef9ff : 0xffffff);
  runtime.hemisphere.groundColor.setHex(isNight ? 0x08120f : isMinecraft ? 0x4f743f : 0x57775b);
  runtime.hemisphere.intensity = isNight ? 0.34 : isMinecraft ? 2.25 : 2.12;
  runtime.sun.color.setHex(isNight ? 0x91b9ed : isMinecraft ? 0xffdda3 : 0xffefc9);
  runtime.sun.intensity = isNight ? 0.62 : isMinecraft ? 3.15 : 3.15;
  runtime.skyFill.color.setHex(isNight ? 0x6c82ae : isMinecraft ? 0x9fd8f2 : 0xb6dcff);
  runtime.skyFill.intensity = isNight ? 0.2 : isMinecraft ? 0.48 : 0.26;
  runtime.sun.position.set(
    isMinecraft ? 760 : -760,
    980,
    isMinecraft ? -720 : 720,
  );
  for (const material of runtime.modelMaterials) {
    applyMaterialLighting(material, mode);
  }
  applyLightingToRoot(runtime.signatures, mode);
  applyLightingToRoot(runtime.civicDetails, mode);
  applyLightingToRoot(runtime.monuments, mode);
  applyLightingToRoot(runtime.culturalDetails, mode);
  applyLightingToRoot(runtime.parkDetails, mode);
  if (isMinecraft) {
    setMinecraftMaterialPresentation(
      runtime.scene,
      runtime.minecraftMaterialState,
      true,
    );
  }
  runtime.minecraftPass.enabled = isMinecraft;
}

function segmentMesh(
  geometry: BoxGeometry,
  material: MeshPhysicalMaterial | MeshBasicMaterial,
  start: Vector3,
  end: Vector3,
  offset: number,
): Mesh {
  const delta = end.clone().sub(start);
  const length = Math.hypot(delta.x, delta.z);
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
    object.renderOrder = underside ? 14 : 10;
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
  runtime.signatures.visible = !underside;
  runtime.civicDetails.visible = !underside;
  runtime.monuments.visible = !underside;
  runtime.culturalDetails.visible = !underside;
  runtime.parkDetails.visible = !underside;
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
    geometries.add(object.geometry);
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
  { detail }: { detail: boolean },
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
    for (const sourceMaterial of materials) {
      const material = sourceMaterial as MeshStandardMaterial;
      material.side = FrontSide;
      material.roughness = Math.max(0.58, material.roughness ?? 0.75);
      if (material.map) {
        material.map.anisotropy = Math.min(
          16,
          runtime.renderer.capabilities.getMaxAnisotropy(),
        );
        material.map.needsUpdate = true;
        material.emissive.set(0xffffff);
        material.emissiveMap = material.map;
        material.emissiveIntensity = 0.24;
      } else {
        material.emissive.set(0x2b3130);
        material.emissiveIntensity = 0.09;
      }
      material.userData.sourceMaterial = true;
      applyMaterialLighting(material, runtime.lightingMode);
      if (detail) {
        material.polygonOffset = true;
        material.polygonOffsetFactor = -1;
        material.polygonOffsetUnits = -1;
      }
      material.side = runtime.underside ? DoubleSide : FrontSide;
      material.transparent = runtime.underside;
      material.opacity = runtime.underside ? 0.13 : 1;
      material.depthWrite = !runtime.underside;
      material.needsUpdate = true;
      runtime.modelMaterials.add(material);
    }
  });
  if (detail) {
    gltf.scene.position.y += DETAIL_RAISE_M;
  }
  parent.add(gltf.scene);
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
  options: { detail: boolean },
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
      lightingMode,
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
    const lightingModeRef = useRef(lightingMode);
    const onErrorRef = useRef(onError);
    const onReadyRef = useRef(onReady);
    const onWarningRef = useRef(onWarning);
    const onViewChangeRef = useRef(onViewChange);
    const [progress, setProgress] = useState({ loaded: 0, total: 1 });

    useEffect(() => {
      activeRef.current = active;
    }, [active]);

    useEffect(() => {
      lightingModeRef.current = lightingMode;
      const runtime = runtimeRef.current;
      if (runtime) {
        setSceneLighting(runtime, lightingMode);
      }
    }, [lightingMode]);

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
      setParkDetailsFocus(runtime.parkDetails, name);
      const cameraPreset = runtime.focusCameraByName.get(name);
      const target = new Vector3(
        ...(cameraPreset?.target_world ?? landmark.world),
      );
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
          : (parkDetailFocusDistance(name) ?? memorialFocusDistance(name) ?? 190);
        cameraOffset = currentDirection.multiplyScalar(distance);
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
        }
        runtime.markerTimer = null;
      }, 2400);
      runtime.controls.update(immediate ? 1 : undefined);
      notifyView(runtime, onViewChangeRef.current);

      runtime.detailClock += 1;
      for (const [heroName, entry] of runtime.detailGroups) {
        entry.group.visible = heroName === name;
        if (heroName === name) {
          entry.lastUsed = runtime.detailClock;
        }
      }
      const detail = runtime.heroByName.get(name);
      if (detail && !runtime.detailGroups.has(name)) {
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
      const renderer = new WebGLRenderer({
        antialias: !coarsePointer,
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.22;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.setPixelRatio(1);
      renderer.domElement.className = "three-canvas";
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute(
        "aria-label",
        "Freie dreidimensionale Ansicht des Berliner Regierungsviertels",
      );
      host.append(renderer.domElement);

      const scene = new Scene();
      scene.background = new Color(0xc9eaf3);
      scene.fog = new Fog(0xc9eaf3, 1100, 2550);
      const hemisphere = new HemisphereLight(0xffffff, 0x57775b, 2.12);
      scene.add(hemisphere);
      const sun = new DirectionalLight(0xffefc9, 3.15);
      sun.position.set(-760, 980, 720);
      sun.castShadow = !coarsePointer;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -1100;
      sun.shadow.camera.right = 1100;
      sun.shadow.camera.top = 1300;
      sun.shadow.camera.bottom = -1300;
      scene.add(sun);
      const skyFill = new DirectionalLight(0xb6dcff, 0.26);
      skyFill.position.set(620, 430, -680);
      scene.add(skyFill);

      const camera = new PerspectiveCamera(39, 1, 0.25, 6000);
      camera.position.copy(DEFAULT_TARGET).add(DEFAULT_CAMERA_OFFSET);
      const minecraftPaletteTexture = new DataTexture(
        createPaletteLutData(),
        256,
        16,
        RGBAFormat,
      );
      minecraftPaletteTexture.minFilter = NearestFilter;
      minecraftPaletteTexture.magFilter = NearestFilter;
      minecraftPaletteTexture.needsUpdate = true;
      const minecraftPass = new ShaderPass({
        uniforms: {
          paletteLut: { value: minecraftPaletteTexture },
          pixelScale: { value: coarsePointer ? 2.35 : 2.8 },
          resolution: { value: new Vector2(1, 1) },
          tDiffuse: { value: null },
          time: { value: 0 },
        },
        vertexShader: postprocessVertex,
        fragmentShader: postprocessFragment.replace(
          "/*__SHIMMER__*/",
          shimmerFragment,
        ),
      });
      minecraftPass.enabled = false;
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(minecraftPass);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(DEFAULT_TARGET);
      controls.enableDamping = true;
      controls.dampingFactor = 0.085;
      controls.zoomToCursor = true;
      controls.rotateSpeed = 0.68;
      controls.zoomSpeed = 0.84;
      controls.panSpeed = 0.68;
      controls.minDistance = 30;
      controls.maxDistance = 2600;
      controls.minPolarAngle = 0.06;
      controls.maxPolarAngle = Math.PI - 0.06;
      controls.screenSpacePanning = true;
      controls.mouseButtons = {
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN,
      };
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
        minecraftPaletteTexture,
        minecraftPass,
        modelMaterials: new Set(),
        monuments,
        parkDetails,
        renderer,
        scene,
        sceneRootUrl: new URL(".", new URL(sceneUrl, window.location.href)),
        signatures,
        skyFill,
        settledSurface,
        settledSurfaceReady: false,
        sun,
        tunnel: new Group(),
        lightingMode: lightingModeRef.current,
        underside: false,
      };
      runtimeRef.current = runtime;
      setSceneLighting(runtime, lightingModeRef.current);

      const touchPoints = new Map<number, { x: number; y: number }>();
      let customTouchGestureActive = false;
      let previousThreeFingerCenter: { x: number; y: number } | null = null;
      let controlsInteracting = false;
      let lastTouchActivityAt = performance.now();
      let settleUntil = 0;
      let lastSafeCameraPose = captureCameraPose(camera, controls.target);
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== "touch") {
          renderer.domElement.focus({ preventScroll: true });
          return;
        }
        lastTouchActivityAt = performance.now();
        touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touchPoints.size >= 3) {
          customTouchGestureActive = true;
          controlsInteracting = true;
          controls.enabled = false;
          markSurfaceInteraction(runtime);
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
        setModelMaterialState(runtime, polar > Math.PI / 2);
        previousThreeFingerCenter = center;
      };
      const onPointerUp = (event: PointerEvent) => {
        if (!touchPoints.has(event.pointerId)) {
          return;
        }
        lastTouchActivityAt = performance.now();
        touchPoints.delete(event.pointerId);
        if (customTouchGestureActive) {
          previousThreeFingerCenter = null;
          if (touchPoints.size < 3) {
            customTouchGestureActive = false;
            controlsInteracting = false;
            settleUntil = performance.now() + 650;
            controls.enabled = true;
            notifyView(runtime, onViewChangeRef.current);
          }
          return;
        }
        if (touchPoints.size < 3) {
          controls.enabled = true;
          notifyView(runtime, onViewChangeRef.current);
        }
      };
      const resetTouchGesture = () => {
        if (touchPoints.size === 0 && !customTouchGestureActive) {
          return;
        }
        touchPoints.clear();
        previousThreeFingerCenter = null;
        customTouchGestureActive = false;
        controlsInteracting = false;
        settleUntil = performance.now() + 650;
        controls.enabled = true;
        setSurfacePresentation(runtime, false);
        notifyView(runtime, onViewChangeRef.current);
      };
      const onVisibilityChange = () => {
        if (document.hidden) {
          resetTouchGesture();
        }
      };
      renderer.domElement.addEventListener("pointerdown", onPointerDown, true);
      renderer.domElement.addEventListener("pointermove", onPointerMove, true);
      renderer.domElement.addEventListener("pointerup", onPointerUp, true);
      renderer.domElement.addEventListener("pointercancel", onPointerUp, true);
      renderer.domElement.addEventListener(
        "lostpointercapture",
        resetTouchGesture,
        true,
      );
      window.addEventListener("pointerup", onPointerUp, true);
      window.addEventListener("pointercancel", onPointerUp, true);
      window.addEventListener("blur", resetTouchGesture);
      document.addEventListener("visibilitychange", onVisibilityChange);
      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        if (width < 1 || height < 1) {
          return;
        }
        renderer.setPixelRatio(
          renderPixelRatio({
            coarsePointer,
            devicePixelRatio: window.devicePixelRatio,
            height,
            interacting: controlsInteracting,
            width,
          }),
        );
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(width, height);
        const resolution = minecraftPass.uniforms.resolution.value;
        if (resolution instanceof Vector2) {
          resolution.set(
            width * renderer.getPixelRatio(),
            height * renderer.getPixelRatio(),
          );
        }
      };
      let qualityRestoreTimer: number | null = null;
      const onControlsStart = () => {
        controlsInteracting = true;
        markSurfaceInteraction(runtime);
        if (qualityRestoreTimer !== null) {
          window.clearTimeout(qualityRestoreTimer);
          qualityRestoreTimer = null;
        }
        resize();
      };
      const onControlsEnd = () => {
        controlsInteracting = false;
        settleUntil = performance.now() + 650;
        markSurfaceInteraction(runtime);
        notifyView(runtime, onViewChangeRef.current);
        qualityRestoreTimer = window.setTimeout(() => {
          if (!runtime.disposed) {
            resize();
          }
          qualityRestoreTimer = null;
        }, 140);
      };
      controls.addEventListener("start", onControlsStart);
      controls.addEventListener("end", onControlsEnd);
      resizeObserver = new ResizeObserver(resize);
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
      const idleFrameIntervalMs = coarsePointer ? 1000 / 10 : 1000 / 12;
      let lastRenderedAt = Number.NEGATIVE_INFINITY;
      const animate = (timestamp = 0) => {
        if (disposed) {
          return;
        }
        frame = window.requestAnimationFrame(animate);
        if (!activeRef.current) {
          return;
        }
        if (
          !controls.enabled &&
          (!customTouchGestureActive ||
            touchPoints.size < 3 ||
            timestamp - lastTouchActivityAt > 10_000)
        ) {
          resetTouchGesture();
        }
        const controlsChanged = controls.update();
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
        const isMoving =
          controlsInteracting ||
          controlsChanged ||
          stabilized.changed ||
          marker.visible ||
          runtime.lightingMode === "minecraft" ||
          timestamp < runtime.interactionUntil ||
          timestamp < settleUntil;
        setSurfacePresentation(runtime, isMoving);
        const frameIntervalMs = isMoving
          ? activeFrameIntervalMs
          : idleFrameIntervalMs;
        if (timestamp - lastRenderedAt < frameIntervalMs) {
          return;
        }
        lastRenderedAt = timestamp;
        const underside = controls.getPolarAngle() > Math.PI / 2;
        if (underside !== runtime.underside) {
          setModelMaterialState(runtime, underside);
          notifyView(runtime, onViewChangeRef.current);
        }
        if (marker.visible) {
          const pulse = 1 + Math.sin(timestamp * 0.006) * 0.08;
          marker.scale.setScalar(pulse);
        }
        const windTime = reducedMotion ? 0.9 : timestamp / 1000;
        updateWindFlags(runtime.signatures, windTime);
        updateWindFlags(runtime.civicDetails, windTime);
        if (runtime.lightingMode === "minecraft") {
          minecraftPass.uniforms.time.value = timestamp / 1000;
          composer.render();
        } else {
          renderer.render(scene, camera);
        }
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
          scene.add(runtime.civicDetails);
          applyLightingToRoot(runtime.civicDetails, runtime.lightingMode);
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
          runtime.heroByName = new Map(
            manifest.hero_details.map((detail) => [detail.landmark_name, detail]),
          );
          for (const signature of manifest.architectural_signatures ?? []) {
            const model = createArchitecturalSignature(signature);
            if (model) {
              runtime.signatures.add(model);
            }
            const focusCamera = focusCameraForSignature(signature);
            if (focusCamera) {
              runtime.focusCameraByName.set(signature.landmark_name, focusCamera);
            }
          }
          applyLightingToRoot(runtime.signatures, runtime.lightingMode);
          if (runtime.lightingMode === "minecraft") {
            setMinecraftMaterialPresentation(
              runtime.signatures,
              runtime.minecraftMaterialState,
              true,
            );
          }
          runtime.monuments.removeFromParent();
          runtime.monuments = createMemorialLandmarks(manifest.landmarks);
          scene.add(runtime.monuments);
          applyLightingToRoot(runtime.monuments, runtime.lightingMode);
          runtime.culturalDetails.removeFromParent();
          runtime.culturalDetails = createCulturalLandmarks(manifest.landmarks);
          scene.add(runtime.culturalDetails);
          applyLightingToRoot(runtime.culturalDetails, runtime.lightingMode);
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
                applyLightingToRoot(details, runtime.lightingMode);
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
          scene.add(runtime.tunnel);
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
        renderer.domElement.removeEventListener("pointercancel", onPointerUp, true);
        renderer.domElement.removeEventListener(
          "lostpointercapture",
          resetTouchGesture,
          true,
        );
        renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
        window.removeEventListener("pointerup", onPointerUp, true);
        window.removeEventListener("pointercancel", onPointerUp, true);
        window.removeEventListener("blur", resetTouchGesture);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        controls.removeEventListener("start", onControlsStart);
        controls.removeEventListener("end", onControlsEnd);
        if (qualityRestoreTimer !== null) {
          window.clearTimeout(qualityRestoreTimer);
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
        minecraftPass.dispose();
        composer.dispose();
        minecraftPaletteTexture.dispose();
        disposeMinecraftMaterialState(runtime.minecraftMaterialState);
        renderer.dispose();
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
            <span>Amtliches 3D-Mesh</span>
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
