import {
  MOUSE,
  TOUCH,
  ACESFilmicToneMapping,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  FrontSide,
  Group,
  HemisphereLight,
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
  Spherical,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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

type TunnelPayload = {
  clear_height_m: number;
  clear_width_each_direction_m: number;
  depth_status: string;
  geometry_status: string;
  points: [number, number, number][];
};

type SceneManifest = {
  base_tiles: MeshFile[];
  hero_details: HeroDetail[];
  landmarks: SceneLandmark[];
  source: { attribution: string };
  tiergartentunnel: TunnelPayload;
};

type ViewAngles = {
  azimuthDegrees: number;
  polarDegrees: number;
  underside: boolean;
};

type ThreeViewerProps = {
  active: boolean;
  sceneUrl: string;
  selectedLandmark: string;
  onError: (message: string) => void;
  onReady: () => void;
  onViewChange: (angles: ViewAngles) => void;
};

export type ThreeViewerHandle = {
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
  controls: OrbitControls;
  detailGroups: Map<string, Group>;
  heroByName: Map<string, HeroDetail>;
  landmarkByName: Map<string, SceneLandmark>;
  loader: GLTFLoader;
  marker: Group;
  modelMaterials: Set<MeshStandardMaterial>;
  renderer: WebGLRenderer;
  scene: Scene;
  sceneRootUrl: URL;
  tunnel: Group;
  underside: boolean;
};

const DEFAULT_TARGET = new Vector3(-110, 12, -165);
const DEFAULT_CAMERA_OFFSET = new Vector3(540, 430, 650);
const DETAIL_RAISE_M = 0.035;

function createSelectionMarker(): Group {
  const group = new Group();
  const ring = new Mesh(
    new RingGeometry(4.2, 5.8, 48),
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
  const point = new Mesh(
    new SphereGeometry(1.05, 18, 12),
    new MeshBasicMaterial({
      color: 0xffd98a,
      depthTest: false,
      side: DoubleSide,
      transparent: true,
      opacity: 0.95,
    }),
  );
  point.position.y = 1.4;
  point.renderOrder = 21;
  group.add(point);
  return group;
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

function createTunnel(payload: TunnelPayload): Group {
  const group = new Group();
  group.name = "Tiergartentunnel cutaway";
  const width = payload.clear_width_each_direction_m;
  const height = payload.clear_height_m;
  const casingMaterial = new MeshPhysicalMaterial({
    color: 0x668b98,
    emissive: 0x244d5b,
    emissiveIntensity: 0.75,
    metalness: 0.12,
    roughness: 0.72,
    side: DoubleSide,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const roadMaterial = new MeshPhysicalMaterial({
    color: 0x30464f,
    emissive: 0x162d35,
    emissiveIntensity: 0.48,
    roughness: 0.9,
    side: DoubleSide,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const lightMaterial = new MeshBasicMaterial({
    color: 0xffe59b,
    depthTest: false,
  });
  const casingGeometry = new BoxGeometry(width, height, 1);
  const roadGeometry = new BoxGeometry(width - 0.7, 0.28, 1);
  const points = payload.points.map((point) => new Vector3(...point));

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

      const lampCount = Math.max(1, Math.floor(segmentLength / 34));
      const normal = new Vector3(-delta.z / segmentLength, 0, delta.x / segmentLength);
      for (let lamp = 1; lamp <= lampCount; lamp += 1) {
        const position = start.clone().lerp(end, lamp / (lampCount + 1));
        position.addScaledVector(normal, offset).add(new Vector3(0, height / 2 - 0.35, 0));
        const fixture = new Mesh(new SphereGeometry(0.78, 12, 8), lightMaterial);
        fixture.position.copy(position);
        fixture.renderOrder = 12;
        group.add(fixture);
      }
    }
  }

  for (const point of points.filter((_, index) => index % 2 === 0)) {
    const shaft = new Mesh(
      new CylinderGeometry(2.4, 2.4, 12, 20, 1, true),
      new MeshPhysicalMaterial({
        color: 0x85949c,
        metalness: 0.36,
        roughness: 0.5,
        side: DoubleSide,
      }),
    );
    shaft.position.copy(point).add(new Vector3(0, 6, 0));
    group.add(shaft);
    const fan = new Mesh(
      new TorusGeometry(1.65, 0.28, 10, 28),
      new MeshBasicMaterial({ color: 0xffd978, side: DoubleSide }),
    );
    fan.rotation.x = Math.PI / 2;
    fan.position.copy(point).add(new Vector3(0, 11.8, 0));
    group.add(fan);
  }
  group.visible = false;
  return group;
}

function setModelMaterialState(runtime: Runtime, underside: boolean): void {
  runtime.underside = underside;
  for (const material of runtime.modelMaterials) {
    material.side = underside ? DoubleSide : FrontSide;
    material.transparent = underside;
    material.opacity = underside ? 0.13 : 1;
    material.depthWrite = !underside;
    material.needsUpdate = true;
  }
  runtime.tunnel.visible = underside;
}

function notifyView(runtime: Runtime, callback: (angles: ViewAngles) => void): void {
  callback({
    azimuthDegrees: MathUtils.radToDeg(runtime.controls.getAzimuthalAngle()),
    polarDegrees: MathUtils.radToDeg(runtime.controls.getPolarAngle()),
    underside: runtime.underside,
  });
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

async function loadModel(
  runtime: Runtime,
  file: MeshFile,
  parent: Group | Scene,
  { detail }: { detail: boolean },
): Promise<void> {
  const url = new URL(file.file, runtime.sceneRootUrl).toString();
  const gltf = await runtime.loader.loadAsync(url);
  gltf.scene.traverse((object: Object3D) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    object.receiveShadow = true;
    object.castShadow = detail && !window.matchMedia("(pointer: coarse)").matches;
    if (!detail) {
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
          8,
          runtime.renderer.capabilities.getMaxAnisotropy(),
        );
        material.map.needsUpdate = true;
        material.emissive.set(0xffffff);
        material.emissiveMap = material.map;
        material.emissiveIntensity = 0.42;
      } else {
        material.emissive.set(0x2b3130);
        material.emissiveIntensity = 0.2;
      }
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
}

async function loadWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await task(item);
      }
    },
  );
  await Promise.all(workers);
}

export const ThreeViewer = forwardRef<ThreeViewerHandle, ThreeViewerProps>(
  function ThreeViewer(
    { active, sceneUrl, selectedLandmark, onError, onReady, onViewChange },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const runtimeRef = useRef<Runtime | null>(null);
    const selectedRef = useRef(selectedLandmark);
    const activeRef = useRef(active);
    const onErrorRef = useRef(onError);
    const onReadyRef = useRef(onReady);
    const onViewChangeRef = useRef(onViewChange);
    const [progress, setProgress] = useState({ loaded: 0, total: 1 });

    useEffect(() => {
      activeRef.current = active;
    }, [active]);

    useEffect(() => {
      onErrorRef.current = onError;
      onReadyRef.current = onReady;
      onViewChangeRef.current = onViewChange;
    }, [onError, onReady, onViewChange]);

    const focusLandmark = (name: string, immediate = false): void => {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return;
      }
      const landmark = runtime.landmarkByName.get(name);
      if (!landmark) {
        return;
      }
      const target = new Vector3(...landmark.world);
      const currentOffset = runtime.camera.position
        .clone()
        .sub(runtime.controls.target)
        .normalize();
      const distance =
        name.includes("Tiergartentunnel")
          ? 460
          : name === "Bundeskanzleramt"
          ? 320
          : runtime.heroByName.has(name)
            ? 250
            : 190;
      runtime.controls.target.copy(target);
      runtime.camera.position.copy(target).addScaledVector(currentOffset, distance);
      const markerHeight =
        name === "Reichstagsgebäude"
          ? 62
          : name === "Berlin Hauptbahnhof"
            ? 58
            : name === "Bundeskanzleramt"
              ? 50
              : name === "Brandenburger Tor"
                ? 34
                : 18;
      runtime.marker.position.copy(target).setY(markerHeight);
      runtime.marker.visible = true;
      runtime.controls.update(immediate ? 1 : undefined);

      for (const [heroName, group] of runtime.detailGroups) {
        group.visible = heroName === name;
      }
      const detail = runtime.heroByName.get(name);
      if (detail && !runtime.detailGroups.has(name)) {
        const group = new Group();
        group.name = `${name} high detail`;
        runtime.detailGroups.set(name, group);
        runtime.scene.add(group);
        setProgress((current) => ({
          loaded: current.loaded,
          total: current.total + detail.files.length,
        }));
        void loadWithConcurrency(detail.files, 2, async (file) => {
          await loadModel(runtime, file, group, { detail: true });
          setProgress((current) => ({ ...current, loaded: current.loaded + 1 }));
        }).catch((error: unknown) => {
          setProgress((current) => ({
            ...current,
            total: Math.max(
              current.loaded,
              current.total - detail.files.length,
            ),
          }));
          onErrorRef.current(
            error instanceof Error ? error.message : "3D detail failed",
          );
        });
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        focusLandmark,
        reset: () => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
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
          setOrbitAngles(runtime, { azimuth: MathUtils.degToRad(degrees) });
          notifyView(runtime, onViewChangeRef.current);
        },
        setUnderside: (enabled) => {
          const runtime = runtimeRef.current;
          if (!runtime) {
            return;
          }
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
      const renderer = new WebGLRenderer({
        antialias: !window.matchMedia("(pointer: coarse)").matches,
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.46;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, window.innerWidth <= 760 ? 1.25 : 1.75),
      );
      renderer.domElement.className = "three-canvas";
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute(
        "aria-label",
        "Freie dreidimensionale Ansicht des Berliner Regierungsviertels",
      );
      host.append(renderer.domElement);

      const scene = new Scene();
      scene.background = new Color(0xcce8f2);
      scene.fog = new Fog(0xcce8f2, 1050, 2450);
      scene.add(new HemisphereLight(0xf8fcff, 0x80967a, 3.35));
      const sun = new DirectionalLight(0xfff1cf, 2.05);
      sun.position.set(-760, 980, 720);
      sun.castShadow = !window.matchMedia("(pointer: coarse)").matches;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -1100;
      sun.shadow.camera.right = 1100;
      sun.shadow.camera.top = 1300;
      sun.shadow.camera.bottom = -1300;
      scene.add(sun);

      const camera = new PerspectiveCamera(39, 1, 0.25, 6000);
      camera.position.copy(DEFAULT_TARGET).add(DEFAULT_CAMERA_OFFSET);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(DEFAULT_TARGET);
      controls.enableDamping = true;
      controls.dampingFactor = 0.075;
      controls.minDistance = 38;
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

      const marker = createSelectionMarker();
      marker.visible = false;
      scene.add(marker);
      const runtime: Runtime = {
        camera,
        controls,
        detailGroups: new Map(),
        heroByName: new Map(),
        landmarkByName: new Map(),
        loader: new GLTFLoader(),
        marker,
        modelMaterials: new Set(),
        renderer,
        scene,
        sceneRootUrl: new URL(".", new URL(sceneUrl, window.location.href)),
        tunnel: new Group(),
        underside: false,
      };
      runtimeRef.current = runtime;

      const touchPoints = new Map<number, { x: number; y: number }>();
      let previousThreeFingerCenter: { x: number; y: number } | null = null;
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== "touch") {
          return;
        }
        touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touchPoints.size >= 3) {
          controls.enabled = false;
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
        touchPoints.delete(event.pointerId);
        if (touchPoints.size < 3) {
          previousThreeFingerCenter = null;
          controls.enabled = true;
          notifyView(runtime, onViewChangeRef.current);
        }
      };
      renderer.domElement.addEventListener("pointerdown", onPointerDown, true);
      renderer.domElement.addEventListener("pointermove", onPointerMove, true);
      renderer.domElement.addEventListener("pointerup", onPointerUp, true);
      renderer.domElement.addEventListener("pointercancel", onPointerUp, true);
      controls.addEventListener("end", () =>
        notifyView(runtime, onViewChangeRef.current),
      );

      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        if (width < 1 || height < 1) {
          return;
        }
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      const animate = () => {
        if (disposed) {
          return;
        }
        frame = window.requestAnimationFrame(animate);
        if (!activeRef.current) {
          return;
        }
        controls.update();
        marker.rotation.y += 0.006;
        renderer.render(scene, camera);
      };
      animate();

      void fetch(sceneUrl)
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
          runtime.heroByName = new Map(
            manifest.hero_details.map((detail) => [detail.landmark_name, detail]),
          );
          runtime.tunnel = createTunnel(manifest.tiergartentunnel);
          scene.add(runtime.tunnel);
          setProgress({ loaded: 0, total: manifest.base_tiles.length });

          const selected = runtime.landmarkByName.get(selectedRef.current);
          const sortedTiles = [...manifest.base_tiles].sort((left, right) => {
            if (!selected) {
              return 0;
            }
            const distance = (file: MeshFile) => {
              const bounds = file.source_bounds_epsg25833;
              const centerX = (bounds[0][0] + bounds[1][0]) / 2 - 389_500;
              const centerZ = 5_820_000 - (bounds[0][1] + bounds[1][1]) / 2;
              return Math.hypot(centerX - selected.world[0], centerZ - selected.world[2]);
            };
            return distance(left) - distance(right);
          });
          focusLandmark(selectedRef.current, true);
          let readyNotified = false;
          await loadWithConcurrency(
            sortedTiles,
            window.matchMedia("(pointer: coarse)").matches ? 1 : 3,
            async (file) => {
              await loadModel(runtime, file, scene, { detail: false });
              setProgress((current) => ({ ...current, loaded: current.loaded + 1 }));
              if (!readyNotified && !disposed) {
                readyNotified = true;
                onReadyRef.current();
              }
            },
          );
          if (!disposed && !readyNotified) {
            onReadyRef.current();
          }
        })
        .catch((error: unknown) => {
          if (!disposed) {
            onErrorRef.current(
              error instanceof Error ? error.message : "3D scene failed",
            );
          }
        });

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown, true);
        renderer.domElement.removeEventListener("pointermove", onPointerMove, true);
        renderer.domElement.removeEventListener("pointerup", onPointerUp, true);
        renderer.domElement.removeEventListener("pointercancel", onPointerUp, true);
        controls.dispose();
        scene.traverse((object) => {
          if (!(object instanceof Mesh)) {
            return;
          }
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const material of materials) {
            material.dispose();
          }
        });
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
