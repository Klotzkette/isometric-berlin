import ownership from "./data/altMitteV169Ownership.json";

/** Shared with the progressive worker without importing roofs or native cells. */
export const ALT_MITTE_V169_PRISM_IDS: ReadonlySet<string> = new Set(
  ownership.prismIds as string[],
);
