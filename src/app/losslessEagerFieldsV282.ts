/** Six existing eager fields, selected individually from deferred 3D modules.
 * Decode eagerly to ordinary strong data properties, exactly as before. This
 * changes only source literals: no new lazy/weak ownership or numeric packing.
 */
export const LOSSLESS_EAGER_FIELDS_V282: Readonly<Record<string, readonly string[]>> = {
  'data/citywestTransportV281.json': ['packets'],
  'data/mitteEnsembleV281.json': ['drawn', 'minecraft'],
  'data/tramRailsV281.json': ['ground'],
  'gendarmenmarktPerimeterSource.json': ['buildings'],
  'eastOutlineVoxelData.json': ['cells_i32'],
};
