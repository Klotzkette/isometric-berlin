# Step 10 — Steglitz recognition v246

A finite additive pass inside the existing required `SteglitzV182` batch. No
new descriptor, renderable, texture, per-frame task or residency limit. Complete
v182 shells, all 71 LoD2 parts, roofs, navigation and v185/v205/v228 school detail
remain byte-identical; the generator records immutable source and packet hashes.

- **Gymnasium Steglitz:** precisely the 102 existing openings on the three
  retained Heesestraße walls of `DEBE06YYB0000AUq`. Two muted glass fields and a
  central light mullion sit behind the earlier frames, arches and sills. All
  original openings remain the positional authority; this does not claim that
  their previously estimated register is a new window survey. Native glass is
  split against the actual existing orthogonal skin, including its vertical
  run boundaries, rather than rotating the drawn wall.
- **Spiegelwand, Hermann-Ehlers-Platz:** OSM `way/775632534` keeps its nine
  1 × 3.5 m mirror panels, narrow footprint and existing collision. Both faces
  gain small panel joints, restrained highlights, three larger etched fields
  and fine non-verbal line fields. The original panels remain visible; no names,
  quotations or photographs are fabricated. Independent native marks follow
  the actual stepped memorial cells. The surrounding plaza stays open.
- **Schloßstraße at the Rathaus:** exact OSM `451621864` and `483483276`, totaling
  approximately 67.5 m, carry explicit width, green cycle-lane width and boundary
  marking tags. Prior coverage there delivered only the older road hairline,
  not an asphalt polygon. These two complete mapped road strips therefore gain
  a shallow asphalt surface at the existing v182 road datum 3.09 m before paint
  is applied. Green paint remains inside the tagged lane; continuous versus
  dashed boundaries follow tags. Both junction ends stay unpainted. The entire
  footprint must fit old ground and avoid every retained building. The other
  Schloßstraße sections, roads, paths and all older outlines remain intact.

Small glass tones, etched-field layouts, fitting widths and millimetric surface
offsets are display estimates. No rooftop, facade mass, victim inscription,
new street junction or unmapped crossing is inferred. Native rectangles are
merged only when exactly adjacent with identical material; no holes are filled.

## Evidence and reference-only sources

- [LDA 09065532, Progymnasium](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065532):
  Heesestraße 15, Otto Techow, 1890.
- [KLW renovation account](https://www.klw-berlin.de/gymnasium-steglitz/) and
  [project sheet](https://www.klw-berlin.de/wp-content/uploads/2019/04/PDF_2010_Referenz_Energetische_Geb%C3%A4udesanierung_Gymnasium_Steglitz.pdf):
  distinct 1890 masonry main building, 1974 concrete extension and 1961 sports
  hall. The existing distinct measured forms are retained.
- [Muns, Gymnasium Steglitz, 18 May 2012](https://commons.wikimedia.org/wiki/File:120518-Gymnasium-Steglitz-Heesestra%C3%9Fe.JPG),
  CC BY 3.0: white divided windows and multicolored brick facade. Reference only;
  no image pixels or derived photographic textures are bundled.
- [Bildhauerei in Berlin, Spiegelwand](https://bildhauerei-in-berlin.de/bildwerk/spiegelwand-5559/):
  Hans-Norbert Burkert, Wolfgang Göschel, Joachim von Rosenberg, 1994–95; both
  faces nine panels, chrome-nickel steel, concrete and granite. Susanne Kähler,
  2009, CC BY 4.0 photographs are reference-only. The entry's older count of
  2,000 names conflicts with the district's
  [2025 account, 1,758 deported Jewish Berliners](https://www.berlin.de/ba-steglitz-zehlendorf/politik-und-verwaltung/beauftragte/antisemitismus/artikel.1587208.php);
  no numerical victim count is represented in the model.
- [District, green Schloßstraße cycle lanes](https://www.berlin.de/ba-steglitz-zehlendorf/aktuelles/pressemitteilungen/2020/pressemitteilung.907054.php)
  and retained v182 OSM source provide street context. Geometry and lane tags
  come from the exact retained OSM ways, not from an inferred redesign.

## Checks and delivery

`scripts/build_steglitz_details_v246.py` emits a 61,357-byte additive JSON and
`steglitz-details-v246-evidence.json`. It adds 534 drawn and 559 independent
native instances in the existing batches. Existing 900,000 / 2,250,000-byte GPU
caps and 3 / 1 renderables remain unchanged, with equal drawn mobile detail.
Focused tests cover exact old hashes and matrices, deterministic regeneration,
all school pane boundaries and native support surfaces, both memorial faces,
tagged-road containment and paint heights.

Useful review views: school eye `[-3162,17,6829]`, target `[-3200,13,6825]`;
memorial eye `[-3445,13,6840]`, target `[-3471,5.3,6822]`; Rathaus street eye
`[-3535,35,6815]`, target `[-3600,3.1,6820]`.
