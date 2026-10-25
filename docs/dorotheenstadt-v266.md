# Dorotheenstadt — v266

Bounded recognition work at the Brecht-Haus, the Dorotheenstädtisch-Friedrichswerderscher Friedhof and the former Permanent Representation at Hannoversche Straße 28–30. The complete measured buildings, roofs, courts, navigation and existing details remain. The 93-stop tour and all loading, decode and residency limits are unchanged.

## Identity and new detail

The [LDA record 09011063](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011063) identifies the three-storey Brecht-Haus at Chausseestraße 125, its regular axes and lateral round-arched passage. The [Literaturforum's building history and exterior photograph](https://lfbrecht.de/brecht-haus/geschichte/) establish the five street-facing window axes, projected window heads, brackets, cornices and dentils. The new front adds these forms, divided glazing, a shallow arched wooden entrance reading and an unlettered memorial plaque. The source building remains closed to walking; no new passage or collision change is claimed. Its five complete measured parts, including the courtyard wings and all roofs, are unchanged.

The [BBR Museum der 1000 Orte](https://www.museum-der-1000-orte.de/bauwerke/bauwerk/altbau) identifies the former Permanent Representation at Hannoversche Straße 28–30 and describes the six-storey plaster front, five-axis middle, shallow side risalits, strong upper sill cornice and terracotta-faced atelier storey. The BBR exterior photograph supports five broad paired middle bays, side bays, stone base, thin framing and the continuous fine-grained atelier glazing between red bands. These are added to three exact measured front sheets; the adjacent modern extension is preserved without re-authoring it. No current tenant sign is added.

The [LDA garden-monument record 09010186](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09010186) and the [cemetery operator](https://evfbs.de/start/friedhoefe/region-nord/einzeldarstellung/dorotheenstadt-i/adresse-lageplan) identify the cemetery at Chausseestraße 126. OSM way `24733507` bounds the new 90 anonymous, dispersed grave groups. These combine low stone borders, planted inset beds, upright tablets, stepped markers, simple crosses and flat slabs. They are **illustrative cemetery texture, not surveyed grave locations or named graves**. All mapped grave points receive a 3 m exclusion, mapped trees 1.5 m, buildings 1.2 m and paths their estimated half-width plus 1.15 m. Complete group envelopes remain at least 2 m inside the cemetery. The adjacent French cemetery is not included. The complete chapel owner is retained as evidence and as an exclusion footprint; its roof, facade and entrance receive no replacement.

Three additional source-bound eave profiles at Hotel Aquino, Hannoversche Straße 5b, improve the westward street transition without adding windows or shopfronts. The neighbouring `DEBE01YYK00003Kp` was inspected but has no qualifying street sheet, so it receives no addition. Existing Torstraße v239/v244 openings and v254 storefronts are untouched. The Mensa Nord and other HU owners are excluded and handled separately.

All small dimensions, facade rhythms, portal dimensions, hues and grave forms are display estimates. The Brecht photograph is monochrome and does not establish current paint colours. No image pixels, textures, text inscriptions or interior reconstruction are bundled.

## Source and exact replacement contract

`dorotheenstadt-v266-evidence.json.gz` retains five full source owners, sixteen parts and 221 original sheets, including two evidence-only owners. It also retains original input hashes, complete cemetery boundary, exclusion paths/points/footprints and every added facade role. The old source and packet files are never written by the generator.

Exactly **800 generic drawn v169 aperture triangles** on four identified front sheets may yield. `dorotheenstadtV266Previous.json` contains packet fingerprints and exact triangle indices. Measured walls/roofs, all other fronts and native source geometry remain. A changed packet, disabled replacement, wrong kind or native family is a conservative no-op. The complete required new front must exist before transfer is enabled.

Integration (coordinating task):

- Add `createDorotheenstadtV266(native)` from `DorotheenstadtV266.ts` to the required-site transaction.
- Wire `transferDorotheenstadtTrianglesV266(enabled,tile,native,part,indices,offset)` from `dorotheenstadtV266Ownership.ts` beside the IHZ exact aperture transfer. Gate it on the completed required-site replacement.

The native fittings independently follow existing orthogonal source skin planes. Small sloped clipping boundaries are stepped conservatively inside those planes. No rotated/smooth facade is copied into native rendering.

## Delivery and checks

Each family has two renderables: one facade mesh and one instanced cemetery batch. Drawn: 5,107 vertices / 3,309 triangles; native: 7,228 vertices / 4,920 triangles. The cemetery has 407 instances in both families. Full GPU attribute/index/instance storage is 209,177 bytes drawn and 285,776 bytes native. Runtime data is approximately 285 kB. Mobile receives exactly the full drawn geometry, with frozen transforms and no texture or frame callback.

The grave groups use the existing production ground datum of **5.2 m**, checked against `ground-context.json` at all 90 centres and all four envelope corners. Both the native raster and the drawn continuous sampler agree there. The source hash is retained in the evidence; a regression check prevents the earlier 3 m fallback from burying the markers under the existing ground.

Four Python tests passed for complete source/packet preservation, exact aperture scope, cemetery clearances and independently orthogonal native geometry. Four Bun tests passed for production ground clearance, full mobile parity, final allocation, native geometry and 800 exact gated triangle transfers with unchanged unrelated indices. Ruff and TypeScript compilation passed. Browser review is performed by the coordinating task; no independent browser review is claimed here.

Review cameras (position → target):

- Brecht: `[977,33,-1051]` → `[934,13,-1090]`.
- Former Permanent Representation: `[1048,42,-963]` → `[1010,17,-870]`.
- Cemetery: `[1087,127,-1188]` → `[859,5,-1001]`.
- Hannoversche transition: `[991,39,-842]` → `[918,20,-886]`.

Generator: `uv run --no-sync python scripts/build_dorotheenstadt_v266.py`. Focused checks: `uv run --no-sync pytest tests/test_dorotheenstadt_v266.py -q`; in `src/app`, `bun test tests/dorotheenstadt-v266.test.ts`.
