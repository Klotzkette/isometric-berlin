# Neue Nationalgalerie and Molecule Man — v1.0.83

The original small Nationalgalerie drawing was centred on a representative
landmark point rather than its hall footprint, an offset of about 13.6 m. Eight
retained LoD2 prism envelopes also occluded the transparent upper hall. The new
factory replaces only those eight visible generic owners (all original records
remain in the core inventory and `neueNationalgalerieV183Source.json`). Its exact
terrace polygon and hall centroid come from those records. Native masking uses
only their point-in-polygon footprints, with axis-aligned scanline runs.

[GSE, the structural engineers](https://www.gse-berlin.de/referenzen/tragwerksplanung/neuenationalgalerie-museumundausstellungsgalerie/)
publish the 64.8 m square roof and eight external columns.
[The museum's facade account](https://blog.smb.museum/schwierige-verbindung-die-stahl-und-glasfassade-der-neuen-nationalgalerie/)
provides the steel/glass arrangement. A 50.4 m recessed glass square and 3.6 m
module guide the visible grid. The eight cross columns, roof-bearing caps,
underside grid, door frames and transparent glass are explicit geometry. Original
terrace top is viewer Y9.8 m; the [museum-published hall height](https://blog.smb.museum/gemaessigte-zone-die-klimatechnik-in-der-neuen-nationalgalerie/) is 8.4 m. Roof thickness 1.8 m,
member sections and stair subdivisions are display fits, not surveyed heights.
The top step meets the source terrace edge at local Z54 m; the lower steps
extend outward, so the retained terrace mass does not bury the entrance.
The coarse flat prism elevations cannot determine these separately. No source
terrain, roof inventory or neighboring museum model is deleted.

Molecule Man uses the three thin radial arms of retained OSM way/166268035 from
Geofabrik's Berlin extract dated 29 September 2026. The coordinate conversion is
EPSG:25833 to world `[easting−389500, 5820000−northing]`.
[Jonathan Borofsky's project page](https://www.borofsky.com/index.php?album=moleculemanberlin)
establishes three 30 m aluminium figures. They meet at the exact mapped junction;
three separately drawn silhouettes have real open perforations. Native blocks
retain open air at those perforations. Anatomy, circular spacing and the thin
plate section are recognition estimates rather than a scan of the artwork.

External visual reference: [Molecule-Man-sculpture-Berlin.jpg](https://commons.wikimedia.org/wiki/File:Molecule-Man-sculpture-Berlin.jpg),
KK nationsonline/Klaus Kästle, CC BY-SA 4.0. Inspected only; no pixels bundled.
Oberbaumbrücke's mapped outline is retained as source context; no speculative
replacement bridge or extra closed river mass is added in this change.

Both additions share the existing mode-family release lifecycle. Smooth and
native representations never coexist; native instance matrices stay axis aligned.
Transparent gallery glazing retains depth testing with depth writes disabled.
The tests check this, exact mode reconstruction, actual holes, finite buffers and
bounded instance memory. None of the mobile render-resolution, view-distance,
source-detail or streaming budgets changes.

The gallery change is a visual refinement. Its prior pedestrian prism collision
remains in place; the transparent hall is not newly walkable in this release.
Station platform and hall navigation changes are separate, source-bound v183
contracts.
