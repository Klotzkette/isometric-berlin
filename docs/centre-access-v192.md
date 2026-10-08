# Pariser and Potsdamer entrance fittings — v1.0.92

Pipeline step 10 adds three small static fitting groups. It does not regenerate
streets, change source buildings or apply another window layer to detailed heroes.

At the existing Pariser Platz U-Bahn entrance, the two previously unframed glass
sheets gain dark steel edge rails, eight posts, point-clamp cues and shallow side
caps. The existing blue sign gains an open white U, a narrow frame and a small
name board. There is no new glass or bar across the entrance. The old U55 label
in the 2011 photograph is not reproduced: that image documents the material and
construction system, not the current service designation.

The two Potsdamer Platz entrance halls retain their complete official LoD2
footprints, all steel/glass frames, roof grids, lettering and stairs. Twelve small
supports per hall connect the existing sloping handrails to their stair runs.
Each hall also gains the photographed small red/white DB identifier behind its
open frontage. The signs and posts remain inside the retained source envelopes;
the two stair-bank approaches keep a clear central passage.

`CentreAccessV192.ts` uses the original Pariser entrance anchor and the
`POTSDAMER_DETAIL_PROFILE.stationEntranceHalls` source frames. The latter retain
LoD2 owners `DEBE01YYK0002SCt` / `DEBE01YYK0000BRX` and OSM entrance nodes
`2491824683` / `1576240058`. The [architect's station account](https://www.hoe-architects.com/projekte/regionalbahnhof-potsdamer-platz-berlin/)
confirms the two semi-open steel/glass entrance structures. Rail/sign dimensions
are restrained display estimates fitted to those existing frames, not new
measurements or traced photographic geometry. No current source vertices or
previous detail are removed. The evidence JSON retains source-file hashes.

## Visual references

These photographs were inspected only as non-bundled visual references. No
photograph pixels, image textures, timetable text or copied font are included.

- [U-Bahnhof Brandenburger Tor, entrance 07-2011 (ubt-31).jpg](https://commons.wikimedia.org/wiki/File:U-Bahnhof_Brandenburger_Tor,_entrance_07-2011_(ubt-31).jpg), **Tomasz Sienicki**, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/): dark profiles, glass clamps and side caps.
- [U-Bahn Berlin Brandenburger Tor Eingang.jpg](https://commons.wikimedia.org/wiki/File:U-Bahn_Berlin_Brandenburger_Tor_Eingang.jpg), **thorbengeyer**, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/): open white U, frame and name board. Lettering uses the project's independent geometric alphabet.
- [Northern station entrance, 1785](https://commons.wikimedia.org/wiki/File:Nördlicher_Eingang_zum_Bahnhof_Potsdamer_Platz,_Berlin-1785.jpg) and [southern entrance, 1746](https://commons.wikimedia.org/wiki/File:Südlicher_Eingang_zum_Bahnhof_Potsdamer_Platz-1746.jpg), **© Raimond Spekking / [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (via Wikimedia Commons)**: DB identifiers and rail/support construction. These two references were already retained and credited by the project.

## Cost and checks

Both representations have three independently culled, static instanced batches.
Drawn modes store 403 instances / 32,572 buffer bytes. The separate Minecraft
reading uses 1,200 world-axis-aligned 16 cm blocks / 93,144 bytes. Both touch and
pointer retain the same full detail. No animation, texture or per-frame scene
traversal is introduced, and existing city residency budgets are unchanged.

`bun test tests/centre-access-v192.test.ts` checks original source anchors,
unchanged source profiles, source-envelope containment, support/floor alignment,
open approaches in both representations, native axes, static transforms and
bounded allocations. Three tests pass with 14,078 assertions.

`CENTRE_ACCESS_V192_PROFILE.cameras` provides fixed orthographic before/after
poses: Pariser `[600,18,308] → [578,6.4,286]`, span 35 m; Potsdamer north
`[312,24,1055] → [282,9,1014]`, span 48 m; south `[270,23,1101] → [296,9,1138]`,
span 48 m. Before uses the unchanged original scene; after adds only this group.
Viewer integration and final release verification are recorded separately.
