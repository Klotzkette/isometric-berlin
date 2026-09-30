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
} as const;

export const CHARITE_HISTORIC_FACADE_PROFILES = source.profiles.map(profile => ({
  ...profile,
  material: styles[profile.style as keyof typeof styles],
}));
export const CHARITE_HISTORIC_FACADE_IDS: ReadonlySet<string> = new Set(
  source.profiles.flatMap(profile => profile.parts.map(part => part.id)),
);
export const CHARITE_HISTORIC_FACADE_TONES: Readonly<Record<string, number>> = Object.fromEntries(
  CHARITE_HISTORIC_FACADE_PROFILES.flatMap(profile => profile.parts.map(part => [part.id, profile.material.brick])),
);
export const CHARITE_HISTORIC_FACADE_ROOF_TONES: Readonly<Record<string, number>> = Object.fromEntries(
  [...CHARITE_HISTORIC_FACADE_IDS].map(id => [id, 0x59636a]),
);
export const CHARITE_HISTORIC_FACADE_PROFILE = {
  profiles: CHARITE_HISTORIC_FACADE_PROFILES,
  textureFree: true,
  fullMobileDrawnIdentical: true,
  geometryStatus: "Unchanged source envelopes; shallow source-plane facade details. Window bays, brick courses, portals and relief panels are unsurveyed display subdivisions.",
};
