# Uber Arena and S-Bahnhof Warschauer Straße — v225

Step 10, within the previously covered city. This correction replaces exactly
two coarse presentation owners with complete, bounded dedicated models. It
adds no coverage, tour stop, photographic texture or residency allowance.

## Source and current architecture

The arena is Berlin LoD2 parent `DEBE02YY2000060P`, from the retained official
[394_5818 archive](https://gdi.berlin.de/data/a_lod2/atom/LoD2_394_5818.zip),
licensed dl-de/zero-2-0. The complete **33 parts and 646 wall/roof sheets** are
retained in [the source receipt](../geo_data/regierungsviertel/arena-station-v225-source.json).
They produce 1,693 triangles with their original XZ coordinates. The former
single flat 38.78 m parent prism concealed the roof curvature, lower foyer and
separate parts. Required construction now renders the complete source sheets.
The original parent-ground shift (`y = source y − 5.66 + 3`) is preserved;
this does not rebase neighbouring streets or buildings.

The [arena operator](https://www.uber-arena.de/die-arena/daten-fakten) describes
the curved glass front and its 120 × 12 m LED field. Those published overview
dimensions do not override measured source planes. The
[façade engineer](https://www.pml-lange.de/index.php?id=210) identifies steel
mullion/transom construction with stone and metal cladding. The bowed foyer
receives pale mullions, horizontal rails and stone-band recognition at its
own source edges; the dark roof keeps its measured shape. The
[Uber/AEG announcement](https://www.uber.com/de/de/newsroom/uber-arena-neuerungen/)
identifies the current name and the 34 m roof lettering installed in 2024.
Original vector capitals follow the source front course. Letter shapes,
palette, subdivision pitch and member sections are display estimates. No
advertising image, logo artwork or trademark typeface is reproduced.

The station keeps OSM building `way/297153147`, station `node/3658970189` and
both complete platform rings, `relation/11765290` and `relation/11765307`.
Its former closed three-metre prism came from `building:levels=1`; that was
not a measured hall height. The
[structural checker](https://kl-ing.de/projekte/projekt/empfangsgebaeude-s-bahnhof-warschauer-strasse-berlin/)
describes an elevated hall about 16 m above the platform, two rows of fourteen
concrete columns and steel fish-belly roof beams at ten-metre intervals.
[Implenia](https://implenia.com/referenzen/detail/ref/s-bahnhof-warschauer-strasse-in-berlin/)
identifies copper cladding, steel glazing frames, glass roofs and dlw as
architect. The exact OSM plan remains 57.952 × 28.130 m rather than being
rescaled to the engineer's approximate 55 × 27.5 m description.

The existing platform grade `y=3.96` is an established presentation estimate.
The roof is therefore `y=19.96`, and the concourse slab is `y=9.96…11.96`.
These elevations and member sizes are explicit recognition estimates, not a
railway engineering survey. The 28 supports, elevated technical floor, glazed
hall, east-facing vector station name and shallow steel members leave the track
level open. Existing platform
surfaces, name signs, benches, routes and all unrelated railway detail remain.
Interior stairs, shops and individual canopy footprints are not newly surveyed
or reconstructed by this bounded exterior refinement.

## Visual references and attribution

The two external freely licensed photographs were inspected as recognition
references. Their credits are retained in
[the site credits](../geo_data/regierungsviertel/arena-station-v225-credits.json)
and both existing Wikimedia attribution manifests:

- Kostisl, [Uber Arena Berlin 2024](https://commons.wikimedia.org/wiki/File:Uber_Arena_Berlin_2024.jpg),
  6 August 2024, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- Lukas Beck, [Bahnhof Warschauer Straße](https://commons.wikimedia.org/wiki/File:Bahnhof_Warschauer_Stra%C3%9Fe.jpg),
  23 September 2022, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

No photograph, crop, pixel-derived colour sample or photographic texture ships.
Primary-contractor pages supply factual material/structural descriptions;
their historical construction/branding photographs are not runtime assets.

## Exact ownership and physical support

[The ownership receipt](../src/app/src/data/arenaStationV225Ownership.json)
records source packet SHA-256, encoded-array fingerprints and the exact coloured
triangle multiset reconstructed independently for each old owner. It transfers
1,685 coarse triangles across both representations and 199 drawn ink segments
in `9_2`, `9_3` and `10_2`. All original packet files, positions, colours and
unrelated indices remain byte-identical. Only the audited indices are made
degenerate during decoding, guarded by the complete encoded-array fingerprint.
Changed packets conservatively retain their old geometry.

Navigation retires only fully equal original rows, including ground grade and
every optional field. The new source-family solids and station support volumes
are present before navigation is enabled. The station has no full-footprint
solid at track level and no terrain/roof substitution. Both walking-environment
construction paths use height-aware support: arrival from above lands on the
actual roof, a visitor already inside the hall stays on the concourse and a
visitor below it stays at the ordinary ground. The arena similarly supplies its
measured roof only when below the visitor's feet. The old v190 roof-edge
accent alone is omitted only if its ID, six-metre level and complete rings match
the retained receipt. Both original platform rings and furniture stay intact.
Neither owner has a v188 ordinary-house façade: the arena exceeds that
selector's 36 m height limit and the station has a non-DEBE owner.

## Runtime and validation

`createArenaStationEnvelopesV225(native)` is required before navigation;
`createArenaStationV225(native)` adds optional arena recognition fittings.
Drawn detail is identical for touch and pointer. Native mode has independent
axis-aligned geometry: 3,731 merged one-metre arena surface runs plus bounded
station/fitting blocks. The native surface discretisation is a documented
block reading of the same source family, without hidden solid infill.

Both factories together use **6 renderables / 280,952 owned GPU bytes** drawn
and **3 renderables / 587,144 bytes** native. Storage is final-count, with no
texture, animation, duplicate full-city copy or maximum-capacity buffer. The
envelope's `surfaces` and `blocks` are read-only constructor fields eligible for
the existing lossless weak source cache; model buffers participate in the
unchanged v124 upload retirement and parking path.

Focused validation: five Bun tests and two Python tests pass. They check every
rendered source triangle, complete part/sheet counts, actual packet hashes and
all unrelated index values, changed-packet fallback, full-value navigation
guards, 28 physical supports and open rail channels, unchanged platform source,
independent native matrices, no texture coordinates and bounded storage. This
includes production pedestrian descent and subsequent walking on the roof,
concourse and track level in both representations. This
does not establish surveyed station circulation or a new physical-device
memory guarantee. Root release checks perform integration and browser review.

For visual review: arena target `[4870,21,1510]`, camera `[4740,105,1720]`;
station target `[5309.548,11.96,1508.006]`, camera `[5380,70,1615]`.
