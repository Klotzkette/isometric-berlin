import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D,
} from "three";
import {
  FERNSEHTURM_DETAIL_PROFILE as P,
  FERNSEHTURM_DETAIL_GROUP_NAME,
  MINECRAFT_FERNSEHTURM_DETAIL_GROUP_NAME,
} from "./fernsehturmDetailProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { schwellenraumMaterialFor } from "./visual-modes/schwellenraum/materialGrade";
type Point = [number, number, number];
type Block = {
  p: Point;
  s: Point;
  color: number;
  yaw?: number;
  q?: Quaternion;
};
type SunState = { sun: { value: Vector3 }; daylight: { value: number } };
const states = new WeakMap<Object3D, SunState>();
const CONCRETE = 0xc5c5b9,
  STEEL = 0x9aa9b0,
  FRAME = 0xb8b8ab,
  GLASS = 0x394f58,
  UP = new Vector3(0, 1, 0);
const windowAt = (h: number): boolean =>
  P.windowBands.some(([a, b]) => h >= a && h <= b);
const sphereRadiusAt = (h: number): number =>
  Math.sqrt(Math.max(0, P.sphereRadius ** 2 - (h - P.sphereCenterHeight) ** 2));
/** Mode-change hook only. CameraPosition is automatically supplied by Three.js. */
export function updateFernsehturmLighting(
  root: Object3D,
  sun: Vector3 | readonly number[],
  daylight: number,
): void {
  const state = states.get(root);
  if (!state) return;
  if (sun instanceof Vector3) state.sun.value.copy(sun);
  else state.sun.value.set(sun[0], sun[1], sun[2]);
  if (state.sun.value.lengthSq() < 1e-10) state.sun.value.set(0, -1, 0);
  else state.sun.value.normalize();
  state.daylight.value = Math.max(
    0,
    Math.min(1, Number.isFinite(daylight) ? daylight : 0),
  );
}
/** Anisotropic BRDF approximation of the pyramid-face families, on the real shell.
 * No billboard, texture, animation, postprocess or second draw pass. */
function addSunReflection(material: MeshBasicMaterial, state: SunState): void {
  material.name = "Fernsehturm stainless steel, view-dependent sunlight";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fernsehturmSun = state.sun;
    shader.uniforms.fernsehturmDaylight = state.daylight;
    shader.vertexShader =
      `varying vec3 vFernsehturmWorld;\n${shader.vertexShader}`.replace(
        "#include <project_vertex>",
        `
      vec4 tvVertex = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        tvVertex = instanceMatrix * tvVertex;
      #endif
      vFernsehturmWorld = (modelMatrix * tvVertex).xyz;
      #include <project_vertex>`,
      );
    shader.fragmentShader =
      `uniform vec3 fernsehturmSun; uniform float fernsehturmDaylight;
      varying vec3 vFernsehturmWorld;\n${shader.fragmentShader}`.replace(
        "#include <opaque_fragment>",
        `
      vec3 tvN = normalize(vFernsehturmWorld - vec3(${P.x}, ${P.groundY + P.sphereCenterHeight}, ${P.z}));
      vec3 tvV = normalize(cameraPosition - vFernsehturmWorld);
      vec3 tvSum = tvV + fernsehturmSun;
      float tvHlen = length(tvSum); vec3 tvH = tvSum / max(tvHlen, 0.00001);
      vec3 tvT = vec3(tvH.z, 0.0, -tvH.x); float tvTlen = length(tvT); tvT /= max(tvTlen, 0.00001);
      vec3 tvU = cross(tvH, tvT);
      float tvX = dot(tvN, tvT), tvY = dot(tvN, tvU);
      // Integrate thin distant highlights over a pixel, without changing geometry.
      float tvWidth = max(${P.reflection.narrow}, min(0.095, max(fwidth(tvX), fwidth(tvY)) * 0.65));
      vec2 tvAxisV = vec2(tvX / tvWidth, tvY / ${P.reflection.broad});
      vec2 tvAxisH = vec2(tvX / ${P.reflection.broad}, tvY / tvWidth);
      float tvVertical = exp(-dot(tvAxisV, tvAxisV));
      float tvHorizontal = exp(-dot(tvAxisH, tvAxisH));
      float tvLit = step(0.00001, fernsehturmSun.y) * step(0.00001, dot(tvN, fernsehturmSun)) * step(0.00001, dot(tvN, tvV))
        * step(0.00001, tvHlen) * step(0.00001, tvTlen);
      float tvGrazing = max(0.0, dot(tvN, fernsehturmSun)) * max(0.0, dot(tvN, tvV));
      float tvGlint = max(tvVertical, tvHorizontal) * pow(max(0.0, dot(tvN, tvH)), 12.0) * fernsehturmDaylight * tvLit * tvGrazing * ${P.reflection.strength};
      outgoingLight += vec3(1.0, 0.94, 0.78) * tvGlint;
      #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => "fernsehturm-steel-cross-v149";
}
class GeometryBatch {
  positions: number[] = [];
  normals: number[] = [];
  colours: number[] = [];
  private color = new Color();
  triangle(a: Point, b: Point, c: Point, color: number): void {
    const n = new Vector3(...b)
      .sub(new Vector3(...a))
      .cross(new Vector3(...c).sub(new Vector3(...a)))
      .normalize();
    this.color.setHex(color);
    const shade =
      0.74 + 0.26 * Math.max(0, n.x * -0.45 + n.y * 0.72 + n.z * 0.4);
    for (const p of [a, b, c]) {
      this.positions.push(p[0] + P.x, p[1] + P.groundY, p[2] + P.z);
      this.normals.push(n.x, n.y, n.z);
      this.colours.push(
        this.color.r * shade,
        this.color.g * shade,
        this.color.b * shade,
      );
    }
  }
  append(
    g: BufferGeometry,
    position: Point,
    color: number,
    q?: Quaternion,
  ): void {
    const flat = g.index ? g.toNonIndexed() : g;
    if (q) flat.applyQuaternion(q);
    flat.translate(...position);
    const p = flat.getAttribute("position");
    for (let i = 0; i < p.count; i += 3)
      this.triangle(
        [p.getX(i), p.getY(i), p.getZ(i)],
        [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)],
        [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)],
        color,
      );
    flat.dispose();
    if (flat !== g) g.dispose();
  }
  cylinder(
    bottom: number,
    top: number,
    rb: number,
    rt: number,
    color: number,
    segments = 64,
  ): void {
    this.append(
      new CylinderGeometry(rt, rb, top - bottom, segments),
      [0, (bottom + top) / 2, 0],
      color,
    );
  }
  mesh(name: string, glass = false): Mesh {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
    g.setAttribute("normal", new Float32BufferAttribute(this.normals, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.colours, 3));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    const day = new MeshBasicMaterial({ vertexColors: true }),
      night = new MeshStandardMaterial({
        vertexColors: true,
        roughness: glass ? 0.28 : 0.72,
        metalness: 0.15,
        emissive: glass ? 0xb99455 : 0,
        emissiveIntensity: glass ? 0.6 : 0,
      });
    const mesh = new Mesh(g, day);
    mesh.name = name;
    mesh.userData = {
      textureFree: true,
      dayMaterial: day,
      nightMaterial: night,
    };
    return mesh;
  }
}
function blockBatch(blocks: Block[], name: string): InstancedMesh {
  const g = new BoxGeometry(1, 1, 1);
  g.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const mesh = new InstancedMesh(g, day, blocks.length);
  const m = new Matrix4(),
    q = new Quaternion(),
    c = new Color(),
    p = new Vector3(),
    s = new Vector3();
  blocks.forEach((b, i) => {
    m.compose(
      p.set(b.p[0] + P.x, b.p[1] + P.groundY, b.p[2] + P.z),
      b.q ?? q.setFromAxisAngle(UP, b.yaw ?? 0),
      s.set(...b.s),
    );
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(b.color));
  });
  mesh.name = name;
  mesh.userData = {
    textureFree: true,
    dayMaterial: day,
    nightMaterial: new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
    }),
  };
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}
function prepareRoot(native: boolean): { root: Group; state: SunState } {
  const root = new Group();
  root.name = native
    ? MINECRAFT_FERNSEHTURM_DETAIL_GROUP_NAME
    : FERNSEHTURM_DETAIL_GROUP_NAME;
  const state = {
    sun: {
      value: new Vector3(
        native ? 760 : -760,
        980,
        native ? -720 : 720,
      ).normalize(),
    },
    daylight: { value: 1 },
  };
  states.set(root, state);
  root.userData = {
    textureFree: true,
    keepInMinecraft: native,
    blockNative: native,
    originalSourceRetained: true,
    sourcePartIds: P.sourcePartIds,
    sourceConflict: P.sourceConflict,
    hiddenSolidInfill: false,
    publicLevels: [203, 207],
    totalHeight: P.totalHeight,
    setFernsehturmLighting: (
      sun: Vector3 | readonly number[],
      daylight: number,
    ) => updateFernsehturmLighting(root, sun, daylight),
  };
  return { root, state };
}
function setupSteel(mesh: Mesh, state: SunState): void {
  const day = mesh.userData.dayMaterial as MeshBasicMaterial;
  addSunReflection(day, state);
  const graded = schwellenraumMaterialFor(mesh, day) as MeshBasicMaterial,
    grade = graded.onBeforeCompile.bind(graded);
  graded.onBeforeCompile = (shader, renderer) => {
    day.onBeforeCompile(shader, renderer);
    grade(shader, renderer);
  };
  graded.customProgramCacheKey = () =>
    "fernsehturm-steel-cross-v149-schwellenraum";
  mesh.userData.sunReflectionSurface = true;
  mesh.userData.nightMaterial = new MeshStandardMaterial({
    vertexColors: !(mesh instanceof InstancedMesh),
    color: 0xffffff,
    roughness: 0.32,
    metalness: 0.45,
  });
}
/** Complete identical detail for touch and desktop; no distance residency. */
export function createFernsehturmArchitecture(_mobileLike = false): Group {
  const { root, state } = prepareRoot(false),
    solid = new GeometryBatch(),
    steel = new GeometryBatch(),
    glass = new GeometryBatch(),
    members: Block[] = [];
  solid.cylinder(0, 20, 16, 8, CONCRETE);
  solid.cylinder(20, 250, 8, 4.5, CONCRETE);
  for (const h of [184.5, 188.1]) {
    solid.cylinder(h, h + 1.25, 7.3, 7.3, FRAME);
    solid.cylinder(h + 1.25, h + 1.65, 7.45, 7.45, 0x6b797c);
  }
  const point = (h: number, a: number, lift = 0): Point => {
    const r = sphereRadiusAt(h) + lift;
    return [r * Math.sin(a), h, r * Math.cos(a)];
  };
  const heights = new Set<number>([196, 228, ...P.windowBands.flat()]);
  for (let row = 1; row < P.shellRows; row++)
    heights.add(196 + (row * 32) / P.shellRows);
  const sorted = [...heights].sort((a, b) => a - b);
  for (let row = 0; row < sorted.length - 1; row++) {
    const lo = sorted[row],
      hi = sorted[row + 1],
      middle = (lo + hi) / 2,
      isWindow = windowAt(middle),
      batch = isWindow ? glass : steel;
    for (let col = 0; col < P.circumferentialPanels; col++) {
      const a = (col * Math.PI * 2) / 64,
        b = ((col + 1) * Math.PI * 2) / 64,
        p0 = point(lo, a),
        p1 = point(lo, b),
        p2 = point(hi, b),
        p3 = point(hi, a),
        peak = point(middle, (a + b) / 2, isWindow ? 0 : P.panelRelief),
        tone = isWindow ? GLASS : STEEL;
      batch.triangle(p0, p1, peak, tone);
      batch.triangle(p1, p2, peak, tone);
      batch.triangle(p2, p3, peak, tone);
      batch.triangle(p3, p0, peak, tone);
    }
  }
  for (const [lo, hi] of P.windowBands) {
    for (let col = 0; col < 64; col++) {
      const a = (col * Math.PI * 2) / 64,
        bottom = new Vector3(...point(lo, a, 0.14)),
        top = new Vector3(...point(hi, a, 0.14)),
        delta = top.clone().sub(bottom),
        length = delta.length();
      members.push({
        p: bottom.add(top).multiplyScalar(0.5).toArray() as Point,
        s: [0.105, length, 0.13],
        color: FRAME,
        q: new Quaternion().setFromUnitVectors(UP, delta.divideScalar(length)),
      });
    }
    for (const h of [lo, hi])
      solid.cylinder(
        h - 0.09,
        h + 0.09,
        sphereRadiusAt(h) + 0.13,
        sphereRadiusAt(h) + 0.13,
        FRAME,
      );
  }
  // Open eight-storey cylindrical service cage, with separate slabs and rail posts.
  for (let level = 0; level <= 8; level++) {
    const h = 228 + (level * 22) / 8;
    solid.cylinder(h, h + 0.23, 6.55, 6.55, FRAME);
    for (let i = 0; i < 48; i++) {
      const a = ((i + 0.5) * Math.PI) / 24;
      members.push({
        p: [6.55 * Math.sin(a), h + 1.24, 6.55 * Math.cos(a)],
        s: [2 * 6.55 * Math.sin(Math.PI / 48), 0.075, 0.075],
        color: FRAME,
        yaw: a,
      });
    }
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      members.push({
        p: [6.55 * Math.sin(a), h + 0.69, 6.55 * Math.cos(a)],
        s: [0.085, 1.12, 0.085],
        color: FRAME,
      });
    }
    if (level < 8)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        members.push({
          p: [6.55 * Math.sin(a), h + 1.35, 6.55 * Math.cos(a)],
          s: [0.16, 2.75, 0.16],
          color: 0x717c7c,
        });
      }
  }
  // Dish distribution and member sizes are photographed recognition, not a survey.
  for (let i = 0; i < 20; i++) {
    const a = i * 2.39996323,
      h = 230 + (i % 5) * 3.65,
      r = 6.97,
      out = new Vector3(Math.sin(a), 0.12, Math.cos(a)).normalize(),
      radius = 0.46 + (i % 3) * 0.17;
    solid.append(
      new CylinderGeometry(radius, radius, 0.2, 12),
      [r * Math.sin(a), h, r * Math.cos(a)],
      0xd8dedb,
      new Quaternion().setFromUnitVectors(UP, out),
    );
  }
  solid.cylinder(249.15, 250, 7.45, 7.45, FRAME);
  for (let i = 0; i < 12; i++)
    solid.cylinder(
      250 + (i * 118) / 12,
      250 + ((i + 1) * 118) / 12,
      1.45 - (i / 12) * 1.05,
      1.45 - ((i + 1) / 12) * 1.05,
      i % 2 ? 0xe8e6da : 0xc46c50,
      24,
    );
  for (const h of [256, 267, 285, 307, 330]) {
    const r = h < 270 ? 2.35 : 1.9;
    solid.cylinder(h, h + 0.35, r, r, FRAME, 24);
    for (let j = 0; j < 12; j++) {
      const a = (j * Math.PI) / 6;
      members.push({
        p: [r * Math.sin(a), h + 0.72, r * Math.cos(a)],
        s: [0.075, 0.9, 0.075],
        color: FRAME,
      });
    }
  }
  root.add(
    solid.mesh(
      "Fernsehturm concrete shaft, open radio balconies, dishes and red-white antenna",
    ),
  );
  const shell = steel.mesh(
    "Fernsehturm raised diamond stainless shell and solar cross",
  );
  setupSteel(shell, state);
  root.add(shell);
  root.add(
    glass.mesh(
      "Fernsehturm observation 203 m and restaurant 207 m window belts",
      true,
    ),
  );
  root.add(
    blockBatch(
      members,
      "Fernsehturm window mullions and open maintenance rails",
    ),
  );
  return freezeStaticSceneTransforms(root);
}
/** Deterministic native surface rings avoid allocating or rendering hidden solid infill. */
export function createMinecraftFernsehturmArchitecture(
  _mobileLike = false,
): Group {
  const { root, state } = prepareRoot(true),
    body: Block[] = [],
    steel: Block[] = [],
    windows: Block[] = [],
    cell = P.nativeCell;
  const ring = (
    target: Block[],
    h: number,
    height: number,
    r: number,
    color: number,
    thickness: number = cell,
  ) => {
    const max = Math.ceil(r / cell),
      half = cell / 2;
    for (let ix = -max; ix <= max; ix++)
      for (let iz = -max; iz <= max; iz++) {
        const x = ix * cell,
          z = iz * cell,
          near = Math.hypot(
            Math.max(0, Math.abs(x) - half),
            Math.max(0, Math.abs(z) - half),
          ),
          far = Math.hypot(Math.abs(x) + half, Math.abs(z) + half);
        if (near > r || far < Math.max(0, r - thickness)) continue;
        target.push({ p: [x, h, z], s: [cell, height, cell], color });
      }
  };
  for (let lo = 0; lo < 250; lo += cell) {
    const hi = Math.min(250, lo + cell),
      h = (lo + hi) / 2,
      r = h <= 20 ? 16 - h * 0.4 : 8 - ((h - 20) * 3.5) / 230;
    if (h < 196 || h > 228) ring(body, h, hi - lo, r, CONCRETE);
  }
  for (let lo = 196; lo < 228; lo += cell) {
    const hi = Math.min(228, lo + cell),
      h = (lo + hi) / 2,
      target = windowAt(h) ? windows : steel;
    ring(
      target,
      h,
      hi - lo,
      sphereRadiusAt(h),
      target === windows ? GLASS : STEEL,
    );
  }
  for (const h of [184.5, 188.1]) ring(body, h + 0.7, 1.4, 7.3, FRAME);
  for (let i = 0; i <= 8; i++) {
    const h = 228 + (i * 22) / 8;
    ring(body, h, 0.38, 6.55, FRAME, 0.7);
    for (let j = 0; j < 16; j++) {
      const a = (j * Math.PI) / 8;
      body.push({
        p: [6.55 * Math.sin(a), h + 0.7, 6.55 * Math.cos(a)],
        s: [0.18, 1.1, 0.18],
        color: FRAME,
      });
    }
  }
  for (let i = 0; i < 20; i++) {
    const a = i * 2.39996323,
      h = 230 + (i % 5) * 3.65;
    body.push({
      p: [6.9 * Math.sin(a), h, 6.9 * Math.cos(a)],
      s: [1.1, 1.1, 1.1],
      color: 0xd8dedb,
    });
  }
  for (let lo = 250; lo < 368; lo += 2) {
    const hi = Math.min(368, lo + 2),
      r = 1.45 - (((lo + hi) / 2 - 250) / 118) * 1.05;
    body.push({
      p: [0, (lo + hi) / 2, 0],
      s: [r * 2, hi - lo, r * 2],
      color: Math.floor((lo - 250) / (118 / 12)) % 2 ? 0xe8e6da : 0xc46c50,
    });
  }
  for (const h of [256, 267, 285, 307, 330])
    ring(body, h + 0.25, 0.5, h < 270 ? 2.35 : 1.9, FRAME, 0.6);
  root.add(
    blockBatch(
      body,
      "Fernsehturm native concrete, service and antenna courses",
    ),
  );
  const shell = blockBatch(
    steel,
    "Fernsehturm native stainless shell and solar cross",
  );
  setupSteel(shell, state);
  root.add(shell);
  const glass = blockBatch(
    windows,
    "Fernsehturm native 203 m and 207 m dark window belts",
  );
  glass.userData.nightMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    emissive: 0xb99455,
    emissiveIntensity: 0.6,
  });
  root.add(glass);
  root.traverse((o) => {
    if (o instanceof Mesh) o.userData.blockNative = true;
  });
  return freezeStaticSceneTransforms(root);
}
