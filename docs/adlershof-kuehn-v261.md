# Adlershof and Kühn, v261

This finite change replaces the flat source prisms of the **Großer Windkanal, Trudelturm, Erwin-Schrödinger-Zentrum and Isothermische Kugellabore** with their complete measured LoD2 roof/wall geometry. The eight owners across both sites contain 27 parts. Every measured surface remains in the frozen source; no source archive is replaced.

The atelier/smithy founded by Fritz Kühn and continued by Achim Kühn is at **Richterstraße 6, 12524 Berlin**, southeast of Adlershof. The operator history identifies Bohnsdorf; its footer uses Altglienicke. The exact street address and retained mapped workshop footprints settle placement without moving it onto the Adlershof campus. Four measured workshop buildings are included; the separate historic Vorwerk Falkenberg house toward the street is not claimed as the smithy.

The primary sources and conflicts are recorded in `geo_data/regierungsviertel/adlershof-kuehn-v261-references.json`. Three official LoD2 archive URLs and SHA-256 digests accompany the frozen measured rings. Existing `east-city-v200-source-owners.json.gz` preserves the four older Adlershof owner footprints and heights used for exact transfer verification. No reference photographs or video are shipped.

## Geometry and limits

- Drawn geometry retains the actual measured roof profiles and wall sheets. The wind tunnel's 120 m figure is circuit length, not a straight building length. Trudelturm reaches source height 19.202 m above ground, consistent with the approximately 20 m primary reference.
- **Windkanal fidelity limit:** the complete official LoD2 still uses coarse planar roof abstractions. Sixteen western roof faces mostly share a roughly 41° slope and one major attached part has a flat roof; this is not a faithful circular concrete-tube cross-section. The change restores all official geometry, heights and courts, but must not be described as a detailed visual reconstruction of the round tube. A separately evidenced tube model remains necessary for that recognisable form. Trudelturm's source diameter is approximately 11 m, with its full 19.202 m height retained.
- Native geometry uses an independently generated exterior set of 2 m orthogonal cells. No hidden solid cube stacks and no runtime geometry generator are introduced.
- ESZ gets distinct brick/anthracite material readings and bounded facade windows. Kühn gets pale workshop walls, grey roofs and dark industrial window frames. Window subdivision, palette and sill heights are explicit display estimates, not a measured facade survey. Exact chimney/sculpture placement and interiors are not invented.
- The Kühn addition covers only the convex envelope of the four measured workshop footprints, approximately 61.5 × 55.1 m in bounding extent. This small working-courtyard display envelope is not a cadastral parcel boundary or a general Bohnsdorf extension.
- The wind-channel union matches the old owner footprint within 0.000001 m² and keeps both courtyard holes open. Each of its five parts now carries its own measured height. No public route through an enclosed experimental tunnel is invented.
- One ESZ closure strip is narrower than the 2 m native grid: its intersecting cells retain its identity rather than omitting the part. Five sliver triangles collapse only at the existing centimetre packet precision; their original source rings remain preserved.

## Preservation

Only two existing descriptors change: `east200-20_19` and `east200-21_19`. Independent reconstruction of their four named flat prisms matches triangle signatures at centimetre precision, so the generator removes only those index entries and their exact roof-ink segments. All original position/colour buffers and every unrelated index, line and navigation record remain. The old public packet files are retained byte for byte.

Two isolated native sphere-roof cells have a different historical triangulation diagonal. The transfer verifies exact equal planar coverage before replacing four triangles; this limited equivalence is recorded separately in the evidence. No fuzzy geometry match is used.

`kuehn261-26_24` is one additional normal city-streaming descriptor, with exact drawn ground and independently stepped native ground. There are six new compressed assets in total, each below 650 kB compressed / 2.6 MB decoded. Existing packet, resident, queue, catalog and camera-tour budgets are unchanged. Descriptor count rises from 2193 to 2194, below the existing 2208 ceiling.

## Rebuild and integration

Run:

```sh
uv run --no-sync python scripts/build_adlershof_kuehn_v261.py
uv run --no-sync pytest -q tests/test_adlershof_kuehn_v261.py
```

The generator writes only new v261 source-derived packets, evidence and `adlershof-kuehn-v261-manifest-addition.json`. It reads original descriptors from that frozen addition on later runs, so rebuilding after integration does not progressively refine already-refined packets.

The root integration uses `scripts.integrate_adlershof_kuehn_v261.merged(previous, addition)`, which changes the two exact descriptors, appends the one Kühn descriptor, appends its one footprint, and adds `adlershofKuehnV261` provenance. No runtime builder/import is needed.

`predecessor_manifest_v261(current, reader)` verifies source bytes, all four old asset bytes and all six new packet bytes, checks semantic part identity and bounds, then returns the complete v260 predecessor. Its canonical SHA-256 is frozen in the adapter; any unrelated metadata, descriptor, order or coverage edit fails. No old Git object or duplicate full manifest is needed. This verifier is wired before the v259 lineage checker and its historical catalogue equality assertion.

Shared release files and attribution are integrated. Reference metadata contains the required Geoportal Berlin / OSM attribution text. Existing source ownership and only the explicitly documented four-owner transfer should be reflected in global audits.

Inspection camera targets (world coordinates): wind tunnel `[10570,10,9948]`; ESZ `[10637,12,9992]`; spheres `[11004,7,9862]`; Kühn courtyard `[13344,5,12425]`. No browser or Safari was opened for this work.

## Bounded Windkanal contour supplement

Following visual QA, `createWindkanalV261(native)` adds a **partial, explicitly estimated** rounded skin to the four inclined outer roof facets of the single measured U-shaped part `DEBE3DA0Ja4DQLYW`, plus the upper arcs of five reinforcing rings. WISTA's primary photograph shows the round concrete shell and reinforcing rings; its information gives 8.5–12 m tube diameter and 58 × 26 m outside extent. The skin rises at most 0.95 m above the local measured facet, plus 0.07 m clearance; ring arcs add 0.18 m. It does not stack a second complete tube on the roof, replace the higher measurement-house attachment, or claim that the coarse lower LoD2 walls have become a faithful circular section.

The 172 kB frozen data contains 1,559 drawn triangles and 1,036 independently sampled 1 m native contour cells. Both runtime models remain below 260 kB of GPU buffers. Every drawn triangle is constrained to this one source part; native cells are bounded by its half-cell reading. No packet, catalog, footprint or queue changes accompany this addition.

The root integration attaches `createWindkanalV261(native)` in the existing landmark group and uses `windkanalV261GroundAt(x,z,native)` in the existing outer roof-support query. It matches the exact generated triangles/native cell tops, returns null in both courtyards and off the skin, and uses a bounded one-metre lookup. No new culling/streaming path is required.

Additional tests: `uv run --no-sync pytest -q tests/test_windkanal_v261.py` and `bun test tests/windkanal-v261.test.ts` from `src/app`. Generator: `scripts/build_windkanal_v261.py`; reference and limits: `geo_data/regierungsviertel/windkanal-v261-profile.json`. The small WISTA photograph was read as reference only and is not shipped.
