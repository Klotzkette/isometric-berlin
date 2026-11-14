# Zoo, Tierpark and Gärten der Welt — bounded detail continuation

This Step 10 pass refines three already represented architectural groups. It
does not claim a new photographic reconstruction of the entire two zoos or
every thematic garden. Complete existing grounds, paths, animal houses, moving
animals, garden layouts, maze, terrain, ropeway and navigation remain present.

## Public reference evidence

- **Zoo Berlin, Antilopenhaus.** The operator's
  [current-building photograph in its 180-year account](https://www.zoo-berlin.de/de/aktuelles/news/artikel/180-jahre-berlin-antilopenhaus)
  shows a layered buff cornice, small pale dentils and a narrow blue course
  below the existing roof. The new detail follows the exact entrance face of
  retained Geoportal part `DEBE3DlyqEefwivU` within OSM way `16970136`.
  Drawn adds 29 dentils and four cornice/stringcourse bands. Native independently
  borrows 17 exposed cardinal faces from the actual retained shell; it does not
  paste a rotated smooth front into the block model. The existing pointed arch,
  four minarets, glazing and full original roof remain intact.
- **Tierpark, Schloss Friedrichsfelde.** The
  [Freunde Hauptstadtzoos exterior photograph](https://www.schloss-friedrichsfelde.de/)
  supports pale raised window surrounds, pink outer bands and divided tall
  windows. These small fittings follow the 67 existing Drawn window anchors
  on retained official family `DEBE11YYI00009hE`, OSM way `11269749`.
  Native derives its 290 exposed glazing faces from the actual independent
  existing native boxes, excluding faces hidden by adjacent occupied cells.
  The older mullions remain inside the panes; new surrounds sit outside their
  boundaries. The complete palace body, three measured leaves, roof and
  gardens remain unchanged. This pass does not correct or newly survey the
  older window-layout estimates.
- **Gärten der Welt, Korean Garden.** The operator's
  [photographs and aerial view](https://www.gaertenderwelt.de/welt-entdecken/themengaerten/koreanischer-garten/)
  show dark tiled roofs with visibly repeated raised courses and timber fascia.
  The new 218 courses follow the retained roof surfaces of Kye Zeong
  (`243695792`) and three covered gateways (`243695784`, `555478185`,
  `555478186`). Drawn channels follow the existing sloping roof; Native uses
  separately generated cardinal bands on its actual four roof steps and
  cardinal supporting domain. All additions stay at roof height. The open
  gateway passages, pond and original walls are unchanged.

The photographs are external reference evidence only. Copyright remains with
Zoologischer Garten Berlin AG, Freunde Hauptstadtzoos e.V. and Grün Berlin /
the credited photographers (including Drone Brothers for the Korean aerial).
No photograph, visitor plan, image crop or texture is copied into the product.
Metric anchors are retained OpenStreetMap contributors (ODbL 1.0), Geoportal
Berlin LoD2 and DGM1 (Datenlizenz Deutschland Zero 2.0). Small ornament sizes,
spacing, colours and the prior facade/roof interpretations are display estimates.

## Delivery and preservation

`scripts/build_zoo_garden_details_v341.py` reads the literal `3134ff0e`
predecessor and stages one append-only mesh in each existing `-5_2`,
`outer187-20_3` and `gardens330-27_-4-p2` packet, separately for Drawn and Native.
The root release process merges the six exact descriptor changes into the
current shared manifest. No descriptor, coverage, ground mask, model retirement,
timer, loader, live residency allowance or new walking solid is introduced.
The normal packet culling, cancellation, upload, mode selection and disposal
remain in charge; mobile uses the same complete meshes.

The receipt in `geo_data/regierungsviertel/zoo-garden-details-v341-receipt.json`
pins all six construction source files and old/new packet SHA-256/byte counts.
The source files must still be byte-identical before staging. Each prior mesh,
all navigation and every other packet field remains an exact prefix/complement.
The additions total 396 / 1,524 Zoo triangles, 6,432 / 27,840 palace triangles,
and 622 / 3,999 garden triangles for Drawn / Native. No existing geometry is
reduced to accommodate the additions.

Validation: three Python tests exercise real staged packets, complete old
prefix/navigation preservation, exact source hashes, changed-source rejection,
bounded owner placement and every Native triangle's cardinal alignment. Ruff
passes. These are geometry/source checks, not a claim to a completed whole-city
browser endurance test. Integrated build/publication and internal-browser QA
belong to the root release review.

Reproduce the staged delta with:

```sh
uv run --no-sync python -m scripts.build_zoo_garden_details_v341 --out /tmp/zoo-garden-v341
uv run --no-sync pytest -q tests/test_zoo_garden_details_v341.py
```
