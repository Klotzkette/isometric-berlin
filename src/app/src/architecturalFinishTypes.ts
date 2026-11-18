import { Color } from "three";

export type Finish = "masonry" | "glass" | "patina" | "metal";
export type SurfaceFinish = Finish | Partial<Record<Finish, readonly number[]>>;

// Zero is reserved for the original paint. IDs also travel in packed wall runs.
export const finishes: readonly Finish[] = ["masonry", "glass", "patina", "metal"];
export const strengths: Record<Finish, readonly [number, number]> = {
  masonry: [.095, 0], glass: [.045, .26], patina: [.07, .20], metal: [.055, .32],
};

export function finishPaints(profile: Exclude<SurfaceFinish, string>) {
  return finishes.flatMap((finish, index) => (profile[finish] ?? []).map(hex => ({
    color: new Color(hex), finish, id: index + 1,
  })));
}
