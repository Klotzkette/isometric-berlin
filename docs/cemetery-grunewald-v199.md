# Friedhof Grunewald-Forst and Nico's grave — v1.0.99

Step 10 adds a small texture-free recognition layer inside the existing v187 Grunewald scope. No previous packet, source building, terrain field, tree, path, touring place or runtime budget changes.

## Source and exact location

- The district [cemetery administration](https://www.berlin.de/ba-charlottenburg-wilmersdorf/verwaltung/aemter/strassen-und-gruenflaechen/gruenflaechen/friedhofsverwaltung/artikel.208720.php) identifies Friedhof Grunewald-Forst at Havelchaussee 92b. This is not Friedhof Grunewald in Halensee or Waldfriedhof Dahlem.
- Retained Geofabrik OSM (29 September 2026, ODbL) supplies complete cemetery boundary way `23105617`, 5,091.868 m², the entrance node `249450500`, 22 interior footways, three grave nodes, seven benches and three mapped grave-sector outlines. The source inventory preserves full original rings and tags.
- Nico's grave is exact node `277933694`, world `[-10940.849441,2628.491012]`. [Mein Kiez, mein Friedhof](https://www.meinkiez-meinfriedhof.berlin.de/veranstaltungen/fhrung-friedhof-grunewald-forst-oktober) identifies grave 82, Christa “Nico” Päffgen with her mother Margarete, and the dark polished stone. Two restrained lights and the factual names/dates use independent geometry. No letter, fan portrait, photograph, copyrighted lyric or quotation appears.
- Current official-DGM Grunewald heights remain authoritative: Nico ground is 33.319568 m drawn / 33.330000 m native in NHN−30 display datum. The cemetery is entirely inside earlier coverage. Native geometry follows the existing 8 m terraces; no new mountain or ground slab is added.

## Representation and limits

The low masonry enclosure follows the complete mapped boundary and keeps the source entrance open. Its round-arched, pitched-roof stone portal follows the free reference photograph. Two wooden gate leaves are shown open for walking; their opening state is illustrative. Wall height, stone courses, portal proportions and unmeasured grave dimensions are display estimates, not survey claims. The marker bearing follows the mapped row direction, rather than pretending OSM supplied a surveyed stone bearing.

Small loose-earth margins follow the retained path courses at an explicitly estimated 1.2 m path width. They are neither new paving nor invented stone kerbs. No existing path top or ground face is removed. Benches use their mapped positions and material clues. Three exact named grave anchors receive restrained markers. The OSM spelling “Willi Scholz” differs from the district/photograph “Willi Schulz”; the old tag remains evidence and no disputed inscription is drawn. The other two grave silhouettes are generic recognition estimates, not photographic reconstructions.

The three exact sector outlines constrain 22 **representative anonymous** grave/cross markers to interior centre rows. Their individual positions/counts are illustrative, not a complete measured burial register. The orthodox sector's wood and cross form are supported by its OSM description. No additional invented named grave is added. Ordinary woodland/tree and source house detail remains untouched.

## References and attribution

`cemetery-grunewald-v199-credits.json` supplies three original Commons records to the shared source manifests. Axel Mauruszat's 24 July 2006 portal and Nico grave photos carry Commons' attribution-only permission, explicitly allowing all reuse with credit. The portal mirror's SHA-1 exactly matches original Commons `c6b5803855b74a0f10e7c939c2a8dd1a769e3e5b`. Nico's stone was inspected through visitBerlin's attributed derivative. Jürgen Schuschke/SK49's *Ein Brief an Nico.JPG* is **CC BY 3.0** in the original Commons record; visitBerlin's BY-SA label is recorded as a metadata conflict, not silently propagated. This third reference supports only restrained remembrance objects, with no copied image/letter content. All photos remain external visual references and none ships as a texture or asset.

## Runtime and checks

`createCemeteryGrunewaldV199(native=false)` constructs only the selected representation: three drawn batches or two native batches, final-count instanced arrays, frozen transforms and computed culling bounds. Both touch and pointer retain all detail. The native form is independently axis-aligned; no rotated smooth model remains underneath. The small separate navigation module returns collisions only for added walls/posts/stone solids and leaves the central entrance open. Ground/water/navigation for all existing land remains with the retained Grunewald system.

The source-data-only generator is reproducible from the committed extracted source. Raw PBF/GPKG extraction is needed only to rebuild that initial evidence. Tests verify identities/coordinates, unchanged terrain hash, exact reproducibility, finite bounded geometry, independent native transforms, the actual ray-hit stone height and unobstructed entrance.

```sh
uv run python scripts/build_cemetery_grunewald_v199.py
uv run pytest tests/test_cemetery_grunewald_v199.py
cd src/app && bun test tests/cemetery-grunewald-v199.test.ts
```

Suggested world camera poses (position → target):

- Overview: `[-11060,105,2790] → [-10965,33.5,2660]`.
- Portal: `[-11010,39,2654] → [-10998.75,36,2662.90]`.
- Nico: `[-10936,36.3,2632] → [-10940.85,34,2628.49]`.
