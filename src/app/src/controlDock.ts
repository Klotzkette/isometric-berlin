export type ControlDockSide = "left" | "right";

export const CONTROL_DOCK_SIDE_STORAGE_KEY =
  "isometric-berlin.controlDockSide";

export function controlDockSideFromStored(
  value: string | null,
): ControlDockSide {
  return value === "right" ? "right" : "left";
}

export function oppositeControlDockSide(
  side: ControlDockSide,
): ControlDockSide {
  return side === "left" ? "right" : "left";
}
