/** Finite new architectural source fields. Navigation and exact ownership
 * receipts retain eager strong identity; only their encoding is compressed. */
export const LOSSLESS_EAGER_FIELDS_V274: Readonly<Record<string, readonly string[]>> = {
  "data/operaTheatresV274Navigation.json": ["parents", "parts", "legacyPrisms", "roofTriangles", "nativeRoofCells"],
  "data/operaTheatresV274Ownership.json": ["columns", "sharedColumns", "neighbours", "records", "lineRecords", "navigationRecords", "retainedOwners", "previousBoxes", "previousSegments"],
  "data/schoolsCourtsV274Navigation.json": ["parts", "roofTriangles", "nativeRoofCells", "nativeUpperPart"],
  "data/centralTheatresV274.json": ["drawn", "palastPrevious", "sourceBoxes"],
  "data/northCultureV274Source.json": ["suhrkampFaces", "schoenhauserTorParts"],
};
