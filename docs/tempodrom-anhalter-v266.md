# Tempodrom and Anhalter portico — Step 10 v266

This bounded correction keeps the entire Tempodrom podium, all its source holes,
the complete measured Anhalter portico roof and every unrelated source owner.
There is no new district, tour stop, descriptor, texture or animation. Full drawn
mobile geometry is identical to desktop; native construction is independent and
orthogonal. Existing residency, serial decode and prefetch limits remain.

## Identified defects and exact corrections

The previous `addAnhalterBahnhof` recipe placed a closed 35 × 20 × 7 m box, five
painted rectangles and a gabled roof at `[626.535,1725.067]`. Retained OSM way
`27695497` locates the real portico centre at `[713.5268263,1709.2965986]`, about
88 m east. The existing 93-place identity stays; the focus uses the same exact
metric-override mechanism already used by other corrected sights.

Only that named legacy recipe is guarded by `includeLegacyAnhalter:false`.
The complete original recipe and hash remain in the evidence file; its default
constructor behaviour remains unchanged. Production constructs the new required
model before retiring the old one.

The real site also contains exact core owner `400001p6` / `DEBE02YY400001p6`.
Its original LoD2 has ten ground-to-roof closing walls, one sloped roof and a
ground sheet. These twelve original sheets remain immutable in the evidence.
The ten closing walls are incompatible with the documented open three-bay
portico. Only the exact fingerprinted coarse owner and eight exclusively owned
native column tuples yield. Changed source fields or newly overlapping owners
fail closed. The complete original roof is republished with every original
millimetre vertex; no source roof simplification is used in drawn mode.

The replacement has three genuinely open front/rear arches, layered archivolts,
piers and capitals, cornices and terracotta panels. The taller surviving rear
vestibule wall has three open oculi, broken shoulders, an open clock crest and
small original sculptural silhouettes. It does not reconstruct the demolished
station hall or the proposed Exilmuseum. The retained primary reference is
[Landesdenkmalamt 09031114](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031114).
The current exterior photograph is © Berliner Zentrum Industriekultur,
[Nico Kupfer](https://industriekultur.berlin/ort/anhalter-bahnhof/).

Masonry proportions, rear-wall dimensions, ornaments and sculpture silhouettes
are explicitly photographic estimates. The full portico footprint and roof are
measured. Structural rows feed the rendered solids and walking collision; the
three arch axes remain open through the canopy in both families. Routes use
`anhalterPointV266(u,5.2,v)` with `u=-5.45,0,+5.45` and `v=-5…+5`.

## Tempodrom roof and source conflict

Retained OSM relation `7776056` is delivered as the nine-metre podium proxy
`-7776056`. Every source vertex, hole and original roof remains. A compact
recognition supplement adds the dominant curved white roof, twelve sharply
folded bays, a glazed crown, radial clerestory, restrained podium glazing/cedar
panels and geometric entrance lettering.

[gmp](https://www.gmp.de/en/projects/408/tempodrom-and-liquidrom) describes the
37 m tent-like roof and the daylight opening. Its gallery credits Christian
Gahl and Marcus Bredt. The [operator's cleaning report](https://www.tempodrom.de/news/im-neuen-glanz_2017-05-02/)
explicitly confirms twelve roof peaks, but calls the building 30 m high. The
model uses 37 m above retained ground as its documented exterior interpretation;
it does not present the differing figures as interchangeable surveyed heights.
Roof centre/radius, curvature, glazing and fitting dimensions are photographic
estimates constrained inside the retained podium footprint. The crown peaks
reach world `y=42.2`; valleys reach `35.75`. The native counterpart uses its own
0.85 m orthogonal roof cells and quantised height, with no smooth duplicate.
`tempodromRoofAtV266` supplies the same represented upper surface to walking.

All photographs are external references only. No image pixels, photographic
textures, plan traces or fonts are bundled. Geometry sources retain Geoportal
Berlin's dl-de/zero-2-0 and OpenStreetMap's ODbL-1.0 attribution.

## Reproduction and focused checks

`uv run --no-sync python scripts/build_tempodrom_anhalter_v266.py` reads only
retained local sources and writes a small evidence ledger plus runtime profile.
It does not download new geodata or rewrite a city packet. Two Python tests
verify exact source reproducibility, all twelve sheets, complete roof retention,
the original legacy recipe and no foreign ownership of any retired native cell.
Four Bun tests check fail-closed receipts, three passable arch routes, all twelve
peaks, roof containment, original roof vertices, finite bounded attributes,
independent native axes and equal full/mobile geometry. Focused Ruff passes.

Drawn geometry: two renderables, 2,175 box instances and 944 triangles;
267,900 stored geometry/instance-attribute bytes. Native: one renderable,
10,656 orthogonal instances; 810,504 bytes. Construction records are discarded
unless diagnostics is explicitly requested. Materials use the existing shared
day/night lifecycle and both groups freeze their static transforms.

QA cameras: Anhalter `[740,37,1658]` towards `[713.53,16,1709.30]`;
Tempodrom `[708,88,1840]` towards `[622,24,1940]`. Integration/IAB checks are
recorded by the release owner separately; these focused tests do not claim
physical-phone or browser visual inspection.
