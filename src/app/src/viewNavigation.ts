export type NamedSight = {
  name: string;
};

export type ViewHashState = {
  flipped: boolean | null;
  landmarkSlug: string | null;
  rotationValue: string | null;
};

export const FEATURED_SIGHT_NAMES = [
  "Berlin Hauptbahnhof",
  "Bundeskanzleramt",
  "Reichstagsgebäude",
  "Brandenburger Tor",
  "Siegessäule",
] as const;

export const SIMULATION_START_SIGHT_NAMES = [
  "Reichstagsgebäude",
  "Bundeskanzleramt",
  "Berlin Hauptbahnhof",
  "Siegessäule",
] as const;

export const SIMULATION_START_STORAGE_KEY =
  "isometric-berlin.lastSimulationStart";

type StartStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Advance through the four civic start points without keeping a large session
 * object alive. The one tiny persisted name prevents consecutive reloads from
 * opening at the same place; private-storage failures degrade harmlessly.
 */
export function nextSimulationStartSight(
  storage: StartStorage | null = null,
): (typeof SIMULATION_START_SIGHT_NAMES)[number] {
  let previous: string | null = null;
  try {
    previous = storage?.getItem(SIMULATION_START_STORAGE_KEY) ?? null;
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
  const previousIndex = SIMULATION_START_SIGHT_NAMES.findIndex(
    (name) => name === previous,
  );
  const next =
    SIMULATION_START_SIGHT_NAMES[
      (previousIndex + 1) % SIMULATION_START_SIGHT_NAMES.length
    ];
  try {
    storage?.setItem(SIMULATION_START_STORAGE_KEY, next);
  } catch {
    // The selected start remains valid for this load even without persistence.
  }
  return next;
}

export function featuredSights<T extends NamedSight>(sights: T[]): T[] {
  const byName = new Map(sights.map((sight) => [sight.name, sight]));
  return FEATURED_SIGHT_NAMES.flatMap((name) => {
    const sight = byName.get(name);
    return sight ? [sight] : [];
  });
}

export function sightSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function legacySightSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findSightBySlug<T extends NamedSight>(
  sights: T[],
  slug: string | null,
): T | null {
  if (!slug) {
    return null;
  }
  return (
    sights.find(
      (sight) =>
        sightSlug(sight.name) === slug || legacySightSlug(sight.name) === slug,
    ) ?? null
  );
}

export function parseViewHash(rawHash: string): ViewHashState {
  const hash = rawHash.replace(/^#/, "");
  if (!hash) {
    return { flipped: null, landmarkSlug: null, rotationValue: null };
  }
  const params = new URLSearchParams(
    hash.includes("=") ? hash : `landmark=${hash}`,
  );
  const flipValue = params.get("flip");
  return {
    flipped: flipValue === null ? null : flipValue === "1",
    landmarkSlug: params.get("landmark"),
    rotationValue: params.get("view"),
  };
}
