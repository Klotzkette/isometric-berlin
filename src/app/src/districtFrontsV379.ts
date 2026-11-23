import type { Mesh } from "three";
import type { SurroundingCityChunk } from "./SurroundingCityGeometry";
import { createSurveyedBuildingFacadesV377, type FacadeCatalogV377 } from "./surveyedBuildingFacadesV377";
import { districtFrontRegionV379 } from "./districtFrontsIndexV379";

/** Only the current tile's named navigation owners can contribute wall geometry.
 * Both styles have their own measured faces, even where their footprints differ. */
export async function loadDistrictFrontsV379(
  tileId: string, native: boolean, chunk: Pick<SurroundingCityChunk, "origin" | "nav">,
): Promise<Mesh | undefined> {
  const region = districtFrontRegionV379(tileId);
  if (!region) return;
  const { default: catalog } = await import(`./data/districtFrontsV379/${region}.json`) as { default: FacadeCatalogV377 };
  const owners = new Set(chunk.nav.buildings.map(building => building.sourceId));
  const mesh = createSurveyedBuildingFacadesV377(tileId, native, chunk.origin, owners, catalog);
  if (mesh) {
    mesh.name = "Mapped district street fronts v379";
    mesh.userData.districtFrontOwnersV379 = mesh.userData.facadeOwnersV377;
    delete mesh.userData.facadeOwnersV377;
  }
  return mesh;
}
