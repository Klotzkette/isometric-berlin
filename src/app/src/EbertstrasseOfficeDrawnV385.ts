import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments } from "three";
import taylor from "./data/ebertstrasseOfficesV385/taylor_drawn.json";
import telekom from "./data/ebertstrasseOfficesV385/magenta_drawn.json";
import { markArchitecturalInk } from "./architecturalInk";
import { platzModelGroupV383 } from "./platzModelGroupV383";

const rails = {
  taylor: [[366.267, 877.201], [363.58, 894.378], [388.708, 892.296], [387.328, 875.472]],
  telekom: [[377.51, 847.52], [383.08, 845.98], [384.66, 850.84], [379.05, 852.48]],
};

export function createDrawnEbertstrasseOffice(site: "taylor" | "telekom", name: string): Group {
  const group = platzModelGroupV383(name, false, [site === "taylor" ? taylor : telekom]);
  group.children[0].name = name + " bodies";
  const ring = rails[site], cap = site === "taylor" ? 26.65 : 25.88;
  const positions: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
    positions.push(ax, cap + .012, az, bx, cap + .012, bz);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const ink = new LineSegments(geometry, markArchitecturalInk(new LineBasicMaterial(), "detail"));
  ink.name = name + " ink lines";
  group.add(ink);
  return group;
}
