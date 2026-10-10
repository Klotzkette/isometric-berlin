import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/prisonsMemorialsV209.json";
import envelopes from "./data/prisonsMemorialsV209Envelopes.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const PRISONS_MEMORIALS_V209_GROUP = "Tegel and two distinct Stasi memorial sites v209";
export const PRISONS_MEMORIALS_V209_SOURCE_IDS = envelopes.sourceIds;
export const PRISONS_MEMORIALS_V209_CAMERAS = {
  tegel: { position: [-4680, 340, -5870], target: [-5165, 8, -6112], spanM: 730 },
  hq: { position: [7460, 220, 930], target: [7810, 8, 690], spanM: 460 },
  hsh: { position: [8620, 160, -2180], target: [8867, 7, -2350], spanM: 310 },
};

function materials() {
  return {
    day: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
    night: new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .9 }),
  };
}

function rootGroup(native: boolean, envelopes: boolean): Group {
  const root = new Group();
  root.name = PRISONS_MEMORIALS_V209_GROUP + (envelopes ? " complete source envelopes" : " exterior details") + (native ? " native" : "");
  root.userData = {
    prisonsMemorialsV209: true, sourceGeometryRetained: true,
    sourceOwnerIds: PRISONS_MEMORIALS_V209_SOURCE_IDS,
    fullStaticDetailOnTouch: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native, textureFree: true, completeSourceEnvelopes: envelopes,
    sourceReceipt: "prisons-memorials-v209-source.json", newCourtClosures: false,
    distinctSites: ["JVA Tegel", "Former Stasi HQ / Normannenstrasse", "Hohenschoenhausen memorial"],
    jvaMoabitAndLehrterMemorialUnchanged: true,
  };
  return root;
}

function instances(rows: (number | string)[][], native: boolean, name: string): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const normals = geometry.getAttribute("normal"), shades = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const shade = normals.getY(i) > .5 ? 1 : normals.getX(i) > .5 ? .83 : .94;
    shades.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(shades, 3));
  const { day, night } = materials(), mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), size = new Vector3(), color = new Color();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(+r[3], +r[4], +r[5]);
    else matrix.makeRotationY(+r[6]).scale(size.set(+r[3], +r[4], +r[5]));
    matrix.setPosition(+r[0], +r[1], +r[2]).toArray(matrices, i * 16);
    color.setHex(+r[native ? 6 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.name = name;
  mesh.userData = { textureFree: true, dayMaterial: day, nightMaterial: night,
    nativeMinecraft: native, blockNative: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  return mesh;
}

function surfaces(rows: { color: number; triangles: number[][][] }[], name: string): Mesh {
  const positions = new Float32Array(rows.reduce((n, r) => n + r.triangles.length * 9, 0));
  const colors = new Float32Array(positions.length), color = new Color();
  let cursor = 0;
  for (const row of rows) {
    color.setHex(row.color);
    for (const triangle of row.triangles) for (const p of triangle) {
      positions.set(p, cursor); color.toArray(colors, cursor); cursor += 3;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const { day, night } = materials(), mesh = new Mesh(geometry, day);
  mesh.name = name;
  mesh.userData = { textureFree: true, dayMaterial: day, nightMaterial: night };
  return mesh;
}

const siteForPosition = (x: number, z: number) => x < 0 ? "tegel" : z < 0 ? "hsh" : "hq";

/** Required before city publication wherever the exact old coarse owners yield. */
export function createPrisonsMemorialsEnvelopesV209(native = false): Group {
  const root = rootGroup(native, true);
  for (const site of data.sites) {
    const ground = envelopes.ground.filter(r => r.site === site.key);
    if (native) {
      const blocks = envelopes.envelopeBlocks.filter(r => siteForPosition(r[0], r[2]) === site.key);
      root.add(instances(blocks, true, site.name + " complete independent native wall and roof skin"));
      if (ground.length) root.add(surfaces(ground, site.name + " new-only source-bound ground"));
    } else {
      const sheets = envelopes.surfaces.filter(r => siteForPosition(r.triangles[0]?.[0]?.[0] ?? 0, r.triangles[0]?.[0]?.[2] ?? 0) === site.key);
      root.add(surfaces([...sheets, ...ground], site.name + " complete measured wall and roof sheets"));
    }
  }
  return freezeStaticSceneTransforms(root);
}

/** Additive public exterior detail; required complete envelopes are built separately. */
export function createPrisonsMemorialsV209(native = false): Group {
  const root = rootGroup(native, false);
  const rows = native ? data.blocks : data.boxes;
  for (const site of data.sites) {
    const selected = rows.filter(r => r[native ? 7 : 8] === site.key);
    root.add(instances(selected, native, site.name + " mapped perimeter and facade fittings"));
  }
  return freezeStaticSceneTransforms(root);
}
