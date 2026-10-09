import parts0 from "./altMitteV169Navigation/packet-001.json";
import parts1 from "./altMitteV169Navigation/packet-002.json";
import roofs from "./altMitteRoofStorageV198.json";
import { decodeLosslessRoofCoordinates } from "../losslessRoofCoordinates";

// These are references to the unchanged generated packets, not a new source.
// Day must not parse the separate native spans or legacy voxel ownership data.
export default /*#__PURE__*/ (() => ({
  parts: [...parts0, ...parts1],
  roofTriangles: [],
  roofTriangleCoordinates: decodeLosslessRoofCoordinates(roofs),
}))();
