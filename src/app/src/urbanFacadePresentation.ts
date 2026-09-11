import { Color, SRGBColorSpace } from "three";
import { mappedColor, mappedFacadeTone, mappedRoofTone, type BuildingAttributes } from "./buildingAttributes";
import { TIERGARTEN_PARK_EDGE_WORLD_M } from "./tiergartenParkEdge";

/** Display limits requested by the owner, not administrative boundaries. */
export const URBAN_FACADE_ZONES = [
  [-300, 800, 550, 1760], // Potsdamer / Leipziger Platz
  [130, 725, -70, 530], // Pariser Platz
  [65, 820, -1220, -90], // Charité to Robert-Koch-Platz
  [-830, 220, -2260, -700], // Europacity
  [-2400, 150, 650, 1400], // south edge of Tiergarten
] as const;

export function pointInUrbanFacadeScope(x: number, z: number): boolean {
  if (URBAN_FACADE_ZONES.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)) return true;
  // Only the immediate 150 m park margin beyond those neighbourhoods.
  if (x < -2900 || x > 550 || z < -280 || z > 1550) return false;
  const ring = TIERGARTEN_PARK_EDGE_WORLD_M;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j], [bx, bz] = ring[i];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    if ((x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2 <= 150 ** 2) return true;
  }
  return false;
}

export function urbanFacadeScope(building: { ring: readonly (readonly number[])[] }): boolean {
  if (building.ring.length < 3) return false;
  let x = 0, z = 0;
  for (const point of building.ring) { x += point[0]; z += point[1]; }
  return pointInUrbanFacadeScope(x / building.ring.length / 10, z / building.ring.length / 10);
}

/** Unambiguous retained CSS names only; never guess mixed/free-text colours. */
function recordedColour(value: string | undefined): number | undefined {
  const mapped = mappedColor(value);
  if (mapped !== undefined || !value) return mapped;
  const name = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(Color.NAMES, name) ? Color.NAMES[name as keyof typeof Color.NAMES] : undefined;
}

export function urbanMappedFacadeTone(attributes: BuildingAttributes | undefined): number | undefined {
  return recordedColour(attributes?.tags["building:colour"]) ?? mappedFacadeTone(attributes);
}

export function urbanMappedRoofTone(attributes: BuildingAttributes | undefined): number | undefined {
  return recordedColour(attributes?.tags["roof:colour"]) ?? mappedRoofTone(attributes);
}

const paper = new Color(0xfbf5e4);

/** Rebalance the existing illustration; this is not a measured facade colour. */
export function urbanIllustrationToneInto(tone: [number, number, number], target: Color): Color {
  const rgb = tone.map((channel) => channel / 255);
  const luma = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  // A continuous lightness range preserves neighbouring source differences.
  // The former 0.8 floor + quantisation collapsed most samples to one paint.
  const lightness = 0.75 + Math.min(1, Math.max(0, luma)) * 0.20;
  const scale = lightness / Math.max(luma, 0.02);
  const channels = rgb.map((v) => Math.min(0.96, Math.max(0.12, (luma + (v - luma) * 0.55) * scale)));
  return target.setRGB(channels[0], channels[1], channels[2], SRGBColorSpace).lerp(paper, 0.16);
}

/** Emphasise existing facade strokes in the named neighbourhoods. No new panes,
 * attributes, line vertices, draw calls or per-frame work are introduced. */
export function urbanFacadeInkShader(vertexShader: string, fragmentShader: string): { vertexShader: string; fragmentShader: string } {
  if (vertexShader.includes("vUrbanFacadeEmphasis")) return { vertexShader, fragmentShader };
  const boxes = URBAN_FACADE_ZONES.map(([x0, x1, z0, z1]) =>
    `step(${x0.toFixed(1)}, urbanXZ.x) * step(urbanXZ.x, ${x1.toFixed(1)}) * step(${z0.toFixed(1)}, urbanXZ.y) * step(urbanXZ.y, ${z1.toFixed(1)})`).join(" + ");
  return {
    vertexShader: `varying float vUrbanFacadeEmphasis;\n${vertexShader}`.replace(
      "#include <project_vertex>",
      `#include <project_vertex>\nvec2 urbanXZ = (modelMatrix * vec4(transformed, 1.0)).xz;\nvUrbanFacadeEmphasis = min(1.0, ${boxes});`,
    ),
    fragmentShader: `varying float vUrbanFacadeEmphasis;\n${fragmentShader}`.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.6, vUrbanFacadeEmphasis);\ndiffuseColor.a = min(1.0, diffuseColor.a * mix(1.0, 1.4, vUrbanFacadeEmphasis));",
    ),
  };
}
