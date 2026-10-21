# Kino International and Café Moskau — v1.0.160

Step 10, two bounded existing sites. No source packet is rewritten; no new
coverage, streaming descriptor, tour stop, texture or running memory allowance.
Full drawn detail is identical on touch and desktop. Native geometry is built
separately from orthogonal surface blocks and stepped fittings.

## Verified identities and source geometry

| Site | Official LoD2 owner | Retained OSM identity | Source |
| --- | --- | --- | --- |
| Kino International, Karl-Marx-Allee 33 | `DEBE01YYK0000BqW` | way `24240975` | `alt-mitte-v169/source-392_5820-00.json.gz` |
| Café Moskau, Karl-Marx-Allee 34 | `DEBE01YYK0000359`, six parts | relation `1320420` | `alt-mitte-v169/source-392_5819-00.json.gz` |

The cinema's narrow separate rear owner `DEBE01YYK0001yF7` remains untouched.
Moskau retains all six source parts, roof slopes and its complete open atrium.
The adjacent pavilion is not renamed or included as part of Moskau. Full
original records and the corrected cinema surfaces are retained in
`geo_data/regierungsviertel/east-cinemas-v260-source.json.gz`; packet SHA256
receipts and unchanged roof hashes are in `east-cinemas-v260-evidence.json`.

## Architecture and evidence

The [Berlin Senate/Landesdenkmalamt history walk](https://www.berlin.de/ost-west-ost-kulturbahnhoefe/history-walk/artikel.1558584.php)
identifies Josef Kaiser's cinema, the projecting auditorium and glazed foyer,
gold lettering, poster field and fourteen relief panels across three windowless
sides. It credits Waldemar Grzimek's design and Karl-Heinz Schamal and Hubert
Schiefelbein's execution. The model uses shallow original impressions of figures
and angular relief strokes, not a tracing of the artworks.

[Berlin's official tourism account](https://www.visitberlin.de/de/kino-international)
publishes the unsupported nine-metre projection. The LoD2 model incorrectly
extends this overhang down to ground. The exact owner therefore receives a
source-aligned nine-metre lower-front recess with a soffit at scene Y=9 m
(six metres above display ground, an explicitly estimated height). Its roof
and upper source sheets remain unchanged. The source height is 17.127 m above
display ground, versus the retained OSM tag of 15 m; the original measured roof
Y=20.127 m takes precedence. Both conflicting source values are retained.

[Yorck's 2026 restoration record](https://presse.yorck.de/assets/2026_International_Fakten.pdf)
confirms the completed roof and technical refurbishment. Its unlocated new roof
plant is not fabricated. The building is represented after restoration, with
no temporary construction hoarding or invented current movie advertisement.

The [official Moskau history walk](https://www.berlin.de/ost-west-ost-kulturbahnhoefe/en/history-walk/artikel.1604380.en.php)
identifies Josef Kaiser with Horst Bauer, the transparent concrete-framed
atrium pavilion, Bert Heller's mosaic and the Sputnik replica above the roof.
The credited Wolfgang Bittner photograph shows the two glazed levels, pale
columns/slabs, upper diamond screen, rooftop lettering and corner mast.
The model adds those elements to existing source planes. The mosaic is a quiet
abstract material cue rather than a copied design. The [owner's restoration
statement](https://www.berggruenholdings.de/presse/PM20071213Cafe%20Moskau.pdf)
independently supports the open atrium and relationships between inside and out.

Photographs are reference-only, copyright retained by Landesdenkmalamt Berlin /
Wolfgang Bittner and the respective publishers. No image bytes or protected plan
are included. Small fitting dimensions, slab and window divisions, colour tones,
relief arrangement, letters, diamond-screen proportions, Sputnik position,
0.72 m replica diameter and five-metre mast height are **display estimates**,
not survey measurements or exact replicas of artworks.

## Exact correction and integration

`uv run python scripts/build_east_cinemas_v260.py` derives only new v260 files.
The original source and public packet bytes remain identical. The receipt
identifies 2,896 old triangles and 17 source ink segments by complete encoded
mesh fingerprint plus exact index in `6_-1` and its ink companion. Shared
neighbour edges are explicitly retained. One exactly matched v186 lower side
edge is clipped by 0.7 m at the recess; its rear complement and every other
edge stay unchanged, via `eastCinemasPreviousEdgesV260`. A mismatched fingerprint leaves the
original geometry in place. The complete required replacement contains 28
drawn shell triangles or 958 independently orthogonal native triangles.

`EastCinemasV260.ts` appends recognition into the existing Alexander public realm
batches, sharing material, upload and disposal. `eastCinemasV260Navigation.ts`
splits only a full-value matched cinema collision record into its recessed
lower footprint and unchanged upper footprint. The source-id-restricted
walkable-interior predicate keeps the undercroft clear; the independent native
shell-cell predicate respects the represented stepped edges. The roof never
becomes a new street-level walking surface.

| Family | Added recognition | Instance bytes |
| --- | ---: | ---: |
| Drawn | 596 boxes, 887 round strokes, one small sphere | 112,784 |
| Native | 8,675 axis-aligned boxes | 659,300 |

The source correction replaces the exact old owner before publication and the
recognition uses the existing batch lifetime; there is no frame-loop work or
runtime fetch for references. Counts are static geometry measurements, not a
claim about total browser memory.

Targeted Python tests verify source/packet hashes, full original records,
unchanged roof sheets, the exact recess, preserved atrium and orthogonal native
shell. Frontend tests verify exact triangle-only ownership, deterministic finite
fittings, identity-guarded navigation and open undercroft in both families.

QA views (scene metres, fov 55): cinema target `[3501,12,-115]`, camera
`[3410,55,-20]`; café target `[3480,10,5]`, camera `[3400,45,-80]`.
