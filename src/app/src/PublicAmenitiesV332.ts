import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, DynamicDrawUsage, Float32BufferAttribute,
  Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, ShapeUtils, Sprite,
  SpriteMaterial, SRGBColorSpace, Vector2, Vector3, type PerspectiveCamera,
} from "three";
import source from "./data/publicAmenitiesV332.json";
import { amenityFurnitureV332 } from "./PublicAmenityFurnitureV332";
import { recreationFurnitureV332 } from "./PublicRecreationFurnitureV332";
import { createNaunynSpaetiV332, NAUNYN_SPAETI_V332 } from "./NaunynSpaetiV332";

type Kind = "toilet" | "postbox" | "kiosk" | "spaeti" | "playground" | "play-equipment"
  | "fountain" | "paddling" | "drinking" | "pool" | "strandbath" | "police" | "police-hq";
type Site = [id: string, kind: Kind, name: string, x: number, z: number, model: string, variant: string, address: string];
type Ring = [number, number][];
type Basin = [id: string, site: string, x: number, z: number, rings: Ring[], runs: [number, number, number, number][]];
const cells = source.cells as unknown as Record<string, Site[]>;
const basins = source.basins as unknown as Record<string, Basin[]>;
const CELL = source.cellMeters;
const RADIUS = 280;
const MAX_BOXES = 768;
const MAX_BADGES = 12;
const MAX_BASINS = 18;

const badges: Record<Exclude<Kind, "play-equipment">, [string, string, string]> = {
  toilet: ["WC", "WC", "#345763"],
  postbox: ["Briefkasten", "Post box", "#765521"],
  kiosk: ["Kiosk", "Kiosk", "#715237"],
  spaeti: ["Späti", "Späti", "#805649"],
  playground: ["Spielplatz", "Playground", "#506238"],
  fountain: ["Brunnen", "Fountain", "#39677a"],
  paddling: ["Plansche", "Splash pool", "#39677a"],
  drinking: ["Trinkbrunnen", "Drinking fountain", "#39677a"],
  pool: ["Freibad", "Outdoor pool", "#326e72"],
  strandbath: ["Strandbad", "Bathing beach", "#326e72"],
  police: ["Polizei", "Police", "#3b526f"],
  "police-hq": ["Polizeipräsidium", "Police headquarters", "#3b526f"],
};

function nearby<T>(index: Record<string, T[]>, x: number, z: number): T[] {
  const results: T[] = [];
  for (let j = Math.floor((z - RADIUS) / CELL); j <= Math.floor((z + RADIUS) / CELL); j++) {
    for (let i = Math.floor((x - RADIUS) / CELL); i <= Math.floor((x + RADIUS) / CELL); i++) {
      const tile = index[`${i}_${j}`];
      if (tile) results.push(...tile);
    }
  }
  return results;
}

function createBadge(site: Site, lang: "de" | "en"): Sprite | null {
  const [, kind, name, , , , , address] = site;
  const [de, en, color] = badges[kind as Exclude<Kind, "play-equipment">];
  const label = lang === "de" ? de : en;
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 112;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 384, 100);
  ctx.fillStyle = "#fff9ed";
  ctx.fillRect(2, 2, 380, 96);
  ctx.fillStyle = color;
  ctx.font = "700 26px system-ui";
  ctx.fillText(label, 12, 34, 360);
  ctx.font = "500 20px system-ui";
  const detail = name && name !== label ? name : address;
  ctx.fillText(detail || label, 12, 69, 360);
  ctx.beginPath();
  ctx.moveTo(184, 98);
  ctx.lineTo(192, 112);
  ctx.lineTo(200, 98);
  ctx.fill();
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({
    map, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
  }));
  sprite.name = name || label;
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 900;
  return sprite;
}

export function basinGeometryV332(basin: Basin, native: boolean, y: number): BufferGeometry | null {
  const geometry = new BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  if (native) {
    for (const [x0, z0, x1, z1] of basin[5]) {
      const base = vertices.length / 3;
      vertices.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
      indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  } else {
    const [outline, ...holes] = basin[4].map(ring => ring.map(([x, z]) => new Vector2(x, z)));
    const triangles = ShapeUtils.triangulateShape(outline, holes);
    const points = outline.concat(...holes);
    for (const point of points) vertices.push(point.x, y, point.y);
    for (const [a, b, c] of triangles) {
      const p = points[a], q = points[b], r = points[c];
      if ((q.x - p.x) * (r.y - p.y) > (q.y - p.y) * (r.x - p.x)) indices.push(a, c, b);
      else indices.push(a, b, c);
    }
  }
  if (indices.length === 0) return null;
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

type Support = {
  ground: (x: number, z: number) => number | null;
  water: (x: number, z: number) => boolean;
  blocked: (x: number, y: number, z: number) => boolean;
  hasHost: (id: string, sha256: string) => boolean;
};

export function createPublicAmenitiesV332() {
  const root = new Group();
  root.name = "Verified public amenities v332";
  const box = new BoxGeometry();
  const material = new MeshStandardMaterial({ roughness: 0.8 });
  const water = new MeshStandardMaterial({ color: 0x62a6b5, roughness: 0.48 });
  const pool = new InstancedMesh(box, material, MAX_BOXES);
  pool.count = 0;
  pool.instanceMatrix.setUsage(DynamicDrawUsage);
  pool.frustumCulled = false;
  root.add(pool);
  const activeBadges = new Map<string, Sprite>();
  const activeBasins = new Map<string, Mesh>();
  const matrix = new Matrix4();
  const color = new Color();
  const point = new Vector3();
  const direction = new Vector3();
  const previousDirection = new Vector3();
  let previous: { x: number; z: number; distance: number; native: boolean; show: boolean; lang: "de" | "en"; revision: number } | null = null;
  let lastScan = -Infinity;
  let language: "de" | "en" = "de";
  let storefront: { root: Group; native: boolean } | null = null;

  function releaseBadge(sprite: Sprite): void {
    sprite.removeFromParent();
    sprite.material.map?.dispose();
    sprite.material.dispose();
  }

  function releaseStorefront(): void {
    if (!storefront) return;
    storefront.root.removeFromParent();
    storefront.root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      for (const material of new Set([object.material, object.userData.nightMaterial])) material?.dispose();
    });
    storefront = null;
  }

  return {
    root,
    refresh(
      timestamp: number, camera: PerspectiveCamera, x: number, z: number,
      native: boolean, show: boolean, lang: "de" | "en", revision: number, support: Support,
    ): boolean {
      if (timestamp - lastScan < 260) return false;
      lastScan = timestamp;
      camera.getWorldDirection(direction);
      const distanceToFocus = Math.hypot(camera.position.x - x, camera.position.y, camera.position.z - z);
      if (previous && previous.native === native && previous.show === show && previous.lang === lang &&
          previous.revision === revision && (previous.x - x) ** 2 + (previous.z - z) ** 2 < 9 ** 2 &&
          (!show || direction.dot(previousDirection) > 0.998 &&
            Math.abs(previous.distance - distanceToFocus) < 7)) return false;
      previous = { x, z, distance: distanceToFocus, native, show, lang, revision };
      previousDirection.copy(direction);
      const [shopX, shopZ] = NAUNYN_SPAETI_V332.worldXZ;
      const showStorefront = (shopX - x) ** 2 + (shopZ - z) ** 2 <= RADIUS ** 2 &&
        support.hasHost(NAUNYN_SPAETI_V332.tile, native ? NAUNYN_SPAETI_V332.nativeSha256 : NAUNYN_SPAETI_V332.drawnSha256);
      if (storefront && (!showStorefront || storefront.native !== native)) releaseStorefront();
      if (!storefront && showStorefront) {
        storefront = { root: createNaunynSpaetiV332(native), native };
        root.add(storefront.root);
      }
      if (lang !== language) {
        for (const sprite of activeBadges.values()) releaseBadge(sprite);
        activeBadges.clear();
        language = lang;
      }
      const ordered = nearby(cells, x, z).map(site => ({ site, distance: (site[3] - x) ** 2 + (site[4] - z) ** 2 }))
        .filter(item => item.distance <= RADIUS ** 2)
        .sort((a, b) => a.distance - b.distance || a.site[0].localeCompare(b.site[0]));
      const shown = new Set<string>();
      const screen: [number, number][] = [];
      let count = 0;
      for (const { site, distance } of ordered) {
        const [id, kind, , sx, sz, model, variant] = site;
        const parts = model && distance < 215 ** 2
          ? kind === "postbox" || kind === "toilet"
            ? amenityFurnitureV332(kind, model, variant, native)
            : recreationFurnitureV332(kind, model, native)
          : [];
        const mayPlace = parts.length > 0 && count + parts.length <= MAX_BOXES;
        const mayLabel = show && kind !== "play-equipment" && shown.size < MAX_BADGES;
        if (!mayPlace && !mayLabel) continue;
        const y = support.ground(sx, sz);
        if (y === null) continue;
        if (mayPlace && !support.water(sx, sz) && !support.blocked(sx, y, sz)) {
          for (const [dx, dy, dz, w, h, d, tint] of parts) {
            matrix.makeScale(w, h, d).setPosition(sx + dx, y + dy, sz + dz);
            pool.setMatrixAt(count, matrix);
            pool.setColorAt(count++, color.setHex(tint));
          }
        }
        if (!mayLabel) continue;
        point.set(sx, y + 3.4, sz).project(camera);
        if (Math.abs(point.x) > 0.84 || Math.abs(point.y) > 0.87 || Math.abs(point.z) >= 1 ||
            screen.some(([px, py]) => Math.abs(px - point.x) < 0.20 && Math.abs(py - point.y) < 0.115)) continue;
        screen.push([point.x, point.y]);
        const sprite = activeBadges.get(id) ?? createBadge(site, lang);
        if (!sprite) continue;
        if (!sprite.parent) root.add(sprite);
        activeBadges.set(id, sprite);
        shown.add(id);
        sprite.position.set(sx, y + 3.4, sz);
        const scale = Math.max(0.7, Math.min(9.5, camera.position.distanceTo(sprite.position) * 0.075));
        sprite.scale.set(scale, scale * (112 / 384), 1);
      }
      for (const [id, sprite] of activeBadges) {
        if (!shown.has(id)) {
          releaseBadge(sprite);
          activeBadges.delete(id);
        }
      }
      pool.count = count;
      pool.instanceMatrix.needsUpdate = true;
      if (pool.instanceColor) pool.instanceColor.needsUpdate = true;

      const desired = new Set<string>();
      const basinDistance = (basin: Basin) => (basin[2] - x) ** 2 + (basin[3] - z) ** 2;
      for (const basin of nearby(basins, x, z).sort((a, b) => basinDistance(a) - basinDistance(b))) {
        if (desired.size >= MAX_BASINS) break;
        const [id, , bx, bz] = basin;
        if (basinDistance(basin) > RADIUS ** 2 || support.water(bx, bz)) continue;
        const y = support.ground(bx, bz);
        if (y === null || support.blocked(bx, y, bz)) continue;
        // The visible retained terrain must agree with the basin's entire rim.
        if (basin[4].some(ring => ring.some(([rx, rz]) => {
          const rim = support.ground(rx, rz);
          return rim === null || Math.abs(rim - y) > 0.45;
        }))) continue;
        const key = `${id}:${native}:${y.toFixed(2)}`;
        desired.add(key);
        if (activeBasins.has(key)) continue;
        const geometry = basinGeometryV332(basin, native, y + 0.08);
        if (!geometry) continue;
        const mesh = new Mesh(geometry, water);
        mesh.name = `Mapped basin ${id}`;
        root.add(mesh);
        activeBasins.set(key, mesh);
      }
      for (const [key, mesh] of activeBasins) {
        if (!desired.has(key)) {
          mesh.removeFromParent();
          mesh.geometry.dispose();
          activeBasins.delete(key);
        }
      }
      return true;
    },
    dispose(): void {
      root.removeFromParent();
      releaseStorefront();
      for (const sprite of activeBadges.values()) releaseBadge(sprite);
      for (const mesh of activeBasins.values()) mesh.geometry.dispose();
      activeBadges.clear();
      activeBasins.clear();
      pool.dispose();
      box.dispose();
      material.dispose();
      water.dispose();
      root.clear();
    },
  };
}

export type PublicAmenitiesV332 = ReturnType<typeof createPublicAmenitiesV332>;
