# BahnTower crown — V348 / v1.0.228

The bounded addition refines the **BahnTower at Potsdamer Platz 2**, using the
existing `DbTowerArchitecture` owner. It adds the open steel cross-bracing
visible behind its curved glass crown. Ten approximate structural bays and
their short ties meet the existing crown posts, inside the same roof-height
envelope. All 26 storeys, glazing, logo, earlier fittings, three official source
parts and 99 original measured surfaces are retained unchanged.

## Evidence and limits

- Deutsche Bahn's [2025 photograph DB283779](https://mediathek.deutschebahn.com/marsDB/de/instance/picture/Bahntower---Konzernzentrale-der-Deutschen-Bahn---Berlin---Potsdamer-Platz.xhtml?oid=8324901),
  copyright Deutsche Bahn AG / Volker Emersleben, provides a clear exterior
  crown view with slender open diagonal steelwork behind the glazing.
- [SMV's completed-project account, 9 September 2024](https://www.smv.com/news-und-stories/bahntower-ist-wieder-an-db-ag-uebergeben),
  photograph © SMV Bauprojektsteuerung, corroborates the thin exterior frame
  and visible supports. The account describes the completed refurbishment.
- [AUKETT + HEESE's project record](https://www.aukett-heese.de/de/projects/sony-center-bahntower/)
  confirms the 103 m, 26-storey tower and the 2024 refurbishment. It does not
  supply a surveyed steelwork layout.
- The existing [LoD2 record and provenance](db-tower-refinement.md) remain
  the metric anchor. No new building source or ground geometry is introduced.

The structural bay grouping, 13 cm steel section, inset and tie dimensions are
**photo-informed display estimates**, not measured construction details. This
pass does not remodel the roof plant, add a traversable interior or claim a
photographic reconstruction. Source images remain external references; no
photograph, crop or texture is shipped or fetched by the viewer.

The spoken **“Schornstein”** does not establish a separate site's identity.
The cited BahnTower records do not identify a chimney belonging to this tower.
Other Berlin chimneys and the distinct former debis/Tiergartentunnel ventilation
tower must not be conflated with it. No chimney is invented, removed or declared
corrected by this pass.

## Construction and preservation

`DbTowerCrownV348.ts` generates only additive frame members. A construction-time
pin covers the entire unchanged 19,829-character source object and the exact
height/datum profile; changed inputs return no new members. The helper is called
inside the existing parent factory and introduces no separate scene root,
admission cache, per-frame work, request or disposal owner. The same frame batch,
materials, parking, worker transfer and world lifetime own every new member.

Drawn uses 20 slender diagonal beams and 22 short post ties. Native independently
constructs the complete set from 440 cardinal boxes; it does not retain rotated
copies of the new Drawn beams. Both mobile profiles retain the complete addition.
Existing Native geometry is preserved unchanged. Current walking surfaces and
roof callbacks do not change: this is non-traversable crown ornament entirely
below the retained roof maximum.

| Profile | Existing draw calls, unchanged | Total instances | Added array bytes |
| --- | ---: | ---: | ---: |
| Drawn desktop and mobile | 6 | 12,591 | 3,192 |
| Native desktop | 5 | 11,793 | 33,440 |
| Native mobile | 5 | 6,452 | 33,440 |

No startup, Worker, residency, archive or tour limit is changed. No scene-wide
performance improvement is claimed from these small additions.

## Validation

Four V348 tests preserve independent hashes captured by executing the published
`00cc1ce0` constructor: every earlier fitting in all four profiles and all Drawn
body coordinates. They also check strict changed-source rejection, full mobile
parity, cardinal Native members, unchanged batch counts and maximum height,
the actual tilted instance matrix and exact worker-transfer restoration.
The six existing DB tests continue to check all storeys, exterior window rays,
original roof hits, native-column ownership and Day/Night/lights-off materials.
Both focused suites pass. Full-release and actual browser validation are separate
root release checks, not claims made by this focused geometry test.
