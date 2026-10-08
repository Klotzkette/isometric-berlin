import { Color } from "three";
import { GENERIC_FACADE_SWATCHES, genericFacadeIndex } from "./cityColourV184";

type Rgb = readonly [number, number, number];
type Palette = { wall: Rgb; roof: Rgb };
type Owner = { sourceId: string; palette: Palette };
export type SurroundingColourOwners = ReadonlyMap<number, Owner | null>;
type Building = { sourceId: string; ring: number[][]; holes: number[][][] };
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
export function* surroundingColourOwners(buildings: readonly Building[]): Generator<void, SurroundingColourOwners> {
  const owners = new Map<number, Owner | null>();
  let points = 0;
  for (const building of buildings) {
    const owner = { sourceId: building.sourceId, palette: PALETTES[genericFacadeIndex(building.sourceId)] };
    for (const ring of [building.ring, ...building.holes]) for (const [x, z] of ring) {
      const key = pointKey(Math.round(x * 100), Math.round(z * 100));
      const previous = owners.get(key);
      owners.set(key, previous === undefined ? owner : previous?.sourceId === owner.sourceId ? previous : null);
      if (++points % 4_096 === 0) yield;
    }
  }
  return owners;
}

/** Called inside the existing bounded colour decode, after positions exist. */
export function surroundingGenericColour(
  owners: SurroundingColourOwners, xCm: number, zCm: number,
  r: number, g: number, b: number,
): Rgb | undefined {
  const color = packed(r, g, b);
  if (color !== WALL && color !== ROOF) return undefined;
  const palette = owners.get(pointKey(xCm, zCm))?.palette;
  return color === WALL ? palette?.wall : palette?.roof;
}
