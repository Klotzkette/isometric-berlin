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
  return sights.find((sight) => sightSlug(sight.name) === slug) ?? null;
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
