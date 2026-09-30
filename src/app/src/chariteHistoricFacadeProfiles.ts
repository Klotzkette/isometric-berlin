import source from "./chariteHistoricFacadeSource.json";

export const CHARITE_HISTORIC_FACADES_GROUP_NAME = "Charite individual historic campus facades";
export const MINECRAFT_CHARITE_HISTORIC_FACADES_GROUP_NAME = "Block-native Charite individual historic campus facades";

/** Colours and opening subdivisions are visual display estimates, not surveys. */
const styles = {
  children: { brick: 0xb56c52, stone: 0xd8c9aa, floors: 3, pitch: 3.5, width: 1.5, height: 2.65, plaster: true, paired: false },
  plain: { brick: 0xa2644e, stone: 0xcebf9f, floors: 3, pitch: 3.2, width: 1.3, height: 2.1, plaster: false, paired: false },
  medical: { brick: 0xb06a50, stone: 0xd8cbae, floors: 4, pitch: 3.7, width: 1.85, height: 2.9, plaster: true, paired: false },
  surgery: { brick: 0x9f614c, stone: 0xcbbc9e, floors: 4, pitch: 3.5, width: 1.7, height: 2.65, plaster: true, paired: true },
  nerve: { brick: 0xa96b57, stone: 0xe0d2b2, floors: 3, pitch: 3.6, width: 1.8, height: 2.8, plaster: true, paired: false },
  hno: { brick: 0xa86b50, stone: 0xd7c8a7, floors: 3, pitch: 3.2, width: 1.65, height: 2.65, plaster: true, paired: true },
  polyclinic: { brick: 0xb27759, stone: 0xdbcdaf, floors: 3, pitch: 3.7, width: 1.85, height: 2.95, plaster: true, paired: false },
  kitchen: { brick: 0x965c48, stone: 0xcabb9c, floors: 2, pitch: 4.0, width: 1.9, height: 2.9, plaster: false, paired: false },
  workshop: { brick: 0xa8644b, stone: 0xc8b99a, floors: 2, pitch: 4.2, width: 2.25, height: 2.5, plaster: false, paired: false },
  anatomy: { brick: 0xb36e4c, stone: 0xd4b980, floors: 3, pitch: 3.9, width: 1.85, height: 3.0, plaster: false, paired: false },
  lecture: { brick: 0x9d664c, stone: 0xc6a57b, floors: 2, pitch: 3.6, width: 1.8, height: 3.7, plaster: false, paired: false },
  classical: { brick: 0xd8ceb0, stone: 0xe9dec1, floors: 3, pitch: 3.4, width: 1.55, height: 2.85, plaster: false, paired: false },
  theatre: { brick: 0xded9c9, stone: 0xeee6d3, floors: 2, pitch: 4.2, width: 1.7, height: 3.4, plaster: false, paired: false },
  veterinary: { brick: 0xae765a, stone: 0xddc69e, floors: 3, pitch: 3.6, width: 1.6, height: 2.65, plaster: true, paired: false },
} as const;

export const CHARITE_HISTORIC_FACADE_PROFILES = source.profiles.map(profile => ({
  ...profile,
  material: styles[profile.style as keyof typeof styles],
}));
export const CHARITE_HISTORIC_FACADE_IDS: ReadonlySet<string> = new Set(
  source.profiles.flatMap(profile => profile.parts.map(part => part.id)),
);
export const CHARITE_HISTORIC_FACADE_TONES: Readonly<Record<string, number>> = Object.fromEntries(
  CHARITE_HISTORIC_FACADE_PROFILES.flatMap(profile => profile.parts.map(part => [part.id, ["cl2QC0kY", "QKEEcG88"].includes(part.id) ? 0xc8c3b3 : profile.material.brick])),
);
export const CHARITE_HISTORIC_FACADE_ROOF_TONES: Readonly<Record<string, number>> = Object.fromEntries(
  [...CHARITE_HISTORIC_FACADE_IDS].map(id => [id, 0x59636a]),
);
export const CHARITE_HISTORIC_FACADE_PROFILE = {
  profiles: CHARITE_HISTORIC_FACADE_PROFILES,
  textureFree: true,
  fullMobileDrawnIdentical: true,
  geometryStatus: "Existing west and east clinic envelopes retained with shallow source-plane details. Only the two Tieranatomisches Theater default-envelope parts receive a documented source-outline square body/light-drum/dome interpretation. Window bays, brick courses, portals, relief panels and intermediate theatre heights are unsurveyed display subdivisions.",
};

/** Complete source-outline interpretation owns these two coarse TAT prisms. */
export const CHARITE_THEATRE_REPLACEMENT_IDS: ReadonlySet<string> = new Set(["sFAYdHwz", "uBD055gq"]);
