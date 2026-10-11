import profile from "./data/potsdamerContextV214Profile.json";
import { buildingTerrainOffset } from "./weinbergTerrainV176";

/** Metadata only; source geometry stays in its existing owners and offline receipt. */
export const POTSDAMER_CONTEXT_V214_PROFILE = profile;
export const POTSDAMER_CONTEXT_V214_OWNER_IDS = profile.owners.map(owner => owner.id);
export const POTSDAMER_CONTEXT_V214_OFFSETS = profile.owners.map(owner =>
  buildingTerrainOffset(owner.id, owner.anchor[0], owner.anchor[1], owner.groundY));
