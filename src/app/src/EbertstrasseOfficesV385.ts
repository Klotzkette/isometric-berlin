import { Group } from "three";
import taylor from "./data/ebertstrasseOfficesV385/taylor_native.json";
import telekom from "./data/ebertstrasseOfficesV385/magenta_native.json";
import { platzModelGroupV383 } from "./platzModelGroupV383";

/** Independent facade skins follow the exposed sides of the two original 4 m column groups. */
export function createNativeEbertstrasseOffices(): Group {
  return platzModelGroupV383("Ebertstraße 15 und 15A · Blockfassaden und Dachterrassen", true, [taylor, telekom]);
}
