import { Color } from "three";
import { GENERIC_FACADE_SWATCHES, genericFacadeIndex } from "./cityColourV184";

type Rgb = readonly [number, number, number];
type Palette = { wall: Rgb; roof: Rgb };
type Owner = { sourceId: string; palette: Palette; lowCm?: number; highCm?: number };
export type SurroundingColourOwners = ReadonlyMap<number, Owner | null>;
type Building = { sourceId: string; ring: number[][]; holes: number[][][];
  height: number; minHeight: number; groundOffset?: number };
const bytes = (color: Color): Rgb => [color.r, color.g, color.b].map(value => Math.round(value * 255)) as [number, number, number];
const packed = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;
// Exact linear bytes emitted by build_surrounding_outlines.py; never classify
// arbitrary grey paint, terrain or authored recognition colours as generic.
const WALL = packed(...bytes(new Color(0xd3d0c3)));
const ROOF = packed(...bytes(new Color(0x9d978c)));
const PALETTES: Palette[] = GENERIC_FACADE_SWATCHES.map(swatch => {
  const wall = new Color(swatch);
  return { wall: bytes(wall), roof: bytes(new Color(0x9d978c).lerp(wall, 0.12)) };
});
const pointKey = (x: number, z: number): number => x * 65_536 + z;

/** Temporary ownership only: source IDs choose paint across chunk boundaries.
 * Ambiguous centimetre corners retain their existing colour. Court rings are
 * included; neither the source navigation nor resident geometry is changed. */
export function* surroundingColourOwners(
  buildings: readonly Building[], groundY: number, originY: number,
): Generator<void, SurroundingColourOwners> {
  const owners = new Map<number, Owner | null>();
  const sourceOwners = new Map<string, Owner>();
  let points = 0;
  for (const building of buildings) {
    const base = groundY + (building.groundOffset ?? 0) - originY;
    const lowCm = Math.round((base + building.minHeight) * 100);
    const highCm = Math.round((base + building.height) * 100);
    let owner = sourceOwners.get(building.sourceId);
    if (!owner) {
      owner = { sourceId: building.sourceId, palette: PALETTES[genericFacadeIndex(building.sourceId)], lowCm, highCm };
      sourceOwners.set(building.sourceId, owner);
    } else if (owner.lowCm !== lowCm || owner.highCm !== highCm) {
      // Every corner shares this owner. Conflicting vertical parts disable the
      // wash for the whole source ID in this chunk, including unshared corners;
      // later records must not restore it and create interpolated colour wedges.
      owner.lowCm = undefined;
      owner.highCm = undefined;
    }
    for (const ring of [building.ring, ...building.holes]) for (const [x, z] of ring) {
      const key = pointKey(Math.round(x * 100), Math.round(z * 100));
      const previous = owners.get(key);
      // A different source owner remains completely untouched.
      owners.set(key, previous === undefined || previous?.sourceId === owner.sourceId ? owner : null);
      if (++points % 4_096 === 0) yield;
    }
  }
  return owners;
}

/** Called inside the existing bounded colour decode, after positions exist. */
export function surroundingGenericColour(
  owners: SurroundingColourOwners, xCm: number, zCm: number,
  r: number, g: number, b: number,
  yCm?: number, scratch?: [number, number, number],
): Rgb | undefined {
  const color = packed(r, g, b);
  if (color !== WALL && color !== ROOF) return undefined;
  const owner = owners.get(pointKey(xCm, zCm));
  if (!owner) return undefined;
  if (color === ROOF) return owner.palette.roof;
  // A small static grounding wash, not new floors or a painted-on facade.
  // Use source-relative height, including mapped terrain offsets. Reuse the
  // decoder's one scratch tuple: no per-vertex allocation, shader or extra GPU
  // data. Native block colours intentionally retain their flat material style.
  if (scratch && yCm !== undefined && owner.lowCm !== undefined && owner.highCm !== undefined &&
      owner.highCm > owner.lowCm) {
    const height = Math.max(0, Math.min(1, (yCm - owner.lowCm) / (owner.highCm - owner.lowCm)));
    const light = 0.88 + 0.13 * height;
    for (let channel = 0; channel < 3; channel++)
      scratch[channel] = Math.min(255, Math.round(owner.palette.wall[channel] * light));
    return scratch;
  }
  return owner.palette.wall;
}
