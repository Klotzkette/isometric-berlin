import profile from './data/berlinKlosterruineV288Navigation.json';

/** Only scalar extents and small rings survive in navigation. No geometry
 * constructor, source sheets or native source-cell recipe is imported. The
 * 12 mm masonry-course gaps merge for collision; actual arches remain open. */
export function berlinKlosterruineSolidsV288(native = false) {
  return (native ? profile.native : profile.drawn).map(s => ({ ...s }));
}
