import type { Group } from "three";
import type { NordbahnhofPlan } from "./NordbahnhofPublicAccess";
import type { PedestrianEnvironment } from "./pedestrianNavigation";

export const NORDBAHNHOF_PUBLIC_STAIR = "way/396459313";
const LOWEST = -2.79;
const EPS = .00006;
const prismIds = new Set(["97805995", "30965451"]);
const near = (x: number, z: number, padding = 0) => x >= 1085 - padding && x <= 1118 + padding &&
  z >= -1536 - padding && z <= -1504 + padding;

const admitted = new WeakMap<Group, { root: Group; plan: NordbahnhofPlan }>();

export function registerNordbahnhofPublicAccess(world: Group, root: Group, plan: NordbahnhofPlan): void {
  world.add(root);
  admitted.set(world, { root, plan });
}

export function currentNordbahnhofPlan(world: Group | null | undefined): NordbahnhofPlan | null {
  if (!world) return null;
  const entry = admitted.get(world);
  return entry?.root.parent === world && entry.root.visible ? entry.plan : null;
}

export function installNordbahnhofNavigation(environment: PedestrianEnvironment, active: () => NordbahnhofPlan | null): void {
  const priorGround = environment.interiorGroundAt, priorSolid = environment.interiorSolidAt;
  const priorInterior = environment.walkableInteriorAt, priorFlight = environment.flightGroundAt;
  environment.interiorGroundAt = (x, z, hint) =>
    (near(x, z, EPS) ? active()?.groundAt(x, z, hint) : null) ?? priorGround?.(x, z, hint) ?? null;
  environment.interiorSolidAt = (x, y, z, radius) =>
    near(x, z, 1) && active()?.solidAt(x, y, z, radius) === true || priorSolid?.(x, y, z, radius) === true;
  environment.walkableInteriorAt = (x, y, z, source) =>
    (source !== undefined && prismIds.has(source) && near(x, z, EPS) && active()?.inAir(x, y, z) === true) ||
    priorInterior?.(x, y, z, source) === true;
  environment.flightGroundAt = (x, y, z) =>
    near(x, z, EPS) && active()?.inAir(x, y, z) === true ? LOWEST :
      (priorFlight?.(x, y, z) ?? environment.groundAt(x, z));
}
