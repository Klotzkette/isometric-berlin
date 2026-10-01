import source from "./moabitGuardHouseSource.json";

export const MOABIT_GUARD_HOUSE_SOURCE = source;
export const MOABIT_GUARD_HOUSE_IDS: ReadonlySet<string> = new Set(
  source.houses.flatMap(house => house.parts.map(part => part.previous_prism.id)),
);
export const MOABIT_GUARD_HOUSE_GROUP_NAME = "Moabit surviving prison officers' houses";
export const MINECRAFT_MOABIT_GUARD_HOUSE_GROUP_NAME = "Minecraft Moabit officers' house facades";

export const MOABIT_GUARD_HOUSE_PROFILE = Object.freeze({
  groupName: MOABIT_GUARD_HOUSE_GROUP_NAME,
  monumentId: "09050274",
  houseCount: 3,
  sourcePartCount: 5,
  sourceBuildingsRetained: true,
  fullStaticDetailOnTouch: true,
  textureFree: true,
  proceduralFacadeDimensions: true,
  windowlessParkFaces: true,
  catalogueAddition: false,
  // Existing fitted-roof rises, preserving the source bodies. The original
  // 5D roof code 5000 is interpreted as hipped from the retained roof sheets.
  drawnRoofRiseM: {
    WhPZcY83: 2.7640730815229744,
    qH5ZODlA: 1.2,
    K0002Sjv: 2.7418625289394982,
    cdPTILfN: 1.2,
    Ef78aGXl: 2.698822802732343,
  } as Readonly<Record<string, number>>,
});

export function moabitGuardHouseRoofCode(id: string, roof: number): number {
  return id === "K0002Sjv" ? 3200 : roof;
}

export function moabitGuardHouseContains(
  ring: readonly number[][], x: number, z: number,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j], ax = a[0] / 10, az = a[1] / 10;
    const bx = b[0] / 10, bz = b[1] / 10;
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax)
      inside = !inside;
  }
  return inside;
}

/** Exact five source footprints only; never a district or park-wide mask. */
export function isMoabitGuardHouseColumn(x: number, z: number): boolean {
  if (x < -415 || x > -340 || z < -1000 || z > -965) return false;
  return source.houses.some(house => house.parts.some(part =>
    moabitGuardHouseContains(part.previous_prism.ring, x, z)));
}
