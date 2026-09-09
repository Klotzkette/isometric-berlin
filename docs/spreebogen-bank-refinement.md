# Spreebogen bank, v1.0.11

Step 10 corrects the bounded Ludwig-Erhard-Ufer and Panoramaweg presentation
between Hauptbahnhof and the Swiss Embassy. Canonical OSM, terrain, paths and
landmarks are unchanged.

## Evidence and source separation

- OSM park [737280675](https://www.openstreetmap.org/way/737280675), lower paths
  [34834265](https://www.openstreetmap.org/way/34834265) and
  [1128036906](https://www.openstreetmap.org/way/1128036906), and upper path
  [4395332](https://www.openstreetmap.org/way/4395332) remain the metric plan
  anchors. All 37 shoreline vertices in `spreebogenBankProfile.ts` occur
  verbatim at the committed decimetre precision in the three adjoining OSM
  river polygons. Lower path ordinates retain the previous committed profile.
- Berlin's official [Tiergartenring description](https://www.berlin.de/sen/uvk/natur-und-gruen/landschaftsplanung/gruene-hauptwege/die-wege-im-ueberblick/artikel.930432.php)
  states that the Panoramaweg lies up to five metres above the lower promenade.
  This relative envelope does **not** provide surveyed intermediate deck
  sections. The continuous upper profile, deck width, concrete supports,
  retaining faces, lawn subdivisions, slab arrangement and rail spacing are
  procedural display geometry.
- Four already credited Beek100 photographs were inspected, including
  [Uferpromenade, Panoramaweg und Gartenspur](https://commons.wikimedia.org/wiki/File:Spreebogenpark,_Uferpromenade,_Panoramaweg_und_Gartenspur.jpg),
  [Sichtfenster](https://commons.wikimedia.org/wiki/File:Spreebogenpark,_Sichtfenster.jpg),
  [Geländeeinschnitt von anderer Spreeseite](https://commons.wikimedia.org/wiki/File:Spreebogenpark,_Gel%C3%A4ndeeinschnitt_von_anderer_Spreeseite.jpg)
  and [Uferpromenade und Gustav-Heinemann-Brücke](https://commons.wikimedia.org/wiki/File:Spreebogenpark,_Uferpromenade_und_Gustav-Heinemann-Br%C3%BCcke.jpg).
  These show a pale continuous lower path, maintained grass at the river,
  stone-faced upper slopes, concrete upper-gallery supports, metal rails,
  low Gartenspur slabs and the paired Corten landscape-window walls. The
  2008 photographs establish forms and materials, not live maintenance status.
  All use CC BY-SA 4.0, artist Beek100, own work. Existing manifest rows and
  reference files remain; no new image, texture, photograph or runtime request
  is added.

## Corrected display conflicts

1. The generic quay applied a minimum bank height above the committed lower
   path and a 1.6 m coping, while coarse land slabs projected over the true
   shoreline. The continuous source shore now receives a bounded local height
   override. Drawn raster cells within the exact OSM park and intersecting its shore are omitted
   from presentation and covered by a locally tessellated exact-OSM park patch plus the exact-shore lawn/path layer; Minecraft
   retains native cells with locally corrected heights. Other riverbanks keep
   their existing terrain and wall samplers.
2. The old upper lawns added 6.8 m to terrain that already contained the park
   elevation. The upper path separately added a sine rise to terrain, and its
   segments used unrelated midpoint heights. New lawn endpoints follow the
   actual curved upper path; lawn grades interpolate from the existing southern
   terrain to that profile. Deck top/bottom and rail geometry share section
   endpoints. No source terrain elevation is overwritten in the payload.
3. The old 18 procedural Gartenspur slabs repeated one world-Z band across the
   river bend, leaving eastern pieces in water. Sixteen display slabs now lie
   between the source shore and lower path. Their exact dimensions and rhythm
   remain explicitly unsurveyed.
4. Float32 boundary vertices previously fell outside a strict park test and
   reverted to the old high terrain. Include the exact source boundary within
   0.1 mm numerical tolerance and recess the backing under the separately
   triangulated river lawn by 16 cm. This removes edge spikes and overlapping
   triangles without changing source coordinates or visible lawn heights.
5. The preceding Minecraft signature reused the smooth park. It now has one
   independent world-axis block batch, with surface-only lawns, native deck,
   slim rail blocks and concrete supports. The smooth root has
   `keepInMinecraft=false`; mode restoration remains reversible.

The helper module has no runtime imports. All replacements have an explicit
`[-148,278] × [-439,-230]` metre broad phase and local path/shore tests. The
promenade helper returns null outside its owned land strip. The upper walk
surface uses the exact two triangles of each displayed section, with a height
condition that preserves travel below the gallery.

## Verification

Tests retain every source shoreline vertex, check unrelated banks, trace 110
lower-path and 80 upper-path ray samples through section joints, and compare
ray-hit heights with physical surface callbacks. Another 248 paired ray
   samples confirm at least 3 cm separation between the backing and visible
   river lawn, including the float32 source boundary. The previous double-rise and
river-slab regressions have explicit checks. Both Minecraft profiles remain
one bounded native draw call.

Actual geometry was exported from the production factories and inspected in
orthographic software views together with the current source ground, water,
quays and bridges. These plates validate overlap and silhouettes; they are not
browser or device performance measurements.

## Final walking and Minecraft corrections

The actual rising-lawn Float32 triangles compile once into a 16 m spatial
index. Walking uses this surface after resolving the two path levels, removing
up to four metres of disagreement with the earlier raw-DGM support. Both
runtime startup paths install the same bounded sampler.

Minecraft clips each path triangle against intersecting cells instead of
requiring its cell centre to lie inside a narrow triangle. A lazy cached
full/mobile cell map supplies both the rendered deck and its exact flat walking
height. Overlapping turf and stone backing blocks are lowered below these decks.
Integer cell keys use floor rather than rounding half-cell centres, preventing
periodic gaps in the 2.8 m full-profile lawn grid. Tests include 380 actual
full/mobile path rays and 130 native turf rays.

Final native budgets: one draw call each, 11,493 instances / 873,828 bytes full
and 6,049 instances / 460,084 bytes mobile. Byte totals include box attributes,
indices, instance transforms and colours. Local lawn-sampler observations were
about 1.77 ms to compile and 5.03 ms for 10,000 queries; these are not browser
or device measurements.
