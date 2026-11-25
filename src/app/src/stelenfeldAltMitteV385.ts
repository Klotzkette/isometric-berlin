import type { Group } from "three";
import raw from "./data/stelenfeldAltMitteV385.json";
import { retireRegisteredAltMitteGeometry, type AltMitteRegistrationV385 } from "./registeredAltMitteGeometryV385";

export function retireStelenfeldAltMitteFloor(root: Group, id: string, native: boolean): void {
  retireRegisteredAltMitteGeometry(root, id, native, raw as unknown as AltMitteRegistrationV385,
    "stelenfeldFloorFacesV385", "stelenfeldFloorLinesV385");
}
