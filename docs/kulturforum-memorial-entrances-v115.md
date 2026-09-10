# Kulturforum entrances, Berlin Junction and T4 memorial

Pipeline step 10. This pass separates two neighbouring memorials that shared a
misleading combined OSM name and makes the public entrances around the
Kulturforum legible in the isometric view. It does not move or replace the
official LoD2 building shells.

## Berlin Junction and the T4 memorial

OSM way `187360886` is the exact mapped footprint for Richard Serra's *Berlin
Junction* but its name also mentions the victims of Aktion T4. Treating that
whole record as a blue glass wall was wrong. The work is now represented by
two curved, slightly opposed Corten-steel plates with an open passage. The v1.0.15 attribution of 13.65 × 3.90 × 0.055 m to the sculpture inventory
was incorrect: the inventory publishes 14 m length and 3.4 m height per plate,
and no thickness. v1.0.23 uses that inventory envelope; the retained 0.055 m
display thickness, curvature, lean and passage width are explicitly estimates.
See the [owner-photo correction and source conflict](berlin-junction-v123.md).

The later memorial and information site owns separate OSM way `303577518`.
The [Stiftung Denkmal account](https://www.stiftung-denkmal.de/denkmaeler/gedenk-und-informationsort-fuer-die-opfer-der-nationalsozialistischen-euthanasie-morde/)
documents its transparent blue 24 m glass wall on an anthracite concrete field
that inclines gently toward the middle. The model adds the information pult,
bench, glass divisions and dark field as recognisable, image-free presentation
geometry. No exhibition text or image is reproduced.

The plate dimensions and two-part conical composition are cross-checked
against the [Berlin sculpture inventory](https://bildhauerei-in-berlin.de/bildwerk/berlin-junction-6427/).
The exact curvature is not claimed as surveyed.

## Kulturforum entrances

The Philharmonie and Kammermusiksaal retain their official LoD2 roof and body
parts. The new entrance overlays distinguish framed glass doors, transoms,
shallow gold canopies and approach steps at the existing facade registers.
The [official visitor map](https://www.berliner-philharmoniker.de/ihr-besuch/anfahrt/)
distinguishes the main entrances for the large hall and chamber hall plus the
Potsdamer Straße and east entrances. The present pass models the two principal
forecourt entrances; it does not claim a door-by-door survey.

At the Piazzetta, the Gemäldegalerie, Kunstgewerbemuseum and the shared
Kunstbibliothek / Kupferstichkabinett complex receive the same bounded entrance
language. The [official Kulturforum site plan](https://www.smb.museum/museen-einrichtungen/kulturforum/besuch-planen/lageplan/)
and institutional overview establish their relationship to the Piazzetta and
Matthäikirchplatz. Local door widths, mullion intervals, canopy projections
and step heights are display estimates kept against the existing source-bound
facades. Labels identify institutions; the correct name is
`Kupferstichkabinett`, not `Kupferstichbibliothek`.

## Review scope

The Spreebogen bank, Brandenburg Gate, historic Charité, Ministergärten and
Lessing models were rechecked against their existing source contracts. Their
current source geometry and specialised models remain more accurate than a new
generic overlay, so this pass does not perturb them. Geometry QA uses actual
Three.js triangles in orthographic software views; it is not a browser or
physical-phone screenshot.
