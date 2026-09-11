import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide,
  Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  POTSDAMER_TRAFFIC_TOWER_PROFILE as P,
  POTSDAMER_TOWER_DRAWN_NAME, POTSDAMER_TOWER_MINECRAFT_NAME,
  POTSDAMER_TOWER_ROOT_NAME, potsdamerTowerLamps, potsdamerTowerPhase,
} from "./potsdamerTrafficTowerProfile";

export type PotsdamerTrafficTowerOptions = { mobileLike?: boolean; diagnostics?: boolean };
type Point = [number, number, number];
type Part = {
  role: string; shape: "box" | "disk" | "pentagon" | "roof";
  position: Point; size: Point; yaw: number; roll?: number; face?: number; color: number;
  glass?: boolean;
};
const GREEN = 0x405b49, EDGE = 0x293e33, GLASS = 0x8ca7aa;
const ON = [0xff4939, 0xffbc39, 0x35ed75];
const OFF = [0x371713, 0x34280e, 0x123823];
const UP = new Vector3(0, 1, 0);
const COLOR = new Color();
const activeLamps = new WeakMap<Object3D, { mesh: InstancedMesh; previous: number[] }[]>();

/** Authored parts retain their semantics for QA; no photograph becomes geometry data. */
export function planPotsdamerTrafficTower(): Part[] {
  const parts: Part[] = [];
  const add = (role: string, shape: Part["shape"], position: Point, size: Point,
    color: number, yaw = 0, face?: number, glass = false): void => {
    parts.push({ role, shape, position, size, color, yaw, face, glass });
  };
  add("granite platform", "pentagon", [0, .16, 0], [1.18, .32, 1.18], 0xa9aaa2, P.firstFaceYaw);
  add("granite platform cap", "pentagon", [0, .34, 0], [1.21, .04, 1.21], 0xc0c0b6, P.firstFaceYaw);
  add("cabin floor", "pentagon", [0, P.clockBottomM, 0], [1.01, .12, 1.01], EDGE, P.firstFaceYaw);
  add("cabin ceiling", "pentagon", [0, P.eaveBottomM, 0], [1.03, .1, 1.03], GREEN, P.firstFaceYaw);
  add("circular projecting eave", "disk", [0, (P.eaveBottomM + P.eaveTopM) / 2, 0],
    [P.roofRadiusM, P.eaveTopM - P.eaveBottomM, P.roofRadiusM], GREEN);
  add("shallow metal roof", "roof", [0, (P.eaveTopM + P.heightM) / 2, 0],
    [1.19, P.heightM - P.eaveTopM, 1.19], 0x647663, P.firstFaceYaw);
  const apothem = Math.cos(Math.PI / 5) * P.frameRadiusM;
  const width = 2 * Math.sin(Math.PI / 5) * P.frameRadiusM;
  for (let face = 0; face < P.faces; face++) {
    const yaw = P.firstFaceYaw + face * Math.PI * 2 / P.faces;
    // Tangent points right to a viewer looking directly at this outward face.
    const at = (u: number, y: number, depth = apothem): Point =>
      [Math.sin(yaw) * depth + Math.cos(yaw) * u, y,
        Math.cos(yaw) * depth - Math.sin(yaw) * u];
    const panel = (role: string, u: number, y: number, w: number, h: number,
      depth: number, color: number, radius = apothem, glass = false): void =>
      add(role, "box", at(u, y, radius), [w, h, depth], color, yaw, face, glass);
    // Exactly five independent legs; the middle remains open to the sky below the cabin.
    const cornerYaw = yaw + Math.PI / 5;
    add("open steel support", "box",
      [Math.sin(cornerYaw) * P.frameRadiusM, (P.platformTopM + P.eaveBottomM) / 2,
        Math.cos(cornerYaw) * P.frameRadiusM], [.16, P.eaveBottomM - P.platformTopM, .16],
      GREEN, cornerYaw, face);
    panel("clock backing", 0, (P.clockBottomM + P.clockTopM) / 2,
      width, P.clockTopM - P.clockBottomM, .09, GREEN);
    panel("clock lower frame", 0, P.clockBottomM + .035, width + .09, .09, .15, EDGE);
    panel("window sill", 0, P.clockTopM, width + .08, .11, .15, GREEN);
    panel("glass cabin window", 0, (P.clockTopM + P.windowTopM) / 2,
      width - .2, P.windowTopM - P.clockTopM - .14, .025, GLASS, apothem, true);
    panel("window header", 0, P.windowTopM, width + .04, .09, .14, GREEN);
    for (const side of [-1, 1]) panel("window side frame", side * (width / 2 - .055),
      (P.windowTopM + P.clockTopM) / 2, .07, P.windowTopM - P.clockTopM, .13, EDGE);
    panel("horizontal signal panel", 0, P.signalCentreM, width, .49, .13, GREEN);
    // Clock rims, faces and ticks are actual geometry, never canvas textures.
    const clockY = (P.clockBottomM + P.clockTopM) / 2;
    add("clock rim", "disk", at(0, clockY, apothem + .075), [.45, .065, .45], EDGE, yaw, face);
    add("clock white face", "disk", at(0, clockY, apothem + .112), [.405, .025, .405], 0xe8eee7, yaw, face);
    for (let tick = 0; tick < 12; tick++) {
      const angle = tick * Math.PI / 6;
      const length = tick % 3 === 0 ? .115 : .085;
      const centre = at(Math.sin(angle) * .343, clockY + Math.cos(angle) * .343, apothem + .132);
      add(`clock tick ${tick}`, "box", centre, [.025, length, .017], EDGE, yaw, face);
      parts[parts.length - 1].roll = -angle;
    }
    // A quiet 10:10 display cue; neither the source nor the viewer promises a live clock.
    for (const [role, angle, length] of [["clock hour hand", -Math.PI / 3, .25],
      ["clock minute hand", Math.PI / 3, .34]] as const) {
      add(role, "box", at(Math.sin(angle) * length / 2,
        clockY + Math.cos(angle) * length / 2, apothem + .155), [.035, length, .022], EDGE, yaw, face);
      parts[parts.length - 1].roll = -angle;
    }
    add("clock centre", "disk", at(0, clockY, apothem + .17), [.033, .025, .033], EDGE, yaw, face);
    for (let lamp = 0; lamp < 3; lamp++) {
      const u = (lamp - 1) * .32;
      add("lamp black housing", "disk", at(u, P.signalCentreM, apothem + .12), [.135, .11, .135], EDGE, yaw, face);
      // The real signal has projecting brows; keep the lit front unobscured.
      panel("lamp sun hood", u, P.signalCentreM + .14, .275, .045, .28, EDGE, apothem + .22);
    }
    // Pale-blue corner indicator housings from Berlin's documented auxiliary lights.
    panel("blue corner indicator", width / 2 - .015, P.signalCentreM, .11, .23, .08,
      0xadc4d0, apothem + .14);
    for (const y of [P.clockBottomM + .18, P.clockTopM - .18, P.windowTopM + .07]) {
      panel("panel rivet", width / 2 - .12, y, .035, .035, .025, 0x758472, apothem + .075);
    }
  }
  // Small brass identity plate on the base: no copied donor inscription.
  const plaqueYaw = P.firstFaceYaw;
  add("bronze identity plate", "box", [Math.sin(plaqueYaw) * .977, .19, Math.cos(plaqueYaw) * .977],
    [.43, .16, .025], 0x8d7c55, plaqueYaw);
  return parts;
}

function shapeGeometry(part: Part, segments: number): BufferGeometry {
  let geometry: BufferGeometry;
  if (part.shape === "box") geometry = new BoxGeometry(...part.size);
  else if (part.shape === "roof") geometry = new CylinderGeometry(0.04, part.size[0], part.size[1], 5, 1);
  else geometry = new CylinderGeometry(part.size[0], part.size[0], part.size[1], part.shape === "pentagon" ? 5 : segments, 1);
  if (part.shape === "disk" && part.face !== undefined) geometry.rotateX(Math.PI / 2);
  if (part.roll) geometry.rotateZ(part.roll);
  geometry.rotateY(part.yaw - (part.shape === "pentagon" || part.shape === "roof" ? Math.PI / 5 : 0));
  geometry.translate(...part.position);
  geometry.deleteAttribute("uv");
  return geometry;
}

function materials(glass: boolean, vertexColors: boolean): readonly [MeshBasicMaterial, MeshStandardMaterial] {
  const common = { vertexColors, side: DoubleSide, transparent: glass, opacity: glass ? .24 : 1, depthWrite: !glass };
  const day = new MeshBasicMaterial(common);
  const night = new MeshStandardMaterial({ ...common, metalness: .12, roughness: .74 });
  return [day, night];
}
function assignMaterials(mesh: Mesh, glass: boolean): void {
  const [day, night] = materials(glass, !!mesh.geometry.getAttribute("color"));
  mesh.material = day; mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
  mesh.userData.textureFree = true;
}

function createDrawn(parts: Part[], mobile: boolean): Group {
  const root = new Group(); root.name = POTSDAMER_TOWER_DRAWN_NAME;
  root.userData.keepInMinecraft = false;
  for (const glass of [false, true]) {
    const geometries = parts.filter(p => !!p.glass === glass).map(part => {
      const g = shapeGeometry(part, mobile ? 12 : 20), colors: number[] = [];
      COLOR.setHex(part.color);
      for (let i = 0; i < g.getAttribute("position").count; i++) colors.push(COLOR.r, COLOR.g, COLOR.b);
      g.setAttribute("color", new Float32BufferAttribute(colors, 3));
      const flat = g.toNonIndexed(); g.dispose(); return flat;
    });
    const geometry = mergeGeometries(geometries)!;
    for (const g of geometries) g.dispose();
    const mesh = new Mesh(geometry); mesh.name = glass ? "traffic tower glazing" : "traffic tower steel stone and five clocks";
    assignMaterials(mesh, glass); root.add(mesh);
  }
  root.add(createLamps(false));
  return root;
}

/** Surface-only native blocks, preserving the five open supports and clock/cabin tiers. */
function createMinecraft(parts: Part[], mobile: boolean): Group {
  const root = new Group(); root.name = POTSDAMER_TOWER_MINECRAFT_NAME;
  root.userData.keepInMinecraft = true; root.userData.blockNative = true;
  const cube = new BoxGeometry(1, 1, 1); cube.deleteAttribute("uv");
  const step = mobile ? .24 : .16;
  type Block = { p: Point; s: Point; color: number; glass: boolean };
  const blocks: Block[] = [];
  for (const part of parts) {
    if (mobile && part.role === "panel rivet") continue;
    if (part.shape === "box") {
      // Cube-only stepped face strips follow the actual pentagon without smooth diagonal slabs.
      if (part.roll !== undefined) {
        const [width, length, depth] = part.size;
        const n = Math.max(1, Math.ceil(length / .06));
        for (let i = 0; i < n; i++) {
          const t = (i + .5) * length / n - length / 2;
          const u = -Math.sin(part.roll) * t;
          blocks.push({ p: [part.position[0] + Math.cos(part.yaw) * u,
            part.position[1] + Math.cos(part.roll) * t,
            part.position[2] - Math.sin(part.yaw) * u],
            s: [Math.max(width, length / n), length / n, Math.max(depth, .045)],
            color: part.color, glass: false });
        }
        continue;
      }
      const [w, h, d] = part.size;
      const n = Math.max(1, Math.ceil(w / step));
      for (let i = 0; i < n; i++) {
        const u = -w / 2 + (i + .5) * w / n;
        blocks.push({ p: [part.position[0] + Math.cos(part.yaw) * u,
          part.position[1], part.position[2] - Math.sin(part.yaw) * u],
          s: [Math.abs(Math.cos(part.yaw)) * w / n + Math.abs(Math.sin(part.yaw)) * d,
            h, Math.abs(Math.sin(part.yaw)) * w / n + Math.abs(Math.cos(part.yaw)) * d],
          color: part.color, glass: !!part.glass });
      }
    } else if (part.face !== undefined) {
      const radius = part.size[0], n = Math.ceil(radius * 2 / step);
      for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
        const u = -radius + (col + .5) * 2 * radius / n;
        const v = -radius + (row + .5) * 2 * radius / n;
        if (u * u + v * v > radius * radius) continue;
        const s = 2 * radius / n;
        blocks.push({ p: [part.position[0] + Math.cos(part.yaw) * u,
          part.position[1] + v, part.position[2] - Math.sin(part.yaw) * u],
          s: [Math.abs(Math.cos(part.yaw)) * s + Math.abs(Math.sin(part.yaw)) * part.size[1],
            s, Math.abs(Math.sin(part.yaw)) * s + Math.abs(Math.cos(part.yaw)) * part.size[1]],
          color: part.color, glass: false });
      }
    } else {
      // Horizontal plates and low roof remain a thin occupied surface, never solid tower fill.
      const r = part.size[0], n = Math.ceil(r * 2 / step), s = r * 2 / n;
      for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
        const x = -r + (ix + .5) * s, z = -r + (iz + .5) * s;
        if (x * x + z * z > r * r) continue;
        if (part.shape === "pentagon") {
          let inside = true;
          for (let f = 0; f < 5; f++) {
            const a = P.firstFaceYaw + f * Math.PI * 2 / 5;
            if (x * Math.sin(a) + z * Math.cos(a) > r * Math.cos(Math.PI / 5)) inside = false;
          }
          if (!inside) continue;
        }
        const roof = part.shape === "roof";
        const top = roof ? P.eaveTopM + (1 - Math.hypot(x, z) / r) * (P.heightM - P.eaveTopM) : part.position[1] + part.size[1] / 2;
        const height = roof ? .1 : part.size[1];
        blocks.push({ p: [x, top - height / 2, z], s: [s, height, s], color: part.color, glass: false });
      }
      if (part.shape === "roof") blocks.push({ p: [0, P.heightM - .04, 0], s: [.12, .08, .12], color: part.color, glass: false });
    }
  }
  const transform = new Matrix4();
  for (const glass of [false, true]) {
    const selected = blocks.filter(b => b.glass === glass), mesh = new InstancedMesh(cube, new MeshBasicMaterial(), selected.length);
    selected.forEach((b, i) => {
      transform.makeScale(...b.s).setPosition(...b.p); mesh.setMatrixAt(i, transform);
      mesh.setColorAt(i, COLOR.setHex(b.color));
    });
    mesh.name = glass ? "traffic tower block glazing" : "traffic tower native blocks";
    assignMaterials(mesh, glass); mesh.userData.blockNative = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  }
  root.add(createLamps(true));
  root.userData.blocks = blocks.length;
  return root;
}

function createLamps(minecraft: boolean): InstancedMesh {
  const geometry = minecraft ? new BoxGeometry(.2, .2, .095) : new CylinderGeometry(.108, .108, .035, 16, 1);
  if (!minecraft) geometry.rotateX(Math.PI / 2);
  geometry.deleteAttribute("uv");
  const material = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const mesh = new InstancedMesh(geometry, material, P.faces * 3);
  mesh.name = "traffic tower animated lamps";
  mesh.userData.blockNative = minecraft; mesh.userData.textureFree = true;
  mesh.userData.dayMaterial = material; mesh.userData.nightMaterial = material;
  const matrix = new Matrix4(), rotation = new Quaternion();
  for (let face = 0; face < P.faces; face++) {
    const yaw = P.firstFaceYaw + face * Math.PI * 2 / P.faces;
    for (let lamp = 0; lamp < 3; lamp++) {
      const u = (lamp - 1) * .32, radius = Math.cos(Math.PI / 5) + (minecraft ? .24 : .186);
      matrix.compose(new Vector3(Math.sin(yaw) * radius + Math.cos(yaw) * u, P.signalCentreM,
        Math.cos(yaw) * radius - Math.sin(yaw) * u), rotation.setFromAxisAngle(UP, minecraft ? 0 : yaw), new Vector3(1, 1, 1));
      mesh.setMatrixAt(face * 3 + lamp, matrix); mesh.setColorAt(face * 3 + lamp, COLOR.setHex(OFF[lamp]));
    }
  }
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  return mesh;
}

export function createPotsdamerTrafficTower(groundYM = P.groundYM, options: PotsdamerTrafficTowerOptions = {}): Group {
  const root = new Group(); root.name = POTSDAMER_TOWER_ROOT_NAME;
  root.position.set(P.worldXZ[0], groundYM, P.worldXZ[1]);
  const parts = planPotsdamerTrafficTower();
  root.add(createDrawn(parts, false), createMinecraft(parts, !!options.mobileLike));
  Object.assign(root.userData, {
    sourceKey: P.osmKey, sourceRecordsRetained: true, sourceRingXZ: P.sourceRingXZ,
    heightM: P.heightM, textureFree: true, geometryStatus: P.geometryStatus,
    signalStatus: P.signalStatus, schwellenraumGeschuetzt: true,
  });
  if (options.diagnostics) root.userData.parts = parts;
  setPotsdamerTrafficTowerPresentation(root, "day");
  updatePotsdamerTrafficTower(root, 0, false);
  return root;
}

/** Safe before/after the shared mode-visibility pass; only the two owned subtrees change. */
export function setPotsdamerTrafficTowerPresentation(root: Object3D, mode: string): void {
  const tower = root.name === POTSDAMER_TOWER_ROOT_NAME ? root : root.getObjectByName(POTSDAMER_TOWER_ROOT_NAME);
  if (!tower) return;
  const minecraft = mode === "minecraft";
  const drawn = tower.getObjectByName(POTSDAMER_TOWER_DRAWN_NAME);
  const blocks = tower.getObjectByName(POTSDAMER_TOWER_MINECRAFT_NAME);
  if (drawn) drawn.visible = !minecraft;
  if (blocks) blocks.visible = minecraft;
}

/** Fifteen colour writes per representation, only at a phase/lights/reduced-motion boundary. */
export function updatePotsdamerTrafficTower(root: Object3D, seconds: number, reducedMotion: boolean, lightsOn = true): boolean {
  let batches = activeLamps.get(root);
  if (!batches) {
    batches = [];
    root.traverse(o => {
      if (o instanceof InstancedMesh && o.name === "traffic tower animated lamps") batches!.push({ mesh: o, previous: new Array(P.faces).fill(-99) });
    });
    if (batches.length === 0) return false;
    activeLamps.set(root, batches);
  }
  let changed = false;
  for (const { mesh, previous } of batches) {
    let dirty = false;
    for (let face = 0; face < P.faces; face++) {
      const phase = reducedMotion ? 2 : potsdamerTowerPhase(seconds, face);
      const key = lightsOn ? phase : -1;
      if (previous[face] === key) continue;
      previous[face] = key;
      const lit = potsdamerTowerLamps(phase);
      for (let lamp = 0; lamp < 3; lamp++) mesh.setColorAt(face * 3 + lamp,
        COLOR.setHex(lightsOn && lit[lamp] ? ON[lamp] : OFF[lamp]));
      dirty = true;
    }
    if (dirty && mesh.instanceColor) { mesh.instanceColor.needsUpdate = true; changed = true; }
  }
  return changed;
}
