import source from "./ulapQuarterSource.json";
import { moabitGuardHouseContains } from "./moabitGuardHouseProfile";

export const ULAP_QUARTER_SOURCE = source;
export const ULAP_QUARTER_PARTS = source.parts;
export const ULAP_QUARTER_IDS: ReadonlySet<string> = new Set(source.parts.map(p => p.viewerPrism.id));
export const ULAP_QUARTER_GROUP_NAME = "ULAP quarter retained Urania and office facades";
export const MINECRAFT_ULAP_QUARTER_GROUP_NAME = "Minecraft ULAP quarter surface buildings";
export const ULAP_URANIA_PARENT = "DEBE01YYK0002MoE";
export const ULAP_QUARTER_PROFILE = Object.freeze({
  sourcePartCount: 34, sourceBuildingCount: 6, excludedLaboratoryPartCount: 19,
  sourceBodiesRetained: true, textureFree: true, fullStaticDetailOnTouch: true,
  proceduralFacadeDimensions: true, catalogueAddition: false,
});

/** Building source planes only, without consuming park or courtyard ground. */
export function isUlapQuarterColumn(x: number, z: number): boolean {
  if (x < -685 || x > -448 || z < -651 || z > -479) return false;
  return source.parts.some(p => moabitGuardHouseContains(p.viewerPrism.ring, x, z));
}
