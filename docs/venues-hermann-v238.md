# Huxleys, Columbiahalle and Hermannplatz — v238

Two exact coarse buildings receive complete measured replacements inside their
existing city packets. Seven mapped Hermannplatz U-Bahn entrances receive small
above-ground recognition details in two ordinary streamed companion packets.
All six modes share the normal full-detail lifetime and unchanged live budgets.

## Geometry and evidence

`venues-hermann-v238-source.json.gz` preserves all 19 official LoD2 leaf parts,
wall/roof sheets, holes and source coordinates, plus the exact former source
records. The source archives remain the existing Berlin LoD2 tiles:

| Venue | Official parent | Parts | Previous owner / packet |
|---|---|---:|---|
| Huxleys Neue Welt, Hasenheide 107–113 | DEBE08YYF00009PW | 15 | OSM-way-30255865 / ring182-6_7 |
| Columbiahalle, Columbiadamm 13–21 | DEBE07YY900008dL | 4 | DEBE07YY900008dL / 2_7 |

The OSM 9 m Neue Welt envelope previously concealed the actual stepped source
roof; the highest measured part is 22.609 m above its parent ground. Columbia's
old 11.66 m parent extrusion concealed its lower flanking entrance pieces. Each
complete parent is translated rigidly to the retained outer-city ground y=3;
relative height differences and every X/Z coordinate remain unchanged. No
terrain or neighbouring building is changed. Native mode independently samples
the complete measured surfaces into merged orthogonal metre skins, with separate
orthogonal smaller fittings.

`venuesV238Replacement.json` contains four atomic packet transactions. Each
retired triangle matches the exact former owner recipe, including colour, in
its original mesh. Roof-line segments and navigation records have independent
receipts. The previous compressed packets remain byte-identical. Runtime must
verify the fingerprints before replacing the selected faces/lines/nav, install
the complete new mesh and local-coordinate navigation solids in the same
transaction, and preserve all other packet content. No companion repeats either
new venue shell. Existing v233 replacement owner DEBE02YY40000BAh in packet 2_7
is unrelated to Columbiahalle and remains intact.

The bounded OSM map extracts were retrieved on 2026-10-18. Their URLs/hashes and
complete selected OSM nodes/ways are in the source archive. Seven subway-entrance
nodes are mapped at Hermannplatz, with six attached stair axes. Only their
above-ground handrails and U-marker recognition are added. The seventh node has
no linked stair axis and therefore receives no invented long railing. The 1.8 m
rail separation and fitting/sign dimensions are explicit display estimates. No
new staircase depth, excavation, elevator, floor or underground walking route
is claimed. Existing terrain, navigation and the v210 Karstadt/place geometry
are unchanged.

## Primary references

- [Huxleys contact/address](https://huxleysneuewelt.de/contact),
  [operator history](https://huxleysneuewelt.de/about),
  [operator visitor access](https://huxleysneuewelt.de/information).
- [Neue Welt property operator](https://neuewelt-berlin.de/huxleys-neue-welt/).
- [Columbiahalle operator](https://www.columbiahalle.berlin/about-us.html) and
  [contact/address](https://www.columbiahalle.berlin/kontakt.html).
- [Berlin monument authority: Columbia cinema and sports hall](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/usa/tempelhof-schoeneberg/columbia-kino-und-sporthalle-647683.php)
  distinguishes the functional gymnasium, windowless high hall wall and stepped
  entrance pieces from the rounded **neighbouring Columbia Theater**. No theatre
  canopy or decorative window grid is transferred to the hall.
- [BVG Hermannplatz station](https://www.bvg.de/de/verbindungen/stationsuebersicht/u-hermannplatz).

Facade colours, selected Huxleys frontage window subdivisions, eave strips,
letter sizes and sign-board positions are restrained display estimates, not
surveyed present-day facade openings. Columbia's three doors follow the exact
mapped entrance nodes projected onto the measured walls (under 0.5 m). Huxleys
has no mapped entrance node in this extract; no exact portal location is
invented. Venue lettering is original geometric block lettering, not a copied
logo. No photographs, textures, downloaded font or protected image pixels are
bundled.

## Integration and verification

- Atomic input: `src/app/src/data/venuesV238Replacement.json` (`schema: 1`).
  Packet keys `drawn:ring182-6_7`, `minecraft:ring182-6_7`, `drawn:2_7`,
  `minecraft:2_7`; `records.mesh` is the original mesh index.
- Companion addition: `venues-hermann-v238-manifest-addition.json`, IDs
  `venues238-6_7` and `venues238-7_7`, both with required empty nav schema at y=3.
  No coverage/footprint or main manifest edit is made by this builder.
- Venue replacement GPU arrays total 53,748 bytes drawn / 241,140 bytes native.
  Maximum replacement mesh: 6,217 vertices / 30,708 indices. No packet budget,
  live cache limit, material texture count or prefetch limit is increased.
- Focused tests cover every retained measured boundary vertex, all local nav
  rings and heights, exact source-owner triangle/line replay, unchanged old
  packet hashes, native orthogonal normals, mandatory empty companion nav,
  bounded counts, seven source entrance identities, and the windowless hall.
- Camera targets (viewer X/Y/Z): Huxleys `[3320,13,3650]`, Columbiahalle
  `[1345,9,3835]`, Hermannplatz `[3500,5,3680]`. For a facade approach, look south
  from `[3320,8,3600]` at Huxleys; look north from `[1345,6,3890]` at Columbiahalle.

Run: `uv run python scripts/build_venues_hermann_v238.py` then
`uv run pytest -q tests/test_venues_hermann_v238.py`.

The separately requested v238 native-core regression audit is in
`audit-elevated-stations-payload-v238.ts` and
`minecraft-payload-only-v238-delta.json`. It independently verifies both source
rings and exact old vertical intervals, retiring only 195 source column tuples:
585 full / 195 mobile layer instances. It records 250 removed facade panes and
44 newly exposed neighbour panes. Every retained matrix/colour byte replays
through the unchanged v237/v206/v202 and earlier frozen receipts. Different-height
courses inside the longer third prism remain untouched. The three new/prior
owner audit tests pass (31,903 assertions); five targeted historical/count tests
also pass (161,344 assertions). No historical fixture or production payload was
rewritten for this audit.
