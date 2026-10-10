# Core material priority — v1.0.111 / Step 10

This presentation-only refinement reuses the retained OSM attribute lookup in
the two core factories. Explicit single CSS facade colours and known
`building:material` values now take priority over generic illustration samples
outside the earlier urban colour zones too. Existing custom named-colour
interpretations stay intact; mixed/free-text values are not guessed. No source
record changes or new source acquisition is involved.

The resolver runs after the existing panorama, regional and individually
authored colour priorities. The coverage and detailed drawn factories share
this one decision, and native columns snap its result to their existing block
palette after their existing architectural priorities. `urbanFacadeScope`
remains bounded because it also selects real facade geometry. Roof resolvers,
glazing decisions, storeys, navigation and native layer counts are unchanged.

Outside those zones, only unmeasured generic illustration samples whose RGB
spread is less than 24 use a continuous lightness floor instead of the previous
quantised levels. Their ivory blend falls from 38% to 24%. The existing modest
generic-family blend remains. Coloured samples retain their former treatment;
recorded colour/material and authored models return before this fallback.
All such adjustments are display paint, not measured facade observations.

The source regression cases keep their complete original footprints and heights:

| Core owner | Retained source | Existing evidence |
| --- | --- | --- |
| `ilN3ccbn` | OSM `way/25779821` | `building:colour=cornsilk` |
| `gi6ByK1f` | OSM `way/25779251` | `building:colour=tan` |
| `Ht000054` | OSM `way/404905998` | `building:material=concrete` |
| `E397kXL5` | OSM `way/107308027` | `building:material=brick` |

The frozen `core-material-v211-before.json` fixture was captured before changing
the core factory files from release commit
`563028bdb0bc0e22a789edc5c3fa59f21028b1c9`. It checks every non-colour attribute,
index, instance matrix, renderable inventory and buffer byte count, including both
actual full and mobile native factories. Additional tests retain historical
source-hex, Kollhoff, Wilhelmstraße and coloured-sample bytes; compare early and
late wall colours; exercise continuous neutral samples and courtyard exclusions;
and verify that native source roof selection stays unchanged.

The change adds zero meshes, vertices, indices, shaders, draw calls or GPU
attribute/instance bytes. Construction remains deterministic and adds no
per-frame work. Focused core, source-attribute and urban-presentation tests and
TypeScript validation cover the change; release-wide integration remains in the
parent presentation audit.
