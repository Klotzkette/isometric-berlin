import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DynamicDrawUsage,
  Float32BufferAttribute, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Sprite,
  SpriteMaterial, SRGBColorSpace, Vector3, type PerspectiveCamera,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { gunzipSync } from "three/examples/jsm/libs/fflate.module.js";
import receipt from "./data/busStopsV334Receipt.json";
import { fetchSurroundingTransport } from "./surroundingTransport";

type Berth = [id: string, name: number, x: number, z: number, platform: string, replacement: 0 | 1];
type Language = "de" | "en";
type BusStopIndex = { cellMeters: number; names: string[]; cells: Record<string, Berth[]> };
type GroundSupport = {
  ground: (x: number, z: number) => number | null;
  water: (x: number, z: number) => boolean;
  blocked: (x: number, y: number, z: number) => boolean;
};

const RADIUS = 235;
const MAX_MASTS = 64;
const MAX_LABELS = 8;
const GREEN = 0x215e42;
const YELLOW = 0xf6d953;
const SILVER = 0x767e7d;

export function parseBusStopsV334(bytes: Uint8Array): BusStopIndex {
  if (bytes.byteLength !== receipt.rawBytes) throw new Error("Unexpected bus-stop source size");
  const index = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as BusStopIndex;
  if (index.cellMeters !== 220 || !Array.isArray(index.names) || !index.cells ||
      !index.names.every(name => typeof name === "string" && name.length > 0 && name.length <= 180)) {
    throw new Error("Invalid bus-stop index");
  }
  const ids = new Set<string>();
  for (const [key, rows] of Object.entries(index.cells)) {
    if (!Array.isArray(rows)) throw new Error("Invalid bus-stop cell");
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== 6) throw new Error("Invalid bus-stop berth");
      const [id, name, x, z, platform, replacement] = row;
      if (typeof id !== "string" || !id || ids.has(id) || !Number.isInteger(name) ||
          name < 0 || name >= index.names.length || !Number.isFinite(x) || !Number.isFinite(z) ||
          key !== `${Math.floor(x / index.cellMeters)}_${Math.floor(z / index.cellMeters)}` ||
          typeof platform !== "string" || (replacement !== 0 && replacement !== 1)) {
        throw new Error("Invalid bus-stop berth");
      }
      ids.add(id);
    }
  }
  if (ids.size !== receipt.berths) throw new Error("Incomplete bus-stop index");
  return index;
}

function nearbyBusStops(index: BusStopIndex, x: number, z: number) {
  const results: { berth: Berth; distance: number }[] = [];
  const cell = index.cellMeters;
  for (let j = Math.floor((z - RADIUS) / cell); j <= Math.floor((z + RADIUS) / cell); j++) {
    for (let i = Math.floor((x - RADIUS) / cell); i <= Math.floor((x + RADIUS) / cell); i++) {
      for (const berth of index.cells[`${i}_${j}`] ?? []) {
        const distance = (berth[2] - x) ** 2 + (berth[3] - z) ** 2;
        if (distance <= RADIUS ** 2) results.push({ berth, distance });
      }
    }
  }
  return results.sort((a, b) => a.distance - b.distance || a.berth[5] - b.berth[5] || a.berth[0].localeCompare(b.berth[0]));
}

/** One untextured representative mast for each family. The feed locates
 * berths and carries no survey of the mast's exact position or construction. */
export function buildBusStopMastV334(native: boolean): BufferGeometry {
  const parts: BufferGeometry[] = [];
  function add(geometry: BufferGeometry, tint: number, x: number, y: number, z: number) {
    const c = new Color(tint);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.deleteAttribute("uv");
    parts.push(geometry.translate(x, y, z));
  }
  function box(x: number, y: number, z: number, w: number, h: number, d: number, tint: number) {
    add(new BoxGeometry(w, h, d), tint, x, y, z);
  }
  if (native) box(0, 1.44, 0, .105, 2.88, .105, SILVER);
  else add(new CylinderGeometry(.05, .058, 2.88, 8), SILVER, 0, 1.44, 0);
  box(0, 2.61, 0, .66, .72, .085, 0xeee9da);
  box(0, 1.69, 0, .30, .39, .105, 0xeee9da);
  for (const side of [-1, 1]) {
    if (native) {
      for (const step of [-1, 0, 1]) {
        box(0, 2.68 + step * .115, side * .048, step ? .31 : .43, .115, .025, GREEN);
        box(0, 2.68 + step * .093, side * .062, step ? .26 : .364, .093, .011, YELLOW);
      }
    } else {
      for (const [radius, z, color] of [[.214, .048, GREEN], [.185, .062, YELLOW]]) {
        add(new CylinderGeometry(radius, radius, .025, 20).rotateX(Math.PI / 2), color, 0, 2.68, side * z);
      }
    }
    for (const x of [-.062, .062]) box(x, 2.68, side * .079, .031, .17, .012, GREEN);
    box(0, 2.68, side * .079, .126, .03, .012, GREEN);
    box(0, 2.36, side * .047, .48, .046, .015, 0x354844);
    for (const y of [1.58, 1.67, 1.76]) box(0, y, side * .058, .21, .017, .014, 0x777f75);
  }
  const geometry = mergeGeometries(parts)!;
  for (const part of parts) part.dispose();
  return geometry;
}

function busName(name: string, berth: Berth, lang: Language): Sprite | null {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = berth[5] ? "#695421" : "#215e42";
  ctx.fillRect(0, 0, 384, 96);
  ctx.fillStyle = "#fff9ec";
  ctx.fillRect(3, 3, 378, 90);
  ctx.fillStyle = "#214f3b";
  ctx.font = "700 22px system-ui";
  ctx.fillText(name, 12, 37, 360);
  ctx.font = "500 18px system-ui";
  const service = berth[5] ? (lang === "de" ? "Ersatzverkehr" : "Replacement bus") : (lang === "de" ? "Bushaltestelle" : "Bus stop");
  const platform = berth[4] ? ` · ${lang === "de" ? "Steig" : "Stop"} ${berth[4]}` : "";
  ctx.fillText(service + platform, 12, 69, 360);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map, depthWrite: false, fog: false, toneMapped: false }));
  sprite.name = name;
  sprite.center.set(.5, 0);
  return sprite;
}

export function createBusStopsV334(index: BusStopIndex) {
  const root = new Group();
  root.name = "VBB bus stops v334";
  const material = new MeshStandardMaterial({ roughness: .8, vertexColors: true });
  const geometries = [buildBusStopMastV334(false), buildBusStopMastV334(true)];
  const pool = new InstancedMesh(geometries[0], material, MAX_MASTS);
  pool.name = "Bus stop masts on retained terrain";
  pool.count = 0;
  pool.instanceMatrix.setUsage(DynamicDrawUsage);
  pool.frustumCulled = false;
  pool.raycast = () => {};
  root.add(pool);

  const labels = new Map<string, Sprite>();
  const matrix = new Matrix4(), point = new Vector3(), direction = new Vector3(), priorDirection = new Vector3();
  let lastScan = -Infinity;
  let previous: { x: number; z: number; distance: number; native: boolean; show: boolean; lang: Language; revision: number } | null = null;

  function releaseLabel(id: string, sprite: Sprite) {
    sprite.removeFromParent();
    sprite.material.map?.dispose();
    sprite.material.dispose();
    labels.delete(id);
  }

  return {
    root,
    refresh(
      timestamp: number, camera: PerspectiveCamera, x: number, z: number, native: boolean, show: boolean,
      lang: Language, revision: number, support: GroundSupport,
    ): boolean {
      if (timestamp - lastScan < 260) return false;
      lastScan = timestamp;
      camera.getWorldDirection(direction);
      const distanceToFocus = Math.hypot(camera.position.x - x, camera.position.y, camera.position.z - z);
      if (previous && native === previous.native && show === previous.show && lang === previous.lang &&
          revision === previous.revision && (x - previous.x) ** 2 + (z - previous.z) ** 2 < 7 ** 2 &&
          (!show || (direction.dot(priorDirection) > .998 && Math.abs(distanceToFocus - previous.distance) < 6))) {
        return false;
      }
      if (lang !== previous?.lang) for (const [id, sprite] of labels) releaseLabel(id, sprite);
      previous = { x, z, distance: distanceToFocus, native, show, lang, revision };
      priorDirection.copy(direction);
      pool.geometry = geometries[Number(native)];

      const shown = new Set<string>(), mastLocations = new Set<string>();
      const occupied: [number, number][] = [];
      let count = 0;
      for (const { berth, distance } of nearbyBusStops(index, x, z)) {
        const [id, name, bx, bz, , replacement] = berth;
        const site = `${bx}/${bz}`;
        const mayPlace = !replacement && distance <= 205 ** 2 && count < MAX_MASTS && !mastLocations.has(site);
        const mayLabel = show && shown.size < MAX_LABELS;
        if (!mayPlace && !mayLabel) continue;
        const y = support.ground(bx, bz);
        if (y === null || !Number.isFinite(y) || support.water(bx, bz)) continue;
        if (mayPlace && !support.blocked(bx, y, bz)) {
          pool.setMatrixAt(count++, matrix.makeTranslation(bx, y, bz));
          mastLocations.add(site);
        }
        if (!mayLabel) continue;
        point.set(bx, y + 3.10, bz).project(camera);
        if (Math.abs(point.x) > .86 || Math.abs(point.y) > .87 || Math.abs(point.z) >= 1 ||
            occupied.some(([px, py]) => Math.abs(px - point.x) < .20 && Math.abs(py - point.y) < .11)) continue;
        const sprite = labels.get(id) ?? busName(index.names[name], berth, lang);
        if (!sprite) continue;
        if (!sprite.parent) root.add(sprite);
        occupied.push([point.x, point.y]);
        labels.set(id, sprite);
        shown.add(id);
        sprite.position.set(bx, y + 3.10, bz);
        const scale = Math.max(.75, Math.min(8.4, camera.position.distanceTo(sprite.position) * .07));
        sprite.scale.set(scale, scale * .25, 1);
      }
      for (const [id, sprite] of labels) if (!shown.has(id)) releaseLabel(id, sprite);
      pool.count = count;
      pool.instanceMatrix.needsUpdate = true;
      return true;
    },
    dispose(): void {
      root.removeFromParent();
      for (const [id, sprite] of labels) releaseLabel(id, sprite);
      pool.dispose();
      for (const geometry of geometries) geometry.dispose();
      material.dispose();
      root.clear();
    },
  };
}

async function readBusSource(body: ReadableStream<Uint8Array>, length: number) {
  const bytes = new Uint8Array(length), reader = body.getReader();
  let offset = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      if (offset + next.value.length > length) throw new Error("Oversized bus-stop source");
      bytes.set(next.value, offset);
      offset += next.value.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (offset !== length) throw new Error("Incomplete bus-stop source");
  return bytes;
}

export async function loadBusStopsV334(signal: AbortSignal) {
  const url = new URL(`./mesh/regierungsviertel/${receipt.file}?v=${receipt.sha256}`, new URL(import.meta.env.BASE_URL, document.baseURI));
  const { body, headers } = await fetchSurroundingTransport(fetch, url, signal);
  const decoded = headers.get("content-encoding")?.toLowerCase().split(",").some(value => value.trim() === "gzip");
  const bytes = await readBusSource(body, decoded ? receipt.rawBytes : receipt.packedBytes);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (decoded) return createBusStopsV334(parseBusStopsV334(bytes));
  if (new DataView(bytes.buffer).getUint32(bytes.length - 4, true) !== receipt.rawBytes) {
    throw new Error("Unexpected bus-stop gzip size");
  }
  const index = gunzipSync(bytes, { out: new Uint8Array(receipt.rawBytes) });
  return createBusStopsV334(parseBusStopsV334(index));
}

export type BusStopsV334 = ReturnType<typeof createBusStopsV334>;
