import views from "./data/waterwayViewsV378.json";

type Vec3 = [number, number, number];
function position(values: number[]): Vec3 {
  if (values.length !== 3 || !values.every(Number.isFinite))
    throw new Error("Invalid Landwehrkanal camera position");
  return [values[0], values[1], values[2]];
}

export const waterwayViewsV378 = Object.fromEntries(
  Object.entries(views).map(([name, view]) => [
    name,
    {
      position: position(view.position),
      target: position(view.target),
      fov: view.fov,
    },
  ]),
) as Record<string, { position: Vec3; target: Vec3; fov: number }>;
