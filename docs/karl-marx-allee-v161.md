# Karl-Marx-Allee heritage refinement, v1.0.61

Pipeline step 10. This is a finite refinement inside the already approved
v1.0.59 surrounding-city lobe. It adds no district and changes no core asset.
The spoken “Zuckerbäckerbauten” is interpreted as the heritage section of
Karl-Marx-Allee. Both pairs of towers are included: Strausberger Platz and
Frankfurter Tor, the latter just south of Bersarinplatz.

## Evidence and the two tower pairs

Berlin's heritage inventory identifies the Strausberger Platz ensemble as
[09085179](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085179)
and Frankfurter Tor as
[09085171](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085171).
These are different ensembles. Haus Berlin and Haus des Kindes are the
stepped western portal at Strausberger Platz. Frankfurter Tor has the two
round, glazed, columned crowns and copper domes.

| Building | OSM way | Berlin LoD2 parent |
| --- | --- | --- |
| Haus Berlin | 222405403 | DEBE02YY200001O0 |
| Haus des Kindes | 286744641 | DEBE02YY200002tt |
| Frankfurter Tor north | 288230369 | DEBE02YY20001fZe |
| Frankfurter Tor south | 316933471 | DEBE02YY20001fZf |

The contemporary plaster appearance of Haus Berlin is consistent with the
[district museum's account](https://www.berlin.de/ost-west-ost-kulturbahnhoefe/history-walk/artikel.1558619.php).
Its counterpart is documented at
[Haus des Kindes](https://www.berlin.de/ost-west-ost-kulturbahnhoefe/history-walk/artikel.1558621.php).

Two freely licensed photographs supplied non-bundled recognition references:

- [Berlin Frankfurter Tor 01.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Frankfurter_Tor_01.jpg),
  H.Helmlechner, 7 October 2012, CC BY-SA 4.0
  (<https://creativecommons.org/licenses/by-sa/4.0/>).
- [Strausberger Platz — Haus Berlin](https://commons.wikimedia.org/wiki/File:Strausberger_Platz_-_Haus_Berlin_-_geo.hlipp.de_-_31758.jpg),
  Colin Smith, 11 January 2013, CC BY-SA 2.0
  (<https://creativecommons.org/licenses/by-sa/2.0/>).

No photograph, crop, sampled texture, font or live map request enters the
viewer. Cream cornices, subdued ceramic/plaster colours, dark window fields,
small pale frames, stone sills and shopfronts are procedural indications.
Individual bay spacing is an estimate; this is not a per-window survey.
The retained measured source silhouette supplies the architectural variation.

## Source geometry and conflict

`geo_data/regierungsviertel/karl-marx-allee-v161.json` retains all original
surface rings of 41 fixed LoD2 parents / 185 parts. The parent list is explicit;
there is no distance-based runtime overwrite. The three existing official
archives `LoD2_393_5819.zip`, `LoD2_394_5819.zip` and `LoD2_395_5819.zip` supply
coordinates and per-part roof slopes under dl-de/zero-2-0. The evidence file
records their URLs and SHA-256 digests. Their shared parent floor is translated
to the established outer-city display ground y=3 m; local source height
differences remain intact.

The old surrounding layer extruded each entire parent footprint to its highest
point. The refinement displays its actual individual measured parts instead,
restoring roof slopes, low wings, setbacks and tower height tiers. Original
source geometry stays in the evidence and source cache.

The two tallest Frankfurter Tor parts are an explicit exception:
`DEBE3Dc7k2aJikEh` and `DEBE3DQk7OOGlYOE`. Their official simplified square
hip roofs cover the photographed circular colonnades. Those coarse crowns
cannot coexist visibly with the actual dome shape. The source-bound housing
footprints remain below y=34.5 m, with square roof terraces beneath two round
glazed drums, pale columns, balcony rings, copper domes, standing seams, open
lanterns and small finials. Both crowns end at y=56.06 m, or 53.06 m above
display ground, using the higher source parent envelope. The north source
envelope alone was only 47.85 m. That discrepancy and the non-surveyed component
proportions are recorded in the evidence; the different original source rings
are preserved. No undocumented new wing or generic surrounding block is added.

## Bounded loading and preservation

The new exporter `scripts/build_karl_marx_allee_v161.py` operates offline.
Only five existing packets change: `7_0`, `8_0`, `9_0`, `10_0`, `10_1`, each
in drawn and native form. Unrelated chunks are untouched. Every new triangle
is clipped against the same 512 m tile boundary, so no distant owner tile must
be loaded to see a building crossing a seam.

`chunk_payload(..., replaced_source_ids=...)` suppresses only those explicitly
named parent envelopes and their old full-height navigation. Its default
output is unchanged. The refinement immediately appends complete replacement
shells and source-part navigation retaining the parent and part identities.
All other building navigation, roads, bridges, water and terrain are unchanged.

Before first publication, each original affected packet was compared against
its independently regenerated prepared-source baseline. For both modes, every
unowned coloured triangle is preserved as a position/colour multiset, regardless
of reindexing. That accounting is recorded in
`geo_data/regierungsviertel/karl-marx-allee-v161-audit.json`.

The four drawn modes share identical geometry on touch and pointer devices.
Minecraft uses independent surface-only two-metre blocks with orthogonal faces;
hidden faces between adjacent blocks are omitted. No solid interior fill or
smooth duplicate is kept. Existing serial fetch, cancellation, frustum selection
and eviction handle these packets without new startup code, caches or workers.
The largest decoded packet remains below 4.2 MiB, below the existing 12 MiB
limit; each mesh is checked against the runtime vertex/index limits.

Native facade glazing uses the block centre projected onto the source facade:
only centres inside a window receive dark glass. This prevents small windows
from painting every touched two-metre block into a continuous dark curtain.
The correction preserves the occupied block set and every position triangle;
the circular cupolas retain their separate glazed-drum material.

Reproduce after the surrounding base export with:

```sh
uv run python scripts/build_karl_marx_allee_v161.py
uv run pytest tests/test_karl_marx_allee_refinement.py
```

The exporter accepts `--out` for an isolated output copy and `--refresh-source`
to re-extract from the named official raw archives. It changes no bounds,
93-place tour, movement settings or original detailed-city payload.

Useful visual-QA camera targets in the shared world frame are Strausberger
Platz `[3752, 25, 78]`, central avenue `[4300, 15, 240]`, and Frankfurter Tor
`[5501, 30, 436]`; inspect both close oblique views and the full avenue.
