import navigation from "./data/humboldtMainV168Navigation.json";

/** This overlay takes no ownership from the existing source/facade model. */
export const HUMBOLDT_MAIN_V168_PROFILE = Object.freeze({
  name: "Humboldt-Universität main building", address: "Unter den Linden 6",
  osmIdentity: navigation.osmIdentity, lod2ParentId: navigation.lod2ParentId,
  existingPrismOwner: "ion-6647", monumentId: "09095954,T", sourceBoundaryPolygons: 95,
  previousSourceOwner: "BebelplatzBuildingShells", previousFacadeOwner: "BebelplatzFacades",
  additiveOnly: true, newReplacedOwners: navigation.newReplacedOwners,
  newCollisionSolids: navigation.newCollisionSolids, newRoofSupport: navigation.newRoofSupport,
  groundY: navigation.sourceGroundY, streetThresholdY: navigation.streetThresholdY,
  sourceTopY: navigation.sourceTopY,
  detailStatus: "Primary-described ornament with estimated member dimensions. Existing source surfaces, court, gateway, roof and sculptural silhouettes remain unchanged.",
});
