import {
  BufferAttribute, BufferGeometry, Color, FrontSide, Mesh, MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import { surroundingPacketFingerprint } from "./surroundingPacketFingerprint";
import type { SurroundingCityChunk } from "./SurroundingCityGeometry";
import catalog from "./data/surveyedBuildingFacadesV377.json";

export type FacadeKindV377 = "window" | "glazing" | "louvre" | "loading" | "entrance" | "pier" | "spandrel" | "brick" | "arch";
export type FacadeBandV377 = {
  kind: FacadeKindV377; x: number[]; y: number[]; columns: number; rows: number;
  color?: number; fillX?: number; fillY?: number;
};
/** World XZ at both ends, measured bottom/top, normalised span on the full
 * frontage and profile index. Endpoints run left to right when seen outside. */
export type FacadeFaceV377 = number[];
type FacadeOwnerV377 = { id: string; owner: string; tileSha256?: string; faces: FacadeFaceV377[] };
type SplitPacketV377 = { sourceSha: string; origin: number[]; parts: number[][] };
export type FacadeCatalogV377 = {
  profiles: FacadeBandV377[][];
  tiles: Record<string, FacadeOwnerV377[]>;
  splitPackets?: Record<string, SplitPacketV377>;
};

const kinds: readonly FacadeKindV377[] = ["window", "glazing", "louvre", "loading", "entrance", "pier", "spandrel", "brick", "arch"];
const paintLayer: Record<FacadeKindV377, number> = {
  arch: 4, brick: 0, spandrel: 1, pier: 2, window: 3, glazing: 3, louvre: 3, loading: 4, entrance: 4,
};
const palette = [0x74878c, 0x80959b, 0x60666a, 0x788183, 0x61777c, 0xc6bfb0, 0xb6b3a7, 0x92664f, 0x48515a];
const defaultWidth = [.61, .96, .92, .84, .68, .18, 1, 1, 1];
const defaultHeight = [.62, .92, .77, .76, .89, 1, .20, 1, 1];

// UV counts complete architectural bays, including across a packet boundary.
// The derivative filter integrates each aperture's area at distant zooms.
// Close views resolve the jamb, sill and frame in units of metres.
const fragment = `
  vec2 cellSize = vFacadeSize;
  vec2 sampleWidth = max(fwidth(vFacadeUv), vec2(0.0001));
  vec2 halfFill = vFacadeDesign.yz * 0.5;
  vec2 delta = (halfFill - abs(fract(vFacadeUv) - 0.5)) * cellSize;
  vec2 footprint = max(sampleWidth * cellSize, vec2(0.001));
  vec2 edge = smoothstep(-0.5 * footprint, 0.5 * footprint, delta);
  vec2 unresolved = smoothstep(vec2(0.25), vec2(0.9), sampleWidth);
  edge = mix(edge, vFacadeDesign.yz, unresolved);
  if (vFacadeDesign.y > 0.999) edge.x = 1.0;
  if (vFacadeDesign.z > 0.999) edge.y = 1.0;
  diffuseColor.a *= edge.x * edge.y;
  float kind = vFacadeDesign.x;
  float borderM = min(0.075, min(cellSize.x * halfFill.x, cellSize.y * halfFill.y) * 0.25);
  vec2 inner = smoothstep(vec2(borderM) - footprint * 0.5, vec2(borderM) + footprint * 0.5, delta);
  float nearDetail = 1.0 - max(unresolved.x, unresolved.y);
  float frame = (1.0 - inner.x * inner.y) * nearDetail;
  vec2 local = fract(vFacadeUv);
  if (kind < 1.5 || (kind > 3.5 && kind < 4.5)) {
    vec3 glass = diffuseColor.rgb * mix(0.78, 1.13, mix(0.5, local.y, nearDetail));
    vec3 trim = mix(diffuseColor.rgb, vec3(0.42, 0.43, 0.41), 0.50);
    // The profile already counts the observed panes. Retain that rhythm;
    // only the surveyed cells receive a surround.
    float sill = frame * (1.0 - smoothstep(0.0, 0.5, local.y));
    trim *= mix(0.92, 1.12, sill);
    diffuseColor.rgb = mix(glass, trim, frame);
  } else if (kind < 3.5) {
    float pitch = kind < 2.5 ? 0.18 : 0.38;
    float physicalY = vFacadeUv.y * cellSize.y;
    float resolved = 1.0 - smoothstep(0.22, 0.8, footprint.y / pitch);
    diffuseColor.rgb *= 1.0 + 0.14 * cos(physicalY * (6.2831853 / pitch)) * resolved;
    diffuseColor.rgb *= 1.0 - 0.27 * frame;
  } else if (kind > 7.5) {
    vec2 p = (local - 0.5) * cellSize;
    float halfW = halfFill.x * cellSize.x;
    float halfH = halfFill.y * cellSize.y;
    float radius = min(halfW, 2.0 * halfH);
    float springY = halfH - radius;
    // For exceptionally squat spans clamp the circular head to its height;
    // the supplied Behrens opening has its full measured semicircle.
    float arc = radius - length(vec2(p.x / max(halfW, 0.001) * radius, max(0.0, p.y - springY)));
    float aa = max(footprint.x, footprint.y);
    float alpha = smoothstep(-aa * 0.5, aa * 0.5, arc);
    float area = 1.0 - (1.0 - 0.78539816) * radius / max(2.0 * halfH, 0.001);
    diffuseColor.a *= mix(area, alpha, nearDetail);
    diffuseColor.rgb *= mix(1.0, 0.83, nearDetail * (1.0 - smoothstep(0.0, 0.08 + aa * 0.5, arc)));
  } else if (kind > 6.5) {
    vec2 brickSize = vec2(0.27, 0.075);
    vec2 joint = vec2(0.010, 0.009);
    vec2 wall = vFacadeUv * cellSize / brickSize;
    wall.x += 0.5 * mod(floor(wall.y), 2.0);
    vec2 fromJoint = min(fract(wall), 1.0 - fract(wall)) * brickSize;
    vec2 mortar = 1.0 - smoothstep(0.5 * (joint - footprint), 0.5 * (joint + footprint), fromJoint);
    mortar = mix(mortar, joint / brickSize, smoothstep(vec2(0.3), vec2(0.85), footprint / brickSize));
    float grout = 1.0 - (1.0 - mortar.x) * (1.0 - mortar.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.48, 0.44, 0.37), grout * FACADE_MORTAR_CONTRAST);
  }
`;

function facadeMaterial(native: boolean, night: boolean) {
  const options = { vertexColors: true, transparent: true, depthWrite: false, side: FrontSide };
  const material = native || night
    ? new MeshStandardMaterial({ ...options, roughness: .88, metalness: .04 })
    : new MeshBasicMaterial(options);
  material.name = "Surveyed facade finishes v377";
  material.onBeforeCompile = shader => {
    const varyings = "varying vec2 vFacadeUv; varying vec2 vFacadeSize; varying vec3 vFacadeDesign;\n";
    shader.vertexShader = "attribute vec2 facadeUv; attribute vec2 facadeSize; attribute vec3 facadeDesign;\n" +
      varyings + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        vFacadeUv = facadeUv; vFacadeSize = facadeSize; vFacadeDesign = facadeDesign;`);
    shader.fragmentShader = "#define FACADE_MORTAR_CONTRAST " + (native ? "0.45" : "0.64") + "\n" +
      varyings + shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n" + fragment);
  };
  material.customProgramCacheKey = () => native ? "surveyed-facade-v377-native" : "surveyed-facade-v377-drawn";
  return material;
}

function validBand(band: FacadeBandV377): boolean {
  return !!band && kinds.includes(band.kind) &&
    [band.x, band.y].every(a => Array.isArray(a) && a.length === 2 && a[0] >= 0 && a[1] <= 1 && a[0] < a[1]) &&
    [band.columns, band.rows].every(n => Number.isInteger(n) && n >= 1 && n <= 2048) &&
    [band.fillX, band.fillY].every(n => n === undefined || (Number.isFinite(n) && n > 0 && n <= 1));
}

/** For rare packets whose owner navigation lives elsewhere, certify the
 * original vertex/color/index strings after decoding. Gzip and delta-packed
 * releases recover these identical strings with different transport hashes. */
export function* verifiedSplitFacadePacketV377(
  key: string, chunk: Pick<SurroundingCityChunk, "meshes" | "origin">, source: FacadeCatalogV377 = catalog as FacadeCatalogV377,
): Generator<void, string | undefined> {
  const proof = source.splitPackets?.[key];
  if (!proof?.parts.length || !proof.origin.every((v, i) => v === chunk.origin[i])) return;
  for (const [index, fingerprint] of proof.parts) {
    const part = chunk.meshes[index];
    if (!part || part.kind !== "city" || (yield* surroundingPacketFingerprint(part)) !== fingerprint) return;
  }
  return proof.sourceSha;
}

/** Stage only admitted vertical source segments. No facade is inferred on a
 * roof, a shared party wall, across a courtyard, or on an absent building. */
export function createSurveyedBuildingFacadesV377(
  tile: string, native: boolean, origin: readonly number[], owners: ReadonlySet<string>,
  source: FacadeCatalogV377 = catalog as FacadeCatalogV377, tileSha256?: string,
): Mesh | undefined {
  const plans = source.tiles[(native ? "minecraft:" : "drawn:") + tile];
  if (!plans?.length) return;
  const positions: number[] = [], normals: number[] = [], colours: number[] = [], pattern: number[] = [];
  const sizes: number[] = [], designs: number[] = [], indices: number[] = [];
  const ranges: { id: string; start: number; count: number }[] = [], colour = new Color();
  for (const plan of plans) {
    // Some original native packets split collision/navigation and wall
    // geometry between descriptors. Accept that split only on its source SHA.
    if (plan.tileSha256 ? tileSha256 !== plan.tileSha256 : !owners.has(plan.owner)) continue;
    const start = indices.length;
    // Transparent anti-aliased aperture masks intentionally do not write depth.
    // Submit the opaque backing first and observed windows/doors over it,
    // independently of source-list order or overlaps between local surveys.
    const layers: number[][] = [[], [], [], [], []];
    for (const face of plan.faces) {
      if (face.length !== 11 || !face.every(Number.isFinite)) continue;
      const [ax, az, bx, bz, low, high, u0, u1, v0, v1, profile] = face;
      const length = Math.hypot(bx - ax, bz - az), height = high - low;
      const bands = source.profiles[profile];
      if (length <= .05 || height <= .05 || u1 <= u0 || v1 <= v0 || !bands?.length) continue;
      const nx = (az - bz) / length, nz = (bx - ax) / length;
      for (const band of bands) {
        if (!validBand(band)) continue;
        const [uL, uR] = [Math.max(u0, band.x[0]), Math.min(u1, band.x[1])];
        const [vB, vT] = [Math.max(v0, band.y[0]), Math.min(v1, band.y[1])];
        if (uL >= uR || vB >= vT) continue;
        const kind = kinds.indexOf(band.kind);
        const widthM = length / (u1 - u0) * (band.x[1] - band.x[0]) / band.columns;
        const heightM = height / (v1 - v0) * (band.y[1] - band.y[0]) / band.rows;
        // A centimetre-scale gap provides reliable separation even on mobile
        // depth buffers without projecting windows onto adjoining roof faces.
        const depth = band.kind === "pier" ? .085 : band.kind === "spandrel" ? .055 : .035;
        colour.setHex(band.color ?? palette[kind]);
        const first = positions.length / 3;
        for (const [u, v] of [[uL, vB], [uR, vB], [uR, vT], [uL, vT]]) {
          const along = (u - u0) / (u1 - u0);
          positions.push(ax - origin[0] + (bx - ax) * along + depth * nx,
            low - origin[1] + height * (v - v0) / (v1 - v0),
            az - origin[2] + (bz - az) * along + depth * nz);
          normals.push(Math.round(nx * 127), 0, Math.round(nz * 127));
          // Linear 16-bit channels round-trip the source's 8-bit sRGB paint
          // exactly, including near-black photographed glass and metal.
          colours.push(Math.round(colour.r * 65535), Math.round(colour.g * 65535), Math.round(colour.b * 65535));
          pattern.push((u - band.x[0]) / (band.x[1] - band.x[0]) * band.columns,
            (v - band.y[0]) / (band.y[1] - band.y[0]) * band.rows);
          sizes.push(widthM, heightM);
          designs.push(kind, band.fillX ?? defaultWidth[kind], band.fillY ?? defaultHeight[kind]);
        }
        layers[paintLayer[band.kind]].push(first, first + 1, first + 2, first, first + 2, first + 3);
      }
    }
    for (const layer of layers) for (const index of layer) indices.push(index);
    if (indices.length > start) ranges.push({ id: plan.id, start, count: indices.length - start });
  }
  if (!indices.length) return;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new BufferAttribute(new Int8Array(normals), 3, true));
  geometry.setAttribute("color", new BufferAttribute(new Uint16Array(colours), 3, true));
  geometry.setAttribute("facadeUv", new BufferAttribute(new Float32Array(pattern), 2));
  geometry.setAttribute("facadeSize", new BufferAttribute(new Float32Array(sizes), 2));
  geometry.setAttribute("facadeDesign", new BufferAttribute(new Float32Array(designs), 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const day = facadeMaterial(native, false), night = native ? day : facadeMaterial(false, true);
  const mesh = new Mesh(geometry, day);
  mesh.name = "Surveyed building facades v377";
  mesh.userData.dayMaterial = day;
  mesh.userData.nightMaterial = night;
  mesh.userData.facadeOwnersV377 = ranges;
  mesh.renderOrder = 2;
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  return mesh;
}
