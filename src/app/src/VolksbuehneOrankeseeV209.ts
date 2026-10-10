import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import data from "./data/orankeseeV209.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const VOLKSBUEHNE_ORANKESEE_V209_GROUP = "Exact Orankesee shore and mapped public lido fittings v209";
type Row = number[];
type Point2 = number[];
type Feature = { id: string; tags: Record<string, string>; geometry: { type: string; coordinates: unknown }; renderGeometry?: { type: string; coordinates: unknown } };

/** The complete theatre shell is required separately in VolksbuehneEnvelopeV209.
 * This optional layer adds no water, ordinary buildings, trees or path surfaces. */
export function createVolksbuehneOrankeseeV209(native = false): Group {
  const root = new Group(); root.name = VOLKSBUEHNE_ORANKESEE_V209_GROUP;
  root.userData = { sourceGeometryRetained: true, additiveOnly: true, fullStaticDetailOnTouch: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native, textureFree: true,
    waterSourceId: data.waterOwner, noNewWaterSurface: true, sourceReceipt: "orankesee-v209-source.json",
    sourceIds: data.features.map(f => f.id), shorelineVertices: data.shoreline.length };
  const rows: Row[] = [];
  const put = (x: number, y: number, z: number, w: number, h: number, d: number, yaw: number, c: number) => {
    if (!native) { rows.push([x, y, z, w, h, d, yaw, c]); return; }
    const count = Math.max(1, Math.ceil(w / .9));
    for (let i = 0; i < count; i++) {
      const u = (i + .5) * w / count - w / 2;
      rows.push([x + Math.cos(yaw) * u, y, z - Math.sin(yaw) * u,
        Math.max(.06, Math.abs(Math.cos(yaw)) * w / count + Math.abs(Math.sin(yaw)) * d), h,
        Math.max(.06, Math.abs(Math.sin(yaw)) * w / count + Math.abs(Math.cos(yaw)) * d), c]);
    }
  };
  const line = (a: Point2, b: Point2, y: number, width: number, h: number, color: number, offset = 0) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < .01) return;
    put((a[0] + b[0]) / 2 - dz / length * offset, y,
      (a[1] + b[1]) / 2 + dx / length * offset, length, h, width, -Math.atan2(dz, dx), color);
  };
  // Full 82-vertex source coast; it has no second water surface underneath.
  for (let i = 1; i < data.shoreline.length; i++)
    line(data.shoreline[i - 1], data.shoreline[i], 3.075, .14, .09, 0x798c70);
  const used = { benches: 0, bins: 0, boards: 0, slideWays: 0, fences: 0, paths: 0 };
  for (const item of data.features as unknown as Feature[]) {
    const { tags } = item, geometry = item.renderGeometry ?? item.geometry;
    if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      const lines = geometry.type === "LineString" ? [geometry.coordinates as Point2[]] : geometry.coordinates as Point2[][];
      for (const points of lines) {
        if (tags.highway && ["footway", "path", "steps"].includes(tags.highway)) {
          used.paths++;
          const half = Number(tags.width) > 0 ? Number(tags.width) / 2 : 1.25;
          for (let i = 1; i < points.length; i++) for (const side of [-1, 1])
            line(points[i - 1], points[i], 3.10, .07, .08, 0xa5a18b, half * side);
        }
        if (tags.barrier === "fence") {
          used.fences++;
          for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            for (const y of [3.45, 4.25]) line(a, b, y, .055, .055, 0x6a7364);
            const count = Math.max(1, Math.ceil(length / 2.6));
            for (let k = 0; k < count; k++) {
              const t = k / count;
              put(a[0] + (b[0] - a[0]) * t, 3.72, a[1] + (b[1] - a[1]) * t, .065, 1.44, .065, 0, 0x626b60);
            }
          }
        }
        if (tags.attraction === "water_slide") {
          used.slideWays++;
          const lengths = points.slice(1).map((b, i) => Math.hypot(b[0] - points[i][0], b[1] - points[i][1]));
          const total = lengths.reduce((a, b) => a + b, 0); let travelled = 0;
          for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i], length = lengths[i - 1], n = Math.max(1, Math.ceil(length / .65));
            for (let k = 0; k < n; k++) {
              const t = (k + .5) / n, y = 3.28 + 2.9 * (1 - (travelled + t * length) / total);
              const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
              put(x, y, z, length / n + .025, .15, 1.0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0x80b2b5);
              if (k % 4 === 0) put(x, (y + 3) / 2, z, .10, y - 3, .10, 0, 0xc6c9ba);
            }
            travelled += length;
          }
        }
      }
    }
    if (geometry.type !== "Point") continue;
    const [x, z] = geometry.coordinates as number[];
    const direction = Number(tags.direction), yaw = Number.isFinite(direction) ? direction * Math.PI / 180 : 0;
    const local = (u: number, y: number, v: number, w: number, h: number, d: number, c: number) =>
      put(x + Math.cos(yaw) * u + Math.sin(yaw) * v, y,
        z - Math.sin(yaw) * u + Math.cos(yaw) * v, w, h, d, yaw, c);
    if (tags.amenity === "bench") {
      used.benches++;
      local(0, 3.46, 0, 1.8, .11, .45, 0x8a6b43);
      if (tags.backrest !== "no") local(0, 3.8, .2, 1.8, .5, .085, 0x8a6b43);
      for (const u of [-.65, .65]) local(u, 3.23, 0, .11, .46, .40, 0x505b4c);
    } else if (tags.amenity === "waste_basket") {
      used.bins++; local(0, 3.52, 0, .37, .72, .37, tags.colour === "orange" ? 0xb77734 : 0x6d7763);
      local(0, 3.91, 0, .42, .08, .42, 0x4a5348);
    } else if (tags.information === "board") {
      used.boards++; local(0, 4.45, 0, 1.08, .68, .08, 0xe2d8b3);
      for (const u of [-.45, .45]) local(u, 3.73, 0, .075, 1.46, .075, 0x6d6b53);
    } else if (tags.amenity === "bicycle_parking") {
      const count = Math.min(11, Math.ceil((Number(tags.capacity) || 4) / 2));
      for (let i = 0; i < count; i++) {
        const u = (i - (count - 1) / 2) * .66;
        for (const v of [-.32, .32]) local(u, 3.38, v, .065, .76, .065, 0x79817a);
        local(u, 3.76, 0, .065, .065, .70, 0x79817a);
      }
    } else if (tags.emergency === "life_ring") {
      local(0, 3.75, 0, .09, 1.5, .09, 0xdddcc8);
      for (const u of [-.24, .24]) local(u, 4.15, 0, .13, .53, .13, 0xc57a3e);
      for (const y of [3.91, 4.39]) local(0, y, 0, .48, .13, .13, 0xc57a3e);
    }
  }
  root.userData.mappedFittings = used;
  const furniture = justicePalaceV183Boxes(rows, native);
  furniture.name = "Exact shore edge path margins lido slides fences and mapped public furniture";
  root.add(furniture);
  const positions = data.sand.flat(), colors: number[] = [], tint = new Color(0xd0bd87);
  for (let i = 0; i < positions.length; i += 3) colors.push(tint.r, tint.g, tint.b);
  const geo = new BufferGeometry(); geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .98 });
  const sand = new Mesh(geo, day); sand.name = "Mapped Orankesee sand beach way 10354648 excludes original water";
  sand.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, sourceId: "way/10354648", nativeMinecraft: native };
  root.add(sand);
  return freezeStaticSceneTransforms(root);
}
