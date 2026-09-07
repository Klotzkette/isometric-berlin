/** Bounded source-detail audit; exact source slices keep transient geometry small. */
import { Mesh, LineSegments } from "three";
import { createIsometricCity, type PrismPayload } from "../src/IsometricCityWorld";
import { BUILDING_ATTRIBUTE_SOURCE } from "../src/buildingAttributes";

const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
const result: Record<string, number> = { facadeAttributeBytes: 0 };
for (let start = 0; start < payload.buildings.length; start += 256) {
  const city = createIsometricCity(payload, null, null, null, {
    includeContext: false,
    buildings: payload.buildings.slice(start, start + 256),
  });
  for (const [key, value] of Object.entries(city.userData.buildingDetailCoverage)) {
    if (typeof value === "number") result[key] = (result[key] ?? 0) + value;
  }
  const axes = city.getObjectByName("LoD2 facade axes") as LineSegments | undefined;
  if (axes) {
    result.facadeAttributeBytes += axes.geometry.getAttribute("position").array.byteLength +
      axes.geometry.getAttribute("lineDistance").array.byteLength;
  }
  city.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof LineSegments)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  });
}
console.log(JSON.stringify({ source: BUILDING_ATTRIBUTE_SOURCE.statistics, applied: result }, null, 2));
