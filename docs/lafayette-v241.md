# Quartier 207 / former Galeries Lafayette — v241

Bounded Step 10 refinement of Jean Nouvel's Quartier 207 at Friedrichstraße / Französische Straße, OSM way `25945410`, main measured parent `DEBE01YYK00008UX`. This is the glass building, not the adjacent Quartier 206. The former generic cream wall with small dark apertures now reads as continuous glass with fine vertical seams, paired horizontal metal bands, a curved northwest corner and glazed roof articulation. No new geographic coverage or additional streaming family is introduced.

## Evidence and present use

- [Ateliers Jean Nouvel, Galeries Lafayette](https://www.jeannouvel.com/projets/galeries-lafayette/): architect's project description, 1991–1996, curved corner, layered glass, roof and internal cones. Architectural facts only; no imagery or text copied into the model.
- [BMG, 13 January 2026](https://www.bmg.com/news/bmg-to-relocate-global-headquarters-to-iconic-lumina-building-in-berlin): the building is undergoing renovation as Lumina; BMG's move is planned for early 2027. The model claims neither an operating department store nor completed future alterations.
- [visitBerlin, Galeries Lafayette](https://www.visitberlin.de/en/galeries-lafayette): department store closed on 1 August 2024.
- Inspected reference photograph: [Berlin, Mitte, Friedrichstrasse 76-78, Galeries Lafayette](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Friedrichstrasse_76-78,_Galeries_Lafayette.jpg), **Jörg Zägel**, **17 June 2010**, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Reference only for glazing tone, horizontal banding, corner and roof. No photograph, crop or image texture is bundled. Global credit manifests are integrated separately.

The full measured parent and all twelve auxiliary owners are copied verbatim from the retained `alt-mitte-v169/source-390_5819-00.json.gz` catalogue into the small reproducible source snapshot. The main parent contains 97 surfaces (93 walls, three roof sheets and one ground sheet), with scene base Y=5.2 m and top Y=40.244 m. The original NHN transform and the source's footprints, holes, roofs and navigation remain unchanged. Every new drawn fitting is clipped to its actual source plane. Bay spacing, colours, reflections, rail dimensions and floor-band levels are explicitly display estimates, not a façade survey.

The complete owner set is `DEBE01YYK00008UX` plus `DEBE00YY1280004` with suffixes `o f V R d i a b Z h T X`. Exact replay confirms all 13 owners' 3,174 emitted / 3,342 delivered source triangles remain in the active resident packets. All twelve auxiliary owners have zero generic facade triangles. Their original roof vertices lie below the local main roof by 1.114–15.935 m; this existing enclosure is recorded per owner in `lafayette-v241-retirement-evidence.json`. They remain renderable original geometry, but the opaque main envelope occludes them. No invented roof towers or arbitrary height changes resolve that source conflict.

## Exact correction and preservation

Only the main owner's obsolete generic drawn window decorations are retired. They are identified by exact encoded position, colour and index fingerprint, with exact triangle-index lists:

| Existing packet / mesh | Fingerprint | Retired triangles |
| --- | ---: | ---: |
| `2_0` / 0 | 1773677354 | 1,114 |
| `2_1` / 0 | 3924025338 | 2,678 |

The 3,672 originally emitted generic triangles become 3,792 after tile clipping. Every unrelated index and every encoded source attribute remains identical. Any changed packet fingerprint retains the original geometry. The helper does nothing when disabled, in native mode, on another mesh family or another packet identity. Required replacement construction precedes enabling the correction. No main or auxiliary source sheet, source ink, existing native cell, roof or navigation object is retired. There are no v186 measured edge additions or v233 roof/door/curb packets for these owners.

The native model is separately generated from the exactly replayed **3,424 emitted / 3,504 delivered main-owner native triangles**. Coplanar exterior faces are joined and fitted directly, including the staircase returns, roof steps and curved-corner steps. All new triangles are axis-aligned; no smooth façade is merely rounded into native mode. The existing native source geometry remains underneath. This avoids guessed clearance from smooth walls, which would detach the glass at the rounded corner. The party-side east wall is preserved.

## Runtime and verification

`addQuartier207V241(root, native)` creates one required bounded mesh in either mode through the existing chunk decoder. `transferQuartier207TrianglesV241(enabled, tile, native, part, indices, offset)` applies only the two exact drawn receipts. It uses the shared `architectureV241` integration flag. There is no new loader, texture, line layer, material family, live-residency allowance or mobile reduction. Construction yields through the existing scheduler and cancellation publishes no partial root.

| Profile | Packed vertices | Packed triangles | Meshes |
| --- | ---: | ---: | ---: |
| Drawn | 13,816 | 7,456 | 1 |
| Native | 24,728 | 13,687 | 1 |

The single required JSON is 801,362 bytes raw / 242,983 bytes gzip. Spatial bounds are X=1200…1282, Z=485…580, Y=5…41.1 m. Existing source envelopes remain independently owned. The payload is identical on mobile; native and drawn each use their full separate profile. Lossless JSON bundling and overall release-budget validation are handled with release integration.

Focused checks cover exact 13-owner source identity, original-input hashes, complete glass coverage of the actual front/corner/roof sheets, bounded and reproducible packet output, native orthogonality, exact retirement with unrelated-index preservation, fingerprint mismatch behavior and cancelled construction. `uv run pytest tests/test_lafayette_v241.py tests/test_lafayette_v241_receipts.py` and `bun test tests/quartier207-v241.test.ts` are the focused commands.

Isolated browser previews include the actual retained source envelope and the new profile together; native uses its actual native envelope. Both front and corner were inspected in real Chrome with no page errors. Temporary images: `/tmp/lafayette-v241/drawn-corner.png`, `drawn-front.png`, `minecraft-corner.png`, `minecraft-front.png`. The complete production-scene browser check is performed during integration.

Cameras, scene XYZ:

- Street corner: `[1133, 48, 452]` → `[1240, 21, 532]`.
- Higher corner preview: `[1133, 63, 452]` → `[1240, 22, 532]`.
- West street front: `[1128, 35, 528]` → `[1240, 20, 532]`.

Reproduction uses the retained local inputs: `uv run python scripts/build_lafayette_v241.py` and `uv run python scripts/lafayette_v241_receipts.py`. No source-network fetch is needed.
