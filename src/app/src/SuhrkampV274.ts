import source from "./data/northCultureV274Source.json";

type Face = { a: number[]; b: number[]; normal: number[]; bottom: number; top: number };
type Member = (u: number, y: number, w: number, h: number, d: number, color: number, out: number) => void;

/** Only the two receipted west end facets: the architect's photo shows broad
 * floor-by-floor glazing beside the central concrete strip, not a tall slit.
 * The v189 backing, original source shell and every other face are retained. */
export function suhrkampCoreV274(f: Face, member: Member): boolean {
  const receipt = source.suhrkampFaces.find(q => q.normal[0] < -.9 &&
    q.a.every((v, i) => v === f.a[i]) && q.b.every((v, i) => v === f.b[i]) &&
    q.normal.every((v, i) => v === f.normal[i]) && q.bottom === f.bottom && q.top === f.top);
  if (!receipt) return false;
  const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), floor = (f.top - f.bottom) / 7;
  const northFacet = f.a[1] > -990, width = len * .69, center = northFacet ? len * .40 : len * .60;
  member(len / 2, (f.bottom + f.top) / 2, len - .12, f.top - f.bottom - .12, .055, 0xb8b7ad, .13);
  for (let level = 0; level < 7; level++) {
    const y = f.bottom + level * floor, h = floor - .78;
    member(center, y + floor / 2, width + .34, h + .34, .09, 0xcbd0ca, .18);
    member(center, y + floor / 2, width, h, .045, 0x55767c, .24);
    member(center - width / 2 + .04, y + floor / 2, .08, h, .08, 0x343e40, .29);
    member(center + width / 2 - .04, y + floor / 2, .08, h, .08, 0x343e40, .29);
    member(center, y + floor / 2 - h / 2, width, .075, .10, 0x343e40, .29);
    if (level === 0) member(center, y + floor / 2, .085, h, .08, 0xb8c1bc, .29);
    // Architect photo: closed external blind on one upper floor. The narrow
    // blade spacing is an explicit non-surveyed recognition subdivision.
    if (level === 4 && !northFacet) for (let j = 0; j < 9; j++)
      member(center, y + .48 + j * (h - .18) / 9, width - .08, .13, .07, 0x949d9a, .31);
  }
  member(len / 2, f.top - .10, len - .08, .20, .16, 0xcbd0ca, .23);
  return true;
}
