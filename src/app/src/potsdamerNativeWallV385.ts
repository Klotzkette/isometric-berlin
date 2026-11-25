import { addBox, createBuilder, finishDrawnGroup } from "./drawnKit";
import { potsdamerWallBoxesV385, potsdamerWallExhibitsV385 } from "./potsdamerWallExhibitsV385";

export function createNativePotsdamerWallExhibits(tile: string) {
  const builder = createBuilder();
  for (const site of potsdamerWallExhibitsV385.filter(site => site.tile === tile)) {
    for (const [color, x, y, z, width, height, length, yaw] of potsdamerWallBoxesV385(site)) {
      // Straight cardinal slices follow each measured wall axis in block mode.
      const steps = Math.ceil(length / 0.24);
      const dz = length * Math.cos(yaw) / steps;
      for (let i = 0; i < steps; i++) {
        const offset = ((i + 0.5) / steps - 0.5) * length;
        addBox(builder, color, x + offset * Math.sin(yaw), y, z + offset * Math.cos(yaw),
          width / Math.cos(yaw), height, dz, 0, false);
      }
    }
  }
  const group = finishDrawnGroup(builder, { name: "Ausgestellte Mauersegmente am Potsdamer und Leipziger Platz" });
  if (group) group.userData = { nativeMinecraft: true, keepInMinecraft: true, schwellenraumGeschuetzt: true };
  return group;
}
