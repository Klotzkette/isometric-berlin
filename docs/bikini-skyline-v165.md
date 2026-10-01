# Step 10: Bikini terrace and Bahnhof Zoo skyline refinement

## Retained geometry

The v153 Bikini source remains byte-for-byte intact: all **103 OSM parts**,
four mapped staircases, separate upper slab, recessed Bikini storey, setback
roof storey, planted roofs and their glass openings are still rendered.
The 660 exclusively owned native cells and 29 mixed cells keep their existing
ownership rules. No hotel, Zoo Palast or neighbouring source body is absorbed
by the Bikini model.

The v161 Zoofenster and Upper West payloads already provide their complete
**30 official LoD2 parts**, full roof silhouettes, limestone window bays,
Zoofenster glass crown and Upper West aluminium bands. Those files and their
native counterparts remain unchanged. The Europa-Center and its rotating
star also remain intact. This refinement does not lower existing model
detail on any device.

## Bikini recognition details

The public roof terrace now follows its mapped bends with **223 fields** of
dark metal blades and the broad timber handrail visible on the zoo side.
The existing exposed-edge and stair-gap filters remain in place. The added
**126 glazing-frame members** terminate at the mapped glass-roof polygons;
the source glass, roof holes and stair cuts remain unobstructed. The zoo-side
upper facade now has pale spandrels and narrow gold operable leaves beside
the larger window panes. Street-side coloured panels are retained.

These small members are procedural interpretations of reference photographs,
not surveyed rail or sash measurements. The exact building parts remain the
metric anchor. The [Bikini operator's architecture presskit](https://www.bikiniberlin.de/de/pressekit/)
and [restoration architects Hild und K](https://www.hildundk.de/projekte/bikini-berlin-2/)
document the restored facade, transparent storey and publicly accessible roof
terrace.

Inspected Commons references, external only:

- [Charlottenburg Bikinihaus Terrasse-001.JPG](https://commons.wikimedia.org/wiki/File:Charlottenburg_Bikinihaus_Terrasse-001.JPG),
  Fridolin freudenfett, **CC BY-SA 3.0**: timber rail and fine dark balustrade.
- [Charlottenburg Bikinihaus Terrasse-002.JPG](https://commons.wikimedia.org/wiki/File:Charlottenburg_Bikinihaus_Terrasse-002.JPG),
  Fridolin freudenfett, **CC BY-SA 3.0**: pale zoo facade, gold opening leaves,
  terrace glazing and stair approach.

The existing three drawn batches remain three, at **5,835 instances / 25,758
stored vertices / 830,118 geometry-and-instance bytes**. Native Minecraft
remains two batches, at **23,271 instances / 7,965 stored vertices / 1,888,359
bytes**. These bounded increases represent newly visible detail. The same
static detail is built on touch and pointer devices; no texture is loaded.

## Huthmacher-Haus / DOB-Hochhaus

The new source-bound Huthmacher model completes the lower northern skyline
beside the two tall Breitscheidplatz towers. Only legacy prism **64359480**
(OSM way **364359480**) is replaced, using all **ten parts / 64 exterior wall
and roof surfaces** of official LoD2 parent **DEBE00YY1EZ0000e**. This is not
Zoo Palast, whose separate parent is DEBE00YY1EZ0000h and is unchanged here.

Source: [Geoportal Berlin LoD2 tile 386/5818](https://gdi.berlin.de/data/a_lod2/atom/LoD2_386_5818.zip),
**dl-de/zero-2-0**. The source archive's SHA-256 is recorded in
`huthmacherSource.json`. The retained datum is 34.143 m NHN mapped to the
existing viewer ground of 5.2 m. The tallest source part reports **61.703 m**
measured height; its rounded coordinates reach 66.902 m in viewer space.
Lower rear parts and all surveyed roof steps are retained.

The prior OSM estimate was 48 m from a floor count. Its complete old ring and
height remain in provenance. The current official part union is 1,584.731 m²;
the former ring is 1,437.86 m². Their outline conflict consists of 56.060 m² of
thin old-only strips and 202.931 m² of official-only footprint. The metric
display deliberately follows the complete official survey, rather than
inventing extensions to retain an older estimated extrusion. The decision
and area accounting are explicit in `sourceConflict`.

The [operator's renovation description](https://www.bikiniberlin.de/de/pressemitteilung/die_bayerische_hausbau_startet_die_teilsanierung_des_huthmacher-hauses_moderner_buero_standort_in_der_city_west/)
identifies the 1957, sixteen-storey building and the retention of its listed
architecture during the partial renovation. The
[Berlin monument inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040473)
anchors its separate place within Zentrum am Zoo. The pale aluminium grid,
horizontal window ribbons, slender dividers and broad blank end panels are
procedural source-clipped facade details. The inspected
[Hardenbergplatz reference](https://commons.wikimedia.org/wiki/File:Charlottenburg_Hardenbergplatz_Huthmacher-Haus.jpg)
is by **Fridolin freudenfett, CC BY-SA 4.0**. Its older temporary advertising
is not asserted to be current and is not reproduced. No photograph or crop
is bundled or used as a texture.

Drawn geometry uses two frozen batches: the complete measured shell and
**2,161** facade instances. The independent native form uses one batch of
**4,178** surface cubes, without hidden solid infill or a smooth duplicate.
Centre-sampled pane colour leaves over 65% of the native skin as the pale
wall material, preserving the spandrel reading. Mobile and desktop build
identical full geometry. A separate lightweight navigation payload supplies
all roof triangles, native top cells, part rings and exact legacy ownership.

## Verification

Focused tests retain all Bikini part IDs, source area, original exterior
walls, every stair partition and source roof opening. Ray tests still land on
the visible steps and terrace, without reinstating the old closed mall cap.
The earlier v161 tower preservation tests remain green.

Huthmacher tests verify all ten parent-part identities, all official wall and
roof triangle areas against the available CityGML archive, irregular-wall
window clipping, finite bounded buffers, identical mobile geometry, roof
navigation and height-aware legacy-column ownership. Only the old 48 m source
columns are replaced; unrelated heights or neighbouring footprints are not
claimed. Reproduce source generation with
`uv run python scripts/build_huthmacher_v165.py`.
